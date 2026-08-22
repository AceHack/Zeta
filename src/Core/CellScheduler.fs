namespace Zeta.Core

// ═══════════════════════════════════════════════════════════════════
//  CellScheduler — slice 1 of 081KTG5S0M9: the DoP=1 deterministic
//  MULTIPLEXER. Thousands of cells step on one cooperative loop, in a
//  deterministic FIFO order, communicating only through inboxes (the
//  declared channel — noninterference §13). No wall-clock, no randomness,
//  no shared mutable state ⇒ same (cells, messages) replays identically
//  (DST; the FoundationDB run-loop at the cell layer).
//
//  Design: docs/research/2026-07-02-cell-scheduler-…-dop1-to-dopn.md.
//  Generic over the cell STEP so the multiplexer is separable from the
//  cell's work: `step : 'St -> 'Msg -> 'St * (CellId * 'Msg) list`
//  (new state + emitted messages). The YinYang wiring (`'St = DynamicValue`
//  via DurableYinYang.evolve) is one instantiation — see `yinYangStep`.
//  Slice 2 (`runFerryToQuiescence`) feeds the per-round ready-set through a
//  FerryThrottler at DoP=N, reassembling results in deterministic cell-id
//  order before merge — so `run(DoP=1) == run(DoP=N)` holds by construction
//  (the scale-free law, tested at DoP 1/4/16). Slice 1's sequential runner is
//  the deterministic reference it matches on commutative workloads.
// ═══════════════════════════════════════════════════════════════════

/// A cell's routing identity.
type CellId = string

