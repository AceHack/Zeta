---
id: B-0383
zetaid: 081KR50HA0008QG0R003Z3V6VP
priority: P3
status: open
title: Per-primitive formalizability assessment — capital-structure / Hayekian triangle as multi-stage stochastic production process (Austrian primitive #2)
tier: research-grade
effort: M
ask: decomposition of B-0023
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [B-0380, B-0381]
composes_with: [B-0023, B-0380, B-0381, B-0382, B-0384, B-0385, B-0386, B-0387]
parent: B-0023
tags: [aurora, economics, austrian-school, quant, mathematical-rigor, capital-structure, hayekian-triangle, production-theory]
type: research

---

# B-0383 — Formalizability assessment: capital-structure / Hayekian triangle → multi-stage stochastic production

## What

Assess whether the Austrian capital-structure primitive (Böhm-Bawerk's
period-of-production → Hayek's triangle diagram → Garrison's
time-structure-of-production) admits quant-grade mathematical
formalization as a multi-stage stochastic production process.
Produce a committed research note at
`docs/aurora/YYYY-MM-DD-primitive-capital-structure.md`.

## The Austrian primitive

The Hayekian triangle: the structure of production has multiple
time-ordered stages from raw materials to consumer goods. Longer
(more "roundabout") production processes yield higher output per
unit of labor but require more time. Capital-intensive production
is further from the consumer end; consumer goods production is
closest. Credit expansion (artificial lowering of interest rates)
induces *malinvestment* — elongation of the production structure
beyond what genuine time-preferences support — which must eventually
be corrected in a bust (ABCT; covered in B-0385 separately).

Key academic development: Garrison's *Time and Money* (2001)
provides the most developed diagrammatic treatment. Lewin's
*Capital in Disequilibrium* (1999) engages more formally.

## The quant-side analogs

Multi-stage production is structurally similar to several
well-developed quant frameworks:

- **Multi-period capital investment models** in corporate finance
  (real options theory; Myers 1977, Dixit & Pindyck 1994)
- **Production function with vintage capital** (Solow-Johansen
  putty-clay models; capital heterogeneity literature)
- **Input-output analysis** (Leontief matrices capture stage
  structure but in equilibrium, not disequilibrium)
- **Network-flow models** of supply chains with stochastic
  demand at each stage

## Research questions

1. Can the Hayekian triangle be formalized as a directed acyclic
   graph (DAG) of production stages with stochastic yields and
   time-indexed inputs? What are the natural state variables
   (stage completion, capital vintage, time-to-consumer)?

2. Does real-options theory (wait / invest / abandon) capture
   the Austrian logic of malinvestment-and-correction? Or does
   the Austrian claim require an explicitly disequilibrium
   framework (no equilibrium path exists; the bust is not
   an option exercise but a forced liquidation)?

3. What does the capital-structure formalization inherit from
   and contribute to the ABCT formalization (B-0385)? (They
   are tightly coupled; separating the structural claim from
   the cycle claim is part of the research question.)

4. Which aspects of Garrison's diagrammatic treatment survive
   the translation to SDE/SFE notation, and which are lost?

## Output artifact

`docs/aurora/YYYY-MM-DD-primitive-capital-structure.md` with:

- Statement of the Austrian primitive (with Böhm-Bawerk /
  Hayek / Garrison / Lewin variants)
- Best-candidate quant formalization
- Formalization type (per B-0380 vocabulary)
- Relationship to ABCT (B-0385) — what this primitive contributes
  vs. what ABCT adds on top
- Synthesis-gap remaining
- Verdict

## Focused check

```bash
ls docs/aurora/ | grep capital-structure
```

## Acceptance signal

- Research note committed under `docs/aurora/`
- Hayek / Garrison / Lewin variants distinguished
- Quant analogs evaluated (real options, DAG models, I-O)
- Relationship to B-0385 (ABCT) explicitly scoped
- Verdict explicit per B-0380 vocabulary

## Pre-start checklist

- [x] Prior-art search: B-0381 survey provides prior-work context;
  no existing `docs/aurora/` note on capital-structure formalization.
- [x] Dependency-restructure: parallelizable with B-0382, B-0384,
  B-0385, B-0386 after B-0380 and B-0381 complete.

## Composes with

- B-0023 (parent): implements primitive #2
- B-0380, B-0381 (deps): vocabulary and prior-work context
- B-0385 (sibling, strong coupling): ABCT assessment; this row
  scopes the *structure* claim; B-0385 scopes the *cycle dynamics*
  claim that depends on it
- B-0387 (downstream): verdict feeds synthesis ADR
