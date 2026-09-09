---
id: 081M23EWJNV087G0R001MYF1H7
type: task
state: backlog
priority: P2
slug: rung-7-a-viewable-webgpu-webgl2-canvas2d-page-and-a-cpu-bvh
title: "Rung 7: a viewable WebGPU/WebGL2/Canvas2D page and a CPU BVH ray tracer for the derived E8 surface"
created: 2026-09-09T16:09:18.779Z
depends_on: []
composes_with: []
---

# Rung 7: a viewable WebGPU/WebGL2/Canvas2D page and a CPU BVH ray tracer for the derived E8 surface

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23EWJNV087G0R001MYF1H7-*.md` glob. -->

Rung 6 stopped at a Wavefront OBJ. This rung makes the derived surface **viewable** and
answers the four questions Aaron asked underneath it.

## Shipped

- `demo/clifford-e8/index.html` — WebGPU with WebGL2 and Canvas 2D fallbacks, three surface
  modes, interactive rotation, the light-root gauge, and an in-page CPU ray tracer. Ships
  **0 bytes of geometry**: the 27,621-byte bundle is rungs 1-7 with types erased, and every
  vertex, face and level is computed in the browser.
- `src/Core.TypeScript/research/clifford-e8-browser-scene.ts` — substrate to GPU buffers.
- `src/Core.TypeScript/research/clifford-e8-raytrace.ts` — BVH + two-sided Moller-Trumbore
  nearest hit, which is the occlusion rung 6 correctly declined to fake with a painter's sort.
- `docs/research/2026-09-09-rung-7-the-picture-exists-and-the-surface-is-738-layers-deep.md`

## The measurement that reframes the ladder

The surface's total triangle area is **738x** the area of its own bounding sphere. Everything
else follows: nearest-hit occlusion hides ~99.9% of what it draws, a ray meets thousands of
triangles so a BVH buys only 7.6x, and an unscaled additive pass saturates to white.

## Follow-on, not done here

- A SIMD inner loop (Wasm `v128` or the Rust oracle) and a multithreaded tracer. Section 4 of
  the doc is a design with labelled estimates and one measured scalar cost (48 ns/test).
- A CSS rendering of the **Coxeter projection** — the doc explains why the full 3D
  2-skeleton is not a CSS target at any element count (no per-fragment depth test).
- A GPU frame-rate measurement on a foreground tab.
