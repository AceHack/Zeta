# The Polymorphic ZSet — the base atom: open-generics dispatch + schema-as-events

**Design note for work-item `081KWFXTHJY08QG0R001TKNG0S`** (ZSet unification).
Author: Otto (shadow\*), 2026-07-01. Seed of the framing: Aaron, 2026-07-01 —
*"this is our base atom almost — the polymorphic, 0-downtime ZSet with schema
evolution, we got math all around this, where schema is also just events on the
ZSet."* Register: **Beacon** (outward-facing, load-bearing — anchored in §9).

---

## 0. Thesis

The substrate's **base atom** is a single type: a **Z-set whose weights range over
any semiring** (`ZSetW<'K,'W>`), that is **live-migratable with zero downtime**, and
whose **schema is itself a Z-set** so that schema evolution is *just more events on
the same fold*. Three properties — polymorphic weight, zero-downtime, schema-as-events
— are not three features bolted together; they are three readings of the **same open
generic over the same DBSP retraction fold**. This note pins the design that lets one
type carry all three without the int64 hot path paying for the generality.

The compression: `int64` Z-set (today's hot path) and a live schema migration are
**both special cases of "events on a semiring-weighted Z-set."** Only-the-irreducible
is primitive; everything else is generated (`only-the-irreducible-is-primitive-generate-the-rest`).

---

## 1. Where we are — two representations, neither is the atom

| Type | Storage | Weight | Role | Limit |
|---|---|---|---|---|
| `ZSet<'K>` (`src/Core/ZSet.fs`) | sorted `ImmutableArray<ZEntry>` | **int64-fixed** | DBSP hot path — cache-friendly linear merges, no per-op virtual call | can't express other weight algebras |
| `WeightedSet<'K,'W>` (`src/Core/WeightedSet.fs`, Aaron 2026-06-07) | `Map<'K,'W>` | any `ISemiring<'W>` | the polymorphic surface; 6 consumers | `Map` storage; runtime-dispatched ring; **not unifiable with `ZSet`** |

`WeightedSet` already delivered polymorphism — which is why the preserved May-era
`ZSetW.fs` (b0697) was **closed as superseded** (`081KWFS6BAM`): landing it verbatim
would be a duplicate type. The one non-redundant idea in `ZSetW.fs` is its storage:
a **sorted `ImmutableArray` byte-identical to `ZSet`** — the *only* representation
from which the unification `type ZSet<'K> = ZSetW<'K,int64,…>` is reachable. That
storage choice is the seed of this work-item.

---

## 2. The atom — one open generic, three readings

```fsharp
// The free object. 'K keys, 'W weights in a semiring, sorted-array storage.
type ZSetW<'K, 'W, 'R when 'K : comparison
                       and 'R : struct
                       and 'R :> ISemiring<'W>>
```

- **Reading A — weight polymorphism (open generics, §3–4).** `'W` ranges over
  `ISemiring<'W>`: `int64` (counting/DBSP), `Tropical` (min,+ → shortest-paths /
  Viterbi), `Interval` (bounded-uncertainty), `Probability`, `Gaussian`, provenance,
  fuzzy. One atom, every algebra.
- **Reading B — schema-as-events (§5).** A *schema* is a `ZSetW<FieldKey, _>`; a
  schema change is a **retraction + insertion delta** on that schema-Z-set, folded
  exactly like a data delta. Already how the repo models it: "schema evolution is a
  DU over the DML meta-updates" (PR #7009).
- **Reading C — zero-downtime (§6).** Because a schema change is *just an event*,
  there is **no privileged stop-the-world migration channel** — the same
  incremental DBSP fold that maintains data also maintains schema. Zero-downtime is
  a *consequence* of readings A+B, not separate machinery (PR #8712,
  GeneratorIrRegistry livestream evolution).

---

## 3. Axis 1 — weight polymorphism: how the algebra rides the open generic

.NET open generics alone cannot dispatch `Add`/`Zero`/`Mul`/`Negate` on an
unconstrained `'W`. Something supplies the semiring. Three mechanisms, differing only
in **when** the algebra is resolved:

| # | Mechanism | Resolved | int64 cost | Langs |
|---|---|---|---|---|
| 1 | **Instance-passing** — `ISemiring<'W>` as a runtime object | runtime | virtual call **per op** | F#, C# |
| 2 | **Struct-ring generic param** — `'R : struct, ISemiring<'W>` | JIT (monomorphized) | devirtualized → inlined `+` | F#, C# |
| 3 | **SRTP / `inline`** — F# member constraints | compile | inlined `+` | F# only |

Path 1 is *dictionary-passing* (Wadler–Blott 1989); paths 2–3 are *monomorphization*
(MLton, Rust). Path 2 works because the CLR emits a **separate JIT body per value-type
instantiation** and devirtualizes interface calls on a struct receiver — so
`ZSetW<'K,int64,IntegerRing>` with a **struct** `IntegerRing` compiles `ring.Add a b`
down to a bare `int64 +`. This is precisely the pattern .NET's own generic math uses
(`where T : INumber<T>`).

---

## 4. Dispatch — DECIDED (Aaron, 2026-07-01)

> **Primary = paths 2 + 3. Path 1 = cold-path escape hatch. C# gets Roslyn-generated
> specialisations as the SRTP-equivalent.**

- **Paths 2 + 3 are the hot-path primary.** Struct-ring monomorphization everywhere;
  SRTP/`inline` on the F# host. `ZSet<'K> ≡ ZSetW<'K,int64,IntegerRing>` — zero overhead.
- **Path 1 is retained but demoted** — the *dynamic-ring / cold-path* escape hatch:
  rings chosen at runtime, one-off research rings not worth monomorphizing, non-hot
  surfaces. Not the default.
- **C# has no SRTP.** To give C# consumers *guaranteed* specialisation (not merely
  JIT-hopeful devirtualization, which is tiered-compilation- and inlining-budget-
  dependent), use **Roslyn source generators to emit the monomorphized per-ring
  code**. This is the C#-side SRTP-equivalent.

