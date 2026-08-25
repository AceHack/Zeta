# Rx query-planner joins, stage two: the two-stream statistics layer

**Status:** design, pre-implementation. Nothing here is built.
**Register:** everything in this document is `toy`/`unmetered` by default; the one
executed measurement is marked as such and the rest is explicitly not.
**Measured against:** `abef69dcc` (`origin/main`, 2026-08-24).

---

## 0. The brief, and what this document is for

Aaron, 2026-08-24, verbatim (archived at
`docs/history/pr-reviews/PR-14836-feat-rx-stage-one-join-operators-rx-fs-had-no-combinator-set-at-all.md`
and quoted inside `src/Core/Rx.fs` itself):

> *"for rx we need the join operators lets start with the simple ones that don't
> requrie query planners, query planner joins come second but should not be
> discounted against, just many required ongoing statistics capture about the two
> streams."*

Stage one shipped. This is the design for stage two, and stage two's distinguishing
requirement is the clause at the end of that sentence: **ongoing statistics capture
about the two streams**. The joins are not the hard part. The statistics are.

This document does not implement the planner. It establishes what exists, what must
be measured, which sketch answers which question, how the measurement enters the
system without violating noninterference, what is deliberately out of scope, and
what needs a human decision before code is written.

One correction to the framing before anything else. The natural assumption is that
stage two is greenfield — stage one was the first operator set, so surely the
planner is the first planner. **It is not.** A cost model already ships, a full
sketch family already ships, and the wiring between them is already named as
missing in the source. Stage two is substantially a *repair and connect* job
wearing a *build* job's clothes, and getting that backwards would produce a second
disconnected cost model beside the first.

---

## 1. What stage one actually shipped

PR **#14836**, merge SHA `6a96a2d8634ad14e71b18cdf52f37c37bc9fff3d`, merged
2026-08-24T16:51:25Z on branch `rx-join-operators-stage-one`, +1145/−0 across three
files, authored under the `AceHack` credential. Zero review threads: it was merged
without a second party's review, which is worth knowing when reading its claims.

Before that commit `src/Core/Rx.fs` was 115 lines holding exactly two functions,
`RxAdapter.asObservable` and `RxAdapter.asObservableForCount`, both
`OutputHandle → IObservable` bridges. There were no combinators of any kind. The
commit message states the consequence plainly: this "is not 'joins added to an
operator set' — it is the first operator set."

The shipped surface is `[<RequireQualifiedAccess>] module RxJoin` in
`src/Core/Rx.fs` (now 637 lines), six exported functions:

| function | join kind | state | clock? |
|---|---|---|---|
| `zipBounded` / `zip` | positional, arrival-index (n-th to n-th) | two queues, bounded or not | none |
| `combineLatest` | symmetric latest-value | one slot per side, O(1) | none |
| `withLatestFrom` | asymmetric stream-reference ("stream-table") | one slot on the right | none |
| `groupJoin` | Rx classic interval GroupJoin, caller-declared durations | one entry per live element | caller's |
| `join` | Rx classic interval Join (flattened `groupJoin`) | one entry per live element per side | caller's |
| `durationAfter` | window-builder helper | — | injected `IScheduler`, required |

These are push-side `IObservable<'T>` combinators. They are **not** Z-set operators:
they carry no weights, they are neither incremental nor one-shot in the DBSP sense,
and they compose with `System.Reactive`, not with `Circuit`. That distinction runs
through the whole of stage two and is the first thing §2 has to untangle.

The property that made them planner-free is stated exactly, and it is the right
criterion: *a join needs a planner exactly when its cost depends on statistics the
operator would have to infer from the data.* Every operator above has its window or
its key fixed by the caller up front, so there is nothing to infer. `zip` pairs by
arrival index; `combineLatest` and `withLatestFrom` hold one slot per side;
`groupJoin` and `join` take their windows as caller-supplied observables.

Two disciplines were honoured and are worth carrying forward unchanged. First, **no
clock lives in the module** — time is not a term in the definitions of the first
three, and the last two only observe a duration stream the caller supplied. Second,
`durationAfter` takes an `IScheduler` as a required parameter with deliberately no
defaulting overload, because `Observable.Timer(ts)` resolves against
`Scheduler.Default`, which is a wall clock, and a wall-clock join window puts local
time inside a shared conclusion.

Falsifiers: 23 tests in `tests/Tests.FSharp/RxJoin.Tests.fs` (622 lines), including a
seeded DoP=1 determinism replay with a different-seed non-vacuity control, two
wall-clock negative controls (one behavioural via `HistoricalScheduler`, one a source
scan of the shipped module), and teardown tests pinning the file header's
"lifetimes are bounded above every subscription" claim. The PR review records an
8-mutation kill log, M1–M8, each rebuilt red and restored.

The module self-registers as **`unmetered`**: implemented, falsified by unit tests,
never run against a real workload. That register is correct and stage two inherits it.

### 1a. Three limits stage one named and did not solve

These are not criticisms; they are stage two's actual inbox.

**The clock constraint is unenforceable by signature.** A duration selector has type
`'L -> IObservable<'LD>`, and every observable inhabits that type, including
`Observable.Timer` on the default scheduler. `durationAfter` is a *mitigation, not an
enforcement.* The only real enforcement is a lint, and the repo does not have one:
`src/Core.TypeScript/hygiene/audit-ambient-time-in-tests.ts` covers ambient time in
TypeScript tests and says nothing about F# scheduler usage. The negative-control test
is that lint at single-file scope. This matters more in stage two than in stage one,
because a statistics layer has far more reasons to want a clock than a join does.

**`zip` is planner-free in cost but not in memory.** The faster side's buffer grows
without bound; `zipBounded` makes the ceiling an explicit caller choice and fails
loudly at it. The error message names its own successor:

> `RxJoin.zipBounded: {0} buffer exceeded the caller-declared capacity of {1}.`
> `Sizing this automatically would need the arrival-rate statistic that stage-two`
> `planner joins collect.`

**`groupJoin`/`join` occupancy is data-dependent.** One entry per live element per
side, and nothing bounds it. Bounding it needs the window-occupancy statistic.

