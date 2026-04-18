module Zeta.Tests.Operators.AggregateTests
#nowarn "0893"

open System
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


[<Fact>]
let ``GroupByCount counts rows per group`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int * string> ()
        let counts = c.GroupByCount(input.Stream, Func<_, _>(fst))
        let out = c.Output counts

        input.Send(ZSet.ofKeys [
            1, "a" ; 1, "b" ; 1, "c" ; 2, "x" ; 2, "y"
        ])
        do! c.StepAsync ()
        out.Current.[(1, 3L)] |> should equal 1L
        out.Current.[(2, 2L)] |> should equal 1L
    }


[<Fact>]
let ``GroupByMin picks the smallest value`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int * int> ()
        let mins = c.GroupByMin(input.Stream, Func<_, _>(fst), Func<_, _>(snd))
        let out = c.Output mins

        input.Send(ZSet.ofKeys [
            1, 10 ; 1, 5 ; 1, 20 ; 2, 42 ; 2, 7
        ])
        do! c.StepAsync ()
        out.Current.[(1, 5)] |> should equal 1L
        out.Current.[(2, 7)] |> should equal 1L
    }


[<Fact>]
let ``GroupByMax picks the largest value`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int * int> ()
        let maxes = c.GroupByMax(input.Stream, Func<_, _>(fst), Func<_, _>(snd))
        let out = c.Output maxes

        input.Send(ZSet.ofKeys [ 1, 10 ; 1, 5 ; 1, 20 ; 2, 7 ])
        do! c.StepAsync ()
        out.Current.[(1, 20)] |> should equal 1L
        out.Current.[(2, 7)] |> should equal 1L
    }


[<Fact>]
let ``Antijoin drops rows present in the right side`` () =
    task {
        let c = Circuit.create ()
        let l = c.ZSetInput<int * string> ()
        let r = c.ZSetInput<int> ()
        let diff = c.Antijoin(l.Stream, r.Stream, Func<_, _>(fst), Func<_, _>(id))
        let out = c.Output diff

        l.Send(ZSet.ofKeys [ 1, "a" ; 2, "b" ; 3, "c" ])
        r.Send(ZSet.ofKeys [ 2 ])
        do! c.StepAsync ()
        out.Current.[(1, "a")] |> should equal 1L
        out.Current.[(2, "b")] |> should equal 0L
        out.Current.[(3, "c")] |> should equal 1L
    }


[<Fact>]
let ``Semijoin keeps rows present in the right side`` () =
    task {
        let c = Circuit.create ()
        let l = c.ZSetInput<int * string> ()
        let r = c.ZSetInput<int> ()
        let matched = c.Semijoin(l.Stream, r.Stream, Func<_, _>(fst), Func<_, _>(id))
        let out = c.Output matched

        l.Send(ZSet.ofKeys [ 1, "a" ; 2, "b" ; 3, "c" ])
        r.Send(ZSet.ofKeys [ 2 ; 3 ])
        do! c.StepAsync ()
        out.Current.[(1, "a")] |> should equal 0L
        out.Current.[(2, "b")] |> should equal 1L
        out.Current.[(3, "c")] |> should equal 1L
    }


[<Fact>]
let ``ScalarCount sums the weights`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<string> ()
        let total = c.ScalarCount input.Stream
        let out = c.Output total

        input.Send(ZSet.ofKeys [ "a" ; "a" ; "b" ])
        do! c.StepAsync ()
        out.Current |> should equal 3L
    }


[<Fact>]
let ``ScalarSum adds weighted values`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int> ()
        let total = c.ScalarSum(input.Stream, Func<_, _>(int64))
        let out = c.Output total

        input.Send(ZSet.ofKeys [ 1 ; 2 ; 3 ; 4 ])
        do! c.StepAsync ()
        out.Current |> should equal 10L
    }


[<Fact>]
let ``Recursive reachability reaches transitive closure`` () =
    // Transitive closure: given an edge relation, compute all reachable pairs.
    // Edges is the base relation, so we integrate it once — otherwise the raw
    // delta stream is empty on every tick past the first and recursion stalls.
    let c = Circuit.create ()
    let edges = c.ZSetInput<int * int> ()
    let edgeRel = c.IntegrateZSet edges.Stream

    let reach =
        c.Recursive(
            edgeRel,
            Func<_, _>(fun (reachSoFar: Stream<ZSet<int * int>>) ->
                // { (a, c) | (a, b) ∈ reach, (b, c) ∈ edges }
                c.Join(
                    reachSoFar, edgeRel,
                    Func<_, _>(snd),
                    Func<_, _>(fst),
                    Func<_, _, _>(fun (a, _b1) (_b2, d) -> (a, d)))))

    let out = c.Output reach
    c.Build ()

    // Graph: 1 -> 2 -> 3 -> 4
    edges.Send(ZSet.ofKeys [ 1, 2 ; 2, 3 ; 3, 4 ])

    // Iterate until the recursive circuit reaches a fixed point.
    let iterations = c.IterateToFixedPoint(reach, 16)
    iterations |> should be (lessThanOrEqualTo 16)

    // All reachable pairs: (1,2), (1,3), (1,4), (2,3), (2,4), (3,4)
    out.Current.[(1, 2)] |> should equal 1L
    out.Current.[(1, 3)] |> should equal 1L
    out.Current.[(1, 4)] |> should equal 1L
    out.Current.[(2, 3)] |> should equal 1L
    out.Current.[(2, 4)] |> should equal 1L
    out.Current.[(3, 4)] |> should equal 1L


// ─── Average / GroupByAverage (moved from AdvancedTests / CoverageTests2) ─────

[<Fact>]
let ``Average computes per-group mean`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<string * int> ()
        let avgs = c.GroupByAverage(
                     input.Stream,
                     Func<_, _>(fst),
                     Func<_, _>(fun (_, v) -> int64 v))
        let out = c.Output avgs
        input.Send(ZSet.ofKeys [
            "g1", 10 ; "g1", 20 ; "g1", 30
            "g2", 5  ; "g2", 15
        ])
        do! c.StepAsync ()
        out.Current.[("g1", 20.0)] |> should equal 1L
        out.Current.[("g2", 10.0)] |> should equal 1L
    }


