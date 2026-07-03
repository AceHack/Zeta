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
2. ✅ Land `ZSetW<'K,'W>` (sorted-array) as the core (2026-07-01). Revived from
   quarantine, adapted for API drift (curried→tupled `ISemiring` calls to match the
   C#-abstractions interface), landed at `src/Core/ZSetW.fs` + `IntegerRing`/
   `IntervalRing` bridges, 12 tests (`tests/Tests.FSharp/Algebra/ZSetW.Tests.fs`)
   green — int64 matches `ZSet`, interval arithmetic proves the polymorphism bites,
   retraction cancels, ZSet bridge round-trips. **This increment is the
   instance-passing baseline** (path 1 storage-compatible core); the zero-overhead
   struct-ring/SRTP int64 specialisation is step 2b below, NOT yet done.
2b. ✅ DONE + PERF-PROVEN (2026-07-01). `IntegerRing`/`IntervalRing` → `[<Struct>]`
   (stateless; dual register — boxed `.Instance` cold path, by-value hot path).
   `*By` ops on ZSetW (`sumBy`/`ofSeqBy`/`scaleBy`/`negateBy`/`differenceBy`/
   `singletonBy`) take the ring as a struct generic by value → JIT devirtualises the
   `ISemiring` calls per value-type instantiation (NOT `inline` — that collides with
   the `internal` `KeyComparerCache`; struct-monomorphization does the devirt on its
   own). `sumBy` rewritten to the `ZSet.add` allocation shape: `Pool.Rent` workspace
   + single `Pool.FreezeSlice` (one heap alloc) + ordinal `KeyComparerCache`
   (culture-invariant parity — NOT `Comparer.Default`). Correctness: 15 ZSetW tests
   (`*By` == instance; `sumBy` int64 == `ZSet +`); 186 algebra tests green.

   **BDN medium run (bench/Benchmarks/ZSetWBench.fs) — the gate PASSES:**

   | Method            | Size | Mean      | Ratio | Allocated | Alloc Ratio |
   |-------------------|------|-----------|-------|-----------|-------------|
   | ZSetAdd (base)    | 16   |  65.1 ns  | 1.01  |   408 B   | 1.00        |
   | ZSetWInstance     | 16   |  99.6 ns  | 1.55  |   976 B   | 2.39        |
   | **ZSetWStructRing** | 16 | **60.9 ns** | **0.95** | **408 B** | **1.00** |
   | ZSetAdd (base)    | 256  | 724.6 ns  | 1.00  |  6168 B   | 1.00        |
   | ZSetWInstance     | 256  | 1310.6 ns | 1.81  | 14416 B   | 2.34        |
   | **ZSetWStructRing** | 256| **736.4 ns** | **1.02** | **6168 B** | **1.00** |
   | ZSetAdd (base)    | 4096 | 18.01 µs  | 1.00  | 98359 B   | 1.00        |
   | ZSetWInstance     | 4096 | 35.91 µs  | 1.99  | 229528 B  | 2.33        |
   | **ZSetWStructRing** | 4096| **17.91 µs** | **0.99** | **98370 B** | **1.00** |

   Struct-ring MATCHES `ZSet.add` on time (ratio 0.95–1.02) AND allocation (Alloc
   Ratio 1.00) at every size. Boxed instance-passing pays 1.5–2.0× time + 2.3× alloc
   — confirming it is correctly the cold path. **Zero-overhead is proven.**
3. ✅ REFRAME DONE (2026-07-01, Aaron-authorized "we can handle this"). Implemented
   as a **shared kernel**, not delegation-through-copies and not a `ZEntry` type
   abbreviation (F# abbreviations erase from the assembly → would break C#/NuGet
   consumers of the published Zeta.Core; Ilyana conservatism — public surface
   untouched). `src/Core/MergeKernel.fs`: ONE sorted merge-sum, `internal inline`
   (internal-inline may use the internal ordinal `KeyComparerCache`; public-inline
   couldn't — FS1113), generic over entry shape (`IZEntryOps` struct providers:
   `ZEntryOps` for `ZEntry`, `ZEntryWOps` for `ZEntryW`) and struct ring; Pool
   workspace + single FreezeSlice. All THREE sum paths now delegate:
   `ZSet.(+)` (struct `IntegerRing`, fully monomorphised), `ZSetW.sumBy` (struct
   ring straight through), `ZSetW.sum` (boxed ring via struct `BoxedRing` adapter).
   The DBSP hot op exists ONCE; int64 is the monomorphised instantiation
   (generator-is-the-ECC: the special case is derived, not hand-copied).

   **Regression gate PASSED** (BDN medium + a focused tie-breaker run):
   kernel-backed `ZSetAdd` = 60.4–61.2 ns / 740.3 ns / 18.45–18.55 µs vs recorded
   baseline 65.1 / 724.6 / 18.01 — within noise at every size (one 828 ns outlier
   at 256 disproved by the tie-breaker's 740.3 and by same-run StructRing 712.5);
   allocations byte-identical (408 B / 6168 B / ~98.4 KB). Side win: the boxed
   instance path improved ~25–40% and its Alloc Ratio fell 2.3× → **1.00** (the
   kernel's Pool discipline replaced its double-allocating builder).
   Full suite 3741/3741 green.
4. Honor ordinal-collation parity (`culture-invariant-by-default` — the
   `GCounter.Merge` vs `ZSet.ofSeq` associativity bug lives in this area).
   ✅ Enforced in the kernel itself: key order is hard-wired to `KeyComparerCache`
   (the binary-collation default); no ordering site left to drift.
5. ✅ Full `dotnet build -c Release` 0-warnings + tests green + **Naledi perf
   sign-off: SIGN-OFF-WITH-NOTES (2026-07-01)**. Her verified points: semantics
   preserved (old `Checked.(+)` + `<> 0L` ≡ `IntegerRing.Add` + JIT-intrinsic
   equality); struct-'O/'R devirt HOLDS for reference-type keys under shared
   generics (constrained calls on value-type type-params resolve direct even in
   `__Canon` code) — the comparer interface call for string keys is unchanged from
   pre-reframe, so parity is structural; no F#-inline budget risk; BoxedRing = one
   inlined hop, alloc-confirmed.

   **Variance record (her demand):** pre-reframe baseline (medium): 65.08±7.47ns /
   724.56±28.39ns / 18,011±337ns. Post-reframe (medium): 61.16±0.53 / 828.74±48.82 /
   18,454±561. Tie-breaker (medium, ZSetAdd only): 60.43±1.60 / 740.33±22.11 /
   18,548±881. @4096 delta = +443–537ns vs combined σ≈654 → within 1σ (her 2σ
   re-run rule: NOT triggered). Doc-comment drift she caught (`*By` header claimed
   `inline`) fixed same day.

## Remaining follow-ups (Naledi's notes 9–11 + steps 4–5)

- [x] String-key `ZSetWBench` variant (DONE 2026-07-02: exact parity, ratio 1.00 all sizes) (comparer dispatch + `Pool.Return` clear cost
      for reference-type keys — the practical DBSP key type).
- [x] One large benchmark point (DONE 2026-07-02: 65536 ratio 1.04±0.03, alloc identical) (e.g. 65536 entries) for pool-miss / LOH behaviour
      (ZEntry=16B ⇒ cap crosses LOH ~5.3K entries; 4096⊕4096 rents 128KB pooled).
- [x] Baseline table with variance in `docs/BENCHMARKS.md` (DONE 2026-07-02) (durable home, not just
      this work-item).
- [ ] Step 4 — Roslyn source generator: C# per-ring specialisations (the C#-side
      SRTP-equivalent; gen(int64) byte-locked in golden vectors).
- [~] Step 5 — schema-as-events: DESIGN PASS DONE (2026-07-02) — docs/research/2026-07-02-schema-as-events-on-the-zset-design-migrations-become-deltas-down-becomes-negate.md (SchemaZ = ZSet<FieldName*FieldSpec>, migrations become deltas, Down becomes negate, 3 implementation slices). Slice 1 DONE (src/Core/SchemaZ.fs + 11 tests incl. the FsCheck ring theorem, 2026-07-02); slice 2 DONE (MigrationZ.compile derives Up/Down from the delta with rename hints; the ambiguity theorem — rename == remove+add on the schema plane, different data planes — pinned as a test; 2026-07-02); slice 3 DONE (SchemaRegistry.schemaAt: stateful op-stream fold -> SchemaZ at any version; schemaDiff = Z-set difference; ghost ops surfaced as errors; 2026-07-02). STEP 5 COMPLETE — all three axes structural. Step 4 (Roslyn generator): reframed per Aaron 2026-07-02 — the FIRST C# CONSUMER exists as a unit test (SemiringZSetWConsumerTests, #9093) and Iris ran the end-user event-storm. VERDICT: (c) test-only for now; generator gated on the first non-test consumer or NuGet publish. Her do-now fixes landed: CompiledName PascalCase across ZSetW/SchemaZ/MigrationZ, OfValuePairs (ValueTuple ofSeq), SchemaZ.Conflicts payload query. Still open from her review: F5 IRing/ISemiring interface split (compile-time negate safety — own reviewed change, Ilyana); F3 struct-ring-from-C# = the gated generator.

Anchors: [[only-the-irreducible-is-primitive-generate-the-rest]] (int64 is the
monomorphised special case of the free semiring-generic type), `async-all-the-way`
perf discipline. Blocks on nothing; big enough to want a design pass before code.