Stage one also listed the five statistics stage two needs — arrival rate, key
cardinality and skew, join selectivity, window occupancy, retraction ratio — and said
where they must come from: the metered-crossing channel of §13 noninterference, a
statistics *satellite* fed at the membrane, not an ambient counter read off a wall
clock. **That list is correct and this document adopts it wholesale.** §4 adds the
one it is missing and §5 says what "fed at the membrane" concretely means.

---

## 2. What already exists — and why stage two is not greenfield

Four separate surfaces are relevant, and three of them were built before stage one.

### 2a. The DBSP join family is large, older, and separate from `RxJoin`

`RxJoin` is the reactive push layer. Underneath it, on `Stream<ZSet<_>>`, sits a
substantial relational join family that has been there far longer:

| operator | file | kind | incremental? |
|---|---|---|---|
| `Join` (`"join"`) | `src/Core/Operators.fs:275` | hash equi-join, bilinear | per-tick recompute |
| `IndexedJoin` (`"indexedJoin"`) | `src/Core/Operators.fs:308` | sort-merge over pre-indexed Z-sets | per-tick recompute |
| `Cartesian` (`"cartesian"`) | `src/Core/Operators.fs:293` | cross join | per-tick recompute |
| `Antijoin` / `Semijoin` | `src/Core/Aggregate.fs:286,295` | hash anti/semi | per-tick recompute |
| `LeftOuterJoin` / `RightOuterJoin` | `src/Core/Advanced.fs:359,370` | hash outer | per-tick recompute |
| `AsofJoin` (`"asofJoin"`) | `src/Core/TimeSeries.fs:182` | temporal as-of, per key | **explicitly non-streaming** |
| `RangeJoin` (`"rangeJoin"`) | `src/Core/TimeSeries.fs:195` | interval/band join | non-streaming |
| `IncrementalJoin` | `src/Core/Incremental.fs:50` | the three-term bilinear rewrite | **yes** |
| `IncrementalAuto` | `src/Core/Incremental.fs:156` | detects chains, rewrites bilinear joins | yes |

The kernels are `ZSet.join` (`src/Core/ZSet.fs:468`, a hash equi-join indexing `b` in
a dictionary with a `nextIdx` linked-list so no per-key `List<_>` is allocated),
`ZSet.cartesian` (`:436`), and `IndexedZSet.join` (`src/Core/IndexedZSet.fs:327`,
sort-merge over key groups with weights multiplied under `Checked.(*)`).

**The single most consequential planner decision in this family is already being made,
silently, by argument order.** `ZSet.join` always builds its hash table on `b` and
probes with `a`. Which side is the build side is *the* classic hash-join choice — you
want the smaller side in memory — and today it is whichever side the caller typed
second. No statistic is consulted. A planner that did nothing but swap those two
arguments when the statistics say to would already be earning its keep. That is worth
saying plainly because it makes stage two's first useful increment very small.

Note also that `AsofJoin` documents its own successor — *"for streaming-incremental
versions see `SpineAsofJoin` in a future extension"* — and **`SpineAsofJoin` does not
exist**. A pointer to a file that was never written.

### 2b. A cost model already ships: `src/Core/Plan.fs`

97 lines, and it is the entire cost model in the repository:

```fsharp
[<Struct>] type OpCost = { EstimatedRows: int64; EstimatedCpuNanos: int64 }
module Plan =
  let private estimate (opName: string) (inputRows: int64 array) : OpCost
  let compute (circuit: Circuit) : Dictionary<int, OpCost>
type PlanExtensions =
  static member Explain(this: Circuit) : string
  static member Costs(this: Circuit) : IReadOnlyDictionary<int, OpCost>
```

Cardinality propagates through a static table keyed on the operator's *name string*:
unknown input 1024 rows; `filter` n/2; `flatMap` n×2; `distinct` n/2; `groupBySum`,
`count`, `average` n/4; `integrate` n×2; `cartesian` a×b; and

```fsharp
| "join", [| a ; b |] -> (a * b) / max 1L (max a b)  // primary-key assumption
```

CPU is `max 40L rows * 40L` nanoseconds.

Its own docstring names the missing wire:

> *"static-heuristic cardinality estimates… could feed a future cost-based optimiser.
> A future revision will wire `Sketch.fs` HLL for real estimates — tracked in
> `docs/BACKLOG.md` as query-planner P1."*

**That tracking pointer is dangling.** `docs/BACKLOG.md` is 1163 lines and contains no
occurrence of "planner" at all. The row it points to does not exist. Stage two is
that row.

**And the join heuristic is Selinger's formula with the wrong denominator.** The
textbook estimate for an equi-join is

> |A| · |B| / max( V(A,k), V(B,k) )

where **V(·,k) is the number of *distinct values* of the join key**, not the row
count. `Plan.fs` substitutes row counts, so `(a*b)/max(a,b)` reduces to `min(a,b)`.
That is exactly the primary-key/foreign-key assumption the comment admits to — it
silently asserts the key is unique on the larger side, and it therefore *cannot*
estimate a many-to-many join at all, in either direction, by construction.

This is the most encouraging finding in the document. The formula is not wrong; it is
starved. `V(·,k)` is precisely what a distinct-count sketch measures, and the repo
already ships one. Stage two's cardinality work is not "design a cost model" — it is
"supply the denominator the existing model was always written for." §4 explains why
the obvious way of supplying it is nonetheless wrong.

### 2c. The cost model's numbers are unfalsified — measured, not asserted

`Plan.fs` has tests: `tests/Tests.FSharp/Circuit/Plan.Tests.fs` (101 lines, 7 facts)
and `tests/Tests.FSharp/Circuit/Plan.Branches.Tests.fs` (302 lines). Reading them,
nearly every assertion is structural — `plan.Count |> should be (greaterThan 0)`,
`EstimatedRows |> should be (greaterThanOrEqualTo 1L)`, `text.Contains "map"`.

Rather than assert that this makes them vacuous, I ran the mutations. Both runs are
`dotnet test -c Release` on `abef69dcc` with
`--filter "FullyQualifiedName~PlanTests|FullyQualifiedName~PlanBranch"`.

