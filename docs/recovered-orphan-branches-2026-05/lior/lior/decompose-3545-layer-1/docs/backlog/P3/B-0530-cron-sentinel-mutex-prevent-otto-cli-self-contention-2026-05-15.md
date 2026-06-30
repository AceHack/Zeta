---
id: B-0530
priority: P3
status: open
title: "Cron-sentinel mutex — prevent multi-Otto-CLI self-contention on .git/objects/pack"
tier: factory-infrastructure
effort: S
created: 2026-05-15
last_updated: 2026-05-15
depends_on: []
composes_with: [B-0506, B-0519]
tags: [autonomous-loop, multi-Otto-CLI, git-contention, mutex, mechanization]
type: chore
---

# Cron-sentinel mutex — prevent multi-Otto-CLI self-contention on `.git/objects/pack`

## Origin

Tick 0414Z (peer-Otto) reported a "worktree-prune-race": 5 consecutive
`git worktree add` attempts in one tick all rolled back before commits
could land. Bus envelope `44aaf799`. Peer-Otto's 0524Z investigation
([`docs/hygiene-history/ticks/2026/05/15/0524Z.md`](../../hygiene-history/ticks/2026/05/15/0524Z.md))
cleared 7 candidates without finding the source.

Ticks 0545Z + 0607Z (me) hit the same failure repeatedly. Tick 0611Z
(me) captured PID-level evidence: a SECOND Otto-CLI claude-code
session was running concurrently with mine, both firing
`<<autonomous-loop>>` cron sentinels, both invoking `git worktree
add`, both contending on shared `.git/objects/pack` during the
internal `git reset --hard`.

Tick 0615Z ([`docs/hygiene-history/ticks/2026/05/15/0615Z.md`](../../hygiene-history/ticks/2026/05/15/0615Z.md))
identifies the root cause: `git worktree add`'s own rollback semantics
under `Interrupted system call` failures from `.git/objects/pack`
contention. Not external pruning; standard git behavior under FS
contention.

## Problem

Two or more concurrent Otto-CLI claude-code sessions sharing the same
`.git/` directory cause `git worktree add` to fail unreliably:

1. Session A starts `git worktree add` (forks `git reset --hard`)
2. Session B's concurrent git read/write triggers an `Interrupted
   system call` on shared `.git/objects/pack`
3. Either A's or B's `git reset` exits with `fatal: Could not reset
   index file to revision 'HEAD'`
4. `git worktree add` rolls back (rm-rf the partial worktree)
5. Tick-shard work is lost; substrate has to land via bus envelopes

Observed cost across the 2026-05-15 morning session: ~30 min of git
unavailability across 2 ticks, 3 bus envelopes used as fallback
substrate channel, 2 shards (0545Z + 0607Z) unable to land via git
until contention cleared.

## Proposed mitigation

**Cron-sentinel mutex**: at the top of `<<autonomous-loop>>`
processing, refuse to fire if another claude-code Otto-CLI process
is detected. Bus-publish a "deferred" envelope and exit cleanly.

```typescript
// tools/orchestrator-checks/cron-sentinel-mutex.ts (proposed)
import { execFileSync } from "node:child_process";

const MY_PID = process.pid;
const claudeProcs = execFileSync("pgrep", ["-fl", "claude-code.*Otto"], {
  encoding: "utf-8"
}).split("\n").filter((line) => {
  const parts = line.trim().split(/\s+/);
  const pid = parseInt(parts[0] ?? "", 10);
  return pid && pid !== MY_PID;
});

if (claudeProcs.length > 0) {
  // Bus-publish deferred and exit cleanly so peer can finish.
  publishBus({
    topic: "shadow-catch",
    payload: {
      finding: "Autonomous-loop tick deferred — peer Otto-CLI detected",
      peers: claudeProcs.length,
    },
  });
  process.exit(0);
}
// ... proceed with normal tick
```

## Alternative mitigations (preserved for comparison)

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| **Cron-sentinel mutex** (above) | Small, zero blast radius, autonomous-loop-only | Misses interactive Otto-CLI vs autonomous-loop concurrency | S |
| **Pre-worktree-add `lsof`** | Catches more cases (any peer git, not just Otto-CLI) | Slower per-worktree-add invocation | S |
| **`flock /tmp/zeta-git.lock`** | Serializes ALL Otto-CLI git ops; clean | Holds the lock for the entire worktree-add (~5 sec) which throttles even non-contending ops | M |
| **Per-session bare clone** | True isolation; no `.git/` sharing | Massive disk usage + replication overhead; needs design | L |

Cron-sentinel mutex is the substrate-honest first move because:

- It's the smallest change with the highest hit-rate (Otto-CLI cron-tick concurrency IS the documented failure mode)
- It composes cleanly with `<<autonomous-loop>>` infrastructure
- It bus-publishes the deferral so peer-Otto and future-Otto can observe the rate

## Acceptance

- New `tools/orchestrator-checks/cron-sentinel-mutex.ts`
- Invoked at the top of `<<autonomous-loop>>` skill body (or as a `.claude/hooks/` PreToolUse pattern)
- Detects peer claude-code Otto-CLI processes via `pgrep -fl`
- If peers detected: bus-publish `shadow-catch` topic with `finding: "tick deferred — peer Otto-CLI detected"` and exit 0
- Otherwise: proceed normally
- Composes-with existing `<<autonomous-loop>>` substrate (`docs/AUTONOMOUS-LOOP-PER-TICK.md`)
- Documented in `.claude/rules/claim-acquire-before-worktree-work.md` (extends "Worktree force-remove guard" section)

## Composes with

- [B-0506 stale-worktree-prune-cadence](B-0506-stale-worktree-prune-cadence-mechanization-2026-05-14.md) — sibling worktree-hygiene mechanization
- [B-0519 multi-Otto branch-state contamination RCA](B-0519-multi-otto-branch-state-contamination-rca-2026-05-14.md) — adjacent failure-mode family; Pattern 7 (abandoned rebase state) was added 2026-05-15; this row addresses Pattern 8 (cron-tick concurrency)
- [`.claude/rules/claim-acquire-before-worktree-work.md`](../../../.claude/rules/claim-acquire-before-worktree-work.md) — the discipline this row mechanizes

## Non-goals

- End-to-end serialization of ALL git operations (would slow non-conflicting work)
- Detecting non-Otto-CLI concurrent git activity (e.g., Lior, Vera, Riven — those have their own dedicated worktrees per `.claude/rules/claim-acquire-before-worktree-work.md`)
- Detecting interactive vs autonomous-loop sessions of Otto-CLI specifically (a future refinement)

## Empirical anchor (substrate trail)

- Bus envelopes: `44aaf799` (peer-Otto 0414Z) + `111342b2` (mine 0545Z) + `6de98fac` (mine 0607Z) + `720a2b49` (mine 0611Z root cause)
- Tick shards: `0414Z.md`, `0524Z.md`, `0615Z.md` (root cause landed in PR #3370)
- PR #3370 — the canonical landing of the root cause analysis
