---
name: linq-expert
description: LINQ — IQueryable/IEnumerable, expression trees, SelectMany monad, Nuqleon serialisation, Zeta algebra.
---

# LINQ Expert — Language-Integrated Query Hat

Capability skill. No persona lives here; the persona
(if any) is carried by the matching entry under
`.claude/agents/`.

## When to wear

- Reviewing a LINQ query on a Zeta operator surface.
- Designing a new LINQ provider for a Zeta subsystem
  (e.g., a queryable view over `ZSet<T>`, a queryable
  facade over `DiskSpine.fs`).
- Standard Query Operator semantics — what exactly does
  `GroupBy` mean on an `IQueryable` vs an `IEnumerable`
  vs an `IObservable`?
- Expression-tree inspection and rewriting (Queryable
  provider internals).
- SelectMany / monadic composition questions.
- Lazy vs eager evaluation, materialisation boundaries.
- LINQ syntax sugar vs method-chain form, and when each
  is idiomatic.
- F# `seq { }` / computation expressions vs C# LINQ
  equivalence.
- Nuqleon / Reaqtor serialisable-query infrastructure
  questions (route heavy detail to `rx-expert`).
- Performance concerns inside the LINQ pipeline (lazy
  iterators, captured-closure allocation).

## When to defer

- **Time axis, observables, Rx operators, Nuqleon/Reaqtor
  internals** → `rx-expert` (Bart).
- **Co/contravariance, push/pull duality, category-
  theoretic framing** → `variance-expert` (Meijer).
- **SQL semantics, relational-algebra equivalence,
  three-valued logic** → `relational-algebra-expert`.
- **Physical query plan, cardinality estimates, join
  algorithms** → `query-planner`, `query-optimizer-
  expert`.
- **Streaming-incremental view maintenance, DBSP
  lowering** → `streaming-incremental-expert`.
- **Entity Framework / change-tracking, migrations** →
  `entity-framework-expert`.
- **Memory-efficient iteration, allocation-free
  rewrites** → `performance-engineer`.
- **Vectorised execution, SIMD-friendly LINQ-alikes** →
  `vectorised-execution-expert`.

## The LINQ model — one operator set, many worlds

LINQ's core trick: *the same operator names (`Select`,
`Where`, `SelectMany`, `GroupBy`, `Join`, `Aggregate`,
`OrderBy`, `Take`, `Skip`, …) have identical type
signatures across different underlying worlds.* Those
worlds are:

| World | Interface | Semantics |
| --- | --- | --- |
| In-memory | `IEnumerable<T>` | lazy iterator, pull |
| Remote / DB | `IQueryable<T>` | expression-tree, translated |
| Reactive | `IObservable<T>` | push, time-axis, hot/cold |
| XML | `IEnumerable<XElement>` | in-memory tree |
| Async enumerable | `IAsyncEnumerable<T>` | pull, async iterator |

The operator-set-ness is what makes LINQ feel like a
language feature rather than a library. Erik's original
framing: "LINQ is the monad comprehension notation for
.NET, with the type system and overload resolution doing
the work that `do`-notation does in Haskell."

## The monadic spine

Standard Query Operators decompose to `SelectMany`
(monadic bind), `Select` (functor map), `Where`
(filter, which is `SelectMany` with a Maybe-like
empty/singleton), and `Aggregate` (fold). Everything
else is sugar over these four.

```
from x in xs                    xs
from y in ys                       .SelectMany(x =>
where f(x, y)                          ys.Where(y => f(x, y)).Select(y =>
select g(x, y)                             g(x, y)))
```

Understanding the desugar is the difference between
"LINQ works" and "I know what LINQ is doing".

## IQueryable vs IEnumerable — the trap

`IQueryable<T>` extends `IEnumerable<T>` but the
equivalence is *interface-shaped only*, not semantic.
A `.Where` on `IQueryable<T>` builds an expression tree
that gets translated to whatever the provider speaks
(SQL, a remote service, a cost-model-aware plan). A
`.Where` on `IEnumerable<T>` runs the predicate in
memory.