| run | change to `Plan.fs` | result |
|---|---|---|
| baseline | none | **34 passed**, 0 failed |
| mutant A | *every* cardinality heuristic replaced by the constant `42L` | 33 passed, **1 failed** |
| mutant B | only `join`, `indexedJoin`, `cartesian` replaced by `999999L` | **34 passed**, 0 failed |

Mutant A's single kill is
`PlanTests.Plan.Costs propagates cardinality through filter (50% default selectivity)`,
which asserts `Equals 21L` and got `42L`. So exactly **one** of 34 tests constrains an
estimate's *value*, and it constrains the `filter` heuristic.

**Mutant B is the finding that matters: every join cardinality heuristic in the cost
model can be replaced by a fixed nonsense constant and the entire test suite stays
green.** The join estimates — the ones a planner join would actually consult — are
unconstrained by any test. That is a survived mutant, executed, not argued.

The register consequence follows without further argument. Per
`.claude/rules/toy-is-free-metered-must-be-earned.md`, `Plan.fs` is `unmetered`, and
I would go further: it is *presented above its register.* `Explain()` emits
`id: name (rows≈N, ns≈M) [inputs]`, deliberately mirroring SQL `EXPLAIN`, a surface
readers have been trained for forty years to read as derived from collected
statistics. Here `rows≈` is derived from a constant in a match arm. The format is
making a claim the number cannot support.

The tree was restored to `abef69dcc` after both runs; `git status --porcelain` is
empty.

*A methodological note, recorded because it is the same failure mode the statistics
layer must guard against.* My first pass concluded `Plan.fs` had **zero** tests, from
a grep whose alternation did not match the dialect in use. Listing `tests/` found
both files immediately. A check that did not run reads exactly like a check that
passed — which is the whole reason §2c above is a mutation run and not a paragraph of
reasoning about assertions.

### 2d. The sketch layer already exists, and is richer than the brief assumed

The brief anticipated `golden-vectors-*` for cbor/arrow/merkle/bloom/countmin. That
is accurate but understates what is in the tree. Five sketches ship:

| sketch | file | merge | idempotent? | checkpointable? | signed weights? | seeded? |
|---|---|---|---|---|---|---|
| `CountMinSketch` | `src/Core/CountMin.fs` (220) | elementwise `+` | **no** | `Snapshot`/`OfState` | **yes** (ℤ, not ℕ) | **yes** |
| `HyperLogLog` | `src/Core/Sketch.fs` (111) | register-wise `max` | yes | **no** | no | **no** |
| `HyperMinHash` | `src/Core/NovelMath.fs:174` | slot-wise `max` | yes | **no** | no | **no** |
| `KllSketch` | `src/Core/NovelMath.fs:117` | re-`Add` each element | **no** | **no** | n/a | **no** |
| `BlockedBloom` / `CountingBloom` | `src/Core/BloomFilter.fs` (560) | OR-merge / — | yes / no | `OfState` / no | 4-bit counters | n/a |

So **four of the five statistics stage one named already have a sketch in the tree.**
What is missing is not the sketches. It is the collection discipline: nothing feeds
them from a join, nothing decays them, three of them cannot be checkpointed, and none
of them is wired to any decision.

Related existing pieces worth knowing: `Circuit.ApproxDistinct` already exposes HLL as
a DBSP operator (`ApproxDistinctOp` at `src/Core/Advanced.fs:317`, surfaced at `:412`);
`StatisticalWatermarkStrategy`
(`src/Core/InjectionExt.fs:53`) already consumes `KllSketch` for adaptive lateness;
`InfoTheoreticSharder` (`src/Core/NovelMathExt.fs`) already uses CMS for skew-aware
shard assignment and is on the tech radar at **Trial**. Cross-language coverage is
**Bloom and Count-Min only** — F#, C# (`src/Core.CSharp.Metric/`), Rust
(`src/Core.Rust.Metric/`), TypeScript (`src/Core.TypeScript/metric/`), byte-locked by
`golden-vectors-bloom.json` and `golden-vectors-countmin.json`. HLL, KLL,
HyperMinHash and Haar are F#-only with no golden vectors and no ports.

And the surface where planner statistics would naturally live is empty:
`src/Core/Catalog.fs` (117 lines) stores only `table:<name>` and
`column:<t>.<c>` rows. **No row counts, no distinct-value counts, no histograms, no
min/max, no most-common-values.** A statistics catalog would hang here and there is
nothing here.

---

## 3. Anchors, checked rather than cited

`.claude/rules/anchor-to-human-prior-art.md` requires a named human and a paper for
every concept, and the operational half requires the anchor to be **checked** — the
cited work must actually entail the claim attached to it. Checking the existing
anchors turned up four things.

**Finding 1 — the prior-art list has no query-optimisation lineage at all.**
`docs/PRIOR-ART-LIST.md` (1788 lines) contains zero entries for Graefe, Volcano,
Cascades, Chaudhuri, Ioannidis, Leis, Kossmann, Wilschut, or join ordering.
`src/Core/Rx.fs` correctly cites *Selinger et al., "Access Path Selection in a
Relational DBMS", SIGMOD 1979* in the `RxJoin` docstring, and **that citation is not
in the prior-art list.** The list's one "Selinger" is at line 977 and is *Peter*
Selinger's *Potrace* polygon-tracing algorithm — a different person in a different
field. Per the list's own rule that a code-owner agent scans it for prior art, an
agent picking up planner joins today finds nothing, or finds the wrong Selinger.

**Finding 2 — an in-repo attribution conflict on HyperMinHash.**
`docs/PRIOR-ART-LIST.md:231` reads `**HyperMinHash** — Cohen-Lemire; a sketch we
ship.` `src/Core/NovelMath.fs:167` reads `Reference: Yu & Weber. "HyperMinHash:
MinHash in LogLog Space". arXiv:1710.08436 (2017).` The source file is right; the
prior-art list attributes the sketch to two researchers who did not write it. Two
surfaces in one repo naming different humans for the same artifact is exactly the
drift the anchoring rule exists to catch.

