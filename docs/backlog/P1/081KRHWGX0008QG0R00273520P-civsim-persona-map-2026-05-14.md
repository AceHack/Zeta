---
id: 081KRHWGX0008QG0R00273520P
priority: P1
status: closed
closed: 2026-05-14
closed_by: "docs/personas/civsim-personas.md"
title: "081KRFA460008QG0R002M05EY1.2 — Civsim persona map"
type: planning
origin: 081KRFA460008QG0R002M05EY1 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R002M05EY1
depends_on:
  - 081KRHWGX0008QG0R00019453T
composes_with:
  - 081KRFA460008QG0R002M05EY1
  - 081KRHWGX0008QG0R00019453T
  - 081KRHWGX0008QG0R000WGP5AQ
  - 081KRHWGX0008QG0R002XVHSG5
  - docs/backlog/P1/081KRHWGX0008QG0R002NJP2BH-civsim-zeta-version-pin-bump-2026-05-14.md
---

# 081KRHWGX0008QG0R00273520P — Civsim persona map

## Purpose

Produce the canonical persona map for **Civsim** — the factory's highest-substrate-maturity
product (PR #2903, #2906, 081KRHWGX0008QG0R003S6KGGE live). Civsim is first because existing substrate is
richest, yielding the most grounded initial persona inventory.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [x] Template from 081KRHWGX0008QG0R00019453T is closed and available
- [x] Read PR #2903 (Civsim repo scaffold) for product description
- [x] Read PR #2906 (Civsim governance) for persona signals
- [x] Read 081KRHWGX0008QG0R003S6KGGE (civsim --apply live) for usage context
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

Per-product persona map using template from 081KRHWGX0008QG0R00019453T:

```
docs/personas/civsim-personas.md
```

With:

- Primary / secondary / adjacent / refused persona entries (template schema)
- HARD LIMITS check for refused personas
- Substrate references for each persona (which PR/memory supports it)

## Definition of done

- [x] Template from 081KRHWGX0008QG0R00019453T applied
- [x] At least 2 primary personas documented with full template fields
- [x] At least 1 refused persona documented with HARD LIMITS rationale
- [x] Output doc committed at canonical path
- [x] 081KRHWGX0008QG0R000WGP5AQ `composes_with:` pointer backfilled (composition noted in doc)
- [x] 081KRHWGX0008QG0R00273520P status set to `closed` with PR link

## Why P1

Civsim is the live product (081KRHWGX0008QG0R003S6KGGE shipped). Persona clarity unblocks
skill authoring for Civsim (per PR #2933 ships-with-skills). Also provides
the first worked example of the template from 081KRHWGX0008QG0R00019453T.
