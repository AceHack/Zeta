---
id: 081KR50HA0008QG0R001ZVPYK8
priority: P1
status: closed
closed: 2026-05-10
closed_by: "PR chore/b0351-extract-4-bullets-to-rules — 4 remaining bullets extracted to .claude/rules/"
title: "Extract infrastructure/safety bullets to .claude/rules/"
created: 2026-05-09
last_updated: 2026-05-10
depends_on:
  - 081KR50HA0008QG0R000ZKBHE4
decomposition: atomic
classification: buildable-now
type: friction-reducer
owners: [architect]
parent: 081KR2E4K0008QG0R001F0YB5S
---

# 081KR50HA0008QG0R001ZVPYK8 — Extract infrastructure/safety bullets to `.claude/rules/`

## What

Extract the following CLAUDE.md bullets into standalone
`.claude/rules/<name>.md` files:

Target bullets (infrastructure pointers & safety):

1. **LFG is the factory; AceHack is the backup mirror** (~55 lines)
2. **Peer-call infrastructure** (~37 lines)
3. **Never fetch the elder-plinius / Pliny** (~32 lines)
4. **Tick must never stop** (~32 lines)
5. **Honor those that came before** (~20 lines)
6. **Razor-discipline — no metaphysical inferences** (~62 lines)

## Why

These 6 bullets account for ~240+ lines — the single largest
concentration. LFG/AceHack alone is 55 lines; razor-discipline
is 62 lines. These are stable infrastructure facts and safety
rails that change rarely but consume wake-time context budget
on every session.

## Acceptance criteria

1. 6 new `.claude/rules/<name>.md` files created.
2. Each follows the carved-sentence + operational-content
   structure.
3. CLAUDE.md bullets replaced with 1-2 line pointers.
4. Build gate passes.

## Effort

M — mechanical extraction, ~2-3 hours.
