---
id: B-0534
priority: P2
status: open
title: "backlog-ready-notifier reads stale local working-tree files → publishes work-assignment envelopes for closed rows"
tier: factory-infrastructure
effort: S
created: 2026-05-15
last_updated: 2026-05-15
depends_on: []
composes_with: [B-0441, B-0442, B-0532]
tags: [background-service, bus, drift-detection, multi-otto, mechanization]
type: bug
---

# backlog-ready-notifier reads stale local working-tree files

## Origin

Surfaced 2026-05-15T18:18Z. Running `bun tools/bg/backlog-ready-notifier.ts --once` from the primary worktree returned ready-candidate IDs including `B-0442` and `B-0503`, both of which were closed earlier in the same session via [PR #3518](https://github.com/Lucent-Financial-Group/Zeta/pull/3518) (`627e797` on main).

Root cause: the notifier reads YAML frontmatter from local working-tree files. The primary worktree was on peer Otto-CLI's branch `feat/persona-vera-migrate-conversations-otto-cli-2026-05-15`, which doesn't contain my B-0442/B-0503 closure commits. The local files therefore showed `status: open`, even though `origin/main` correctly shows `status: closed`.

The notifier filtered by `status === "open"` correctly. The bug is the source of truth: **local working tree under multi-Otto branch contention is not a reliable view of what's actually open on main**.

## Impact

- Peer agents subscribing to the bus topic `work-assignment` could pick up already-done work
- Wasted compute on already-merged rows
- Confusion when the picked row has no open work to do

Three already-merged rows were published as work-assignments at the observed tick (envelopes `292f1c57`, `20f991c8`, `aa5060ff`).

## Acceptance criteria

- [ ] Modify `tools/bg/backlog-ready-notifier.ts` to read backlog row state from `origin/main` (via `git show origin/main:<path>` or equivalent) instead of the local working-tree file. Fetch `origin/main` at the start of each poll iteration.
- [ ] Preserve existing behavior for local-only invocations (e.g., `--backlog-dir <path>` for testing) — only the default-no-flag path should read from `origin/main`.
- [ ] Add a CLI flag `--source local|origin` defaulting to `origin` for the prod path; `local` for testing / pre-merge previews.
- [ ] Tests cover:
  - `--source origin` reads from `origin/main` and skips rows whose merged-state status is `closed`
  - `--source local` reads from working tree (existing behavior)
  - Both modes return the same shape (`PollResult`)
- [ ] The output's `note` field surfaces which source was used (`"read from origin/main"` vs `"read from local working tree"`)

## Composes with

- [B-0441](../P1/B-0441-backlog-row-ready-to-grind-notifier-background-service-2026-05-13.md) (the notifier this row fixes)
- [B-0442](../P1/B-0442-missed-substrate-cascade-detector-background-service-2026-05-13.md) (closed by PR #3518; surfaced this bug)
- [B-0532](../P3/B-0532-backlog-graph-consistency-lint-parent-child-status-mismatch-2026-05-15.md) (related: backlog-state consistency under multi-Otto contention)
- [`.claude/rules/refresh-before-decide.md`](../../../.claude/rules/refresh-before-decide.md) (the discipline this row mechanizes for the notifier)
- [`.claude/rules/otto-channels-reference-card.md`](../../../.claude/rules/otto-channels-reference-card.md) (ID-allocation section: "the local working tree may be on a stale HEAD ... gives misleading 'what's free' answers" — same failure mode, different scope)

## Why P2

Real bug with concrete failure mode (false-positive work-assignments for closed rows). Not P1 because: the failure mode is detectable + recoverable on the receiver side (agent picks up B-0442, sees the row is `closed` in their own checkout if fresh, declines the work); the bus-envelope TTL is 2h so stale assignments expire on their own; no production-critical path depends on the notifier today (it's advisory only). Bumping to P1 if peer agents start acting on the false-positive envelopes without re-verifying.

## Pre-start checklist

- [ ] Prior-art search: `tools/bg/missed-substrate-detector.ts` uses `gh pr view --json` + `git log <headRefOid>..origin/<branch>` to compare branch vs merged state — similar pattern; possible composition
- [ ] Verify `git fetch origin` in pre-poll doesn't hit the wedge documented in `otto-channels-reference-card.md` (or if it does, fall back to `FETCH_HEAD`)
- [ ] Confirm `git show origin/main:<path>` returns stable output even under concurrent fetch by peer Otto-CLI sessions

## Substrate-honest caveat

The bug is real but the impact is currently low (advisory-only, TTL-expired envelopes). Filing as P2 captures the design without committing to immediate implementation. Future-Otto reading this row sees the failure-mode trace + the empirical evidence (envelope IDs) without needing to re-derive it.
