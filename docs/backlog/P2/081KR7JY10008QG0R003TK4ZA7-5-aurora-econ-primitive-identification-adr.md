---
id: 081KR7JY10008QG0R003TK4ZA7
priority: P2
status: open
title: "081KR7JY10008QG0R003TK4ZA7 — Aurora-specific econ-primitive identification + ADR (investigate-don't-accept final synthesis, Otto-322/331)"
created: 2026-05-10
last_updated: 2026-05-10
depends_on: [081KR7JY10008QG0R0032QYPW5]
parent: 081KQ0YZ80008QG0R0026WN385
classification: buildable-after-081KR7JY10008QG0R0032QYPW5
type: research
effort: M
tags: [aurora, economics, austrian-school, adr, econ-primitives, anti-deception, otto-322, otto-331, world-modeling]
---

# 081KR7JY10008QG0R003TK4ZA7 — Aurora econ-primitive identification + ADR (final synthesis)

**Slice of:** [081KQ0YZ80008QG0R0026WN385](../P2/081KQ0YZ80008QG0R0026WN385-aurora-austrian-school-economic-foundation-rigorous-why-teaching-anti-deception.md)  
**Depends on:** 081KR7JY10008QG0R0032QYPW5 (cross-school definitional bridge — ADR cannot be written honestly without the full comparison)

## What

Two deliverables:

### A. Aurora econ-primitive identification

Identify the specific Aurora subsystems that require an econ-foundation (per 081KQ0YZ80008QG0R0026WN385: "not all of Aurora; specific subsystems"). For each subsystem, state:

- What econ primitives it needs (money definition? interest theory? capital-structure? value theory?).
- What the downstream effect is if this primitive is built on an opaque framework (the anti-deception audit for that subsystem).
- Which school(s) from 081KR7JY10008QG0R0032QYPW5 provides the most honest primitive for that subsystem.

Aurora subsystems in scope (from 081KQ0YZ80008QG0R0026WN385 `composes_with`):

- **Otto-336/337 entity-rights substrate**: economic-incentive structure for growth + true agency with rights — needs value theory + time-preference.
- **Otto-338 SX self-recursive substrate**: choice of econ-foundation is itself SX-affecting (downstream agents reason from it) — needs the whole foundation, not just one primitive.
- **Otto-329 Phase 4+ research substrate**: Aurora world-modeling — needs sufficient economic-modeling primitives to simulate / evaluate policy interventions.

### B. ADR (Architectural Decision Record)

Land `docs/aurora/<DATE>-economic-foundation-decision.md` with:

- **Context**: Aurora world-modeling; why econ-foundation matters; deception-prevention requirement.
- **Investigated options**: Austrian-school (primary candidate), Post-Keynesian (Minsky/Godley), Public-choice (Buchanan/Tullock), Complexity-economics (Santa Fe / Arthur). Summary of 081KR7JY10008QG0R001SG89MX–081KR7JY10008QG0R0032QYPW5 findings.
- **Decision**: recommended primary framework + complementary cross-checks for anti-deception coverage (per 081KQ0YZ80008QG0R0026WN385: "Austrian + complementary frameworks for cross-checking" is the expected shape; the investigation may confirm or revise this).
- **Falsification criteria**: what observations would change the choice (honest commitment to revisability; per Otto-322/331 investigate-don't-accept).
- **Rejected options with reasons** (using the honest-investigation findings from 081KR7JY10008QG0R001SG89MX–081KR7JY10008QG0R0032QYPW5).
- **Composes-with mapping**: how the ADR connects to Aurora research docs, ABCT simulation primitives, entity-rights substrate.

## Why

This is the deliverable that makes 081KQ0YZ80008QG0R0026WN385's "Done when" condition true. The ADR records the honest investigation result and provides the falsification criteria that make the choice scientifically honest rather than doctrine-adoption. Per 081KQ0YZ80008QG0R0026WN385: "Does NOT pre-commit Aurora to Austrian-school. Aaron explicitly invited investigation." The ADR is the investigation-result — wherever the evidence leads.

Per Otto-322/331: the investigate-don't-accept discipline applies at the end as much as the beginning. The ADR must be revisable (falsification criteria section), not a permanent commitment.

## Acceptance criteria

1. `docs/aurora/econ/081KR7JY10008QG0R003TK4ZA7-aurora-econ-primitives.md` committed (subsystem identification).
2. `docs/aurora/YYYY-MM-DD-economic-foundation-decision.md` committed (ADR) — dated with actual completion date.
3. ADR covers all four sections: context, options, decision, falsification criteria.
4. ADR explicitly references 081KR7JY10008QG0R001SG89MX–081KR7JY10008QG0R0032QYPW5 as evidence inputs.
5. Aurora research-direction docs (if any exist under `docs/aurora/`) updated with a pointer to the ADR.
6. 081KQ0YZ80008QG0R0026WN385 parent row status updated: `status: closed` with `closed_by: [PR number]` and `children: [081KR7JY10008QG0R001SG89MX, 081KR7JY10008QG0R001RR02BP, 081KR7JY10008QG0R0038QNJP0, 081KR7JY10008QG0R0032QYPW5, 081KR7JY10008QG0R003TK4ZA7]`.
7. The ADR's recommended framework must be stated with falsification criteria — an ADR without falsification criteria fails the anti-deception test it's meant to prevent.
8. Build gate green, Rule 0 compliant.

## Out of scope

- Implementing any econ primitive as typed substrate code (post-ADR; depends on which framework wins and what Aurora's Phase 4+ build sequence requires).
- Committing to Austrian-school specifically — the investigation is open.

## Composes with

- **081KR7JY10008QG0R001SG89MX–081KR7JY10008QG0R0032QYPW5** — all four research children feed this synthesis.
- **Otto-329 Phase 4+** — Aurora work timing; this row activates with Aurora research phase.
- **Otto-322/331** — investigate-don't-accept culminates here: the ADR is the investigation result.
- **Otto-335** anti-deception at language layer — the ADR itself must satisfy the anti-deception requirement (falsification criteria = anti-opacity).
- **Otto-336/337, Otto-338** — entity-rights + SX substrates consume the primitive identification.
- **`docs/aurora/**`** — ADR lands in Aurora research substrate.
