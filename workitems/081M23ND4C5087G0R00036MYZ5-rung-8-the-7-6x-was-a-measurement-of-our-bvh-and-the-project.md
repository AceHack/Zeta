---
id: 081M23ND4C5087G0R00036MYZ5
type: task
state: backlog
priority: P2
slug: rung-8-the-7-6x-was-a-measurement-of-our-bvh-and-the-project
title: "rung 8 — the 7.6x was a measurement of our BVH, and the projection is not the problem"
created: 2026-09-09T18:03:12.645Z
depends_on: []
composes_with: []
---

# rung 8 — the 7.6x was a measurement of our BVH, and the projection is not the problem

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23ND4C5087G0R00036MYZ5-*.md` glob. -->

Rung 7 (`081M23EWJNV087G0R001MYF1H7`, PR #17155) concluded "CPU ray tracing: not at
interactive rates" from 2,780 triangle tests per ray and a 7.6x speedup over exhaustive
scan, and defended those numbers on the grounds that a ray genuinely meets ~1,000
triangles on a 738-layer surface. It does. But a NEAREST-hit query's answer set is
0.49 triangles per ray, measured — so the comparison was against the wrong query.

This rung:

- **Diagnoses** the two separable defects: an unordered traversal (2.1x, free) and a tree
  whose leaf boxes sum to 2,577x the root's surface area (a perfect partition is 1.0).
- **Implements spatial splits** (Stich, Friedrich & Dietrich, HPG 2009) plus binned SAH
  (Wald 2007) and Sutherland-Hodgman chopping: **2,780 -> 440 tests/ray, 7.6x -> 62.8x**,
  bit-identical pixels, one thread, no SIMD.
- **Measures the cheaper rival** — midpoint subdivision — which is 7.4x faster still but
  costs 58x the memory and perturbs 2.9% of pixels at float32 ulp scale.
- **Settles the projection question with a negative result:** across all 56 eigenlayer
  3-frames and 60 random orthonormal frames the overdraw spans only 1.39x (598-834) and
  the primitive-size fraction only 26-29%. The pathology is intrinsic to 4_21, not an
  artifact of `embed3d`. The 27-faces-per-edge figure is an 8D combinatorial fact with no
  embedding involved.
- **Names a property rung 7 left unstated:** a one-ulp perturbation of the scene changes
  2.40% of pixels. The tracer is deterministic; the scene is ill-conditioned.

Full write-up:
`docs/research/2026-09-09-rung-8-the-7-6x-was-a-measurement-of-our-bvh-and-the-projection-is-not-the-problem.md`
