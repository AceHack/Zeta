---
id: B-0370
zetaid: 081KR2E4K0008QG0R000ARCH0X
priority: P1
status: closed
title: "Durable computation — extend Checkpoint.fs with StableStorage mode"
created: 2026-05-08
parent: B-0251
depends_on: [B-0278]
classification: blocked-on-B-0278
decomposition: atomic
type: feature
---

# B-0279 — Checkpoint StableStorage extension

Extend src/Core/Checkpoint.fs ICheckpointStore with a
StableStorage implementation based on survey findings.

## Acceptance criteria

- StableStorage mode implemented in Checkpoint.fs
- Tests covering checkpoint + replay under StableStorage