[<Fact>]
let ``GroupByAverage empty`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<string * int>()
        let avg =
            c.GroupByAverage(input.Stream,
                Func<_, _>(fst),
                Func<_, _>(fun (_, v) -> int64 v))
        let out = c.Output avg
        do! c.StepAsync()
        out.Current.IsEmpty |> should be True
    }


// ─── GroupByTopK (moved from CoverageTests) ──────────────────────

[<Fact>]
let ``GroupByTopK picks top-K per group`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<string * int>()
        let top =
            c.GroupByTopK(
                input.Stream,
                Func<_, _>(fst),
                2,
                Func<_, _, _>(fun (_, v1) (_, v2) -> compare v2 v1))
        let out = c.Output top
        input.Send(ZSet.ofKeys [
            "g1", 10 ; "g1", 5 ; "g1", 20 ; "g1", 15
            "g2", 100 ; "g2", 200
        ])
        do! c.StepAsync()
        // g1 top 2 descending: 20, 15. g2: both.
        out.Current.[("g1", 20)]  |> should equal 1L
        out.Current.[("g1", 15)]  |> should equal 1L
        out.Current.[("g2", 100)] |> should equal 1L
        out.Current.[("g2", 200)] |> should equal 1L
    }


// ─── ScalarFold (moved from AdvancedTests / CoverageTests2) ────

[<Fact>]
let ``ScalarFold reduces a Z-set in one pass`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int> ()
        let sum = c.ScalarFold(
                    input.Stream,
                    0L,
                    Func<_, _, _, _>(fun acc k w -> acc + int64 k * w))
        let out = c.Output sum
        input.Send(ZSet.ofKeys [ 1 ; 2 ; 3 ; 4 ])
        do! c.StepAsync ()
        out.Current |> should equal 10L
    }


[<Fact>]
let ``ScalarFold empty yields initial`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let f =
            c.ScalarFold(input.Stream, 42L,
                Func<_, _, _, _>(fun acc _ _ -> acc + 1L))
        let out = c.Output f
        do! c.StepAsync()
        out.Current |> should equal 42L
    }


// ─── Inspect / Index / Consolidate (moved from AdvancedTests / CoverageTests) ──

[<Fact>]
let ``Inspect forwards value unchanged`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int> ()
        let mutable seen : ZSet<int> = ZSet<int>.Empty
        let inspected = c.Inspect(input.Stream, Action<_>(fun v -> seen <- v))
        let out = c.Output inspected
        input.Send(ZSet.singleton 42 1L)
        do! c.StepAsync ()
        out.Current.[42] |> should equal 1L
        seen.[42] |> should equal 1L
    }


[<Fact>]
let ``Inspect fires callback`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let mutable fired = 0
        let i = c.Inspect(input.Stream, Action<ZSet<int>>(fun _ -> fired <- fired + 1))
        let _ = c.Output i
        input.Send(ZSet.singleton 1 1L)
        do! c.StepAsync()
        fired |> should be (greaterThanOrEqualTo 1)
    }


[<Fact>]
let ``Index re-keys entries`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<string> ()
        let indexed = c.Index(input.Stream, Func<_, _>(fun (s: string) -> s.Length))
        let out = c.Output indexed
        input.Send(ZSet.ofKeys [ "a" ; "bb" ; "ccc" ])
        do! c.StepAsync ()
        out.Current.[(1, "a")] |> should equal 1L
        out.Current.[(2, "bb")] |> should equal 1L
        out.Current.[(3, "ccc")] |> should equal 1L
    }


[<Fact>]
let ``Consolidate is a semantic no-op`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int> ()
        let via = c.Consolidate input.Stream
        let out = c.Output via
        input.Send(ZSet.ofKeys [ 1 ; 2 ; 3 ])
        do! c.StepAsync ()
        out.Current.[1] |> should equal 1L
        out.Current.[2] |> should equal 1L
        out.Current.[3] |> should equal 1L
    }


// ─── Simd.Sum (moved from AdvancedTests / CoverageTests) ──────

[<Fact>]
let ``Simd Sum matches scalar sum`` () =
    let data = [| 1L .. 1000L |]
    let expected = int64 (1000 * 1001 / 2)   // = 500500
    Simd.Sum(ReadOnlySpan data) |> should equal expected


[<Fact>]
let ``Simd.Sum int64 empty span`` () =
    let empty = ReadOnlySpan<int64>.Empty
    Simd.Sum empty |> should equal 0L


[<Fact>]
let ``Simd.Sum int32 various sizes`` () =
    for n in [ 0 ; 1 ; 8 ; 100 ; 1024 ] do
        let arr = Array.init n int
        let expected = Array.sum arr
        Simd.Sum(ReadOnlySpan arr) |> should equal expected


[<Fact>]
let ``Simd IsAccelerated is deterministic`` () =
    // Just confirm the property returns.
    let _ = Simd.IsAccelerated
    let _ = Simd.VectorWidth
    ()
