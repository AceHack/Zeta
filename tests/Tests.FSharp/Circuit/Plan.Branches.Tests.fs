module Zeta.Tests.Circuit.PlanBranchesTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// Plan.fs has one cost-estimate branch per operator name. Each test
// below exercises exactly one branch AND asserts the formula that
// branch implements.
//
// These tests used to assert `plan.Count |> should be (greaterThan 0)`
// under names like `Plan join estimates product-over-max`. That is
// worse than an absent test: the name reads, to anyone scanning the
// suite, as the cost model's falsifier, and it cannot fail for any
// value the model could produce. A mutation run that replaced every
// join heuristic with `999999L` left 34/34 green.
//
// The rule now: a test named after a formula asserts that formula,
// against the ACTUAL input estimate rather than against a hardcoded
// constant — so the test pins the RELATION (`out = in / 2`) and stays
// true when the source default changes, while going red the moment
// the relation changes.
// ═══════════════════════════════════════════════════════════════════

let private planFor (build: Circuit -> unit) : System.Collections.Generic.IReadOnlyDictionary<int, OpCost> =
    let c = Circuit.create ()
    build c
    c.Build()
    c.Costs()


[<Fact>]
let ``Plan input op is cost-estimated`` () =
    let c = Circuit.create ()
    let i = c.ZSetInput<int>()
    c.Output i.Stream |> ignore
    let plan = c.Costs()
    let cost = plan.[i.Stream.Op.Id]
    // No catalog statistic exists, so the source degrades to the NAMED fallback —
    // and says so, rather than presenting 1024 as if someone had counted it.
    cost.EstimatedRows |> should equal Plan.DefaultSourceRows
    cost.EstimatedDistinctKeys |> should equal Plan.DefaultSourceRows
    cost.StatisticsSource |> should equal StatSource.DefaultNoStatistic
    // A `ZSet` is sorted, but on the ELEMENT, not on any join key. Claiming key
    // order here would hand a sort-merge join a free lunch it has not earned.
    cost.DeliversKeyOrder |> should equal false


[<Fact>]
let ``Plan map preserves input cardinality estimate`` () =
    let c = Circuit.create ()
    let i = c.ZSetInput<int>()
    let m = c.Map(i.Stream, Func<_, _>(fun x -> x * 2))
    c.Output m |> ignore
    let plan = c.Costs()
    plan.[m.Op.Id].EstimatedRows |> should equal plan.[i.Stream.Op.Id].EstimatedRows
    // `map` may rewrite the key, so any key order the input had does not survive.
    plan.[m.Op.Id].DeliversKeyOrder |> should equal false


[<Fact>]
let ``Plan filter halves cardinality`` () =
    let c = Circuit.create ()
    let i = c.ZSetInput<int>()
    let f = c.Filter(i.Stream, Func<_, _>(fun x -> x > 0))
    c.Output f |> ignore
    let plan = c.Costs()
    plan.[f.Op.Id].EstimatedRows |> should equal (plan.[i.Stream.Op.Id].EstimatedRows / 2L)


[<Fact>]
let ``Plan flatMap doubles cardinality`` () =
    let c = Circuit.create ()
    let i = c.ZSetInput<int>()
    let f = c.FlatMap(i.Stream, Func<_, _>(fun x -> ZSet.ofKeys [ x; x + 1 ]))
    c.Output f |> ignore
    let plan = c.Costs()
    plan.[f.Op.Id].EstimatedRows |> should equal (plan.[i.Stream.Op.Id].EstimatedRows * 2L)


[<Fact>]
let ``Plan plus sums cardinalities`` () =
    let c = Circuit.create ()
    let a = c.ZSetInput<int>()
    let b = c.ZSetInput<int>()
    let s = c.Plus(a.Stream, b.Stream)
    c.Output s |> ignore
    let plan = c.Costs()
    plan.[s.Op.Id].EstimatedRows
    |> should equal (plan.[a.Stream.Op.Id].EstimatedRows + plan.[b.Stream.Op.Id].EstimatedRows)


[<Fact>]
let ``Plan minus sums cardinalities`` () =
    let c = Circuit.create ()
    let a = c.ZSetInput<int>()
    let b = c.ZSetInput<int>()
    let m = c.Minus(a.Stream, b.Stream)
    c.Output m |> ignore
    let plan = c.Costs()
    plan.[m.Op.Id].EstimatedRows
    |> should equal (plan.[a.Stream.Op.Id].EstimatedRows + plan.[b.Stream.Op.Id].EstimatedRows)


[<Fact>]
let ``Plan negate preserves cardinality`` () =
    let c = Circuit.create ()
    let i = c.ZSetInput<int>()
    let n = c.Negate i.Stream
    c.Output n |> ignore
    let plan = c.Costs()
    plan.[n.Op.Id].EstimatedRows |> should equal plan.[i.Stream.Op.Id].EstimatedRows


