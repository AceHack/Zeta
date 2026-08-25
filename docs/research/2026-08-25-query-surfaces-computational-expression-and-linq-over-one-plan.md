# Query surfaces: a computational expression and LINQ over one plan

**Date:** 2026-08-25
**Status:** prototype landed — **toy** per `.claude/rules/toy-is-free-metered-must-be-earned.md`
**Code:** `src/Core/QuerySurface.fs` · `src/Core.CSharp/Linq/` ·
`tests/Tests.FSharp/QuerySurface.Equivalence.Tests.fs` ·
`tests/Core.CSharp.Tests/QuerySurfaceLinqTests.cs` ·
`tests/_golden/query-surface-plans.json`

The brief (maintainer, verbatim):

> *"we do want to try to use computational expressions if possible and also linq for
> running our sql queries both, we have some circuit design in computational expressions
> too i think similar but more DBSP than SQL."*

and, resolving the central design tension:

> *"in our perfect world you can write almost the exact same SQL for both — RX like
> subscriptions, expression trees for IQbservable like behavior where events are just like
> rows… just like rx where you can join between streams and tables. in our system they are
> kind of just the same thing since we have the materialized table views."*

---

## 1. What already existed (the survey came first)

The maintainer remembered a circuit CE. He was right, and there was more than he
remembered — including a second, *disconnected* query CE.

| Thing | Where | What it actually is |
|---|---|---|
| **`Dsl.circuit { }`** | `src/Core/Dsl.fs` (120 ln) | **The CE he remembers.** A *reader monad over `Circuit`* — `CircuitM<'T> = delegate of Circuit -> 'T`. `Bind`/`Return`/`ReturnFrom`/`Zero`/`Delay`/`Combine`, every member `inline` + `[<InlineIfLambda>]`. **No `[<CustomOperation>]` at all.** Lifted verbs: `map`, `filter`, `flatMap`, `plus`, `minus`, `distinct`, `delay`, `integrate`, `differentiate`, `join`, `count`, `scalarCount`, `output`. |
| **`zeta { }`** | `src/Core/ZetaSqlBuilder.fs` (65 ln) | A **SQL-shaped** CE with `[<CustomOperation("where")>]`, `select`, `join`. **But it never builds a `Circuit`** — it evaluates *eagerly* over a materialized `ZSet` using `Seq.filter` / `Map.ofSeq`. |
| Fluent extensions | `src/Core/Query.fs` | `Select`/`Where`/`SelectMany`/`Distinct`/`Union`/`Except`/`Count`/`Join` on `Stream<ZSet<_>>`. LINQ-*shaped*, not `IQueryable`. |
| Operator algebra | `src/Core/Operators.fs` | `map · filter · flatMap · plus · minus · neg · distinct · distinctIncremental · join · cartesian · groupBySum · indexWith · indexedJoin` |
| `I` / `D` / `z⁻¹` | `src/Core/Primitive.fs` | `IntegrateZSet`, `DifferentiateZSet`, `DelayZSet` |
| Incrementalization | `src/Core/Incremental.fs` | `Incrementalize` (`D∘Q∘I`), **`IncrementalJoin`** (three-term bilinear), `IncrementalDistinct`, `IncrementalAuto` |
| Cost model | `src/Core/Plan.fs` (97 ln) | Static-heuristic `OpCost` per operator name; `Circuit.Explain()` |
| `IQueryable` / `IQbservable` | — | **Nothing.** Confirmed by listing, not only grepping. |

### 1.1 The finding that shaped the design

**The SQL-shaped CE that existed had no plan.** `Dsl.circuit { }` builds a real DBSP
circuit; `zeta { }` computes an answer directly and never touches the operator algebra.
So the repo already had two query surfaces that shared *nothing* — not a plan, not an
operator, not a cost model.

The maintainer's ask — *both surfaces, lowering to the same thing* — is precisely the
gap. This work does not add a second surface to a working one; it adds **the shared plan
that was missing underneath both**.

### 1.2 A vacuous doc claim, found in passing

