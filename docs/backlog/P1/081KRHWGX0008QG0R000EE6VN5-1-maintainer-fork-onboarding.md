---
id: 081KRHWGX0008QG0R000EE6VN5
priority: P1
status: open
title: "Multi-site fork — maintainer fork onboarding and mirror-sync setup for Addison and Max"
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KQZVQW0008QG0R0032TPKT8
depends_on: [081KQDTYV0008QG0R001Y2E9TD]
decomposition: atomic
owners: [security-auditor]
type: feature
---

# 081KRHWGX0008QG0R000EE6VN5 — Maintainer fork onboarding and mirror-sync

## What

First slice of 081KQZVQW0008QG0R0032TPKT8. Extract the repository redundancy steps to give Addison and Max clean, documented fork/mirror onboarding packets.

## Scope

1. Document the maintainer fork onboarding process for Addison and Max.
2. Establish mirror-sync setup per `.claude/skills/mirror-sync/SKILL.md`.
3. Provide a runbook to verify mirror freshness using force-with-lease or an approved PR-based mirror path.

## Acceptance criteria

- Addison and Max each have a documented fork/mirror onboarding packet.
- At least two non-LFG mirrors can be refreshed following the protocol.
