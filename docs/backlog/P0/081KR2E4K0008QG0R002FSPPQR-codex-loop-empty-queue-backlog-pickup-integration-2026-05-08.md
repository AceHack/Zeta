---
id: B-0281
zetaid: 081KR2E4K0008QG0R002FSPPQR
priority: P0
status: closed
title: "Codex loop - empty queue autonomous backlog pickup"
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0249
depends_on: [B-0280]
classification: completed
decomposition: atomic
owners: [architect, codex]
type: friction-reducer
---

# B-0281 - Empty-queue backlog pickup integration

Wire the selector, claim bootstrap, and PR publication path into the
Codex background loop so an empty PR queue starts new work.

## Acceptance criteria

- Runs only after PR maintenance finds no actionable open PR.
- Picks at most one backlog row per tick.
- Uses the same cooldown and heartbeat discipline as existing loop
  work.
- Writes a durable decision trace to loop logs.
- Leaves the root checkout untouched.
