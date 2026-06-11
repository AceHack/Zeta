---
id: B-0336
zetaid: 081KR2E4K0008QG0R001B6K45W
priority: P1
status: closed
title: B-0006 acceptance recalibration — adjust compression targets given load-bearing classification
tier: maintenance
effort: S
ask: B-0190 acceptance criterion 3
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0190
depends_on: [B-0332]
composes_with: [B-0190, B-0006, B-0332]
tags: [memory, compression, recalibration, trajectory-child]
type: friction-reducer
---

# B-0336 — B-0006 acceptance recalibration

## Parent

B-0190 acceptance criterion 3: "B-0006 acceptance criteria
recalibrated — the original <=200-char-per-entry is unreachable
for 440 entries; either narrow target or formally accept the
deviation."

## What

Recalibrate B-0006's acceptance criteria using the load-bearing
classification from B-0332:

1. **Differentiated targets** — load-bearing entries get more
   space (up to ~200 chars); decorative entries get aggressive
   compression (~100 chars) or are candidates for index removal.
2. **Feasibility check** — given the current entry count, what
   per-entry char target keeps MEMORY.md under 200 lines?
3. **Update B-0006** — edit its acceptance criteria section to
   reflect the recalibrated targets.

## Why depends on B-0332

The load-bearing-vs-decorative classification determines which
entries deserve more index space and which can be compressed
aggressively or removed from the index.

## Acceptance criteria

1. B-0006's acceptance criteria section updated with
   recalibrated, achievable targets.
2. Targets differentiate load-bearing vs decorative entries.
3. Feasibility math shown (entry count x target chars <=
   200 lines).

## Why S effort

Analysis + one file edit. No tooling needed.
