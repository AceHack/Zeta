---
id: B-0486
priority: P1
status: closed
closed: 2026-05-14
closed_by: "docs/personas/civsim-personas.md"
title: "B-0429.2 — Civsim persona map"
type: planning
origin: B-0429 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0429
depends_on:
  - B-0485
composes_with:
  - B-0429
  - B-0485
  - B-0492
  - B-0493
  - docs/backlog/P1/B-0470-civsim-zeta-version-pin-bump-2026-05-14.md
---

# B-0486 — Civsim persona map

## Purpose

Produce the canonical persona map for **Civsim** — the factory's highest-substrate-maturity
product (PR #2903, #2906, B-0469 live). Civsim is first because existing substrate is
richest, yielding the most grounded initial persona inventory.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [x] Template from B-0485 is closed and available
- [x] Read PR #2903 (Civsim repo scaffold) for product description
- [x] Read PR #2906 (Civsim governance) for persona signals
- [x] Read B-0469 (civsim --apply live) for usage context
- [x] Walk `composes_with:` chain

## Persona hypotheses (to be validated)

| Persona type | Candidate | Source hint |
|---|---|---|
| Primary | Edge-runner developer building civic simulations | PR #2906 governance charter |
| Primary | Policy researcher / scenario modeler | civsim product charter |
| Secondary | Civic technologist integrating Civsim outputs | PR #2909 language escalation |
| Adjacent | Academic studying AI-assisted civic modeling | peer-review substrate |
| Refused | State-level covert influence operator | methodology-hard-limits |

## Output

Per-product persona map using template from B-0485:

```
docs/personas/civsim-personas.md
```

With:

- Primary / secondary / adjacent / refused persona entries (template schema)
- HARD LIMITS check for refused personas
- Substrate references for each persona (which PR/memory supports it)

## Definition of done

- [x] Template from B-0485 applied
- [x] At least 2 primary personas documented with full template fields
- [x] At least 1 refused persona documented with HARD LIMITS rationale
- [x] Output doc committed at canonical path
- [x] B-0492 `composes_with:` pointer backfilled (composition noted in doc)
- [x] B-0486 status set to `closed` with PR link

## Why P1

Civsim is the live product (B-0469 shipped). Persona clarity unblocks
skill authoring for Civsim (per PR #2933 ships-with-skills). Also provides
the first worked example of the template from B-0485.
