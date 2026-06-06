---
id: B-0490
zetaid: 081KRHWGX0008QG0R003DJ092R
priority: P1
status: open
title: "B-0429.6 — American Dream 2.0 + DIO persona map"
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
---

# B-0490 — American Dream 2.0 + DIO persona map

## Purpose

Produce the canonical persona map for two thin-substrate infrastructure/systemic
products:

- **American Dream 2.0** — systemic / socioeconomic substrate product
- **DIO (Distributed Intelligence Organism)** — distributed AI-organism substrate

Both have thin current substrate, making this primarily a forward-looking persona
definition pass. Grouped because both serve systemic/infrastructure audiences
rather than individual end-users.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] Template from B-0485 is closed and available
- [ ] Search `docs/` and `memory/` for any American Dream 2.0 substrate
- [ ] Search `docs/` and `memory/` for any DIO substrate
- [ ] Check VISION.md for any product-charter language for these products
- [ ] Walk `composes_with:` chain
- [ ] HARD LIMITS check for systemic products (covert influence, mass surveillance)

## American Dream 2.0 — persona hypotheses

| Persona type | Candidate | Source hint |
|---|---|---|
| Primary | Civic entrepreneur / community builder | "American Dream" framing |
| Primary | Policy analyst studying systemic opportunity | systemic product charter |
| Secondary | Community organiser / grassroots operator | distributed-substrate framing |
| Adjacent | Academic researcher on economic mobility | systemic scope |
| Refused | Predatory lender / rent-extraction actor | methodology-hard-limits |

## DIO — persona hypotheses

| Persona type | Candidate | Source hint |
|---|---|---|
| Primary | AI systems researcher / distributed-AI builder | DIO product charter |
| Primary | Edge-runner agent operator (Aaron archetype) | factory-agent roster |
| Secondary | Enterprise deploying distributed intelligence | DIO substrate |
| Adjacent | AI safety researcher observing DIO behavior | alignment focus |
| Refused | Adversarial AI controller (weaponising DIO) | methodology-hard-limits |

## Output

Per-product persona maps using template from B-0485 — one section per product
in a combined file:

```
docs/personas/american-dream-2-dio-personas.md
```

## Definition of done

- [ ] Template from B-0485 applied to both products
- [ ] At least 2 primary personas per product documented
- [ ] At least 1 refused persona per product with HARD LIMITS rationale
- [ ] Output doc committed at canonical path
- [ ] B-0492 `composes_with:` pointer backfilled
- [ ] B-0490 status set to `closed` with PR link

## Why grouped

Both AD 2.0 and DIO have thin substrate — grouping them keeps the per-product
work bounded. If either grows substantially in substrate maturity, split into
separate rows at that point.
