namespace Zeta.Core

/// A transport-agnostic reference reducer over `SybilBft`'s correlation-component votes.
/// Supplied bit streams travel with votes so the receiver can compute the observation.
/// They do not authenticate identities, enforce membership, or establish physical-source
/// distinctness: one shared generator with balanced recodings can reach its quorum.
/// A deployment needs a separately justified admission, membership, and fault model.
///
/// **Scale-free / beautiful-on-1 (manifesto §1, §7):** the reducer is pure and deterministic — at DoP=1 a
/// single cooperative loop folds messages in a replayable order (DST); at DoP=N the real transport fans the
/// `outbound` messages out. Same code path. **Idempotent (#6):** a reached `Committed` decision is final;
/// re-delivering any message cannot change or unset it (safe redelivery / partial replay).
///
/// **Transport is OUT of scope here (gated).** The concrete transport is Aaron's `MultiplexedWebSockets`
/// (ASP.NET `System.Threading.Channels` + `System.IO.Pipelines`, Fowler-reviewed — 115k msg/s vs HttpClient
/// 7k/s), tracked by **081KT2T2J0008QG0R002R72323 / 081KQZVQW0008QG0R001CQPQ0E**. For *strangers over the wire* it requires on-wire key exchange +
/// authenticated encryption and must NOT deploy before Zeta's encryption-floor + an Aminata/Soraya
/// threat-model of the negotiation handshake. This module owns the protocol *logic* only, and it
/// does so **without a port to sit behind**: an earlier version of this paragraph said the logic
/// lived behind an `IBftTransport` port (hexagonal — `bcl-interface-boundary`) and that the mux-WS
/// adapter plugs in there. **`IBftTransport` has never existed** — no such type is declared anywhere
/// in the repo, and the phrasing described an intended design as though it were a shipped one
/// (corrected 2026-08-16). Nothing is broken by its absence, because the reducer needs no transport
/// abstraction: `receive` *returns* the outbound messages and never sends them, so the port is a
/// thing an adapter would introduce, not a thing this module depends on. Declaring it is part of the
/// gated transport work above.
///
/// **Fan-out via the ferry, not `Task.Run` (Aaron 2026-06-08; `async-all-the-way-truthful-signatures`).**
/// The adapter drains inbound and fans `outbound` through `FerryThrottler` (a bounded queue + DoP-knobbed
/// ferries) — `ActionBlock`, `SemaphoreSlim`, **and an F# `MailboxProcessor`** (cf. `MailboxRuntime.fs`) are
/// interchangeable backends behind that port; the per-node mailbox *is* the agent's serialized inbox. **DoP=1**
/// degrades to a single cooperative loop = exactly `receiveAll` below (deterministic, DST-replayable);
/// **DoP=N** drains the same queue in production. Same code path, no special case — never a raw `Task.Run`.
///
/// **CPU algebra and GPU-for-DST (Aaron 2026-06-08).** The reducer is *pure data* — no sockets, no `Task`,
/// no allocation-heavy I/O — so it runs as a **CPU algebra** in production *and* on the **GPU for the DST
/// version**: thousands of simulated consensus instances folded in parallel, with **cross-warp shuffle** as
/// the on-device message-exchange analog of the networked fan-out (a warp can't open a WebSocket). The
/// networked mux-WS transport is CPU-only; the *protocol algebra* below is the portable, device-agnostic
/// part. Keep this module free of anything a shader can't run (it currently is: maps + folds over plain
/// values).
///
/// Scope: one sticky local decision and a fixed configured quorum. `SybilBftLiveness`
/// supplies a separate logical-tick/view-change model. Neither model proves agreement
/// for arbitrary supplied streams or authenticates controller distinctness.
module SybilBftProtocol =

    open SybilBft

    /// Proposals and ballots carry the claimed id, supplied stream, and value so a receiver
    /// can recompute correlation components. These fields provide no authentication by themselves.
    type Message<'v when 'v: comparison> =
        | Proposal of Vote<'v> // a proposer puts a value forward (and thereby votes for it)
        | Ballot of Vote<'v> // a replica votes for a value
        | Decision of 'v // a node announces the value it committed (informational; receivers trust their own tally)

    /// The agreement outcome of a local view.
    type Outcome<'v when 'v: comparison> =
        | Pending
        | Committed of 'v

    /// A participant's local view: the **expected distinct membership** `Members` (the configured number of
    /// *distinct* participants — fixes `f` and the quorum, so an early sub-population cannot decide), every
    /// vote it has heard (keyed by claimed id; a node updating its vote is last-write-wins per claim —
    /// conflicting values within a correlation component are excluded by `SybilBft.tally`), the threshold, and
    /// its outcome.
    ///
    /// `Members` fixes quorum arithmetic instead of deriving it from arrived components:
    /// otherwise one early component would produce quorum one. This supplied count does
    /// not enforce an admitted roster or bound how many claims one controller submits.
    type View<'v when 'v: comparison> =
        { Members: int
          Threshold: float
          Heard: Map<int, Vote<'v>>
          Outcome: Outcome<'v> }

    /// Empty view with configured membership count and a correlation-graph threshold.
    /// Quorum is fixed at `2f+1`, `f = maxFaults members`; controller distinctness is not checked.
    let init (members: int) (threshold: float) : View<'v> =
        { Members = members
          Threshold = threshold
          Heard = Map.empty
          Outcome = Pending }

    /// The fixed Byzantine quorum for this view's membership: `2f+1`, `f = ⌊(Members-1)/3⌋`.
    let quorum (v: View<'v>) : int = quorumSize (maxFaults v.Members)

    /// Build this node's own proposal / ballot (constructors — the node feeds these to the transport).
    let propose (claimed: int) (stream: int list) (value: 'v) : Message<'v> =
        Proposal { Claimed = claimed; Stream = stream; Value = value }

    let ballot (claimed: int) (stream: int list) (value: 'v) : Message<'v> =
        Ballot { Claimed = claimed; Stream = stream; Value = value }

    /// Recompute the outcome from the heard votes. A `Committed` decision is final (idempotent, #6): once
    /// reached it never changes — re-tallying or new votes cannot unset or alter it (safe replay/redelivery).
    let private recompute (v: View<'v>) : View<'v> =
        match v.Outcome with
        | Committed _ -> v
        | Pending ->
            let t = tally v.Threshold (v.Heard |> Map.toList |> List.map snd)
            // Use the configured quorum so one early component does not set quorum one.
            let q = quorum v
            match t.VotesByValue |> Map.toList |> List.tryFind (fun (_, n) -> n >= q) with
            | Some (value, _) -> { v with Outcome = Committed value }
            | None -> v

    /// Fold a received message into the local view, returning the new view and any messages to broadcast.
    /// Deterministic for an ordered input trace. Claim updates are last-write-wins and a prior
    /// commitment remains final, so order independence is not a general contract. On the
    /// Pending-to-Committed transition the node announces its `Decision` once.
    let receive (v: View<'v>) (m: Message<'v>) : View<'v> * Message<'v> list =
        match m with
        | Decision _ -> v, [] // informational — our own quorum tally is the source of truth
        | Proposal vote
        | Ballot vote ->
            let v' = recompute { v with Heard = Map.add vote.Claimed vote v.Heard }
            let announce =
                match v.Outcome, v'.Outcome with
                | Pending, Committed value -> [ Decision value ]
                | _ -> []
            v', announce

    /// Fold a whole inbox into a view (the DoP=1 cooperative-loop form). Returns the final view and all
    /// outbound messages produced, in order.
    let receiveAll (v0: View<'v>) (inbox: Message<'v> list) : View<'v> * Message<'v> list =
        let mutable v = v0
        let out = ResizeArray<Message<'v>>()
        for m in inbox do
            let v', o = receive v m
            v <- v'
            out.AddRange o
        v, List.ofSeq out

    /// The committed value of a view, if any.
    let committed (v: View<'v>) : 'v option =
        match v.Outcome with
        | Committed value -> Some value
        | Pending -> None
