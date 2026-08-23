module Zeta.Tests.FSharp.Algebra.CellSchedulerTests

open Xunit
open Zeta.Core

// A trivial noninterfering step for the multiplexer mechanics: state is an int
// accumulator; a message is (delta, forwards). Applying it adds delta and emits
// one message to each named forward target. This lets us exercise determinism,
// routing, parking, and the runaway backstop WITHOUT Bonsai-expr construction —
// the generic multiplexer is exactly what slice 1 delivers.
type Msg = { Delta: int; Fwd: (CellId * Msg) list }

let private trivialStep (acc: int) (m: Msg) : int * (CellId * Msg) list =
    acc + m.Delta, m.Fwd

let private leaf d : Msg = { Delta = d; Fwd = [] }

[<Fact>]
let ``multiplexer sums per-cell inputs to quiescence`` () =
    let cells = [ "a", 0; "b", 0 ]
    let msgs = [ "a", leaf 1; "a", leaf 2; "b", leaf 10 ]
    match CellScheduler.runToQuiescence 1000 trivialStep (CellScheduler.init cells msgs) with
    | Ok final ->
        Assert.Equal(3, Map.find "a" final)
        Assert.Equal(10, Map.find "b" final)
    | Error e -> failwith e

[<Fact>]
let ``messages route between cells and settle`` () =
    // a receives 5 and forwards 5 to b; b just accumulates.
    let cells = [ "a", 0; "b", 0 ]
    let msgs = [ "a", { Delta = 5; Fwd = [ "b", leaf 5 ] } ]
    match CellScheduler.runToQuiescence 1000 trivialStep (CellScheduler.init cells msgs) with
    | Ok final ->
        Assert.Equal(5, Map.find "a" final)
        Assert.Equal(5, Map.find "b" final)
    | Error e -> failwith e

[<Fact>]
let ``DoP=1 replays identically (determinism)`` () =
    // Fan-out workload: a broadcasts to b and c, which forward to d.
    let cells = [ "a", 0; "b", 0; "c", 0; "d", 0 ]
    let msgs =
        [ "a", { Delta = 1; Fwd = [ "b", { Delta = 2; Fwd = [ "d", leaf 4 ] }
                                    "c", { Delta = 3; Fwd = [ "d", leaf 5 ] } ] } ]
    let run () =
        match CellScheduler.runToQuiescence 1000 trivialStep (CellScheduler.init cells msgs) with
        | Ok f -> f | Error e -> failwith e
    let r1, r2 = run (), run ()
    Assert.Equal<Map<CellId, int>>(r1, r2)             // byte-identical final state
    Assert.Equal(9, Map.find "d" r1)                    // 4 + 5

[<Fact>]
let ``parked cells cost nothing and are untouched`` () =
    // "idle" gets no message ⇒ never ready ⇒ retains its initial state.
    let cells = [ "busy", 0; "idle", 99 ]
    match CellScheduler.runToQuiescence 1000 trivialStep (CellScheduler.init cells [ "busy", leaf 7 ]) with
    | Ok final ->
        Assert.Equal(7, Map.find "busy" final)
        Assert.Equal(99, Map.find "idle" final)         // parked, unchanged
    | Error e -> failwith e

[<Fact>]
let ``messages to unknown cells are dropped, not crash`` () =
    let cells = [ "a", 0 ]
    let msgs = [ "a", { Delta = 1; Fwd = [ "ghost", leaf 100 ] } ]
    match CellScheduler.runToQuiescence 1000 trivialStep (CellScheduler.init cells msgs) with
    | Ok final -> Assert.Equal(1, Map.find "a" final)   // ghost delivery silently dropped
    | Error e -> failwith e

[<Fact>]
let ``non-terminating cycle hits the named backstop`` () =
    // a and b forward to each other forever; the budget must surface an Error,
    // NOT silently cap (scope-honesty: a runaway is named, not hidden). The
    // cycle is driven by the step (which always re-emits) rather than by a
    // self-referential message value (which F# cannot construct).
    let pingPongStep (acc: int) (m: Msg) : int * (CellId * Msg) list =
        let target = if acc % 2 = 0 then "b" else "a"
        acc + 1, [ target, m ]
    let cells = [ "a", 0; "b", 0 ]
    match CellScheduler.runToQuiescence 50 pingPongStep (CellScheduler.init cells [ "a", leaf 1 ]) with
    | Ok _ -> failwith "expected non-termination backstop to fire"
    | Error e -> Assert.Contains("did not quiesce", e)

// ── The YinYang outbox convention (routeOutbox) — pure, no Bonsai needed ──

