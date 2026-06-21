namespace Zeta.Core

/// **`SybilBftLiveness` — the liveness layer over the distinct-source quorum (Aaron 2026-06-08, shadow*).**
///
/// `SybilBftProtocol` (#7048) gives *safety* (no two honest views commit different values) but not
/// *liveness*: if the leader is silent, nothing forces progress. This layer adds the standard BFT liveness
/// mechanisms — **heartbeats**, **timeout-driven suspicion**, and **view-change** (leader rotation) — but
/// reuses the anti-Sybil discipline so the liveness path is itself Sybil-resistant.
///
/// **Aaron's design inputs, made concrete:**
/// - **Heartbeats are the timeout mechanism.** A leader that keeps beating holds the view; silence past a
///   `Timeout` (in *logical ticks* — DST §7, no wall clock) makes a replica suspect it and call a view-change.
/// - **Persistence-over-time increases the identity claim.** A source that sustains a *consistent* drift
///   signature accrues a stronger claim than a fresh one — a forger can fake a moment, not a long regular
///   history. `claimStrength` rewards sustained beats and penalizes jitter (variance).
/// - **Harmonic resonance finds the clock generator efficiently.** `resonantPeriod` locks onto the
///   generator's period via an **autocorrelation peak** on the beat train (O(n·maxLag), not a brute scan of
///   candidate generators). Anchor: autocorrelation pitch detection (Rabiner & Schafer); a real clock's beat
///   train resonates at one dominant lag, a forged/irregular one does not.
///
/// **The BFT-critical bit — view-change is ALSO counted over distinct sources.** A naive view-change lets one
/// Byzantine node spam suspicions and stall the system forever (a liveness attack). Here a view-change
/// installs only on a `2f+1` quorum of **distinct sources** (via `SybilBft.tally`), so a forger's many
/// claimed ids collapse to one vote and cannot force rotation alone.
///
/// **Honest scope (peel):** logical-tick model (the caller drives `onTick`); single-shot agreement per view
/// (composes `SybilBftProtocol`, not multi-slot). `resonantPeriod` is a standard signal-processing estimator,
/// not a novel transform — its role here is the *efficient generator-finder*, and it inherits the
/// detection/length limits of any finite-sample autocorrelation. Inherits `AntiSybil`'s exact-replay
/// soundness. Reference model; the gated transport (081KT2T2J0008QG0R002R72323) and wall-clock binding live in the adapter.
module SybilBftLiveness =

    open SybilBft

    /// A logical tick (DST — advanced explicitly by the caller, never read from a wall clock).
    type Tick = int

    /// A per-member identity claim that accrues with persistence over time. `RecentBeats` is the bounded
    /// recent history of heartbeat ticks (for resonance + jitter).
    type IdentityClaim =
        { FirstTick: Tick
          LastTick: Tick
          Beats: int
          RecentBeats: Tick list }

    /// How many recent beats to retain for resonance/jitter analysis.
    [<Literal>]
    let HistoryLen = 32

    let private intervalsOf (beats: Tick list) : int list =
        match List.sort beats with
        | [] | [ _ ] -> []
        | sorted -> List.pairwise sorted |> List.map (fun (a, b) -> b - a)

    let private variance (xs: float list) : float =
        match xs with
        | [] | [ _ ] -> 0.0
        | _ ->
            let n = float (List.length xs)
            let mean = List.sum xs / n
            (xs |> List.sumBy (fun x -> (x - mean) * (x - mean))) / n

    /// Claim strength: grows with **persistence** (sustained beats) and is dampened by **jitter** (interval
    /// variance). A long, regular history ⇒ strong claim; a short or erratic one ⇒ weak. (Aaron: "persistence
    /// over time increases the identity claim.")
    let claimStrength (c: IdentityClaim) : float =
        let jitter = c.RecentBeats |> intervalsOf |> List.map float |> variance
        float c.Beats / (1.0 + jitter)

    /// Record a heartbeat at `tick` into an (optional) existing claim.
    let private beat (existing: IdentityClaim option) (tick: Tick) : IdentityClaim =
        match existing with
        | None ->
            { FirstTick = tick
              LastTick = tick
              Beats = 1
              RecentBeats = [ tick ] }
        | Some c ->
            { c with
                LastTick = max c.LastTick tick
                Beats = c.Beats + 1
                RecentBeats = (tick :: c.RecentBeats) |> List.truncate HistoryLen }

    /// **Resonant period** of a beat train via autocorrelation peak — the efficient way to find the clock
    /// generator's period (Aaron: "harmonic oscillation / resonance frequency is how you find the clock
    /// generator efficiently"). Reconstruct a 0/1 train over `[min..max]` beat ticks and return the positive
    /// lag in `[1..maxLag]` maximizing self-overlap. `None` if fewer than two beats. A regular clock peaks
    /// sharply at its period; an irregular/forged train does not.
    let resonantPeriod (beats: Tick list) : Tick option =
        match List.sort (List.distinct beats) with
        | [] | [ _ ] -> None
        | sorted ->
            let lo = List.head sorted
            let span = List.last sorted - lo
            if span < 1 then
                None
            else
                let present = sorted |> List.map (fun t -> t - lo) |> Set.ofList
                let maxLag = span
                let score lag =
                    present |> Set.fold (fun acc t -> if present.Contains(t + lag) then acc + 1 else acc) 0
                let best =
                    [ 1..maxLag ]
                    |> List.maxBy (fun lag -> (score lag, -lag)) // ties → smallest period (fundamental, not harmonic)
                Some best

    /// A liveness-layer message (composes the safety-layer `SybilBftProtocol.Message`).
    type LiveMessage<'v when 'v: comparison> =
        | Safety of SybilBftProtocol.Message<'v>
        | Heartbeat of leaderClaim: int * stream: int list * tick: Tick
        | ViewChangeVote of newView: int * voter: int * stream: int list

    /// The liveness view, wrapping the safety-layer `View`.
    type LiveView<'v when 'v: comparison> =
        { Safety: SybilBftProtocol.View<'v>
          ViewNum: int
          Now: Tick
          Timeout: Tick
          LastLeaderBeat: Tick
          Claims: Map<int, IdentityClaim>
          /// Accumulated view-change votes: keyed by claimed voter id → the new view it voted for + its
          /// drift stream (so the install quorum is counted over *distinct sources*).
          ViewChangeVotes: Map<int, int * int list> }

    /// The current leader's claimed id = `ViewNum mod Members` (round-robin rotation).
    let leader (lv: LiveView<'v>) : int =
        if lv.Safety.Members <= 0 then 0 else lv.ViewNum % lv.Safety.Members

    /// A fresh liveness view at view 0, logical time 0, with the given suspicion `timeout`.
    let init (members: int) (threshold: float) (timeout: Tick) : LiveView<'v> =
        { Safety = SybilBftProtocol.init members threshold
          ViewNum = 0
          Now = 0
          Timeout = timeout
          LastLeaderBeat = 0
          Claims = Map.empty
          ViewChangeVotes = Map.empty }

    /// Record a heartbeat: accrue the sender's identity claim, and if it is the current leader, reset the
    /// suspicion timer.
    let onHeartbeat (lv: LiveView<'v>) (claimed: int) (stream: int list) (tick: Tick) : LiveView<'v> =
        let claims = Map.add claimed (beat (Map.tryFind claimed lv.Claims) tick) lv.Claims
        let lastLeaderBeat = if claimed = leader lv then max lv.LastLeaderBeat tick else lv.LastLeaderBeat
        { lv with
            Claims = claims
            Now = max lv.Now tick
            LastLeaderBeat = lastLeaderBeat }

    /// Advance the logical clock to `tick`. If the leader has been silent for longer than `Timeout`, emit a
    /// `ViewChangeVote` for the next view (suspicion). Deterministic — no wall clock.
    let onTick (lv: LiveView<'v>) (tick: Tick) (selfClaim: int) (selfStream: int list) : LiveView<'v> * LiveMessage<'v> list =
        let lv = { lv with Now = max lv.Now tick }
        if lv.Now - lv.LastLeaderBeat > lv.Timeout then
            lv, [ ViewChangeVote(lv.ViewNum + 1, selfClaim, selfStream) ]
        else
            lv, []

    /// Fold a `ViewChangeVote` into the view. A new view installs only when `2f+1` **distinct sources** have
    /// voted for it (Sybil-resistant view-change). On install: bump `ViewNum`, reset the suspicion timer, and
    /// clear the accumulated votes.
    let onViewChangeVote (lv: LiveView<'v>) (newView: int) (voter: int) (stream: int list) : LiveView<'v> =
        let votes = Map.add voter (newView, stream) lv.ViewChangeVotes
        // Count only votes for this candidate view, over distinct sources.
        let forThis =
            votes
            |> Map.toList
            |> List.choose (fun (claimed, (v, s)) ->
                if v = newView then Some { Claimed = claimed; Stream = s; Value = newView } else None)
        let t = tally lv.Safety.Threshold forThis
        let q = SybilBftProtocol.quorum lv.Safety
        let installed =
            t.VotesByValue |> Map.tryFind newView |> Option.defaultValue 0 >= q
        if installed && newView > lv.ViewNum then
            { lv with
                ViewNum = newView
                LastLeaderBeat = lv.Now // give the new leader a fresh window
                ViewChangeVotes = Map.empty }
        else
            { lv with ViewChangeVotes = votes }

    /// Route a liveness message. Safety messages defer to `SybilBftProtocol.receive` (and any safety outbound
    /// is re-wrapped); heartbeats and view-change votes are handled here.
    let receive (lv: LiveView<'v>) (m: LiveMessage<'v>) : LiveView<'v> * LiveMessage<'v> list =
        match m with
        | Safety sm ->
            let sv, out = SybilBftProtocol.receive lv.Safety sm
            { lv with Safety = sv }, (out |> List.map Safety)
        | Heartbeat(claimed, stream, tick) -> onHeartbeat lv claimed stream tick, []
        | ViewChangeVote(newView, voter, stream) -> onViewChangeVote lv newView voter stream, []

    /// The committed value of the underlying safety view, if any.
    let committed (lv: LiveView<'v>) : 'v option = SybilBftProtocol.committed lv.Safety
