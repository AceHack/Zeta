module Zeta.Tests.FSharp.Algebra.DbspCellGraphTests

open Xunit
open System.Threading.Tasks
open Zeta.Core

// A linear pipeline: filter(even) -> map(*10) -> integrate(sink).
let private pipeline =
    [ "flt", DbspOp.Filter 0, [ "mul", Mono ]
      "mul", DbspOp.Rekey 10L, [ "snk", Mono ]
      "snk", DbspOp.Integrate, [] ]

// Two input deltas — the second RETRACTS key 2 and inserts key 6.
let private d1 = ZSet.ofSeq [ 1L, 1L; 2L, 1L; 3L, 1L; 4L, 1L ]
let private d2 = ZSet.ofSeq [ 2L, -1L; 6L, 1L ]

[<Fact>]
let ``incremental streaming through the cell graph equals batch recompute`` () =
    let total = d1 + d2
    let recompute = ZSet.ofSeq [ for e in total do if e.Key % 2L = 0L then yield e.Key * 10L, e.Weight ]
    let s = DbspCellGraph.seed pipeline [ "flt", DbspCellGraph.mono d1; "flt", DbspCellGraph.mono d2 ]
    match CellScheduler.runToQuiescence 1000 DbspCellGraph.step s with
    | Ok final ->
        let sink = DbspCellGraph.accOf "snk" final
        Assert.Equal<ZSet<int64>>(recompute, sink)
        Assert.Equal<ZSet<int64>>(ZSet.ofSeq [ 40L, 1L; 60L, 1L ], sink)
    | Error e -> failwith e

[<Fact>]
let ``retraction cancels at every stage of the graph`` () =
    let s = DbspCellGraph.seed pipeline [ "flt", DbspCellGraph.mono d1; "flt", DbspCellGraph.mono d2 ]
    match CellScheduler.runToQuiescence 1000 DbspCellGraph.step s with
    | Ok final ->
        Assert.Equal<ZSet<int64>>(ZSet.ofSeq [ 4L, 1L; 6L, 1L ], DbspCellGraph.accOf "flt" final)
        Assert.Equal<ZSet<int64>>(ZSet.ofSeq [ 40L, 1L; 60L, 1L ], DbspCellGraph.accOf "mul" final)
    | Error e -> failwith e

[<Fact>]
let ``DoP-invariance on the DBSP workload (run(1) == run(N))`` () : Task =
    task {
        let runAt dop =
            CellScheduler.runFerryToQuiescence
                (FerryThrottlerConfig.withFerries dop) DbspCellGraph.step 100_000
                (DbspCellGraph.seed pipeline [ "flt", DbspCellGraph.mono d1; "flt", DbspCellGraph.mono d2 ])
        let! r1 = runAt 1
        let! r4 = runAt 4
        match r1, r4 with
        | Ok a, Ok b ->
            Assert.Equal<ZSet<int64>>(DbspCellGraph.accOf "snk" a, DbspCellGraph.accOf "snk" b)
            Assert.Equal<ZSet<int64>>(ZSet.ofSeq [ 40L, 1L; 60L, 1L ], DbspCellGraph.accOf "snk" a)
        | _ -> failwith "a DoP variant failed to quiesce"
    }

[<Fact>]
let ``fan-out then merge: partition by parity reunites at the sink`` () =
    let graph =
        [ "src", DbspOp.Relay, [ "evens", Mono; "odds", Mono ]
          "evens", DbspOp.Filter 0, [ "snk", Mono ]
          "odds", DbspOp.Filter 1, [ "snk", Mono ]
          "snk", DbspOp.Integrate, [] ]
    let input = ZSet.ofSeq [ 1L, 1L; 2L, 1L; 3L, 1L; 4L, 1L ]
    let s = DbspCellGraph.seed graph [ "src", DbspCellGraph.mono input ]
    match CellScheduler.runToQuiescence 1000 DbspCellGraph.step s with
    | Ok final -> Assert.Equal<ZSet<int64>>(input, DbspCellGraph.accOf "snk" final)
    | Error e -> failwith e

// ── Non-linear operator: incremental distinct through the scheduler ──

[<Fact>]
let ``non-linear distinct: incremental equals recompute across the scheduler`` () =
    let a1 = ZSet.ofSeq [ 1L, 2L; 2L, 1L; 3L, 1L ]
    let a2 = ZSet.ofSeq [ 2L, -1L; 4L, 1L ]
    let g = [ "d", DbspOp.Distinct, [] ]
    let s = DbspCellGraph.seed g [ "d", DbspCellGraph.mono a1; "d", DbspCellGraph.mono a2 ]
    match CellScheduler.runToQuiescence 1000 DbspCellGraph.step s with
    | Ok final ->
        let got = DbspCellGraph.accOf "d" final
        Assert.Equal<ZSet<int64>>(ZSet.distinct (a1 + a2), got)
        Assert.Equal<ZSet<int64>>(ZSet.ofSeq [ 1L, 1L; 3L, 1L; 4L, 1L ], got)
    | Error e -> failwith e

