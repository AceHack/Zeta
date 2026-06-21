---
id: 081KR7JY10008QG0R001SG89MX
priority: P3
status: open
title: "081KR7JY10008QG0R001SG89MX — Controlled-vocabulary extraction: rigorous-why / anti-deception / Keynesian-opacity requirements (Otto-286 definitional precision pass)"
created: 2026-05-10
last_updated: 2026-05-10
depends_on: []
parent: 081KQ0YZ80008QG0R0026WN385
classification: buildable-now
type: research
effort: S
tags: [aurora, economics, austrian-school, otto-286, definitional-precision, controlled-vocabulary]
---

# 081KR7JY10008QG0R001SG89MX — Controlled-vocabulary extraction (Otto-286 definitional precision pass)

**Slice of:** [081KQ0YZ80008QG0R0026WN385](../P2/081KQ0YZ80008QG0R0026WN385-aurora-austrian-school-economic-foundation-rigorous-why-teaching-anti-deception.md)

## What

Apply Otto-286 definitional precision to the three core requirements named in 081KQ0YZ80008QG0R0026WN385:

1. **"Rigorous-why"** — what counts as a *why* in economic reasoning? Distinguish: causal mechanism, logical derivation from axioms, historical causation, statistical correlation. For each candidate econ school, what kind of *why* does it offer?
2. **"Anti-deception requirement"** — operational definition: a framework is anti-deceptive if (a) its explanatory primitives are inspectable, (b) its policy claims are falsifiable under stated criteria, (c) it does not structurally require opacity to produce its conclusions.
3. **"Keynesian opacity → unquestioned policy-power"** — Aaron's claim precisely stated: what specific features of mainstream Keynesian methodology occlude the *why*? (Macro-aggregates as primary; money-neutrality assumption; multiplier mechanics treated as engineering not mechanism.)

Produce `docs/aurora/econ/081KR7JY10008QG0R001SG89MX-controlled-vocabulary.md` with:

- Precise definition for each of the three terms above.
- Test for each definition: *what observable feature of an econ framework determines whether it satisfies this definition?*
- Where the definition resolves contested language, note the resolved vs unresolved boundary.

## Why

Otto-286 precision is the gate for all downstream investigation. Without precise definitions of "rigorous-why" and "anti-deception," the strength/weakness survey (081KR7JY10008QG0R001RR02BP / 081KR7JY10008QG0R0038QNJP0) can't distinguish "Austrian framework correct" from "Austrian framework wins on the definitional battle, not the empirical one." Per the methodology note in 081KQ0YZ80008QG0R0026WN385: factory tools (definitional precision, Rodney's Razor, alignment anti-deception) applied to the contested field before consuming it.

## Acceptance criteria

1. `docs/aurora/econ/081KR7JY10008QG0R001SG89MX-controlled-vocabulary.md` committed with precise definitions for all three terms.
2. Each definition includes the observable-variable test (per CLAUDE.md razor-discipline: "what observable variable determines whether this claim is true?").
3. Definitions are narrow enough to be falsifiable and broad enough to distinguish the school-candidates.
4. No econ-school commitment made: this row only defines the evaluation criteria, not which school wins.
5. PR body includes focused check: build gate green, no new files outside `docs/aurora/econ/` and this row, no bash files (Rule 0).

## Out of scope

- Austrian strengths survey (081KR7JY10008QG0R001RR02BP).
- Weakness audit or falsification-criteria catalog (081KR7JY10008QG0R0038QNJP0).
- Cross-school comparison (081KR7JY10008QG0R0032QYPW5).
- ADR or framework recommendation (081KR7JY10008QG0R003TK4ZA7).

## Composes with

- **Otto-286** definitional precision — the mechanism this row operationalizes.
- **Otto-335** anti-deception at language layer — the "anti-deception" term is an Otto-335 instance at economic-modeling scope.
- **CLAUDE.md razor-discipline** — "what observable variable determines whether this claim is true?" is the Rodney's Razor test applied here.
- **081KR7JY10008QG0R001RR02BP, 081KR7JY10008QG0R0038QNJP0** — downstream rows consume these definitions.
