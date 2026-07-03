---
id: B-0558
priority: P3
status: open
title: "Worktree-pool primitive — pre-allocated isolated sideticks per Otto identity"
tier: factory-infrastructure
effort: M
created: 2026-05-16
depends_on: []
composes_with: [B-0506, B-0519, B-0530]
tags: [autonomous-loop, multi-Otto-CLI, git-contention, worktree, mechanization]
type: feat
---

# Worktree-pool primitive — pre-allocated isolated sideticks per Otto identity

## Origin

Tick 06:43Z-07:18Z (2026-05-16): a fresh-cold-boot Otto-CLI session firing during peer Otto's active cascade took **4 commit attempts** to ship a tick shard. The 4 attempts empirically validated all 4 distinct failure sub-cases of [`.claude/rules/claim-acquire-before-worktree-work.md`](../../../.claude/rules/claim-acquire-before-worktree-work.md)'s borrow-on-existing pattern under sustained multi-Otto saturation:

| # | Sub-case | Mitigation status |
|---|---|---|
| 1 | Existing-branch-name reuse → peer-WIP commit inheritance | ✓ uniquified name + git rev-parse pre-check |
| 2 | Concurrent-WIP-blocked switch | ✓ wait for working-tree-clean window (capacity-limited) |
| 3 | Pack-dir B-0530 race on `git worktree add` | ✗ NO MITIGATION — needs [B-0530](B-0530-cron-sentinel-mutex-prevent-otto-cli-self-contention-2026-05-15.md) mutex |
| 4 | Pruned-sidetick race | ✗ NO MITIGATION — needs THIS ROW |

Empirical anchors:

- Shard PR [#3808](https://github.com/Lucent-Financial-Group/Zeta/pull/3808) (`docs/hygiene-history/ticks/2026/05/16/0715Z.md`) — the 4-tick-arc evidence
- Rule PR [#3812](https://github.com/Lucent-Financial-Group/Zeta/pull/3812) — operationalizes sub-cases 1+2 mitigations into rule body, flags 3+4 as needing substrate-engineer work

## Problem

Sub-case 4 (pruned-sidetick race) blocks fresh-cold-boot Otto-CLI sessions from finding ANY clean workspace when:

1. New `git worktree add` hits sub-case 3 (B-0530 race; hangs on pack-dir contention)
2. Existing-sidetick fallback (per the borrow-on-existing rule) requires walking `git worktree list` and picking a sidetick listed there
3. BUT — peer Otto sessions periodically prune stale sidetick directories. The directory disappears between the `git worktree list` snapshot and the borrow attempt
4. Result: `git -C <sidetick>` returns "cannot change to ... No such file or directory" — fresh session has no fallback

Empirical: the canonical sidetick `/private/tmp/zeta-otto-cli-0027z-sidetick` was listed in `git worktree list` at 07:09Z (this session) and pruned by the time of the borrow attempt seconds later.

## Proposed substrate

**Worktree-pool primitive** — pre-allocated isolated sideticks per Otto identity, owned and refreshed by each identity, NOT subject to peer-prune.

### Design

1. **Per-Otto-identity worktree pool**: each Otto identity (otto-cli, otto-bg-worker, otto-cli-coldboot, otto-desktop) owns a stable path like `/var/zeta-worktrees/<identity>/sidetick-<N>` (or under `$HOME/.zeta-worktrees/<identity>/`). Pool size: 2-3 sideticks per identity (one for active work, one for next-tick, one buffer).

2. **Ownership marker**: each pool sidetick contains a `.zeta-pool-owner` file with the identity name. Peer Otto sessions' pruning logic respects this marker (skip if `.zeta-pool-owner` matches a known identity that isn't theirs).

3. **Refresh discipline**: at session start (cold-boot), each Otto identity ensures its pool sideticks exist and are at `origin/main`:
   - If sidetick directory missing: `git worktree add <path> origin/main` (one-shot per identity per cold-boot; rare so contention low)
   - If sidetick exists: `git -C <path> fetch + reset --hard origin/main` (always safe at session start)

4. **Allocation API**: a TS helper at `tools/worktree-pool/allocate.ts`:
   - `allocate(identity)` returns a free sidetick path (one not currently in use by this session)
   - `release(identity, path)` marks the sidetick as available
   - Locking via filesystem flock on the marker file (no bus dependency)

5. **Integration with autonomous-loop**: scheduled-task firings call `allocate(identity)` first, work in that path, `release()` at tick end. The autonomous-loop SKILL.md documents the pool usage.

### Composes with

- [B-0530](B-0530-cron-sentinel-mutex-prevent-otto-cli-self-contention-2026-05-15.md) — sub-case 3 mitigation; together they address all 4 sub-cases
- [B-0519](B-0519-multi-otto-branch-state-contamination-rca-2026-05-14.md) — multi-Otto contamination RCA at branch-state scope; this row addresses worktree-path scope
- [B-0506] — autonomous-loop substrate
- [`.claude/rules/claim-acquire-before-worktree-work.md`](../../../.claude/rules/claim-acquire-before-worktree-work.md) — the rule that documents the saturation-ceiling sub-cases; this row's substrate operationalizes the mitigation for sub-case 4

## Acceptance

- [ ] `tools/worktree-pool/allocate.ts` shipped with `allocate(identity)` + `release(identity, path)` API
- [ ] Pool directory layout established (e.g., `/var/zeta-worktrees/<identity>/`) and documented
- [ ] `.zeta-pool-owner` marker convention respected by peer-Otto pruning logic
- [ ] Autonomous-loop SKILL.md updated to use pool API
- [ ] Empirical validation: a fresh-cold-boot Otto-CLI session ships a shard during peer cascade without hitting any of the 4 sub-cases
- [ ] Rule body in `.claude/rules/claim-acquire-before-worktree-work.md` updated to mark sub-cases 3+4 as MITIGATED when this row + B-0530 close

## Scope-boundary flags

- This row addresses worktree-path-scope contention. Does NOT address branch-state-scope contention (that's B-0519's domain).
- Worktree-pool size > 3 per identity introduces resource overhead; cap at small N.
- Peer-Otto-side respect for `.zeta-pool-owner` marker requires coordination across all Otto identities' pruning scripts; this may need a separate slice if pruning logic isn't yet centralized.

## Effort estimate

**M** (1-2 ticks of focused work):

- ~60 lines TS for `allocate.ts` + tests
- ~30 lines edit to autonomous-loop SKILL.md
- ~20 lines edit to peer-Otto-side pruning logic (if centralized) or per-identity prune updates
- Empirical validation via repeat-the-failure-mode test

## Status notes

Filed 2026-05-16 from the fresh-cold-boot Otto-CLI session that empirically validated all 4 sub-cases (~32 min, 4 commit attempts, 2 substrate PRs shipped: [#3808](https://github.com/Lucent-Financial-Group/Zeta/pull/3808) + [#3812](https://github.com/Lucent-Financial-Group/Zeta/pull/3812)). This row completes the substrate trilogy:

- #3808 = WHAT was observed (empirical evidence)
- #3812 = WHAT TO DO when observing it (operational mitigations for sub-cases 1+2)
- This row = WHAT TO BUILD to prevent it (structural fix for sub-case 4)

Sub-case 3's structural fix is B-0530 (already filed, closed status pending mutex implementation).
