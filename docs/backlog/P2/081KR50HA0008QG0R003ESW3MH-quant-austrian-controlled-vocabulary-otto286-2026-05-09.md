---
id: 081KR50HA0008QG0R003ESW3MH
priority: P3
status: closed
title: Controlled-vocabulary pass — define "quant-grade rigor", "Austrian primitive", "formalization", "synthesis gap" (Otto-286 precision before any research begins)
tier: research-grade
effort: S
ask: decomposition of 081KQ0YZ80008QG0R003EJQZ1M
created: 2026-05-09
last_updated: 2026-05-10
resolved: 2026-05-10
resolved_by: "PR closes 081KR50HA0008QG0R003ESW3MH: docs/aurora/quant-austrian-vocabulary.md — four-term vocabulary with include/exclude/falsification-criterion per term"
depends_on: []
composes_with: [081KQ0YZ80008QG0R003EJQZ1M, 081KR50HA0008QG0R000M4H35K, 081KR50HA0008QG0R0016T4VMZ, 081KR50HA0008QG0R003Z3V6VP, 081KR50HA0008QG0R000467SWT, 081KR50HA0008QG0R00238MS98, 081KR50HA0008QG0R0027DHVPQ, 081KR50HA0008QG0R000M838VA]
parent: 081KQ0YZ80008QG0R003EJQZ1M
tags: [aurora, economics, austrian-school, quant, mathematical-rigor, otto-286, controlled-vocabulary]
type: research

---

# 081KR50HA0008QG0R003ESW3MH — Controlled-vocabulary pass for quant × Austrian synthesis

## What

Produce a committed glossary entry (or standalone doc) that defines
the four load-bearing terms in 081KQ0YZ80008QG0R003EJQZ1M with Otto-286 precision:

1. **"Quant-grade mathematical rigor"** — what standard must a
   formalization meet? (Itô-calculus-level SDE? Measure-theoretic
   probability? Rigorous definition of stochastic processes? How
   formal is "formal"?) Enumerate the qualifying criteria so a
   reader can determine whether a candidate formalization passes
   or not.

2. **"Austrian primitive"** — which claims from the Austrian tradition
   are treated as axioms / foundational commitments vs. derived
   theorems vs. empirical conjectures? Separate the praxeological
   core (Mises action axiom → time-preference → interest) from
   the applied-theory layer (ABCT, capital-structure stages) from
   the policy-layer (sound money, anti-central-planning). The
   primitives that admit formalization may not be the same across
   all three layers.

3. **"Formalization"** — distinguish:
   - *Mathematical representation*: translating a verbal claim
     into notation without changing content
   - *Rigorous proof*: deriving the claim from stated axioms
     under the chosen mathematical framework
   - *Empirical embedding*: giving the claim observable
     consequences testable under the math framework
   Which of these three does "quant-grade formalization" require?

4. **"Synthesis gap"** — the gap is not just "no paper combines
   them" but a structural claim: the quant tradition *presupposes*
   equilibrium / neutral-money / efficient-markets priors that
   contradict Austrian foundations. The synthesis gap is a
   *foundations incompatibility* problem, not merely a
   *literature gap* problem. Precise statement of this
   distinction changes the research agenda.

## Why first

Otto-286: without precise definitions, the survey (081KR50HA0008QG0R000M4H35K) will
miscategorize partial attempts (e.g., Saifedean stock-to-flow is
empirical-embedding, not rigorous-proof; treating them as the same
class inflates the "already done" count). The per-primitive
assessments (081KR50HA0008QG0R0016T4VMZ–081KR50HA0008QG0R0027DHVPQ) cannot yield falsifiable claims without
a settled definition of what passes the formalization bar. The
synthesis ADR (081KR50HA0008QG0R000M838VA) depends on a uniform vocabulary to compare
across primitives.

The synthesis gap's structural nature (foundations incompatibility
vs. literature gap) determines whether the research program is
"assemble existing pieces" or "develop new mathematical framework
from scratch." That choice has order-of-magnitude effort implications.

## Output artifact

A committed file at `docs/aurora/quant-austrian-vocabulary.md`
containing the four definitions with:

- Term + precise definition
- What it INCLUDES (examples that pass)
- What it EXCLUDES (examples that fail, with justification)
- Any intra-Austrian disagreement that affects the definition's scope
- A falsification-criterion: what observable would cause a revision

## Focused check

```bash
ls docs/aurora/ | grep vocabulary
```

Expected: `quant-austrian-vocabulary.md` present.

## Acceptance signal

- File committed at `docs/aurora/quant-austrian-vocabulary.md`
- All four terms defined with include/exclude examples
- Each definition has a falsification-criterion
- Intra-Austrian definitional disputes cataloged (not polished away)

## Pre-start checklist

- [x] Prior-art search: no existing vocabulary doc found in
  `docs/aurora/`, skills, or memory files for this specific
  quant × Austrian domain intersection. 081KQ0YZ80008QG0R0026WN385 carries a
  related methodology note (§methodology) but does not resolve
  these four definitions.
- [x] Dependency-restructure: no `depends_on` — this is the root
  atom for the 081KQ0YZ80008QG0R003EJQZ1M decomposition. Reciprocal `composes_with`
  added to all child rows 081KR50HA0008QG0R000M4H35K–081KR50HA0008QG0R000M838VA.

## Composes with

- 081KQ0YZ80008QG0R003EJQZ1M (parent): implements the "Otto-286 methodology" owed work item
- 081KQ0YZ80008QG0R0026WN385 §methodology: the definitional-precision pass described there
  is the same discipline applied here to the quant × Austrian domain
- 081KR50HA0008QG0R000M4H35K (downstream): survey classification depends on these definitions
- 081KR50HA0008QG0R0016T4VMZ–081KR50HA0008QG0R0027DHVPQ (downstream): each formalizability assessment uses
  the "formalization" and "quant-grade rigor" definitions from this row
- 081KR50HA0008QG0R000M838VA (downstream): the synthesis ADR uses this vocabulary uniformly
