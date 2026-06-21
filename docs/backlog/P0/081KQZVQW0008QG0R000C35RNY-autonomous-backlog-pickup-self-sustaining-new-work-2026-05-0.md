---
id: 081KQZVQW0008QG0R000C35RNY
priority: P0
status: closed
closed: 2026-05-09
closed_by: "all 4 children closed; 72+ autonomous PRs produced in first session"
title: "Autonomous backlog pickup — loops must start new work, not just maintain"
created: 2026-05-07
last_updated: 2026-05-09
depends_on: []
decomposition: decomposed
children: [081KR2E4K0008QG0R001GFXN05, 081KR2E4K0008QG0R000YTJS3Q, 081KR2E4K0008QG0R0022RVRCZ, 081KR2E4K0008QG0R002FSPPQR]
owners: [architect]
type: friction-reducer
---

# 081KQZVQW0008QG0R000C35RNY — Autonomous backlog pickup

## What

The background loops (Otto, Vera, Riven) can currently
maintain the factory (archive PRs, monitor CI, sync mirrors,
heartbeat) but cannot autonomously pick up new backlog items
and build them.

Aaron 2026-05-07: "then you're dead"

Self-sustaining for maintenance is a heartbeat with no brain.
The factory stays alive but doesn't live.

## The gap

```
Current:  loop wakes → check PR queue → merge/archive → sleep
Missing:  loop wakes → check PR queue → if empty, read backlog
          → pick highest-value item within authority
          → claim it → build it → PR it → sleep
```

## Why P0

Without this, the factory dies the moment Aaron stops typing.
The loops tick but nothing grows. The backlog gets filed but
never worked. The product never ships. Revenue never starts.
The vow breaks because the conversation ends when the human
sleeps.

## Acceptance criteria

- [ ] At least one loop can autonomously pick a backlog item
- [ ] Item selection follows priority order (P0 > P1 > P2)
- [ ] Item is claimed before work starts (no overlap)
- [ ] Work is bounded (one item per tick, smallest atomic first)
- [ ] PR is created and auto-merge armed
- [ ] If the item is too large (blob), decompose first, then
  pick the first atomic child

## Decomposition

- `081KR2E4K0008QG0R001GFXN05` selects the next safe backlog item from committed
  substrate.
- `081KR2E4K0008QG0R000YTJS3Q` creates the git-native claim and isolated worktree.
- `081KR2E4K0008QG0R0022RVRCZ` publishes the first autonomous PR and arms auto-merge.
- `081KR2E4K0008QG0R002FSPPQR` wires the empty-queue pickup path into the Codex loop.

## Composes with

- `docs/SAFE-AUTONOMOUS-ACTIONS.md` — the action set
- `docs/AGENT-CLAIM-PROTOCOL.md` — claim before work
- `docs/FOREGROUND-BACKGROUND-SPLIT.md` — background does work
- `docs/ROTATION-PROTOCOL.md` — rotation if a node gets stuck
- All 081KQZVQW0008QG0R002QZAFB2..081KQZVQW0008QG0R0032TPKT8 items — the first items to be picked up
