# Query optimisation: the anchor lineage, and what vectorised / row / column / Arrow actually mean here

**Date:** 2026-08-25
**Measured against:** `origin/main` @ `6cec0e272` (worktree `~/zeta-wt-qopt`; `git rev-parse --short HEAD` == `git rev-parse --short origin/main`)
**Register:** everything described in Zeta is `unmetered` or `toy`. Nothing here promotes anything. §5 states the registers explicitly and what would earn a change.
**Origin:** Aaron, 2026-08-25 — *"i'm very interested in our query optimization work … we've not put much effort into query optimizations yet. this is exacting work."* Plus four specific asks: *"for query optimization we downloaded a bunch of databases like postgres mysql foundationdb tigerbeatle voltdb etc … this is where we were going to look at query plan options and try to be state of the art"*; *"if there are some latest reserch papers or even older research papers we can reference as human anchors even better, right now we have code anchors i would say"*; *"i want to make sure i can all be vectorized and we also have a row store and column store variant"*; *"our column store variant should play nice with apacha arrow serilization format."*

---

## 0. The short version

1. **The premise needs one correction, and it sharpens the task.** Aaron's recollection is that we have code anchors but not human anchors. We have **neither**. `references/prior-art/` is **8 KB, two files** (`.gitignore`, `README.md`); the 103 mirrors named in `references/reference-sources.json` — postgres, mysql, foundationdb, voltdb, duckdb, clickhouse, arrow among them — are **catalogued and not materialized** on this machine. `tools/setup/common/sync-prior-art.sh` would fill it. So the databases he remembers downloading are not on disk to read, and until this change the papers were not cited either. §1.

2. **Zeta has two physical join algorithms and a cost model that is provably incapable of choosing between them.** `ZSet.join` is a **hash join** (build a `Dictionary` over `b` with linked-list chaining, probe with `a`). `IndexedZSet.join` is a **sort-merge join** (both sides ordinal-sorted, single merge walk). In `Plan.fs` the operator names `"join"` and `"indexedJoin"` receive the **identical** formula `(a * b) / max 1L (max a b)`, and `EstimatedCpuNanos` is `max 40L rows * 40L` — a function of estimated rows **alone**, with no per-operator term. Therefore `cost(join) ≡ cost(indexedJoin)` for every input. Access-path selection is the thing Selinger 1979 exists to do, we have exactly the two access paths that motivated it, and the model cannot express a preference. §2.3.

3. **The `Plan` cost tests are named after formulas they do not assert.** `Plan join estimates product-over-max` (`tests/Tests.FSharp/Circuit/Plan.Branches.Tests.fs:146`) builds a join circuit and then asserts, in full: `plan.Count |> should be (greaterThan 0)` — the dictionary is non-empty. It never reads `EstimatedRows`. `Plan cartesian multiplies cardinalities`, `Plan indexedJoin uses product-over-max`, `Plan indexWith preserves cardinality` and `Plan scalar count gives 1-row estimate` are the same shape. This is why the mutation run recorded in the stage-two doc — every join heuristic replaced by `999999L`, 34/34 still green — comes out the way it does. The test *names* are a cost-model specification; the test *bodies* are a non-emptiness check. A reader grepping test names would conclude the model is pinned. §2.4.

4. **`SimdMerge.fs` contains no vector instructions.** Its header promises loading "4 (AVX2), 2 (NEON), or 8 (AVX-512) keys at a time … branchless compare + conditional select … masked stores." The body uses `Vector<int64>.Count` **only as a loop chunk size** and does the work in two scalar `while` loops. There is no `Vector.LessThan`, no `ConditionalSelect`, no masked store, and the `MemoryMarshal.Cast` named in the comment is never called. It also names, as its correctness evidence, a `FuzzTests` case called *"fuzz: SIMD merge matches scalar"*; **that test does not exist**. Both facts verified directly at `6cec0e272`. §2.5.

5. **The honest state of the four asks:** vectorised — `Simd.fs` (53 lines) is real but dead, `SimdMerge.fs` is SIMD in name only, and **nothing SIMD is wired into query execution**; row store — that is what we have, `ZSet` is an immutable sorted **array-of-structs** run of `(key, weight)` pairs; column store — **absent**, no columnar physical layout exists anywhere; Arrow — **built and genuine** (the official `Apache.Arrow` 23.0.0 library, not hand-rolled) but a fixed two-column schema, .NET-only, with **zero production callers**. §3.

6. **The literature answers three of the four asks well and the fourth only partly.** Vectorised-vs-compiled has a definitive controlled study (Kersten et al. 2018) whose answer is "neither dominates, and the split is cache-residency". Row-vs-column has a canonical survey (Abadi et al. 2013) whose central finding is that column *storage* without column *execution* buys little. Arrow is a versioned specification with a stability guarantee. But **nobody has published a cost model over DBSP circuits**, where the unit is a delta and `integrate`/`differentiate` make state size a first-class cost term. The nearest thing is Tempura (Alibaba, PVLDB 2020) — a Cascades-style cost-based optimizer for incremental processing over Calcite — which proves the architecture generalises without giving us the model. §4.6.

---

## 1. The anchor situation, measured

Aaron's framing — *"right now we have code anchors i would say"* — is the thing to correct first, because it changes what this work is for.

`references/prior-art/` is gitignored and, on this machine, empty:

```
$ du -sh references/prior-art/ && ls -a references/prior-art/
8.0K    references/prior-art/
.  ..  .gitignore  README.md
```