**Finding 3 — HyperLogLog is implemented with no citation at all.**
`src/Core/Sketch.fs` states the `alpha` constants, the `1.04/√m` standard error, and a
small-range linear-counting correction, and names no author anywhere in its 111 lines.
Three unnamed humans in one file: **Flajolet, Fusy, Gandouet & Meunier**,
*"HyperLogLog: the analysis of a near-optimal cardinality estimation algorithm"*
(AofA 2007) for the algorithm; **Flajolet & Martin**, *"Probabilistic Counting
Algorithms for Data Base Applications"* (JCSS 1985) as the old-anchor pair the rule
asks for alongside the modern one; and **Whang, Vander-Zanden & Taylor** (ACM TODS
1990) for the linear-counting correction the code implements at the small-range
branch. The prior-art list does carry the Flajolet row; the source file does not.

**Finding 4 — KLL's cited bound does not describe the shipped algorithm.**
`src/Core/NovelMath.fs:103` promises a *"provable error bound"* and cites
**Karnin, Lang & Liberty**, *"Optimal Quantile Approximation in Streams"* (FOCS 2016).
Nine lines later the implementation comment concedes: *"Simplified single-level
(h = 0) KLL — for a full tree you'd cascade, but one level captures the essential
algorithm."* KLL's optimality theorem is a property **of the cascade**; a single
compactor is a randomised sample, and its accuracy is the sampling rate, not KLL's.
The honest anchor for what actually ships is reservoir/random sampling —
**Vitter**, *"Random Sampling with a Reservoir"* (ACM TOMS 1985), and
**Manku, Rajagopalan & Lindsay** (SIGMOD 1998) for the streaming-quantile use — with
KLL named as the *destination*, not the delivered guarantee. The entailment fails:
the paper is real, the claim attached to it is not one the paper makes about this
code. This is the textbook shape the anchoring rule's operational half describes.

**The counter-example, and the standard to copy.** `src/Core/CountMin.fs` gets this
exactly right and should be the template for every statistic stage two adds. Its
docstring states that the ε/δ bound is a theorem *only* under a 2-universal hash
family and independent rows; that XxHash3 + SplitMix is not a proven 2-universal
family, so the bound holds heuristically and is **not provable**; that a known seed
lets an attacker collide all `d` rows and defeat the `δ = e^-d` amplification; and
that no current caller is adversarial, so this is a stated assumption rather than a
live vulnerability. That is a checked anchor: real citation, plus an explicit account
of where the implementation departs from the theorem's hypotheses.

### Anchors this design adds

For the statistics themselves:

- **Viglas & Naughton**, *"Rate-based query optimization for streaming information
  sources"* (SIGMOD 2002). The paper that replaces the one-shot optimiser's
  *cardinality* unit with an output *rate*, on the grounds that an unbounded stream
  has no final cardinality to estimate. This grounds the whole reframing of §4 and is
  cited nowhere in the repo.
- **Kang, Naughton & Viglas**, *"Evaluating window joins over unbounded streams"*
  (ICDE 2003) — the unit-time-basis cost model for stream joins, i.e. how to price a
  join whose inputs never end.
- **Srivastava & Widom**, *"Memory-limited execution of windowed stream joins"*
  (VLDB 2004) — the memory/occupancy half.
- **Wilschut & Apers**, *"Dataflow query execution in a parallel main-memory
  environment"* (PDIS 1991) — the symmetric (pipelined) hash join, which is the
  physical operator stage two would actually be choosing.

For the danger, which is the part that shapes the design most:

- **Ioannidis & Christodoulakis**, *"On the propagation of errors in the size of join
  results"* (SIGMOD 1991) — errors in intermediate join-size estimates propagate
  **exponentially** in the number of joins.
- **Leis, Gubichev, Mirchev, Boncz, Kemper & Neumann**, *"How Good Are Query
  Optimizers, Really?"* (VLDB 2015) — the modern re-measurement, on real data:
  cardinality estimation, not the cost function and not plan enumeration, is where
  optimisers lose, with errors spanning orders of magnitude.

Those two papers, twenty-four years apart, say the same thing, and it is the reason
§6 argues for a planner built to *survive* bad estimates rather than one built to
produce good ones.

For decay:

- **Datar, Gionis, Indyk & Motwani**, *"Maintaining stream statistics over sliding
  windows"* (SODA 2002) — exponential histograms.
- **Cohen & Strauss**, *"Maintaining time-decaying stream aggregates"* (PODS 2003).
- **Cormode, Shkapenyuk, Srivastava & Xu**, *"Forward decay: a practical time decay
  model for streaming systems"* (ICDE 2009).

For heavy hitters, which is a genuine gap:

- **Misra & Gries**, *"Finding repeated elements"* (Sci. Comput. Program. 1982).
- **Metwally, Agrawal & El Abbadi**, *"Efficient computation of frequent and top-k
  elements in data streams"* (ICDT 2005) — Space-Saving.

And the substrate anchors already correctly held by the repo: **Budiu, McSherry,
Ryzhyk & Tannen**, *DBSP* (VLDB 2023, `arXiv:2203.16684`) for bilinearity and the
three-term incremental join rewrite; **Goguen & Meseguer** (1982) for noninterference;
**Linstedt**, Data Vault 2.0, for the hub/satellite change-rate partition;
**Meijer** (PLDI FIT 2010) for the observer/iterator duality `RxJoin` sits on.

---

## 4. What must be measured, and why each one

Stage one's list of five is the right list. Restated here with the *decision each one
buys*, because a statistic nobody would act on differently is not a statistic — it is
telemetry, and `src/Core/Metrics.fs` already provides telemetry (counters
`dbsp.ticks`, `dbsp.rows.in`, `dbsp.rows.out`; histograms for tick duration and
allocations, pushed to OTLP) which feeds no decision anywhere.

**1. Per-side arrival rate, λ_L and λ_R — in items per PHASE, never per second.**
Buys: buffer sizing (the number `zipBounded` currently makes the caller invent) and
ferry degree-of-parallelism. Anchor: Viglas & Naughton 2002.

The unit is not a detail. A rate denominated in wall-clock seconds is local time
entering a shared conclusion — two nodes with different receive times compute
different rates, choose different plans, and the run stops replaying. Stage one
refused to default a scheduler for precisely this reason; the statistics layer
inherits the refusal, and it is the single easiest place in the design to get it
wrong, because "rate" pulls toward "per second" in the reader's head automatically.

