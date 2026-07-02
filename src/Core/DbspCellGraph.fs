namespace Zeta.Core

// ═══════════════════════════════════════════════════════════════════
//  DbspCellGraph — the FIRST real consumer of the CellScheduler
//  (081KTG5S0M9). A DBSP incremental dataflow modelled as a cell
//  society: each operator is a cell, and Z-set DELTAS are the messages.
//
//  This is the design note's thesis made concrete —
//  "messages are Z-set deltas; a cell's inbox is a ZSetW" — connecting
//  the scheduler back to the base atom (`ZSet`). It exists to:
//    1. prove the scheduler end-to-end on a real workload;
//    2. give the deferred perf pass (§6a) an actual load to measure
//       instead of a guessed hot path;
//    3. be the anchor consumer that ungates the oracle/Roslyn mirrors.
//
//  The load-bearing law it demonstrates: streaming a sequence of input
//  deltas (insertions AND retractions) through the cell graph yields the
//  same integrated sink state as a single batch recompute — DBSP's
//  incremental ≡ recompute, now ACROSS the scheduler — and it is
//  DoP-invariant (run(1) == run(N)).
// ═══════════════════════════════════════════════════════════════════

/// A DBSP operator a cell can embody. Kept as data (no embedded closures)
/// so a cell is inspectable and the topology is plain values. Linear ops
/// (`Filter`, `Rekey`) commute with the delta — incremental = apply-to-delta;
/// `Integrate` is the `I` operator (running sum) used by a sink.
/// `RequireQualifiedAccess` so the case names don't collide with the circuit
/// operator types in `Operators.fs` (`Filter`, `Integrate`, …).
[<RequireQualifiedAccess>]
type DbspOp =
    /// Keep entries whose key has the given parity (0 = even, 1 = odd).
    | Filter of parity: int
    /// Rewrite each key by an integer factor (weight-preserving ⇒ linear).
    /// (Named `Rekey`, not `Map`, to avoid shadowing F#'s `Map` collection.)
    | Rekey of factor: int64
    /// Pass the delta through unchanged (a source/relay node).
    | Relay
    /// A sink: emit nothing; the running integral lives in the cell's `Acc`.
    | Integrate
    /// NON-LINEAR: set-semantics `distinct` maintained incrementally (the DBSP
    /// `H` operator). Needs per-cell integrated-INPUT state; emits only the
    /// boundary-crossing (0↔positive) delta. Its presence is what makes this a
    /// real DBSP proof — a stateful, non-linear operator through the scheduler.
    | Distinct

[<RequireQualifiedAccess>]
module DbspCellGraph =

    /// A cell in the dataflow: its operator, downstream targets, integrated
    /// output (`Acc` — the DBSP `I` of everything it emitted), and integrated
    /// INPUT (`InInt` — only used by the stateful `Distinct`; empty otherwise).
    type Cell =
        { Op: DbspOp
          Down: CellId list
          Acc: ZSet<int64>
          InInt: ZSet<int64> }

    /// The LINEAR operator's action on an incoming delta — distributes over
    /// Z-set addition, so applying to the delta IS the incremental form.
    /// (`Distinct` is non-linear and handled in `step`, not here.)
    let applyOp (op: DbspOp) (delta: ZSet<int64>) : ZSet<int64> =
        match op with
        | DbspOp.Filter parity ->
            ZSet.ofSeq [ for e in delta do
                           if (((e.Key % 2L) + 2L) % 2L) = int64 parity then
                               yield e.Key, e.Weight ]
        | DbspOp.Rekey factor -> ZSet.ofSeq [ for e in delta -> e.Key * factor, e.Weight ]
        | DbspOp.Relay -> delta
        | DbspOp.Integrate -> delta
        | DbspOp.Distinct -> delta   // unused; step handles Distinct with state

    /// The cell step: transform the incoming delta, integrate it into `Acc`,
    /// and emit the output delta to every downstream cell. Pure — the
    /// noninterference the scheduler's DoP-invariance depends on (§13): reads
    /// only (this cell, one delta), returns (new cell, emitted deltas).
    /// `Distinct` is non-linear: it reads its integrated input `InInt`, emits
    /// only boundary-crossings via `ZSet.distinctIncremental`, and advances
    /// `InInt += delta` — all still a pure function of (cell, delta).
    let step (cell: Cell) (delta: ZSet<int64>) : Cell * (CellId * ZSet<int64>) list =
        match cell.Op with
        | DbspOp.Distinct ->
            let outDelta = ZSet.distinctIncremental cell.InInt delta
            { cell with Acc = cell.Acc + outDelta; InInt = cell.InInt + delta },
            [ for t in cell.Down -> t, outDelta ]
        | op ->
            let outDelta = applyOp op delta
            { cell with Acc = cell.Acc + outDelta },
            [ for t in cell.Down -> t, outDelta ]

    /// Build the initial scheduler state from a node list (id → op × downstream),
    /// every cell starting with empty integrals.
    let init (nodes: (CellId * DbspOp * CellId list) list) : CellScheduler.State<Cell, ZSet<int64>> =
        CellScheduler.init
            [ for (id, op, down) in nodes ->
                id, { Op = op; Down = down; Acc = ZSet<int64>.Empty; InInt = ZSet<int64>.Empty } ]
            []

    /// Build the graph and inject a batch of input deltas (`target × delta`) as
    /// the initial messages — the ready workload the scheduler drains.
    let seed
        (nodes: (CellId * DbspOp * CellId list) list)
        (inputs: (CellId * ZSet<int64>) list)
        : CellScheduler.State<Cell, ZSet<int64>> =
        CellScheduler.init
            [ for (id, op, down) in nodes ->
                id, { Op = op; Down = down; Acc = ZSet<int64>.Empty; InInt = ZSet<int64>.Empty } ]
            inputs

    /// The integrated output of a named cell after a run (the DBSP `I` view).
    let accOf (id: CellId) (final: Map<CellId, Cell>) : ZSet<int64> =
        match Map.tryFind id final with
        | Some c -> c.Acc
        | None -> ZSet<int64>.Empty
