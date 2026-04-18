# F# profile — operator-algebra

This profile documents how the operator-algebra capability is realised in F#
today. Prose bullets, no RFC-2119 keywords; those live in the base `spec.md`.

## Namespace and assemblies

- Every type in this capability lives in the `Dbsp.Core` namespace, in the
  `Dbsp.Core` assembly. There is no nested `Algebra` sub-namespace — the
  algebra lives at the top level so C# callers and F# callers see the same
  simple import surface.

## Z-set value type

- `Weight` is an abbreviation for `int64`, defined in `src/Dbsp.Core/Algebra.fs`.
  All Z-set weights are signed 64-bit; checked arithmetic is used on every
  hot-path addition so an overflow is a thrown exception rather than a silent
  wrap.
- `ZEntry<'K>` in `src/Dbsp.Core/ZSet.fs` is a readonly struct carrying a key
  and a weight. The attributes `[<Struct; IsReadOnly; NoComparison>]` keep it
  copy-free when passed via `ReadOnlySpan<'T>` and prevent F#'s structural
  comparison from interfering with the explicit `IComparer<'K>` dispatch used
  by the storage spines.
- `ZSet<'K when 'K : comparison>` is a readonly struct wrapping an
  `ImmutableArray<ZEntry<'K>>`. The invariants the code relies on are:
  entries are sorted ascending by key, no duplicate keys, and no zero-weight
  entries. Callers that go through `ZSet.ofSeq` get these for free; callers
  that use the raw struct constructor accept responsibility for upholding them.
- `ZSet<'K>.Empty` is the canonical empty value and is what every primitive
  operator uses as its "group zero" when the element type is a Z-set.

## Module surface for the Z-set group

- The `ZSet` module in `ZSet.fs` exposes `add`, `sub`, `neg`, `distinct`,
  `distinctIncremental`, `map`, `filter`, `flatMap`, `cartesian`, and `join`.
  `add` and `sub` are the group operations; `distinctIncremental` is the
  paper's `H` function bounded by the delta size.
- Hot-path discipline: every operation reads inputs through `AsSpan()` and
  writes outputs into an array rented from `Pool` (an `ArrayPool<T>.Shared`
  wrapper). The typical operation is exactly one heap allocation — the output
  array that is frozen into an `ImmutableArray` at return.

## Stream operators and circuits

- `Op` is the abstract base class for every operator, defined in
  `src/Dbsp.Core/Circuit.fs`. `Op<'T>` carries a typed output slot backed by a
  `[<VolatileField>]` so `OutputHandle<'T>.Current` reads see a release-ordered
  publication of each tick's output. The `IsStrict` virtual tells the scheduler
  whether the operator breaks feedback cycles.
- `Circuit` is the DAG owner. It holds a register-lock around topology
  mutations, builds a topological schedule via Kahn's algorithm in `Build`,
  and requires that every cycle pass through at least one strict operator.
- `Stream<'T>` is a readonly struct wrapper around an `Op<'T>` — zero-alloc,
  no comparison, no equality; the handle type used by every extension-method
  builder.

## The four primitive operators

- The primitives live in `src/Dbsp.Core/Primitive.fs`:
  - `DelayOp<'T>` is strict. It emits the last tick's input (or the declared
    initial value at tick 0) and captures the current input in `AfterStepAsync`
    for the next tick. The `[<Sealed>]` attribute keeps the devirt path clean.
  - `IntegrateOp<'T>` is causal but not strict: the scheduler runs it after
    its input, so `StepAsync` sees the current tick's delta and folds it into
    a running sum.
  - `DifferentiateOp<'T>` stores the previous-tick input and emits the group
    difference. Also non-strict.
  - `ConstantOp<'T>` publishes a fixed value on every tick.
- There is no separate `Integrator.fs` or `Feedback.fs` file. `FeedbackOp<'T>`
  — the strict feedback cell used to wire recursive cycles — lives alongside
  `RecursiveExtensions` in `src/Dbsp.Core/Recursive.fs`, because feedback is
  scoped to the recursion capability rather than being a primitive.

## Chain-rule helpers

- `IncrementalExtensions` in `src/Dbsp.Core/Incremental.fs` implements
  `Incrementalize`, `IncrementalizeZSet`, `IncrementalJoin`, and
  `IncrementalDistinct`. The file's XML-doc header states the chain-rule
  identity `Q^Δ = D ∘ Q ∘ I` and the three-term bilinear formula for join in
  the shape the tests check against.
- `IncrementalJoin` composes `IntegrateZSet`, `DelayZSet`, `Join`, and `Plus`
  — it is a pure builder; it introduces no new operator class.
- `IncrementalDistinct` composes `IntegrateZSet`, `DelayZSet`, and
  `DistinctIncremental` (the `H` implementation from `ZSet.fs`).

## Invariants the profile commits to

- Every primitive operator on a Z-set stream uses `ZSet<'K>.Empty` as the group
  zero and `ZSet.add` / `ZSet.sub` as the group operations — so the
  retraction-native scenarios in the base spec hold by construction.
- `DelayOp<'T>.IsStrict` is `true`; no other primitive is strict. `Circuit.Build`
  rejects any cycle that does not pass through a strict operator, so the only
  legal cycles are feedback loops.
- Numeric operations on weights use `Checked` arithmetic; an overflow raises
  `OverflowException` rather than silently wrapping and lying about a
  boundary-crossing in `H`.
