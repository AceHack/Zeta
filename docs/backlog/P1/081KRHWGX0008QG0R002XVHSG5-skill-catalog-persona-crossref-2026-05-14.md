---
id: 081KRHWGX0008QG0R002XVHSG5
priority: P1
status: open
title: "081KRFA460008QG0R002M05EY1.9 — Skill catalog × persona cross-reference"
type: planning
origin: 081KRFA460008QG0R002M05EY1 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R002M05EY1
depends_on:
  - 081KRHWGX0008QG0R000WGP5AQ
composes_with:
  - 081KRFA460008QG0R002M05EY1
  - 081KRHWGX0008QG0R00019453T
  - 081KRHWGX0008QG0R000WGP5AQ
---

# 081KRHWGX0008QG0R002XVHSG5 — Skill catalog × persona cross-reference

## Purpose

Per PR #2933 (Zeta ships with skills — immediate value), skills are authored for
**specific personas' use cases**. Without a skill × persona cross-reference,
skill authoring is untargeted and may serve the wrong audiences.

This row produces the cross-reference linking each existing `.claude/skills/`
entry to the persona(s) it serves, and identifies skill gaps (personas with no
matching skill yet).

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] 081KRHWGX0008QG0R000WGP5AQ must be closed (cross-product persona reuse + refused registry must
      exist before we can cross-reference against the full persona space)
- [ ] Read PR #2933 (ships-with-skills discipline) for context
- [ ] Enumerate all skills via `.claude/skills/` skill-router listing
- [ ] Walk `composes_with:` chain

## Cross-reference analysis

For each skill in the skill catalog:

1. **Primary persona served** — which persona in the factory's persona space does
   this skill primarily serve?
2. **Product context** — which product(s) is this skill relevant to?
3. **Gap signal** — does this skill target a refused persona? (flag)

And the inverse: for each persona in the cross-product reuse map (081KRHWGX0008QG0R000WGP5AQ):

1. **Skills available** — which existing skills already serve this persona?
2. **Skills needed** — what obvious skill gaps exist for this persona?

## Output format

A cross-reference table document:

```
docs/personas/skill-persona-crossref.md
```

With two tables:

**Table A — Skill → Persona**:

| Skill | Primary persona(s) | Product context | Gap or refused signal |
|-------|---------------------|-----------------|----------------------|
| ... | ... | ... | ... |

**Table B — Persona → Skill**:

| Persona | Available skills | Needed skills (gaps) |
|---------|-----------------|----------------------|
| ... | ... | ... |

Gap rows in Table B become candidates for new B-NNNN skill-authoring backlog items.

## Definition of done

- [ ] 081KRHWGX0008QG0R000WGP5AQ closed (prerequisite met)
- [ ] All skills in `.claude/skills/` enumerated in Table A
- [ ] All primary personas from 081KRHWGX0008QG0R00273520P..081KRHWGX0008QG0R00211YQJ6 represented in Table B
- [ ] At least one "needed skills" gap identified per product
- [ ] Gap rows noted as candidate backlog items (but NOT decomposed in this row —
      that's a future pass)
- [ ] Output doc committed at canonical path
- [ ] 081KRHWGX0008QG0R002XVHSG5 status set to `closed` with PR link

## Why P1

This is the 081KRFA460008QG0R002M05EY1 definition-of-done requirement: *"Skill catalog
cross-referenced to persona-served (per PR #2933 ships-with-skills layer)."*
Cannot be done before 081KRHWGX0008QG0R000WGP5AQ (need full persona space). Closes out 081KRFA460008QG0R002M05EY1.

## What this row does NOT do

- Does NOT author new skills — only identifies gaps as future candidates
- Does NOT require all gaps to be filed as backlog rows immediately
- Does NOT retroactively change existing skill SKILL.md files
