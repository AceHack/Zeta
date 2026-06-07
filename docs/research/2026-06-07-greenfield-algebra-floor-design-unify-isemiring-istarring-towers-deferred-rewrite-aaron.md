# Greenfield algebra-floor design — one unified ladder (ISemiring → IStarRing), deferred breaking rewrite (Aaron, 2026-06-07)

Aaron: *"treat this as greenfield, we are at the core, rewrite it to make sense, don't worry about backwards
compatibility"* — scoped to the **algebra/numerics floor** (not all of Core). Sequencing decision: **design
doc now; Lior & Vera finish their current 4-lang port; then land the rewrite as ONE coordinated breaking
change** (the floor's `ISemiring` is on their dispatch board). This is that design. **No code lands from this
doc yet** — it is the target shape the rewrite executes once they checkpoint.

## Why a rewrite (the accidental complexity to remove)

At this pace two algebra-interface families drifted apart (Aaron: *"a good simplification… bound to happen at
this pace"*):

- `Semiring.fs` — `ISemiring<'W>` (`Zero`/`One`/`Add`/`Mul`/`Negate`) + the added ladder `IMonoid`/`IGroup`/
  `ISemilattice`. Consumed by `WeightedSet`, the Z-set ladder, `DynamicValueAlgebra`.
- `CayleyDickson.fs` — `IAlgebra<'A>` (`Zero`/`Add`/`Negate`/`Mul`/`Conj`, **no `One`**) + the towers.

They share a ring core but don't connect, so `WeightedSet<_, Quaternion>` can't typecheck and a bridge would
be a shim (rejected — greenfield unifies, it doesn't paper over).

## Target shape — one ladder

```
IMonoid<'T>      Identity, Combine                              (fold / aggregation)
  └ IGroup<'T>   + Inverse                                      (additive group)
  └ ISemilattice<'T>  (Combine commutative + idempotent)        (CRDT merge / join)

ISemiring<'W>    Zero, One, Add, Mul, Negate                    (the RING core — keep the name)
  └ IStarRing<'W>  + Conj                                       (ring with involution — the *-ring)
```

- **Delete `CayleyDickson.IAlgebra` entirely.** The towers (Complex/Quaternion/Octonion/Sedenion) become
  **`IStarRing` instances** = `ISemiring` (supply the `One` every tower has) + `Conj`. One algebra family.
- **`IStarRing : ISemiring`** — so *every* `ISemiring` consumer takes a tower with zero changes:
  `WeightedSet<'K, Quaternion>`, hypercomplex Z-sets, the soft layer, and the branch-free instance-swap all
  carry hypercomplex weights **for free** (instance-selection, no per-tower code).
- **Honest law caveat:** above ℍ the towers lose `Mul` commutativity (ℍ+) and associativity (𝕆+) and
  alternativity (𝕊+). The interface is a lawful *dictionary of ops*, but `IStarRing` must **document which
  `Mul` laws hold per instance** (a capability/law tag), and consumers needing associativity stay ≤ ℍ. (This
  is why a single `ISemiring` "ring" claim is too strong for octonions+ — carry the law profile as data.)

## Where the rest of the floor lands (already built, kept)

- **Numeric variants** (`DynamicValueNumeric`, `SoftValueNumeric`) — `Result` (CPU/audit) + `Sat` (shader).
  Their different return shapes resolve via the earlier fork: **one algebra interface per return-shape family**
  (a `Result` algebra and a total/`Sat` algebra, each with serial/parallel/sharp/soft instances).
- **Instance-passing, branch-free** — the floor is values you pass; swap serial-sharp ↔ parallel-soft by
  handing in a different instance, never an `if` in the hot path (scale-free, shader-friendly). This is why we
  keep instance-passing over .NET static-abstract generic math (which bakes one impl per type).
- **DUs are the in-between** — a DU merging by a join-semilattice = CRDT-like (parallel, AP); one needing
  total order = consensus-like (serial, CP). The combine-law picks the flow.
- **`DynamicValue`/`SoftValue`** represent the floor: `DynamicValue` via `mergeSemilattice` + leaf numerics;
  `SoftValue` via distribution arithmetic + entropy/cross-entropy/KL. Towers live in the **weight/algebra
  layer** (`WeightedSet`'s `'W`), never as `DynamicValue` document leaves.

## Classification axis — light (tensor-representable) vs dark (non-tensor) algebras

Aaron: *"treat anything that can't be represented as a tensor as a separate class of non-light, like dark
substance algebras… or is that too far?"* **Not too far as a distinction — it is the execution-target
classifier.** The defensible core is a *precise predicate*, with the naming as optional Mirror flavor:

> **Tensor-representable (light):** the element encodes as a fixed-shape **flat numeric buffer** that lowers
> to tensor / SIMD / GPU-shader ops. → runs **parallel**.
> **Non-tensor (dark):** the element is **ragged / symbolic / heterogeneous** and does not lower to a flat
> numeric tensor. → runs **serial / symbolic on CPU**.

| | light (tensor-representable) | dark (non-tensor) |
|---|---|---|
| elements | numeric / hypercomplex weights | arbitrary `DynamicValue` (String/Object), `Bonsai` expr-trees, saga/consensus state |
| floor instances | `ISemiring`/`IStarRing` over `Int`/`Float`/towers; `WeightedSet` w/ numeric `'W`; dense tensors | `mergeSemilattice` over arbitrary `DynamicValue`; SerializedSaga; symbolic algebra |
| execution | parallel — SIMD / GPU / shader (`Sat` variant) | serial — CPU symbolic (`Result` variant) |
| coordination | CRDT-like (commutative, AP) | consensus-like (serialized, CP) |

Same axis as parallel-soft ↔ serial-sharp and the DU CRDT-vs-consensus split, named at the algebra level.
Crucially it stays **branch-free**: the light/dark classification is a **tag carried as data** on each algebra
instance (a capability flag, like the `Mul`-law profile), so it *selects* the execution target without an `if`
in the hot path — instance-selection, not branching.

**Honest naming caveat (Beacon discipline):** "dark substance algebra" is a Mirror coinage; keep it only if
generative. The load-bearing, externally-anchored term is **"tensor-representable vs symbolic/serial"** — a
testable predicate, not a metaphor. (It rhymes with the existing lightcone framing — Landauer-lightcone-local,
privacy-budget radiation — where "light" = what travels/lowers; the rhyme is allowed, the predicate is the
anchor.) If the coinage ever can't compress to the predicate, that is the signal it went too far.

## The rewrite (deferred — execute after Lior/Vera checkpoint)

1. In `Semiring.fs`: add `IStarRing<'W>` (`inherit ISemiring<'W>` + `abstract Conj : 'W -> 'W`) and a
   per-instance law profile (which `Mul` laws hold).
2. In `CayleyDickson.fs`: **delete `IAlgebra`**; the `float` base + `Doubled` doubling implement `IStarRing`
   directly (add `One`); `ImaginaryStack.*` become `IStarRing<…>` values.
3. Fix consumers of `IAlgebra` (only the tower code today) to the unified interface.
4. Prove it: `WeightedSet<string, Quaternion>` add/scale/inner/retraction test (hypercomplex weights through
   the generic floor).
5. Update the dispatch board + the 4-serial/4-lang rows for the unified floor; notify Lior/Vera to re-baseline.

**Breaking, no compat shims** (per greenfield) — but gated on their checkpoint so the byte-lock ports don't
churn mid-flight.

## Beacon anchors

- `*`-ring / involution ring; **C\*-algebra** (analytic cousin). · **Cayley–Dickson** (doubling + conjugation;
  property loss up the tower → law profile as data). · **GraphBLAS** (one API over any semiring — the
  genericity we get once towers are `ISemiring`). · Typeclass-as-dictionary (instance-passing). · Ours:
  `Semiring.fs` ladder, `CayleyDickson.fs` towers, `WeightedSet`, the numeric variants, the branch-free /
  DU-in-between captures (`2026-06-07-one-algebra-many-target-optimized-instances-…`). Honest novelty: none in
  `*`-rings; the contribution is collapsing Zeta's two algebra families into **one floor** so the generic
  substrate (sparse tensor, soft, Z-set, swap) spans scalars → distributions → hypercomplex by instance alone.