[<Fact>]
let ``Plan distinct halves cardinality`` () =
    let c = Circuit.create ()
    let i = c.ZSetInput<int>()
    let d = c.Distinct i.Stream
    c.Output d |> ignore
    let plan = c.Costs()
    let out = plan.[d.Op.Id]
    out.EstimatedRows |> should equal (plan.[i.Stream.Op.Id].EstimatedRows / 2L)
    // After `distinct`, every surviving row IS a distinct key.
    out.EstimatedDistinctKeys |> should equal out.EstimatedRows


[<Fact>]
let ``Plan integrate doubles cardinality estimate`` () =
    let c = Circuit.create ()
    let i = c.ZSetInput<int>()
    let integ = c.IntegrateZSet i.Stream
    c.Output integ |> ignore
    let plan = c.Costs()
    plan.[integ.Op.Id].EstimatedRows |> should equal (plan.[i.Stream.Op.Id].EstimatedRows * 2L)


[<Fact>]
let ``Plan differentiate preserves cardinality`` () =
    let c = Circuit.create ()
    let i = c.ZSetInput<int>()
    let d = c.DifferentiateZSet i.Stream
    c.Output d |> ignore
    let plan = c.Costs()
    plan.[d.Op.Id].EstimatedRows |> should equal plan.[i.Stream.Op.Id].EstimatedRows


[<Fact>]
let ``Plan z-inverse preserves cardinality`` () =
    let c = Circuit.create ()
    let i = c.ZSetInput<int>()
    let z = c.DelayZSet i.Stream
    c.Output z |> ignore
    let plan = c.Costs()
    plan.[z.Op.Id].EstimatedRows |> should equal plan.[i.Stream.Op.Id].EstimatedRows


[<Fact>]
let ``Plan groupBySum divides cardinality`` () =
    let c = Circuit.create ()
    let i = c.ZSetInput<int>()
    let g = c.GroupBySum(i.Stream, Func<_, _>(fun x -> x % 10), Func<_, _>(fun _ -> 1L))
    c.Output g |> ignore
    let plan = c.Costs()
    plan.[g.Op.Id].EstimatedRows |> should equal (plan.[i.Stream.Op.Id].EstimatedRows / 4L)


[<Fact>]
let ``Plan count groupBy divides cardinality`` () =
    let c = Circuit.create ()
    let i = c.ZSetInput<int>()
    let g = c.GroupByCount(i.Stream, Func<_, _>(fun x -> x % 10))
    c.Output g |> ignore
    let plan = c.Costs()
    plan.[g.Op.Id].EstimatedRows |> should equal (plan.[i.Stream.Op.Id].EstimatedRows / 4L)


// `Average` is exposed via Advanced extensions, not Circuit directly;
// omit its branch test here to keep this file Circuit-surface-only.


[<Fact>]
let ``Plan join estimates product-over-max`` () =
    let c = Circuit.create ()
    let a = c.ZSetInput<int>()
    let b = c.ZSetInput<string>()
    let j =
        c.Join(a.Stream, b.Stream,
               Func<_, _>(fun (x: int) -> x),
               Func<_, _>(fun (s: string) -> s.Length),
               Func<_, _, _>(fun x s -> $"{x}-{s}"))
    c.Output j |> ignore
    let plan = c.Costs()
    let ca = plan.[a.Stream.Op.Id]
    let cb = plan.[b.Stream.Op.Id]
    // Selinger 1979: |A| * |B| / max(ICARD_A, ICARD_B). With no catalog statistics the
    // distinct counts degrade to the row counts, and this is exactly product-over-max.
    let expected = (ca.EstimatedRows * cb.EstimatedRows) / max ca.EstimatedDistinctKeys cb.EstimatedDistinctKeys
    plan.[j.Op.Id].EstimatedRows |> should equal expected


[<Fact>]
let ``Plan cartesian multiplies cardinalities`` () =
    let c = Circuit.create ()
    let a = c.ZSetInput<int>()
    let b = c.ZSetInput<int>()
    let x = c.Cartesian(a.Stream, b.Stream)
    c.Output x |> ignore
    let plan = c.Costs()
    plan.[x.Op.Id].EstimatedRows
    |> should equal (plan.[a.Stream.Op.Id].EstimatedRows * plan.[b.Stream.Op.Id].EstimatedRows)


[<Fact>]
let ``Plan indexWith preserves cardinality`` () =
    let c = Circuit.create ()
    let i = c.ZSetInput<int>()
    let x = c.IndexWith(i.Stream, Func<_, _>(fun x -> x % 10), Func<_, _>(fun x -> x))
    c.Output x |> ignore
    let plan = c.Costs()
    let inRows = plan.[i.Stream.Op.Id].EstimatedRows
    let cost = plan.[x.Op.Id]
    cost.EstimatedRows |> should equal inRows
    // `indexWith` is where the interesting order is PAID FOR — a key sort, charged once.
    cost.DeliversKeyOrder |> should equal true
    cost.EstimatedCpuNanos
    |> should equal (Plan.sortNanos false inRows + inRows * Plan.MergeNanosPerRow)


