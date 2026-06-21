---
id: 081KR50HA0008QG0R0033B5KVN
priority: P1
status: closed
closed: 2026-05-10
closed_by: "all 7 bullets extracted — dont-refuse-engagement + lost-files-surface + dsl-form-replacement + claude-code-loading-taxonomy extracted in this PR; wake-time-substrate + skill-router + rule-0 in prior PR"
title: "Extract meta/governance bullets to .claude/rules/"
created: 2026-05-09
last_updated: 2026-05-10
depends_on:
  - 081KR50HA0008QG0R000ZKBHE4
decomposition: atomic
classification: completed
type: friction-reducer
owners: [architect]
parent: 081KR2E4K0008QG0R001F0YB5S
---

# 081KR50HA0008QG0R0033B5KVN — Extract meta/governance bullets to `.claude/rules/`

## What

Extract the following CLAUDE.md bullets into standalone
`.claude/rules/<name>.md` files:

Target bullets (meta-rules & governance):

1. **Don't refuse engagement on surface signal alone** (~80 lines)
2. **Wake-time substrate or it didn't land** (~43 lines)
3. **Lost-files surface + bullet-time-recovery signal** (long paragraph)
4. **DSL-form replacement direction** (long paragraph)
5. **Skill router as substrate inventory** (~24 lines)
6. **Claude Code loading taxonomy** (~37 lines)
7. **Rule 0 — no more .sh files** (long paragraph)

## Why

These 7 bullets are the longest in CLAUDE.md — several are
single paragraphs exceeding 40 lines. "Don't refuse engagement"
alone is ~80 lines. Together they account for ~300+ lines.
These are meta-level governance decisions that auto-load
correctly from `.claude/rules/`.

## Acceptance criteria

1. 7 new `.claude/rules/<name>.md` files created.
2. Each follows the carved-sentence + operational-content
   structure.
3. CLAUDE.md bullets replaced with 1-2 line pointers.
4. Build gate passes.

## Effort

M — mechanical extraction, ~2-3 hours.