`references/reference-sources.json` is a 103-entry manifest that *names* `postgresql`, `mysql`, `foundationdb`, `voltdb`, `duckdb`, `clickhouse` and `arrow`. None are checked out. So the code anchors exist as a **shopping list**, not as readable source. That is not a defect — the directory is deliberately gitignored and multi-gigabyte, and `.claude/rules/` is emphatic that a naive recursive grep there is a two-hour runaway — but it does mean an agent told "go read how Postgres plans a join" finds nothing.

And `docs/PRIOR-ART-LIST.md` carried **no** cost-based-optimisation lineage. Measured with word-boundary `git grep -l -w` at `6cec0e272`, control term `Codd` = 31 files: `Kersten`, `Pedreira`, `Lohman` and `Tempura` at **0**; `Graefe` 5, `Volcano` 9, `Cascades` 10 — and inspection shows all of those are name-drops inside `.claude/skills/storage-and-query-engines/blueprints/`, carrying no author, year, venue or entailed claim. `query-planner.md:55` reads, in full, `Graefe *Volcano / Cascades* — the canonical cost-based framework`.

The naive count is badly misleading and worth recording as method: case-insensitive `Leis` matches **203** files, of which **5** are the researcher — the rest are `Kleisli`. `Cascades` scores 148 against 10, the difference being the substrate's own "cascade". Anchored counts throughout this document.

One correction to the brief that commissioned this work. It described the list's `Peter Selinger — "Potrace"` entry as a misattribution to be fixed. **It is not a misattribution.** Peter Selinger, the Dalhousie mathematician, wrote Potrace, and it is genuinely the named prior art for the capture pipeline's vector upgrade. The defect was that this was the list's *only* Selinger, so a lookup for the query-optimisation paper landed on raster tracing with no signal it was the wrong person. The repair applied is **disambiguation in place plus the missing Patricia G. Selinger entry** — deleting a correct citation to fix a lookup failure would have been the worse error.

**So: neither code anchors nor human anchors.** The human half is now supplied (`docs/PRIOR-ART-LIST.md`, new final section), and it is the half that survives an empty `references/` directory.

### Relationship to the doc that landed hours earlier

