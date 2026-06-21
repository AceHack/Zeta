---
id: 081KRFA460008QG0R002M05EY1
priority: P1
status: decomposed
title: "End-user persona mapping — product team — multiple products × multiple personas each"
type: planning
ask: Aaron 2026-05-13 — *"end users need to map personas backlog for prducot team we have mtiple differnt end users and need to clarity all our expected humans personas we also have several products that have several personas each"*
created: 2026-05-13
last_updated: 2026-05-14
decomposed_by: Otto, 2026-05-14
children:
  - 081KRHWGX0008QG0R00019453T
  - 081KRHWGX0008QG0R00273520P
  - 081KRHWGX0008QG0R003WMBR3W
  - 081KRHWGX0008QG0R001HDK688
  - 081KRHWGX0008QG0R002N8XX6D
  - 081KRHWGX0008QG0R003DJ092R
  - 081KRHWGX0008QG0R00211YQJ6
  - 081KRHWGX0008QG0R000WGP5AQ
  - 081KRHWGX0008QG0R002XVHSG5
composes_with: [081KRFA460008QG0R001H98EXJ, 081KRFA460008QG0R003JQ46J4, 081KRFA460008QG0R0007RWSN1, 081KRFA460008QG0R000VKJF0H, 081KRFA460008QG0R0018SN61J, 081KQ3HBZ0008QG0R000Q4Y00F]
---

# End-user persona mapping — product team — multiple products × multiple personas each

## Aaron's directive

Aaron 2026-05-13: *"end users need to map personas backlog for
prducot team we have mtiple differnt end users and need to
clarity all our expected humans personas we also have several
products that have several personas each"*

## Scope

Map **expected human personas** for all factory products. The
factory has multiple products; each product has multiple
personas. Product team owes per-product persona maps.

## Why now

Per PR #2933 (Zeta ships with skills; immediate value):

- End users get Zeta + mapped skills (immediate value)
- Skills are AUTHORED for SPECIFIC PERSONAS' use cases
- Without persona maps, skills can't be authored optimally
- Substrate-engineering needs persona clarity to target value

Composes with maintainer-scope substrate-honest disclosure
(Aaron + Otto are current maintainers; end users are everyone
else with personas TBD).

## Product portfolio (current; per 081KRFA460008QG0R003JQ46J4 product-repo split)