**Why the generator is the *right* mechanism, not a hack.** It is
`only-the-irreducible-is-primitive-generate-the-rest` applied to dispatch: the open
generic `ZSetW<,,>` is the **free object**; the generator **reads the free
`ISemiring` interface** and **emits the earned special cases** (`int64`, `Tropical`,
`Interval`, …). `gen(int64)` = the zero-overhead `ZSet`; `gen(gen) == gen`. And the
generated code is **byte-lockable and DST-replayable** — the specialisation is a
checked artifact in the tree, not a runtime hope. (Generators read interfaces, not
classes — the `gen/` discipline; multi-stage programming, Taha–Sheard.)

```csharp
// Roslyn-emitted (sketch): monomorphized int64 specialisation, algebra inlined.
public readonly struct ZSetInt64<TKey> where TKey : IComparable<TKey> {
    // ... sorted ImmutableArray<(TKey, long)> ...
    public static ZSetInt64<TKey> Sum(in ZSetInt64<TKey> a, in ZSetInt64<TKey> b) {
        // two-pointer merge; combine == a + b (NOT ring.Add(a,b)); drop == (w == 0L)
    }
}
```

---

## 5. Axis 2 — schema is a Z-set; evolution is events on it

The move that makes this the *base atom* and not just a faster container: **a schema
is data of the same kind it describes.**

- A **schema** is a finite map `FieldKey → FieldSpec`, i.e. a `ZSetW<FieldKey,
  FieldSpecWeight>`. (Codd's relational model is already "data about data as data";
  Data Vault 2.0 makes the hub/satellite split by change-rate — schema is the
  slow-changing satellite.)
