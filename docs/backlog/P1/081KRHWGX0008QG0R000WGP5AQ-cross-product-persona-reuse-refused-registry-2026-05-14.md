---
id: 081KRHWGX0008QG0R000WGP5AQ
priority: P1
status: open
title: "081KRFA460008QG0R002M05EY1.8 — Cross-product persona reuse map + refused-personas registry"
type: planning
origin: 081KRFA460008QG0R002M05EY1 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R002M05EY1
depends_on:
  - 081KRHWGX0008QG0R00273520P
  - 081KRHWGX0008QG0R003WMBR3W
  - 081KRHWGX0008QG0R001HDK688
  - 081KRHWGX0008QG0R002N8XX6D
  - 081KRHWGX0008QG0R003DJ092R
  - 081KRHWGX0008QG0R00211YQJ6
composes_with:
  - 081KRFA460008QG0R002M05EY1
  - 081KRHWGX0008QG0R00019453T
  - 081KRHWGX0008QG0R00273520P
  - 081KRHWGX0008QG0R003WMBR3W
  - 081KRHWGX0008QG0R001HDK688
  - 081KRHWGX0008QG0R002N8XX6D
  - 081KRHWGX0008QG0R003DJ092R
  - 081KRHWGX0008QG0R00211YQJ6
  - 081KRHWGX0008QG0R002XVHSG5
---

# 081KRHWGX0008QG0R000WGP5AQ — Cross-product persona reuse map + refused-personas registry

## Purpose

After all six per-product persona maps (081KRHWGX0008QG0R00273520P..081KRHWGX0008QG0R00211YQJ6) are closed, synthesise:

1. **Cross-product persona reuse map** — which personas appear across multiple
   products? Which skills serve multiple personas? Where is there shared substrate?
2. **Factory-wide refused-personas registry** — consolidated list of all refused
   personas across all products, with HARD LIMITS citations.

This is the 081KRFA460008QG0R002M05EY1 definition-of-done requirement: *"Cross-product persona reuse
mapped"* and *"Refused-personas list per product"* (consolidated view).

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] All of 081KRHWGX0008QG0R00273520P..081KRHWGX0008QG0R00211YQJ6 must be closed before this begins
- [ ] Template from 081KRHWGX0008QG0R00019453T available for reference
- [ ] Walk all six per-product docs for shared persona patterns
- [ ] Walk all six per-product docs for refused-persona entries
- [ ] HARD LIMITS check: verify every refused-persona entry has explicit HARD
      LIMITS clause citation (not just "general concern")

## Cross-product persona reuse analysis

Candidate shared personas (to be verified against 081KRHWGX0008QG0R00273520P..081KRHWGX0008QG0R00211YQJ6 outputs):

| Persona | Products | Reuse signal |
|---------|----------|--------------|
| Aaron-archetype edge-runner | Civsim, DIO, KSK | Factory maintainer is first user of all products |
| Parent / primary caregiver | Wellness, Dawn | Same person in different contexts |
| Privacy-first operator | Aurora, KSK | Data-sovereignty + safeguard concerns overlap |
| Policy / civic researcher | Civsim, AD 2.0 | Systemic-outcomes audience |
| Enterprise IT architect | KSK, Universal biz | Security + templates both enterprise-facing |

## Refused-personas registry format

Each entry in the consolidated registry:

```markdown
### <persona handle>

- **Products**: <list>
- **HARD LIMITS clause**: <exact clause from methodology-hard-limits.md>
- **Why refused**: <one sentence>
- **Detection signal**: <how would you recognize this actor? — for future gating>
```

## Output

Two documents:

```
docs/personas/cross-product-persona-reuse.md
docs/personas/refused-personas-registry.md
```

The refused-personas registry is a **first-class factory surface** — referenced
by skill authoring gates and future access-control design.

## Definition of done

- [ ] All six per-product docs (081KRHWGX0008QG0R00273520P..081KRHWGX0008QG0R00211YQJ6) closed
- [ ] Cross-product reuse map: every persona appearing in ≥2 products documented
- [ ] Refused-personas registry: all refused personas from all products consolidated
- [ ] Every refused-persona entry has exact HARD LIMITS clause citation
- [ ] Both output docs committed at canonical paths
- [ ] 081KRHWGX0008QG0R002XVHSG5 `composes_with:` pointer backfilled
- [ ] 081KRHWGX0008QG0R000WGP5AQ status set to `closed` with PR link

## Why P1

The refused-personas registry is a safety surface — it prevents skill authors
from accidentally targeting refused personas. Can't be written before per-product
maps are done; should be written immediately after.
