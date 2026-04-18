module Zeta.Tests.Operators.DifferentiateTests
#nowarn "0893"

open System
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// Higher-order differentials (D², Dⁿ, Aitken Δ²)
// (moved from NewFeatureTests / CoverageBoostTests)
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``Differentiate2 computes second finite difference`` () =
    task {
        let c = Circuit.create ()
        let input = c.ScalarInput<int>()
        let d2 = c.Differentiate2(input.Stream, 0, Func<_, _, _>(fun a b -> a - b))
        let out = c.Output d2
        // Quadratic: x(t) = t² gives x = 0, 1, 4, 9, 16, 25 …
        // D¹(x)[t] = 2t - 1 → 1, 3, 5, 7, 9 …
        // D²(x)[t] = constant 2
        for t in 0 .. 5 do
            input.Set (t * t)
            do! c.StepAsync()
        // After five ticks we've seen t=0..4; D² should be 2.
        out.Current |> should equal 2
    }


[<Fact>]
let ``Differentiate2 of a linear stream is zero`` () =
    task {
        let c = Circuit.create ()
        let input = c.ScalarInput<int>()
        let d2 = c.Differentiate2(input.Stream, 0, Func<_, _, _>(fun a b -> a - b))
        let out = c.Output d2
        for t in 0 .. 4 do
            input.Set (3 * t)
            do! c.StepAsync()
        out.Current |> should equal 0
    }


[<Fact>]
let ``DifferentiateN rejects order < 1`` () =
    let c = Circuit.create ()
    let input = c.ScalarInput<int>()
    let act =
        fun () ->
            c.DifferentiateN(input.Stream, 0, Func<_, _, _>(fun a b -> a - b), 0)
            |> ignore
    act |> should throw typeof<ArgumentException>


[<Fact>]
let ``Differentiate2ZSet on Z-sets is empty for constant-delta streams`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let d2 = c.Differentiate2ZSet input.Stream
        let out = c.Output d2
        // Constant delta each tick: D¹ is the difference between consecutive
        // inputs (zero after warmup); D² is the difference of those, also zero.
        for _ in 1 .. 5 do
            input.Send(ZSet.singleton 1 1L)
            do! c.StepAsync()
        out.Current.IsEmpty |> should be True
    }


[<Fact>]
let ``AitkenAccelerate matches input when ΔΔ is zero`` () =
    task {
        let c = Circuit.create ()
        let input = c.ScalarInput<float>()
        let acc = c.AitkenAccelerate input.Stream
        let out = c.Output acc
        // Constant stream: Δ = 0, ΔΔ = 0 → fall-through returns x_n.
        for _ in 0 .. 3 do
            input.Set 42.0
            do! c.StepAsync()
        out.Current |> should equal 42.0
    }


[<Fact>]
let ``AitkenAccelerate converges a geometric sequence faster than naive`` () =
    task {
        // Iteration x_{n+1} = 0.5 * x_n + 1 converges to 2.0.
        // At x=1, 1.5, 1.75, 1.875, …; Δ² acceleration should predict 2.0
        // within one or two terms.
        let c = Circuit.create ()
        let input = c.ScalarInput<float>()
        let acc = c.AitkenAccelerate input.Stream
        let out = c.Output acc
        let mutable x = 1.0
        for _ in 1 .. 5 do
            x <- 0.5 * x + 1.0
            input.Set x
            do! c.StepAsync()
        // Accelerated value should be much closer to 2.0 than raw.
        abs (out.Current - 2.0) |> should be (lessThan 0.01)
    }


// ─── DifferentiateN / AitkenAccelerate (moved from CoverageBoostTests) ──

[<Fact>]
let ``DifferentiateN rejects order less than one`` () =
    let c = Circuit.create ()
    let input = c.ScalarInput<int>()
    (fun () ->
        c.DifferentiateN(input.Stream, 0, Func<int, int, int>(fun a b -> a - b), 0) |> ignore)
    |> should throw typeof<ArgumentException>


[<Fact>]
let ``DifferentiateN of order 2 matches Differentiate2`` () =
    task {
        let c = Circuit.create ()
        let input = c.ScalarInput<int>()
        let dN = c.DifferentiateN(input.Stream, 0, Func<int, int, int>(fun a b -> a - b), 2)
        let outN = c.Output dN
        // Quadratic x(t) = t² → D² = 2 constant after two ticks.
        for t in 0 .. 5 do
            input.Set (t * t)
            do! c.StepAsync()
        outN.Current |> should equal 2
    }


[<Fact>]
let ``AitkenAccelerate runs without crashing on converging sequence`` () =
    task {
        let c = Circuit.create ()
        let input = c.ScalarInput<float>()
        let aitken = c.AitkenAccelerate(input.Stream)
        let _ = c.Output aitken
        for x in [| 0.5; 0.75; 0.875; 0.9375; 0.96875 |] do
            input.Set x
            do! c.StepAsync()
    }
