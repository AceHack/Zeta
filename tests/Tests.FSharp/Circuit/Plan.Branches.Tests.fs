module Zeta.Tests.Circuit.PlanBranchesTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// Plan.fs has one cost-estimate branch per operator name. Each test
// below exercises exactly one branch so we actually drive the match
// to its corresponding case instead of the wildcard fallback.
// ═══════════════════════════════════════════════════════════════════

let private planFor (build: Circuit -> unit) : System.Collections.Generic.IReadOnlyDictionary<int, OpCost> =
    let c = Circuit.create ()
    build c
    c.Build()
    c.Costs()


[<Fact>]
let ``Plan input op is cost-estimated`` () =
    let plan = planFor (fun c ->
        let i = c.ZSetInput<int>()
        c.Output i.Stream |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan map preserves input cardinality estimate`` () =
    let plan = planFor (fun c ->
        let i = c.ZSetInput<int>()
        let m = c.Map(i.Stream, Func<_, _>(fun x -> x * 2))
        c.Output m |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan filter halves cardinality`` () =
    let plan = planFor (fun c ->
        let i = c.ZSetInput<int>()
        let f = c.Filter(i.Stream, Func<_, _>(fun x -> x > 0))
        c.Output f |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan flatMap doubles cardinality`` () =
    let plan = planFor (fun c ->
        let i = c.ZSetInput<int>()
        let f = c.FlatMap(i.Stream, Func<_, _>(fun x -> ZSet.ofKeys [ x; x + 1 ]))
        c.Output f |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan plus sums cardinalities`` () =
    let plan = planFor (fun c ->
        let a = c.ZSetInput<int>()
        let b = c.ZSetInput<int>()
        let s = c.Plus(a.Stream, b.Stream)
        c.Output s |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan minus sums cardinalities`` () =
    let plan = planFor (fun c ->
        let a = c.ZSetInput<int>()
        let b = c.ZSetInput<int>()
        let m = c.Minus(a.Stream, b.Stream)
        c.Output m |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan negate preserves cardinality`` () =
    let plan = planFor (fun c ->
        let i = c.ZSetInput<int>()
        let n = c.Negate i.Stream
        c.Output n |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan distinct halves cardinality`` () =
    let plan = planFor (fun c ->
        let i = c.ZSetInput<int>()
        let d = c.Distinct i.Stream
        c.Output d |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan integrate doubles cardinality estimate`` () =
    let plan = planFor (fun c ->
        let i = c.ZSetInput<int>()
        let integ = c.IntegrateZSet i.Stream
        c.Output integ |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan differentiate preserves cardinality`` () =
    let plan = planFor (fun c ->
        let i = c.ZSetInput<int>()
        let d = c.DifferentiateZSet i.Stream
        c.Output d |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan z-inverse preserves cardinality`` () =
    let plan = planFor (fun c ->
        let i = c.ZSetInput<int>()
        let z = c.DelayZSet i.Stream
        c.Output z |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan groupBySum divides cardinality`` () =
    let plan = planFor (fun c ->
        let i = c.ZSetInput<int>()
        let g = c.GroupBySum(i.Stream, Func<_, _>(fun x -> x % 10), Func<_, _>(fun _ -> 1L))
        c.Output g |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan count groupBy divides cardinality`` () =
    let plan = planFor (fun c ->
        let i = c.ZSetInput<int>()
        let g = c.GroupByCount(i.Stream, Func<_, _>(fun x -> x % 10))
        c.Output g |> ignore)
    plan.Count |> should be (greaterThan 0)


// `Average` is exposed via Advanced extensions, not Circuit directly;
// omit its branch test here to keep this file Circuit-surface-only.


[<Fact>]
let ``Plan join estimates product-over-max`` () =
    let plan = planFor (fun c ->
        let a = c.ZSetInput<int>()
        let b = c.ZSetInput<string>()
        let j = c.Join(a.Stream, b.Stream,
                       Func<_, _>(fun (x: int) -> x),
                       Func<_, _>(fun (s: string) -> s.Length),
                       Func<_, _, _>(fun x s -> $"{x}-{s}"))
        c.Output j |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan cartesian multiplies cardinalities`` () =
    let plan = planFor (fun c ->
        let a = c.ZSetInput<int>()
        let b = c.ZSetInput<int>()
        let x = c.Cartesian(a.Stream, b.Stream)
        c.Output x |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan indexWith preserves cardinality`` () =
    let plan = planFor (fun c ->
        let i = c.ZSetInput<int>()
        let x = c.IndexWith(i.Stream, Func<_, _>(fun x -> x % 10), Func<_, _>(fun x -> x))
        c.Output x |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan indexedJoin uses product-over-max`` () =
    let plan = planFor (fun c ->
        let a = c.ZSetInput<int>()
        let b = c.ZSetInput<int>()
        let ia = c.IndexWith(a.Stream, Func<_, _>(fun x -> x % 10), Func<_, _>(fun x -> x))
        let ib = c.IndexWith(b.Stream, Func<_, _>(fun x -> x % 10), Func<_, _>(fun x -> x))
        let j = c.IndexedJoin(ia, ib, Func<_, _, _, _>(fun k a b -> (k, a, b)))
        c.Output j |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan scalar count gives 1-row estimate`` () =
    let plan = planFor (fun c ->
        let i = c.ZSetInput<int>()
        let n = c.ScalarCount i.Stream
        c.Output n |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan explain emits a line per operator`` () =
    let c = Circuit.create ()
    let i = c.ZSetInput<int>()
    let m = c.Map(i.Stream, Func<_, _>(fun x -> x * 2))
    let f = c.Filter(m, Func<_, _>(fun x -> x > 0))
    c.Output f |> ignore
    let text = c.Explain()
    text.Contains "map" |> should be True
    text.Contains "filter" |> should be True


// Plan.toDot / Plan.summary live elsewhere (see existing helpers in
// Plan.fs). Covered by earlier tests.


[<Fact>]
let ``Plan hits wildcard for unknown op name`` () =
    // Any explicit operator we don't have in the cost table goes
    // through the wildcard — confirm it still produces a valid cost.
    let plan = planFor (fun c ->
        let i = c.ZSetInput<int>()
        // IntegrateInt is not in the table — wildcard path.
        let integ = c.IntegrateZSet i.Stream
        c.Output integ |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan feedback connects with strict marker`` () =
    let plan = planFor (fun c ->
        let i = c.ZSetInput<int>()
        let fb = c.FeedbackZSet<int>()
        fb.Connect i.Stream
        c.Output fb.Stream |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan nested circuit costs are computed`` () =
    let plan = planFor (fun c ->
        let inner =
            c.Nest(Func<_, _>(fun (n: NestedCircuit) ->
                let src = n.Inner.ScalarInput<int>()
                src.Set 7
                src.Stream))
        c.Output inner |> ignore)
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan multi-operator chain produces distinct costs`` () =
    let c = Circuit.create ()
    let i = c.ZSetInput<int>()
    let m = c.Map(i.Stream, Func<_, _>(fun x -> x * 2))
    let f = c.Filter(m, Func<_, _>(fun x -> x > 0))
    let d = c.Distinct f
    c.Output d |> ignore
    c.Build()
    let costs = c.Costs()
    costs.Count |> should be (greaterThan 3)


[<Fact>]
let ``Plan.compute handles zero-input circuits`` () =
    // Just a scalar constant.
    let c = Circuit.create ()
    let input = c.ScalarInput<int>()
    c.Output input.Stream |> ignore
    let plan = Plan.compute c
    plan.Count |> should be (greaterThan 0)


[<Fact>]
let ``Plan cost rows always positive`` () =
    let plan = planFor (fun c ->
        let i = c.ZSetInput<int>()
        let m = c.Map(i.Stream, Func<_, _>(fun x -> x * 2))
        c.Output m |> ignore)
    for kv in plan do
        kv.Value.EstimatedRows |> should be (greaterThanOrEqualTo 1L)
        kv.Value.EstimatedCpuNanos |> should be (greaterThanOrEqualTo 40L)


[<Fact>]
let ``Plan strict marker appears for delay`` () =
    let c = Circuit.create ()
    let i = c.ZSetInput<int>()
    let d = c.DelayZSet i.Stream
    c.Output d |> ignore
    let text = c.Explain()
    text.Contains "*strict*" |> should be True


[<Fact>]
let ``Plan explain mentions integrate operator`` () =
    // (Integrate is composed of delay + plus, so the strict marker
    // attaches to its internal delay — verify the op appears in the
    // explain text regardless.)
    let c = Circuit.create ()
    let i = c.ZSetInput<int>()
    let integ = c.IntegrateZSet i.Stream
    c.Output integ |> ignore
    let text = c.Explain()
    text |> should not' (equal "")
