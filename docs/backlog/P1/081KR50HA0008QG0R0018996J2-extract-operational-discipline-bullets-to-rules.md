---
id: 081KR50HA0008QG0R0018996J2
priority: P1
status: closed
title: "Extract operational-discipline bullets to .claude/rules/"
created: 2026-05-09
last_updated: 2026-05-09
completed: 2026-05-09
depends_on:
  - 081KR50HA0008QG0R000ZKBHE4
decomposition: atomic
classification: buildable-now
type: friction-reducer
owners: [architect]
parent: 081KR2E4K0008QG0R001F0YB5S
---

# 081KR50HA0008QG0R0018996J2 — Extract operational-discipline bullets to `.claude/rules/`

## What

Extract the following CLAUDE.md bullets into standalone
`.claude/rules/<name>.md` files. Each CLAUDE.md bullet shrinks
to a 1-2 line pointer ("see `.claude/rules/<name>.md`").

Target bullets (operational discipline — how the agent works):

1. **Verify-before-deferring** (~11 lines)
2. **Future-self is not bound by past-self** (~14 lines)
3. **Search-first authority** (~33 lines)
4. **Refresh-before-decide** (~24 lines)
5. **Refresh world model via `tools/github/poll-pr-gate.ts`** (~26 lines)
6. **BLOCKED-with-green-CI means investigate** (~23 lines)
7. **Backlog-item start gate** (long single-paragraph)

## Why

These 7 bullets account for ~150+ lines of CLAUDE.md. They are
behavioral rules (not identity, not infrastructure) that
`.claude/rules/` auto-loads at session start. Extraction is
additive — the rules still load, CLAUDE.md shrinks.

## Acceptance criteria

1. 7 new `.claude/rules/<name>.md` files created.
2. Each file has the carved-sentence + operational-content +
   full-reasoning-pointer structure (matching existing rules).
3. CLAUDE.md bullets replaced with 1-2 line pointers.
4. Build gate passes (`dotnet build -c Release`).
5. Fresh session test: rules content accessible without
   explicit Read.

## Effort

M — mechanical extraction, ~2-3 hours.
