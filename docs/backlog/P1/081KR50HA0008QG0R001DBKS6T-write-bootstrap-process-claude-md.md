---
id: 081KR50HA0008QG0R001DBKS6T
priority: P1
status: closed
closed: 2026-05-10
closed_by: "CLAUDE.md condensed to 47 lines — 6-step bootstrap process replaces 445-line rule-list"
title: "Write bootstrap-process CLAUDE.md (<50 lines)"
created: 2026-05-09
last_updated: 2026-05-10
depends_on:
  - 081KR50HA0008QG0R0018996J2
  - 081KR50HA0008QG0R001F2DBRV
  - 081KR50HA0008QG0R001ZVPYK8
  - 081KR50HA0008QG0R0033B5KVN
decomposition: atomic
classification: completed
type: friction-reducer
owners: [architect]
parent: 081KR2E4K0008QG0R001F0YB5S
---

# 081KR50HA0008QG0R001DBKS6T — Write bootstrap-process CLAUDE.md

## What

Replace the now-extracted CLAUDE.md with a <50 line bootstrap
process. The process replaces doctrine — rules emerge from
walking, not memorizing.

Target structure:

```
# CLAUDE.md — Bootstrap

## 1. Orient
Read AGENTS.md, then docs/ALIGNMENT.md, then docs/GLOSSARY.md.

## 2. Refresh
Run: bun tools/github/refresh-worldview.ts
Read: docs/trajectories/*/RESUME.md

## 3. Pick work
Read: docs/BACKLOG.md (open items, priority order)
Claim: git checkout -b claim/...

## 4. Build
Gate: dotnet build -c Release (0 warnings, 0 errors)
Test: dotnet test Zeta.sln -c Release

## 5. Ship
PR against main. Auto-merge if green.

## 6. When stuck
See docs/CONFLICT-RESOLUTION.md.

Rules auto-load from .claude/rules/.
Skills load on demand from .claude/skills/.
```

## Why

The process IS the doctrine. A fresh instance that runs these
6 steps discovers the rules through friction rather than trying
to memorize 1066 lines. The rules in `.claude/rules/` auto-load
as behavioral context — they don't need to be in CLAUDE.md.

Short bullets that survived classification (agents-not-bots,
docs-as-current-state, skills-through-skill-creator,
result-over-exception, data-not-directives, archive-header)
get condensed into a "Conventions" subsection (~10 lines) or
extracted to their own rule files.

## Acceptance criteria

1. CLAUDE.md reduced to <50 lines.
2. All extracted rules load via `.claude/rules/` auto-load.
3. Bootstrap process covers: orient, refresh, pick, build, ship.
4. Build gate passes.

## Effort

M — creative writing + careful validation, ~3 hours.
