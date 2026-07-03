# Tick Primitive Promotion Gate — Formal Proof Obligations

> **Status:** Gate authored 2026-07-03. C13 operator algebra (D∘I, I∘D, z⁻¹,
> D=1−z⁻¹, I=running-sum) is **PROVEN** (FsCheck + Z3). The remaining gate
> items are listed below in strict order.
>
> **Anchor:** 081KT2T2J0008QG0R0008TFHJT (canonical primitives registry +
> promotion gate); C13 in issue #6692 (formal coverage cadence).

---

## What "promotion" means for Tick

The backlog item 081KT2T2J0008QG0R0008TFHJT concluded (2026-06-02) that
**tick-source folds onto the algebra axis**: the atom that registers is the
**Tick algebra** — `(ℕ,+,0)` time-monoid + `z⁻¹`/`I`/`D` linear operators
over `Stream<ZSet>`. The effectful `Circuit` step-driver is the *runtime* that
runs the algebra, not a registry primitive.

Promotion means: the Tick algebra is admitted to the canonical primitives
registry (§A of the FROZEN-CORE register) with the same proof bar as every
other promoted primitive (math + 4-lang + correctness-gate + aesthetics-gate).

---

## Gate criteria (ordered — each must pass before the next)

### Gate T1: Monoid laws — PROVEN ✅

The `(ℕ,+,0)` monoid laws for the tick index are proven by the Z3 C13 lemmas
(`Z3.Laws.Tests.fs`: `C13 D∘I = id`, `C13 I∘D = id`) and by the FsCheck
operator algebra properties (`OperatorAlgebra.Tests.fs`: 5 properties, all
100/100). The UoM `[<Measure>] type tick` provides compile-time unit separation
(the only guarantee a phantom type can give); the runtime algebra is proven by
the operator properties.

**Evidence:** `tests/Tests.FSharp/Operators/OperatorAlgebra.Tests.fs` (5 FsCheck
properties); `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs` C13 section (2 Z3
lemmas). All pass, 0 skipped.

---

### Gate T2: 4-language byte-lock — OPEN ⬜

The Tick algebra must agree across F# + C# + TypeScript + Rust on the canonical
encoding of a tick value. The tick is a `uint64` (versionstamp-aligned); the
canonical encoding is 8-byte big-endian (consistent with the versionstamp codec).

**What is needed:**

- A golden-vector file `tests/golden/tick-codec-golden-vectors.json` with
  at least 16 tick values (0, 1, max, representative midpoints) and their
  8-byte big-endian hex encodings.
- A byte-lock test in each of the 4 languages that reads the golden vectors
  and verifies the canonical encoding matches.
- The F# codec: `Tick.encode : uint64 -> byte[]` and `Tick.decode : byte[] -> uint64`.

**Blocking:** The 4-lang byte-lock is the standard admission requirement for all
promoted primitives (see G-Set × 4-ser leg, DynamicValue codecs, UncertainClock).
Tick cannot reach §A without it.

---

### Gate T3: Soft-mode integration — OPEN ⬜

The Tick algebra is the time axis that the soft-mode Bayesian network runs on.
The integration proof obligation is: **a Zeta agent's belief update sequence
(indexed by tick) is a well-typed `Stream<ZSet<Gaussian>>` in the DBSP sense** —
i.e. the `D`/`I`/`z⁻¹` operators can be applied to the belief stream and the
operator identities (Gate T1) hold on the belief stream, not just on `ZSet<int>`.

**What is needed:**

- A FsCheck property in `SoftMode.Tests.fs` (or a new `TickBelief.Tests.fs`)
  that constructs a `Stream<Gaussian>` (a sequence of Gaussian messages indexed
  by tick), applies `D∘I` and `I∘D`, and verifies the round-trip identity holds
  on the Gaussian stream.
- This connects the Tick algebra (Gate T1) to the soft-mode invariant (SM-1
  through SM-4) and closes the gap identified in the FROZEN-CORE register:
  "the dynamical stability over unbounded time" leg.

**Why this matters:** The DBSP stream model says that every incremental
computation is a `Stream<ZSet>` and the operators `D`/`I`/`z⁻¹` are the
primitives for incremental re-computation. If the belief update is a
`Stream<Gaussian>`, then `runToFixpoint` on a data delta is exactly
`NestedCircuit.Fixedpoint` at the factor-graph level — the "slice 4b"
integration mentioned in `FactorGraph.fs`. Gate T3 is the proof that this
integration is algebraically sound.

---

### Gate T4: Aesthetics gate — OPEN ⬜ (lightweight)

The aesthetics gate for Tick is: **the Tick algebra has no redundant operations**.
Specifically:

- `z⁻¹` (delay), `D` (differentiate), `I` (integrate) are the three primitives.
- `D = 1 − z⁻¹` and `I = (1−z⁻¹)⁻¹` are derived (not primitives).
- The monoid `(ℕ,+,0)` is the index structure, not an operator.

The aesthetics gate is satisfied by the existing C13 Z3 lemmas (which prove
`D = 1 − z⁻¹` and `I = running-sum` as derived identities) and by the
OperatorAlgebra FsCheck properties (which verify the derived forms against
the primitive implementations). **This gate is effectively already passed** by
the C13 evidence; it just needs to be formally signed off in the registry.

---

## Summary table

| Gate | Claim | Tool | Status |
|------|-------|------|--------|
| T1 | `(ℕ,+,0)` monoid + D∘I=id + I∘D=id + z⁻¹ + D=1−z⁻¹ + I=Σz⁻ⁿ | FsCheck + Z3 | ✅ PROVEN |
| T2 | 4-language byte-lock on tick encoding (uint64 big-endian) | golden vectors + 4-lang tests | ⬜ OPEN |
| T3 | Belief stream `Stream<Gaussian>` satisfies D∘I=id / I∘D=id (soft-mode integration) | FsCheck | ⬜ OPEN |
| T4 | Aesthetics: 3 primitives, 2 derived, no redundancy | Z3 (existing C13) | ✅ EFFECTIVELY PASSED |

**Promotion is unblocked when T2 and T3 are closed.**

---

## Connection to the soft-mode invariant

The soft-mode invariant (SM-1 through SM-4, `SoftMode.Tests.fs`) proves that
the *per-step* and *per-fixed-point* properties hold: the EP probit factor
preserves proper cavities, and the fixed point is never a Dirac delta. Gate T3
extends this to the *temporal* dimension: the belief stream indexed by tick is
a well-typed DBSP stream, and the operator identities hold on it. Together,
SM-1/SM-4 + T3 constitute the full soft-mode invariant: proper at every step,
proper at the fixed point, and well-typed across time.

The open half of the FROZEN-CORE non-collapse conjecture ("dynamical stability
over unbounded time — Lyapunov-stable attractor") maps directly onto T3: proving
that the belief stream satisfies the DBSP stream laws is the tractable, concrete
form of the Lyapunov stability claim. The immutable, append-only DBSP stream
(with retraction as correction-forward) is the substrate; the operator identities
are the stability conditions.