**2. Per-side distinct key count, V(S, k).** Buys: the Selinger denominator `Plan.fs`
is missing (§2b), hash-table sizing, and the hash-versus-index-nested-loop choice.
Sketch: HLL, which exists. Anchors: Flajolet et al. 2007; Flajolet & Martin 1985.

**This is where the obvious plan is wrong, and it is the sharpest technical finding in
the document.** `Plan.fs` proposes wiring `Sketch.fs` HLL in for real estimates. But
HLL merges by `max` over its registers and has **no decrement operation at all** —
it is monotone by construction. On a DBSP stream, a key that is inserted and later
retracted (`weight = −1`) is still counted by HLL forever. So HLL measures *keys ever
seen*, while `V(S,k)` in the cost formula means *keys currently present*, and on any
retracting stream

> V_HLL(S) ≥ V_true(S), monotonically, with the gap only ever widening.

Because `V` sits in the **denominator**, an inflated `V` makes the join estimate too
*small*, and increasingly so over the circuit's lifetime. That is the dangerous
direction: under-estimated join output means under-sized hash tables and unplanned
memory growth, arriving gradually in a long-running circuit rather than immediately
in a test. Wiring HLL in as the docstring proposes would ship a bias that is
invisible on short runs and worsens forever on long ones.

The same applies to HyperMinHash, which also merges by `max`. This is not a bug in
either sketch — monotone merge is what makes them mergeable CRDTs — it is a mismatch
between a monotone sketch and a retracting stream. `docs/research/bloom-filter-frontier.md`
already identifies **retraction compatibility as "the gating criterion for DBSP"** and
holds Cuckoo and Morton filters for exactly this class of reason. The gating criterion
was applied to membership filters and never applied to the cardinality sketches.

Three ways out, none free, and this needs a decision (§8): a decaying or windowed
distinct-counter so stale keys age out; a retraction-aware distinct-counter; or
accepting the bias and *bounding* it by also tracking the retraction ratio (statistic
6) so the planner knows how much to distrust `V`. The third is the cheapest and the
most honest, and it is what "the meter buys the demarcation, not the claim" argues
for: report `V` **with** its known bias direction rather than reporting a `V` that
looks clean.

**3. Per-side key frequency and skew.** Buys: skew detection, which decides whether a
symmetric hash join degrades. Two streams with identical cardinality, one uniform and
one where the top key holds 40% of rows, have the same estimate and completely
different real cost. Sketches: `CountMinSketch` for the frequency of a *named* key —
and it handles retractions natively, living in ℤ rather than ℕ, which makes it the
one existing sketch that is structurally right for DBSP. `KllSketch` for the
distribution's quantiles, with §3's caveat.

The gap is the roster. **CMS answers "how frequent is key `k`" and cannot enumerate
the frequent keys** — you cannot ask it what the heavy hitters *are*. Detecting skew
requires the roster, so this is genuinely new work: Misra–Gries or Space-Saving. Note
too that CMS's *min* estimator is only valid in the cash-register (non-negative)
model; under retractions the median estimator is the correct one, and `CountMin.fs`
already ships `EstimateMedian` for exactly this reason and says so. Stage two must use
the median path on any retracting input, and that is a choice a caller can silently
get wrong today.

**4. Join selectivity — matched over offered.** Buys: multi-way join ordering.
Sketch: `HyperMinHash.Jaccard` gives `J = |A∩B| / |A∪B|` in a single pass, and it
exists, and its estimator was already audited and corrected once (Lior, 2026-06-06 —
the denominator was the both-occupied bucket count rather than the union, giving a
600% error, now under 2.6%).

**And it is not sufficient, for a reason worth being precise about.** Jaccard over the
*key sets* answers "how many keys match". Join output size is

> Σ_k mult_L(k) · mult_R(k)

a sum of products of **multiplicities**, not a set overlap. A single hot key present
on both sides with multiplicity 1000 contributes 10⁶ output rows and moves Jaccard by
one bucket. So HyperMinHash alone never prices a join — it prices the matching-key
count, and the emitted rows need the multiplicities CMS holds. **Composing them
multiplies two independent approximation errors**, and Ioannidis & Christodoulakis
1991 is precisely the paper on what that does across a multi-way plan: it compounds
exponentially. Leis et al. 2015 measured the same thing on real workloads twenty-four
years later.

The design consequence is not "estimate harder". It is that the planner must be built
so that a wrong estimate degrades performance and never correctness, and so that a
badly wrong estimate is *detected and corrected mid-flight* rather than committed to
at plan time. That is §6.

**5. Window occupancy over phase.** Live lefts, live rights, open windows. Buys:
memory pricing and the spill decision — and it is the exact bound stage one said it
could not provide for `groupJoin`/`join`. Anchors: Kang, Naughton & Viglas 2003;
Srivastava & Widom 2004.

**6. Retraction ratio — the share of deltas carrying negative weight.** Stage one
named it; it deserves its own standing because **it is the statistic no classical
planner has**, since classical planners have no retractions. A DBSP join is bilinear,
so an incremental join is the three-term rewrite
`Δa ⋈ Δb + z⁻¹(I(a)) ⋈ Δb + Δa ⋈ z⁻¹(I(b))` (`src/Core/Incremental.fs:50`), and a
stream that is half retractions does roughly twice the work per unit of *net* change.
It also determines which estimator each sketch may use (CMS median not min), and it
is what bounds the HLL bias in statistic 2. Anchors: Budiu et al. 2023 for the
bilinearity; Cormode & Muthukrishnan for the turnstile/cash-register distinction.

### The decay problem

A classic histogram is computed over a finite relation at a known instant. A stream
has neither a finite extent nor a distinguished instant, so the one-shot histogram
does not transfer and something must take its place. Three families:

**Landmark** — accumulate from the beginning. This is what every sketch in the tree
does today, without saying so. It is wrong for a planner: a key that was hot an hour
ago weighs exactly as much as one hot now, so the plan can never adapt, and the HLL
bias of statistic 2 never decays.

