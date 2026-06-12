---
id: B-0113.3
zetaid: 081KRA5AR0008QG0R0016B8371
priority: P2
status: open
title: Update CURRENT-*.md "How this file stays accurate" section + B-0113 parent to cite mechanical checker (B-0113.1+.2)
tier: factory-hygiene
effort: S
ask: Change the "vigilance" sentence in memory/CURRENT-aaron.md (and siblings) to "mechanical check B-0113.1/.2 enforces same-tick". Update parent B-0113 ask/description. No behavior change, only documentation substrate.
created: 2026-05-11
last_updated: 2026-05-11
depends_on:
  - B-0113.1
  - B-0113.2
composes_with:
  - B-0113
  - memory/CURRENT-aaron.md
tags: [riven-2026-05-11, rule-update, substrate]
type: friction-reducer
---

# B-0113.3 — Rule substrate update for mechanical enforcement

## Why

The original rule in CURRENT-*.md still says "agent memory of whether the rule fired". After mechanism lands, the doc must reflect reality (Otto-363 substrate-or-it-didn't-happen). This is the final atomic slice.

## Acceptance

- Edit only the "How this file stays accurate" paragraph in each CURRENT-*.md
- Add cross-ref to B-0113.1/.2
- Parent B-0113 updated with "decomposed into .1-.3; mechanism now enforced"
- No new rules, only correction of outdated prose
