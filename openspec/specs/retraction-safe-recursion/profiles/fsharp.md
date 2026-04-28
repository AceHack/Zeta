# F# profile — retraction-safe-recursion

This profile documents how the retraction-safe-recursion capability is
realised in F# today. Prose bullets, no RFC-2119; those live in the base
`spec.md`.

## Namespace and source files

- Types and extension methods live in the `Zeta.Core` namespace, assembled
  from:
  - `src/Core/Recursive.fs` — feedback cells, the three recursive
    combinators, and the fixed-point iteration driver.
  - `src/Core/Hierarchy.fs` — `ClosurePair<'N>`, `ClosureTable`, and the
    counting variant that consume this capability.

## Feedback cell

- `FeedbackOp<'T>` in `Recursive.fs` is the strict operator that stands in as
  a source during graph construction and gets wired to its producer later via
  `Connect`. Strict means the circuit scheduler treats it as a seam through
  which a cycle may close; `Circuit.Build`'s topological ordering skips strict
  edges on the way in.
- `FeedbackConnector<'T>` is the one-shot handle returned from
  `Circuit.Feedback` / `Circuit.FeedbackZSet`. `Connect` uses
  `Interlocked.CompareExchange` on an internal `connected` flag so that
  concurrent `Connect` calls resolve to "first caller wins, every other caller
  throws" — there is no moment in which `FeedbackOp.source` is half-written
  while another thread reads it for the schedule.
- `FeedbackOp<'T>` implements `IsStrict = true`, `StepAsync` emits saved
  state, and `AfterStepAsync` captures the producer's value for the next
  tick — giving `z^-1` semantics without a separate fixpoint engine.

## The three recursive combinators

- `Circuit.Recursive` is the retraction-safe combinator. Its body wires
  `Distinct(Plus(seed, feedback))` as `current`, then
  `Distinct(Plus(current, body current))` as `next`, and connects the
  feedback cell to `next`. `Distinct` inside the loop clamps integrated
  weights to `{0, 1}` so retractions that zero a row cause it to disappear
  from the next iteration's body input. Work per outer tick is
  `O(|integrated|)`.
- `Circuit.RecursiveCounting` is the counting combinator. It integrates the
  seed (via `IntegrateZSet`), allocates a feedback cell, and computes
  `next = seedInt + body(feedback)`. No `Distinct` on the feedback path, so
  Z-weights flow freely as derivation counts. The recurrence is deliberately
  `seed + body(fb)` and NOT `seed + body(seed + fb)` — the latter would
  double-count every `body^i(seed)` contribution and produce binomial-
  coefficient-weighted terms instead of the clean series.
- `Circuit.RecursiveSemiNaive` is the monotone-only Bancilhon-Ramakrishnan
  combinator. Its XML-doc header in `Recursive.fs` carries an explicit
  WARNING paragraph stating that it leaks retracted facts and pointing
  readers at `Recursive` for retraction-bearing workloads. `ClosureTable`
  was reverted off this combinator in round-17 for exactly that reason.

## Preconditions encoded in XML doc

- `RecursiveCounting`'s doc-comment enumerates two preconditions: the body
  must be Z-linear (`Map`, `Filter`, `Plus`, `Minus`, `Join`, `IndexedJoin`,
  `FlatMap`, `Cartesian`, `GroupBySum` qualify; `Distinct` and
  `DistinctIncremental` do NOT), and the derivation graph must be acyclic
  so counts stay bounded. Cyclic inputs do not terminate here.
- `RecursiveSemiNaive`'s doc-comment states the monotone-input precondition
  and names it as the round-17 ClosureTable correctness bug.

## Closure-table companions

- `ClosurePair<'N>` in `Hierarchy.fs` is a readonly struct carrying
  `Ancestor`, `Descendant`, `Depth`. Its `Equals`/`GetHashCode` both route
  through `EqualityComparer<'N>.Default` so the contract holds symmetrically
  — a prior version used ordered comparison for `Equals` and native hashing,
  breaking the contract for types whose equality and comparison disagree.
- `Circuit.ClosureTable` is the default transitive-closure combinator. It
  maps each edge to a depth-1 `ClosurePair`, defines the body as a join
  between the current closure and the edge stream, and wraps the pair in
  `Circuit.Recursive`. A round-17 correctness fix moved it off
  `RecursiveSemiNaive` for retraction safety.
- `Circuit.CountingClosureTable` is the counting variant. It integrates the
  edge stream (so `body` can re-read edges on every inner tick without
  double-integration through the seed integrator that `RecursiveCounting`
  applies internally), maps edges to depth-1 pairs, and wraps in
  `RecursiveCounting`. Retraction-safety comes via Z-linearity of `Join`.

## Fixed-point iteration driver

- `Circuit.IterateToFixedPoint` advances the circuit until the observed
  output equals the previous tick's value or the cap is reached. It returns
  the iteration count.
- `Circuit.IterateToFixedPointWithConvergence` returns
  `struct (iterations: int, converged: bool)` so callers can enforce "must
  converge" as a hard invariant and distinguish it from "hit the cap".

## Hot-path discipline

- Every combinator is a circuit builder — it registers operator instances and
  returns a `Stream<'T>`. No per-tick allocation is introduced by the
  combinators themselves; per-tick cost is in `Distinct` / `Join` / `Plus`
  primitives already covered by the operator-algebra profile.
- `FeedbackOp<'T>`'s `connected` flag is a `[<VolatileField>]` `int` mutated
  only via `Interlocked.CompareExchange`; readers see a consistent `source`
  without locking.