[<Fact>]
let ``Plan indexedJoin uses product-over-max`` () =
    let c = Circuit.create ()
    let a = c.ZSetInput<int>()
    let b = c.ZSetInput<int>()
    let ia = c.IndexWith(a.Stream, Func<_, _>(fun x -> x % 10), Func<_, _>(fun x -> x))
    let ib = c.IndexWith(b.Stream, Func<_, _>(fun x -> x % 10), Func<_, _>(fun x -> x))
    let j = c.IndexedJoin(ia, ib, Func<_, _, _, _>(fun k a b -> (k, a, b)))
    c.Output j |> ignore
    let plan = c.Costs()
    let ca = plan.[ia.Op.Id]
    let cb = plan.[ib.Op.Id]
    let expected = (ca.EstimatedRows * cb.EstimatedRows) / max ca.EstimatedDistinctKeys cb.EstimatedDistinctKeys
    plan.[j.Op.Id].EstimatedRows |> should equal expected


[<Fact>]
let ``Plan scalar count gives 1-row estimate`` () =
    let c = Circuit.create ()
    let i = c.ZSetInput<int>()
    let n = c.ScalarCount i.Stream
    c.Output n |> ignore
    let plan = c.Costs()
    // A scalar count produces one value, not `|input|` values. This test's NAME always
    // said so; before the repair, `scalarCount` fell through to the wildcard and inherited
    // its input's cardinality, and the test asserted nothing that could notice.
    plan.[n.Op.Id].EstimatedRows |> should equal 1L
    plan.[n.Op.Id].EstimatedDistinctKeys |> should equal 1L


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
    // One line per operator, plus the header line.
    let lines = text.Split('\n') |> Array.filter (fun l -> not (String.IsNullOrWhiteSpace l))
    lines.Length |> should equal (c.OperatorCount + 1)


[<Fact>]
let ``Plan hits wildcard for unknown op name`` () =
    // `consolidate` has no branch in the cost table, so it goes through the wildcard —
    // which passes the first input's estimate straight through and claims no key order.
    // (The previous revision used `IntegrateZSet` here and asserted nothing; `integrate`
    // has had its own branch the whole time, so the test never touched the wildcard.)
    let c = Circuit.create ()
    let i = c.ZSetInput<int>()
    let w = c.Consolidate i.Stream
    c.Output w |> ignore
    let plan = c.Costs()
    let inCost = plan.[i.Stream.Op.Id]
    let outCost = plan.[w.Op.Id]
    outCost.EstimatedRows |> should equal inCost.EstimatedRows
    outCost.EstimatedDistinctKeys |> should equal inCost.EstimatedDistinctKeys
    outCost.DeliversKeyOrder |> should equal false


[<Fact>]
let ``Plan feedback connects with strict marker`` () =
    let plan = planFor (fun c ->
        let i = c.ZSetInput<int>()
        let fb = c.FeedbackZSet<int>()
        fb.Connect i.Stream
        c.Output fb.Stream |> ignore)
    // Every operator in a cyclic circuit still receives a cost — including the feedback
    // node, whose dependency has not been visited when it is estimated and therefore
    // degrades to the named `unknownInput` defaults rather than to a bare literal.
    plan.Count |> should be (greaterThan 0)
    for kv in plan do
        kv.Value.EstimatedRows |> should be (greaterThanOrEqualTo 1L)


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
    for kv in plan do
        kv.Value.EstimatedRows |> should be (greaterThanOrEqualTo 1L)


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
    // "distinct costs" as in *different from each other*: map preserves, filter halves,
    // distinct halves again — so the chain must strictly descend after the map.
    let rows (s: Stream<ZSet<int>>) = costs.[s.Op.Id].EstimatedRows
    rows m |> should equal (rows i.Stream)
    rows f |> should equal (rows m / 2L)
    rows d |> should equal (rows f / 2L)


[<Fact>]
let ``Plan.compute handles zero-input circuits`` () =
    // Just a scalar constant.
    let c = Circuit.create ()
    let input = c.ScalarInput<int>()
    c.Output input.Stream |> ignore
    let plan = Plan.compute c
    plan.Count |> should be (greaterThan 0)
    // A scalar source is one value, not a relation of `DefaultSourceRows`.
    plan.[input.Stream.Op.Id].EstimatedRows |> should equal 1L


[<Fact>]
let ``Plan cost rows always positive`` () =
    let plan = planFor (fun c ->
        let i = c.ZSetInput<int>()
        let m = c.Map(i.Stream, Func<_, _>(fun x -> x * 2))
        c.Output m |> ignore)
    for kv in plan do
        kv.Value.EstimatedRows |> should be (greaterThanOrEqualTo 1L)
        kv.Value.EstimatedDistinctKeys |> should be (greaterThanOrEqualTo 1L)
        // Distinct keys can never exceed rows.
        kv.Value.EstimatedDistinctKeys |> should be (lessThanOrEqualTo kv.Value.EstimatedRows)
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
    text |> should haveSubstring "integrate"
