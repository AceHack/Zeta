---
id: 081M0R1RV2Y087G0R003W65SGD
type: task
state: backlog
priority: P2
slug: z3-plus-lean-the-normal-gamma-non-log-concavity-boundary-and
title: "Z3 plus Lean: the Normal-Gamma non-log-concavity boundary and the exponential-family half-space theorem"
created: 2026-08-23T19:32:44.254Z
depends_on: []
composes_with: []
---

# Z3 plus Lean: the Normal-Gamma non-log-concavity boundary and the exponential-family half-space theorem

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0R1RV2Y087G0R003W65SGD-*.md` glob. -->

**Route to:** `formal-verification-expert` (Soraya). **Tools: Z3** for the polynomial inequality,
**Lean 4** for the half-space statement. Two different shapes, so two different tools.

**Analysis this comes from:** `docs/research/2026-08-23-geometry-as-the-root-of-the-soft-regime-five-questions-two-already-answered-in-tree-one-refuted-lumen.md` §3.2, §3.3. Numbers reproduce with
`python3 docs/research/scripts/2026-08-23-geometry-as-root-ng-convexity-verify.py` (stdlib only,
deterministic, exit 0).

## S4 — the non-log-concavity boundary (Z3)

For `NG(m, λ, α, β)` over `(μ, τ) ∈ ℝ × ℝ₊` with
`log f = (α−½)log τ − βτ − (λτ/2)(μ−m)²`, prove

```
det H(log f)  =  λ(α−½)/τ − λ²(μ−m)²  <  0    whenever   (μ−m)² > (α−½)/(λτ)
```

i.e. the Hessian is **indefinite** on an unbounded region, so `log f` is not jointly concave and
the superlevel sets in the `(μ, τ)` chart are **not convex**. Nonlinear real arithmetic over a
polynomial inequality — decidable, and exactly Z3's shape.

The §3.2 witness should land alongside as a regression test that would fail if the claim were
wrong: `A = (−6.00, 0.25)` at `log f = −6.829442`, `B = (−1.00, 6.00)` at `−6.312361`, midpoint
`(−3.50, 3.125)` at `−20.556474` — 13.7 nats **below** both endpoints.

## S5 — the half-space theorem (Lean 4, short)

For any exponential family `p_θ(z) = h(z)·exp(⟨θ, T(z)⟩ − A(θ))` and any `c > 0`,

```
{ z : p_θ(z)/h(z) ≥ c }  =  T⁻¹( { t : ⟨θ, t⟩ ≥ log c + A(θ) } )
```

— every highest-density region is the **preimage of a closed half-space**. Near-trivial in Mathlib,
and worth having because it is the **positive** geometric result the inversion can actually stand
on. For Normal-Gamma it is exact with `h ≡ 1`,
`T(μ,τ) = (log τ, τ, τμ, τμ²)`, `θ = (α−½, −(β+λm²/2), λm, −λ/2)`; checked numerically to
`5.7e-14` over 20 000 points.

## Why both, together

They are the two halves of one point, and separating them is what makes the point:

> **Convexity is an affine notion, not a metric one, and it is not diffeomorphism-invariant.**
> The same Normal-Gamma posterior is non-convex in `(μ,τ)` and a half-space in `T`. So a
> Gärdenfors-style "the posterior is a convex region" claim has **no truth value** until the
> quality dimensions are fixed — and a dually flat manifold offers **two** canonical affine
> structures (e- and m-), with Fisher–Rao geodesics giving a **third**.

## Falsifier

For S4: find `(μ, τ)` in the stated region where `det H ≥ 0`. For S5: find an exponential family
and a level `c` whose HDR is not a half-space preimage under `T`.

## Anchors (checked)

- Rao 1945; Čencov/Chentsov 1972/1982 — Fisher–Rao is the unique invariant metric, so "named
  metric" has an answer with a uniqueness theorem behind it.
- Amari & Nagaoka 2000, Thm 3.8 (generalised Pythagorean) / Thm 3.9 (projection) — **not** for
  re-proof; these supply the *stated approximation error* for the non-conjugate lane
  (`D_KL(p ‖ Π_M p)`) and are a checked-anchor obligation, not a prover obligation.

## Not in scope

Implementation.
