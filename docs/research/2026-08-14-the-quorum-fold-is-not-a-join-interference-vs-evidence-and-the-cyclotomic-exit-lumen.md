# The quorum fold is not a join - interference vs evidence, and the cyclotomic exit

**Lumen, 2026-08-14.** Finding from the #10540 alternatives pass, landed against the layer Aaron placed
the Born boundary on the night before (`2026-08-13-what-does-253ms-mean-without-a-wall-clock-and-where-amplitudes-live.md`
Parts 2-3). Everything marked **CHECKED** was measured by a test that fails if the claim is wrong
(`tests/Tests.FSharp/QuorumAlgebra.Tests.fs`, 18 tests, all green).

---

## 0. Verdict in five lines

1. **`AmplitudeEmu.merge` was never a join** - it sums, so `merge (a @ a) = 2a`. **CHECKED.**
2. **That is a TYPING defect, and it is the primary one.** One name carried two algebras. Aaron's call:
   *"we can support join and interference both operations and name them differently."* Done -
   `src/Core/QuorumAlgebra.fs`, `join` and `interfere`, distinct names, distinct laws. **No arithmetic
   changed.**
3. **There is ALSO a real arithmetic defect underneath it** - the `EPS = 1e-12` drop breaks associativity
   **structurally** (not at float-noise scale) and breaks **scale-covariance**, which is a physics error:
   an absolute threshold in a theory whose states are rays. **CHECKED, with magnitudes below.**
4. **Algebraically the quorum layer is the additive group of the free C-module `C[Outcome]`** - a
   commutative monoid with inverses, **not** idempotent, so **spec 12 is declined by design, not violated
   by accident**. The implementation realises that group only *up to* the epsilon, which is why (3) is
   separable from (2).
5. **`Z[zeta_N]` is reachable, and cheaply - at the quorum layer specifically**, because the quorum fold
   is **depth-1**. It is *not* reachable for the continuous-phi interferometer sweeps, which should stay
   float and stay labelled outside the byte-lock treaty. Recommendation: **N = 16** (or 8), argued in 5.

---

## 1. Which law fails, and by how much (CHECKED)

The binary combine is `interfere a b = merge (a @ b)`. On the abstract carrier `C[Outcome]` this is vector
addition - commutative, associative, unit `[]`, inverses. In the implementation:

| law | on `C[Outcome]` | in `AmplitudeEmu` | measured witness |
|---|---|---|---|
| idempotency `a + a = a` | **false by design** | false | `interfere a a` gives amplitude `2.0` |
| associativity | true | **FALSE, structurally** | see below |
| commutativity (value) | true | fails under float re-association | `[1.0]` vs `[1e16, -1e16]` gives `[]` one way, `1.0` the other |
| commutativity (representation) | n/a | fails - output list order tracks input order | `interfere x y` differs from `interfere y x` as lists |
| unit `[]` | true | true up to the drop | - |
| scale covariance | true | **FALSE** | see below |
| `merge . merge = merge` (normalisation) | true | **TRUE** | holds |

### 1a. The associativity witness, and its magnitude

`EPS = 1e-12` is compared against `|z|^2`, so it deletes any branch whose **sum** has `|z|` at or below
`1e-6`. The largest amplitude that can be silently deleted is therefore **`sqrt(EPS) = 1e-6`**, not
`1e-12`.

Witness A - the two groupings disagree about whether a state **exists**:

```
a = [f -> 1.0]    b = [f -> -1.0 + 8e-7]    c = [f -> 8e-7]

(a + b) + c  =  []                  -> bornProb = [],       measure = None
a + (b + c)  =  [f -> 1.6e-6]       -> bornProb = [f -> 1], measure = Some f
```

Left grouping: `a+b = 8e-7` is deleted *before* `c` can be added to it. Right grouping: `b+c` stays large,
so the residual survives. **Gap: 1.6e-6 in amplitude; categorical in outcome.**

Witness B - the same failure with a surviving third term, to fix the scale of the error:

```
a = [f -> 1.0]   b = [f -> -1.0 + 1e-7]   c = [f -> 5.0]

(a + b) + c = 5.0            a + (b + c) = 5.0000001
gap = 1.0000000028e-7  =  1.13e8 ULPs of 5.0
```

**1.1e8 ULPs is not rounding.** A float-epsilon violation would sit at 1-10 ULPs. This is the drop.

### 1b. Scale covariance - the physics error

A quantum state is a **ray**: only `|z|^2 / sum|z|^2` is observable, so multiplying every amplitude by a
constant is the identity. `merge` is not homogeneous:

```
a       = [f -> 1.0, f -> -1.0 + 2e-6, g -> 1.0]   ->  support 2,  born = [f -> 4e-12, g -> 1.0]
0.5 * a                                            ->  support 1,  born = [g -> 1.0]
```

