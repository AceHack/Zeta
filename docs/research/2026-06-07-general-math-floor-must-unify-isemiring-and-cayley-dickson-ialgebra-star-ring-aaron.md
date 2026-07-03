# Does the numeric floor work over Cayley-Dickson towers? Not yet — two algebra interfaces to unify (Aaron, 2026-06-07)

Aaron: *"does this work on any INumerics like our Cayley-Dickson imaginary towers?"* Honest answer + the
unification it exposes. Grounded in the code.

## Honest answer: not yet — there are TWO disjoint algebra-interface families

Zeta currently has **two** algebra abstractions that overlap but don't connect:

| | `ISemiring<'W>` (`Semiring.fs`) | `IAlgebra<'A>` (`CayleyDickson.fs`) |
|---|---|---|
| members | `Zero`, `One`, `Add`, `Mul`, `Negate` | `Zero`, `Add`, `Negate`, `Mul`, **`Conj`** |
| has `One`? | yes | **no** (though 1 exists in every tower) |
| has conjugation? | no | **yes** (`Conj` — the involution) |
| instances | `IntegerRing`, `IntervalRing`, `ProbabilitySemiring`, `TropicalSemiring` | `float` base + `Doubled<'A>` doubling → `Complex`/`Quaternion`/`Octonion`/`Sedenion` |
| consumed by | `WeightedSet`, ZSet ladder, the floor (`IMonoid`/`IGroup`/`ISemilattice`) | the Cayley-Dickson tower only |

So:

- **`WeightedSet<'K,'W>` (generic over `ISemiring`)** does *not* take a Cayley tower today — a `Quaternion` is
  an `IAlgebra` instance, **not** an `ISemiring` instance. Different interface, no bridge.
- **`DynamicValueNumeric` / `SoftValueNumeric`** are hardwired to `DynamicValue`'s `Int`/`Float` leaves (and
  `SoftValue` = a distribution over `DynamicValue`). `DynamicValue` has **no hypercomplex leaf**, so they
  cannot represent a tower at all.

## The unification: `IAlgebra` is a `*`-ring — make it sit on the floor

`CayleyDickson.IAlgebra` = `Zero`/`Add`/`Negate` (an additive **group**) + `Mul` (a multiplicative **monoid**,
identity `1` exists per tower though unlisted) + `Conj` (an **involution**). That is exactly a **`*`-ring**
(ring with involution). So it is the floor's ladder **plus** `One` **plus** an involution:

```
IMonoid (additive)  ⊂  IGroup (additive, +Negate)  ⊂  Ring (+One,+Mul)  ⊂  *-ring (+Conj)  = IAlgebra
```

The fix is to **make the general floor the common base** so a Cayley tower *is* an instance of it:

- add a `Ring`/`IRing<'T>` rung to the floor (`Zero`/`One`/`Add`/`Mul`/`Negate`) — `ISemiring`'s ring core;
- let `IAlgebra` **be / derive** an `IRing` + an `IInvolution` (`Conj`). (Today `IAlgebra` omits `One`; add it
  — every tower has a multiplicative identity.)
- then **`WeightedSet<'K, Quaternion>`, soft quaternions, hypercomplex Z-sets all work for free** — the
  generic sparse tensor, the "one algebra many instances" swap, and the soft/Bayesian layer apply to
  hypercomplex weights, because a tower now satisfies the floor.

For `DynamicValue`/`SoftValue` specifically to carry towers, the second move is either (a) a hypercomplex
**leaf case** on `DynamicValue` (heavier — public DU change, 4-lang byte-lock), or (b) keep `DynamicValue`
scalar and let the *generic* `WeightedSet`/floor carry towers as the weight type (lighter, recommended) —
i.e. towers live in the algebra/weight layer, not as document leaves.

## So, precisely

- **Generic floor / `WeightedSet`**: *will* work over Cayley towers **once `IAlgebra` is unified onto the
  floor** (a `*`-ring rung). One bridge, then hypercomplex sparse tensors / soft values come for free.
- **`DynamicValue`/`SoftValue` leaf numerics**: do **not** and should **not** grow a hypercomplex leaf;
  towers belong in the weight/algebra layer (`WeightedSet`'s `'W`), not as DV document leaves.

## Buildable next step (bounded)

Add the `IRing<'T>` floor rung + a `*`-ring view, and bridge `CayleyDickson.IAlgebra` to it (give it `One`,
expose it as `IRing` + `Conj`). Then a test: `WeightedSet<string, Quaternion>` adds/scales/contracts —
proving the floor carries hypercomplex weights. (Pending the same return-shape decision as the swappable-
algebra-interface fork; this rung is the additive/total side, so it composes cleanly.)

## Beacon anchors

- **`*`-ring / involution ring** (ring with an involution `*`); **C\*-algebra** (the analytic cousin). ·
  **Cayley–Dickson construction** (Dickson; doubling with conjugation) — `Complex→Quaternion→Octonion→
  Sedenion`, losing order/commutativity/associativity/alternativity up the tower (so the floor rung for towers
  is a (non-assoc) `*`-ring, not a field). · **GraphBLAS** — one sparse-LA API over *any* semiring; the same
  genericity we want over `IRing`/`*`-ring. · Ours: `Semiring.fs` (`ISemiring` + the `IMonoid`/`IGroup`/
  `ISemilattice` ladder), `CayleyDickson.fs` (`IAlgebra` + the towers), `WeightedSet` (the generic consumer).
  Honest novelty: none in `*`-rings or Cayley-Dickson; the contribution is **unifying Zeta's two algebra
  interfaces under one floor** so the generic sparse-tensor / soft / Z-set machinery extends to hypercomplex
  weights by instance-selection alone.
