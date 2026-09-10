---
id: 081M23A546F087G0R0034GY1DA
type: task
state: backlog
priority: P2
slug: rung-6-clifford-derived-shading-exact-lambert-over-the-4-21
title: "Rung 6: Clifford-derived shading — exact Lambert over the 4_21 face set"
created: 2026-09-09T14:46:35.983Z
depends_on: []
composes_with: []
---

# Rung 6: Clifford-derived shading — exact Lambert over the 4_21 face set

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23A546F087G0R0034GY1DA-*.md` glob. -->

## What

Rung 6 of the Clifford/E8 graphics ladder: a shading model in which the light direction,
the surface normal and the reflection law are all derived from the substrate rather than
authored. Closes the gap rung 5 named in its own limits section ("No shading model, no
lighting, no material").

## Result

- The 2-face normal is the SUM of its three roots — exactly orthogonal to the face plane,
  `|n|^2 = 48`, non-degenerate on all 60,480 faces (rung 5's 3D gauge failed on 768).
- The Lambert numerator is an exact integer over `sqrt(384) = 8 sqrt 6`; the shading model
  closes over `Q(sqrt 6)` and one function evaluates the root.
- Two-sided shading is forced by measurement: every 4_21 edge carries exactly 27 faces.
- 15 falsifiers, 24 mutants, 23 killed, 1 control survived; one real defect found and fixed.

## Artefacts

- `src/Core.TypeScript/research/clifford-e8-shading.ts` (+ `.test.ts`)
- `docs/research/2026-09-09-rung-6-shading-derived-the-face-normal-is-the-root-sum-and-the-model-closes-over-q-sqrt-6.md`
