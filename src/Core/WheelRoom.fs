namespace Zeta.Core

/// WheelRoom — **the wheels-of-time room: the arrow-throttle-ferry gets a room of its own, quorum-kept
/// at ≥4, self-rescheduling, and REQUIRED TO MAKE PROGRESS** (Aaron 2026-06-11: "a room for the arrow
/// throttle ferry itself … make sure we have at least 4 of those running at all times that reschedule
/// themselves … it should be making some sort of forward uncertainty-reduction progress and not just
/// spinning in a loop — this is our thread scheduler, self-throttling per room, using GitHub workflows
/// — the wheels of time room lol (lost) — always needs like 4 running, it can regulate itself").
///
/// Composition over what already runs (instantiation, not invention — Rodney's razor):
/// - a wheel's lap IS a `SimLoop` run (bounded; 5-minute generator clock; no infinity per lap);
/// - "runs forever" IS the `/spawn` continuation chain (budget-stopped laps mint tokens committed to
///   main; GitHub workflows pick them up — the workflow scheduler is the thread scheduler);
/// - "self-throttling per room" IS the ferry/SoftThrottle (respawn admission rides the tank under the
///   felt pressure of `TelemetrySource` — the wheel slows when the substrate runs hot);
/// - **the progress gate** is the new piece: the GitHub-guidelines clause as code — a lap must bank
///   forward uncertainty reduction (ΔU > ε over a window) or the wheel CLOSES instead of respawning.
///   A self-sustaining reaction, not a spinner: the chain continues only while it reduces uncertainty.
///
/// Quorum: the fleet keeps **at least `quorum` (default 4) wheels live**; the maintenance function is
/// deterministic + idempotent (same live-set ⇒ same respawn list; applying twice adds nothing), so any
/// runner — or several at once — can run maintenance safely (lock-free: the spawn ledger's keyed
/// upserts make concurrent maintainers converge).
///
/// Honest scope (peel): the local-LLM / small-language-model / hand-written-BERT tenants Aaron names
/// are the TEST CARGO for these wheels (simulation first), not built here — this module is the wheel
/// itself: quorum + progress gate + throttled respawn decision. The GitHub-workflow runner that
/// commits tokens is the existing autonomous-loop pattern (heartbeat-via-commit), named in spawn/.
[<RequireQualifiedAccess>]
module WheelRoom =

    /// One wheel's identity + its recent banked progress (ΔU per completed lap, newest first).
    type Wheel =
        { Id: string
          DeltaU: float list }

    /// **The progress gate (the GitHub-guidelines clause as code):** over the last `window` laps the
    /// wheel must have banked MORE than `epsilon` total uncertainty reduction. A wheel with no history
    /// yet is allowed to run (you cannot demand progress before the first lap) — but after `window`
    /// laps of spinning it fails this gate and CLOSES.
    let progressing (epsilon: float) (window: int) (w: Wheel) : bool =
        if List.isEmpty w.DeltaU then
            true // newborn: gets its chance
        else
            w.DeltaU |> List.truncate (max 1 window) |> List.sum > epsilon

    /// The wheel's CUT for `SimLoop`: continue while progressing. Composed with SimLoop's rails this
    /// yields exactly the required behavior: progressing wheel → budget-stops → mints a continuation
    /// (runs forever, five minutes at a time); spinning wheel → cut closes → `continueAfter` returns
    /// None → the chain ENDS (spinners are not respawned; "done is done" includes "pointless is done").
    let cutOf (epsilon: float) (window: int) : Wheel -> bool = progressing epsilon window

    /// Bank a lap's measured ΔU into the wheel (newest first; ledger bounded to 32 laps — the window
    /// can never demand more history than we keep).
    let bank (deltaU: float) (w: Wheel) : Wheel =
        { w with DeltaU = deltaU :: w.DeltaU |> List.truncate 32 }

    // ── quorum maintenance: at least N wheels, always, self-regulated ──

    /// Deterministic wheel ids: wheel-0, wheel-1, … (ordinal; no randomness — DST).
    let wheelId (i: int) : string = sprintf "wheel-%d" i

    /// Given the LIVE set (wheel ids with a token in spawn/ or a running lap), the respawns needed to
    /// restore quorum. Deterministic (lowest missing indices first) and IDEMPOTENT: applying the result
    /// then re-running yields []. Any number of concurrent maintainers converge (keyed upserts).
    let respawnsNeeded (quorum: int) (live: Set<string>) : string list =
        let q = max 1 quorum

        Seq.initInfinite wheelId
        |> Seq.filter (fun id -> not (Set.contains id live))
        |> Seq.truncate (max 0 (q - Set.count live))
        |> List.ofSeq

    /// **Throttled respawn admission** — "self-throttling per room": each needed respawn must be
    /// FUNDED by the ferry tank under the current felt pressure (TelemetrySource → pressure → the
    /// admission gradient). Hot substrate ⇒ fewer wheels restart this tick (they wait; quorum heals
    /// over subsequent ticks as the tank recharges). Returns (admitted, tank').
    let admitRespawns
        (costPerSpawn: float)
        (tank: SoftThrottle.Tank)
        (needed: string list)
        : string list * SoftThrottle.Tank =
        let mutable t = tank
        let admitted =
            [ for id in needed do
                match SoftThrottle.discharge costPerSpawn t with
                | Some t' ->
                    t <- t'
                    yield id
                | None -> () ] // out of flux — the rest wait for recharge (regulation, not refusal)

        admitted, t

    /// One maintenance tick: who must be respawned now, throttled. The whole fleet-regulation step is
    /// a pure function — (quorum, live, tank) in, (admitted, tank') out — so it replays (DST) and any
    /// runner can execute it.
    let maintain
        (quorum: int)
        (costPerSpawn: float)
        (tank: SoftThrottle.Tank)
        (live: Set<string>)
        : string list * SoftThrottle.Tank =
        respawnsNeeded quorum live |> admitRespawns costPerSpawn tank