[<Fact>]
let ``distinct inside a graph is DoP-invariant`` () : Task =
    task {
        let g =
            [ "src", DbspOp.Relay, [ "d", Mono ]
              "d", DbspOp.Distinct, [ "snk", Mono ]
              "snk", DbspOp.Integrate, [] ]
        let a1 = ZSet.ofSeq [ 1L, 2L; 2L, 1L; 3L, 1L ]
        let a2 = ZSet.ofSeq [ 2L, -1L; 4L, 1L ]
        let runAt dop =
            CellScheduler.runFerryToQuiescence
                (FerryThrottlerConfig.withFerries dop) DbspCellGraph.step 100_000
                (DbspCellGraph.seed g [ "src", DbspCellGraph.mono a1; "src", DbspCellGraph.mono a2 ])
        let! r1 = runAt 1
        let! r4 = runAt 4
        match r1, r4 with
        | Ok x, Ok y ->
            Assert.Equal<ZSet<int64>>(DbspCellGraph.accOf "snk" x, DbspCellGraph.accOf "snk" y)
            Assert.Equal<ZSet<int64>>(ZSet.distinct (a1 + a2), DbspCellGraph.accOf "snk" x)
        | _ -> failwith "a DoP variant failed to quiesce"
    }

// ── Bilinear operator: incremental equi-join through the scheduler ──

// Left stream `a`, right stream `b`; equi-join keeps matched keys, weights multiply.
let private ja1 = ZSet.ofSeq [ 1L, 1L; 2L, 1L ]
let private jb1 = ZSet.ofSeq [ 2L, 1L; 3L, 1L ]
let private jrecompute = DbspCellGraph.joinKeys (ja1) (jb1)   // {2 : 1*1}

[<Fact>]
let ``bilinear join: incremental equals recompute (I(a) join I(b))`` () =
    // one join cell fed left then right
    let g = [ "j", DbspOp.Join, [] ]
    let s = DbspCellGraph.seed g [ "j", DbspCellGraph.left ja1; "j", DbspCellGraph.right jb1 ]
    match CellScheduler.runToQuiescence 1000 DbspCellGraph.step s with
    | Ok final ->
        let got = DbspCellGraph.accOf "j" final
        Assert.Equal<ZSet<int64>>(jrecompute, got)
        Assert.Equal<ZSet<int64>>(ZSet.ofSeq [ 2L, 1L ], got)   // only key 2 matches
    | Error e -> failwith e

[<Fact>]
let ``bilinear join is order- and DoP-invariant through a graph`` () : Task =
    task {
        // two relays feed the join's Left and Right ports; sink integrates the join.
        let g =
            [ "jl", DbspOp.Relay, [ "j", Left ]
              "jr", DbspOp.Relay, [ "j", Right ]
              "j", DbspOp.Join, [ "snk", Mono ]
              "snk", DbspOp.Integrate, [] ]
        let runAt dop =
            CellScheduler.runFerryToQuiescence
                (FerryThrottlerConfig.withFerries dop) DbspCellGraph.step 100_000
                (DbspCellGraph.seed g [ "jl", DbspCellGraph.mono ja1; "jr", DbspCellGraph.mono jb1 ])
        let! r1 = runAt 1
        let! r4 = runAt 4
        match r1, r4 with
        | Ok x, Ok y ->
            Assert.Equal<ZSet<int64>>(DbspCellGraph.accOf "snk" x, DbspCellGraph.accOf "snk" y)
            Assert.Equal<ZSet<int64>>(jrecompute, DbspCellGraph.accOf "snk" x)
        | _ -> failwith "a DoP variant failed to quiesce"
    }

[<Fact>]
let ``join with a retraction on one side updates the match incrementally`` () =
    // right side later retracts key 2 ⇒ the matched join output must retract too.
    let g = [ "j", DbspOp.Join, [] ]
    let s =
        DbspCellGraph.seed g
            [ "j", DbspCellGraph.left ja1                       // left {1,2}
              "j", DbspCellGraph.right jb1                      // right {2,3} -> join {2}
              "j", DbspCellGraph.right (ZSet.ofSeq [ 2L, -1L ]) ] // retract right key 2
    match CellScheduler.runToQuiescence 1000 DbspCellGraph.step s with
    | Ok final ->
        // recompute: I(a)={1,2}, I(b)={3} ⇒ no matches ⇒ empty
        Assert.True((DbspCellGraph.accOf "j" final).IsEmpty)
    | Error e -> failwith e
