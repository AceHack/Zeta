---
id: 081KRA5AR0008QG0R0016B8371
priority: P2
status: open
title: Update CURRENT-*.md "How this file stays accurate" section + 081KQDTYV0008QG0R002424VSE parent to cite mechanical checker (081KRA5AR0008QG0R002A78X5F+.2)
tier: factory-hygiene
effort: S
ask: Change the "vigilance" sentence in memory/CURRENT-aaron.md (and siblings) to "mechanical check 081KRA5AR0008QG0R002A78X5F/.2 enforces same-tick". Update parent 081KQDTYV0008QG0R002424VSE ask/description. No behavior change, only documentation substrate.
created: 2026-05-11
last_updated: 2026-05-11
depends_on:
  - 081KRA5AR0008QG0R002A78X5F
  - 081KRA5AR0008QG0R0010A24JD
composes_with:
  - 081KQDTYV0008QG0R002424VSE
  - memory/CURRENT-aaron.md
tags: [riven-2026-05-11, rule-update, substrate]
type: friction-reducer
---

# 081KRA5AR0008QG0R0016B8371 — Rule substrate update for mechanical enforcement

## Why

The original rule in CURRENT-*.md still says "agent memory of whether the rule fired". After mechanism lands, the doc must reflect reality (Otto-363 substrate-or-it-didn't-happen). This is the final atomic slice.

## Acceptance

- Edit only the "How this file stays accurate" paragraph in each CURRENT-*.md
- Add cross-ref to 081KRA5AR0008QG0R002A78X5F/.2
- Parent 081KQDTYV0008QG0R002424VSE updated with "decomposed into .1-.3; mechanism now enforced"
- No new rules, only correction of outdated prose