`docs/research/2026-08-25-rx-query-planner-joins-stage-2-two-stream-statistics.md` (PR #15184) is the statistics layer for `RxJoin` stage two. It overlaps this document deliberately and is **not** re-litigated here. It owns: the two-stream statistics set, decay families, the sketch repairs, the `HyperLogLog`-cannot-retract finding, the noninterference story for where numbers come from, and the `Plan.fs` mutation run. Its §3 *named* the missing query-optimisation lineage as Finding 1 and its §8.8 asked whether the repair was wanted as part of stage two. Aaron's brief here answers yes, and this change performs it.

What this document adds and that one does not cover at all: the optimiser-**architecture** lineage (Graefe), the 2025 re-measurement, learned optimisers assessed, and the entire vectorised / row / column / Arrow axis, which is a different question from statistics.

---

## 2. What exists — built, designed, absent

### 2.1 The planner surface

`src/Core/Plan.fs` is **97 lines**. It is not an optimiser and does not claim to be one; the accurate name for it is a **cost annotator**. `Plan.compute` does a single topological walk over the circuit the caller already built, attaching an `OpCost` to each operator. There is no plan enumeration, no alternative generation, no join reordering, no memo, no search of any kind. `Explain()` renders the annotation as `id: name (rows≈N, ns≈M) [inputs]`.

The estimates are a hardcoded match on the operator's `Name` string, verbatim:

```fsharp
| "input", _                    -> 1024L                        // unknown source
| "filter", [| n |]             -> n / 2L                       // assume 50% selectivity
| "distinct", [| n |]           -> n / 2L                       // assume 50% duplicates
| "join", [| a ; b |]           -> (a * b) / max 1L (max a b)   // primary-key assumption
| "cartesian", [| a ; b |]      -> a * b
| "indexedJoin", [| a ; b |]    -> (a * b) / max 1L (max a b)
| "groupBySum", [| n |]         -> n / 4L                       // assume avg group-by fan-in = 4
```

and the CPU term is `EstimatedCpuNanos = max 40L rows * 40L`.

### 2.2 The catalog holds no statistics

`src/Core/Catalog.fs` (117 lines) is a **schema** catalog, and a well-designed one: metadata is homoiconic to data, so the catalog is ordinary `TableStream` rows (`table:<name>` → exists, `column:<table>.<col>` → type), DDL collapses to an idempotent `ensure` that diffs desired against current and derives the `Upsert`/`Retract` meta-DML. That is a genuinely nice construction and it is orthogonal to optimisation.

What it does **not** hold is any statistic: no row counts, no distinct-value counts, no histograms, no index metadata, no null fractions. Selinger's architecture is a cost formula *over catalog statistics* — `NCARD` (relation cardinality), `TCARD` (pages), `ICARD` (index distinct keys), `NINDX`. Zeta's catalog supplies none of the four. This is why `Plan.fs` opens with `1024L` for an unknown source: there is nowhere to look the number up.

### 2.3 The finding that matters most: two access paths, one indistinguishable cost

Zeta ships **two genuinely different physical join algorithms**, and this appears not to have been noticed as an optimisation opportunity:

| operator `Name` | implementation | algorithm |
|---|---|---|
| `"join"` | `ZSet.join` (`src/Core/ZSet.fs:468`) | **hash join** — `Dictionary<'K,int>` over `b` with `nextIdx` linked-list chaining to avoid per-key `List<_>` allocation, then probe with `a` |
| `"indexedJoin"` | `IndexedZSet.join` (`src/Core/IndexedZSet.fs:327`) | **sort-merge join** — both sides are ordinal-sorted `KeyGroup` runs; a single `cmp.Compare` merge walk with per-key value-group cross product |

Both are registered as `IsBilinear = true`, and `IncrementalAuto` rewrites either into the DBSP three-term delta form `Δa ⋈ Δb + z⁻¹(I(a)) ⋈ Δb + Δa ⋈ z⁻¹(I(b))`. The incremental rewrite is real and built.

Now put that beside §2.1. Both names map to `(a * b) / max 1L (max a b)`, and the CPU term reads only `rows`. So for any inputs whatsoever:

> **`cost("join", a, b)` and `cost("indexedJoin", a, b)` are equal — in rows and in nanoseconds.**

The cost model cannot prefer the hash join or the merge join under any circumstance, because it assigns them the same number by construction. Three consequences follow, and they are the concrete content of "we have not put much effort into query optimisation yet":

- **Access-path selection is a no-op.** This is precisely the decision Selinger 1979 formalised, and it is unavailable.
- **The one place a merge join is unambiguously cheaper is invisible.** `IndexedZSet` is **sorted by construction**. A sort order that a later operator can consume for free is exactly Selinger's **interesting order** — the reason his DP keeps, at each subplan, both the cheapest plan *and* the cheapest plan per useful sort order. Zeta already *materialises* an interesting order and has no way to price it.
- **The formula is Selinger's with the wrong variable substituted.** His join estimate is `|A|·|B| / max(V(A,k), V(B,k))` where `V` is the count of **distinct** key values. `Plan.fs` substitutes **row counts** for `V`, which algebraically collapses `(a*b)/max(a,b)` to `min(a,b)` — a hardcoded primary-key/foreign-key assumption that cannot represent a many-to-many join at all. (This substitution was first recorded in the stage-two doc; repeated here because it is the same defect the access-path finding sits on.)

### 2.4 The cost tests assert non-emptiness, not cost

Checked directly rather than inherited. `tests/Tests.FSharp/Circuit/Plan.Tests.fs` holds 7 `[<Fact>]`s and `Plan.Branches.Tests.fs` holds 27, totalling the 34 the stage-two mutation run reported. Here is `Plan.Branches.Tests.fs:146` complete:

```fsharp
[<Fact>]
let ``Plan join estimates product-over-max`` () =
    let plan = planFor (fun c ->
        let a = c.ZSetInput<int>()
        let b = c.ZSetInput<string>()
        let j = c.Join(a.Stream, b.Stream, ...)
        c.Output j |> ignore)
    plan.Count |> should be (greaterThan 0)
```

The name states a cost formula. The body asserts that the returned dictionary has at least one entry. `EstimatedRows` is never read. `Plan cartesian multiplies cardinalities` (:159), `Plan indexWith preserves cardinality` (:169), `Plan indexedJoin uses product-over-max` (:178) and `Plan scalar count gives 1-row estimate` (:190) are byte-for-byte the same pattern.

This is the vacuity class in its cleanest form, and it is worse than an absent test: an absent test is visibly absent, whereas a test *named* `Plan join estimates product-over-max` reads, to anyone scanning the suite, as the cost model's falsifier. It is not one. It cannot fail for any value the estimator returns.

### 2.5 Vectorisation: one real-but-dead file, one SIMD-in-name-only file

- `src/Core/Simd.fs` (53 lines) is **genuine** — real `System.Numerics.Vector<int64>` / `Vector<int32>` accumulate loops with scalar fallback, exposing `Simd.Sum`, `Simd.IsAccelerated`, `Simd.VectorWidth`. It is referenced **nowhere in `src/`**, only from its own tests.
- `src/Core/SimdMerge.fs` (112 lines) is **not SIMD**. Grepping the file for `Vector.LessThan`, `ConditionalSelect`, `MemoryMarshal`, masked stores, `Avx`, `Sse`, or `AdvSimd` returns two hits, both in *comments*; the only live use of the SIMD API is `Vector<int64>.Count` as a loop chunk size and `Vector.IsHardwareAccelerated` as a guard. The merge front is two scalar `while` loops. Its stated correctness evidence — a `FuzzTests` case called *"fuzz: SIMD merge matches scalar"* — **does not exist** — `grep -rn "fuzz: SIMD merge" tests/` returns nothing.
- **Nothing SIMD reaches query execution.** `src/Core/MergeKernel.fs`, the shared merge kernel that `ZSet.(+)` actually calls, contains zero `Vector`/`Simd` references. `ZSet.weightedCount` has a comment promising `MemoryMarshal.Cast` + `TensorPrimitives.Sum`, followed by the body conceding *"we can't safely use MemoryMarshal.Cast"* and doing a 4-way-unrolled **scalar** loop.
- **No benchmark measures any of it.** The 2–4× speedup claims in the headers of both `Simd.fs` and `SimdMerge.fs` are unmeasured assertions; `bench/Benchmarks/` contains no SIMD-vs-scalar comparison.

### 2.6 Row store: that is what we have

The physical representation of a relation is an immutable, ascending-key-sorted **array-of-structs** run:

```fsharp
[<Struct; IsReadOnly; NoComparison>]
type ZEntry<'K> = val Key: 'K; val Weight: Weight

type ZSet<'K when 'K : comparison> =
    val internal entries: ImmutableArray<ZEntry<'K>>
```

Key and weight are adjacent per row — the textbook AoS row layout, and `ZSet.fs:298` calls it "the AoS entry array" in as many words. `Bag`, `WSet`, `WeightedSet` share the shape; `IndexedZSet` adds a Patricia trie; `TableStream.Table` is literally `Map<string, DynamicValue>`. On disk, `Spine`/`BalancedSpine`/`DiskSpine` implement an LSM **merge scheduler** over Z-set batches — not an LSM storage *format*: no SSTable, no block or page layout, no per-SST bloom.

A caution worth recording: `src/Core/IndexFormat.fs` (43 lines) names `index.btree`, `index.hash`, `index.bloom`, `index.minhash`, `index.zset` and looks like an index catalogue. Each is an **8-byte glyph for board visualisation** (`btree = [|0x10;0x28;0x44;0xAA;...|] // the fanning tree`). There is no index implementation behind any of those names.

### 2.7 Column store: absent. Arrow: built, thin, and unused

Grepping `columnar|ColumnStore|RowStore|column chunk|struct-of-arrays|RecordBatch` across all `.fs`/`.cs` returns six files, **all six of which are the Arrow serializers**. Columnarity exists in Zeta strictly as a *wire format* and never as an in-memory or on-disk layout.

`src/Core/ArrowSerializer.fs` (166 lines) is **real Arrow, not a hand-rolled lookalike**: it opens `Apache.Arrow` / `Apache.Arrow.Ipc` / `Apache.Arrow.Types` against `Apache.Arrow` 23.0.0 (`Directory.Packages.props:49`), so the FlatBuffers Schema/RecordBatch encoding, the `0xFFFFFFFF` continuation marker, 8-byte alignment and validity bitmaps all come from upstream. Zeta adds a 4-byte little-endian outer length header. Two sealed serializers, `arrow-ipc-int64` and `arrow-ipc-string`, over a **fixed two-column schema** (`key`, `weight`), built row-by-row with `Int64Array.Builder()` and then copied again via `ms.ToArray()`. No dictionary encoding, no compression, no nested types, no nullability, no zero-copy, no Flight.

Three limits worth stating plainly:

- **Zero production callers.** Both serializers are instantiated only in `tests/Tests.FSharp/Storage/ArrowSerializer.Tests.fs`. No tier-selection path in `src/Core/Serializer.fs` reaches them; `DiskSpine.fs:83` says outright that *"production deployments would use Apache Arrow / Parquet"* — meaning this one does not.
- **The one Arrow golden-vector file is not for this serializer, and its cross-check is vacuous by its own admission.** `src/Core.TypeScript/dynamic-value/golden-vectors-arrow.json` locks the `DynamicValue` shredded-node-table codec, and its header states that F# and C# *"both use the .NET Apache.Arrow lib and emit BYTE-IDENTICAL IPC."* Two consumers of one library agreeing is not a cross-implementation lock; it is the same measurement taken twice. Under the repo's own N-version discipline that is agreement between correlated implementations, which is not evidence.
- **No other oracle has Arrow.** Nothing in `Core.Rust.*`, `Core.TypeScript`, `Core.Go` or `Core.Python`. The TS `dynamic-value/` directory ships `cbor.ts`, `msgpack.ts`, `xml.ts`, `yaml.ts`, `json.ts` — and no `arrow.ts`, though it hosts the golden-vector file that only .NET reads.

### 2.8 SQL frontend

`docs/research/zeta-sql-frontend-dsl-design.md` (216 lines) is **design-only** and answers the planner question explicitly in §5: *"By compiling the AST to a static physical operator graph at initialization time, we bypass the need for runtime query parsing."* The words "cost", "cardinality", "statistics" and "optimizer" do not appear. In code, `src/Core/ZetaSqlBuilder.fs` (65 lines) compiles a `zeta { }` computation expression but is **not incremental** — its `join` does `Seq.groupBy |> Map.ofSeq` then a nested loop over a materialised `ZSet`, never touching `Circuit`. `src/Core/Query.fs` (88 lines) is a LINQ-shaped naming veneer forwarding to `Circuit` operators. There is no SQL parser, no relational-algebra AST, no `LogicalPlan`/`PhysicalPlan` split, no rewrite rules, and no binder.

**This matters for §8.2 of the stage-two doc**, which flagged a live conflict: the rules argue for adaptive routing while `Plan.fs` and the SQL design both assume plan-once. The conflict is real but **cheaper to resolve than it looks**, because the static-plan commitment lives in a 216-line design document and a 65-line builder that is off the `Circuit` path entirely. Almost nothing is built on the assumption yet.

---

## 3. The anchor lineage, checked

Full citations with venue and page numbers are now in `docs/PRIOR-ART-LIST.md`. This section records only what each anchor **entails** for Zeta, and flags what I could not verify.

**Cost-based optimisation — Selinger et al., SIGMOD 1979.** Verified against dblp (`conf/sigmod/SelingerACLP79`) and the ACM DL entry: Patricia G. Selinger, Morton M. Astrahan, Donald D. Chamberlin, Raymond A. Lorie, Thomas G. Price, pp. 23–34. Entails four things, and Zeta has one of them in mutilated form (the join formula, with row counts substituted for distinct values) and none of the other three (cost over catalog statistics — §2.2 shows there are none; bottom-up DP over join orders — §2.1 shows there is no enumeration; interesting orders — §2.3 shows the one we materialise is unpriced).

**Extensible architecture — Graefe.** Three distinct papers, and conflating them is easy: **Graefe & McKenna, ICDE 1993** is the *optimizer generator* (rules as input, DP + goal-directed search + branch-and-bound, explicit physical-property support); **Graefe, IEEE TKDE 6(1) 1994** is the *execution engine* (the `open`/`next`/`close` iterator model and the exchange operator); **Graefe, IEEE Data Eng. Bull. 18(3) 1995** is *Cascades* (rules as first-class objects, memoized groups, top-down guided search). The brief asked for "Volcano (1993)"; both a 1993 and a 1994 Volcano exist and they are different artifacts. For Zeta, Cascades is the relevant architecture, because a rule-driven memoized search over a reified operator DAG is what `Circuit` already is structurally.

**The modern assessment — Leis et al.** Two papers, and the second is the reason to trust the first. **PVLDB 9(3), 2015** introduced the Join Order Benchmark. **PVLDB 18(12), 2025, pp. 5531–5536** is the ten-year retrospective; I read it directly rather than citing from memory, and three of its statements bear on decisions here. *"The cost model does not matter much"* — measured against a tuned model and a trivial one, "the impact of the cost model is dwarfed by errors in cardinality estimation." Join enumeration matters "somewhat", with full DP beating greedy but by margins "much smaller than the improvements gained from more accurate cardinality estimates." And misestimation hurts **more** when more indexes are available. It also quotes Guy Lohman (2014): *"the cost model may introduce errors of at most 30% for a given cardinality, but the cardinality model can quite easily introduce errors of many orders of magnitude!"*

The retrospective additionally discloses that **the 2015 conference version's results were incorrect** due to a data-handling issue, corrected in the journal version (VLDB J 27(5), 2018, pp. 643–668). Anything quoting numbers should quote the journal version. This is exactly the kind of thing a cited-but-unread anchor hides.

> **The consequence for Zeta is uncomfortable and should be stated.** §2.3 identifies a cost-model defect, and the best available evidence says cost models are the *least* important of the three components. So fixing the access-path cost is worth doing because it is nearly free and unblocks physical-operator choice — **not** because it will make queries fast. What would make queries fast is cardinality estimation, and that is the stage-two statistics doc's territory, where the blocking finding is already known (HyperLogLog merges by `max` and cannot represent a shrinking key set, so it is wrong on a retracting DBSP stream).

**Vectorised vs compiled — the ask "can it all be vectorized".** **Boncz, Zukowski & Nes, CIDR 2005** (MonetDB/X100) originates vectorised execution: keep the iterator, return a *vector* of ~100–1000 values per `next()`. **Note a correction to the brief**, which named the third author as Manegold; dblp `conf/cidr/BonczZN05` gives **Niels Nes**. **Neumann, PVLDB 4(9) 2011** is the opposing paradigm (data-centric code generation, push model, LLVM). **Kersten, Leis, Kemper, Neumann, Pavlo & Boncz, PVLDB 11(13) 2018** implemented both in one system with the same algorithms and parallelisation framework; I read the abstract directly, and the finding is: *"We find that both are efficient, but have different strengths and weaknesses. Vectorization is better at hiding cache miss latency, whereas data-centric compilation requires fewer CPU instructions, which benefits cache-resident workloads."* **Neither dominates.** For an F#/.NET host that settles the first step in vectorisation's favour: `System.Numerics.Vector<T>` over `Span<T>` batches needs no LLVM, no runtime codegen and no JIT-warmup story, and degrades to a scalar loop where the intrinsic is missing.

**Row vs column — Stonebraker et al. (C-Store, VLDB 2005); Abadi, Boncz, Harizopoulos, Idreos & Madden (FnT in Databases 5(3), 2013); Abadi, Myers, DeWitt & Madden (ICDE 2007).** The 2013 survey's load-bearing claim for us is that storing columns separately inside a row engine captures little of the benefit — the wins come from vectorised processing, late materialisation, and operating directly on compressed data. The 2007 paper is the sharpest statement of Aaron's actual question: the row/column decision is really **early vs late materialisation**, i.e. how long the engine defers stitching columns back into tuples. *A column-store variant that materialises early is a row store with a different file layout.*

**Parallelism — Leis, Boncz, Kemper & Neumann, SIGMOD 2014 (morsel-driven).** Work units dispatched at runtime to a fixed worker pool, NUMA-locally, with work stealing; degree of parallelism becomes a **runtime dial, not a plan property**. This is the published form of `.claude/rules/async-all-the-way-truthful-signatures.md`: the ferry-throttle's `MaxDegreeOfParallelism` *is* morsel dispatch, and DoP=1 is what makes a run DST-replayable. The rule anchors itself on the maintainer's Itron throttle and on FoundationDB; morsel-driven parallelism is the database-side anchor it was missing.

**Arrow, and composable engines.** Arrow is a **versioned specification with an explicit stability guarantee** since 1.0.0, with the columnar format versioned separately from the libraries — that property, not the library, is what makes it an anchor. **Pedreira et al., PVLDB 15(12) 2022 (Velox)** anchors the composable-execution direction, and here the entailment check bites: Velox *"takes a fully optimized query plan as input"* and *"does not contain a language front end, nor a global query optimizer."* So Velox supports the claim *an Arrow-compatible vectorised execution layer can be a reusable component separate from the planner*, and supports **nothing** about plan search. Cited the other way it would be a mis-anchor.

**Adaptive and learned — assessed, not sold.** **Avnur & Hellerstein, SIGMOD 2000** (eddies) is the maximally-adaptive pole. **Neumann & Radke, SIGMOD 2018** is how to keep exact DP where affordable and degrade gracefully into the thousands of joins. **Stillger, Lohman, Markl & Kandil, VLDB 2001** (LEO) is the honest ancestor of runtime feedback, and names its own failure mode — later called *"fleeing from knowledge to ignorance"* — where correcting only executed plans makes unexecuted alternatives look artificially attractive. **Marcus et al., Neo (PVLDB 2019) and Bao (SIGMOD 2021)**; **Kipf et al., CIDR 2019**. The assessment is the benchmark authors' own, from the 2025 retrospective §4.1, titled *"Learned approaches have not yet been widely adopted"*: real improvements in estimation quality, against "high training and inference costs, difficulty adapting to dynamic environments, challenges in obtaining high-quality training data, and unpredictability due to their black-box nature", with Microsoft reporting limited production gains for a Bao-style approach.

For Zeta the binding objection is not performance, and it should be recorded as an architectural constraint rather than a taste: **a planner that learns from ambient runtime feedback violates §13 noninterference** unless the feedback arrives through a declared, metered channel, **and breaks §7 DST replay** unless the learned state is part of the replayed seed. A learned optimiser is not forbidden here — it is forbidden *in its usual form*, where the model quietly accumulates state from observed executions. The admissible form is one where the feedback is an explicit input to the circuit and replays byte-identically from the seed.

**Incremental optimisation — where I expected a gap and found less of one than briefed.** The brief anticipated that "the textbook literature thins out" for cost-based optimisation over incremental view maintenance. That is only half right, and the honest version is more useful. **Wang, Zeng, Huang et al., "Tempura", PVLDB 14(1) 2020** is a **Cascades-style cost-based optimizer for incremental data processing**, built on Apache Calcite over a model of time-varying relations, with an Alibaba open-source implementation. So the architecture demonstrably generalises to the incremental setting, and claiming otherwise would have been inventing a gap. **DBSP itself** (Budiu, Chajed, McSherry, Ryzhyk & Tannen, PVLDB 16(7) 2023) is already our substrate.

What is genuinely missing is narrower: **no published cost model over DBSP circuits specifically**, where the optimisation unit is a *delta* rather than a query, operators are `Z`-set-valued, and `integrate`/`differentiate` make retained state a first-class cost term alongside CPU. Tempura's TIP model is not that, and DBSP's papers are about *correctness* of the incremental rewrite rather than *choosing among* incremental plans. Also unaddressed anywhere I could find: the three-term bilinear rewrite `Δa ⋈ Δb + z⁻¹(I(a)) ⋈ Δb + Δa ⋈ z⁻¹(I(b))` triples the join sites, and which of the three dominates depends on the ratio of delta size to integrated size — a cost question nobody appears to have written down.

**Citations I could not fully check.** I verified authorship, venue, year and pages for every anchor above via dblp or the publisher, and read the *full text* of only two (the 2025 retrospective, and the abstract/introduction of Kersten et al. 2018). For the rest — C-Store, the 2013 column-store survey, the 2007 materialisation paper, morsel-driven parallelism, eddies, Neo/Bao/MSCN, LEO, Tempura — I verified the bibliographic record and am relying on standard summaries for the technical claims, which is weaker than the anchoring rule's "checked" standard. Anyone promoting a claim from those papers to a load-bearing design decision should read the paper first. Flagged rather than glossed.

---

## 4. The design map — the four asks

Each ask gets: what exists, what the literature says the state of the art is, and the **smallest** concrete first step. First steps are deliberately small enough to be falsifiable.

### 4.1 Vectorised

**Exists:** one real, dead 53-line file; one 112-line file that is SIMD in name only and cites a nonexistent test; nothing on the DBSP hot path; no benchmark.

**State of the art:** vectorised (X100) and compiled (HyPer) both win, split by cache-residency (Kersten et al. 2018). Vectorisation is the better fit for .NET.

**Smallest first step — and it is a deletion or a repair, not a feature.** `SimdMerge.fs` currently makes two false claims in its header (vector instructions it does not contain; a fuzz test that does not exist). Either implement the vectorised merge front and write the fuzz test, or strike the claims and rename the file. **Do that before adding any new SIMD**, because the standing version teaches every future reader that the merge path is already vectorised. Then, and separately: add a `bench/` scalar-vs-`Simd.Sum` benchmark, so that the first speedup number Zeta ever quotes for SIMD is measured. Only after those two should `MergeKernel.fs` — the kernel `ZSet.(+)` actually calls — get a vectorised path, because that is the one that would touch query execution.

**Discipline check:** SIMD is width-dependent, and `Vector<T>.Count` varies by machine. Any vectorised kernel must produce **bit-identical output** to its scalar twin or it breaks §7 DST replay and the four-oracle byte-lock. For integer add/compare over `int64` that is satisfiable; for anything float it is not, and float reductions must not be reassociated. That constraint should be written into the kernel's tests as a scalar-equivalence property, not assumed.

### 4.2 Row store

**Exists:** this is what Zeta is. `ImmutableArray<ZEntry<'K>>` — a sorted AoS run — plus a Patricia trie index and an LSM merge scheduler.

**State of the art:** for the incremental/OLTP-shaped workload a row layout is the right default, and the sorted-run representation is a good one; it is what makes the merge join in §2.3 possible at all.

**Smallest first step: none required — but name it.** No document currently says "Zeta is a row store." Recording that `ZSet` *is* the row-store variant, and that a column-store variant would be a *sibling representation behind the same operator algebra*, converts an implicit fact into a design decision. Concretely: the `ISerializer<'K>` boundary already demonstrates that a `ZSet` can have multiple external encodings; the column variant is the same idea moved inward, to the in-memory representation.

### 4.3 Column store

**Exists:** nothing. No columnar physical layout of any kind.

**State of the art:** Abadi et al. 2013 — column *storage* without column *execution* buys little; the wins are vectorised processing, late materialisation, and direct operation on compressed data. Abadi et al. 2007 — the real axis is early vs late materialisation.

**Smallest first step: a struct-of-arrays `ZSet` behind the existing interface, judged by one measurement.** Today `ZEntry<'K>` interleaves key and weight. The columnar sibling is two parallel arrays — `keys: ImmutableArray<'K>` and `weights: ImmutableArray<Weight>`. That single change is what makes the weight column a contiguous `ReadOnlySpan<int64>`, which is what makes `MemoryMarshal.Cast` + `TensorPrimitives.Sum` **safe** — the exact operation `ZSet.weightedCount` documents wanting and then concedes it cannot do on the AoS layout. So the column-store first step and the vectorisation first step are the *same* step, which is the 2013 survey's central claim reproduced in miniature.

The falsifier to write first: `weightedCount` over the SoA layout must equal `weightedCount` over the AoS layout on random inputs, and must be faster on a benchmark. If it is not faster, the column variant has not earned its existence and the experiment ends there — which is the honest outcome to design for.

**Deliberately not part of this step:** compression, dictionary/RLE encoding, and late materialisation. Late materialisation only pays once there is a plan with multiple operators deciding when to stitch — i.e. after §4.5 — and adding it before then would be building the hard half of a column store with no consumer.

### 4.4 Arrow as the column store's serialization contract

**Exists:** genuine `Apache.Arrow` 23.0.0 IPC, fixed two-column schema, .NET-only, zero production callers, and a golden-vector file whose cross-check is two consumers of one library.

**State of the art:** Arrow is a stable, versioned specification; Velox demonstrates a vectorised Arrow-compatible execution layer as a component independent of the planner.

**Smallest first step: make the byte-lock non-vacuous.** The current Arrow golden vectors cannot detect a divergence, because both sides call the same .NET library — under the repo's own N-version discipline, agreement between correlated implementations is not evidence. The cheap repair is to check in hex-in-JSON vectors produced by an **independent** Arrow implementation (pyarrow or arrow-rs) and assert `ArrowSerializer` round-trips them. That is a genuine cross-implementation lock and it is a few dozen lines.

**Interaction with `no-binary-in-proof-lineage`:** Arrow's wire form is binary, so its vectors must be hex-in-JSON — which is exactly the shape the rule already names (`golden-vectors-*.json (cbor/arrow/…)`). Arrow is compatible with the proof lineage; what must be refused is a checked-in `.arrow` file used as an expected value.

**The design point Aaron's phrasing invites, stated carefully.** *"Our column store variant should play nice with Arrow"* has a stronger reading available: make the SoA layout of §4.3 **Arrow-shaped** — parallel typed buffers with an optional validity bitmap — so that serialisation becomes near-zero-copy rather than a row-by-row `Int64Array.Builder()` loop plus two array copies. That is the right target. It should not be the *first* step, because adopting Arrow's memory layout as the in-memory representation imports Arrow's type system into the core, and that is a much larger commitment than adding a second `ZSet` representation. Recommend: SoA first, judged on `weightedCount`; Arrow-shaped buffers second, judged on serialisation cost; Arrow as the in-memory representation only if both pay.

### 4.5 The planner itself (not one of the four asks, but the thing they sit on)

**Smallest first step, and the highest value-per-line in this document: give `join` and `indexedJoin` different costs, and write the falsifier that fails when they are equal.** This is a handful of lines in a 97-line file. It requires no statistics, no sketches and no new dependency, because the distinguishing terms are structural rather than data-dependent: a hash join builds a dictionary over one side (memory proportional to the build side, ~O(|a|+|b|) probes), while a merge join over two already-sorted `IndexedZSet` runs is a single linear walk with no build allocation. `IndexedZSet` is sorted **by construction**, so the interesting-order information is free — it is a property of the type, not a statistic.

Do it in this order, because the second item is what makes the first mean anything:

1. Replace the shared formula with per-operator costs that differ, and add the memory term that distinguishes them.
2. **Rewrite the five vacuous tests of §2.4 to assert actual values**, and add one test that fails if `cost("join")` equals `cost("indexedJoin")` on the same inputs. Then re-run the stage-two mutation check: with real assertions, replacing an estimate with `999999L` must go red.
3. Only then consider enumeration, statistics, or anything Cascades-shaped.

And note what step 2 buys under the repo's own economics: five tests that currently cannot fail become falsifiers, which is precisely the `unmetered → metered` transition `toy-is-free-metered-must-be-earned.md` describes.

### 4.6 Where the literature genuinely does not answer us

Stated so it is not mistaken for a gap in the reading. Tempura shows Cascades generalises to incremental processing; DBSP gives the correct incremental rewrite. **Neither gives a cost model over DBSP circuits.** Three sub-questions appear to be genuinely open, and I would not want any of them answered by assertion:

- **What is the cost unit?** Per-query cost is the wrong unit for a standing circuit. Viglas & Naughton's output *rate* is the streaming answer; whether rate or per-delta cost is right for DBSP — where the circuit is neither a one-shot query nor an unbounded stream join, but a fold over deltas with retained integral state — is not settled by either literature.
- **How is retained state priced?** `integrate` holds the full relation. A plan that is cheaper per delta but retains more state may be worse. Classical cost models have no term for this because a one-shot query retains nothing after it finishes.
- **Which of the three bilinear terms dominates?** The incremental join rewrite triples the join sites, and the answer depends on the delta-to-integral size ratio — the one statistic that is cheap to measure exactly (both are known at runtime) and that nobody appears to have written a cost model around.

These are worth writing up properly if the answers hold, because they would be a genuine contribution rather than an application of one. They are explicitly **not** answered here.

---

## 5. Registers

Per `.claude/rules/toy-is-free-metered-must-be-earned.md`. Nothing in this change promotes anything; the point of the table is that the middle column is where almost everything sits.

| artifact | register | why, and what would earn a promotion |
|---|---|---|
| `src/Core/Plan.fs` cost model | **`unmetered`**, and stated plainly | It is implemented and used by `Explain()`, and **no test constrains any estimate it produces** (§2.4). Its constants — 50% selectivity, fan-out 2, group-by fan-in 4, 40 ns/row, 1024-row unknown source — are unsourced. Promotion requires assertions on actual values plus a benchmark relating `EstimatedCpuNanos` to measured time. |
| `Plan.fs` join formula | **`toy`** | Selinger's formula with the wrong variable substituted (§2.3); it cannot represent a many-to-many join. It should carry a comment saying so until `V` is a real distinct-value estimate. |
| `Explain()` output | **`unmetered`**, and mildly misleading | `rows≈N` renders a constant in `EXPLAIN`'s clothes. Stage-two §8.6 already asked the maintainer whether to label it; this document does not pre-empt that answer. |
| `src/Core/Simd.fs` | **`unmetered`** | Real SIMD, correct, tested, dead. Its "2–4× speedup" header claim is unmeasured — that sentence is a `toy` claim inside an `unmetered` file. |
| `src/Core/SimdMerge.fs` | **`toy`, and currently mislabelled** | Contains no vector instructions and cites a nonexistent test (§2.5). Until repaired, its header is false rather than optimistic. |
| `ArrowSerializer.fs` | **`unmetered`** | Correct and genuinely Arrow, self-round-trip tested only, no production caller. Promotion = a cross-implementation vector from pyarrow/arrow-rs (§4.4). |
| Arrow golden vectors | **`unmetered`**, non-vacuously so | The file exists and locks *something*; what it does not lock is cross-implementation agreement, by its own header's admission. |
| The anchor lineage added here | **evidence, not a model** | Bibliographic records verified; two papers read in part; the rest flagged in §3 as relying on standard summaries. |
| Everything in §4 | **design, unbuilt** | No code is changed by this PR. |

---

## 6. What we are NOT building yet

Explicitly, so that this document cannot be read as a mandate:

The planner. Plan enumeration, join reordering, a memo, or anything Cascades-shaped. A SQL parser, logical/physical plan types, a binder, or rewrite rules. Predicate or projection pushdown. Learned or adaptive optimisation of any kind. Eddies-style continuous routing. Compiled query execution / runtime codegen — Kersten et al. is the reason to *defer* it, not adopt it. Late materialisation, compression, dictionary or RLE encoding. Arrow Flight. Arrow as the in-memory representation. A columnar on-disk format or an SSTable. Any change to `RxJoin` stage one. Any of the statistics work owned by the stage-two doc — sketch repairs, decay, heavy hitters, the HyperLogLog retraction bug. Cross-language ports of anything here. And no promotion of `Plan.fs` out of `unmetered`.

The build order implied by §4 is, in full: fix `SimdMerge.fs`'s false header; make the five vacuous `Plan` tests assert values; give the two joins different costs with a test that fails when they are equal; benchmark scalar-vs-SIMD; prototype the SoA `ZSet` judged on `weightedCount`; obtain an independent Arrow vector. Six items, none large, and the first two are corrections rather than features.

---

## 7. Open questions needing the maintainer's decision

**7.1 — Is the column store a second representation or a replacement?** §4.3 proposes SoA `ZSet` as a *sibling* of the AoS one, selected per relation. That means two implementations of every operator, or one generic over layout — real complexity, and it is the "row store *and* column store variant" Aaron asked for taken literally. The alternative is to pick one. Recommend sibling-behind-an-interface, but the cost is genuine and the call is his.

**7.2 — Does Arrow become the in-memory layout, or stay a serialization boundary?** These are very different commitments. Staying at the boundary keeps Arrow's type system out of the core; adopting it inward buys near-zero-copy serialisation and interop with every Arrow-native tool, at the price of importing that type system. §4.4 recommends deferring; the blueprint `columnar-storage-expert.md:86` already poses this as an open question and has never been answered.

**7.3 — Plan-once or adaptive?** Stage-two §8.2 raised this and it stays open. §2.8 adds one fact that should make it easier: the static-plan commitment lives in a design doc and a 65-line builder that is off the `Circuit` path, so very little is actually built on it.

**7.4 — Is a learned component ever admissible?** Not a performance question. §3 argues the usual form violates §13 and §7, and that the admissible form makes the feedback an explicit, replayable circuit input. Worth deciding once, in principle, before anyone builds toward it.

**7.5 — Should `references/prior-art/` be synced on this machine?** Aaron's brief assumed the database mirrors were readable. They are not (§1). Running `tools/setup/common/sync-prior-art.sh` is a large disk commitment; the alternative is to keep working from papers, which is what this document does. If the answer is "sync it", the follow-up worth doing is a clean-room-disciplined read of one optimiser — and `.claude/rules/cleanroom-two-team-separation.md` applies to any GPL/AGPL-adjacent source, so the agent who reads must not be the agent who implements.

**7.6 — Do the remaining stage-two §8.8 anchor repairs land next?** This change performed the first (the query-optimisation lineage). Three remain: the HyperMinHash attribution (Cohen–Lemire → Yu & Weber), the uncited HyperLogLog in `Sketch.fs`, and the KLL bound that its single-level implementation does not deliver. All mechanical.

---

## Provenance

Written against `6cec0e272` in the detached worktree `~/zeta-wt-qopt`. No source file is modified by this change; it adds this document and a section to `docs/PRIOR-ART-LIST.md` plus a disambiguation note on the existing Potrace entry.

Findings in §2.3, §2.4 and §2.5 were verified directly by reading the files and running the greps quoted, not inherited from the brief that commissioned this work. That brief contained two errors, both corrected above and worth recording because they are the anchoring rule working as designed: it described the Potrace entry as a misattribution (it is a correct citation for a different person), and it named MonetDB/X100's third author as Manegold (it is Nes). A third correction is to its expectation that cost-based optimisation over incremental view maintenance is an unwritten area — Tempura exists.

`docs/research/2026-*-*.md` is in the `ignores` list of `.markdownlint-cli2.jsonc`, so **markdownlint does not check this file** and a green `lint:markdown` proves nothing about it. Formatting was checked by reading.
