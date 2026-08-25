module Zeta.Tests.Circuit.PlanCostModelTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// THE FALSIFIERS FOR THE ACCESS-PATH CHOICE
//
// Zeta has two physical join algorithms:
//   `ZSet.join`        — HASH join      (Dictionary over `b`, probe with `a`)
//   `IndexedZSet.join` — SORT-MERGE join (one merge walk over key-sorted runs)
//
// Before this file, `Plan.fs` gave them the IDENTICAL cost formula and
// `EstimatedCpuNanos` was a function of row counts alone, so
// `cost(join) ≡ cost(indexedJoin)` for every possible input. A planner
// consulting that model could never prefer one — which is precisely the
// choice Selinger et al. (SIGMOD 1979) exists to make.
//
// Every test here is written to go RED under a specific mutation. The
// mutants each kills are named in its comment.
//
// Register: `unmetered`. These tests pin the model's STRUCTURE (which
// operator is cheaper, and why). They cannot and do not claim the
// nanosecond weights are right — no benchmark has been run against them.
// ═══════════════════════════════════════════════════════════════════


// ─── The cost functions, tested directly ────────────────────────────

[<Fact>]
let ``hash join and sort-merge join have genuinely different cost functions`` () =
    // The headline defect: for identical inputs the two costs must not coincide.
    // MUTANT KILLED: making `hashJoinNanos` and `sortMergeJoinNanos` the same
    // expression again (the pre-repair state), in either direction.
    let left, right, out = 1000L, 1000L, 1000L
    let hash = Plan.hashJoinNanos right left out
    let merge = Plan.sortMergeJoinNanos true true left right out
    hash |> should not' (equal merge)


[<Fact>]
let ``sort-merge over already-ordered inputs beats a hash join`` () =
    // A materialised interesting order is the whole reason to keep an `IndexedZSet`.
    // MUTANT KILLED: `sortNanos` returning a non-zero cost for an ordered input
    // (i.e. deleting the `if alreadyOrdered then 0L` clause).
    let left, right, out = 4096L, 4096L, 4096L
    let hash = Plan.hashJoinNanos right left out
    let mergeOrdered = Plan.sortMergeJoinNanos true true left right out
    mergeOrdered |> should be (lessThan hash)


[<Fact>]
let ``sort-merge over unordered inputs loses to a hash join at scale`` () =
    // The choice has to be able to go BOTH ways, or the model has merely swapped one
    // unconditional preference for another.
    // MUTANT KILLED: `sortNanos` ignoring its `alreadyOrdered` argument and always
    // returning 0 — which would make sort-merge unconditionally cheapest.
    let left, right, out = 65536L, 65536L, 65536L
    let hash = Plan.hashJoinNanos right left out
    let mergeUnordered = Plan.sortMergeJoinNanos false false left right out
    mergeUnordered |> should be (greaterThan hash)


[<Fact>]
let ``an already-carried order is priced at exactly zero`` () =
    // MUTANT KILLED: any non-zero sort charge on an ordered input.
    Plan.sortNanos true 1_000_000L |> should equal 0L
    // …and the unordered case must be strictly positive, or the zero above is vacuous.
    Plan.sortNanos false 1_000_000L |> should be (greaterThan 0L)


[<Fact>]
let ``hash join cost is sensitive to WHICH side is the build side`` () =
    // A hash join over (build=10, probe=10000) is not the same job as (build=10000,
    // probe=10). A cost model that cannot see the difference cannot advise a swap.
    // MUTANT KILLED: setting `HashBuildNanosPerRow = HashProbeNanosPerRow`, which
    // would make the function symmetric in its first two arguments.
    let smallBuild = Plan.hashJoinNanos 10L 10_000L 100L
    let largeBuild = Plan.hashJoinNanos 10_000L 10L 100L
    largeBuild |> should be (greaterThan smallBuild)


[<Fact>]
let ``sort-merge join cost is symmetric in its two inputs`` () =
    // A merge walk has no build side — it advances two cursors. The asymmetry above is
    // a property of the hash join specifically, not of joins in general.
    // MUTANT KILLED: introducing a spurious side-dependent term into the merge cost.
    let a = Plan.sortMergeJoinNanos true true 10L 10_000L 100L
    let b = Plan.sortMergeJoinNanos true true 10_000L 10L 100L
    a |> should equal b