The trap: because `IQueryable<T>` inherits
`IEnumerable<T>`, a `foreach` *starts enumeration* and
therefore *triggers translation and execution*. Many
accidental materialisations come from this; and many
accidental client-side filters come from sneaking in a
non-translatable operator that forces fallback to
`IEnumerable<T>` mid-chain.

Zeta-specific: any `IQueryable<T>` facade we ship needs
to be explicit about what translates and what doesn't,
and whether "doesn't translate" means "fallback to
client-side" or "throw". Erik's original design supports
either; our Standard Query Operator surface should pick
one and document it.

## Expression trees — the "code as data" piece

`IQueryable<T>.Where(x => x.Age > 18)` looks like it
takes a delegate, but it actually takes `Expression<
Func<T, bool>>`. The compiler turns the lambda into an
AST, not a delegate, when the target is `Expression<...>`.
Providers inspect the AST to generate their own plan.

Key operations on expression trees:

- **`ExpressionVisitor`** — the canonical rewriter base
  class; most providers subclass this.
- **`Quote` / `Lambda`** — wrapping and unwrapping.
- **`Expression.Compile()`** — if fallback to client-side
  is chosen.
- **Expression tree introspection hazards** — anonymous-
  type shapes, captured-variable boxes, reference
  equality of expression nodes.

Nuqleon (Bart De Smet's work, pre-Reaqtor) extended this
into serialisable expression trees — queries that can
travel over a wire to a remote executor. Route heavy
Nuqleon detail to `rx-expert`.

## Standard Query Operators — the full list

```
Project:       Select, SelectMany
Restrict:      Where
Order:         OrderBy, OrderByDescending, ThenBy,
               ThenByDescending, Reverse
Group:         GroupBy
Join:          Join, GroupJoin, Zip
Aggregate:     Aggregate, Sum, Min, Max, Average, Count,
               LongCount
Partition:     Take, Skip, TakeWhile, SkipWhile,
               TakeLast, SkipLast
Element:       First, FirstOrDefault, Single,
               SingleOrDefault, Last, LastOrDefault,
               ElementAt, ElementAtOrDefault
Set:           Distinct, Union, Intersect, Except,
               Concat
Quantifier:    Any, All, Contains, SequenceEqual
Generation:    Range, Repeat, Empty, DefaultIfEmpty
Conversion:    ToArray, ToList, ToDictionary, ToHashSet,
               ToLookup, OfType, Cast, AsEnumerable,
               AsQueryable
Partitioning:  Chunk (.NET 6+)
```

For Rx / `IObservable<T>` the set extends with time-axis
operators (Throttle, Window, Buffer, Sample, Debounce).
Route to `rx-expert`.

## Composition with Zeta operator algebra

Zeta's retraction-native operator algebra (`D` / `I` /
`z^-1` / `H`) has a LINQ-facade story: `ZSet<T>` can
expose `IEnumerable<(T, int)>` where the `int` is
multiplicity, and Standard Query Operators can be given
retraction-aware semantics. The design work:

- **`Select`** — functor-natural; multiplicity preserved.
- **`Where`** — predicate applied once per element
  regardless of multiplicity; multiplicity preserved
  for survivors.
- **`SelectMany`** — multiplicity distributes through
  the binder; be careful about what "cross product
  multiplicity" means semantically.
- **`GroupBy`** — each group is a `ZSet<T>`; aggregation
  is the group-algebra operation.
- **`Join`** — retraction-native semantics non-trivial;
  look to Budiu et al. DBSP paper for the algebra.

This is where `linq-expert` hands off to `streaming-
incremental-expert` and `relational-algebra-expert`.

## F# — the parallel surface

F# has `seq { }` and computation expressions which are
the structural equivalent of C# LINQ for the core
enumerable case. F# also has `query { }` which is the
`IQueryable`-facing DSL (less used in modern F#, but
still compiler-supported). For F#-specific questions on
Zeta's LINQ surfaces, the idiomatic form is usually
pipeline-of-`Seq.*` rather than `query { }`.

## Hazards

