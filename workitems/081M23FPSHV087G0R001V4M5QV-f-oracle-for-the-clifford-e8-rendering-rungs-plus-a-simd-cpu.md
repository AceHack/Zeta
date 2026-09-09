---
id: 081M23FPSHV087G0R001V4M5QV
type: task
state: backlog
priority: P2
slug: f-oracle-for-the-clifford-e8-rendering-rungs-plus-a-simd-cpu
title: "F# oracle for the Clifford E8 rendering rungs, plus a SIMD CPU ray tracer in .NET"
created: 2026-09-09T16:23:37.787Z
depends_on: []
composes_with: []
---

# F# oracle for the Clifford E8 rendering rungs, plus a SIMD CPU ray tracer in .NET

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23FPSHV087G0R001V4M5QV-*.md` glob. -->

## What this is

Aaron set the architecture (2026-09-09): F# owns the math and the SIMD/CPU rendering;
TypeScript keeps the web surface (CSS / canvas / WebGPU) and needs no SIMD yet; Rust stays
acceptable as a further oracle, but a graphics engine built entirely in .NET is the target
"if it's useful".

This item is the first .NET rung of the Clifford/E8 rendering ladder whose rungs 1-6 live in
`src/Core.TypeScript/research/clifford-e8-*.ts`. It delivers:

1. an F# **second oracle** for the exact combinatorics and the derived shading model,
   byte-locked to the TypeScript oracle through one canonical text golden vector;
2. a CPU **ray tracer** with real SIMD, because rung 6 measured 27 faces per edge and
   therefore ruled out a painter's sort — nearest-hit is the correct occlusion method for
   interpenetrating geometry;
3. throughput **measured on named hardware**, scalar against SIMD.

## Outcome

Delivered. Every locked quantity agrees byte for byte on the first run — no oracle
disagreement to report. Measurements, the mutation ledger, and the honest verdict on a
fully-.NET engine:
`docs/research/2026-09-09-rung-7-the-dotnet-oracle-agrees-byte-for-byte-and-the-geometry-not-the-cpu-is-the-bottleneck.md`.