[<Fact>]
let ``log2Levels computes ceil log2 exactly`` () =
    // The sort term is `n * ceil(log2 n)`; an off-by-one here silently rescales every
    // sort in the model.
    // MUTANT KILLED: `n - 1L` → `n` (which would give 11 for 1024), or `<= 1L` → `< 1L`.
    Plan.log2Levels 1L |> should equal 0L
    Plan.log2Levels 2L |> should equal 1L
    Plan.log2Levels 3L |> should equal 2L
    Plan.log2Levels 1024L |> should equal 10L
    Plan.log2Levels 1025L |> should equal 11L


// ─── The defect verbatim: same inputs, two operators, two costs ──────

/// An input estimate with chosen physical properties, for driving `estimateOp` directly.
let private inputCost (rows: int64) (ordered: bool) : OpCost =
    { EstimatedRows = rows
      EstimatedDistinctKeys = rows
      EstimatedCpuNanos = 0L
      DeliversKeyOrder = ordered
      StatisticsSource = StatSource.Measured }


[<Fact>]
let ``join and indexedJoin cost differently on IDENTICAL inputs`` () =
    // THE headline falsifier, and it has to be written at this level.
    //
    // The measured defect was `cost(join) == cost(indexedJoin)` for EVERY possible
    // input — a statement about the two BRANCHES, quantified over inputs. Comparing
    // two circuits cannot falsify it: a `join` reads raw Z-sets (unordered) and an
    // `indexedJoin` reads `IndexedZSet`s (ordered), so a SHARED formula fed those
    // different physical properties still returns two different numbers and the
    // comparison passes. That is exactly what happened — the circuit-level test below
    // let the "restore the shared formula" mutant survive. Feeding both branches the
    // same `OpCost array` is the only thing that pins the claim the defect made.
    for ordered in [ true; false ] do
        for (a, b) in [ (1L, 1L); (1024L, 1024L); (10L, 100_000L); (100_000L, 10L) ] do
            let inputs = [| inputCost a ordered ; inputCost b ordered |]
            let hash = Plan.estimateOp "join" None inputs
            let merge = Plan.estimateOp "indexedJoin" None inputs
            // Same cardinality — they compute the same result, so the estimate must agree.
            hash.EstimatedRows |> should equal merge.EstimatedRows
            // Different cost — which is the entire point of the repair.
            hash.EstimatedCpuNanos |> should not' (equal merge.EstimatedCpuNanos)


[<Fact>]
let ``on already-ordered inputs sort-merge is ALWAYS strictly cheaper than hash`` () =
    // `60b + 30a + 40out` vs `10(a+b) + 40out` differs by `50b + 20a > 0` for all
    // a, b >= 1 — so this holds for every input, not just the ones sampled.
    // MUTANT KILLED: any change making the two branches share a formula, and any
    // change that stops the merge branch from consulting `DeliversKeyOrder`.
    for (a, b) in [ (1L, 1L); (7L, 3L); (1024L, 1024L); (10L, 100_000L); (100_000L, 10L) ] do
        let inputs = [| inputCost a true ; inputCost b true |]
        let hash = Plan.estimateOp "join" None inputs
        let merge = Plan.estimateOp "indexedJoin" None inputs
        merge.EstimatedCpuNanos |> should be (lessThan hash.EstimatedCpuNanos)


[<Fact>]
let ``on unordered inputs the preference INVERTS at scale`` () =
    // If sort-merge won unconditionally the model would have swapped one unconditional
    // preference for another, which is not a choice.
    // MUTANT KILLED: `sortNanos` always returning 0.
    let inputs = [| inputCost 100_000L false ; inputCost 100_000L false |]
    let hash = Plan.estimateOp "join" None inputs
    let merge = Plan.estimateOp "indexedJoin" None inputs
    merge.EstimatedCpuNanos |> should be (greaterThan hash.EstimatedCpuNanos)


// ─── The choice, observed through a real circuit ─────────────────────

