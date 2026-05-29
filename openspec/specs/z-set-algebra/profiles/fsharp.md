# F# profile — z-set-algebra

This profile documents how the z-set-algebra capability is realised in F#
today. Prose bullets, no RFC-2119 keywords; those live in the base `spec.md`.

## Namespace and assemblies

- Every type in this capability lives in the `Zeta.Core` namespace, in the
  `Zeta.Core` assembly. The algebra lives at the top level so C# and F#
  callers share one simple import surface.

## Z-set value type

- `Weight` is an abbreviation for `int64`, defined in `src/Core/Algebra.fs`.
  All Z-set weights are signed 64-bit; checked arithmetic is used on every
  hot-path addition, so an overflow is a thrown exception rather than a silent
  wrap (this realises the "weight arithmetic overflow is observable"
  requirement).
- `ZEntry<'K>` in `src/Core/ZSet.fs` is a `[<Struct; IsReadOnly; NoComparison>]`
  record carrying a key and a weight, kept copy-free for `ReadOnlySpan<'T>`
  passing.
- `ZSet<'K when 'K : comparison>` is a readonly struct wrapping an
  `ImmutableArray<ZEntry<'K>>`. The representation invariants the code relies
  on: entries sorted ascending by key, no duplicate keys, no zero-weight
  entries. Callers that go through `ZSet.ofSeq` get these for free; callers
  using the raw struct constructor accept responsibility for upholding them.
- `ZSet<'K>.Empty` is the canonical empty value and the group zero.

## Z-set module surface (`src/Core/ZSet.fs`)

The `ZSet` module exposes:

- `empty<'K when 'K : comparison> : ZSet<'K>` — the group zero.
- `ofSeq (pairs: ('K * Weight) seq) : ZSet<'K>` — constructor that normalises
  (sorts ascending, merges duplicates, prunes zero weights).
- `add (a: ZSet<'K>) (b: ZSet<'K>) : ZSet<'K>` — element-wise sum; the group
  operation. Linear-time sorted merge, checked addition.
- `sub (a: ZSet<'K>) (b: ZSet<'K>) : ZSet<'K>` — `a + (neg b)`; the group
  inverse operation.
- `neg (a: ZSet<'K>) : ZSet<'K>` — negates every weight.
- `scale (n: Weight) (a: ZSet<'K>) : ZSet<'K>` — multiplies every weight by a
  scalar; `scale 0L` yields `empty`.
- `map (f: 'K -> 'K2) (a: ZSet<'K>) : ZSet<'K2>` — re-keys entries, summing the
  weights of colliding result keys and pruning zeros.
- `filter (predicate: 'K -> bool) (a: ZSet<'K>) : ZSet<'K>` — retains entries
  whose key satisfies the predicate.
- `flatMap (f: 'K -> ZSet<'K2>) (a: ZSet<'K>) : ZSet<'K2>` — expands each key
  to a Z-set, scaling the produced weights by the source weight and summing.
- `cartesian (a: ZSet<'A>) (b: ZSet<'B>) : ZSet<'A * 'B>` — full product;
  every `(ka, wa) × (kb, wb)` yields `((ka, kb), wa * wb)`.
- `join` — bilinear equi-join; matches on a shared key, multiplies matching
  weights, and applies a `combine` to produce the output element.
- `distinct (a: ZSet<'K>) : ZSet<'K>` — projects every non-zero weight to `+1`.
- `distinctIncremental (i: ZSet<'K>) (d: ZSet<'K>) : ZSet<'K>` — the paper's
  `H` function bounded by the delta `d`; emits the change in set membership a
  delta induces against the accumulated state `i`.

There is no `reduce` operator on `ZSet` — aggregation is expressed through
`map`/`flatMap` composed with `add`, not a dedicated reducer.

- Hot-path discipline: operations read inputs through `AsSpan()` and write
  outputs into a pooled array frozen into an `ImmutableArray` at return —
  typically one heap allocation per operation.

## IndexedZSet value type and surface (`src/Core/IndexedZSet.fs`)

- `IndexedZSet<'K, 'V>` is a sorted run of `KeyGroup<'K, 'V>` structs: a Z-set
  of `('K * 'V)` pairs indexed by `'K`, exposing the inner `ZSet<'V>` per key.
- `empty<'K, 'V when 'K : comparison and 'V : comparison> : IndexedZSet<'K, 'V>`
  — the empty index.
- `indexWith` is the primary constructor. Its full constraint set carries
  `'K : not null` in addition to the comparison constraints, so the inline
  signature is:

  ```fsharp
  let inline indexWith<'A, 'K, 'V
      when 'A : comparison and 'K : comparison and 'V : comparison
           and 'K : not null>
      ([<InlineIfLambda>] key: 'A -> 'K)
      ([<InlineIfLambda>] value: 'A -> 'V)
      (z: ZSet<'A>)
      : IndexedZSet<'K, 'V>
  ```

  It transforms a flat `ZSet<'A>` into an `IndexedZSet<'K, 'V>` by applying the
  `key` and `value` extractors to each entry, using a bucket-chained index
  (`bucketHead[k] = first i`, `nextIdx[i] = next i`) that avoids a per-key
  `List<_>` allocation.
- `add (a: IndexedZSet<'K, 'V>) (b: IndexedZSet<'K, 'V>) : IndexedZSet<'K, 'V>`
  — key-wise merge; inner `ZSet<'V>` values are added for shared keys.
- `neg (a: IndexedZSet<'K, 'V>) : IndexedZSet<'K, 'V>` — negates every inner
  weight.
- `join (combine: 'K -> 'VA -> 'VB -> 'C) (a: IndexedZSet<'K, 'VA>) (b: IndexedZSet<'K, 'VB>) : ZSet<'C>`
  — joins the inner Z-sets per shared key.
- `tupleCount (i: IndexedZSet<'K, 'V>) : int` — total number of `(key, value)`
  entries across all groups.
- `toZSet (i: IndexedZSet<'K, 'V>) : ZSet<'K * 'V>` — flattens the index back
  to a flat Z-set of pairs; re-indexing the result reproduces the original.

## Relationship to operator-algebra

The Z-set group operators here are the same group surface the `operator-algebra`
capability's stream operators (`z^-1`, `I`, `D`, `H`) consume; that capability's
F# profile documents the `Op`/`Circuit` machinery. This profile is restricted to
the data-model layer.
