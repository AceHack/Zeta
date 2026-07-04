# Soraya round 3 — braiding EARNED by composition; the strict core is two ops

*Soraya (formal-verification routing authority), background round 3, 2026-07-04, answering Aaron's
minimal-VM question ("is there a way to build this with the existing ISA and not add more?"). Landed with
YB-7/YB-8 built to her spec in the same PR — 8/8, her numbers reproduced over the repo's own
`ImaginaryStack.complex` arithmetic (the BP-16 third leg). Verdicts hers; condensed.*

## The answer: YES — exactly, and cheaper than predicted

**R_KL is a finite, EXACT (machine-precision) word over the shipped ISA — five ops, needing only
EMIT/RETRACT/JOIN (not even BRANCH):**

```
R_KL = (Ry(π/2)⊗I) · CNOT · (I⊗Ry(−π/2)) · CNOT · (Ry(−π/2)⊗I)
     = RETRACT(π/2)@1 → JOIN → RETRACT(π/2)@2 → JOIN → EMIT(π/2)@1
```

- Structure: `R_KL = exp((π/4)·G)`, `G = i(X⊗Y)` real antisymmetric, `G² = −I` — one CNOT-conjugated Ry
  sandwich via the Heisenberg identity; the feared Rz obstruction **does not exist** (every one-qubit
  factor is Ry(±π/2)).
- Verified: word vs R_KL dev **1.34e-16**; ybDev **1.1e-16**; invDev **1.0**; word⁸ = I dev 7.6e-16.
- **Two JOINs is optimal** by determinant parity (det CNOT = −1, det R_KL = +1; odd-JOIN words can't match;
  zero JOINs can't entangle). Beats the generic Vatan–Williams SO(4) budget because R_KL is non-generic.
- **YB-8 (angle isolation):** the same word shape with a generic inner angle FAILS Yang–Baxter (grid-swept
  floor 0.263 on the test's clamp) — the π/4 Kauffman–Lomonaco point is genuinely isolated in the family.
  Braiding is not generic in the word space; it is *earned at a point*.

**The verdict flips:** the categorical home upgrades from "braided unearned until an R-matrix ships" to
**"braided monoidal structure EARNED as the derived combinator σ := RWORD"** — the braiding lives in the
words at the amplitude level too, not only at the Ihara/free-monoid level. YB-1..6 stand (they test
generator *images*; YB-7..8 test generated *words*).

## The minimal-VM theorem (her §4, the deeper result)

- The six-op set generates the **full real orthogonal fragment EXACTLY** — not just densely: G₂ = O(4),
  G₃ = SO(8), induction to SO(2ⁿ) (Lie-algebra bracket closure verified computationally + Jurdjevic–Sussmann
  finite-word reachability on compact groups + Brylinski–Brylinski exact-universality).
- **Real amplitudes lose nothing**: universal quantum computation with one extra rebit (Rudolph–Grover,
  Shi's Toffoli+H, Aharonov) — the minimal REAL VM is not a handicap.
- **EMIT is essential**: ⟨H, CNOT⟩ alone is FINITE — the real 2-qubit Clifford group, order 2304
  (BFS-enumerated) — i.e. dropping Ry collapses the VM to a classically-simulable machine (Gottesman–Knill).
- **JOIN is essential**: without it, only the non-entangling product ∏O(2).
- **BRANCH = H is itself a macro at n≥2** (explicit machine-precision word solved: two JOINs + four Rys).
  H is irreducible only for the 1-strand fragment.
- **So the strict irreducible core is {EMIT(θ), JOIN}** — two ops, with RETRACT the free adjoint, BRANCH an
  earned quotient of the 1-strand boundary, and braiding an earned word. `only-the-irreducible-is-primitive`
  lands at the ISA level with the count at TWO.

## Routing note (hers, kept visible)

Shipping R_KL as a seventh primitive would have been a **permanent ISA tax** — one more gate byte-locked
across every oracle forever, purchasing a group element the six ops already generate exactly. The
composition route costs one test appendix. Kauffman–Lomonaco's own universality theorem is *R_KL + local
rotations* — which the ISA already contains, so the composition **closes their loop from the other side**.

## Cross-links

- `tests/Tests.FSharp/BraidRepYangBaxter.Tests.fs` — YB-1..8 (the header carries the upgraded verdict).
- `docs/research/2026-07-04-the-minimal-vm-six-ops-and-no-more-…md` — Aaron's direction this answers; the
  count came in UNDER six.
- `docs/research/2026-07-04-soraya-round2-yang-baxter-verdict-…md` — the round-2 verdict this upgrades.
- Anchors: Kauffman–Lomonaco 2004; Vatan–Williams 2004; Kraus–Cirac 2001; Barenco et al. 1995; Shi 2002;
  Aharonov 2003; Rudolph–Grover 2002; Brylinski–Brylinski 2002; Jurdjevic–Sussmann 1972.
