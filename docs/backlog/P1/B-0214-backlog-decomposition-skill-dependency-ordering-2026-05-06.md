---
id: B-0214
zetaid: 081KQX9B50008QG0R0007VGSBG
priority: P1
status: closed
title: "Backlog decomposition skill — break architectural directions into dependency-ordered items"
created: 2026-05-06
last_updated: 2026-05-06
decomposition: atomic
depends_on: []
---

# B-0214 — Backlog decomposition skill

## Closure evidence

The reusable skill is implemented at
`.claude/skills/backlog-decomposer/SKILL.md`.

Validation substrate:

- PR #1732 decomposed B-0003 into dependency-ordered child
  rows B-0215..B-0223.
- PR #1733 decomposed B-0147 into dependency-ordered child
  rows B-0224..B-0231.
- Both passes regenerated `docs/BACKLOG.md` and passed the
  backlog graph audit with zero broken `depends_on` and
  `composes_with` edges.

A reusable skill for taking a large architectural direction
(like "fractal BFT" or "shadow listening") and decomposing it
into concrete backlog items with proper `depends_on:` chains,
classifying what can be built now vs what has prerequisites.

## What the skill does

1. Takes an architectural concept or session output as input
2. Identifies the concrete deliverables within it
3. Maps dependencies between deliverables
4. Creates backlog items (B-NNNN) with frontmatter including
   `depends_on:` pointing to prerequisites
5. Classifies each item: buildable-now / blocked-on-X / research-needed
6. Regenerates BACKLOG.md index

## Distinct from

- `backlog-scrum-master` — grooms/prioritizes existing items;
  this skill CREATES items from architectural directions
- `next-steps` — recommends what to work on; this skill
  decomposes what exists into workable units
- `skill-creator` — creates skills; this creates backlog items

## Acceptance criteria

1. SKILL.md authored via skill-creator workflow
2. Can decompose a session's architectural output into 5+ items
   with correct dependency ordering in under 10 minutes
3. Generated items pass the backlog schema validation
