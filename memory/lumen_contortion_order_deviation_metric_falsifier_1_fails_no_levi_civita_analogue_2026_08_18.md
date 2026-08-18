---
name: Contortion is not the order-deviation metric — falsifier 1 fails, no Levi-Civita analogue (Lumen 2026-08-18)
description: Lumen 2026-08-18 negative result — contortion cannot serve as the order-deviation metric for the belief fold, because Fisher-Rao is already fixed (Cencov) and the whole Amari alpha-family is a scalar multiple of the fully symmetric Amari-Chentsov tensor, so torsion and contortion are identically zero for every member while the connections genuinely differ; the real deviation is NON-METRICITY, which contortion does not measure
type: project
created: 2026-08-18
---

# Contortion is not the order-deviation metric — falsifier 1 fails (Lumen 2026-08-18)

The 2026-08-18 proposal to use **contortion** as the order-deviation metric for our fold rests on a
canonical torsion-free reference existing and being unique. It does not, and the reason is sharper
than "we could not find one."

**The metric exists and that is what kills it.** Fisher–Rao is the metric (Čencov uniqueness), and
`SoftValueInfo.fs` already computes the KL whose Hessian it is. With the metric fixed everything is
computable: `BeliefConvergence.observe` translates log-weights, so our fold transports along Amari's
**e-connection** (α = 1) while the canonical reference is Levi-Civita (α = 0). In natural coordinates
the whole α-family is a scalar multiple of the **fully symmetric** Amari–Chentsov tensor, so **torsion
is identically zero for every member and contortion is identically zero** — while the connections
genuinely differ. The deviation is **non-metricity**, which contortion does not measure.

Three more, each independent:

- Levi-Civita uniqueness needs torsion-free **AND** metric-compatible; the proposal supplies one.
- The phase-canonical (HLC) order is a **deterministic sort key**, a gauge choice — and it is free to
  be arbitrary precisely because the fold is commutative, so it cannot be an order-deviation zero-point.
- Order-dependence of operations is the **Lie bracket**, which the definition of torsion *subtracts
  off*. Flat ℝ² with `X = ∂ₓ`, `Y = x∂_y`: zero torsion, maximal order-dependence.

**Survivors:** relative deviation between two executions is base-point-free (connections form a
torsor); the per-execution geometric object, if ever wanted, is a **translational holonomy / Burgers
vector** (Kondo; Bilby–Bullough–Smith; Kröner), whose density is torsion; and today's honest
measurement is just fold-both-orders-and-subtract — bit-identical exactly, one ULP in float.

The live defect is **multiplicity**, not order, and no torsion measures a count.

Detail: `docs/research/2026-08-18-falsifier-1-fails-no-levi-civita-analogue-contortion-is-identically-zero-on-our-fold-lumen.md`
Computation: `src/Core.TypeScript/research/information-geometry-contortion-falsifier.ts`
Register: §B-torsion (Z-2), `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md`.