[<Fact>]
let ``routeOutbox extracts and strips emitted messages`` () =
    let next =
        DynamicValue.Object
            [ "count", DynamicValue.Int 3L
              CellScheduler.OutboxKey,
              DynamicValue.Array
                  [ DynamicValue.Array [ DynamicValue.String "b"; DynamicValue.Int 1L ]
                    DynamicValue.Array [ DynamicValue.String "c"; DynamicValue.Int 2L ] ] ]
    let state, emitted = CellScheduler.routeOutbox next
    // outbox stripped from state
    match state with
    | DynamicValue.Object kvs ->
        Assert.False(kvs |> List.exists (fun (k, _) -> k = CellScheduler.OutboxKey))
        Assert.Equal(DynamicValue.Int 3L, kvs |> List.find (fun (k, _) -> k = "count") |> snd)
    | _ -> failwith "expected object"
    // two well-formed messages recovered, in order
    Assert.Equal(2, List.length emitted)
    Assert.Equal("b", fst emitted.[0])
    Assert.Equal("c", fst emitted.[1])

[<Fact>]
let ``routeOutbox on a non-object emits nothing`` () =
    let state, emitted = CellScheduler.routeOutbox (DynamicValue.Int 42L)
    Assert.Equal(DynamicValue.Int 42L, state)
    Assert.Empty(emitted)

// ── Slice 2: DoP=N via FerryThrottler, and the run(1)==run(N) scale-free law ──

open System.Threading.Tasks

// A larger noninterfering workload: a ring of cells, each seeded with a delta and
// a one-hop forward to its neighbour. Order-independent in effect (accumulation),
// so any DoP must reach the same final state.
let private ringWorkload n =
    let cells = [ for i in 0 .. n - 1 -> sprintf "c%02d" i, 0 ]
    let msgs =
        [ for i in 0 .. n - 1 ->
            sprintf "c%02d" i,
            { Delta = i + 1; Fwd = [ sprintf "c%02d" ((i + 1) % n), leaf 1 ] } ]
    cells, msgs

[<Fact>]
let ``run(1) == run(N): DoP-invariance is the scale-free proof`` () : Task =
    task {
        let cells, msgs = ringWorkload 12
        let runAt dop =
            let cfg = FerryThrottlerConfig.withFerries dop
            CellScheduler.runFerryToQuiescence cfg trivialStep 100_000 (CellScheduler.init cells msgs)
        let! r1 = runAt 1
        let! r4 = runAt 4
        let! r16 = runAt 16
        match r1, r4, r16 with
        | Ok a, Ok b, Ok c ->
            Assert.Equal<Map<CellId, int>>(a, b)         // DoP=1 == DoP=4
            Assert.Equal<Map<CellId, int>>(a, c)         // DoP=1 == DoP=16
        | _ -> failwith "a DoP variant failed to quiesce"
    }

[<Fact>]
let ``ferry round-runner agrees with the sequential runner (commutative effect)`` () : Task =
    task {
        // a: 1+2+3 = 6 ; b: 5 + 7(forwarded from a) = 12
        let cells = [ "a", 0; "b", 0 ]
        let msgs =
            [ "a", leaf 1; "a", leaf 2; "b", leaf 5
              "a", { Delta = 3; Fwd = [ "b", leaf 7 ] } ]
        let seq =
            match CellScheduler.runToQuiescence 1000 trivialStep (CellScheduler.init cells msgs) with
            | Ok f -> f | Error e -> failwith e
        let! parR = CellScheduler.runFerryToQuiescence (FerryThrottlerConfig.withFerries 4) trivialStep 1000 (CellScheduler.init cells msgs)
        match parR with
        | Ok par ->
            Assert.Equal(6, Map.find "a" par)
            Assert.Equal(12, Map.find "b" par)
            Assert.Equal<Map<CellId, int>>(seq, par)     // both runners, same commutative result
        | Error e -> failwith e
    }

[<Fact>]
let ``ferry runner: non-terminating cycle hits the named backstop`` () : Task =
    task {
        let pingPongStep (acc: int) (m: Msg) : int * (CellId * Msg) list =
            let target = if acc % 2 = 0 then "b" else "a"
            acc + 1, [ target, m ]
        let cells = [ "a", 0; "b", 0 ]
        let! r = CellScheduler.runFerryToQuiescence (FerryThrottlerConfig.withFerries 4) pingPongStep 50 (CellScheduler.init cells [ "a", leaf 1 ])
        match r with
        | Ok _ -> failwith "expected non-termination backstop to fire"
        | Error e -> Assert.Contains("did not quiesce", e)
    }

// ── Slice 3: fairness (structural round-robin) + parking observability ──

