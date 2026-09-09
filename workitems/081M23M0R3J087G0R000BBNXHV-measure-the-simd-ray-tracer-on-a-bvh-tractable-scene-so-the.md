---
id: 081M23M0R3J087G0R000BBNXHV
type: task
state: backlog
priority: P2
slug: measure-the-simd-ray-tracer-on-a-bvh-tractable-scene-so-the
title: "Measure the SIMD ray tracer on a BVH-tractable scene, so the throughput number stops being a fact about 4_21"
created: 2026-09-09T17:38:58.290Z
depends_on: []
composes_with: []
---

# Measure the SIMD ray tracer on a BVH-tractable scene, so the throughput number stops being a fact about 4_21

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23M0R3J087G0R000BBNXHV-*.md` glob. -->

## Why

The measured throughput in `docs/research/2026-09-09-rung-7-*.md` §4 (1.15 Mrays/s at
512x512, SIMD, DoP 24, on an Apple M2 Ultra) is a fact about **4_21**, not about the kernel
or about .NET. The evidence is §4.1: total leaf surface area over root surface area is
**~1,140**, because 60,480 triangles are drawn over 240 vertices and each spans about a
fifth of the model, so every bounding box overlaps every other and no BVH can prune.

Any conclusion of the form "CPU ray tracing is / is not fast enough" drawn from that number
is a conclusion about this polytope. The SIMD speedup (x3.4 on four lanes) and the DoP
speedup (x9.8) ARE properties of the kernel and do transfer.

## What to measure

The same `E8Raytracer` kernel on a scene with a bounded leaf/root area ratio — a
conventional triangle mesh of comparable count. Report the leaf/root ratio alongside the
throughput, so the two numbers are never quoted apart again. On hardware with AVX-512 the
same code path compiles to 16 lanes; that is currently **untested and unclaimed**.

