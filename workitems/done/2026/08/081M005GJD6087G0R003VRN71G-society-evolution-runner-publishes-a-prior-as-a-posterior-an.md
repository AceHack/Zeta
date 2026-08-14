---
id: 081M005GJD6087G0R003VRN71G
type: bug
state: done
priority: P2
slug: society-evolution-runner-publishes-a-prior-as-a-posterior-an
title: "society-evolution-runner publishes a prior as a posterior and bands mu inside its own error bar"
created: 2026-08-14T12:56:21.158Z
completed: 2026-08-14T12:56:34.448Z
depends_on: []
composes_with: []
---

# society-evolution-runner publishes a prior as a posterior and bands mu inside its own error bar

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M005GJD6087G0R003VRN71G-*.md` glob. -->
## Reported by the nu work (#10563), left unfixed there, fixed here

1. **The prior published as a posterior.** `createDimensionalBnn()` fresh every tick,
   nothing absorbed, its posteriors published as `PriorHint`s with a hardcoded
   `obsCount: 0`. All 567 hint slots across the 82 evolution events on `main` carry
   `mu = 0`. `mergePriorHint` ignored `obsCount` and credited each with precision:
   82 of them take a receiver from sigma 1.0 to 0.154303 (precision 1 to 42).
2. **Bands finer than the error bar.** Cut-points 0.1 / 0.4 / 0.5 / 0.6 against a
   published sigma of 1.0 at the prior (0.100 sigma apart) and 0.377964 at six
   observations (0.265 sigma apart).

Found while verifying, and also fixed: `mu * 1e6` published 1,940,259 ppm against a
1e6 maximum; the `mu > 0.1` cut was inert; `warm` and `hot` were structurally
unreachable; `trend` was a level reported as a derivative.

Resolution: `src/Core.TypeScript/planning/society-heat-readout.ts` + 17 falsifiers in
`society-heat-readout.test.ts`, 12 mutants killed. Follow-ons:
081M005CBQ6087G0R003N21Z9J, 081M005CFFE087G0R0026WF2DS, 081M005CGB7087G0R0031328CY.
