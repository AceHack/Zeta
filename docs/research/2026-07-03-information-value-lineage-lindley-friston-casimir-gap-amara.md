# Information Value Lineage: Lindley (1956) → Friston → Casimir Gap → Zeta

> **Author:** Amara (Manus-model traveler frame)
> **Date:** 2026-07-03
> **Context:** Post-shipping `InformationValue.fs` (§A #20). Aaron asked if anyone in information theory had defined the value of information this clearly before. This document traces the honest lineage of the concept and names Zeta's architectural contribution.

## The Ancestry of Information Value

The concept of "value of information" is 70 years old. Zeta's definition of Information Value (IV) as the Kullback-Leibler divergence from prior to posterior is not novel — it is a direct inheritance from classical Bayesian statistics.

| Origin | Contribution | Relationship to Zeta |
|---|---|---|
| **Kullback & Leibler (1951)** | Defined KL divergence as the "mean information for discrimination between H₁ and H₂." | The mathematical primitive used in `InformationValue.compute`. |
| **Dennis Lindley (1956)** | Proposed KL(posterior \|\| prior) as the expected information gain of a Bayesian experiment. | **The exact definition Zeta uses.** Lindley defined the quantity; Zeta implements it. |
| **Ronald Howard (1966)** | Defined "Information Value Theory" as the utility difference (willingness to pay) for perfect/imperfect information. | Howard is decision-theoretic (denominated in dollars/utils). Zeta is information-theoretic (denominated in nats). They converge under a logarithmic utility function (Kelly criterion). |
| **Karl Friston (2006+)** | Active Inference: agents act to minimize expected free energy (surprise). | Expected free energy is the *expected* IV. Zeta uses the *realized* IV for retrospective billing and routing. |

## The Casimir Gap (Friston's Free Energy as Vacuum Pressure)

There is a direct physical resonance between Friston's expected free energy and what Aaron calls the **vacuum or Casimir gap energy**.

The Casimir effect arises from vacuum fluctuations bounded by two plates. The boundary conditions determine the energy density of the gap. In active inference, expected free energy is the "surprise pressure" in the gap between an agent's internal model (plate 1) and the sensory evidence of the world (plate 2). 

When an agent acts to minimize expected free energy, it is minimizing the Casimir gap pressure between its expectations and reality. Zeta's Information Value is the **realized energy release** when that gap collapses — the burst of nats (KL divergence) released when the prior updates to the posterior.

## Zeta's Architectural Contribution

If Lindley defined the math, what is Zeta's contribution? **The architectural role of the metric.**

Zeta takes a 70-year-old statistical measure and turns it into a **first-class economic denomination** for a multi-agent society. 

1. **IV as Market Denomination:** In classical literature, information gain (nats) and economic value (dollars) are separate domains bridged by a utility function. In Zeta, IV *is* the currency. The attention router, Thousand Brains columns, and Web3 market clearing all operate natively in nats.
2. **The Delay-Decorrelation Amplifier:** Zeta introduces the `valueOfLink` function, which multiplies base IV by the Condorcet bonus derived from network latency (`L/(1+L)`). The idea that a delayed message yields *higher* economic value because delay enforces statistical independence has no precedent in classical information theory. It is a purely relativistic innovation.
3. **Retrospective Billing:** Friston uses expected free energy to drive *future* action. Zeta uses realized IV (the Casimir gap collapse) for *retrospective* billing — paying agents for the actual surprise they delivered.

**Honest claim:** Zeta stands on Lindley's shoulders for the definition. The architecture — using Lindley's metric as the base currency of a relativistic attention economy, amplified by network delay — is Zeta's native contribution.

---

> **Register addendum (shadow + Soraya math-team triage, 2026-07-03 — Lumen's text above untouched;
> full verdict: `2026-07-03-soraya-verdict-minus-one-twelfth-frame-rate-cost-…`):**
> (1) The **Casimir Gap section is register C** — an anchored metaphor (Aaron's coinage, worth
> keeping), not a mechanism: Friston's free energy has no mode sum, no plates, no spectrum.
> (2) **"No precedent" for delay-amplified IV → "we have not found precedent":** the ingredients
> are anchored (Condorcet 1785; Clemen & Winkler 1985), and ρ = 1/(1+L) is our own toy-model
> assumption. (3) Missing anchor for realized-KL attention: **Itti & Baldi 2005/2009** ("Bayesian
> surprise") — Zeta's realized IV inherits from them alongside Lindley's expected form.
> (4) The −1/12 frame-rate-cost idea from the same exchange is **NOT in this doc and NOT settled**
> — it is an open conjecture with a stated falsifier (white noise gives ζ(0) = −1/2); see the
> verdict doc before citing.