// Drive the sequential `step` by hand, recording which cell runs each turn —
// the head of `Ready` is the cell about to step. Lets us OBSERVE ordering
// (fairness) without a per-round hook.
let private processingOrder (s0: CellScheduler.State<int, Msg>) : CellId list =
    let order = System.Collections.Generic.List<CellId>()
    let mutable s = s0
    let mutable go = true
    while go do
        match s.Ready with
        | [] -> go <- false
        | id :: _ ->
            order.Add id
            match CellScheduler.step trivialStep s with
            | Some s' -> s <- s'
            | None -> go <- false
    List.ofSeq order

[<Fact>]
let ``starvation-freedom: a flooding cell does not stall its peers`` () =
    // "hot" has 100 messages, "cold" has 1. A starving scheduler would drain hot
    // fully before ever touching cold; a fair one runs cold almost immediately.
    let cells = [ "hot", 0; "cold", 0 ]
    let msgs = [ for _ in 1 .. 100 -> "hot", leaf 1 ] @ [ "cold", leaf 1 ]
    let order = processingOrder (CellScheduler.init cells msgs)
    let coldIdx = List.findIndex ((=) "cold") order
    Assert.True(coldIdx <= 1, sprintf "cold starved: first ran at turn %d" coldIdx)

[<Fact>]
let ``fairness is structural round-robin (peers interleave, not drain-one-then-other)`` () =
    // Two cells, three messages each. Round-robin ⇒ a,b,a,b,a,b — NOT a,a,a,b,b,b.
    let cells = [ "a", 0; "b", 0 ]
    let msgs = [ for _ in 1 .. 3 -> "a", leaf 1 ] @ [ for _ in 1 .. 3 -> "b", leaf 1 ]
    let order = processingOrder (CellScheduler.init cells msgs)
    Assert.Equal<CellId list>([ "a"; "b"; "a"; "b"; "a"; "b" ], order)

[<Fact>]
let ``parking observability: active and parked partition the cell set`` () =
    let cells = [ "busy", 0; "idle1", 0; "idle2", 0 ]
    let s = CellScheduler.init cells [ "busy", leaf 1 ]
    Assert.Equal<CellId list>([ "busy" ], CellScheduler.activeCells s)
    Assert.Equal<CellId list>([ "idle1"; "idle2" ], CellScheduler.parkedCells s)
    // active ⊎ parked = all cells (a clean partition, no overlap, no gaps)
    let all = (CellScheduler.activeCells s @ CellScheduler.parkedCells s) |> List.sort
    Assert.Equal<CellId list>([ "busy"; "idle1"; "idle2" ], all)

[<Fact>]
let ``at quiescence every cell is parked`` () =
    let cells = [ "a", 0; "b", 0 ]
    let s = CellScheduler.init cells [ "a", leaf 1; "b", leaf 2 ]
    // run the sequential scheduler to quiescence by hand, then inspect the state
    let mutable cur = s
    let mutable go = true
    while go do
        match CellScheduler.step trivialStep cur with
        | Some s' -> cur <- s'
        | None -> go <- false
    Assert.Empty(CellScheduler.activeCells cur)
    Assert.Equal<CellId list>([ "a"; "b" ], CellScheduler.parkedCells cur)

// ── Slice 4: soft cells — hold distributions, snap only at the edge ──

// A two-candidate distribution: "A" at 0.6, "B" at 0.4 (confidence = 0.6).
let private twoWay : SoftValue.SoftValue =
    SoftValue.unnormalized [ DynamicValue.String "A", 0.6; DynamicValue.String "B", 0.4 ]

// A pure soft step that adopts the input distribution and emits nothing — enough
// to show scheduling preserves the distribution (no premature collapse).
let private adoptSoft (_remains: SoftValue.SoftValue) (input: SoftValue.SoftValue)
    : SoftValue.SoftValue * (CellId * SoftValue.SoftValue) list =
    input, []

[<Fact>]
let ``soft scheduling preserves the distribution (no premature collapse)`` () =
    let cells = [ "c", SoftValue.certain DynamicValue.Null ]
    let s = CellScheduler.init cells [ "c", twoWay ]
    match CellScheduler.runToQuiescence 100 adoptSoft s with
    | Ok final ->
        let c = Map.find "c" final
        Assert.Equal(2, List.length c.Candidates)          // both candidates survive
        Assert.Equal(0.6, SoftValue.confidence c)          // distribution intact, uncollapsed
    | Error e -> failwith e

