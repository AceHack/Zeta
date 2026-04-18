module Zeta.Tests.Circuit.CircuitTests
#nowarn "0893"

open System
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


[<Fact>]
let ``empty circuit steps to tick 1`` () =
    task {
        let c = Circuit.create ()
        c.Tick |> should equal 0L
        do! c.StepAsync()
        c.Tick |> should equal 1L
    }

[<Fact>]
let ``input flows to output via identity`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let out = c.Output input.Stream
        input.Send(ZSet.singleton 1 1L)
        do! c.StepAsync()
        out.Current.[1] |> should equal 1L
    }

[<Fact>]
let ``map applies function per tick`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let mapped = c.Map(input.Stream, Func<int, int>(fun x -> x * 2))
        let out = c.Output mapped
        input.Send(ZSet.ofKeys [ 1; 2; 3 ])
        do! c.StepAsync()
        out.Current.[2] |> should equal 1L
        out.Current.[4] |> should equal 1L
        out.Current.[6] |> should equal 1L
        out.Current.[1] |> should equal 0L
    }

[<Fact>]
let ``filter keeps matching entries`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let filtered = c.Filter(input.Stream, Func<int, bool>(fun x -> x % 2 = 0))
        let out = c.Output filtered
        input.Send(ZSet.ofKeys [ 1; 2; 3; 4 ])
        do! c.StepAsync()
        out.Current.[1] |> should equal 0L
        out.Current.[2] |> should equal 1L
        out.Current.[4] |> should equal 1L
    }

[<Fact>]
let ``delay shifts values by one tick`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let delayed = c.DelayZSet input.Stream
        let out = c.Output delayed
        input.Send(ZSet.singleton 1 1L)
        do! c.StepAsync()
        out.Current.IsEmpty |> should be True
        do! c.StepAsync()
        out.Current.[1] |> should equal 1L
    }

[<Fact>]
let ``integrate computes running sum`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let integrated = c.IntegrateZSet input.Stream
        let out = c.Output integrated
        input.Send(ZSet.singleton 1 1L)
        do! c.StepAsync()
        out.Current.[1] |> should equal 1L
        input.Send(ZSet.singleton 1 1L)
        do! c.StepAsync()
        out.Current.[1] |> should equal 2L
        input.Send(ZSet.singleton 2 1L)
        do! c.StepAsync()
        out.Current.[1] |> should equal 2L
        out.Current.[2] |> should equal 1L
    }

[<Fact>]
let ``integrate then differentiate is identity`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let roundTripped = c.DifferentiateZSet(c.IntegrateZSet input.Stream)
        let out = c.Output roundTripped

        input.Send(ZSet.singleton 1 1L)
        do! c.StepAsync()
        out.Current.[1] |> should equal 1L

        input.Send(ZSet.singleton 2 3L)
        do! c.StepAsync()
        out.Current.[2] |> should equal 3L
    }

[<Fact>]
let ``plus adds two input streams`` () =
    task {
        let c = Circuit.create ()
        let a = c.ZSetInput<int>()
        let b = c.ZSetInput<int>()
        let summed = c.Plus(a.Stream, b.Stream)
        let out = c.Output summed
        a.Send(ZSet.singleton 1 1L)
        b.Send(ZSet.singleton 1 1L)
        do! c.StepAsync()
        out.Current.[1] |> should equal 2L
    }

[<Fact>]
let ``distinct collapses multiplicities`` () =
    task {
        let c = Circuit.create ()
        let a = c.ZSetInput<int>()
        let d = c.Distinct a.Stream
        let out = c.Output d
        a.Send(ZSet.ofSeq [ 1, 3L ; 2, 1L ; 3, -1L ])
        do! c.StepAsync()
        out.Current.[1] |> should equal 1L
        out.Current.[2] |> should equal 1L
        out.Current.[3] |> should equal 0L
    }

[<Fact>]
let ``cycle through z^-1 is schedulable`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let integrated = c.IntegrateZSet input.Stream
        let delayed = c.DelayZSet integrated
        let out = c.Output delayed
        input.Send(ZSet.singleton 1 1L)
        do! c.StepAsync()
        out.Current.IsEmpty |> should be True
        do! c.StepAsync()
        out.Current.[1] |> should equal 1L
    }


// ─── Circuit APIs (moved from CoverageTests) ──────────────────────────────────────────────

[<Fact>]
let ``Circuit StepMany advances multiple ticks sync`` () =
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    let _ = c.Output input.Stream
    c.StepMany 5
    c.Tick |> should equal 5L


[<Fact>]
let ``Circuit StepManyAsync advances multiple ticks`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let _ = c.Output input.Stream
        do! c.StepManyAsync 3
        c.Tick |> should equal 3L
    }


[<Fact>]
let ``Circuit step module helpers`` () =
    task {
        let c = Circuit.create ()
        Circuit.build c
        do! Circuit.step c
        Circuit.stepSync c
        do! Circuit.stepMany 2 c
        Circuit.stepManySync 2 c
        c.Tick |> should equal 6L
    }