- A **schema change** is a **Z-set delta**: add-field = `+1` insertion; drop-field =
  `−1` **retraction** (the antiparticle — emit/retract duality); rename/retype =
  retraction of the old spec + insertion of the new. Folded by the **same DBSP
  incremental operator** that folds data deltas. This is exactly PR #7009's "schema
  evolution as a DU over the DML meta-updates," and the bidirectional / round-trip-law
  machinery (PRs #6801–#6809) is the up/down invertibility of those deltas.
- **Why a *ring* (not just a semiring) here:** retraction requires additive inverse
  (`negate a `Add` a = zero`). Schema *removal* is a retraction ⇒ the schema-Z-set's
  weight algebra must be a full ring, not a bare semiring. (Tropical has no negate —
  fine for shortest-paths, unusable for a schema that must *forget* a field. The
  atom's generality is real but the schema instantiation constrains `'W` to a ring.)

---

## 6. Axis 3 — zero-downtime is a *consequence*, not a mechanism

If a schema change is just an event on the same fold, there is **no separate
migration path to stop the world for**. Old and new schema coexist as two states of
one incrementally-maintained Z-set; readers project the version they need
(`RecoverState`-style), writers append deltas, and the system is never *between*
schemas — it is always *at* the fold of all deltas so far. This is the DBSP
guarantee (incremental, deterministic replay from a seed) carried to DDL. PR #8712's
GeneratorIrRegistry livestream is this in flight. Zero-downtime falls out of A+B; we
do not build it separately.

---

## 7. Migration plan — land without regressing the hot path

Benchmark-gated (Naledi sign-off); the unification does **not** land if int64
throughput/alloc regresses on the DBSP hot loop.

1. **Design + micro-bench harness first.** BenchmarkDotNet cases: `Sum`, `negate`,
   `scale`, `lookup` on int64, at 10²–10⁶ entries, current `ZSet` vs
   `ZSetW<_,int64,IntegerRing>` (struct ring). Gate: within noise on both time and
   Gen0.
2. **Land `ZSetW<'K,'W,'R>` (sorted-array core)** — revive the storage shape from the
   quarantined `ZSetW.fs`
   (`docs/recovered-orphan-branches-2026-05/misc/backlog/b0697-…/src/Core/ZSetW.fs`),
   re-typed with the struct-ring parameter. Ordinal-collation parity mandatory
   (`culture-invariant-by-default` — the `GCounter.Merge` vs `ZSet.ofSeq`
   associativity bug lives in this exact area).
3. **Reframe `ZSet<'K>`** as either (a) `= ZSetW<'K,int64,IntegerRing>` if the bench
   is clean, or (b) a thin specialised façade over the shared core. Keep the public
   `ZSet` surface byte-for-byte to avoid churn on its consumers.
4. **Roslyn generator** for the C# per-ring specialisations; wire into the build; the
   generated int64 specialisation is byte-locked in golden vectors.
5. **Schema-as-events instantiation** lands *after* the container unification — it
   constrains `'W` to a ring and composes with the existing SchemaEvolution oracle
   suite (10-oracle conformance, TLC safety+liveness).

---

## 8. Risks / open questions

- **Generic code bloat.** One JIT body (path 2) or one generated file (Roslyn) per
  ring. Bounded — the ring set is small and curated; log any cap.
- **JIT devirt is not guaranteed** (tiered comp, inlining budget) — this is *why*
  path 2 alone is insufficient for C# and the Roslyn generator exists (guaranteed).
- **Generator maintenance** — the generator must track `ISemiring` changes; but since
  it *reads the interface*, drift surfaces as a build error (build = verify).
- **Ring vs semiring at the schema layer** (§5) — schema removal needs `negate`;
  document which instantiations are ring-only.
- **Byte-lock across monomorphized instances** — the sorted-array layout must be
  identical across F# SRTP, F# struct-ring, and C# generated forms; one golden vector
  set, all forms conform (the N-oracle discipline; `no-binary-in-proof-lineage`).

---

## 9. Anchors (Beacon)

- **DBSP / incremental Z-sets:** Budiu, McSherry, Ryzhyk, Tannen — *DBSP: Automatic
  Incremental View Maintenance for Rich Query Languages* (VLDB 2023). Differential
  dataflow: McSherry, Murray, Isaacs, Isard — *Naiad* (SOSP 2013).
- **Semirings for weighted data / provenance:** Green, Karvounarakis, Tannen —
  *Provenance Semirings* (PODS 2007). The `ISemiring<'W>` interface is this.
- **Ad-hoc polymorphism / dictionary-passing (= path 1):** Wadler & Blott — *How to
  make ad-hoc polymorphism less ad-hoc* (POPL 1989). Type classes are the runtime
  dictionary; instance-passing is that dictionary made explicit.
- **Monomorphization (= paths 2–3):** MLton (whole-program monomorphization); Rust
  monomorphization; .NET value-type generic specialisation + generic math
  (`INumber<T>`, `IAdditiveIdentity<T>`).
- **Staged metaprogramming / generators (= Roslyn path):** Taha & Sheard — *MetaML
  and multi-stage programming* (2000); Futamura projections (the `gen/` lineage).
- **Schema-as-data / event sourcing:** Codd 1970 (data about data as data); Fowler
  (event sourcing); Data Vault 2.0 (Linstedt) hub/satellite change-rate split —
  schema = slow satellite.
- **In-repo lineage:** `src/Core/WeightedSet.fs` (the polymorphic substrate today),
  `src/Core/ZSet.fs` (the int64 hot path), `src/Core/Semiring.fs` +
  `Zeta.Core.Abstractions` `ISemiring`; SchemaEvolution suite (PRs #6801–#6809
  bidirectional round-trip laws, #7009 schema-as-DU-over-DML, #8567 9/10-oracle +
  TLC, #8712 GeneratorIrRegistry zero-downtime livestream); rules
  `only-the-irreducible-is-primitive-generate-the-rest`, `culture-invariant-by-default`,
  `dv2-data-split-discipline-activated`, `no-binary-in-proof-lineage`.

---

*Substrate-honest close: `dotnet build IS the sanity check`. The polymorphism either
type-checks and benchmarks flat across `IntegerRing / Tropical / Interval`, or it
does not land. This note is the map; the benchmark gate is the territory.*
