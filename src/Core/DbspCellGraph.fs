namespace Zeta.Core

// ═══════════════════════════════════════════════════════════════════
//  DbspCellGraph — a DBSP incremental dataflow as a cell society, the
//  first consumer of the CellScheduler (081KTG5S0M9). Each operator is
//  a cell; Z-set DELTAS are the messages ("a cell's inbox is a ZSetW").
//
//  Operators span the DBSP tiers:
//    • LINEAR      — Filter, Rekey, Relay (commute with the delta);
//    • non-linear  — Distinct (the `H` op; per-cell integrated INPUT);
//    • BILINEAR    — Join (equi-join; needs BOTH inputs' integrals, so
//                    messages carry a PORT and edges tag which port they
//                    feed — the incremental form joins each side's delta
//                    against the OTHER side's current integral).
//    • sink        — Integrate (running `I`, lives in `Acc`).
//
//  Load-bearing law: streaming deltas (inserts AND retractions) through
//  the graph yields the same integrated sink state as a batch recompute
//  — DBSP incremental ≡ recompute, across the scheduler — and it is
//  DoP-invariant (run(1) == run(N)), even for the stateful/bilinear ops.
// ═══════════════════════════════════════════════════════════════════

/// Which input a delta arrives on. `Mono` for single-input operators;
/// `Left`/`Right` distinguish the two inputs of a bilinear `Join`.
type DbspPort =
    | Mono
    | Left
    | Right

/// A DBSP operator a cell can embody (data, no closures — inspectable).
/// `RequireQualifiedAccess` so case names don't collide with the circuit
/// operator types in `Operators.fs` (`Filter`, `Integrate`, `Join`, …).
[<RequireQualifiedAccess>]
type DbspOp =
    /// Keep entries whose key has the given parity (0 = even, 1 = odd). Linear.
    | Filter of parity: int
    /// Rewrite each key by an integer factor (weight-preserving ⇒ linear).
    | Rekey of factor: int64
    /// Pass the delta through unchanged (a source/relay node). Linear.
    | Relay
    /// A sink: emit nothing; the running integral lives in the cell's `Acc`.
    | Integrate
    /// NON-LINEAR set-semantics distinct (the DBSP `H`); per-cell integrated input.
    | Distinct
    /// BILINEAR equi-join on the key: matched keys, weights multiply. Two inputs
    /// (Left/Right ports); each side's delta joins the other side's integral.
    | Join

[<RequireQualifiedAccess>]
module DbspCellGraph =

    /// The scheduler message: a delta arriving on a port.
    type Msg = { Port: DbspPort; Delta: ZSet<int64> }

    /// Message constructors for the three ports.
    let mono (d: ZSet<int64>) : Msg = { Port = Mono; Delta = d }
    let left (d: ZSet<int64>) : Msg = { Port = Left; Delta = d }
    let right (d: ZSet<int64>) : Msg = { Port = Right; Delta = d }

    /// A cell: its operator, downstream edges (each tagged with the port it
    /// feeds), integrated output (`Acc` = DBSP `I`), and up to two integrated
    /// INPUTS — `IntA` (the only/left input, used by Distinct and Join-left),
    /// `IntB` (Join's right input). Unused integrals stay empty.
    type Cell =
        { Op: DbspOp
          Down: (CellId * DbspPort) list
          Acc: ZSet<int64>
          IntA: ZSet<int64>
          IntB: ZSet<int64> }

    /// Equi-join on the key: keys present in BOTH, weights multiplied (bilinear;
    /// `Checked` so a weight overflow can't silently lie about the join result).
    let joinKeys (a: ZSet<int64>) (b: ZSet<int64>) : ZSet<int64> =
        ZSet.ofSeq [ for e in a do
                       let bw = b.[e.Key]
                       if bw <> 0L then yield e.Key, Checked.(*) e.Weight bw ]

    /// The LINEAR operator's action on an incoming delta — distributes over
    /// Z-set addition, so applying to the delta IS the incremental form.
    /// (Distinct and Join are stateful/bilinear and handled in `step`.)
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
        | DbspOp.Join -> delta       // unused; step handles Join with state

    /// The cell step. Pure — reads only (this cell, one ported delta), returns
    /// (new cell, emitted messages) — the noninterference the scheduler's
    /// DoP-invariance depends on (§13). Distinct/Join carry state in IntA/IntB
    /// but remain a pure function of (cell, msg), so DoP-invariance holds.
    let step (cell: Cell) (msg: Msg) : Cell * (CellId * Msg) list =
        let outDelta, cell' =
            match cell.Op with
            | DbspOp.Distinct ->
                let o = ZSet.distinctIncremental cell.IntA msg.Delta
                o, { cell with IntA = cell.IntA + msg.Delta }
            | DbspOp.Join ->
                match msg.Port with
                | Right ->
                    // a right delta joins the current LEFT integral
                    joinKeys cell.IntA msg.Delta, { cell with IntB = cell.IntB + msg.Delta }
                | Mono
                | Left ->
                    // a left (or mono) delta joins the current RIGHT integral
                    joinKeys msg.Delta cell.IntB, { cell with IntA = cell.IntA + msg.Delta }
            | op -> applyOp op msg.Delta, cell
        { cell' with Acc = cell'.Acc + outDelta },
        [ for (t, port) in cell.Down -> t, { Port = port; Delta = outDelta } ]

    let private freshCell op down : Cell =
        { Op = op; Down = down; Acc = ZSet<int64>.Empty; IntA = ZSet<int64>.Empty; IntB = ZSet<int64>.Empty }

    /// Build the initial scheduler state from a node list (id → op × downstream
    /// edges), every cell starting with empty integrals and no pending input.
    let init (nodes: (CellId * DbspOp * (CellId * DbspPort) list) list) : CellScheduler.State<Cell, Msg> =
        CellScheduler.init [ for (id, op, down) in nodes -> id, freshCell op down ] []

    /// Build the graph and inject a batch of input messages (`target × msg`) as
    /// the initial ready workload the scheduler drains.
    let seed
        (nodes: (CellId * DbspOp * (CellId * DbspPort) list) list)
        (inputs: (CellId * Msg) list)
        : CellScheduler.State<Cell, Msg> =
        CellScheduler.init [ for (id, op, down) in nodes -> id, freshCell op down ] inputs

    /// The integrated output of a named cell after a run (the DBSP `I` view).
    let accOf (id: CellId) (final: Map<CellId, Cell>) : ZSet<int64> =
        match Map.tryFind id final with
        | Some c -> c.Acc
        | None -> ZSet<int64>.Empty