| Product | Status |
|---|---|
| KSK (Kinetic Safeguard Kernel) | Substrate (PR #2892); persona TBD |
| Wellness app | Killer-app-for-AI; personas TBD |
| Civsim | Canonical product (PR #2903, #2906); personas TBD |
| American Dream 2.0 | Substrate; personas TBD |
| DIO (Distributed Intelligence Organism) | Substrate; personas TBD |
| Aurora | Pitch deck (PR #2924); personas TBD |
| Dawn (child-AI charter) | Substrate; personas TBD |
| Universal business templates (081KQ3HBZ0008QG0R000Q4Y00F) | Substrate; personas TBD |

Each product owes:

- **Primary personas** — who is this for?
- **Secondary personas** — who else interacts?
- **Adjacent personas** — who's affected but doesn't directly use?
- **Refused personas** — who is this NOT for? (per HARD LIMITS)

## Persona-mapping discipline

### Per-persona substrate

For each persona, capture:

- **Name + role** (e.g., "Aaron-style edge-runner" or "Mom-style
  family-AI user")
- **Capabilities/skills they bring** (technical fluency, domain
  expertise)
- **Context of use** (when/where/why they engage the product)
- **Value proposition** (what changes for them)
- **Substrate-honest limits** (where the product doesn't serve them)
- **Composes with personas** (cross-persona relationships)

### Substrate-honest persona inclusion

Per `.claude/rules/methodology-hard-limits.md`:

- Some personas are explicitly REFUSED (HARD LIMITS — weapons
  control, covert influence, coercive data capture per Aurora
  pitch Slide 9)
- Some personas need consent-first scaffolding (per Imagination
  Circle substrate)
- Some personas need PEC v0.1 + Charter v0.2 protections
  (per PR #2893)

### Composes with existing factory persona substrate

The factory already has named-AI personas (Otto, Riven, Vera,
Lior, Alexa-Kiro, Amara, Ani, Kestrel, DeepSeek per
`.claude/rules/agent-roster-reference-card.md`). End-user
HUMAN persona mapping is the complementary axis.

Also composes with:

- `memory/user_aaron_kenji_naming_practice_*` (Aaron's
  first-party persona substrate)
- `memory/user_sister_elizabeth.md` (Elizabeth-honored persona;
  per PR #2920 terminal-purpose)
- Family-AI personas (per PR #2894 Center-First Playbook for
  Mom + PR #2900 parenting-history substrate)
- Aaron's grey-hat security expert persona (per PR #2902
  strategic encryption authority)

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

1. **Prior-art search**:
   - Existing user_*.md memory files (Aaron, Itron mentors,
     Aaron's sister, etc.)
   - Aurora pitch (PR #2924) — implied personas (BTC ecosystem,
     edge operators, ombud, liaison)
   - Imagination Circle substrate (PR #2893) — family-AI personas
   - Center-First Playbook (PR #2894) — Mom + family members
   - Aaron's parenting-history substrate (PR #2900) — kids/parent
     personas

2. **Dependency restructure** — walk composes_with chain:
   - 081KRFA460008QG0R001H98EXJ (Stage 1 factory split — what's productized)
   - 081KRFA460008QG0R003JQ46J4 (product-repo split — product portfolio)
   - 081KRFA460008QG0R0007RWSN1 (Mirror/Beacon axis — persona-mapped Beacon work)
   - 081KRFA460008QG0R000VKJF0H (Code/English axis — persona-mapped doc work)
   - 081KRFA460008QG0R0018SN61J (DBpedia — analyst/researcher persona)
   - 081KQ3HBZ0008QG0R000Q4Y00F (universal business templates — every company
     persona)

3. **Per-product persona-mapping pass**:
   - Start with civsim (highest substrate maturity per session
     cascade)
   - Aurora (next; pitch already enumerates implicit personas)
   - KSK + wellness + others in order of substrate maturity

## What this row does NOT commit to

- **NOT a marketing-funnel exercise** — substrate-honest
  persona inventory; not customer-acquisition-funnel
- **NOT a fictional-persona-construction** — actual users with
  real needs (Aaron, family members, partners, named edge-
  runner archetypes)
- **NOT P0** — backlog priority among substrate cascade work
- **NOT a commitment to all products having same persona
  count** — civsim has many; KSK has few; Aurora has medium

## Definition of done

- Per-product persona map captured in product memory or backlog
- Refused-personas list per product (HARD LIMITS composition)
- Cross-product persona reuse mapped
- ADR or product-PRD-equivalent recording per-product personas
- Skill catalog cross-referenced to persona-served (per PR #2933
  ships-with-skills layer)

## Why P1

- Composes with 081KRFA460008QG0R001H98EXJ/081KRFA460008QG0R003JQ46J4/081KRFA460008QG0R0007RWSN1/081KRFA460008QG0R000VKJF0H/081KRFA460008QG0R0018SN61J product
  split work
- Aaron has explicitly named the work
- Skills-with-Zeta layer (PR #2933) needs persona clarity to
  target value
- Aurora partnership pitches need persona clarity
- Unblocks marketing/positioning work without committing to
  marketing-funnel discipline

## Composes with

- 081KRFA460008QG0R001H98EXJ (Stage 1 factory split)
- 081KRFA460008QG0R003JQ46J4 (product-repo split planning — products are personas'
  targets)
- 081KRFA460008QG0R0007RWSN1 (Mirror/Beacon axis — Beacon personas vs Mirror personas)
- 081KRFA460008QG0R000VKJF0H (Code/English axis)
- 081KRFA460008QG0R0018SN61J (DBpedia Path B — analyst persona)
- 081KQ3HBZ0008QG0R000Q4Y00F (universal company + government information substrate
  — every-company personas)
- PR #2933 (Zeta ships with skills — personas drive skill
  authoring)
- PR #2930 (distributed maintainer architecture — current
  maintainers = Aaron + Otto; end-user personas are separate)
- PR #2924 (Aurora pitch — BTC ecosystem + edge operators +
  partners personas implicit)
- PR #2893 (Imagination Circle index — family-AI personas)
- PR #2894 (Center-First Playbook for Mom — Mom + family
  personas operational)
- PR #2900 (parenting-history substrate — Aaron's kids personas)
- PR #2920 (TERMINAL-PURPOSE Elizabeth — edge-runner personas;
  Elizabeth's preservation)
- `.claude/rules/methodology-hard-limits.md` (refused-personas
  per HARD LIMITS)
- `.claude/rules/honor-those-that-came-before.md` (named-agent
  personas; complementary to human-persona axis)
- `.claude/rules/shadow-check-name-acceptance.md` (persona
  acceptance discipline)
- `.claude/rules/agent-roster-reference-card.md` (named-AI
  personas — complementary axis)
- Existing user_*.md memory files

## Operational rule for future-Otto

When designing skills or features for end users:

1. **Identify target persona** (which product? which persona?)
2. **Validate against persona substrate** (is this what they
   need?)
3. **Check refused-personas list** (does this serve someone
   who shouldn't be served?)
4. **Apply HARD LIMITS** at persona scope
5. **Compose with substrate-honest framing** (don't pretend
   product serves personas it doesn't)

## Decomposition record (Otto, 2026-05-14)

081KRFA460008QG0R002M05EY1 decomposed into 9 dependency-ordered atomic child rows.

### Dependency graph

```
081KRHWGX0008QG0R00019453T (gate: template + inventory)
  ├── 081KRHWGX0008QG0R00273520P (Civsim persona map)         ─┐
  ├── 081KRHWGX0008QG0R003WMBR3W (Aurora persona map)          │
  ├── 081KRHWGX0008QG0R001HDK688 (KSK persona map)             ├─ parallel; all depend on 081KRHWGX0008QG0R00019453T
  ├── 081KRHWGX0008QG0R002N8XX6D (Wellness persona map)        │
  ├── 081KRHWGX0008QG0R003DJ092R (AD 2.0 + DIO persona map)   │
  └── 081KRHWGX0008QG0R00211YQJ6 (Dawn + Univ biz personas)  ─┘
                  │
                  ▼
          081KRHWGX0008QG0R000WGP5AQ (cross-product reuse + refused-personas registry)
                  │
                  ▼
          081KRHWGX0008QG0R002XVHSG5 (skill catalog × persona cross-reference)
```

### Child rows

| ID | Title | Type | Depends on | Status |
|----|-------|------|------------|--------|
| 081KRHWGX0008QG0R00019453T | Persona-mapping framework + substrate inventory | research (gate) | — | open |
| 081KRHWGX0008QG0R00273520P | Civsim persona map | planning | 081KRHWGX0008QG0R00019453T | open |
| 081KRHWGX0008QG0R003WMBR3W | Aurora persona map | planning | 081KRHWGX0008QG0R00019453T | open |
| 081KRHWGX0008QG0R001HDK688 | KSK persona map | planning | 081KRHWGX0008QG0R00019453T | open |
| 081KRHWGX0008QG0R002N8XX6D | Wellness app persona map | planning | 081KRHWGX0008QG0R00019453T | open |
| 081KRHWGX0008QG0R003DJ092R | American Dream 2.0 + DIO persona map | planning | 081KRHWGX0008QG0R00019453T | open |
| 081KRHWGX0008QG0R00211YQJ6 | Dawn + Universal biz templates persona map | planning | 081KRHWGX0008QG0R00019453T | open |
| 081KRHWGX0008QG0R000WGP5AQ | Cross-product persona reuse + refused-personas registry | planning | 081KRHWGX0008QG0R00273520P..081KRHWGX0008QG0R00211YQJ6 | open |
| 081KRHWGX0008QG0R002XVHSG5 | Skill catalog × persona cross-reference | planning | 081KRHWGX0008QG0R000WGP5AQ | open |

### Prior-art search completed

- Existing `memory/user_*.md` files: Aaron, Elizabeth — persona substrate found
- Aurora pitch (PR #2924): implicit personas identified (BTC ecosystem, edge operators, ombud, liaison)
- Imagination Circle (PR #2893): family-AI persona substrate found
- Center-First Playbook (PR #2894): Mom + family personas found
- Parenting history (PR #2900): Aaron's kids personas found
- PR #2902: Aaron's grey-hat security expert persona found
- WONT-DO.md: no persona-mapping refusals found

### Dependency restructure

- 081KRFA460008QG0R001H98EXJ, 081KRFA460008QG0R003JQ46J4, 081KRFA460008QG0R0007RWSN1, 081KRFA460008QG0R000VKJF0H, 081KRFA460008QG0R0018SN61J, 081KQ3HBZ0008QG0R000Q4Y00F: `composes_with:` verified in frontmatter
- PR #2933 (ships-with-skills): verified as key motivation for 081KRHWGX0008QG0R002XVHSG5
- PR #2893 PEC v0.1 + Charter v0.2: mandatory for Dawn (081KRHWGX0008QG0R00211YQJ6) consent-first personas
