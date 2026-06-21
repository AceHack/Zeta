---
id: 081KRHWGX0008QG0R003WMBR3W
priority: P1
status: open
title: "081KRFA460008QG0R002M05EY1.3 — Aurora persona map"
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

# 081KRHWGX0008QG0R003WMBR3W — Aurora persona map

## Purpose

Produce the canonical persona map for **Aurora** — the data-sovereignty /
edge-intelligence product. The Aurora pitch deck (PR #2924) already enumerates
implicit personas (BTC ecosystem participants, edge operators, ombud, liaison);
this row formalises them using the 081KRHWGX0008QG0R00019453T template.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] Template from 081KRHWGX0008QG0R00019453T is closed and available
- [ ] Read PR #2924 (Aurora pitch deck) — slides enumerate implied personas
- [ ] Cross-check against PR #2825 (Aurora data sovereignty substrate)
- [ ] Walk `composes_with:` chain
- [ ] HARD LIMITS check: Aurora Slide 9 explicitly lists refused personas
      (covert influence operators, coercive data-capture actors)

## Persona hypotheses (from Aurora pitch PR #2924)

| Persona type | Candidate | Source hint |
|---|---|---|
| Primary | BTC ecosystem operator (node runner, custody manager) | Aurora pitch Slide |
| Primary | Edge computing operator (data-sovereignty node) | PR #2825 |
| Secondary | Ombud / liaison (trust-bridge between communities) | Aurora pitch |
| Secondary | Privacy-first enterprise IT decision-maker | PR #2825 |
| Adjacent | Regulator or compliance officer observing | Aurora pitch |
| Refused | Covert influence operator | Aurora Slide 9 + methodology-hard-limits |
| Refused | Coercive data-capture actor | Aurora Slide 9 + methodology-hard-limits |

## Output

Per-product persona map using template from 081KRHWGX0008QG0R00019453T:

```
docs/personas/aurora-personas.md
```

With:

- All implicit pitch-deck personas formalised using template schema
- Refused-persona entries with HARD LIMITS citation
- Aurora Slide 9 preserved verbatim in refused-persona entries

## Definition of done

- [ ] Template from 081KRHWGX0008QG0R00019453T applied
- [ ] All pitch-deck personas formalised (minimum 5 entries)
- [ ] Refused-persona entries include Aurora Slide 9 verbatim rationale
- [ ] Output doc committed at canonical path
- [ ] PR #2924 referenced as provenance in each entry
- [ ] 081KRHWGX0008QG0R000WGP5AQ `composes_with:` pointer backfilled
- [ ] 081KRHWGX0008QG0R003WMBR3W status set to `closed` with PR link

## Why P1

Aurora partnership pitches need persona clarity (cited in 081KRFA460008QG0R002M05EY1 why-now).
The pitch deck already has implicit personas; formalising them is low
research cost with high-value payoff (pitch + skill-authoring + refused-
personas registry all unblocked).
