---
id: B-0485
priority: P1
status: closed
closed: 2026-05-14
closed_by: "docs/research/2026-05-14-persona-mapping-framework-b0485.md"
title: "B-0429.1 — Persona-mapping framework: define per-persona template + audit existing persona substrate"
type: research
origin: B-0429 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0429
depends_on: []
composes_with:
  - B-0429
  - B-0486
  - B-0487
  - B-0488
  - B-0489
  - B-0490
  - B-0491
  - B-0492
  - B-0493
  - memory/user_aaron_kenji_naming_practice_this_factory_claude_instance_2026_04_22.md
  - memory/user_sister_elizabeth.md
---

# B-0485 — Persona-mapping framework: template definition + substrate inventory

**Gate row for B-0486..B-0491.** No per-product persona-map work begins until
this row closes.

## Purpose

Define the canonical per-persona capture template and inventory all existing
persona substrate across the repo. This gives every subsequent product row
(B-0486..B-0491) a consistent schema and avoids duplicating or contradicting
existing work.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [x] Survey `memory/user_*.md` files for existing persona substrate
- [x] Read Aurora pitch (PR #2924) for implicit persona enumeration
- [x] Read Imagination Circle substrate (PR #2893) for family-AI personas
- [x] Read Center-First Playbook (PR #2894) for Mom + family member personas
- [x] Read parenting-history substrate (PR #2900) for Aaron's kids personas
- [x] Walk `composes_with:` chain (B-0429 → B-0424 → B-0425)
- [x] Otto-364: check WONT-DO.md for any refused persona-mapping work

## Existing persona substrate to inventory

| Source | Path | Persona(s) implied |
|--------|------|--------------------|
| Aaron user memory | `memory/user_aaron_kenji_naming_practice_*` | Aaron — edge-runner maintainer |
| Elizabeth memory | `memory/user_sister_elizabeth.md` | Elizabeth — terminal-purpose persona |
| Imagination Circle | PR #2893 substrate | Family AI: parents + children |
| Center-First Playbook | PR #2894 | Mom + family members |
| Parenting history | PR #2900 | Aaron's kids personas |
| Aurora pitch | PR #2924 | BTC ecosystem operators, edge operators, ombud, liaison |
| Agent roster | `.claude/rules/agent-roster-reference-card.md` | AI agents (complementary axis; NOT end-user) |
| Grey-hat security | PR #2902 | Security expert persona (Aaron) |

## Per-persona capture template (to be defined)

The output of this row is a canonical YAML-frontmatter template plus a short
markdown body scaffold that every product-persona doc (B-0486..B-0491) will
use. Minimum fields:

```yaml
persona_id: <product>-<slug>
product: <product name>
persona_type: primary | secondary | adjacent | refused
name: "<descriptive handle>"
role: "<1-sentence role description>"
```

Body sections:

- **Capabilities they bring** (technical fluency, domain expertise)
- **Context of use** (when / where / why they engage)
- **Value proposition** (what changes for them)
- **Substrate-honest limits** (where the product doesn't serve them)
- **HARD LIMITS check** (refused-persona signal per `.claude/rules/methodology-hard-limits.md`)
- **Composes with personas** (cross-persona references)

## Output

A research document at:

```
docs/research/2026-05-14-persona-mapping-framework-b0485.md
```

Containing:

1. Canonical per-persona template (YAML + markdown scaffold)
2. Inventory of all existing persona substrate found
3. Conflicts or gaps identified
4. Substrate-ready signal: "B-0486..B-0491 can begin"

## Definition of done

- [x] Per-persona capture template defined and documented
- [x] All existing persona substrate inventoried (table complete)
- [x] Conflicts / stale references flagged
- [x] Output doc committed at canonical path
- [x] B-0486..B-0491 unblocked (no remaining template ambiguity)
- [x] B-0485 status set to `closed` with PR link

## Why P1 / gate

All six per-product rows (B-0486..B-0491) depend on a consistent template.
Without it, per-product docs will diverge in schema, making B-0492
(cross-product synthesis) expensive to merge.