[<Fact>]
let ``snapAll collapses above threshold, holds (None) below — free-will-refuse-collapse`` () =
    let states = Map.ofList [ "c", twoWay ]
    // threshold 0.5 ≤ 0.6 confidence ⇒ collapses to the argmax "A"
    Assert.Equal<Map<CellId, DynamicValue option>>(
        Map.ofList [ "c", Some(DynamicValue.String "A") ],
        CellScheduler.snapAll 0.5 states)
    // threshold 0.7 > 0.6 confidence ⇒ REFUSES to collapse (holds)
    Assert.Equal<Map<CellId, DynamicValue option>>(
        Map.ofList [ "c", None ],
        CellScheduler.snapAll 0.7 states)

[<Fact>]
let ``softStep emits snapped (certain) messages when confident`` () =
    // Acts = Param "input" ⇒ the cell adopts the input distribution as its Remains.
    let acts = Bonsai.Expr.Param DurableYinYang.InputParam
    let step = CellScheduler.softStep acts 0.5
    // input is a CERTAIN object carrying an outbox to "b" ⇒ confident (1.0) ⇒ emits.
    let input =
        SoftValue.certain (
            DynamicValue.Object
                [ CellScheduler.OutboxKey,
                  DynamicValue.Array
                      [ DynamicValue.Array [ DynamicValue.String "b"; DynamicValue.Int 1L ] ] ])
    let _state, emitted = step (SoftValue.certain DynamicValue.Null) input
    Assert.Equal(1, List.length emitted)
    Assert.Equal("b", fst emitted.[0])
    // the message crossed the channel as a CERTAIN value (commitment collapsed)
    Assert.Equal(DynamicValue.Int 1L, SoftValue.resolve 1.0 (snd emitted.[0]) |> Option.get)

[<Fact>]
let ``softStep refuses to emit below threshold (holds)`` () =
    let acts = Bonsai.Expr.Param DurableYinYang.InputParam
    let step = CellScheduler.softStep acts 0.9   // demand high confidence to emit
    // input carries an outbox but only 0.6 confidence ⇒ below 0.9 ⇒ HOLD, no emit.
    let obj =
        DynamicValue.Object
            [ CellScheduler.OutboxKey,
              DynamicValue.Array [ DynamicValue.Array [ DynamicValue.String "b"; DynamicValue.Int 1L ] ] ]
    let input : SoftValue.SoftValue =
        SoftValue.unnormalized [ obj, 0.6; DynamicValue.Null, 0.4 ]
    let state, emitted = step (SoftValue.certain DynamicValue.Null) input
    Assert.Empty(emitted)                                   // refused to collapse
    Assert.Equal(2, List.length state.Candidates)          // but state stays soft, intact

// ── Slice 5: recovery — a cell's evolution is durable & replay-recoverable ──

[<Fact>]
let ``recovery: restart from log rebuilds identical cell state`` () : Task =
    task {
        let log = InMemoryDeltaLog<Msg>()
        let saga = DurableSaga.start log (CellScheduler.sagaStep trivialStep) 0
        let! _ = saga.AppendAsync(leaf 1)
        let! _ = saga.AppendAsync(leaf 2)
        let! _ = saga.AppendAsync(leaf 3)
        let before = saga.State                       // 1 + 2 + 3 = 6
        Assert.Equal(6, before)
        // "kill" mid-run: drop the in-memory saga, keep ONLY the durable log.
        let! resumed = DurableSaga<int, Msg>.ResumeAsync(log, CellScheduler.sagaStep trivialStep, 0)
        Assert.Equal(before, resumed.State)           // identical after replay
        Assert.Equal(6, resumed.State)
    }

[<Fact>]
let ``recovery: resume then continue advances correctly`` () : Task =
    task {
        let log = InMemoryDeltaLog<Msg>()
        let saga = DurableSaga.start log (CellScheduler.sagaStep trivialStep) 0
        let! _ = saga.AppendAsync(leaf 10)
        // kill, resume, then keep going on the resumed saga
        let! resumed = DurableSaga<int, Msg>.ResumeAsync(log, CellScheduler.sagaStep trivialStep, 0)
        Assert.Equal(10, resumed.State)
        let! _ = resumed.AppendAsync(leaf 5)
        Assert.Equal(15, resumed.State)               // continued from the recovered state
        // a fresh resume sees the full history (10 + 5)
        let! resumed2 = DurableSaga<int, Msg>.ResumeAsync(log, CellScheduler.sagaStep trivialStep, 0)
        Assert.Equal(15, resumed2.State)
    }

