---
id: B-0487
zetaid: 081KRHWGX0008QG0R003WMBR3W
priority: P1
status: open
title: "B-0429.3 — Aurora persona map"
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

# B-0487 — Aurora persona map

## Purpose

Produce the canonical persona map for **Aurora** — the data-sovereignty /
edge-intelligence product. The Aurora pitch deck (PR #2924) already enumerates
implicit personas (BTC ecosystem participants, edge operators, ombud, liaison);
this row formalises them using the B-0485 template.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] Template from B-0485 is closed and available
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

Per-product persona map using template from B-0485:

```
docs/personas/aurora-personas.md
```

With:

- All implicit pitch-deck personas formalised using template schema
- Refused-persona entries with HARD LIMITS citation
- Aurora Slide 9 preserved verbatim in refused-persona entries

## Definition of done

- [ ] Template from B-0485 applied
- [ ] All pitch-deck personas formalised (minimum 5 entries)
- [ ] Refused-persona entries include Aurora Slide 9 verbatim rationale
- [ ] Output doc committed at canonical path
- [ ] PR #2924 referenced as provenance in each entry
- [ ] B-0492 `composes_with:` pointer backfilled
- [ ] B-0487 status set to `closed` with PR link

## Why P1

Aurora partnership pitches need persona clarity (cited in B-0429 why-now).
The pitch deck already has implicit personas; formalising them is low
research cost with high-value payoff (pitch + skill-authoring + refused-
personas registry all unblocked).