`src/Core/Rx.fs`'s header advertises *"a minimal `IQbservable<'T>` skeleton for
expression-tree-based query composition."* There is no `IQbservable` anywhere in that
file — the string does not occur below the docstring. The Meijer/De Smet citations
around it are correct and useful; the claim of a shipped skeleton was not. This
prototype now supplies one.

---

## 2. Verifying the load-bearing claim: is the stream/table duality real?

The maintainer's design rests on *"in our system they are kind of just the same thing
since we have the materialized table views."* That is an empirical claim about the code,
so it was checked rather than assumed. **Verdict: implemented, and used in production
code — not aspirational.**

Evidence, in `src/Core/Primitive.fs`:

- `IntegrateOp` — running sum, `state <- add(state, input)`, marked `IsLinear = true`.
  `IntegrateZSet` instantiates it at `(ZSet.Empty, ZSet.add)`. Its value at any tick **is
  the materialized relation as of now**.
- `DifferentiateOp` — `Value <- cur - prev`, `IsLinear = true`, and its own docstring
  says *"Inverse of `IntegrateOp` (modulo initial conditions)."*

So `table = I(stream)` and `stream = D(table)`, mutually inverse, both linear.

It is **already used exactly this way**: `src/Core/GeneratorIrRegistry.fs` builds
`c.IntegrateZSet input.Stream |> c.Output` and calls the result *"the materialised
relation AS OF the deltas seen so far. This is DBSP's `∫`."*

**One honest correction.** The duality is named *twice*, in two unconnected models.
`src/Core/TableStream.fs` declares the `table`/`stream` noun-classes with
`toTable`/`toStream` and the law `toTable (toStream t) = t` — but over
`Table = Map<string, DynamicValue>` and `Stream = Delta list`, a list-fold model that
never touches `Circuit` or `ZSet`. So there are two correct dualities that do not meet.
This prototype uses the DBSP one and does not attempt to unify them; naming that split
is worth more than papering it.

---

## 3. The design: one plan, two front ends, two modes

```
   F# CE  zquery { }          C# LINQ  IQueryable<T> / IQbservable<T>
          │                              │
          └───────────┬──────────────────┘
                      ▼
              ToyPlan  (closure-free logical plan)      ← the shared referent
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
      Batch mode              Streaming mode
   Circuit.Join            Circuit.IncrementalJoin
          └───────────┬───────────┘
                      ▼
        the EXISTING operator algebra (Operators.fs / Incremental.fs)
