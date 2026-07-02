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
//  Slice 2 will feed this exact ready-queue to a FerryThrottler for DoP=N
//  and prove `run(1) == run(N)`; slice 1 is the deterministic core it
//  must match.
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
                // if this cell still has queued input, re-ready it at the TAIL (fairness)
                let s3 = if List.isEmpty (inboxOf id s2) then s2 else deliver id (List.head (inboxOf id s2)) { s2 with Inbox = Map.add id (List.tail (inboxOf id s2)) s2.Inbox }
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
