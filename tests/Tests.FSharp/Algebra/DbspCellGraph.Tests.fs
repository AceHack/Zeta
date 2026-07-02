module Zeta.Tests.FSharp.Algebra.DbspCellGraphTests

open Xunit
open System.Threading.Tasks
open Zeta.Core

// A linear pipeline: filter(even) -> map(*10) -> integrate(sink).
let private pipeline =
    [ "flt", DbspOp.Filter 0, [ "mul" ]
      "mul", DbspOp.Rekey 10L, [ "snk" ]
      "snk", DbspOp.Integrate, [] ]

// Two input deltas — the second RETRACTS key 2 and inserts key 6.
let private d1 = ZSet.ofSeq [ 1L, 1L; 2L, 1L; 3L, 1L; 4L, 1L ]
let private d2 = ZSet.ofSeq [ 2L, -1L; 6L, 1L ]

[<Fact>]
let ``incremental streaming through the cell graph equals batch recompute`` () =
    // Batch recompute: filter-even then *10 of the summed input.
    let total = d1 + d2                                   // {1,3,4,6}, 2 cancelled
    let recompute = ZSet.ofSeq [ for e in total do if e.Key % 2L = 0L then yield e.Key * 10L, e.Weight ]
    let s = DbspCellGraph.seed pipeline [ "flt", d1; "flt", d2 ]
    match CellScheduler.runToQuiescence 1000 DbspCellGraph.step s with
    | Ok final ->
        let sink = DbspCellGraph.accOf "snk" final
        Assert.Equal<ZSet<int64>>(recompute, sink)                    // incremental ≡ recompute
        Assert.Equal<ZSet<int64>>(ZSet.ofSeq [ 40L, 1L; 60L, 1L ], sink)
    | Error e -> failwith e

[<Fact>]
let ``retraction cancels at every stage of the graph`` () =
    let s = DbspCellGraph.seed pipeline [ "flt", d1; "flt", d2 ]
    match CellScheduler.runToQuiescence 1000 DbspCellGraph.step s with
    | Ok final ->
        // key 2 (even) inserted then retracted ⇒ gone from the filter's integral
        Assert.Equal<ZSet<int64>>(ZSet.ofSeq [ 4L, 1L; 6L, 1L ], DbspCellGraph.accOf "flt" final)
        // 2*10=20 correspondingly cancels at the map stage
        Assert.Equal<ZSet<int64>>(ZSet.ofSeq [ 40L, 1L; 60L, 1L ], DbspCellGraph.accOf "mul" final)
    | Error e -> failwith e

[<Fact>]
let ``DoP-invariance on the DBSP workload (run(1) == run(N))`` () : Task =
    task {
        let runAt dop =
            CellScheduler.runFerryToQuiescence
                (FerryThrottlerConfig.withFerries dop) DbspCellGraph.step 100_000
                (DbspCellGraph.seed pipeline [ "flt", d1; "flt", d2 ])
        let! r1 = runAt 1
        let! r4 = runAt 4
        match r1, r4 with
        | Ok a, Ok b ->
            let sinkA = DbspCellGraph.accOf "snk" a
            let sinkB = DbspCellGraph.accOf "snk" b
            Assert.Equal<ZSet<int64>>(sinkA, sinkB)                    // scale-free on a real dataflow
            Assert.Equal<ZSet<int64>>(ZSet.ofSeq [ 40L, 1L; 60L, 1L ], sinkA)
        | _ -> failwith "a DoP variant failed to quiesce"
    }

[<Fact>]
let ``fan-out then merge: partition by parity reunites at the sink`` () =
    // src relays to two filters (even/odd) that both feed one sink — the
    // partition is reunited, exercising fan-out AND multi-source merge.
    let graph =
        [ "src", DbspOp.Relay, [ "evens"; "odds" ]
          "evens", DbspOp.Filter 0, [ "snk" ]
          "odds", DbspOp.Filter 1, [ "snk" ]
          "snk", DbspOp.Integrate, [] ]
    let input = ZSet.ofSeq [ 1L, 1L; 2L, 1L; 3L, 1L; 4L, 1L ]
    let s = DbspCellGraph.seed graph [ "src", input ]
    match CellScheduler.runToQuiescence 1000 DbspCellGraph.step s with
    | Ok final -> Assert.Equal<ZSet<int64>>(input, DbspCellGraph.accOf "snk" final)   // evens ⊎ odds = input
    | Error e -> failwith e

// ── Non-linear operator: incremental distinct through the scheduler ──

[<Fact>]
let ``non-linear distinct: incremental equals recompute across the scheduler`` () =
    // a1 has a multiset (key 1 twice); a2 retracts key 2 to zero and adds key 4.
    let a1 = ZSet.ofSeq [ 1L, 2L; 2L, 1L; 3L, 1L ]
    let a2 = ZSet.ofSeq [ 2L, -1L; 4L, 1L ]
    let g = [ "d", DbspOp.Distinct, [] ]
    let s = DbspCellGraph.seed g [ "d", a1; "d", a2 ]
    match CellScheduler.runToQuiescence 1000 DbspCellGraph.step s with
    | Ok final ->
        let got = DbspCellGraph.accOf "d" final
        // incremental distinct == batch distinct of the integrated input
        Assert.Equal<ZSet<int64>>(ZSet.distinct (a1 + a2), got)
        // set semantics, key 2 gone (its count crossed back to 0)
        Assert.Equal<ZSet<int64>>(ZSet.ofSeq [ 1L, 1L; 3L, 1L; 4L, 1L ], got)
    | Error e -> failwith e

[<Fact>]
let ``distinct inside a graph is DoP-invariant`` () : Task =
    task {
        // relay -> distinct -> integrate(sink); the sink integrates distinct's output.
        let g =
            [ "src", DbspOp.Relay, [ "d" ]
              "d", DbspOp.Distinct, [ "snk" ]
              "snk", DbspOp.Integrate, [] ]
        let a1 = ZSet.ofSeq [ 1L, 2L; 2L, 1L; 3L, 1L ]
        let a2 = ZSet.ofSeq [ 2L, -1L; 4L, 1L ]
        let runAt dop =
            CellScheduler.runFerryToQuiescence
                (FerryThrottlerConfig.withFerries dop) DbspCellGraph.step 100_000
                (DbspCellGraph.seed g [ "src", a1; "src", a2 ])
        let! r1 = runAt 1
        let! r4 = runAt 4
        match r1, r4 with
        | Ok x, Ok y ->
            let sinkX = DbspCellGraph.accOf "snk" x
            Assert.Equal<ZSet<int64>>(sinkX, DbspCellGraph.accOf "snk" y)
            Assert.Equal<ZSet<int64>>(ZSet.distinct (a1 + a2), sinkX)
        | _ -> failwith "a DoP variant failed to quiesce"
    }
