---
id: 081KR50HA0008QG0R0005ABWPH
priority: P2
status: closed
closed: 2026-05-10
closed_by: "pre-edit-recent-read.ts + post-read-track.ts + settings.json wiring"
title: Pre-Edit hook: recent-Read + mtime enforcement (Otto-343 Edit-without-Read) (081KR50HA0008QG0R002B3N54S dep)
tier: hygiene-tooling-and-discipline
effort: S
ask: TS hook implementation for Edit-without-Read failure mode
created: 2026-05-09
last_updated: 2026-05-10
depends_on: [081KR50HA0008QG0R002B3N54S]
composes_with: [081KQ3HBZ0008QG0R0008RYCSX]
tags: [pre-edit-hook, recent-read, mtime, otto-343]
type: friction-reducer
---

# 081KR50HA0008QG0R0005ABWPH — Pre-Edit recent-Read enforcement hook

Atomic child. Depends on 081KR50HA0008QG0R002B3N54S. TS implementation of Pre-Edit hook.

## Pre-start checklist

- **Prior-art search**: no existing PostToolUse hooks. No Read-tracking mechanism. `verify-branch-pretooluse.ts` is the only existing hook. 081KR50HA0008QG0R002B3N54S (harness.ts) landed in PR #2395. No duplicate substrate.
- **Dependency-restructure**: 081KR50HA0008QG0R002B3N54S must merge first (provides harness.ts). 081KR50HA0008QG0R0005ABWPH imports harness.ts.

## Deliverables

- `.claude/hooks/post-read-track.ts` — PostToolUse on Read: records `{filePath → timestamp}` to `/tmp/zeta-reads-{ppid}.json`
- `.claude/hooks/pre-edit-recent-read.ts` — PreToolUse on Edit: denies if file not Read within 2h window; degrades permissively if no log exists
- `.claude/settings.json` — wires both hooks (PostToolUse[Read] + PreToolUse[Edit])

## Design decisions

- **Session key = ppid**: hooks run as child processes of the Claude Code session; PPID is consistent within a session.
- **2-hour recency window**: generous enough for task-length work without being stale.
- **Graceful degradation**: if the read log is absent (first session tick), the hook allows rather than blocking — avoids hard-blocking legitimate bootstrapping.

## Focused checks

| Check | Result |
|---|---|
| `dotnet build -c Release` | ✅ 0 Warning(s), 0 Error(s) |
| `bunx tsc --noEmit` | ✅ clean |
