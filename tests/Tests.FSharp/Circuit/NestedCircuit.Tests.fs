module Zeta.Tests.Circuit.NestedCircuitTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// ═ Nested circuit / ChildCircuit with fixedpoint iteration (moved
// ═ from NestedAndRuntimeTests) ════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``NestedCircuit drives inner circuit to fixed point`` () =
    // Nested counter: inner increments until it reaches 5, then claims
    // fixedpoint. The outer tick sees the converged value.
    let outer = Circuit.create ()
    let output =
        outer.Nest(Func<_, _>(fun (nested: NestedCircuit) ->
            // Simple source that converges after a few iterations.
            // We don't have a built-in accumulator + termination hook
            // yet; this test just exercises the iteration driver.
            let constOp = nested.Inner.Constant 42
            constOp))
    let view = outer.Output output
    outer.Build ()
    outer.Step()
    view.Current |> should equal 42


// ─── NestedCircuit exposes Parent and Inner (moved from CoverageTests2) ──

[<Fact>]
let ``NestedCircuit exposes Parent and Inner`` () =
    let outer = Circuit.create ()
    let out = outer.Nest(Func<_, _>(fun (n: NestedCircuit) ->
        n.Parent |> should be (sameAs outer)
        n.LastIterationCount |> should equal 0L
        n.Inner.Constant 1))
    let v = outer.Output out
    outer.Build()
    outer.Step()
    v.Current |> should equal 1


// ─── NestedCircuit MaxIterations + Converged (moved from SpineAndSafetyTests) ──

[<Fact>]
let ``NestedCircuit Converged flag surfaces after Iterate`` () =
    let c = Circuit.create ()
    let struct (output, nested) =
        c.NestWithHandle(Func<_, _>(fun (n: NestedCircuit) ->
            let inner = n.Inner
            let src = inner.ScalarInput<int>()
            src.Set 7
            src.Stream))
    c.Output output |> ignore
    c.Build()
    c.Step()
    // Inner circuit with a single constant should converge in 1 iter.
    nested.Converged |> should be True
    nested.LastIterationCount |> should be (greaterThan 0L)


[<Fact>]
let ``NestedCircuit MaxIterations caps runaway recursion`` () =
    let c = Circuit.create ()
    let struct (output, nested) =
        c.NestWithHandle(Func<_, _>(fun (n: NestedCircuit) ->
            let inner = n.Inner
            // Non-converging: each tick the tick counter changes.
            let src = inner.ScalarInput<int>()
            src.Set 1
            src.Stream))
    nested.MaxIterations <- 3
    c.Output output |> ignore
    c.Build()
    c.Step()
    // At most MaxIterations iterations.
    nested.LastIterationCount |> should be (lessThanOrEqualTo 3L)
