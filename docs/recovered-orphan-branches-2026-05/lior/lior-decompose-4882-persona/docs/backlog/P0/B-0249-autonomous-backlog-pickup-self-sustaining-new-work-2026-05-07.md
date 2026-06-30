---
id: B-0249
priority: P0
status: open
title: "Autonomous backlog pickup — loops must start new work, not just maintain"
created: 2026-05-07
last_updated: 2026-05-08
depends_on: []
decomposition: decomposed
children: [B-0278, B-0279, B-0280, B-0281]
owners: [architect]
type: friction-reducer
---

# B-0249 — Autonomous backlog pickup

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

- `B-0278` selects the next safe backlog item from committed
  substrate.
- `B-0279` creates the git-native claim and isolated worktree.
- `B-0280` publishes the first autonomous PR and arms auto-merge.
- `B-0281` wires the empty-queue pickup path into the Codex loop.

## Composes with

- `docs/SAFE-AUTONOMOUS-ACTIONS.md` — the action set
- `docs/AGENT-CLAIM-PROTOCOL.md` — claim before work
- `docs/FOREGROUND-BACKGROUND-SPLIT.md` — background does work
- `docs/ROTATION-PROTOCOL.md` — rotation if a node gets stuck
- All B-0240..B-0248 items — the first items to be picked up
