---
id: 081KWFXTHJY08QG0R001TKNG0S
type: task
state: backlog
priority: P2
slug: unify-zset-hot-path-into-the-semiring-generic-type-type-zset
title: "Unify ZSet hot-path into the semiring-generic type: type ZSet = ZSetW int64, migrate int64 path, keep perf"
created: 2026-07-01T22:47:03.006Z
depends_on: ["081KWFS6BAM08QG0R0015Y2YZT"]
composes_with: []
---

# Unify ZSet hot-path into the semiring-generic type: type ZSet = ZSetW int64, migrate int64 path, keep perf

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KWFXTHJY08QG0R001TKNG0S-*.md` glob. -->

## The stakes (Aaron, 2026-07-01) — this is the base atom, not a refactor

> "This is our base atom almost — the polymorphic, 0-downtime ZSet with schema
> evolution, we got math all around this, where schema is also just events on the
> ZSet."

Reframe: the unification is not tidiness. The **polymorphic ZSet is the substrate's
base atom**. Three properties travel together and must hold in the one type:

1. **Polymorphic** — weight `'W` ranges over any `ISemiring` (int64, tropical,
   interval, probability, provenance, Gaussian, …). One atom, every algebra.
2. **Zero-downtime** — the atom is live-migratable; no stop-the-world to change
   its shape. (DBSP incrementality + retraction make this reachable.)
3. **Schema-as-events-on-the-ZSet** — schema is not an out-of-band DDL; a schema IS
   a ZSet and schema evolution is just **events (deltas) on that ZSet**. Schema
   change = a retraction+insertion on the schema-ZSet, folded like any other delta.
   This is why 0-downtime is possible: there is no privileged migration channel,
   only more events. The math we have around DBSP / Z-set retraction / semiring
   weights IS the schema-evolution math (see the `SchemaEvolution` oracle work).

Landing the perf-preserving unification (below) is the plumbing; the payoff is that
the base atom is polymorphic AND schema-evolvable through the SAME event fold —
`only-the-irreducible-is-primitive` at the data-model root (int64 ZSet and a schema
migration are both special cases of "events on a semiring-weighted ZSet").

## Why this exists (Otto, 2026-07-01)

Fell out of triaging the preserved `ZSetW.fs` (081KWFS6BAM, now closed as
superseded). The polymorphic-weighted-set-over-`ISemiring` capability already ships
as `src/Core/WeightedSet.fs` (Aaron 2026-06-07, `Map<'K,'W>` storage, 6 consumers),
so landing ZSetW as a second type would be a duplicate. BUT there is one genuinely
non-redundant idea in ZSetW that WeightedSet cannot deliver, and this work-item
captures it as real, scoped work.

## The idea (the only thing that makes a polymorphic ZSet non-redundant)

Today there are TWO representations:
- `ZSet<'K>` — int64-fixed, **sorted `ImmutableArray<ZEntry>`** hot-path (specialised
  for perf: no virtual `ISemiring` call per op, cache-friendly linear merges).
- `WeightedSet<'K,'W>` — semiring-generic but **`Map<'K,'W>`** storage.

The preserved `ZSetW<'K,'W>` uses **sorted-array storage byte-identical to `ZSet`**,
which is the one representation from which the unification `type ZSet<'K> =
ZSetW<'K, int64>` is reachable (WeightedSet's Map storage is not). Collapsing the
two paths into one semiring-generic type — with int64 as a monomorphised special
case — removes a whole parallel substrate.

## The hard part (why this is a design pass, not a move)

`ZSet<'K>` is **deliberately** int64-specialised for the hot path. A naive
`ZSet = ZSetW<_,int64>` reintroduces a virtual `ISemiring<int64>.Add` call per
weight op, which at per-tick / at-scale is exactly the cost the specialisation
avoids. The unification MUST preserve the int64 hot-path perf — via one of:
  - SRTP / `inline` + statically-resolved ring so int64 devirtualises at the call site;
  - a struct `IntegerRing` the JIT can devirtualise;
  - keep `ZSet` as a thin specialised façade over a shared `ZSetW` core.
Requires a benchmark gate (Naledi): the unified int64 path must match current
`ZSet` throughput/alloc on the DBSP hot loop, or the unification does not land.

## Dispatch strategy — DECIDED (Aaron, 2026-07-01)

Of the three ways to ride the semiring on the open generic `ZSetW<'K,'W>`:

1. **Instance-passing** (`ISemiring<'W>` runtime object, virtual per op) — **NOT the
   primary**. Retained only as the **cold-path / dynamic-ring escape hatch**: rings
   chosen at runtime, research rings not worth monomorphising, non-hot surfaces.
2. **Struct-ring generic param + JIT monomorphization**
   (`ZSetW<'K,'W,'R when 'R : struct and 'R :> ISemiring<'W>>`) — **PRIMARY, both
   languages.** Works natively in F# *and* C# (`where TRing : struct, ISemiring<W>`);
   the JIT emits one specialised body per struct ring and devirtualises `Add`/`Zero`
   to inlined primitives. `ZSet<'K> = ZSetW<'K,int64,IntegerRing>` → zero overhead.
3. **SRTP / `inline` + member constraints** — **WANTED on the F# side.** Zero-cost
   static resolution, typeclass-flavored; the natural F#-host form.

**C# has no SRTP.** To give C# consumers the same *guaranteed* specialisation (not
merely JIT-hopeful devirt), use **Roslyn source generators to emit the monomorphised
per-ring code** — the C#-side SRTP-equivalent (Aaron). This is the same discipline as
[[only-the-irreducible-is-primitive-generate-the-rest]] and `gen/` applied to
dispatch: the **generator reads the free `ISemiring` interface and emits the earned
special cases** (int64, tropical, interval, …). The open generic `ZSetW<,>` is the
free object; `gen(int64)` is the zero-overhead specialised `ZSet`; `gen(gen)==gen`.
Generators also give a byte-lockable/DST-replayable specialisation (vs. JIT devirt,
which is tiered-comp/inlining-budget dependent — not guaranteed).

Net target: **paths 2 + 3 are the hot-path primary** (struct-ring monomorphization
everywhere; SRTP on F#; Roslyn-generated specialisations for C#); **path 1 stays as
the dynamic/cold escape hatch**, not the default.

## Definition of done

1. ✅ Design note (2026-07-01): `docs/research/2026-07-01-the-polymorphic-zset-base-atom-open-generics-dispatch-and-schema-as-events-on-the-zset.md`
   — dispatch strategy, the three axes (weight polymorphism / schema-as-events /
   zero-downtime), int64-zero-overhead argument, migration plan, Beacon anchors.
   Remaining DoD items below are the implementation.
2. Land `ZSetW<'K,'W>` (sorted-array) as the core (revive from quarantine:
   `docs/recovered-orphan-branches-2026-05/misc/backlog/b0697-zset-polymorphism-weight-ring/src/Core/ZSetW.fs`).
3. Reframe `ZSet<'K>` in terms of it WITHOUT perf regression (benchmark-gated).
4. Honor ordinal-collation parity (`culture-invariant-by-default` — the
   `GCounter.Merge` vs `ZSet.ofSeq` associativity bug lives in this area).
5. Full `dotnet build -c Release` 0-warnings + tests green + Naledi perf sign-off.

Anchors: [[only-the-irreducible-is-primitive-generate-the-rest]] (int64 is the
monomorphised special case of the free semiring-generic type), `async-all-the-way`
perf discipline. Blocks on nothing; big enough to want a design pass before code.