[<Fact>]
let ``Adding operators after Build throws`` () =
    let c = Circuit.create ()
    let _ = c.ZSetInput<int>()
    c.Build()
    let act = fun () -> c.ZSetInput<int>() |> ignore
    act |> should throw typeof<InvalidOperationException>


// ─── Primitive-op helpers ──────────────────────────────────────────

[<Fact>]
let ``Integrate with custom zero and add`` () =
    task {
        let c = Circuit.create ()
        let input = c.ScalarInput<int>()
        let sum = c.Integrate(input.Stream, 0, Func<_, _, _>(fun a b -> a + b))
        let out = c.Output sum
        input.Set 5
        do! c.StepAsync()
        out.Current |> should equal 5
        input.Set 3
        do! c.StepAsync()
        out.Current |> should equal 8
    }


[<Fact>]
let ``Differentiate scalar with sub`` () =
    task {
        let c = Circuit.create ()
        let input = c.ScalarInput<int>()
        let diff = c.Differentiate(input.Stream, 0, Func<_, _, _>(fun a b -> a - b))
        let out = c.Output diff
        input.Set 10
        do! c.StepAsync()
        out.Current |> should equal 10
        input.Set 15
        do! c.StepAsync()
        out.Current |> should equal 5
    }


// ─── Incrementalization helpers ────────────────────────────────────

[<Fact>]
let ``Incrementalize generic`` () =
    task {
        let c = Circuit.create ()
        let input = c.ScalarInput<int>()
        let q = Func<Stream<int>, Stream<int>>(fun s -> s)
        let inc = c.Incrementalize(0, Func<_, _, _>(fun a b -> a + b), Func<_, _, _>(fun a b -> a - b), q, input.Stream)
        let out = c.Output inc
        input.Set 5
        do! c.StepAsync()
        out.Current |> should equal 5
    }


// ─── Handles: Scalar + Channel ─────────────────────────────────────

[<Fact>]
let ``ScalarInputHandle.Set and read`` () =
    task {
        let c = Circuit.create ()
        let input = c.ScalarInput<int>()
        let out = c.Output input.Stream
        input.Set 42
        do! c.StepAsync()
        out.Current |> should equal 42
    }


[<Fact>]
let ``ChannelZSetInputHandle.SendAsync and TryWrite`` () =
    task {
        let c = Circuit.create ()
        let input = c.ChannelZSetInput<int>(16)
        let out = c.Output input.Stream
        do! input.SendAsync(ZSet.singleton 1 1L)
        let _ = input.TryWrite(ZSet.singleton 2 1L)
        do! c.StepAsync()
        out.Current.[1] |> should equal 1L
        out.Current.[2] |> should equal 1L
        input.Complete()
    }


// ─── Circuit.Ops enumeration ─────────────────────────────────────────

[<Fact>]
let ``Circuit.Ops enumerates registered operators`` () =
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    let _ = c.Output(c.Map(input.Stream, Func<_, _>(fun x -> x + 1)))
    let ops = c.Ops |> Seq.toList
    ops |> List.length |> should be (greaterThan 0)


// ─── Stream.Current returns tick output (moved from CoverageTests2) ──────

[<Fact>]
let ``Stream.Current returns tick output`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let out = c.Output input.Stream
        input.Send(ZSet.singleton 1 1L)
        do! c.StepAsync()
        out.Current.[1] |> should equal 1L
        out.Stream.Current.[1] |> should equal 1L
    }


// ─── Circuit HasAsyncOps (moved from Round8Tests) ──────

[<Fact>]
let ``Circuit.HasAsyncOps false for all-sync pipeline`` () =
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    let doubled = c.Map(input.Stream, Func<_, _>(fun x -> x * 2))
    c.Output doubled |> ignore
    c.HasAsyncOps |> should be False


// ─── Circuit ToDot (moved from AdvancedTests) ───────────────────────

[<Fact>]
let ``Circuit ToDot emits a GraphViz digraph`` () =
    let c = Circuit.create ()
    let input = c.ZSetInput<int> ()
    let doubled = c.Map(input.Stream, Func<_, _>(fun x -> x * 2))
    let _ = c.Output doubled
    let dot = c.ToDot()
    dot |> should haveSubstring "digraph DbspCircuit"
    dot |> should haveSubstring "map"
    dot |> should haveSubstring "input"


// ─── Recursive.Converged flag (moved from SpineAndSafetyTests) ──────

[<Fact>]
let ``IterateToFixedPointWithConvergence reports convergence`` () =
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    // Constant integrator reaches fixed point once input stops changing.
    let mapped = c.Map(input.Stream, Func<_, _>(fun x -> x + 1))
    c.Output mapped |> ignore
    input.Send (ZSet.ofKeys [ 1; 2; 3 ])
    let struct (iters, converged) = c.IterateToFixedPointWithConvergence(mapped, 10)
    converged |> should be True
    iters |> should be (lessThanOrEqualTo 10)
