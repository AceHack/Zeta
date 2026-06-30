---
id: B-0506
priority: P3
status: closed
title: "Stale-worktree prune cadence — mechanize `git worktree prune --expire=now`"
tier: factory-hygiene
effort: S
created: 2026-05-14
last_updated: 2026-05-16
closed: 2026-05-16
depends_on: []
composes_with: [B-0400, B-0444]
tags: [worktree, hygiene, factory-cadence, multi-foreground-surface, friction-reducer]
type: chore
---

# Stale-worktree prune cadence

## Origin

Otto-CLI 2026-05-14T18:13Z observed 23 stale `/private/tmp/zeta-*` worktree entries on the primary maintainer machine, all from yesterday's session crash. The stale entries cause a recurring lockout pattern: `git checkout <branch>` and `git worktree add ... <branch>` both fail with `fatal: '<branch>' is already used by worktree at '<path>'` even when `<path>` no longer exists on disk.

Empirically encountered on PR #3153 thread-investigation tick: had to manually force-remove the stale worktree before being able to inspect the branch. The full cleanup with `git worktree prune --expire=now -v` cleared all 23 in one shot at 18:17Z.

## Problem class

Stale worktrees accumulate when:

- A `/private/tmp/zeta-*` worktree exists when its host process crashes or its machine reboots
- The directory is later cleaned up (by `/tmp` retention or manual delete) but the `.git/worktrees/<name>/` admin entry remains
- `git worktree prune` (no flags) does NOT auto-expire these — there's a default minimum age before pruning fires

The accumulation is silent until another agent tries to check out the same branch. Then it surfaces as a hard-to-diagnose checkout failure.

## Proposed mechanization

Add a small TypeScript audit tool: `tools/hygiene/audit-stale-worktrees.ts`

Behavior:

1. Enumerate all worktrees via `git worktree list --porcelain`
2. For each, check whether the working-tree path exists on disk
3. Report stale entries (markdown summary)
4. With `--prune`, run `git worktree prune --expire=now -v` to remove them

Wire into:

- A periodic cadence (suggested: per-tick in autonomous-loop, OR a daily GitHub Actions cron)
- Manual invocation when an agent encounters a "branch already used by worktree" error

## Composes with

- B-0400 (bus protocol — multi-Otto coordination context where this pattern manifests)
- B-0444 (bus claim envelope `worktree` field — sibling discipline for claim observability)
- `.claude/rules/claim-acquire-before-worktree-work.md` (the discipline this friction-reducer supports)
- `.claude/rules/encoding-rules-without-mechanizing.md` (the failure mode this row addresses)

## Substrate-honest framing

This is a P3 friction-reducer, not a P0 substrate gap. The cleanup is straightforward and only matters when multi-agent worktree contention occurs. Filed as backlog row rather than implemented immediately because:

1. The manual `git worktree prune --expire=now` works and has been run this tick (clears 23 stale entries)
2. The mechanization is small (~30 lines TS) but adds a file + PR cycle that exceeds the per-tick value
3. Future ticks (or another agent) can pick up via standard backlog flow

## Origin tick

`docs/hygiene-history/ticks/2026/05/14/1817Z.md` — this tick's shard documents the empirical observation and the manual cleanup.

## Resolution (2026-05-16)

Mechanization shipped 2026-05-14 via **PR #3225** (`feat(B-0506): mechanize stale-worktree audit — audit-stale-worktrees.ts (clean branch)`, merged).

The shipped tool [`tools/hygiene/audit-stale-worktrees.ts`](../../../tools/hygiene/audit-stale-worktrees.ts) implements every behavior named in "Proposed mechanization" above:

| Specified behavior | Status |
|---|---|
| Enumerate via `git worktree list --porcelain` | shipped |
| Existence-check each working-tree path | shipped |
| Markdown summary report (`--report PATH`) | shipped |
| `--prune` runs `git worktree prune --expire=now -v` | shipped |
| Exit codes (0 / 64 / 128) | shipped |
| DST-friendly (only timestamp non-deterministic) | shipped |

Phase 2 (GHA cron wire-up + per-Otto-process worktree isolation) is **out of scope** per the tool's own header comment and would compose with `factory-hygiene-audit-cadence.yml` if/when needed; that's a separate row, not a B-0506 obligation.

Row left open from 2026-05-14 to 2026-05-16 due to substrate drift — the mechanization PR landed but this row was never marked closed. Caught this tick by Otto-CLI 2026-05-16T04:19Z while picking a P3 friction-reducer; tried to claim+implement, discovered the tool already existed at the proposed path. Closing instead.
