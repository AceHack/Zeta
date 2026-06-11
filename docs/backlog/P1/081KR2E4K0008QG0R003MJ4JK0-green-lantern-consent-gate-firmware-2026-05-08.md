---
id: B-0290
zetaid: 081KR2E4K0008QG0R003MJ4JK0
priority: P1
status: open
title: "Green Lantern ring — consent gate firmware design"
created: 2026-05-08
parent: B-0246
depends_on: [B-0289]
classification: blocked-on-B-0289
decomposition: atomic
type: feature
---

# B-0290 — Consent gate firmware

Design the firmware consent gate: local inference runs,
user confirms action via physical button/gesture before
the ring executes. KSK pattern at hardware level.

## Acceptance criteria

- Firmware architecture doc
- Consent flow diagram (input → inference → gate → action)
