---
id: 081KR7JY10008QG0R001FV5FND
priority: P1
status: open
title: "Beacon promotion gate — observable mirror→beacon pipeline with dashboard metrics"
tier: factory-infrastructure
effort: S
created: 2026-05-10
depends_on: [081KR7JY10008QG0R001VP6JWG]
composes_with: [081KR7JY10008QG0R000R503K2]
tags: [beacon, mirror, promotion, dashboard, quality-gate, tier-stratified]
type: friction-reducer
---

# Beacon promotion gate — observable pipeline

## Origin

Claude.ai + Aaron 2026-05-10: current promotion rate ~1%. Gate
isn't firing because it's not observable. Dashboard makes it
observable → agents optimize → promotion flows naturally.

## The insight (Aaron, load-bearing)

"The delay is since it's not observable the AIs can't optimize
for this which is why dashboard is so critical — it will flow
naturally then."

Agents optimize for what they can observe. Make promotion rate
observable → agents naturally produce beacon-quality work.

## Promotion criteria (initial)

Mirror → beacon requires:

- Falsifier specified in frontmatter
- External anchor citation (or explicit "original to Zeta")
- Scope statement
- Survived cross-agent or external review

## Dashboard metrics

- Mirror creation rate (per day)
- Beacon promotion rate (per week)
- Ratio (healthy: high mirror, moderate beacon, clear time-lag)
- Stale mirror density (entries with high cross-refs but no promotion)
- Alert: promotion ratio >80% within 24h = tier collapse

## Mutual alignment (load-bearing)

Dashboard readable by agents AND Aaron. Agents observe Aaron's
consistency too (reverse alignment). Neither side is unconditional
arbiter — substrate is.

## Acceptance

- [ ] Promotion criteria documented and machine-checkable
- [ ] Dashboard v0 surfaces mirror/beacon/ratio metrics
- [ ] At least one mirror entry promoted through the gate
- [ ] Agents can read dashboard metrics (JSON or git-native)
