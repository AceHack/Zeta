---
id: B-0489
zetaid: 081KRHWGX0008QG0R002N8XX6D
priority: P1
status: open
title: "B-0429.5 — Wellness app persona map"
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

# B-0489 — Wellness app persona map

## Purpose

Produce the canonical persona map for the **Wellness app** — described as
"killer-app-for-AI" in the factory's product portfolio. Thin substrate
currently; this row surfaces what personas the product is designed for.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] Template from B-0485 is closed and available
- [ ] Search `docs/` and `memory/` for any wellness-app substrate
- [ ] Read PR #2893 (Imagination Circle — family-AI) for family-health persona signals
- [ ] Read PR #2894 (Center-First Playbook) — "Mom" persona as primary health/wellness user
- [ ] Read PR #2900 (parenting history) — kids as adjacent wellness personas
- [ ] Walk `composes_with:` chain
- [ ] HARD LIMITS check: wellness contexts may involve health data, consent requirements
      (per PR #2893 consent-first scaffolding)

## Persona hypotheses

| Persona type | Candidate | Source hint |
|---|---|---|
| Primary | Mom / primary family caregiver | PR #2894 Center-First Playbook |
| Primary | Health-conscious individual (Aaron archetype) | Wellness-as-killer-app framing |
| Secondary | Family member (child, partner) as secondary user | PR #2893 Imagination Circle |
| Secondary | Healthcare practitioner adjacent (not primary) | wellness domain |
| Adjacent | Aaron as product builder / tester | maintainer persona |
| Refused | Data broker / health-data harvester | methodology-hard-limits |

## Output

Per-product persona map using template from B-0485:

```
docs/personas/wellness-personas.md
```

With:

- Family-AI personas from PR #2893 and PR #2894 formalised into template schema
- Consent-first annotations for any persona involving health data
- Refused-persona entries for data-harvesting actors

## Definition of done

- [ ] Template from B-0485 applied
- [ ] Mom / primary caregiver primary persona fully documented
- [ ] Consent-first annotations present on all health-data-adjacent personas
- [ ] Refused-persona (health data broker) entry with HARD LIMITS rationale
- [ ] Output doc committed at canonical path
- [ ] B-0492 `composes_with:` pointer backfilled
- [ ] B-0489 status set to `closed` with PR link

## Why P1

Wellness is the "killer-app-for-AI" — the product most likely to be the
first user-facing touchpoint. Getting the persona map right early means
skill authoring targets the right people from the start.