**Sliding window** — exact over the last W. Datar–Gionis–Indyk–Motwani exponential
histograms give (1+ε) counts in O(log²W) space. The most rigorous option. The cost is
that windowed structures **do not compose with the `Union` mergeability** every sketch
in the tree currently provides, and shard-merge depends on that.

**Time decay** — weights age continuously. Either EWMA on the counters, or forward
decay (Cormode, Shkapenyuk, Srivastava & Xu 2009). The distinction inside this family
is the one that matters here: *backward* decay computes weights relative to "now", so
the answer depends on **when you ask** — which is local time re-entering through the
side door, and non-mergeable besides. *Forward* decay fixes weights relative to a
landmark, making the result independent of read time, order-independent, and
mergeable.

**Recommendation — forward decay, landmarked at the circuit's phase 0, decaying in
PHASE and not in wall time.** It follows from the rules rather than from taste:
backward decay reintroduces the local-time leak; sliding windows break the merge
associativity that §5's scale-free and lock-free requirements depend on; forward decay
keeps merge commutative and associative, keeps the answer independent of read time,
and is a pure function of the phase index, so it replays. This is a **recommendation
with a named cost, not a decision** — see §8.1.

---

## 5. Where the numbers come from: the noninterference story

This is the part the brief flags as the obvious hazard, and it has a better answer
than a side channel.

### The wrong design, named so it can be refused

A `StatisticsCollector` that join operators call into: holding counters, sampling a
clock to compute rates, periodically flushing to a catalog. It is ambient in three
independent ways — an undeclared clock, undeclared mutable state shared across
operators, and an unrecorded influence path from data into plan decisions. It also
destroys DST outright: the same input replayed on a faster machine yields different
rates, hence a different plan, hence a differently-shaped run. And it is precisely
the shape §13 exists to forbid.

### The right design is already in the repo, and it is the maintainer's own principle

`src/Core/TableStream.fs` records Aaron #7032: **stream-metadata is just an event
within the same stream as the data — in-band.** The `Delta` type carries
`Upsert | Retract | Meta`, and `toMeta` is a second projection over the one stream,
sitting alongside `toTable`. There is no separate meta-stream; the recursion bottoms
out because the stream describes itself with its own events.

Statistics *are* stream metadata. So:

> **The statistics stream is a `Meta` projection of the stream being measured — not a
> side channel observing it.**

That single move discharges most of the discipline checklist, one item at a time.

**§13 noninterference.** No new door is opened. The statistics enter through the same
door the data does, because they *are* the data folded a second way. The only entropy
a sketch needs beyond its input is its hash seed, and a seed is a value injected at
construction — `CountMinSketch(depth, width, seed)` already takes one. `HyperLogLog`,
`HyperMinHash` and `KllSketch` do **not**, which is a real gap (§7).

**§7 DST.** The fold is pure over `(phase, delta)`. The repo's entropy door is already
this shape: `SoftScheduler.Source = int -> InterruptKind list`, a pure function of the
tick index, and `RecordedSource` already records live crossings at the membrane and
replays them as a `Source` that reproduces the run identically — in **text**, per
no-binary-in-the-proof-lineage. A statistics fold over the same phase index replays
byte-identically by the same argument, and a statistics *recording* is a golden vector
like any other.

**§12 idempotency, and it splits — this needs stating because it is easy to assume
uniformly.** HLL and HyperMinHash merge by `max`, so they are idempotent: re-applying
a delta cannot move the sketch, and replay is free. **CMS merges by `+` and is not
idempotent** — replaying a delta double-counts it. CMS therefore *requires* a
dedup/idempotency key, and the delta's phase index is the natural one. Saying this out
loud is mandatory rather than optional, because the failure is silent: a replayed
stream produces a plausible-looking sketch with every frequency inflated.
`KllSketch.Union` is worse than non-idempotent — it re-`Add`s each element through a
randomised compactor, so it is neither idempotent nor associative, and merge order
changes the answer.

**§8 Data Vault 2.0.** The partition falls out by change rate. The stream is the
**hub**; the statistics are a **satellite** — same key (phase), much faster change
rate, separately stored, and droppable and rebuildable without touching the facts.
That gives the load-bearing invariant of the entire layer, and it is testable:

> **A join's output must be bit-identical with statistics on and off.** Statistics may
> change *how* a result was computed; never *what* it is.

Losing the statistics must degrade the plan and never the answer. This is the single
property most worth pinning with a test first, because it is what keeps the layer from
becoming load-bearing for correctness.

**§1 scale-free and §2 lock-free.** Every sketch here is `Union`-mergeable, so per-shard
collection with a merge at read time requires no coordination and no shared counter.
This is the concrete reason to keep merge-based sketches rather than reaching for an
atomic counter, and it is why the `KllSketch` merge defect is not cosmetic.

**§3 weight-free.** A statistic must not become authority. A plan chosen from
statistics has to stay *revisable* when the statistics turn out to be wrong; a plan
frozen at compile time from one measurement is captured weight — permanent authority
derived from a single observation. This is the argument for §6, and it is a values
argument rather than a performance one.

**Local time, stated for this layer.** Every statistic is denominated in **phase**.
Nothing reads a wall clock. A rate is items-per-phase; a decay is per-phase; a window
is a phase span. Per
`.claude/rules/local-time-never-enters-the-shared-fold.md`, the litmus is whether two
nodes with different receive times could fold different evidence — and a plan chosen
from wall-clock rates is exactly that, for any join whose result depends on
plan-dependent ordering or on shedding.

**The honest limit on all of the above.** Stage one's PR review already established
that this constraint cannot be enforced by a type: every observable inhabits the
duration-selector type, including a wall-clock one. The same is true here — nothing in
a signature prevents a statistics fold from calling `DateTime.UtcNow`. The enforcement
must be a lint, the repo does not have one for F#, and building it is a **precondition
for this layer, not a follow-up to it.** Stage one could survive without it because
one file's negative-control test covered one file. A statistics layer spread across
collection points cannot.

---

## 6. What the statistics are for: the planner's shape, constrained but not built

Not building the planner. But the statistics layer's requirements depend on which
planner it feeds, so the shape has to be pinned far enough to size the layer.