[<Fact>]
let ``the planner can now PREFER indexedJoin over join on the same inputs`` () =
    // Two circuits computing the same join two different ways. Before the repair these
    // came out identical; the planner had no preference it could express.
    //
    // HONEST LIMIT, measured: this test does NOT kill the "restore the shared formula"
    // mutant — the two circuits' inputs differ in physical properties (raw Z-sets vs
    // `IndexedZSet`s), so a shared formula still returns two different numbers here.
    // `join and indexedJoin cost differently on IDENTICAL inputs` above is that
    // falsifier. What this test does kill is `indexWith` not being charged for its
    // sort, and `sortNanos` ignoring the order flag.
    let hashCircuit = Circuit.create ()
    let ha = hashCircuit.ZSetInput<int>()
    let hb = hashCircuit.ZSetInput<int>()
    let hj =
        hashCircuit.Join(ha.Stream, hb.Stream,
                         Func<_, _>(fun (x: int) -> x % 10),
                         Func<_, _>(fun (y: int) -> y % 10),
                         Func<_, _, _>(fun x y -> (x, y)))
    hashCircuit.Output hj |> ignore
    let hashCosts = hashCircuit.Costs()

    let mergeCircuit = Circuit.create ()
    let ma = mergeCircuit.ZSetInput<int>()
    let mb = mergeCircuit.ZSetInput<int>()
    let ia = mergeCircuit.IndexWith(ma.Stream, Func<_, _>(fun x -> x % 10), Func<_, _>(fun x -> x))
    let ib = mergeCircuit.IndexWith(mb.Stream, Func<_, _>(fun x -> x % 10), Func<_, _>(fun x -> x))
    let mj = mergeCircuit.IndexedJoin(ia, ib, Func<_, _, _, _>(fun k a b -> (k, a, b)))
    mergeCircuit.Output mj |> ignore
    let mergeCosts = mergeCircuit.Costs()

    let hashJoinNanos = hashCosts.[hj.Op.Id].EstimatedCpuNanos
    let mergeJoinNanos = mergeCosts.[mj.Op.Id].EstimatedCpuNanos

    // Same cardinality estimate — the two circuits compute the same thing.
    hashCosts.[hj.Op.Id].EstimatedRows |> should equal mergeCosts.[mj.Op.Id].EstimatedRows
    // Different cost. This single assertion is what the whole repair exists to make true.
    hashJoinNanos |> should not' (equal mergeJoinNanos)
    // And at the JOIN operator alone the merge wins, because its inputs arrive ordered.
    mergeJoinNanos |> should be (lessThan hashJoinNanos)


[<Fact>]
let ``the interesting order is paid for at indexWith, not given away free`` () =
    // The merge join above is cheap because someone else already paid. If `indexWith`
    // were free too, the model would be describing a free lunch.
    // MUTANT KILLED: `indexWith` falling back to the flat default per-row charge.
    let c = Circuit.create ()
    let a = c.ZSetInput<int>()
    let b = c.ZSetInput<int>()
    let ia = c.IndexWith(a.Stream, Func<_, _>(fun x -> x % 10), Func<_, _>(fun x -> x))
    let ib = c.IndexWith(b.Stream, Func<_, _>(fun x -> x % 10), Func<_, _>(fun x -> x))
    let j = c.IndexedJoin(ia, ib, Func<_, _, _, _>(fun k x y -> (k, x, y)))
    c.Output j |> ignore
    let costs = c.Costs()

    let indexNanos = costs.[ia.Op.Id].EstimatedCpuNanos + costs.[ib.Op.Id].EstimatedCpuNanos
    let mergeNanos = costs.[j.Op.Id].EstimatedCpuNanos

    // Indexing costs strictly more than the merge it enables — one sort, amortised over
    // however many joins reuse the index.
    indexNanos |> should be (greaterThan mergeNanos)

    // The whole pipeline (index both sides, then merge) is NOT cheaper than the hash
    // join for a single use. That is the honest answer: an index pays off on reuse.
    let hashEquivalent =
        Plan.hashJoinNanos
            costs.[b.Stream.Op.Id].EstimatedRows
            costs.[a.Stream.Op.Id].EstimatedRows
            costs.[j.Op.Id].EstimatedRows
    (indexNanos + mergeNanos) |> should be (greaterThan hashEquivalent)


[<Fact>]
let ``key order propagates through order-preserving operators and dies at map`` () =
    // MUTANT KILLED: `filter` dropping `DeliversKeyOrder`, or `map` claiming it.
    let c = Circuit.create ()
    let a = c.ZSetInput<int>()
    let ia = c.IndexWith(a.Stream, Func<_, _>(fun x -> x % 10), Func<_, _>(fun x -> x))
    c.Output ia |> ignore
    let costs = c.Costs()
    costs.[a.Stream.Op.Id].DeliversKeyOrder |> should equal false
    costs.[ia.Op.Id].DeliversKeyOrder |> should equal true

    let c2 = Circuit.create ()
    let b = c2.ZSetInput<int>()
    let f = c2.Filter(b.Stream, Func<_, _>(fun x -> x > 0))
    let m = c2.Map(f, Func<_, _>(fun x -> x * 2))
    c2.Output m |> ignore
    let costs2 = c2.Costs()
    // `filter` preserves whatever order it was handed (here: none).
    costs2.[f.Op.Id].DeliversKeyOrder |> should equal costs2.[b.Stream.Op.Id].DeliversKeyOrder
    // `map` may rewrite the key, so it never delivers key order.
    costs2.[m.Op.Id].DeliversKeyOrder |> should equal false