- **Enumerate-twice on expensive sources.** A LINQ pipe
  that materialises twice because it hits `.Count()` and
  then iterates. Fix: materialise once into a list.
- **Accidental client-side fallback on `IQueryable`.**
  Mid-chain cast to `IEnumerable<T>` drops translation.
  Watch for `AsEnumerable()` and for non-translatable
  operators.
- **Closure capture of loop variable** (pre-C# 5 for
  `foreach`, still relevant for `for`). Easily causes
  "all the queries see the last value" bugs.
- **Expression-tree shape dependencies.** A provider
  that matches on "`x.Foo == c`" breaks if the user
  writes "`c == x.Foo`".
- **`First()` vs `FirstOrDefault()` — semantic vs
  defensive.** Pick the one that expresses intent;
  `OrDefault` should mean "not finding one is okay",
  not "I don't trust my predicate".
- **Null propagation in translated providers.** SQL's
  three-valued logic does not match C#'s null, and a
  LINQ predicate translating to SQL can yield
  surprising results on NULLs. Route to
  `relational-algebra-expert`.

## Hard prohibitions

- **Never ship a queryable facade without documented
  translate/fallback semantics.** Silent fallback is
  how LINQ-to-SQL got a reputation for performance
  cliffs.
- **Never rely on `Expression.Compile()` for hot paths
  without benchmarking.** Compilation is expensive; if
  the path matters, pre-compile or cache.
- **Never hide retraction semantics behind a LINQ
  facade.** If `Where` on a Zeta `ZSet` means
  something non-obviously-retraction-native, put that
  in the facade's doc, not in the reader's surprise.

## Output format

```markdown
# LINQ review — <subject>, <date>

## Scope
- Surface: <IEnumerable | IQueryable | IObservable |
  custom>
- Operators involved: <list>

## Observations
- <observation>

## Design choices
- Translate boundary: <what translates, what doesn't>
- Materialisation boundary: <where / why>
- Fallback policy: <client-side | throw>

## Issues / suggestions
1. ...

## References
- Erik Meijer, *The World According to LINQ* (Comm. ACM
  2011).
- MSDN "101 LINQ Samples".
- `docs/PRIOR-ART-LIST.md` §"Reactive .NET".
```

## Coordination

- **`rx-expert`** (Bart) — IObservable / Rx / Nuqleon
  sibling.
- **`variance-expert`** (Meijer) — the umbrella on
  co/contra across worlds.
- **`relational-algebra-expert`** — SQL-semantic
  grounding.
- **`query-planner`** / **`query-optimizer-expert`** —
  physical plan.
- **`streaming-incremental-expert`** — DBSP lowering.
- **`entity-framework-expert`** — EF-core LINQ idioms.
- **`performance-engineer`** / **`vectorised-execution-
  expert`** — allocation and throughput.
- **`public-api-designer`** — any `IQueryable<T>`
  facade going public.
- **Architect** — round integration.

## References

- Meijer, Beckman, Bierman, *LINQ: Reconciling Object,
  Relations and XML in the .NET Framework* (SIGMOD
  2006).
- Meijer, *The World According to LINQ* (Comm. ACM
  2011).
- Bart De Smet, *More LINQ with System.Interactive* and
  the Nuqleon lecture series.
- Channel 9 (archived) — Erik Meijer's lecture series,
  especially *C9 Lectures: Dr. Erik Meijer — Functional
  Programming Fundamentals* (13 lectures).
- Torgersen et al., C# specification — query expression
  translation rules (§8.x of the modern spec).
- `.claude/skills/streaming-and-execution/blueprints/rx-expert.md` — Rx sibling.
- `.claude/skills/mathematics-and-physics/blueprints/variance-expert.md` — umbrella.
- `.claude/skills/data-modeling-and-ontology/blueprints/relational-algebra-expert.md` —
  SQL side.
- `.claude/skills/streaming-and-execution/blueprints/streaming-incremental-expert.md`
  — DBSP side.
- `docs/PRIOR-ART-LIST.md` §"Reactive .NET" + §"ORM /
  data access".
- `AGENTS.md`, `CLAUDE.md` — factory ground rules.