**Plan-once (Selinger 1979).** Gather statistics, enumerate plans, cost them, pick
one, run it. It assumes the statistics are stable and the query is finite. For an
unbounded stream both assumptions fail — there is no final cardinality, and Viglas &
Naughton's rate-based reframing exists because of it. Ioannidis & Christodoulakis and
Leis et al. add that the estimates will be badly wrong anyway.

**Continuously adaptive.** Re-route per tuple or per batch as observed statistics
move. Anchor: **Avnur & Hellerstein**, *"Eddies: continuously adaptive query
processing"* (SIGMOD 2000) — routing replaces planning, and the governing statistic is
each operator's *observed* selectivity rather than a predicted one. Mid-query
correction: **Kabra & DeWitt** (SIGMOD 1998).

**The repo's rules select the second, and on values grounds rather than performance
grounds.** A frozen plan is weight (§3): permanent authority derived from one
measurement, unrevisable when the measurement proves wrong. An eddy's routing decision
is revisable every batch and holds no permanent authority. §1 points the same way — a
plan chosen centrally up front is an appointed coordinator for that query, while
per-operator routing is local. That said, it is a real conflict with what already
exists: `Plan.fs` is built for plan-once, and `docs/research/zeta-sql-frontend-dsl-design.md`
explicitly specifies a *statistics-free static plan*, compiling the AST to a static
physical operator graph at initialisation time to avoid runtime planning. Two shipped
surfaces assume the shape the rules argue against. That is not mine to resolve (§8.2).

**One consequence worth acting on regardless of which shape wins: the eddy's own
statistic is the honest one.** Observed selectivity — how many of the tuples actually
routed here survived — needs no sketch, no hash, no decay policy, and no anchor beyond
counting. And it is exactly the "matched / offered" ratio stage one named. So the
cheapest and most reliable statistic in the whole design is the one requiring none of
the sketch machinery.

The sketches are for the decisions that must be made *before* anything has been
observed: the first batch, and a newly-seen key. That asymmetry should drive the build
order — measure what you did, and only estimate what you have not yet done.

---

## 7. Exists versus new: the ledger, and the defects found on the way

**Exists and usable roughly as-is:** `CountMinSketch` (seeded, snapshottable,
retraction-native, honestly documented, byte-locked across four languages);
`BlockedBloomFilter`/`CountingBloomFilter` (byte-locked, benchmarked, FPR regression
gate); the `RecordedSource` membrane record/replay mechanism; the `TableStream`
`Meta`-projection pattern; the DBSP join family; `Plan.fs` as a *structure* for cost
propagation.

**Exists but cannot be used unmodified:**

- **HLL and HyperMinHash are monotone**, so on retracting streams they measure "ever
  seen" and their bias grows without bound (§4.2). This is the blocking defect.
- **`HyperLogLog.Add(value: 'T)` routes through `HashCode.Combine`, which .NET
  re-seeds per process by design** (anti-hash-flooding). `Sketch.fs` documents this as
  a caveat. **For a planner it is disqualifying, not a caveat**: the same stream
  replayed in a different process yields a different cardinality, a different plan,
  and a run that does not reproduce. Stage two must use `AddBytes` over a canonical
  encoding exclusively — and that must be enforced by a check, because a docstring is
  not a falsifier. The same hazard exists on `CountMinSketch.Add(value: 'T)`.
- **HLL, HyperMinHash and KLL have no `Snapshot`/`OfState`.** CMS and
  `BlockedBloomFilter` do. Without serialisation a statistics satellite cannot be
  checkpointed, so a resumed circuit either loses its plan basis or re-reads history.
- **`KllSketch.Union` is `for x in other.Buffer do this.Add x`** — order-dependent,
  non-associative, and it re-randomises. Shard-merging it does not commute, which
  breaks §1/§2 directly.
- **`KllSketch` holds `let rnd = Random 0` (`NovelMath.fs:123`) — an ambient,
  undeclared entropy source inside a statistic.** It is seeded, so it is not
  nondeterministic across runs of one instance, but it is not *injected*: it cannot be
  varied from the DST seed, cannot be recorded at the membrane, and is invisible to
  any ledger. It is exactly the §13 shape the rest of the repo refuses, sitting in the
  file stage two would build on. Naming this is more useful than the sketch is.
- **HLL, HyperMinHash and KLL are F#-only** — no ports, no golden vectors.

**Genuinely new work:**

- A heavy-hitter roster (Misra–Gries or Space-Saving). CMS cannot enumerate.
- Any decay at all. Every sketch in the tree is landmark-mode and none says so.
- The collection point. Nothing in `ZSet.join`, `IndexedZSet.join`, or `RxJoin` feeds
  any sketch. `Metrics.fs` pushes to OTLP and feeds no decision.
- A statistics catalog. `Catalog.fs` has no statistics columns of any kind.
- The F# no-implicit-scheduler lint (§5), which is a precondition rather than a
  follow-up.
- **A falsifier for `Plan.fs`** — the first deliverable, per §2c and §8.6.
- Fixing the `join` denominator from row count to `V(·,k)` (§2b), which is a
  one-line change that cannot be made until `V` is trustworthy (§4.2).

**Register, honestly.** Nothing in this document is `metered`; it is design, and design
has no falsifier. `RxJoin` is correctly self-registered `unmetered`. The sketches are
individually `unmetered` — they have unit tests, and Bloom has a measured FPR gate and
a BenchmarkDotNet suite, but none has been run against a real workload and none is
wired to a decision. `Plan.fs` is `unmetered` and, per the executed mutation in §2c,
its join estimates are unconstrained by any test.

**What would promote the cost model to `metered`**, stated concretely enough to build:
a test that runs a join over generated data with a **known true cardinality**, compares
`Plan.fs`'s estimate against it, and **fails when the estimate is off by more than a
declared factor** — and that test must itself die under mutation B from §2c. Until such
a test exists, no number `Explain()` prints should be described as an estimate of
anything.

---

## 8. Open questions that need a human decision

**8.1 — the decay family.** Forward decay (recommended, §4), sliding window (more
rigorous, but breaks `Union` mergeability and therefore shard-merge), or landmark
(what ships today, and unusable for a planner). This determines the storage shape of
every statistic, so it should be settled before code rather than discovered during it.

