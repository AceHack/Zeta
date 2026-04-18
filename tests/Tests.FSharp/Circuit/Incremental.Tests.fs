module Zeta.Tests.Circuit.IncrementalTests
#nowarn "0893"

open System
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


/// Equivalence theorems: `Q^Δ` on a stream of deltas produces the same
/// integrated output as `Q` applied to the running snapshot.

[<Fact>]
let ``incrementalize of map equals map (map is linear)`` () =
    task {
        let ca = Circuit.create ()
        let inputA = ca.ZSetInput<int>()
        let directMap = ca.Map(inputA.Stream, Func<int, int>(fun x -> x * 2))
        let outDirect = ca.Output directMap

        let ci = Circuit.create ()
        let inputI = ci.ZSetInput<int>()
        let q = Func<Stream<ZSet<int>>, Stream<ZSet<int>>>(fun s -> ci.Map(s, Func<int, int>(fun x -> x * 2)))
        let incremental = ci.IncrementalizeZSet(q, inputI.Stream)
        let outInc = ci.Output incremental

        let deltas = [
            ZSet.ofKeys [ 1; 2 ]
            ZSet.singleton 3 1L
            ZSet.singleton 1 -1L
        ]
        for d in deltas do
            inputA.Send d
            inputI.Send d
            do! ca.StepAsync()
            do! ci.StepAsync()
            outInc.Current |> should equal outDirect.Current
    }

[<Fact>]
let ``incremental join matches direct join on integrated inputs`` () =
    task {
        let ca = Circuit.create ()
        let inputL = ca.ZSetInput<int * string>()
        let inputR = ca.ZSetInput<int * int>()
        let iL = ca.IntegrateZSet inputL.Stream
        let iR = ca.IntegrateZSet inputR.Stream
        let joined =
            ca.Join(iL, iR,
                Func<int * string, int>(fst),
                Func<int * int, int>(fst),
                Func<int * string, int * int, int * string * int>(fun (k, s) (_, v) -> (k, s, v)))
        let outDirect = ca.Output joined

        let ci = Circuit.create ()
        let dL = ci.ZSetInput<int * string>()
        let dR = ci.ZSetInput<int * int>()
        let inc =
            ci.IncrementalJoin(dL.Stream, dR.Stream,
                Func<int * string, int>(fst),
                Func<int * int, int>(fst),
                Func<int * string, int * int, int * string * int>(fun (k, s) (_, v) -> (k, s, v)))
        let incIntegrated = ci.IntegrateZSet inc
        let outInc = ci.Output incIntegrated

        let deltasL = [
            ZSet.ofSeq [ (1, "a"), 1L ]
            ZSet.ofSeq [ (2, "b"), 1L ]
            ZSet.ofSeq [ (1, "a"), -1L ; (3, "c"), 1L ]
        ]
        let deltasR = [
            ZSet.ofSeq [ (1, 10), 1L ]
            ZSet.ofSeq [ (3, 30), 1L ]
            ZSet.ofSeq [ (2, 20), 1L ]
        ]
        for (l, r) in List.zip deltasL deltasR do
            inputL.Send l
            inputR.Send r
            dL.Send l
            dR.Send r
            do! ca.StepAsync()
            do! ci.StepAsync()
            outInc.Current |> should equal outDirect.Current
    }

[<Fact>]
let ``incremental distinct matches direct distinct on integrated input`` () =
    task {
        let ca = Circuit.create ()
        let inA = ca.ZSetInput<int>()
        let full = ca.Distinct(ca.IntegrateZSet inA.Stream)
        let outDirect = ca.Output full

        let ci = Circuit.create ()
        let inI = ci.ZSetInput<int>()
        let incDist = ci.IncrementalDistinct inI.Stream
        let incFull = ci.IntegrateZSet incDist
        let outInc = ci.Output incFull

        let deltas = [
            ZSet.ofSeq [ 1, 2L ; 2, 1L ]
            ZSet.ofSeq [ 1, -1L ; 3, 1L ]
            ZSet.ofSeq [ 1, -1L ; 2, -1L ]
        ]
        for d in deltas do
            inA.Send d
            inI.Send d
            do! ca.StepAsync()
            do! ci.StepAsync()
            outInc.Current |> should equal outDirect.Current
    }


