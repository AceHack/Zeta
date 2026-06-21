---
id: 081KRA5AR0008QG0R002A78X5F
priority: P2
status: open
title: TS implementation of CURRENT-*.md staleness checker core (Bun + git mtime diff, no bash)
tier: factory-hygiene
effort: S
ask: Pure-TS (Bun) module that, given maintainer name, returns staleness delta between newest memory/feedback_*<name>*.md and memory/CURRENT-<name>.md last commit date. Fail if >24h and no allowlist override. Replaces bash proposal in parent 081KQDTYV0008QG0R002424VSE per Rule 0 (TS over bash).
created: 2026-05-11
last_updated: 2026-05-11
depends_on: []
composes_with:
  - 081KQDTYV0008QG0R002424VSE
  - docs/best-practices/repo-scripting.md
tags: [riven-2026-05-11, ts-over-bash, current-freshness, mechanical-enforcement]
type: friction-reducer
---

# 081KRA5AR0008QG0R002A78X5F — TS CURRENT staleness checker core

## Why

081KQDTYV0008QG0R002424VSE proposed bash; Rule 0 + AGENTS.md mandate TS. This atomic child isolates the pure logic (no workflow, no hook) so it can be unit-tested, reused by CI or pre-commit wrapper, and reviewed independently.

## Acceptance

- Bun script `tools/hygiene/check-current-freshness.ts` (or equiv) exports `checkCurrentFreshness(maintainer: string): Promise<StalenessResult>`
- Uses `Bun.spawn` or `git` child for `git log -1 --format=%at` and `git log --all --format=%at -- memory/feedback_*${name}*.md | sort -n | tail -1`
- Returns { stale: boolean, deltaHours: number, newestFeedback: Date, currentLast: Date, override: string | null }
- Hard 24h default threshold (configurable via env or arg for tests)
- No side effects, pure function + git reads only
- Focused test: mock git, assert on 25h vs 23h cases + override comment parse

## Dependency note

This is the root; 081KRA5AR0008QG0R0010A24JD (CI wiring) and 081KRA5AR0008QG0R0016B8371 (rule update) depend on it.

## Evidence of TS preference

See AGENTS.md "TS over bash (Rule 0)", recent 081KQ8P5D0008QG0R003BFZPRC trajectory, all hygiene ports in PRs #866+.

## Focused check outcome (in worktree)

dotnet build -c Release → 0 Warning(s) 0 Error(s) (pre-existing gate, no new code yet).
