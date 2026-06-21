---
id: 081KRA5AR0008QG0R0010A24JD
priority: P2
status: open
title: Wire TS CURRENT staleness checker into CI gate (gate.yml hygiene job)
tier: factory-hygiene
effort: S
ask: Extend existing hygiene CI (or new job) to invoke the TS checker from 081KRA5AR0008QG0R002A78X5F for known maintainers (aaron, amara, ani). Fail PR if stale without override. CI-only (non-blocking local commit).
created: 2026-05-11
last_updated: 2026-05-11
depends_on:
  - 081KRA5AR0008QG0R002A78X5F
composes_with:
  - 081KQDTYV0008QG0R002424VSE
  - .github/workflows/gate.yml
tags: [riven-2026-05-11, ci-integration, mechanical-enforcement]
type: friction-reducer
---

# 081KRA5AR0008QG0R0010A24JD — CI integration of CURRENT freshness check

## Why

081KQDTYV0008QG0R002424VSE offered hook vs CI tradeoff; this child picks the less-aggressive CI path first (allows local work, blocks merge). Depends on .1 core.

## Acceptance

- .github/workflows/gate.yml (or hygiene sub-job) calls `bun tools/hygiene/check-current-freshness.ts aaron` (and siblings)
- Job fails with clear diagnostic + link to fix (update CURRENT or add override)
- Matrix or matrix-free for 3 maintainers
- No new secrets; uses existing gh context
- Outcome: PR cannot merge while stale

## Order

After 081KRA5AR0008QG0R002A78X5F lands (core testable), this wires it.