[<RequireQualifiedAccess>]
module CellScheduler =

    /// Immutable scheduler state: per-cell state, per-cell FIFO inbox, and
    /// the FIFO ready queue (cell-ids with pending messages, no duplicates).
    type State<'St, 'Msg> =
        { Cells: Map<CellId, 'St>
          Inbox: Map<CellId, 'Msg list>   // head = next to process (FIFO)
          Ready: CellId list }             // head = next to run (FIFO); distinct

    let private inboxOf id (s: State<'St, 'Msg>) =
        match Map.tryFind id s.Inbox with Some q -> q | None -> []

    /// Enqueue a message to a cell's inbox (FIFO append) and mark it ready
    /// (if not already), preserving FIFO ready order. Messages to unknown
    /// cells are dropped — a cell must exist to receive (surfaced by the
    /// caller creating cells first; slice 1 keeps the topology fixed).
    let private deliver (target: CellId) (msg: 'Msg) (s: State<'St, 'Msg>) : State<'St, 'Msg> =
        if not (Map.containsKey target s.Cells) then s
        else
            let q = inboxOf target s
            let ready = if List.contains target s.Ready then s.Ready else s.Ready @ [ target ]
            { s with Inbox = Map.add target (q @ [ msg ]) s.Inbox; Ready = ready }

    /// Build the initial state from cells and an initial message batch.
    let init (cells: (CellId * 'St) list) (initialMsgs: (CellId * 'Msg) list) : State<'St, 'Msg> =
        let s0 = { Cells = Map.ofList cells; Inbox = Map.empty; Ready = [] }
        initialMsgs |> List.fold (fun s (t, m) -> deliver t m s) s0

    /// One deterministic step: run the head ready cell on its next inbox
    /// message, route emitted messages, re-park or re-ready the cell.
    /// `None` when quiescent (no ready cells).
    let step (stepFn: 'St -> 'Msg -> 'St * (CellId * 'Msg) list) (s: State<'St, 'Msg>) : State<'St, 'Msg> option =
        match s.Ready with
        | [] -> None
        | id :: restReady ->
            match inboxOf id s with
            | [] -> Some { s with Ready = restReady }   // spurious ready; drop (defensive)
            | msg :: restInbox ->
                let st = Map.find id s.Cells
                let st', emitted = stepFn st msg
                // consume the message; update state; the cell leaves Ready for now
                let s1 =
                    { s with
                        Cells = Map.add id st' s.Cells
                        Inbox = Map.add id restInbox s.Inbox
                        Ready = restReady }
                // route emitted messages (deterministic: emission order)
                let s2 = emitted |> List.fold (fun acc (t, m) -> deliver t m acc) s1
                // If this cell still has queued input, re-ready it at the Ready TAIL
                // (fairness). Re-ready via `Ready` ONLY — must NOT disturb the inbox,
                // or the cell's own FIFO order is broken (an earlier bug round-tripped
                // the head through `deliver`, rotating head→tail). `deliver` during
                // emission may already have re-added `id` (a self-send), so guard.
                let s3 =
                    if List.isEmpty (inboxOf id s2) || List.contains id s2.Ready then s2
                    else { s2 with Ready = s2.Ready @ [ id ] }
                Some s3

    /// Run to quiescence (no ready cells) or until `maxSteps` (a runaway /
    /// non-termination backstop, NOT a silent cap — `Error` names it).
    /// Returns final per-cell state.
    let runToQuiescence
        (maxSteps: int)
        (stepFn: 'St -> 'Msg -> 'St * (CellId * 'Msg) list)
        (s0: State<'St, 'Msg>)
        : Result<Map<CellId, 'St>, string> =
        let rec loop n s =
            if n > maxSteps then
                Error(sprintf "cell scheduler did not quiesce in %d steps (non-terminating message cycle?)" maxSteps)
            else
                match step stepFn s with
                | None -> Ok s.Cells
                | Some s' -> loop (n + 1) s'
        loop 0 s0

    // ═══════════════════════════════════════════════════════════════
    //  Slice 2 — DoP=N via FerryThrottler, and the run(1)==run(N) law.
    //
    //  A ROUND-BASED runner: each round steps EVERY currently-ready cell
    //  once (on its head message), fanning the pure `stepFn` computations
    //  through a `FerryThrottler` at the chosen DoP. The ferry executes
    //  steps concurrently, but the results are REASSEMBLED in deterministic
    //  cell-id order BEFORE any state merge — so the merge (and therefore
    //  the whole run) is independent of DoP and of ferry completion order.
    //  `run(DoP=1) == run(DoP=N)` holds by construction (concurrency lives
    //  only in the pure step's *execution*; the *ordering* that state depends
    //  on is restored deterministically). The knob changes throughput, never
    //  the answer — the scale-free claim as an executable law (§1).
    //
    //  Noninterference (§13) is what makes the ferry safe: `stepFn` reads
    //  only (its own state, one message) and returns (new state, emitted) —
    //  no ambient clock, no shared mutable state — so two cells on two
    //  ferries cannot observe each other mid-step.
    // ═══════════════════════════════════════════════════════════════

    /// Recompute the ready set deterministically: cell-ids with a non-empty
    /// inbox, in sorted (Ordinal) order — the canonical round order.
    let private readyOf (s: State<'St, 'Msg>) : CellId list =
        s.Inbox
        |> Map.toList
        |> List.choose (fun (id, q) -> if List.isEmpty q then None else Some id)
        |> List.sortWith (fun a b -> System.String.CompareOrdinal(a, b))

    // ── Slice 3: fairness + parking observability ──
    //
    // Fairness is STRUCTURAL, not a tuning knob: `runFerryToQuiescence` steps
    // every ready cell exactly once per round (perfect round-robin), so no cell
    // can starve another regardless of how much work it generates. Parking is
    // FREE: an idle cell (empty inbox) is simply absent from the ready set and
    // costs nothing until a message wakes it — the idle-counter externalised into
    // the inbox structure, never a spinning loop.
    //
    // The BEAM-style per-step *reduction budget* is DELIBERATELY OMITTED (scope
    // honesty §6): its job is to stop one cell monopolising a ferry when a single
    // step does unbounded work — but here every step is bounded to exactly ONE
    // message, so a budget knob would be unearned weight (only-the-irreducible-is-
    // primitive; interfaces-free-classes-earned). If a future step variant folds
    // many messages per turn, THAT is when the budget is earned — not before.

    /// The cells ready to step (non-empty inbox), in canonical round order.
    /// The externalised active-set — its length is the round's fan-out width.
    let activeCells (s: State<'St, 'Msg>) : CellId list = readyOf s

    /// The parked cells (empty inbox), sorted (Ordinal). Parked cells cost
    /// nothing; they re-enter the active set only when a message is delivered.
    let parkedCells (s: State<'St, 'Msg>) : CellId list =
        s.Cells
        |> Map.toList
        |> List.choose (fun (id, _) ->
            match Map.tryFind id s.Inbox with
            | Some(_ :: _) -> None
            | _ -> Some id)
        |> List.sortWith (fun a b -> System.String.CompareOrdinal(a, b))

    /// Run to quiescence with a `FerryThrottler` at `config.MaxDegreeOfParallelism`
    /// ferries. Round-based; result is byte-identical across DoP (the scale-free
    /// law). `maxRounds` is the named non-termination backstop (not a silent cap).
    let runFerryToQuiescence
        (config: FerryThrottlerConfig)
        (stepFn: 'St -> 'Msg -> 'St * (CellId * 'Msg) list)
        (maxRounds: int)
        (s0: State<'St, 'Msg>)
        : System.Threading.Tasks.Task<Result<Map<CellId, 'St>, string>> =
        // The batch processor applies the pure step to each (state, message).
        let processBatch (mem: System.ReadOnlyMemory<'St * 'Msg>) (_ct: System.Threading.CancellationToken) =
            let src = mem.ToArray()
            let out = Array.map (fun (st, m) -> stepFn st m) src
            System.Threading.Tasks.Task.FromResult out
        task {
            use throttler =
                new FerryThrottler<'St * 'Msg, 'St * (CellId * 'Msg) list>(config, processBatch)
            // `while` + mutable state (a `let rec` inside a task CE is not statically
            // compilable — FS3511); the round semantics are unchanged.
            let mutable s = s0
            let mutable round = 0
            let mutable result : Result<Map<CellId, 'St>, string> option = None
            while result.IsNone do
                if round > maxRounds then
                    result <- Some(Error(sprintf "cell scheduler did not quiesce in %d rounds (non-terminating message cycle?)" maxRounds))
                else
                    match readyOf s with
                    | [] -> result <- Some(Ok s.Cells)
                    | ready ->
                        // Each ready cell processes its head message this round.
                        let work =
                            ready
                            |> List.map (fun id -> id, Map.find id s.Cells, List.head (inboxOf id s))
                        // Fan the pure steps through the ferry (DoP=N), holding the
                        // result tasks IN ORDER so completion order is irrelevant.
                        let! results =
                            work
                            |> List.map (fun (_, st, m) -> throttler.ProcessAsync((st, m)))
                            |> System.Threading.Tasks.Task.WhenAll
                        let zipped = List.zip work (List.ofArray results)
                        // Phase 1: apply new states + consume the processed head
                        // messages — all keyed by distinct cell-ids, so order-free.
                        let afterConsume =
                            zipped
                            |> List.fold
                                (fun (acc: State<'St, 'Msg>) ((id, _, _), (st', _)) ->
                                    { acc with
                                        Cells = Map.add id st' acc.Cells
                                        Inbox = Map.add id (List.tail (inboxOf id acc)) acc.Inbox })
                                s
                        // Phase 2: route all emitted messages, in deterministic
                        // (processing-cell, then emission) order.
                        let routed =
                            zipped
                            |> List.collect (fun (_, (_, emitted)) -> emitted)
                            |> List.fold (fun acc (t, m) -> deliver t m acc) afterConsume
                        s <- routed
                        round <- round + 1
            return result.Value
        }

    /// The YinYang instantiation: a cell's state is its `Remains`
    /// (`DynamicValue`), stepped by `DurableYinYang.evolve` against a fixed
    /// `Acts`. Emitted messages are read from a reserved `"__outbox__"` key
    /// on the new `Remains` (an Array of `[targetId, msg]` pairs), then
    /// stripped so the outbox never accumulates in state. A cell whose
    /// `Acts` holds (sub-threshold) keeps its `Remains` and emits nothing.
    [<Literal>]
    let OutboxKey = "__outbox__"

    /// Split a cell's new `Remains` into (state-without-outbox, emitted messages).
    /// The outbox convention: a reserved `"__outbox__"` key holding an Array of
    /// `[targetId, msg]` pairs. Malformed entries are dropped (a cell must not
    /// corrupt the society by emitting garbage). Pure — testable without Bonsai.
    let routeOutbox (next: DynamicValue) : DynamicValue * (CellId * DynamicValue) list =
        match next with
        | DynamicValue.Object kvs ->
            let outbox =
                kvs
                |> List.tryPick (fun (k, v) -> if k = OutboxKey then Some v else None)
                |> function
                   | Some(DynamicValue.Array items) ->
                       items |> List.choose (function
                           | DynamicValue.Array [ DynamicValue.String t; m ] -> Some(t, m)
                           | _ -> None)
                   | _ -> []
            let stripped = DynamicValue.Object(kvs |> List.filter (fun (k, _) -> k <> OutboxKey))
            stripped, outbox
        | other -> other, []

    let yinYangStep (acts: Bonsai.Expr) (threshold: float)
        : DynamicValue -> DynamicValue -> DynamicValue * (CellId * DynamicValue) list =
        fun remains input -> routeOutbox (DurableYinYang.evolve acts threshold remains input)

    // ── Slice 4: soft cells — hold the distribution, snap only at the edge ──
    //
    // A soft cell's STATE is a `SoftValue` (a distribution over `DynamicValue`s).
    // It stays soft through scheduling: `evolveSoft` folds inputs WITHOUT
    // collapsing — the cell "holds its wonder" (the maintainer's soft persistence).
    // Collapse happens ONLY at an execution edge:
    //   • EMIT — crossing the channel to another cell is an act, so the message is
    //     snapped to a certain value; but only if the cell is confident enough.
    //     Below threshold the cell REFUSES to collapse (free-will-refuse-collapse):
    //     it holds and emits nothing.
    //   • READ — `snapAll` collapses the society's states for the caller.
    // The internal Remains is never collapsed by scheduling itself — only the
    // things that cross an edge are. This is the soft analogue of the sharp
    // `yinYangStep`, and it composes with the SAME generic scheduler (slices 1–3).

    /// A soft-cell step: fold the soft input through `Acts` (keeping the full
    /// distribution as the new soft Remains), and snap EMISSIONS at `emitThreshold`.
    /// If the evolved distribution is confident enough, its `"__outbox__"` is routed
    /// with each message crossing the channel as a *certain* value (commitment
    /// collapses); below threshold the cell HOLDS and emits nothing. Malformed
    /// `Acts` ⇒ keep the prior soft Remains, emit nothing.
    let softStep (acts: Bonsai.Expr) (emitThreshold: float)
        : SoftValue.SoftValue -> SoftValue.SoftValue -> SoftValue.SoftValue * (CellId * SoftValue.SoftValue) list =
        fun remains input ->
            match DurableYinYang.evolveSoft acts remains input with
            | Ok next ->
                // The internal state stays SOFT; only emission snaps (the edge).
                match SoftValue.resolve emitThreshold next with
                | Some sharp ->
                    let _, emitted = routeOutbox sharp
                    next, emitted |> List.map (fun (t, m) -> t, SoftValue.certain m)
                | None -> next, []   // refuse to collapse: hold, emit nothing
            | Error _ -> remains, []

    /// The society-wide READ-time snap: collapse each cell's soft state at
    /// `threshold`. A cell below threshold resolves to `None` (still held) — the
    /// only legitimate collapse is a confident one (never falsely certain). This is
    /// the execution edge for reading a soft scheduler's whole result.
    let snapAll (threshold: float) (states: Map<CellId, SoftValue.SoftValue>) : Map<CellId, DynamicValue option> =
        states |> Map.map (fun _ sv -> SoftValue.resolve threshold sv)

    // ── Slice 5: recovery — a cell's evolution is durable & git-recoverable ──
    //
    // Recovery is FREE from `DurableSaga` (design note §4): a cell is
    // `DurableSaga.start log (sagaStep stepFn) initial` over any `IDeltaLog<'Msg>`
    // — every processed message is appended to the log and folded into state. A
    // crash discards only the in-memory saga; `DurableSaga.ResumeAsync(log, …)`
    // replays the log in seq order and rebuilds the identical state. No new
    // persistence code.
    //
    // Whole-society recovery = per-cell saga recovery (below) + deterministic
    // replay of the message log (the determinism proven in slices 1–3): the seed +
    // message-log reproduces the whole society (DST at fleet scale). Cell evolution
    // is append-only in v1 — a step is information-gaining, not group-invertible,
    // so there is no retraction compensation (matching the DurableYinYang doctrine);
    // `sagaStep` therefore applies the transition on append and ignores the sign.

    /// Adapt a cell `stepFn` to a `DurableSaga` signed reducer that tracks the
    /// cell's STATE only (emission/routing is the scheduler's concern, replayed
    /// deterministically — not part of a cell's durable state). Append-only: the
    /// message weight is ignored (v1 has no per-cell retraction compensation).
    let sagaStep (stepFn: 'St -> 'Msg -> 'St * (CellId * 'Msg) list) : 'St -> 'Msg -> int64 -> 'St =
        fun st msg _weight -> fst (stepFn st msg)
