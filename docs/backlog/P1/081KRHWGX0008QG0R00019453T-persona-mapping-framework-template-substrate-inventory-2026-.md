---
id: 081KRHWGX0008QG0R00019453T
priority: P1
status: closed
closed: 2026-05-14
closed_by: "docs/research/2026-05-14-persona-mapping-framework-b0485.md"
title: "081KRFA460008QG0R002M05EY1.1 — Persona-mapping framework: define per-persona template + audit existing persona substrate"
type: research
origin: 081KRFA460008QG0R002M05EY1 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R002M05EY1
depends_on: []
composes_with:
  - 081KRFA460008QG0R002M05EY1
  - 081KRHWGX0008QG0R00273520P
  - 081KRHWGX0008QG0R003WMBR3W
  - 081KRHWGX0008QG0R001HDK688
  - 081KRHWGX0008QG0R002N8XX6D
  - 081KRHWGX0008QG0R003DJ092R
  - 081KRHWGX0008QG0R00211YQJ6
  - 081KRHWGX0008QG0R000WGP5AQ
  - 081KRHWGX0008QG0R002XVHSG5
  - memory/user_aaron_kenji_naming_practice_this_factory_claude_instance_2026_04_22.md
  - memory/user_sister_elizabeth.md
---

# 081KRHWGX0008QG0R00019453T — Persona-mapping framework: template definition + substrate inventory

**Gate row for 081KRHWGX0008QG0R00273520P..081KRHWGX0008QG0R00211YQJ6.** No per-product persona-map work begins until
this row closes.

## Purpose

Define the canonical per-persona capture template and inventory all existing
persona substrate across the repo. This gives every subsequent product row
(081KRHWGX0008QG0R00273520P..081KRHWGX0008QG0R00211YQJ6) a consistent schema and avoids duplicating or contradicting
existing work.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [x] Survey `memory/user_*.md` files for existing persona substrate
- [x] Read Aurora pitch (PR #2924) for implicit persona enumeration
- [x] Read Imagination Circle substrate (PR #2893) for family-AI personas
- [x] Read Center-First Playbook (PR #2894) for Mom + family member personas
- [x] Read parenting-history substrate (PR #2900) for Aaron's kids personas
- [x] Walk `composes_with:` chain (081KRFA460008QG0R002M05EY1 → 081KRFA460008QG0R001H98EXJ → 081KRFA460008QG0R003JQ46J4)
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
markdown body scaffold that every product-persona doc (081KRHWGX0008QG0R00273520P..081KRHWGX0008QG0R00211YQJ6) will
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
4. Substrate-ready signal: "081KRHWGX0008QG0R00273520P..081KRHWGX0008QG0R00211YQJ6 can begin"

## Definition of done

- [x] Per-persona capture template defined and documented
- [x] All existing persona substrate inventoried (table complete)
- [x] Conflicts / stale references flagged
- [x] Output doc committed at canonical path
- [x] 081KRHWGX0008QG0R00273520P..081KRHWGX0008QG0R00211YQJ6 unblocked (no remaining template ambiguity)
- [x] 081KRHWGX0008QG0R00019453T status set to `closed` with PR link

## Why P1 / gate

All six per-product rows (081KRHWGX0008QG0R00273520P..081KRHWGX0008QG0R00211YQJ6) depend on a consistent template.
Without it, per-product docs will diverge in schema, making 081KRHWGX0008QG0R000WGP5AQ
(cross-product synthesis) expensive to merge.
