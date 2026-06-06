---
id: B-0289
zetaid: 081KR2E4K0008QG0R001SWEPNV
priority: P1
status: in-progress
title: "Green Lantern ring — hardware spec + local inference requirements"
created: 2026-05-08
last_updated: 2026-05-14
parent: B-0246
depends_on: []
classification: buildable-now
decomposition: atomic
pr: pending
---

# B-0289 — Hardware spec

Research doc: what hardware can run Genesis Seed with local
inference. SBC candidates (RPi, Jetson, ESP32-S3), power
budget, connectivity (Reticulum mesh, BLE, WiFi).

## Acceptance criteria

- Research doc with 3+ hardware candidates compared
- Power/compute/connectivity matrix

## Pre-start checklist (2026-05-14, otto-cli)

**Prior-art search:**

- `docs/research/*hardware*` — no results
- `docs/research/*iot*` — no results
- `docs/research/*jetson*` — no results
- Parent B-0246 read; Genesis Seed docs read (zfcv2 prompt, Lior/DeepSeek evaluation)
- No prior hardware spec doc found; clean slate

**Dependency check:**

- `depends_on: []` — no blocking dependencies
- Parent B-0246 open; siblings B-0290 not yet started
- B-0240, B-0242, B-0244, B-0245 (parent's deps) open but not blocking this research doc

**Decomposition assessment:**

- Item is `decomposition: atomic` and `classification: buildable-now`
- Research doc deliverable confirmed; no further decomposition needed

**Claim:** otto-cli, feat/b-0289-hardware-spec-2026-05-14

## Research doc

`docs/research/2026-05-14-b0289-green-lantern-hardware-spec-local-inference.md`