// ─── Catalog statistics: the formula now has something to be a formula OVER ───

[<Fact>]
let ``absent statistics degrade to a NAMED fallback, and say so`` () =
    // "An unmeasured quantity must never look like a measured one."
    // MUTANT KILLED: labelling a defaulted estimate `Measured`.
    let c = Circuit.create ()
    let i = c.ZSetInput<int>()
    c.Output i.Stream |> ignore
    let costs = Plan.compute c
    let cost = costs.[i.Stream.Op.Id]
    cost.EstimatedRows |> should equal Plan.DefaultSourceRows
    cost.StatisticsSource |> should equal StatSource.DefaultNoStatistic
    // And the explain text carries the label, so a human reading a plan can see it.
    c.Explain() |> should haveSubstring "stats=default"


[<Fact>]
let ``measured statistics replace the fallback and are labelled measured`` () =
    // MUTANT KILLED: `computeWith` ignoring its statistics argument.
    let c = Circuit.create ()
    let a = c.ZSetInput<int>()
    let b = c.ZSetInput<int>()
    let j =
        c.Join(a.Stream, b.Stream,
               Func<_, _>(fun (x: int) -> x % 10),
               Func<_, _>(fun (y: int) -> y % 10),
               Func<_, _, _>(fun x y -> (x, y)))
    c.Output j |> ignore
    c.Build()

    let statsFor (opId: int) : SourceStatistics option =
        if opId = a.Stream.Op.Id then
            Some { RowCount = Some(CatalogStatistics.measured 500L)
                   DistinctKeys = Some(CatalogStatistics.measured 10L) }
        elif opId = b.Stream.Op.Id then
            Some { RowCount = Some(CatalogStatistics.measured 200L)
                   DistinctKeys = Some(CatalogStatistics.measured 10L) }
        else
            None

    let costs = Plan.computeWith statsFor c
    costs.[a.Stream.Op.Id].EstimatedRows |> should equal 500L
    costs.[a.Stream.Op.Id].EstimatedDistinctKeys |> should equal 10L
    costs.[a.Stream.Op.Id].StatisticsSource |> should equal StatSource.Measured

    // Selinger: 500 * 200 / max(10, 10) = 10_000. The old model, which substituted row
    // counts for distinct values, would say 500 * 200 / 500 = 200 — a 50x difference,
    // and the reason substituting rows for NDV is a `toy` and not a cost model.
    costs.[j.Op.Id].EstimatedRows |> should equal 10_000L
    costs.[j.Op.Id].StatisticsSource |> should equal StatSource.Measured


[<Fact>]
let ``a formula over a default IS a default — provenance propagates weakest-wins`` () =
    // MUTANT KILLED: `weaker` returning the stronger of the two, or `estimateOp` seeding
    // the fold with `DefaultNoStatistic` and never weakening.
    let c = Circuit.create ()
    let a = c.ZSetInput<int>()
    let b = c.ZSetInput<int>()
    let j =
        c.Join(a.Stream, b.Stream,
               Func<_, _>(fun (x: int) -> x % 10),
               Func<_, _>(fun (y: int) -> y % 10),
               Func<_, _, _>(fun x y -> (x, y)))
    c.Output j |> ignore
    c.Build()

    // Only ONE side has statistics.
    let statsFor (opId: int) : SourceStatistics option =
        if opId = a.Stream.Op.Id then
            Some { RowCount = Some(CatalogStatistics.measured 500L)
                   DistinctKeys = Some(CatalogStatistics.measured 10L) }
        else
            None

    let costs = Plan.computeWith statsFor c
    costs.[a.Stream.Op.Id].StatisticsSource |> should equal StatSource.Measured
    costs.[b.Stream.Op.Id].StatisticsSource |> should equal StatSource.DefaultNoStatistic
    // The join derives from both, so it is only as good as its worst input.
    costs.[j.Op.Id].StatisticsSource |> should equal StatSource.DefaultNoStatistic


