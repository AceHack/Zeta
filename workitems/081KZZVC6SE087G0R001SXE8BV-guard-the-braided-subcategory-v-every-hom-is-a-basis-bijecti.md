---
id: 081KZZVC6SE087G0R001SXE8BV
type: task
state: in-progress
priority: P2
slug: guard-the-braided-subcategory-v-every-hom-is-a-basis-bijecti
title: "Guard the braided subcategory V: every hom is a basis bijection, so copy and discard cannot enter"
created: 2026-08-14T09:59:12.000Z
depends_on: []
composes_with: [081KZZVC3DD087G0R0035SZN58]
---

# Guard the braided subcategory `<V>`: every hom is a basis bijection

## Why this guard exists (Soraya, 2026-08-14 — the Q3 verdict)

`braidR` **is** a legitimate braiding, but only of `<V>`, and `<V>` stays legitimate
only because it **excludes copy `Delta` and discard `eps`**. Nothing currently enforces
that, and the failure mode is silent.

The obstruction, stated exactly:

- A **cartesian** monoidal category has a **unique braiding**, and it is the swap.
  (Stronger than Mathlib's `Subsingleton (SymmetricCategory C)`, which only pins the
  *symmetric* structure.) Proof: in a cartesian category `I` is terminal; naturality of
  `c` against `!_A : A -> I` forces `pi_1 . c_{A,B} = pi_B` and `pi_2 . c_{A,B} = pi_A`;
  the universal property of the product then gives `c = swap` uniquely.
- `Meno.fs:38` already records that the **deterministic subcategory** — the `arr f`
  arrows for a set-function `f` — is cartesian, with copy and discard natural
  (Fox 1976). **`MenoBraided.braidR` is defined as `Meno.arr (...)`, so it lives in
  exactly that subcategory.**
- So if `Delta` / `eps` are ever admitted into `<V>`, `braidR` is forced to the swap,
  contradicting the machine-checked `braidR_not_symmetric_perm3`.

**The escape, and it is real.** Every morphism of `<V>` is a **bijection on basis
elements**: `braidR` and `braidRinv` are mutually inverse (already machine-checked in
`MenoBraidedRMatrix.lean`), and `(x)` / `.` of bijections is a bijection. `Delta_V : V
-> V (x) V` is not surjective on basis and `eps_V : V -> I` is not injective, so
neither is in `<V>`. By Fox 1976, `<V>` therefore carries no natural comonoid and is
**not cartesian** — which is precisely what lets it be genuinely braided.

CHECKED concretely on `S3` (exact, no floats): `braidR` is a bijection on `G x G`
(36/36), and `pi_1 . braidR != pi_2` on 18 of 36 pairs — the concrete witness that
`braidR` is not the swap and so could not survive a cartesian ambient.

## The answer to "what is the minimal non-cartesian tensor on `<V>`?"

**None is needed, and nothing is missing.** The brief assumed a new tensor had to be
constructed. It does not:

- the ambient `(x)_Kronecker` is **already non-cartesian** (`MenoBraided.fs:7` — `(x)`
  is not the product in `Mod_Z`, which is the biproduct; `unitObject` is not terminal)
- what makes `<V>` braided is not a different `(x)` but a **hom-restriction**: objects
  `V^n`, morphisms exactly `rho(B_n)`
- that restriction **is built** — `MenoBraided.rep` is precisely it

So the deliverable is the *guard*, not a construction.

## The job

Add a regression guard under `tests/Tests.FSharp/Formal/` asserting the closure
property that keeps `<V>` non-cartesian:

1. every morphism produced by `MenoBraided.rep` is a bijection on basis elements
   (check over a finite group model such as `S3`, exhaustively — exact arithmetic)
2. a **negative control**: a mutant `rep` that emits `Delta` (duplicate a strand) or
   `eps` (drop a strand) must FAIL the bijection assertion. Without this the test is
   the vacuity class — an assertion that cannot fail is not a check.
3. a comment at the `MenoBraided.rep` site naming *why* `Delta`/`eps` must never be
   added to this module

## Routing

- **FsCheck / exhaustive F#** — accepted. This is a finite closure property over a
  concrete model; exhaustive over `S3` is total and cheap.
- **Lean** — optional follow-on for the abstract "cartesian => unique braiding" lemma.
  Mathlib has `CartesianMonoidalCategory` and `BraidedCategory`, so it may be short;
  if it is not short in an hour, it is not worth it — the concrete guard is what
  actually prevents the regression.
- **Z3** — rejected. No arithmetic content.

## Anchors

- Fox 1976, *Coalgebras and cartesian categories* — cartesian iff natural comonoid
- Joyal & Street 1993 — braided monoidal categories
- Mathlib `CategoryTheory.Monoidal.Cartesian`, `Subsingleton (SymmetricCategory C)`