**8.2 — the planner's shape, and it is a live conflict.** The weight-free and
scale-free rules argue for eddies-style continuous routing (§6). `Plan.fs` is built
for plan-once, and `docs/research/zeta-sql-frontend-dsl-design.md` explicitly
specifies a statistics-free static plan compiled at initialisation. Two shipped
surfaces assume the shape the rules argue against. Resolving this is a design-rights
call, not an engineering one.

**8.3 — what is the statistics layer allowed to change?** The proposed invariant is
that statistics may change *how* a join is computed and never *what* it emits —
output bit-identical with statistics on and off (§5). If load shedding is ever wanted
(Das, Gehrke & Riedewald 2003), that invariant breaks by definition. It should break
by explicit decision, once, rather than by drift.

**8.4 — does the statistics satellite need its own privacy budget?** A key-frequency
sketch over a dweller's stream is a fairly detailed record of that stream's key
distribution, and heavy-hitter rosters are re-identification surfaces by design. Under
`privacy-budget-is-hard-money-earned-by-others.md` it is plausible that the statistics
*about* a stream are more revealing than the stream. Not addressed here at all, and it
should be addressed before the layer collects anything from a real dweller.

**8.5 — KLL: repair or replace?** In its current form it cannot be used by a
shard-merged planner (non-associative merge, ambient `Random 0`, single-level so the
cited bound does not apply). Options: repair it (cascade, injected entropy,
associative merge), replace it (t-digest), or drop quantiles from the statistics set
and detect skew from the heavy-hitter roster alone. The third may be the cheapest and
is not obviously worse.

**8.6 — may `Explain()` keep printing unfalsified numbers while stage two is built?**
Given §2c, `rows≈N` is currently a constant wearing an `EXPLAIN`'s clothes. Options:
label it at the surface, gate it behind a flag, or leave it and accept that the first
person to trust the output is misled. My recommendation is the first, but changing a
shipped output format is a call for the maintainer.

**8.7 — four-oracle scope.** Is the statistics layer expected to byte-lock across the
oracles? Today only Bloom and Count-Min are four-language. If yes, the hash choice
must be settled first — a byte-locked sketch requires a byte-locked hash, and
`HashCode.Combine` is not portable at all, not even across two processes of the same
runtime.

**8.8 — the anchor repairs of §3.** Four are mechanical and I would just make them
(add the query-optimisation lineage to `docs/PRIOR-ART-LIST.md`; fix the HyperMinHash
attribution from Cohen–Lemire to Yu & Weber; add Flajolet et al., Flajolet & Martin
and Whang et al. to `Sketch.fs`; re-anchor `KllSketch` to Vitter with KLL named as the
destination). Confirming they are wanted as part of stage two rather than as a
separate hygiene pass is a one-line answer.

---

## 9. Explicitly not being built

The planner. Join reordering and plan enumeration. Physical-operator selection.
Symmetric hash join. Spill-to-disk (XJoin). Load shedding. Adaptive re-planning. Any
change whatsoever to stage one's operators. Cross-language ports of the statistics
layer. `SpineAsofJoin`. Any promotion of `Plan.fs` out of `unmetered`.

The build order this design implies, for whoever picks it up, is deliberately
unglamorous: **the `Plan.fs` falsifier first** (§7 — because everything downstream is
measured against it and today nothing is), then the F# scheduler lint (§5 — because it
is a precondition), then the statistics-on/off bit-identity test (§5 — because it is
what keeps the layer non-load-bearing for correctness), then the observed-selectivity
counter (§6 — because it needs no sketch), and only then the sketch repairs. The
sketches are the visible part and the last part.

---

## 10. Summary of findings

Ten things established while writing this, five of which change what stage two is:

1. Stage one shipped six `RxJoin` combinators in PR #14836; register `unmetered`; the
   five statistics stage two needs are already named correctly in its docstring.
2. **A cost model already ships** (`src/Core/Plan.fs`) and already names the missing
   sketch wiring — so stage two is repair-and-connect, not greenfield.
3. **`Plan.fs`'s tracking pointer is dangling**: `docs/BACKLOG.md` contains no
   "planner" row.
4. **Measured, not asserted:** all 34 `Plan` tests pass with every join cardinality
   heuristic replaced by `999999L`. Exactly one test constrains any estimate's value,
   and it constrains `filter`.
5. **`Plan.fs`'s join formula is Selinger's with row counts substituted for distinct
   values**, which silently hardcodes a primary-key assumption and cannot express a
   many-to-many join.
6. **HLL and HyperMinHash are monotone and cannot represent a shrinking key set**, so
   the wiring `Plan.fs` proposes would ship a bias that inflates `V`, deflates the
   join estimate, and worsens monotonically over a long-running circuit. This is the
   blocking technical finding.
7. **`KllSketch` contains `Random 0`** — an ambient, undeclared entropy source inside
   a statistic — and its `Union` is non-associative.
8. **Four anchor defects**: no query-optimisation lineage in `PRIOR-ART-LIST.md` (and
   its one "Selinger" is the wrong person); HyperMinHash attributed to Cohen–Lemire
   rather than Yu & Weber; HLL implemented with no citation at all; KLL citing a bound
   its single-level implementation does not deliver.
9. **The noninterference answer already exists in the repo**: statistics are a `Meta`
   projection of the stream being measured (Aaron #7032), not a side channel — which
   discharges §13, §7, §8 and §1/§2 in one move, and splits §12 honestly between the
   max-merged sketches and CMS.
10. The wall-clock constraint cannot be enforced by a type, only by a lint, and the
    repo has no F# lint for it — a precondition for this layer rather than a
    follow-up.

---

## Provenance

Written against `abef69dcc`. The two mutation runs in §2c were executed with
`dotnet test -c Release` in a detached worktree and the tree restored afterwards;
`git status --porcelain` was empty before the commit that adds this file. No source
file is modified by this change.

`docs/research/2026-*-*.md` is in the `ignores` list of
`.markdownlint-cli2.jsonc`, so **markdownlint does not check this file** and a green
`lint:markdown` proves nothing about it. Formatting here was checked by reading.
