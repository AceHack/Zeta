---
id: 081KR2E4K0008QG0R000ARCH0X
priority: P1
status: closed
title: "Durable computation — extend Checkpoint.fs with StableStorage mode"
created: 2026-05-08
parent: 081KQZVQW0008QG0R000PPQ3MH
depends_on: [081KR2E4K0008QG0R001GFXN05]
classification: blocked-on-081KR2E4K0008QG0R001GFXN05
decomposition: atomic
type: feature
---

# 081KR2E4K0008QG0R000ARCH0X — Checkpoint StableStorage extension

Extend src/Core/Checkpoint.fs ICheckpointStore with a
StableStorage implementation based on survey findings.

## Acceptance criteria

- StableStorage mode implemented in Checkpoint.fs
- Tests covering checkpoint + replay under StableStorage