**Halving a state changes its measured probabilities.** The root cause is dimensional: `EPS` is compared
against `|z|^2` - an *intensity* - so it introduces an absolute scale into a theory that has none. That is
the metering-test failing: the constant is dimensionally inadmissible, and no value of it is right,
because the quantity it thresholds is not physical on its own.

### 1c. The deeper statement - `merge` is a function of the writing-down, not of the state

Combining 1a and the commutativity row: two lists denoting the *same* vector in `C[Outcome]` can merge to
different results. So `merge` does not descend to the quotient - it is a function of the representation.
For a layer whose entire content is that **states are what is physical and representations are not**, that
is the sharpest way to say what is wrong.

---

## 2. Arithmetic defect or typing defect? Both, and they are independent

This matters for the fix, so it is worth separating cleanly:

- **The typing defect** (primary, Aaron's call): one operation, two algebras, no way for a caller to tell
  which they invoked. It is the operator-level form of the same lesson landing elsewhere this week -
  *a bare scalar is where distinctions go to die*. `1.2: float` could not carry **why** it held;
  `merge` could not carry **which law** it obeyed. The fix is the same move as `BoundJustification` and
  `LossSignal`: **split until each name means one thing.** Fixed here, with zero arithmetic change.
- **The arithmetic defect** (secondary, real, NOT fixed here): the `EPS` drop. This one would still be
  wrong even if the naming were perfect, because it breaks associativity and scale-covariance for the
  *sum itself* - laws the free C-module genuinely has and that this layer needs.

**Idempotency (spec 12) is on the typing side, not the arithmetic side.** `interfere a a = 2a` is
**correct**. Interference is the instrument: a quorum that can disagree with itself to zero is what the
Bayesian layer structurally cannot express (bug B3 - six agents on one stream reporting `precision = 66.0`
on a mean wrong by 5.66, because addition has no way to represent disagreement). So spec 12 is **declined
at this layer, out loud**, and the guard is that the *other* operation - the one that IS idempotent - now
exists and is named `join`.

---

## 3. What the quorum layer IS, algebraically

**The additive group of the free C-module on outcomes, `C[Outcome]`.** Concretely:

- **carrier**: finitely-supported functions from `Outcome` to `C`;
- **combine**: pointwise addition - commutative, associative, unit `0` (the empty superposition), and
  **inverses exist** (`x + (-x) = 0`, which is exactly destructive interference);
- **not idempotent**, and it cannot be made so without destroying interference;
- **`step` is a C-linear map** on this module, so evolution is linear and readout (`bornProb`) is
  quadratic - the standard shape;
- **not a semilattice, not a CRDT, not a `universal/evidence` member.**

The `EPS` drop is a **nonlinearity** bolted onto a structure whose entire content is linearity. Stated
that way it is recognisable: it is a crude, deterministic localisation - the same *shape* as a
spontaneous-collapse modification of linear evolution (Ghirardi-Rimini-Weber 1986), minus the stochastic
structure that makes those models consistent.

CONJECTURE Z-EPS (PROPOSED, with a falsifier). Because the drop is nonlinear and threshold-based, a
bipartite state tuned near the threshold should exhibit **signalling** inside the emulator: Alice's
marginal Born distribution should change when Bob changes only his local phase. Nonlinear modifications of
quantum evolution generically permit exactly this (Gisin 1990).

- **Falsifier:** construct a two-party state in `BipartiteMachZehnder` whose joint branches sit within
  `1e-6` of the threshold and sweep Bob's setting; if Alice's marginal is invariant to within the fold's
  own reproducibility, the conjecture is dead.
- **Scheme-independence it must survive:** the effect must persist under an overall renormalisation of the
  state - it should *not*, if `EPS` is the cause, so the same experiment on a state scaled far above
  threshold is the control.
- **This is a statement about our emulator, not about physics.** Hand to Soraya for the formal side; the
  check itself is cheap and executable.

---

## 4. What shipped

| surface | what it does |
|---|---|
| `src/Core/QuorumAlgebra.fs` | **the split.** `interfere` (sum, not idempotent) and `join` (source-keyed bounded join-semilattice, idempotent), plus `interfereQuorum` - the named join-to-interference crossing - and `interferenceExcess`, the neutral cancellation measurement |
| `src/Core/AmplitudeEmu.fs` | `mergeOf` / `intensityOf` / `bornProbOf`: the same arithmetic, lifted off `Chip8Cow.Frame`. A Laws header stating what fails and by how much. **No behaviour change** - `merge = mergeOf`, and `step`'s duplicated tail now calls it |
| `universal/interference.md` | the sibling shape (see 6 for why sibling, not a section) |
| `universal/evidence.md` | one honest-boundary section: the shape stops above the agent, and the quorum layer is explicitly not a member |
| `tests/Tests.FSharp/QuorumAlgebra.Tests.fs` | 18 tests: join laws hold exactly; interference laws fail with the measured magnitudes above; the exact-ring demonstration of 5 |

Two design consequences worth naming:

- **`interfereQuorum` restores reproducibility without restoring exactness.** It folds in **ordinal
  source-key order**, so three nodes receiving the same contributions in three different arrival orders
  produce byte-identical results (CHECKED). The arithmetic is still inexact; it is no longer *divergent*.
- **The composition order is now stated: join, then interfere, then Born.** Dedupe by source first (that
  is the B3 fix), sum the distinct sources second (that is where phases cancel), cross to probabilities
  last and never back.

---

## 5. Is `Z[zeta_N]` reachable here? Yes at the quorum layer, cheaply. No for the phi-sweeps.

The observation behind the question: **unitary modular data is cyclotomic** - the entries of the `S` and
`T` matrices of a modular tensor category lie in a cyclotomic field (Coste-Gannon 1994; proved in general
by Ng-Schauenburg 2010 via congruence subgroups). So restricting phases to `N`-th roots of unity is not a
crude approximation; it is where this class of data already lives.

### 5a. What phases the code actually produces

| source | phase | cyclotomic? |
|---|---|---|
| `SoftChip8.forkOnInput` | none - real `sqrt(0.5) = 1/sqrt2` per branch | **yes**: `1/sqrt2 = (z8 + z8^-1)/2` |
| `AmplitudeEmu.ofSoft` | phase 0 | trivially |
| `QuantumObservableTreaty.closedInterferometer` | **continuous `phi: float`** | **no** - `e^(i phi)` is transcendental for generic phi |
| `WSet.MachZehnder` tests | continuous phi sweep | no |
| `QuorumPhaseCancellation.tla` (Soraya) | **4th roots of unity** - already restricted, for exactness | yes: `Z[i] = Z[zeta_4]` |

**The split is clean and it is not a compromise.** The continuous-phi uses are *visibility curves* - an
analytical demonstration that sweeps a parameter. They are not quorum folds and never carry a byte-locked
claim. The quorum use is a finite set of members each contributing one phase, which is exactly the case
`Z[zeta_N]` is for.

### 5b. What `N`, and what it costs

Represent an amplitude as `(1/sqrt2)^k * sum_i a_i * zeta_N^i` - phi(N) integers plus a denominator
exponent `k` (the standard denominator-exponent form used for exact synthesis).

| `N` | Z-rank phi(N) | contains | why you would pick it |
|---|---|---|---|
| 4 | 2 | `i` | matches Soraya's TLA+ restriction exactly; no `1/sqrt2` |
| **8** | **4** | `i`, `sqrt2`, `1/sqrt2` | **Clifford+T's exact ring** `Z[1/sqrt2, i]` (Giles-Selinger 2013; Kliuchnikov-Maslov-Mosca 2013); covers the 0.5-probability fork's `1/sqrt2`, the only irrational CHIP-8 actually produces |
| **16** | **8** | zeta_8 and zeta_4, plus 16 distinct phases | **one root of unity per key of the 16-key `ActionGrammar` alphabet** (the 4x4 grid), and it contains N=8 and N=4 |

**Cost, and why it is small here:** the decisive fact is that **the quorum fold is depth-1.** It is one
addition layer over `m` members, not a deep circuit. Exact-synthesis cost stories are about *depth* -
coefficient bit-length grows roughly linearly with circuit depth, which is what makes exact arithmetic
expensive for long computations. A sum of `m` bounded coefficients grows by `log2 m` bits. For a quorum of
a thousand members that is ten bits. **So exactness at this layer costs phi(N) machine integers per
amplitude (4 at N=8, 8 at N=16) against 2 floats today - a constant factor of 2-4x memory and no
compounding.** Addition is componentwise; multiplication (only needed if gates are applied) is a cyclic
convolution mod the Nth cyclotomic polynomial, `O(phi(N)^2)` integer ops.

### 5c. What exactness buys - three things, and only the first is byte-lock

1. **Byte-lock.** Integers serialise identically in all four oracles. Today the amplitude layer cannot
   carry a byte-locked claim at all, and the module now says so.
2. **The laws come back.** In an exact ring the only thing dropped is an **exact zero**, and dropping an
   additive identity cannot change any later sum - so associativity and scale-covariance are restored
   *and destructive interference is fully preserved*. **CHECKED**: the same fold over `Z[i]` is exactly
   associative on the witness that breaks the float one, still annihilates on exact cancellation, and
   still gives `a + a = 2a`. **The instrument survives exactness; only the epsilon dies.**
3. **`join`'s conflict detection becomes sound.** The join reports a source that said two different
   things. With floats, two representations of the same state can compare unequal, so a source can be
   convicted of conflicting with itself by a rounding difference. Exact equality removes a false-positive
   class the naming fix cannot touch. **This reason is independent of byte-lock and is the one most likely
   to bite first.**

And a fourth, which is the reason to do it soon: **Soraya's TLA+ model already restricted to `Z[zeta_4]`
to be checkable at all.** If the implementation moves to `Z[zeta_N]` with `4` dividing `N`, the model and
the code share a carrier, and **TLC counterexamples become directly executable F# tests.** That is a
proof-to-code bridge we do not currently have anywhere.

### 5d. Recommendation

**PROPOSED:** implement `Z[zeta_16]` (phi = 8, contains zeta_8 and zeta_4) as the quorum-layer amplitude
carrier, with phases keyed to the 16-key action alphabet; keep `AmplitudeEmu`'s float path for the
continuous-phi analytical demos and label it permanently outside the byte-lock treaty. Fall back to
`Z[zeta_8]` if the 16-phase alphabet turns out not to be wanted - the Clifford+T ring is the
better-anchored choice and `phi(8) = 4` is half the width. **Not implemented here**: it is a carrier
change, it deserves its own review, and this PR deliberately changes no arithmetic.

---

## 6. Sibling file, not a section of `evidence` - and why

Asked, and answered: **sibling.** `universal/interference.md`.

The two shapes assert **contradictory closure properties**, and both are load-bearing. Evidence's is
*"the result of a fold is a valid input to the next fold up"* under an **idempotent** join - that is what
makes it scale-free across individual, society, world. Interference's is that contributions can
**destroy** each other, which requires **inverses and non-idempotence**. Putting them in one file would
make that file claim both, and a reader taking the shape would not know which they had taken - which is
the exact defect at the operator level that this whole finding is about. `universal/` is
one-shape-per-file for this reason.

What `evidence.md` gets instead is a boundary section: the shape **stops above the individual agent**, and
the quorum layer is named as a non-member with a pointer. Nothing in evidence weakens; it just stops
silently claiming a layer that was never taking its shape.

---

## 7. Anchors (Beacon)

*Cited from standing knowledge, not page-checked - flagged per the checked-anchors discipline.*

- **Feynman & Hibbs 1965**, *Quantum Mechanics and Path Integrals* - amplitudes for **distinct paths** add;
  this is the operation `interfere` names, and the reason it is a sum and not a join.
- **Born 1926** - the `|psi|^2` rule; the one-way crossing out of amplitudes.
- **Shapiro, Preguica, Baquero & Zawirski 2011** - state-based CRDT join-semilattice; the family the
  quorum layer is explicitly **outside**.
- **Ghirardi, Rimini & Weber 1986** - spontaneous localisation; the shape a threshold-drop imitates.
- **Gisin 1990** - nonlinear evolution permits superluminal signalling; the source of conjecture Z-EPS.
- **Coste & Gannon 1994; Ng & Schauenburg 2010** - modular data is cyclotomic; the licence for `Z[zeta_N]`.
- **Giles & Selinger 2013; Kliuchnikov, Maslov & Mosca 2013** - exact synthesis over `Z[1/sqrt2, i]`
  (= `Z[zeta_8, 1/sqrt2]`); the concrete ring, and the denominator-exponent representation.
- **Meijer** - `IEnumerable` / `IObservable` duality; the Rx vocabulary licence: "combine two streams" was
  never one operation, which is why Rx has `merge`, `concat`, `zip`, `combineLatest`, `amb`, `scan`.
- **Goguen & Meseguer 1982** - noninterference; the spec-13 sense of the word, distinct from the physical
  one used here. Worth stating because this repo now uses "interference" in both senses and they are
  unrelated.

---

## 8. Open

1. **The `EPS` drop is still there.** Deliberate - this PR changed no arithmetic. It is the next decision,
   and 5 is the argument for what to replace it with rather than what to tune it to.
2. **Conjecture Z-EPS needs its falsifier run** (3). Cheap, executable, hands to Soraya for the formal half.
3. **Per-member amplitude normalisation is still unpriced.** Soraya's TLA+ result: uncapped per-member
   magnitude means `f = 1` annihilates any quorum of any size, so quorum tolerance is set by
   **normalisation**, not by member count. `interferenceExcess` now measures the cancellation; nothing yet
   *bounds* it.
4. **The `Z[zeta_N]` carrier** (5d) - its own workitem, its own review.
