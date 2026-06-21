---
id: 081KR2E4K0008QG0R001B6K45W
priority: P1
status: closed
title: 081KQ0YZ80008QG0R001V0XCYZ acceptance recalibration — adjust compression targets given load-bearing classification
tier: maintenance
effort: S
ask: 081KQR4HQ0008QG0R001909FPT acceptance criterion 3
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQR4HQ0008QG0R001909FPT
depends_on: [081KR2E4K0008QG0R002FRQZN4]
composes_with: [081KQR4HQ0008QG0R001909FPT, 081KQ0YZ80008QG0R001V0XCYZ, 081KR2E4K0008QG0R002FRQZN4]
tags: [memory, compression, recalibration, trajectory-child]
type: friction-reducer
---

# 081KR2E4K0008QG0R001B6K45W — 081KQ0YZ80008QG0R001V0XCYZ acceptance recalibration

## Parent

081KQR4HQ0008QG0R001909FPT acceptance criterion 3: "081KQ0YZ80008QG0R001V0XCYZ acceptance criteria
recalibrated — the original <=200-char-per-entry is unreachable
for 440 entries; either narrow target or formally accept the
deviation."

## What

Recalibrate 081KQ0YZ80008QG0R001V0XCYZ's acceptance criteria using the load-bearing
classification from 081KR2E4K0008QG0R002FRQZN4:

1. **Differentiated targets** — load-bearing entries get more
   space (up to ~200 chars); decorative entries get aggressive
   compression (~100 chars) or are candidates for index removal.
2. **Feasibility check** — given the current entry count, what
   per-entry char target keeps MEMORY.md under 200 lines?
3. **Update 081KQ0YZ80008QG0R001V0XCYZ** — edit its acceptance criteria section to
   reflect the recalibrated targets.

## Why depends on 081KR2E4K0008QG0R002FRQZN4

The load-bearing-vs-decorative classification determines which
entries deserve more index space and which can be compressed
aggressively or removed from the index.

## Acceptance criteria

1. 081KQ0YZ80008QG0R001V0XCYZ's acceptance criteria section updated with
   recalibrated, achievable targets.
2. Targets differentiate load-bearing vs decorative entries.
3. Feasibility math shown (entry count x target chars <=
   200 lines).

## Why S effort

Analysis + one file edit. No tooling needed.