[<Fact>]
let ``recovery: independent cells recover independently`` () : Task =
    task {
        // Two cells, two logs — the fleet is per-cell durable (design note §4).
        let logA = InMemoryDeltaLog<Msg>()
        let logB = InMemoryDeltaLog<Msg>()
        let sagaA = DurableSaga.start logA (CellScheduler.sagaStep trivialStep) 0
        let sagaB = DurableSaga.start logB (CellScheduler.sagaStep trivialStep) 100
        let! _ = sagaA.AppendAsync(leaf 1)
        let! _ = sagaA.AppendAsync(leaf 2)
        let! _ = sagaB.AppendAsync(leaf 7)
        // kill both, resume both from their own logs
        let! rA = DurableSaga<int, Msg>.ResumeAsync(logA, CellScheduler.sagaStep trivialStep, 0)
        let! rB = DurableSaga<int, Msg>.ResumeAsync(logB, CellScheduler.sagaStep trivialStep, 100)
        Assert.Equal(3, rA.State)                     // 1 + 2
        Assert.Equal(107, rB.State)                   // 100 + 7 — independent
    }

// ── Non-commutative workloads: the REAL FIFO + DoP-invariance proofs ──
// (Every earlier test used commutative int accumulation, which cannot catch a
//  FIFO violation or a merge-order bug — the critic's Q4 gap. These use an
//  ORDER-SENSITIVE state: a list that records the exact processing sequence.)

// State = the reversed sequence of deltas this cell has processed (newest first).
// Order-sensitive: [1;2;3] processed in FIFO gives [3;2;1]; any reordering shows.
type OrderMsg = { D: int; Send: (CellId * OrderMsg) list }
let private oleaf d : OrderMsg = { D = d; Send = [] }
let private recordStep (acc: int list) (m: OrderMsg) : int list * (CellId * OrderMsg) list =
    m.D :: acc, m.Send

[<Fact>]
let ``sequential runner preserves a cell's own FIFO order`` () =
    // One cell, three messages [1;2;3]. FIFO ⇒ processed 1,2,3 ⇒ state [3;2;1].
    // The pre-fix re-ready bug rotated head→tail and produced [2;3;1].
    let cells = [ "a", [] ]
    let msgs = [ "a", oleaf 1; "a", oleaf 2; "a", oleaf 3 ]
    match CellScheduler.runToQuiescence 1000 recordStep (CellScheduler.init cells msgs) with
    | Ok final -> Assert.Equal<int list>([ 3; 2; 1 ], Map.find "a" final)
    | Error e -> failwith e

[<Fact>]
let ``DoP-invariance holds on a NON-commutative workload (the real proof)`` () : Task =
    task {
        // "src" forwards an ordered stream to "sink"; sink's list state is
        // order-sensitive, so if any DoP reordered per-cell delivery it would show.
        let cells = [ "src", []; "sink", [] ]
        let msgs =
            [ for i in 1 .. 8 -> "src", { D = i; Send = [ "sink", oleaf (i * 10) ] } ]
        let runAt dop =
            CellScheduler.runFerryToQuiescence (FerryThrottlerConfig.withFerries dop) recordStep 100_000 (CellScheduler.init cells msgs)
        let! r1 = runAt 1
        let! r4 = runAt 4
        let! r16 = runAt 16
        match r1, r4, r16 with
        | Ok a, Ok b, Ok c ->
            Assert.Equal<int list>(Map.find "sink" a, Map.find "sink" b)
            Assert.Equal<int list>(Map.find "sink" a, Map.find "sink" c)
            // and the order is the real FIFO one: sink saw 10,20,...,80 ⇒ [80;...;10]
            Assert.Equal<int list>([ for i in 8 .. -1 .. 1 -> i * 10 ], Map.find "sink" a)
        | _ -> failwith "a DoP variant failed to quiesce"
    }

[<Fact>]
let ``sequential and ferry runners agree on a non-commutative multi-message cell`` () : Task =
    task {
        // A cell processing multiple of its OWN messages: both runners must give
        // the same FIFO-ordered result (this is where the pre-fix bug diverged).
        let cells = [ "a", [] ]
        let msgs = [ "a", oleaf 1; "a", oleaf 2; "a", oleaf 3; "a", oleaf 4 ]
        let seq =
            match CellScheduler.runToQuiescence 1000 recordStep (CellScheduler.init cells msgs) with
            | Ok f -> f | Error e -> failwith e
        let! parR = CellScheduler.runFerryToQuiescence (FerryThrottlerConfig.withFerries 4) recordStep 1000 (CellScheduler.init cells msgs)
        match parR with
        | Ok par ->
            Assert.Equal<int list>([ 4; 3; 2; 1 ], Map.find "a" seq)
            Assert.Equal<int list>(Map.find "a" seq, Map.find "a" par)
        | Error e -> failwith e
    }
