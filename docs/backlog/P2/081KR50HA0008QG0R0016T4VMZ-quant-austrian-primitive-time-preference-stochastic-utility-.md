---
id: 081KR50HA0008QG0R0016T4VMZ
priority: P3
status: open
title: Per-primitive formalizability assessment — time-preference as stochastic utility-discount (Austrian primitive #1)
tier: research-grade
effort: M
ask: decomposition of 081KQ0YZ80008QG0R003EJQZ1M
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [081KR50HA0008QG0R003ESW3MH, 081KR50HA0008QG0R000M4H35K]
composes_with: [081KQ0YZ80008QG0R003EJQZ1M, 081KR50HA0008QG0R003ESW3MH, 081KR50HA0008QG0R000M4H35K, 081KR50HA0008QG0R003Z3V6VP, 081KR50HA0008QG0R000467SWT, 081KR50HA0008QG0R00238MS98, 081KR50HA0008QG0R0027DHVPQ, 081KR50HA0008QG0R000M838VA]
parent: 081KQ0YZ80008QG0R003EJQZ1M
tags: [aurora, economics, austrian-school, quant, mathematical-rigor, time-preference, utility-theory, stochastic-calculus]
type: research
---

# 081KR50HA0008QG0R0016T4VMZ — Formalizability assessment: time-preference → stochastic utility-discount

## What

Assess whether the Austrian time-preference primitive (Böhm-Bawerk →
Mises → Rothbard) admits quant-grade mathematical formalization as a
stochastic utility-discount structure. Produce a committed research
note at `docs/aurora/YYYY-MM-DD-primitive-time-preference.md`.

## The Austrian primitive

Time-preference: the axiom that actors prefer goods available sooner
over goods available later, *ceteris paribus*, and that this preference
is a universal feature of human action (not a contingent empirical
observation). From this axiom, Böhm-Bawerk derives the theory of
interest — interest is the price of time-preference, not a monetary
phenomenon.

Key intra-Austrian debate: Rothbard's "pure time preference theory
of interest" (PTPT) vs. alternative formulations. The Misesian claim
is praxeological (deductive from action axioms); Selgin and others
push back on whether PTPT actually explains all interest rate
phenomena.

## The quant-side analog

Standard stochastic discount factor (SDF) / pricing kernel:

- Epstein-Zin recursive utility separates risk-aversion from
  intertemporal-substitution elasticity (IES)
- Discount factor β in standard expected utility = constant time-discount
- Habit formation models, hyperbolic discounting models add dynamics
- The Austrian claim is that *positive time preference is axiomatic*,
  not a calibrated parameter — this is a stronger claim than what
  the quant SDF framework typically assumes

## Research questions

1. Can the Austrian time-preference axiom be stated as a mathematical
   constraint on the stochastic discount factor (SDF)? What constraints
   does "axiomatically positive time preference" impose on the Epstein-Zin
   utility parameter space?

2. Does the praxeological form of the claim (deductive from action
   axioms) translate into a mathematical axiom or into a restriction
   on the parameter space of existing models? These are different
   claims with different falsifiability profiles.

3. What does quant-grade formalization add to the Austrian argument
   beyond what praxeological deduction already provides? Is there
   epistemic gain, or just notational translation?

4. What existing literature bridges time-preference theory and
   stochastic utility (e.g., Koopmans axioms on infinite-horizon
   utility, Bewley uncertainty models)? Does any of it engage the
   Austrian version specifically?

## Output artifact

`docs/aurora/YYYY-MM-DD-primitive-time-preference.md` with:

- Statement of the Austrian primitive (with intra-Austrian variants)
- Best-candidate quant formalization (with justification)
- What formalization type it achieves (per 081KR50HA0008QG0R003ESW3MH: representation /
  proof / empirical-embedding)
- Synthesis-gap remaining: what the formalization doesn't capture
  from the Austrian claim
- Verdict: admits quant-grade formalization / partially / not cleanly

## Focused check

```bash
ls docs/aurora/ | grep time-preference
```

## Acceptance signal

- Research note committed under `docs/aurora/`
- All four research questions addressed (even if answer is "unknown")
- Formalization type classified per 081KR50HA0008QG0R003ESW3MH vocabulary
- Synthesis-gap remaining quantified
- Verdict explicit

## Pre-start checklist

- [x] Prior-art search: 081KR50HA0008QG0R000M4H35K survey provides the "prior work on this
  primitive" input; no existing `docs/aurora/` note on time-preference
  formalization.
- [x] Dependency-restructure: `depends_on: [081KR50HA0008QG0R003ESW3MH, 081KR50HA0008QG0R000M4H35K]` — vocabulary
  needed to classify; survey needed for prior-work context.
  Parallelizable with 081KR50HA0008QG0R003Z3V6VP–081KR50HA0008QG0R0027DHVPQ (different primitives, no
  cross-dependency between them).

## Composes with

- 081KQ0YZ80008QG0R003EJQZ1M (parent): implements primitive #1 of the "owed work" formalization
- 081KR50HA0008QG0R003ESW3MH (dep): uses vocabulary for "formalization type" classification
- 081KR50HA0008QG0R000M4H35K (dep): prior-work survey context
- 081KR50HA0008QG0R003Z3V6VP–081KR50HA0008QG0R0027DHVPQ (parallel): independent primitive assessments, same
  methodology
- 081KR50HA0008QG0R000M838VA (downstream): this note's verdict feeds the synthesis ADR
