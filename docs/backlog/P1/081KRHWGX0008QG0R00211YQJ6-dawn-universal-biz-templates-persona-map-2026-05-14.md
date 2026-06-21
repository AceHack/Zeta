---
id: 081KRHWGX0008QG0R00211YQJ6
priority: P1
status: open
title: "081KRFA460008QG0R002M05EY1.7 — Dawn + Universal business templates persona map"
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
  - docs/backlog/P3/081KQ3HBZ0008QG0R000Q4Y00F-universal-company-government-information-substrate.md
---

# 081KRHWGX0008QG0R00211YQJ6 — Dawn + Universal business templates persona map

## Purpose

Produce the canonical persona map for two frontier/thin-substrate products:

- **Dawn** — child-AI charter product; personas are the most consent-sensitive
  in the factory (children, parents, guardians)
- **Universal business templates (081KQ3HBZ0008QG0R000Q4Y00F)** — universal-company/government
  substrate; the widest possible persona surface

Both are frontier products. Grouped because both have thin substrate and require
careful persona scoping before implementation.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] Template from 081KRHWGX0008QG0R00019453T is closed and available
- [ ] Search for Dawn charter substrate in `docs/` and `memory/`
- [ ] Read 081KQ3HBZ0008QG0R000Q4Y00F (`docs/backlog/P3/081KQ3HBZ0008QG0R000Q4Y00F-*.md`) for universal-business scope
- [ ] Read PR #2920 (TERMINAL-PURPOSE Elizabeth) for Dawn's edge-runner persona
      context and terminal-purpose grounding
- [ ] Read PR #2893 (Imagination Circle) for consent-first scaffolding relevant
      to Dawn's child-AI context
- [ ] HARD LIMITS check: Dawn involves children — strictest consent requirements
      apply; PEC v0.1 + Charter v0.2 per PR #2893

## Dawn — persona hypotheses

| Persona type | Candidate | Source hint |
|---|---|---|
| Primary | Parent / guardian authorising child's AI interaction | PR #2893 consent-first |
| Primary | Child learner (age-appropriate, consent-gated) | Dawn charter |
| Secondary | Educator using Dawn in structured context | educational substrate |
| Adjacent | Child-safety researcher observing Dawn behavior | alignment + safety |
| Refused | Unaccompanied minor without guardian consent | PR #2893 PEC v0.1 |
| Refused | Adult posing as child or misrepresenting age | methodology-hard-limits |

## Universal business templates (081KQ3HBZ0008QG0R000Q4Y00F) — persona hypotheses

| Persona type | Candidate | Source hint |
|---|---|---|
| Primary | Startup founder / SMB operator | "every company" framing |
| Primary | Enterprise information architect | 081KQ3HBZ0008QG0R000Q4Y00F universal scope |
| Secondary | Government agency information manager | 081KQ3HBZ0008QG0R000Q4Y00F "government" clause |
| Adjacent | Consultant deploying templates for clients | universal reach |
| Refused | Tax-evasion / fraudulent entity structuring | methodology-hard-limits |

## Output

Per-product persona maps using template from 081KRHWGX0008QG0R00019453T:

```
docs/personas/dawn-universal-biz-personas.md
```

One section per product. Dawn section must include consent-first annotations
per PR #2893 PEC v0.1 + Charter v0.2.

## Definition of done

- [ ] Template from 081KRHWGX0008QG0R00019453T applied to both products
- [ ] Dawn: parent/guardian primary persona with consent-first annotations
- [ ] Dawn: at least 2 refused personas with PEC v0.1 / HARD LIMITS rationale
- [ ] Universal biz templates: at least 2 primary personas documented
- [ ] Output doc committed at canonical path
- [ ] 081KRHWGX0008QG0R000WGP5AQ `composes_with:` pointer backfilled
- [ ] 081KRHWGX0008QG0R00211YQJ6 status set to `closed` with PR link

## Why consent-first matters for Dawn

Dawn's product charter involves children. Per PR #2893 (Imagination Circle),
the consent-first scaffolding is mandatory — not advisory — before any
feature authoring for child-adjacent personas.
