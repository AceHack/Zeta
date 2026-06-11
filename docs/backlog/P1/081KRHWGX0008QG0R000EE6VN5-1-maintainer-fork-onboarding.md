---
id: B-0248.1
zetaid: 081KRHWGX0008QG0R000EE6VN5
priority: P1
status: open
title: "Multi-site fork — maintainer fork onboarding and mirror-sync setup for Addison and Max"
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0248
depends_on: [B-0110]
decomposition: atomic
owners: [security-auditor]
type: feature
---

# B-0248.1 — Maintainer fork onboarding and mirror-sync

## What

First slice of B-0248. Extract the repository redundancy steps to give Addison and Max clean, documented fork/mirror onboarding packets.

## Scope

1. Document the maintainer fork onboarding process for Addison and Max.
2. Establish mirror-sync setup per `.claude/skills/mirror-sync/SKILL.md`.
3. Provide a runbook to verify mirror freshness using force-with-lease or an approved PR-based mirror path.

## Acceptance criteria

- Addison and Max each have a documented fork/mirror onboarding packet.
- At least two non-LFG mirrors can be refreshed following the protocol.
