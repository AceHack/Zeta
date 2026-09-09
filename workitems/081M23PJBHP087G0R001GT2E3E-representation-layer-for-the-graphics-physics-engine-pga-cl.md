---
id: 081M23PJBHP087G0R001GT2E3E
type: task
state: backlog
priority: P2
slug: representation-layer-for-the-graphics-physics-engine-pga-cl
title: "Representation layer for the graphics/physics engine: PGA Cl(3,0,1) measured against the 8D-then-project pipeline"
created: 2026-09-09T18:23:32.406Z
depends_on: []
composes_with: []
---

# Representation layer for the graphics/physics engine: PGA Cl(3,0,1) measured against the 8D-then-project pipeline

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23PJBHP087G0R001GT2E3E-*.md` glob. -->

## What was measured

Aaron 2026-09-09 challenged the representation layer for the combined graphics/physics
engine, then upgraded the ask to *"route the PGA evaluation and let's see the numbers."*
`Cl(3,0,1)` was implemented far enough to benchmark against the three rivals a real engine
picks between, on named hardware (Apple M2 Ultra, Bun 1.3.14, single-threaded scalar TS).

Findings, all in `docs/research/2026-09-09-the-representation-layer-measured-*.md`:

- **The projection is not what costs.** It is one-time at load, so it costs nothing per
  frame today. What costs is the surface it produces, and that is a theorem: a 2-complex is
  in general position only in dimension 5, so every rank-3 map self-intersects.
- **`8d-then-project` is 25.2x a 4x4 matrix** per vertex — the real cost of the regime that
  animates *in* 8D, which is the only regime where the projection is a per-frame expense.
- **A PGA motor and a quaternion are the same computation per vertex** (3.03-3.13 vs
  3.03-3.12 ns). Derived, then measured: the sandwich's weight is the rotor norm alone, so
  the action is affine and the degenerate half does no per-vertex work. Motors *are* dual
  quaternions.
- **Exactness survives** — `Z` throughout rigid motion, zero square roots, one division at
  readout. Named cost: ~6.1 bits of coefficient growth per composition.
- **Aaron's "different dimensions for different parts" is measured and the cost is
  CONSERVED**: summed overdraw is 609 / 614 / 607 / 567 over 1 / 8 / 64 / 512 parts.
- **PGA is a performance answer, not a correctness one.** 27 faces per edge is combinatorial;
  no algebra changes it.

- **Exactness survives at rank 3 — run, not argued.** H3 closes at exactly 30 roots in
  `Z[phi]` under its own reflections: one norm class (the rational integer 4, `phi`
  component exactly zero), zero reflections leaving the ring, rank 3 with no projection
  anywhere. So dimension 8 is not what bought the exact arithmetic.

## Next, in order

1. The remaining half of the rank-3 claim: shade an H3 orbit polytope in `Z[phi]` and check
   the level census is exact with one quadratic surd at readout. The ring is measured; the
   light is not.
2. A 3D-native derived content source, so the engine has geometry that is not a projection.
3. PGA for **dynamics** (bivector ODE) against a quaternion+inertia baseline — untouched.
4. The fixed-point / rational / float decision for time integration. Unaddressed and the
   first wall any engine proposal hits.