```

Nothing new is implemented at the operator layer. Both front ends are translations.

### 3.1 Why the IR is closure-free

`ToyScalar` is a small algebraic expression type (`Col · Lit · Eq · Gt · Lt · AndAlso`),
not a lambda. **This is the property the whole deliverable rests on.** An IR holding
opaque closures would make the equivalence test vacuous: two *different* predicates would
both read as "a filter", and the test would pass for the wrong reason. Closure-freedom is
what makes "the two surfaces produce the same plan" a checkable claim about predicates
and not just about shape.

### 3.2 Resolving set-at-a-time vs delta-at-a-time

The brief asked whether these are one surface or two. **They are one surface, and the
answer is not a compromise — it is DBSP's central theorem.**

`Q^Δ = D ∘ Q ∘ I` says an incremental query is the *same* query conjugated by integrate
and differentiate. Incrementalization is therefore **a lowering pass over a plan**, not a
different query language. So:

- The **plan** is identical in both modes.
- The **mode** changes the lowering at exactly one place — the bilinear `Join`.
- `Where` and `Select` are **linear** (`Q^Δ = Q`), so they are the same operator in both
  modes. That is why the mode knob is one `match` and not a parallel implementation.

A query surface implies a question; an incremental circuit implies a standing
subscription. Both read the same plan; only the feed differs — whole relation at tick 1,
or deltas over many ticks.

**The law, and the falsifier:** `batch(R) == Σ_t streaming(ΔR_t)` where `R = Σ_t ΔR_t`.

This is not free, and it is not decorative. Feeding deltas to the *batch* join operator
returns a **wrong answer rather than an error**. The mutation check below is what stands
between that line and a silent bug.

### 3.3 Where the two front ends genuinely differ

Asked to say precisely what each can express that the other cannot:

| | F# CE | C# LINQ |
|---|---|---|
| Predicates/projections | explicit `ToyScalar` combinators | **typed lambdas** over POCOs, translated from the expression tree |
| Joins | fine — `join` custom operation takes both key expressions | fine — query syntax, incl. transparent identifiers |
| `AsTable` (stream→relation) | yes | push corner only (`IQbservable.AsTable()`) — there is no stream to integrate on the pull corner |
| Type checking of columns | none (columns are strings) | **the compiler checks them** — `o.Amount` must exist on `Order` |

The LINQ surface is genuinely *better typed*. The CE surface is genuinely *more direct*
(no reflection, no expression trees). Neither dominates.

### 3.4 Can an F# CE express joins well? — the honest answer

Mostly yes, with one real caveat, and the caveat is not about joins.

F# CEs are awkward at **binding multiple typed sources into scope** — which is why
FSharp.Core's `query { }` makes its whole body a *quotation* (`member _.Quote()`) and
re-interprets the `Expr` tree. That is how it reaches an `IQueryable` provider at all.

This prototype **neither extends nor wraps nor replaces `query { }`** — it is a separate,
narrower CE. `query { }` is built to target `IQueryable` providers, and `src/Core/Query.fs`
already records why that does not compose with a stream-of-Z-sets model.

The route taken: `zquery src { … }` takes the source as a **builder argument** and uses
explicit `ToyScalar` combinators rather than `[<ProjectionParameter>]` lambdas. Joins are
then unproblematic — `join` is a custom operation taking the right-hand plan and both key
expressions.

**The cost, stated plainly: it is less pretty than `where (fun o -> o.Amount > 100L)`.**
What it buys is an IR that is closure-free by construction. The unimplemented improvement
— `Quote()` plus quotation-splitting to recover `ToyScalar` from a typed lambda — is
strictly more work in the same design, not a different one.

---

## 4. LINQ: both corners of Meijer's duality square

|  | pull | push |
|---|---|---|
| in-memory | `IEnumerable<T>` | `IObservable<T>` |
| expression tree | `IQueryable<T>` | **`IQbservable<T>`** |

`IQbservable` is the type for *"the same query, executed as a standing subscription"* —
exactly the maintainer's ask. Both corners are implemented, and:

> **One translator reads both.** `System.Linq.Queryable.Where` and
> `QbservableOperators.Where` build structurally identical `MethodCallExpression`s, so
> `PlanTranslator` matches on method **name and arity, never declaring type**. The pull
> and push corners collapse onto one code path.

That collapse is the duality **made mechanical rather than asserted**, and
`PullAndPushCornersProduceTheIdenticalPlan` is the test that says so.

Honest note on Rx: `System.Reactive.Linq.Qbservable` *has* a `Join`, but it is the
**duration-based** join (window selectors), not the relational key-based join of the LINQ
query pattern. The relational join is not in Rx's vocabulary, so `QbservableOperators`
supplies query-pattern `Where`/`Select`/`Join`. The `IQbservable<T>` type and
`IQbservableProvider` are Rx's own.

### 4.1 A real finding about C# query syntax

C# emits a **transparent identifier** (`(o, c) => new { o, c }`) for a join **only when
another clause follows it**. With `join` + `select` and nothing between, the compiler
optimizes it away and **fuses the projection into the join's own result selector**.

The first draft of `PlanTranslator` rejected the fused form — i.e. it rejected the most
natural way to write a projecting join. It now **unfuses** it back into Codd's
join-then-project, which is exactly the plan the F# CE produces. Both spellings, one
plan; a `join-project` golden entry is checked from **both** surfaces.

This was caught by a failing test, not by review.

---

## 5. `docs/WONT-DO.md` — the conflict, stated openly

**`docs/WONT-DO.md:387` rejects a "JDBC-like driver / DB-API / `IQueryable` provider"
(Rejected, 2026-04-17).** This work ships an `IQueryable` provider. That must not be
buried, so:

**The objection was specific and it was correct:**

> *"`IQueryable` forces a synchronous-execution contract and baked-in expression-tree
> semantics that don't compose with DBSP's build-then-step model."*

**This prototype does not take the rejected contract.** `ZetaQueryable<T>.GetEnumerator()`
**throws**; the provider's `Execute<T>` returns a **plan**, never rows. There is no
synchronous execution path to compose badly with the async circuit step. A test pins it:
`EnumeratingTheQueryableThrowsRatherThanReturningNothing`.

**The same entry already carves out the substrate this work uses:**

> *"What's rejected here is the pull-LINQ contract, not the expression-tree substrate."*

and names `IQbservable` (Reaqtor / Bonsai slim-IR) as **the direction** — which is the
sibling type shipped here.

**Its own "Revisit when" clause names two triggers, and both have fired:** *"A user
workload specifically needs `IQueryable` compatibility"* (the brief) *"or when the
IQbservable / IAsyncQueryable work begins and the expression-tree substrate needs to be
re-adjudicated"* (this work).

**Amending a WONT-DO row is a gated class** (`.claude/rules/no-directives.md`), so this
prototype **does not edit the entry**. The argument is recorded; the decision stays with
the maintainer. If he declines, the `IQueryable` half should be deleted and the
`IQbservable` half kept — they are separate files precisely so that is a clean cut.

---

## 6. Bonsai: do NOT invent expression-tree serialization

**Bonsai already exists across five oracles** — `src/Core/Bonsai.fs` (39 KB),
`src/Core/BonsaiSoft.fs`, `src/Core.CSharp.Bonsai/`, `src/Core.Rust.Bonsai/`,
`src/Core.TypeScript/bonsai/` (with `golden-vectors.json` + `resume.ts`),
`src/Core.Lean4/Lean4/Bonsai.lean`, plus `tests/Tests.FSharp/Bonsai/`.
Anchor already carried at `docs/PRIOR-ART-LIST.md:140` (Reaqtor / Nuqleon / Bonsai).

### 6.1 Resolving the inert-vs-executable contradiction

A merged PR says *"BonsaiSoft soft evaluator makes the yang half executable"*; open work
item `081KTFME2TQ08QG0R0013CSMRZ` says *"the yang half is inert, AST only"*. Both cannot
be current.

**The work item is STALE in its headline.** `src/Core/BonsaiSoft.fs` ships a real
interpreter: `evalSoft` over `Const · Param · Binary · Cond`, plus `snap threshold` — the
soft→sharp collapse that the work item's *own* RESOLVED section specifies. Its state is
still `backlog`.

**What remains true:** `Lambda` and `Call` return an explicit `Error`, never a silent
wrong answer. So the residue is real but much narrower than "inert". Recommended: retitle
the item to the `Lambda`/`Call` residue rather than close it. *(Not done here — it is the
maintainer's backlog.)*

### 6.2 The division of labour this implies

Bonsai's `Expr` is `Const · Param · Lambda · Binary · Call · Cond` — a **scalar**
expression language. It has **no relational operators**: no filter, project, or join over
relations.

So the two layers are complementary, and the recommendation is precise:

- **`ToyScalar` should be replaced by `Bonsai.Expr`.** It is the same thing, and Bonsai's
  is strictly better: serializable, five oracles, golden vectors, a soft evaluator.
  Keeping `ToyScalar` past the prototype would be exactly the reinvention to avoid.
- **`ToyPlan` is the layer Bonsai does not have** — the relational operators. That is the
  genuinely new part, and it is small.

A persistable standing query is then `Bonsai.Expr` for the scalars inside a relational
plan — which is what "expression trees for `IQbservable`-like behavior" needs, and it is
mostly already built.

---

## 7. What was built, and what was deliberately left out

**Built** (~1,050 lines incl. tests and comments):

- `ToyValue · ToyRow · ToyScalar · ToyPlan · ToyExecutionMode` — closure-free IR
- `ToyPlan.canonical` — the canonical **text** form (the golden vector)
- `zquery { }` — F# CE, `where` / `select` / `join` custom operations
- `ToyLowering.lower` — onto `Circuit.Filter` / `Map` / `Join` / `IncrementalJoin` / `IntegrateZSet`
- `ZetaQueryable` + `ZetaQueryProvider`, `ZetaQbservable` + `ZetaQbservableProvider`,
  `QbservableOperators`, `PlanTranslator`

**Deliberately left out** (scope was tightened on purpose):

- **No SQL parser.** No text→AST anywhere.
- **No planner and no optimizer.** No join reordering, no predicate pushdown, no cost-based
  choice. `src/Core/Plan.fs`'s heuristics are untouched and unused by this path.
- **No aggregation** (`groupBySum`/`count` exist as operators; no plan node reaches them).
- **No `ORDER BY` / `LIMIT` / outer joins / `DISTINCT` / sub-queries / `NULL` semantics.**
  `NULL` in particular is not three-valued logic here; there are no nulls at all.
- **No CQL stream↔relation operators.** No windows, no `Istream`/`Dstream`/`Rstream`.
  `AsTable` is the single stream→relation direction. This is the main reason the
  prototype cannot claim CQL's generality.
- **No lambda-based CE** (see §3.4). No `Quote()`, no quotation splitting.
- **No Bonsai integration** — §6.2 says it should be there; it is not yet.
- **No multi-join / 3+ source scopes.** Refused with an explanation, not approximated.
- **Typed rows are erased to `ToyRow` at execution.** Reflection-free, but the LINQ
  surface's static types do not survive into the runtime rows.

---

## 8. The falsifier, and the mutation check

19 tests across the two surfaces (10 F#, 9 C#), all reading **one shared golden file**,
`tests/_golden/query-surface-plans.json`. Neither surface holds a private copy of the
expected plan — that is what makes "they agree" a fact about one artifact rather than two
constants that happen to match. Text, not binary, per
`.claude/rules/no-binary-in-proof-lineage.md`.

Three independent claims, plus controls:

1. **Plan equivalence** — CE, `IQueryable`, and `IQbservable` all canonicalize to the same
   golden text, and pull/push are additionally compared by **structural equality** on the
   F# union.
2. **Mode equivalence** — `batch(R) == Σ_t streaming(ΔR_t)`, with deltas interleaved so
   both join sides arrive late relative to each other, and including a **retraction**
   (weight `-1`), which is what separates a real Z-set fold from an append-only one.
3. **The negative control** — a stream⋈table join is **not** retroactive and **diverges**
   from batch when the table arrives late. Without this, `AsTable`'s caveat would be
   decoration; with it, the caveat is measured.

**Non-vacuity controls** (each guards a way the above could pass for the wrong reason): a
drifted predicate must *not* match the golden; both sides of the mode law must be
non-empty (`2` rows, not `0 == 0`); an unsupported operator must be **refused** rather
than dropped, since a dropped operator would still compare equal to the CE plan.

### The mutation check

Per `.claude/rules/toy-is-free-metered-must-be-earned.md`, a test that survives mutation
is not a falsifier. Replacing the streaming lowering's `IncrementalJoin` with the batch
`Join` — a one-line change, still compiling with zero warnings:

```
Failed!  - Failed: 3, Passed: 6
```

Three tests die, including both mode-equivalence tests. The plan-equivalence tests
correctly *survive* — a lowering mutation does not change the plan, and they test a
different claim. **The falsifier is real.**

This is what the prototype has earned and no more: `toy` with a working falsifier for the
two claims it makes. It is **not** `metered` — the law is checked against hand-built
fixtures, not a real workload.

---

## 9. Anchors (Beacon)

- **DBSP / Z-sets / `Q^Δ = D∘Q∘I`** — Budiu, McSherry, Ryzhyk, Tannen, *DBSP: Automatic
  Incremental View Maintenance for Rich Query Languages* (VLDB 2023). The substrate
  everything lowers onto; the three-term bilinear join is implemented from this.
- **Differential Dataflow** — McSherry, Murray, Isaacs, Isard (CIDR 2013). The lineage
  DBSP sharpens.
- **LINQ / `IQueryable` / the duality** — **Erik Meijer**: *Subject/Observer is Dual to
  Iterator* (FIT / PLDI 2010) and *Your Mouse is a Database* (ACM Queue 2012). The second
  is the maintainer's framing — "events are just like rows" — in its original form.
- **`IQbservable` engineering** — Bart De Smet, the `IQbservable` series (reaqtive.net);
  the **Reaqtor / Nuqleon** project and its **Bonsai** serialized expression trees, already
  ported here (§6).
- **Monad comprehensions** — Wadler, *Comprehending Monads* (1990) / *Monads for
  functional programming*; and Wadler & Peyton Jones & Trinder, *Comprehensive
  Comprehensions* (Haskell '07) — the direct ancestor of F#'s `query { }` custom
  operations (`where`/`select`/`join` as comprehension clauses).
- **Relational algebra** — Codd, *A Relational Model of Data for Large Shared Data Banks*
  (CACM 1970). `Join`-then-`Select` is Codd's factoring, not a convenience.
- **Stream/relation semantics** — Arasu, Babu, Widom, *The CQL continuous query language*
  (VLDB Journal 2006). Where "events are just like rows" is made rigorous, with explicit
  stream→relation and relation→stream operators. We ship neither direction fully (§7).
- **LINQ over temporal streams, shipped** — Barga, Goldstein, Ali, Hong, *Consistent
  Streaming Through Time* (CIDR 2007) → **SQL Server StreamInsight** (`IQStreamable<T>`).
  The direct ancestor of this design, and the reason "SQL Server CEP" and "LINQ over
  streams" are one lineage rather than two. **Azure Stream Analytics** is its SQL-surface
  descendant — i.e. *two front ends over one engine*, which is exactly this deliverable,
  already validated in production by someone else.
- **Vectorized execution behind a streaming surface** — Chandramouli, Goldstein, Barnett,
  DeLine, Fisher, Platt, Terwilliger, Wernsing, *Trill* (PVLDB 2014). The existence proof
  that columnar+batched internals and a SQL-over-streams surface compose.
- **Unified batch/streaming SQL** — Carbone, Katsifodimos, Ewen, Markl, Haridi, Tzoumas,
  *Apache Flink* (IEEE Data Eng. Bull. 2015), Dynamic Tables; and Begoli, Chandramouli,
  Hueske, Sabharwal et al., *One SQL to Rule Them All* (SIGMOD 2019).

**Clean-room note** (`.claude/rules/cleanroom-two-team-separation.md`): every anchor above
is cited from **published papers and public documentation only**. No competitor engine
source — Flink, Calcite, Trill, StreamInsight, Reaqtor — was read for this work.

---

## 10. Recommended next steps, in order

1. **Maintainer decision on `docs/WONT-DO.md:387`** (§5). Everything else is downstream of
   it; the `IQueryable` half is isolated in its own files so it can be cut cleanly.
2. **Replace `ToyScalar` with `Bonsai.Expr`** (§6.2). Deletes code, gains five-oracle
   serialization and golden vectors, and makes standing queries persistable.
3. **Retitle work item `081KTFME2TQ08QG0R0013CSMRZ`** to the `Lambda`/`Call` residue (§6.1).
4. Aggregation (`groupBySum` already exists as an operator).
5. Lambda-based CE via `Quote()` (§3.4) — strictly additive.
6. Reconcile the two table/stream models (§2) — or record deliberately that they stay
   separate.
7. Only then: a SQL text parser, if it is still wanted. Note it is the *least* load-bearing
   piece — the plan is the product, and both existing front ends already reach it.
