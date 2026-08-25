module Zeta.Tests.Circuit.PlanTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// Plan.fs cost estimator + explain (moved from CoverageTests /
// CoverageBoostTests / NestedAndRuntimeTests / Round8Tests)
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``Plan.compute returns costs for every op`` () =
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    let _ = c.Output(c.Map(input.Stream, Func<_, _>(fun x -> x + 1)))
    let costs = Plan.compute c
    costs.Count |> should be (greaterThanOrEqualTo 2)
    for cost in costs.Values do
        cost.EstimatedRows |> should be (greaterThanOrEqualTo 1L)


[<Fact>]
let ``Plan.compute produces a cost per operator`` () =
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    let doubled = c.Map(input.Stream, Func<_, _>(fun x -> x * 2))
    c.Output doubled |> ignore
    let costs = Plan.compute c
    // "a cost per operator" — one entry per op, none missing.
    costs.Count |> should equal c.OperatorCount


[<Fact>]
let ``Circuit.Explain produces a non-empty string`` () =
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    let doubled = c.Map(input.Stream, Func<_, _>(fun x -> x * 2))
    c.Output doubled |> ignore
    let text = c.Explain()
    text |> should not' (equal "")
    text.Contains "Circuit" |> should be True


[<Fact>]
let ``Circuit.Costs exposes the cost dictionary`` () =
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    c.Output input.Stream |> ignore
    let costs = c.Costs()
    costs.Count |> should equal c.OperatorCount


// ─── Plan / Explain branch coverage (moved from Round8Tests) ──────

[<Fact>]
let ``Plan estimates every operator kind`` () =
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    let filtered = c.Filter(input.Stream, Func<_, _>(fun x -> x > 0))
    let mapped = c.Map(filtered, Func<_, _>(fun x -> x * 2))
    let integ = c.IntegrateZSet mapped
    let diff = c.DifferentiateZSet integ
    let cnt = c.ScalarCount diff
    c.Output cnt |> ignore
    c.Build()
    let costs = Plan.compute c
    // "every operator kind" — every op in the chain got an estimate, and the chain's
    // cardinalities follow the per-kind formulas rather than being copied through.
    costs.Count |> should equal c.OperatorCount
    costs.[filtered.Op.Id].EstimatedRows |> should equal (costs.[input.Stream.Op.Id].EstimatedRows / 2L)
    costs.[mapped.Op.Id].EstimatedRows |> should equal costs.[filtered.Op.Id].EstimatedRows
    costs.[integ.Op.Id].EstimatedRows |> should equal (costs.[mapped.Op.Id].EstimatedRows * 2L)
    costs.[diff.Op.Id].EstimatedRows |> should equal costs.[integ.Op.Id].EstimatedRows
    costs.[cnt.Op.Id].EstimatedRows |> should equal 1L
    let explain = c.Explain()
    explain.Contains "scalarCount" |> should be True


// ─── Plan.Explain (moved from NestedAndRuntimeTests) ──────

[<Fact>]
let ``Plan.Explain emits a plan tree with per-operator cost estimates`` () =
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    let mapped = c.Map(input.Stream, Func<_, _>(fun x -> x * 2))
    let filtered = c.Filter(mapped, Func<_, _>(fun x -> x > 0))
    let _ = c.Output filtered
    let explain = c.Explain()
    explain |> should haveSubstring "map"
    explain |> should haveSubstring "filter"
    explain |> should haveSubstring "rows≈"
    explain |> should haveSubstring "ndv≈"
    explain |> should haveSubstring "ns≈"


[<Fact>]
let ``Plan.Costs propagates cardinality through filter (50% default selectivity)`` () =
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    let filtered = c.Filter(input.Stream, Func<_, _>(fun x -> x > 0))
    let _ = c.Output filtered
    let costs = c.Costs()
    let inputCost = costs.[input.Stream.Op.Id]
    let filterCost = costs.[filtered.Op.Id]
    filterCost.EstimatedRows |> should equal (inputCost.EstimatedRows / 2L)
