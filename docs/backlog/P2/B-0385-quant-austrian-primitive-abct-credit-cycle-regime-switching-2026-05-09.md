---
id: B-0385
zetaid: 081KR50HA0008QG0R00238MS98
priority: P3
status: open
title: Per-primitive formalizability assessment — ABCT as credit-cycle stochastic process with regime-switching (Austrian primitive #4)
tier: research-grade
effort: M
ask: decomposition of B-0023
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [B-0380, B-0381]
composes_with: [B-0023, B-0380, B-0381, B-0382, B-0383, B-0384, B-0386, B-0387]
parent: B-0023
tags: [aurora, economics, austrian-school, quant, mathematical-rigor, abct, business-cycle, regime-switching, stochastic-processes]
type: research

---

# B-0385 — Formalizability assessment: ABCT → credit-cycle stochastic process with regime-switching

## What

Assess whether Austrian Business Cycle Theory (ABCT) admits
quant-grade mathematical formalization as a credit-cycle stochastic
process with regime-switching dynamics. Produce a committed research
note at `docs/aurora/YYYY-MM-DD-primitive-abct.md`.

## The Austrian primitive

ABCT (Mises 1912 *Theory of Money and Credit*; Hayek 1929/1931
*Prices and Production*): when central banks or fractional-reserve
banks expand credit beyond genuine savings, they artificially lower
interest rates below the natural rate. This:

1. Induces entrepreneurs to invest in longer production structures
   (malinvestment in capital-intensive / "higher-order" goods)
2. Creates an unsustainable boom (apparent prosperity from the
   new credit)
3. Must end in a bust when the credit expansion stops or reverses —
   the capital structure must liquidate the malinvestments

The boom-bust asymmetry is mechanistic: the Austrian claim is not
merely "credit expansion causes problems eventually" (which is widely
agreed) but specifically that the *structure of production* is
distorted in a predictable way and the correction is the liquidation
of those specific distortions.

Key tension: ABCT predictions about timing have failed empirically
(post-2008 predictions of immediate hyperinflation). The Austrian
response is definitional: the prediction is about the *direction*
and *mechanism* of correction, not the *timing*. Formalizing ABCT
forces this definitional question to be resolved.

## The quant-side analogs

Credit cycles and regime-switching are well-developed in quant finance:

- **Regime-switching models** (Hamilton 1989, Markov regime-switching):
  two states (boom / bust) with transition probabilities driven by
  observable credit-expansion indicators — directly applicable
- **Hyman Minsky's financial instability hypothesis**: similar cycle
  mechanics (stability → risk-taking → instability); post-Keynesian
  but mathematically adjacent; Minsky was formalized by several
  post-Keynesian quant economists (Steve Keen's differential equation
  models)
- **Credit-cycle models** in macro finance (Bernanke-Gertler-Gilchrist
  financial accelerator; Brunnermeier-Sannikov I-theory of money)
- **Jump-diffusion models** for crisis dynamics: the bust is a jump
  process superimposed on diffusion-phase boom dynamics

## Research questions

1. Can ABCT be stated as a regime-switching model where the
   transition probability from boom→bust is increasing in a
   *credit-expansion-beyond-genuine-savings* state variable?
   What observable is that state variable?

2. Does the Austrian mechanism (malinvestment in specific capital-
   structure stages) give observable implications that distinguish
   ABCT from other credit-cycle theories (Minsky's instability
   hypothesis, Bernanke financial accelerator)? If not, the quant
   formalization cannot adjudicate between them.

3. The Austrian timing-prediction failure: does formalizing ABCT
   as a stochastic process with uncertain transition times resolve
   the debate? (The Austrian claim was about *eventual* correction,
   not point-in-time prediction.) Or does the stochastic framing
   vacuously make any theory unfalsifiable?

4. What is the relationship between B-0383 (capital-structure
   formalization) and B-0385 (ABCT)? ABCT requires the capital-
   structure formalization as a substrate — this row formalizes the
   *dynamics* that the capital-structure row formalized the *structure* for.

## Output artifact

`docs/aurora/YYYY-MM-DD-primitive-abct.md` with:

- Statement of ABCT (Mises / Hayek variants; Garrison's diagrammatic
  treatment as bridge to B-0383)
- Best-candidate quant formalization (regime-switching, jump-diffusion)
- Observable distinguishing implications vs. Minsky, Bernanke-Gertler
- Formalization type (per B-0380 vocabulary)
- How timing-prediction failures are handled in the formal model
- Synthesis-gap remaining
- Verdict

## Focused check

```bash
ls docs/aurora/ | grep abct
```

## Acceptance signal

- Research note committed under `docs/aurora/`
- Mises / Hayek / Garrison variants of ABCT covered
- Regime-switching formalization candidate evaluated
- Observable distinguishing implications stated (or their absence noted)
- Timing-prediction-failure treatment addressed
- Verdict explicit

## Pre-start checklist

- [x] Prior-art search: B-0381 survey provides prior-work context;
  no existing `docs/aurora/` note on ABCT formalization.
- [x] Dependency-restructure: depends on B-0383 for the capital-structure
  substrate but parallelizable if B-0383 assessment is in progress —
  add explicit depends_on on B-0383 if the implementer determines the
  capital-structure formalization choice gates the ABCT formalization
  choice. Currently marked as parallelizable with `composes_with`.

## Composes with

- B-0023 (parent): implements primitive #4
- B-0380, B-0381 (deps): vocabulary and prior-work context
- B-0383 (strong coupling): capital-structure primitive is the
  structural substrate that ABCT cycle dynamics layer on top of
- B-0387 (downstream): verdict feeds synthesis ADR
