---
id: 081KR2E4K0008QG0R001SWEPNV
priority: P1
status: in-progress
title: "Green Lantern ring — hardware spec + local inference requirements"
created: 2026-05-08
last_updated: 2026-05-14
parent: 081KQZVQW0008QG0R00348SHDZ
depends_on: []
classification: buildable-now
decomposition: atomic
pr: pending
---

# 081KR2E4K0008QG0R001SWEPNV — Hardware spec

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
- Parent 081KQZVQW0008QG0R00348SHDZ read; Genesis Seed docs read (zfcv2 prompt, Lior/DeepSeek evaluation)
- No prior hardware spec doc found; clean slate

**Dependency check:**

- `depends_on: []` — no blocking dependencies
- Parent 081KQZVQW0008QG0R00348SHDZ open; siblings 081KR2E4K0008QG0R003MJ4JK0 not yet started
- 081KQZVQW0008QG0R002QZAFB2, 081KQZVQW0008QG0R001CQPQ0E, 081KQZVQW0008QG0R001PS4F8G, 081KQZVQW0008QG0R002Q58F6Z (parent's deps) open but not blocking this research doc

**Decomposition assessment:**

- Item is `decomposition: atomic` and `classification: buildable-now`
- Research doc deliverable confirmed; no further decomposition needed

**Claim:** otto-cli, feat/b-0289-hardware-spec-2026-05-14

## Research doc

`docs/research/2026-05-14-b0289-green-lantern-hardware-spec-local-inference.md`
