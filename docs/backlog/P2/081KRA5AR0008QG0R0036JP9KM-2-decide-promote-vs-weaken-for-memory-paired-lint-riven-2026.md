---
id: 081KRA5AR0008QG0R0036JP9KM
priority: P2
status: closed
superseded_by: 081KRFA460008QG0R0035NKRHG
resolved: 2026-05-13
resolved_note: "081KRFA460008QG0R0035NKRHG implemented Option B (remove the architecture entirely — stronger fix than either A or B)"
title: Maintainer decision gate — promote paired-edit lint to required or weaken its discoverability claim
tier: factory-tooling
effort: XS
ask: re-decomposition of 081KQ8P5D0008QG0R002FSTGXP (2026-05-11)
created: 2026-05-11
last_updated: 2026-05-13
parent: 081KQ8P5D0008QG0R002FSTGXP
depends_on: [081KQ8P5D0008QG0R002FSTGXP]
composes_with: [081KQ8P5D0008QG0R002FSTGXP]
tags: [riven-2026-05-11, visibility-constraint, maintainer-action]
type: decision
---

# 081KRA5AR0008QG0R0036JP9KM — Decision: promote or weaken memory paired-edit lint

## Why

After 081KRA5AR0008QG0R000GZ8ECC confirms current advisory state, the choice A (promote, makes claim true) or B (weaken message) must be recorded as durable substrate before any implementation.

## Acceptance

- [ ] Maintainer explicitly selects A or B in a committed memory/ or docs/ entry citing this row
- [ ] If A, follow-up row for the actual branch-protection edit is created
- [ ] If B, follow-up row for lint-message edit is created

## Dependency

Blocked on 081KRA5AR0008QG0R000GZ8ECC fact (child ordering described in prose). This is the human-visible gate per visibility-constraint (Aaron 2026-04-28).

## Out of scope

No code change in this row.