[<Fact>]
let ``an upper-bound statistic is never presented as measured`` () =
    // The HLL guard, made mechanical: a distinct-value estimate that is not
    // retraction-safe stays labelled all the way to the plan.
    // MUTANT KILLED: `rank`/`weaker` collapsing UpperBound into Measured.
    CatalogStatistics.weaker StatSource.Measured StatSource.UpperBoundNotRetractionSafe
    |> should equal StatSource.UpperBoundNotRetractionSafe

    CatalogStatistics.weaker StatSource.UpperBoundNotRetractionSafe StatSource.DefaultNoStatistic
    |> should equal StatSource.DefaultNoStatistic

    let c = Circuit.create ()
    let a = c.ZSetInput<int>()
    c.Output a.Stream |> ignore
    c.Build()

    let statsFor (opId: int) : SourceStatistics option =
        if opId = a.Stream.Op.Id then
            Some { RowCount = Some(CatalogStatistics.measured 500L)
                   DistinctKeys = Some(CatalogStatistics.upperBound 10L) }
        else
            None

    let costs = Plan.computeWith statsFor c
    costs.[a.Stream.Op.Id].StatisticsSource
    |> should equal StatSource.UpperBoundNotRetractionSafe
    c.Costs(Func<int, SourceStatistics option> statsFor).[a.Stream.Op.Id].StatisticsSource
    |> should equal StatSource.UpperBoundNotRetractionSafe


[<Fact>]
let ``statistics round-trip through the catalog table, and absence survives the trip`` () =
    // MUTANT KILLED: `readStats` returning zeroes instead of `None` for absent
    // statistics — which would turn "we do not know" into "we measured zero".
    let stats =
        CatalogStatistics.emptyTable
        |> CatalogStatistics.withRowCount (CatalogStatistics.measured 4200L)
        |> CatalogStatistics.withDistinctValues "customer_id" (CatalogStatistics.measured 97L)
        |> CatalogStatistics.withDistinctValues "region" (CatalogStatistics.upperBound 5L)

    let table = Catalog.evolveStats "orders" stats Map.empty
    let read = Catalog.readStats "orders" table

    read.RowCount |> should equal (Some(CatalogStatistics.measured 4200L))
    read.DistinctValues.["customer_id"] |> should equal (CatalogStatistics.measured 97L)
    // The upper bound comes back labelled an upper bound, not promoted.
    read.DistinctValues.["region"] |> should equal (CatalogStatistics.upperBound 5L)

    // A relation we hold nothing for reads back as nothing — not as zeroes.
    let unknown = Catalog.readStats "shipments" table
    unknown.RowCount |> should equal None
    unknown.DistinctValues |> should be Empty

    // Idempotent (#6): recording the same statistics again is a no-op on the table.
    Catalog.evolveStats "orders" stats table |> should equal table


[<Fact>]
let ``evolving the schema does not disturb the statistics satellite`` () =
    // Schema and statistics change at completely different rates (DV2.0 #5), so the
    // schema's `ensure` must not retract statistics rows.
    // MUTANT KILLED: widening `ensure`'s retract filter to all catalog-prefixed rows.
    let withStats =
        Map.empty
        |> Catalog.evolveStats "orders"
            (CatalogStatistics.emptyTable
             |> CatalogStatistics.withRowCount (CatalogStatistics.measured 4200L))

    let evolved = Catalog.evolve [ "orders", [ "id", "int" ] ] withStats
    (Catalog.readStats "orders" evolved).RowCount
    |> should equal (Some(CatalogStatistics.measured 4200L))

    // …and dropping the table from the schema still leaves the statistics addressable,
    // because they are a separate lifecycle, not a cascade.
    let dropped = Catalog.evolve [] evolved
    (Catalog.readStats "orders" dropped).RowCount
    |> should equal (Some(CatalogStatistics.measured 4200L))


[<Fact>]
let ``a statistics row with unreadable provenance degrades DOWNWARD`` () =
    // A number whose provenance we cannot parse is not a number we may call measured.
    // MUTANT KILLED: `tokenToSource` defaulting to `Measured`.
    let table : TableStream.Table =
        Map.ofList [ "stat:rows:orders", DynamicValue.Int 4200L ]

    let read = Catalog.readStats "orders" table
    read.RowCount
    |> should equal (Some { Value = 4200L; Source = StatSource.UpperBoundNotRetractionSafe })