// ─── DistinctIncremental combinator (moved from CoverageTests/CoverageTests2) ──

[<Fact>]
let ``DistinctIncremental op matches H function`` () =
    task {
        let c = Circuit.create ()
        let i = c.ZSetInput<int>()
        let d = c.ZSetInput<int>()
        let h = c.DistinctIncremental(i.Stream, d.Stream)
        let out = c.Output h
        i.Send(ZSet.ofSeq [ 1, 2L ])  // i = {1→2}
        d.Send(ZSet.ofSeq [ 1, -2L ; 2, 1L ])  // d flips 1 to ≤0, adds 2
        do! c.StepAsync()
        out.Current.[1] |> should equal -1L
        out.Current.[2] |> should equal 1L
    }


[<Fact>]
let ``DistinctIncremental combinator via circuit`` () =
    task {
        let c = Circuit.create ()
        let i = c.ZSetInput<int>()
        let d = c.ZSetInput<int>()
        let h = c.DistinctIncremental(i.Stream, d.Stream)
        let out = c.Output h
        i.Send(ZSet.ofSeq [ 1, 2L ])
        d.Send(ZSet.ofSeq [ 2, 1L ])
        do! c.StepAsync()
        out.Current.[2] |> should equal 1L
    }


[<Fact>]
let ``IncrementalDistinct combinator`` () =
    task {
        let c = Circuit.create ()
        let delta = c.ZSetInput<int>()
        let h = c.IncrementalDistinct delta.Stream
        let out = c.Output h
        delta.Send(ZSet.ofSeq [ 1, 1L ])
        do! c.StepAsync()
        out.Current.[1] |> should equal 1L
    }


// ─── IntegrateZSet / DifferentiateZSet (moved from CoverageBoostTests) ──

[<Fact>]
let ``IntegrateZSet accumulates Z-sets across ticks`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let integ = c.IntegrateZSet input.Stream
        let out = c.Output integ
        input.Send (ZSet.ofKeys [ 1 ])
        do! c.StepAsync()
        input.Send (ZSet.ofKeys [ 2 ])
        do! c.StepAsync()
        out.Current.Count |> should equal 2
    }


[<Fact>]
let ``DifferentiateZSet produces per-tick deltas`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let diff = c.DifferentiateZSet input.Stream
        let out = c.Output diff
        input.Send (ZSet.ofKeys [ 1 ])
        do! c.StepAsync()
        input.Send (ZSet.ofKeys [ 2 ])
        do! c.StepAsync()
        out.Current.Count |> should be (greaterThanOrEqualTo 1)
    }


// ─── Recursive semi-naive eval (moved from CoverageTests2) ─────────

[<Fact>]
let ``RecursiveSemiNaive converges for simple reachability`` () =
    let c = Circuit.create ()
    let edges = c.ZSetInput<int * int>()
    let edgeRel = c.IntegrateZSet edges.Stream
    let reach =
        c.RecursiveSemiNaive(
            edgeRel,
            Func<_, _>(fun reachSoFar ->
                c.Join(reachSoFar, edgeRel,
                    Func<_, _>(snd), Func<_, _>(fst),
                    Func<_, _, _>(fun (a, _b1) (_b2, d) -> (a, d)))))
    let out = c.Output reach
    c.Build()
    edges.Send(ZSet.ofKeys [ 1, 2 ; 2, 3 ])
    c.IterateToFixedPoint(reach, 32) |> ignore
    out.Current.[(1, 2)] |> should equal 1L
    out.Current.[(1, 3)] |> should equal 1L
    out.Current.[(2, 3)] |> should equal 1L
