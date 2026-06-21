---
id: 081KR50HA0008QG0R0027DHVPQ
priority: P3
status: open
title: Per-primitive formalizability assessment — sound-money as monetary-aggregate process with hard-cap constraint (Austrian primitive #5)
tier: research-grade
effort: M
ask: decomposition of 081KQ0YZ80008QG0R003EJQZ1M
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [081KR50HA0008QG0R003ESW3MH, 081KR50HA0008QG0R000M4H35K]
composes_with: [081KQ0YZ80008QG0R003EJQZ1M, 081KR50HA0008QG0R003ESW3MH, 081KR50HA0008QG0R000M4H35K, 081KR50HA0008QG0R0016T4VMZ, 081KR50HA0008QG0R003Z3V6VP, 081KR50HA0008QG0R000467SWT, 081KR50HA0008QG0R00238MS98, 081KR50HA0008QG0R000M838VA]
parent: 081KQ0YZ80008QG0R003EJQZ1M
tags: [aurora, economics, austrian-school, quant, mathematical-rigor, sound-money, bitcoin, monetary-theory, hard-cap]
type: research
---

# 081KR50HA0008QG0R0027DHVPQ — Formalizability assessment: sound-money → monetary-aggregate process with hard-cap constraint

## What

Assess whether the Austrian sound-money primitive admits quant-grade
mathematical formalization as a monetary-aggregate stochastic process
with an inviolable hard-cap supply constraint. Produce a committed
research note at `docs/aurora/YYYY-MM-DD-primitive-sound-money.md`.

## The Austrian primitive

Sound money (Mises *Theory of Money and Credit* 1912; Rothbard
*What Has Government Done to Our Money?* 1963; Saifedean Ammous
*Bitcoin Standard* 2018): money whose supply is not subject to
arbitrary expansion by political authorities. The Austrian preference
for gold (and by extension Bitcoin) rests on:

1. **Stock-to-flow ratio**: high ratio = difficult to inflate supply
   = low time-preference encoding in the monetary unit
2. **Supply predictability**: known future supply schedule allows
   economic calculation across time horizons (without it, ABCT-style
   distortions are inevitable)
3. **Depoliticization of money**: removing discretionary monetary
   policy eliminates the artificial-credit-expansion mechanism that
   ABCT identifies as the root cause of booms and busts
4. **Civilizational-time-preference anchor**: hard money encodes
   low time-preference at the monetary layer, which propagates to
   longer investment horizons and more durable capital formation

## The quant-side analogs

The hard-cap constraint is structurally novel from the quant perspective:

- Standard monetary models treat money supply as a control variable
  (monetary policy) or a process driven by central bank decisions
  (reaction functions, Taylor rule)
- Bitcoin's hard cap (21M BTC) and known emission schedule creates
  a **deterministic supply path** — unprecedented in modern monetary
  history for a widely-used currency
- Saifedean's **stock-to-flow model** (S2F) is an empirical-embedding
  attempt: log-log regression of S2F ratio vs. price. This is
  empirical-embedding (081KR50HA0008QG0R003ESW3MH type), not rigorous-proof formalization.
- **Commodity money models** (gold standard era economics, Barro 1979,
  Bordo & Kydland 1992): supply driven by extraction economics
  (not political authority); these have quant treatments

## Research questions

1. Can the sound-money claim be stated as a formal property of a
   monetary process? Specifically: a money supply process M(t)
   is "sound" iff... (complete this definition using the Austrian
   desiderata: stock-to-flow, predictability, non-discretionary
   supply, depoliticization).

2. What are the formal welfare implications of a hard-cap monetary
   process vs. a discretionary monetary process under ABCT dynamics
   (081KR50HA0008QG0R00238MS98)? Is there a formal social-welfare comparison, or only
   a mechanism comparison?

3. Saifedean's S2F model: does it constitute formalization in the
   081KR50HA0008QG0R003ESW3MH sense, or is it a predictive model that happens to use
   a quantitative variable without deriving the mechanism from
   Austrian foundations? (Important: this is a classification
   question, not a truth-of-S2F question — the verdict on S2F's
   formalization type is separate from the verdict on its empirical
   accuracy.)

4. Does the Bitcoin hard-cap constitute a natural experiment that
   tests the Austrian sound-money claim? If so, what are the
   falsifiable predictions and what observations would refute them?

## Output artifact

`docs/aurora/YYYY-MM-DD-primitive-sound-money.md` with:

- Statement of the Austrian sound-money primitive (Mises /
  Rothbard / Saifedean variants with their distinct claims)
- Formal definition candidate for "sound money process"
- Welfare-comparison framework (formal if possible, mechanical if not)
- Saifedean S2F classified per 081KR50HA0008QG0R003ESW3MH vocabulary (classification
  is load-bearing for 081KR50HA0008QG0R000M4H35K survey)
- Bitcoin-as-natural-experiment: falsifiable predictions
- Synthesis-gap remaining
- Verdict

## Focused check

```bash
ls docs/aurora/ | grep sound-money
```

## Acceptance signal

- Research note committed under `docs/aurora/`
- Mises / Rothbard / Saifedean variants covered
- Formal definition of "sound money process" attempted
- S2F classified per 081KR50HA0008QG0R003ESW3MH vocabulary
- Bitcoin natural-experiment falsifiable predictions stated
- Verdict explicit

## Pre-start checklist

- [x] Prior-art search: 081KR50HA0008QG0R000M4H35K survey provides prior-work context;
  081KQ0YZ80008QG0R003JJHKPR (Bitcoin Standard research track, composes_with in 081KQ0YZ80008QG0R003EJQZ1M)
  may have relevant substrate — check before starting.
  No existing `docs/aurora/` note on sound-money formalization.
- [x] Dependency-restructure: parallelizable with 081KR50HA0008QG0R0016T4VMZ, 081KR50HA0008QG0R003Z3V6VP,
  081KR50HA0008QG0R000467SWT, 081KR50HA0008QG0R00238MS98. Check 081KQ0YZ80008QG0R003JJHKPR for existing Bitcoin/sound-money
  substrate that should be cited here.

## Composes with

- 081KQ0YZ80008QG0R003EJQZ1M (parent): implements primitive #5
- 081KR50HA0008QG0R003ESW3MH, 081KR50HA0008QG0R000M4H35K (deps): vocabulary and prior-work context
- 081KQ0YZ80008QG0R003JJHKPR (081KQ0YZ80008QG0R003EJQZ1M §composes_with): Saifedean / Bitcoin Standard
  substrate; sound-money formalization depends on that research track
- 081KR50HA0008QG0R00238MS98 (coupling): ABCT assessment explains WHY sound money matters
  mechanistically; this row formalizes the monetary-process property
  that prevents the ABCT distortion mechanism
- 081KR50HA0008QG0R000M838VA (downstream): verdict feeds synthesis ADR
