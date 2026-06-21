---
id: 081KR2E4K0008QG0R000N124VW
priority: P2
status: open
title: Memory graduation ladder — codify when feedback promotes to CLAUDE.md and when CLAUDE.md promotes to GOVERNANCE.md
tier: foundation
effort: M
ask: 081KQR4HQ0008QG0R001909FPT Step 9 decomposition
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQR4HQ0008QG0R001909FPT
depends_on: [081KR2E4K0008QG0R002VM58S4, 081KR2E4K0008QG0R002FRQZN4, 081KR2E4K0008QG0R00175HQR9]
composes_with: [081KQR4HQ0008QG0R001909FPT, 081KR2E4K0008QG0R002VM58S4, 081KR2E4K0008QG0R002FRQZN4, 081KR2E4K0008QG0R00175HQR9]
tags: [memory, graduation, meta-discipline, trajectory-child]
type: friction-reducer
---

# 081KR2E4K0008QG0R000N124VW — Memory graduation ladder

## Parent

081KQR4HQ0008QG0R001909FPT Step 9 (memory-as-substrate-engineering meta-discipline).

## What

Codify the graduation ladder for memory content:

1. **When to write a new memory file vs append to an existing
   one** — criteria for new-file vs extend-existing.
2. **When a feedback_ file gets promoted to a CLAUDE.md bullet**
   — the threshold: wake-time-load-bearing + recognition-failure
   component (per Claude Code loading taxonomy memo).
3. **When a CLAUDE.md bullet gets promoted to GOVERNANCE.md** —
   the threshold: applies to all harnesses + numbered-rule
   stability.
4. **When a CLAUDE.md bullet gets demoted back to memory** — the
   threshold: no longer wake-time-load-bearing (e.g., the lesson
   has been mechanized into a tool/hook).

## Why depends on 081KR2E4K0008QG0R002VM58S4, 081KR2E4K0008QG0R002FRQZN4, 081KR2E4K0008QG0R00175HQR9

- 081KR2E4K0008QG0R002VM58S4 (format) — the ladder references format conventions.
- 081KR2E4K0008QG0R002FRQZN4 (load-bearing classifier) — "load-bearing" is the
  promotion criterion.
- 081KR2E4K0008QG0R00175HQR9 (retire discipline) — demotion is the inverse of
  retirement.

## Why P2

Meta-discipline that structures future work. The factory operates
without explicit graduation rules today (CLAUDE.md bullets are
added ad hoc). This codifies what's currently implicit.

## Output

A section added to `memory/README.md` or a standalone
`memory/project_graduation_ladder.md` file.

## Acceptance criteria

1. Graduation ladder documented.
2. Ladder covers all four transitions above.
3. At least 2 existing CLAUDE.md bullets identified as candidates
   for demotion (mechanized into tools) as a smoke check.

## Prior art

- CLAUDE.md "wake-time substrate or it didn't land" bullet —
  describes the promotion criterion implicitly.
- `memory/feedback_claude_code_loading_taxonomy_rules_vs_skills_vs_claude_md_aaron_2026_05_01.md`
  — loading taxonomy that informs promotion decisions.
