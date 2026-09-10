---
id: 081M243HXZS087G0R003746F3H
type: task
state: backlog
priority: P2
slug: phase-0-read-the-generator-at-rank-3-h3-geometry-derived-sha
title: "Phase 0: read the generator at rank 3 — H3 geometry derived, shading falsified, and the byte-lock"
created: 2026-09-09T22:10:30.009Z
depends_on: []
composes_with: []
---

# Phase 0: read the generator at rank 3 — H3 geometry derived, shading falsified, and the byte-lock

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M243HXZS087G0R003746F3H-*.md` glob. -->

Phase 0 of the graphics/physics roadmap (`docs/research/2026-09-09-graphics-physics-engine-roadmap-read-the-generator-at-rank-3.md`,
PR #17170). Aaron's direction: least-computational wins, 8D is dropped unless it earns its
place, graphics and physics may stay separate engines.

**The gating question was run FIRST**, as the roadmap required — exact shading over an H3 orbit
polytope was `toy` and unrun, and a golden document that locked an inexact shading model would
have locked the wrong thing.

## What landed

- `src/Core.TypeScript/research/h3-rank3-geometry.ts` — the four H3 orbit polytopes derived from
  the group (simple system found by its Gram matrix, weights as cross products, vertices as
  orbit images), plus exact `Z[phi]` shading and the one named float boundary.
- `src/Core.TypeScript/research/h3-rank3-cost.ts` — cost measured on rung 7 and rung 8's own
  imported meters, plus an exhaustive pairwise self-intersection scan.
- `src/Core.FSharp.E8Render/H3Exact.fs` + `H3GoldenVector.fs` — the second oracle, with four
  deliberately different algorithms.
- `tests/cross-verification/h3-rank3-geometry/` — the byte-lock treaty. Held first try.
- 101 TypeScript falsifiers + 19 F# falsifiers; 20 targeted mutants, 18 killed with named
  killers, 2 reported as equivalent (one of which found unreachable code, now deleted).

## Findings

- **Shading stays exact**, with a stated negative: `cos^2` is exactly in `Q(phi)` everywhere;
  `cos` closes over `Q(phi, sqrt 3)` on triangular and hexagonal facets, and has **no single
  rational radical** on pentagons and decagons.
- **Every edge carries exactly 2 facets** (against 4_21's 27), Euler = 2, orientation determined
  on every facet, **zero improper self-intersections** by exhaustive scan. Whitney does not
  apply because there is no projection.
- **969x less overdraw, 136x fewer triangle tests per ray, 179x faster at 128^2** than rung 8's
  SBVH on 4_21 (Apple M2 Ultra, Bun 1.3.14, one thread).
- **The level count saturates**: a non-root integral light gives one distinct exact level per
  facet on every solid — the posterisation disappears at rank 3.
- **0 bytes of geometry**, and an honest reversal: the derivation bundle is 8,238 B against rung
  7's 27,621 B, but the icosahedron's explicit triangle soup is 720 B, so the byte argument for
  shipping the derivation inverts at this scale. Provenance, not size, is now the reason.

Detail: `docs/research/2026-09-09-phase-0-the-shading-survives-at-rank-3-on-triangles-and-the-object-has-a-side.md`
