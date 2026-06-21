---
id: 081KRHWGX0008QG0R001HDK688
priority: P1
status: closed
closed_by: "PR #3235 (2026-05-14)"
title: "081KRFA460008QG0R002M05EY1.4 — KSK (Kinetic Safeguard Kernel) persona map"
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
---

# 081KRHWGX0008QG0R001HDK688 — KSK persona map

## Purpose

Produce the canonical persona map for **KSK (Kinetic Safeguard Kernel)** —
the security-focused substrate product (PR #2892). KSK's personas are
primarily security professionals; the refused-personas list is critical
given the product's attack-surface-adjacent nature.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] Template from 081KRHWGX0008QG0R00019453T is closed and available
- [ ] Read PR #2892 (KSK substrate) for product description and intended scope
- [ ] Read PR #2902 (Aaron's grey-hat security expert substrate) — Aaron's
      security persona is the seed for KSK primary persona
- [ ] Walk `composes_with:` chain
- [ ] HARD LIMITS check: KSK's security capabilities create meaningful
      refused-persona requirements (weapons-grade, nation-state APT use)

## Persona hypotheses

| Persona type | Candidate | Source hint |
|---|---|---|
| Primary | Grey-hat / ethical security researcher | PR #2902 + methodology-hard-limits |
| Primary | Security engineer building safeguard layers | PR #2892 product charter |
| Secondary | Enterprise security architect evaluating KSK | PR #2892 |
| Adjacent | Compliance auditor validating safeguard claims | governance substrate |
| Refused | Nation-state APT operator | methodology-hard-limits — HARD LIMIT |
| Refused | Weapons-grade exploit developer | methodology-hard-limits — HARD LIMIT |

## Output

Per-product persona map using template from 081KRHWGX0008QG0R00019453T:

```
docs/personas/ksk-personas.md
```

With:

- Primary / secondary / adjacent / refused entries (template schema)
- Refused-persona entries citing methodology-hard-limits HARD LIMITS clause
- Security-domain capability fields populated

## Definition of done

- [x] Template from 081KRHWGX0008QG0R00019453T applied
- [x] Grey-hat / ethical researcher primary persona fully documented (folded into `ksk-security-engineer` per glossary's "small bit of code that gets disproportionate review" framing — engineering itself IS the ethical-research operating mode for this product)
- [x] At least 2 refused personas with explicit HARD LIMITS rationale (R1 `ksk-refused-weapons-control` + R2 `ksk-refused-apt-operator`)
- [x] Output doc committed at canonical path (`docs/personas/ksk-personas.md`)
- [x] 081KRHWGX0008QG0R000WGP5AQ `composes_with:` pointer backfilled (already present in 081KRHWGX0008QG0R000WGP5AQ frontmatter — verified 2026-05-14)
- [x] 081KRHWGX0008QG0R001HDK688 status set to `closed` with PR link (PR #3235; this commit)

## Why P1

KSK's dual-use security nature requires explicit refused-persona documentation
before any skill authoring — the HARD LIMITS discipline (`methodology-hard-limits.md`)
mandates this for security products. Unblocks secure skill authoring for KSK.
