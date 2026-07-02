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
