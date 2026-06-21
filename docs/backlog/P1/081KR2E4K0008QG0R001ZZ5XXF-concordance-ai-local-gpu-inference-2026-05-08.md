---
id: 081KR2E4K0008QG0R001ZZ5XXF
priority: P1
status: open
title: "Concordance AI — local GPU inference for structure recognition"
created: 2026-05-08
parent: 081KQZVQW0008QG0R001PS4F8G
depends_on: [081KR2E4K0008QG0R000DK0BFY]
classification: buildable-now
decomposition: decomposed
type: feature
---

# 081KR2E4K0008QG0R001ZZ5XXF — Local GPU inference

Run structure recognition on concordance index using local
GPU. No cloud API dependency.

## Pre-start checklist (backlog-item start gate)

- Prior-art search: grepped codebase for concordance/B-029*/structure/GPU/local-inference (surfaces: tools/concordance/concordance.ts is the only hit from 081KR2E4K0008QG0R000DK0BFY; no prior GPU code; no wake-time-substrate / skill-router / Otto-364 collisions in this lane). LOST-FILES-LOCATIONS.md and decision-archaeology paths checked via trajectory RESUMEs — no overlap.
- Dependency restructure: 081KR2E4K0008QG0R000DK0BFY now closed (corpus pipeline landed), reciprocal composes_with added implicitly via shared concordance module; supersession via 081KQZVQW0008QG0R001PS4F8G parent confirmed; classification updated from blocked-on-081KR2E4K0008QG0R000DK0BFY.
- Re-decomposition performed (assumed original atomic was mistake — acceptance criteria too broad for one PR): smallest safe slice carved as "TS typed structure recognition surface + CPU stub".
- Update row: this section + status/classification/decomp fields updated before any further work.

## Acceptance criteria (parent)

- Local inference working on at least one GPU backend
- Structure patterns detected in concordance output

## Implemented smallest safe slice (this PR)

- Added `recognizeStructure(index)` + `StructurePattern` type + safe stub impl to `tools/concordance/concordance.ts` (F#/TS preferred; no new deps; repetition detection as initial pattern; // GPU-ready comment for future ONNX/ML.NET wiring).
- Slice is bounded, testable, retraction-safe (pure addition), builds clean.
- Prepares surface for next slices (backend selection, real local GPU call).

## Out of scope for this slice

- No actual GPU runtime or model loading.
- No new packages / external binaries.
- No broad refactor of concordance pipeline.
