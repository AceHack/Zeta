---
id: 081M23H3BW1087G0R0030NMD47
type: task
state: backlog
priority: P2
slug: hidden-control-structure-inventory-for-the-zeta-renderer-war
title: "Hidden-control-structure inventory for the Zeta renderer -- warp consensus sites and their published alternatives"
created: 2026-09-09T16:47:58.337Z
depends_on: []
composes_with: []
---

# Hidden-control-structure inventory for the Zeta renderer -- warp consensus sites and their published alternatives

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23H3BW1087G0R0030NMD47-*.md` glob. -->

## Why this row exists

Aaron 2026-09-09: _"every time we require some hidden warp consensus or hidden control
structure, i want to see if we can research latest research papers for an alternative
solution."_ This row turns that standing instruction into a checklist a renderer change can be
read against, so the check exists before the code does.

"Hidden" names a documented hazard rather than a style preference: NVIDIA's Volta Independent
Thread Scheduling made **implicit warp-synchronous programming unsafe**, and the CUDA
documentation says so directly. Code that appears to synchronise, does not, and passes anyway
on the hardware it was written for is the vacuity class in silicon.

Inventory: `docs/research/2026-09-09-geospatial-reasoning-over-clifford-...-warp-consensus-inventory.md` §5.2 -- ten rows, each with its published alternative.

## Acceptance criteria

- [ ] The ten rows of doc §5.2 are carried into a checklist a renderer PR is reviewed against.
- [ ] Each row names its **published alternative** and the paper, not a workaround.
- [ ] Rows 7 and 8 (float atomics in reductions; tie-breaks in sorts) are recorded as **DST
      conflicts**, not as performance notes -- a GPU renderer using float atomics in any
      reduction is not replayable, and no seed fixes it because the nondeterminism is in the
      scheduler.
- [ ] The checklist states, per row, whether Zeta has reached that site yet. At
      `7ffb1fabdb` there is **no BVH, no path tracer, and no Vulkan/wgpu in the tree**, so
      almost every row is "not yet reached" -- which is why now is the right time to write it.

## Not blocked by the Clifford-GPU hold

`081M0R18878087G0R001XY5A2J` holds Clifford-GPU **code, lowering, classifier and measurement**.
This row is engineering reconnaissance over a _conventional_ renderer's hazards, which that
row's "What is NOT blocked" section explicitly permits. Nothing here starts an implementation.

## Register

`unmetered`. Every alternative is cited from its paper; none is benchmarked here.
