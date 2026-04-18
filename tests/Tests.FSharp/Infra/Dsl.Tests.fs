module Zeta.Tests.Infra.DslTests
#nowarn "0893"

open System
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// Fluent LINQ-style extensions on Stream<ZSet<_>> (moved from QueryCETests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``Stream.Where filters`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let filtered = input.Stream.Where(c, Func<_, _>(fun x -> x > 5))
        let out = c.Output filtered
        input.Send (ZSet.ofKeys [ 1; 3; 7; 10 ])
        do! c.StepAsync()
        out.Current.Count |> should equal 2
        out.Current.[7] |> should equal 1L
        out.Current.[10] |> should equal 1L
    }


[<Fact>]
let ``Stream.Select projects`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let doubled = input.Stream.Select(c, Func<_, _>(fun x -> x * 2))
        let out = c.Output doubled
        input.Send (ZSet.ofKeys [ 1; 2; 3 ])
        do! c.StepAsync()
        out.Current.[4] |> should equal 1L
        out.Current.[6] |> should equal 1L
    }


[<Fact>]
let ``Stream fluent chain Where.Select.Distinct works`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let pipeline =
            input.Stream
                .Where(c, Func<_, _>(fun x -> x % 2 = 0))
                .Select(c, Func<_, _>(fun x -> x * 10))
                .Distinct(c)
        let out = c.Output pipeline
        input.Send (ZSet.ofSeq [ 2, 3L; 4, 5L; 1, 1L ])
        do! c.StepAsync()
        // Even values → 2, 4; mapped → 20, 40; distinct collapses weights.
        out.Current.Count |> should equal 2
        out.Current.[20] |> should equal 1L
        out.Current.[40] |> should equal 1L
    }


[<Fact>]
let ``Stream.Count returns scalar cardinality`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let total = input.Stream.Count c
        let out = c.Output total
        input.Send (ZSet.ofKeys [ 1; 2; 3; 4; 5 ])
        do! c.StepAsync()
        out.Current |> should equal 5L
    }


[<Fact>]
let ``Stream.Union adds two streams`` () =
    task {
        let c = Circuit.create ()
        let a = c.ZSetInput<int>()
        let b = c.ZSetInput<int>()
        let u = a.Stream.Union(c, b.Stream)
        let out = c.Output u
        a.Send (ZSet.ofKeys [ 1; 2 ])
        b.Send (ZSet.ofKeys [ 3; 4 ])
        do! c.StepAsync()
        out.Current.Count |> should equal 4
    }


[<Fact>]
let ``Stream.Except subtracts`` () =
    task {
        let c = Circuit.create ()
        let a = c.ZSetInput<int>()
        let b = c.ZSetInput<int>()
        let diff = a.Stream.Except(c, b.Stream)
        let out = c.Output diff
        a.Send (ZSet.ofKeys [ 1; 2; 3 ])
        b.Send (ZSet.ofKeys [ 2 ])
        do! c.StepAsync()
        // With retractions, weights = {1: +1, 2: 0, 3: +1}.
        out.Current.[1] |> should equal 1L
        out.Current.[2] |> should equal 0L
        out.Current.[3] |> should equal 1L
    }


// ═══════════════════════════════════════════════════════════════════
// DSL — circuit { } computation expression (moved from CoverageBoostTests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``DSL circuit CE builds a trivial circuit`` () =
    let build : CircuitM<OutputHandle<ZSet<int>>> =
        Dsl.circuit {
            let! input = Dsl.zsetInput<int>
            let! doubled = input.Stream |> Dsl.map (fun x -> x * 2)
            return! doubled |> Dsl.output
        }
    let c = Circuit.create ()
    let handle = build.Invoke c
    handle |> should not' (be null)
    c.OperatorCount |> should be (greaterThan 0)


[<Fact>]
let ``DSL circuit CE supports filter + distinct + count`` () =
    let build =
        Dsl.circuit {
            let! input = Dsl.zsetInput<int>
            let! filtered = input.Stream |> Dsl.filter (fun x -> x > 0)
            let! distinct = filtered |> Dsl.distinct
            let! count = distinct |> Dsl.scalarCount
            return! count |> Dsl.output
        }
    let c = Circuit.create ()
    let _ = build.Invoke c
    c.OperatorCount |> should be (greaterThan 2)


[<Fact>]
let ``DSL Fn struct round-trips`` () =
    let f = Fn.Of(fun (x: int) -> x * 2)
    f.Invoke 5 |> should equal 10


// ─── DSL additional combinators (moved from CoverageTests2) ─────

[<Fact>]
let ``DSL combinators: integrate, differentiate, distinct, delay, minus, plus`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        // Exercise every Dsl.* combinator to cover them.
        let mapped = Dsl.map (fun x -> x + 1) input.Stream
        let filtered = Dsl.filter (fun x -> x > 0) input.Stream
        let dist = Dsl.distinct input.Stream
        let integ = Dsl.integrate input.Stream
        let diff = Dsl.differentiate input.Stream
        let delayed = Dsl.delay input.Stream
        let neg = (fun (stream: Stream<ZSet<int>>) -> CircuitM(fun circ -> circ.Negate stream))
        let sum = Dsl.plus input.Stream input.Stream
        let diffd = Dsl.minus input.Stream input.Stream

        // Run each via CircuitM.Invoke.
        mapped.Invoke c |> ignore
        filtered.Invoke c |> ignore
        dist.Invoke c |> ignore
        integ.Invoke c |> ignore
        diff.Invoke c |> ignore
        delayed.Invoke c |> ignore
        sum.Invoke c |> ignore
        diffd.Invoke c |> ignore
        let _ = neg input.Stream
        c.Build()
        do! c.StepAsync()
    }


[<Fact>]
let ``Fn<'A,'B> op_Implicit and Of`` () =
    let fromFunc : Fn<int, int> = Fn.Of(fun x -> x + 1)
    let fromDelegate : Fn<int, int> = Fn.op_Implicit(Func<_, _>(fun x -> x * 2))
    fromFunc.Invoke 5 |> should equal 6
    fromDelegate.Invoke 5 |> should equal 10
