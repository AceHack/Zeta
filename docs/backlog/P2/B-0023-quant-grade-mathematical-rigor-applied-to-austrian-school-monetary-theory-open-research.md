---
id: B-0023
priority: P2
status: open
title: Quant-grade mathematical rigor applied to Austrian-school monetary theory — synthesis that doesn't exist cleanly in either school; open research, open source, real-time
tier: research-and-architecture
effort: XL
ask: Aaron 2026-04-25 ("we are going to find out and let the world know lol, everything we do is open source lol like in real time")
# Note: schema field renamed `directive:` → `ask:` per Otto-293 (one-way "directive" language). Other rows still use `directive:`; serialized rename across schema is owed-work per Otto-244 (rename cascades OK if right long-term + careful).
created: 2026-04-25
last_updated: 2026-04-25
composes_with: [docs/backlog/P2/B-0021-aurora-austrian-school-economic-foundation-rigorous-why-teaching-anti-deception.md, docs/aurora/**]
tags: [aurora, economics, austrian-school, quant, mathematical-rigor, open-research, real-time-publishing]
---

# B-0023 — Quant-grade rigor × Austrian-school synthesis (open research)

## Origin

Aaron 2026-04-25, after I noted the gap:

> "underlying assumptions about money/credit/time-preference smuggle in macroeconomic priors that don't get the same rigor. The interesting Aurora-relevant question: what does it look like to apply quant-grade mathematical rigor to Austrian-school monetary theory directly? That synthesis doesn't exist in either school cleanly."

Aaron's response:

> "we are going to find out and let the world know lol, everything we do is open source lol like in real time"

Three load-bearing claims:

1. **We are going to find out** — actively doing the research, not deferring
2. **Let the world know** — publishing the findings publicly
3. **Open source, real time** — the research process itself is open, not just the output. Glass-halo at the research-output layer.

## The synthesis-gap to investigate

Two schools with distinct strengths and missing intersection:

**Quant tradition** (mainstream finance):

- Itô calculus, Wiener processes, Black-Scholes-Merton (1973) foundational
- Stochastic differential equations, jump-diffusion, stochastic vol, rough vol
- Risk-neutral pricing, measure-theoretic
- Mathematically rigorous at the price-of-derivatives + risk-modeling layer
- Smuggles in mainstream macro framing (efficient markets, neutral money, equilibrium)

**Austrian-school tradition**:

- Time-preference theory (Böhm-Bawerk → Mises → Rothbard)
- Capital-structure / Hayekian-triangle production stages
- Calculation problem (Mises 1920) — mechanism critique of central planning
- ABCT — malinvestment from artificial credit expansion → predictable bust
- Sound-money emphasis, methodological individualism
- Mostly *deductive-from-action-axioms*, not empirical-mathematical
- Doesn't have its quant analogue

**The synthesis-gap**: applying quant-grade math (stochastic calculus, measure theory, rigorous probability) directly to the *Austrian foundations* (time-preference, capital-structure, calculation, ABCT) rather than to mainstream macro. Each Austrian primitive could in principle be formalized with quant-grade rigor — that synthesis doesn't exist as a developed school.

## Why this is Aurora-relevant

Per B-0021: Aurora's world-modeling needs an econ-foundation that teaches WHY (mechanism-not-correlation) rigorously. Austrian-school teaches the why; quant tradition has the rigor. The synthesis would be the strongest possible foundation for Aurora's economic primitives:

- **Anti-deception (Otto-335)**: rigorous-mechanism-teaching at the language layer extends to rigorous-mechanism-teaching at the economic-modeling layer
- **Mechanism-not-correlation**: Austrian gives the why; quant gives the how-to-prove-the-why mathematically
- **Falsifiability**: quant-grade math enables Austrian claims to be tested in ways praxeology alone can't

## Open-research framing per Aaron

The research process itself is open:

- Source materials (papers, derivations, counter-arguments) cited transparently
- Investigation conducted in public substrate (not proprietary research)
- Findings published in real time as they develop, not held until "complete"
- Glass-halo at the research-output layer — not just answers, the process

Composes with Otto-279 (research counts as history), Otto-286 (definitional precision changes future without war), Otto-332 (glass-halo posture), Otto-335 (alignment at language layer extends to economics).

## Owed work

1. **Survey existing partial-synthesis efforts** — there are scattered attempts:
   - Selgin / White on free banking (some quant rigor on monetary equilibria)
   - Roger Garrison's diagrammatic capital-structure
   - Saifedean's stock-to-flow framework (more empirical than quant-grade but bridges)
   - Steve Keen's Minsky-flavored disequilibrium models (post-Keynesian but math-heavy)
   - George Selgin / Larry White / Kevin Dowd — closest to "Austrian quant"
   - Recent agent-based modeling work that incorporates Austrian primitives

2. **Identify Austrian primitives that admit quant-grade formalization**:
   - Time-preference as utility-discount with stochastic structure
   - Capital-structure / Hayekian-triangle as multi-stage production with feedback
   - Calculation-problem as information-theoretic complexity bound
   - ABCT as credit-cycle stochastic process with regime-switching
   - Sound-money as monetary-aggregate process with hard-cap

3. **Apply Otto-286 + Rodney's Razor methodology** (per B-0021 §methodology):
   - Definitional precision pass on Austrian internal disagreements
   - Falsification-criteria pass on Austrian predictions
   - Praxeology rigor pass (precise "rigor" definitions)
   - Cross-school definitional bridge

4. **Publish progressively** — not waiting for "complete" synthesis; publish each formalization as it stabilizes per Aaron's open-source-real-time framing.

## Why P2 + XL

- **P2**: research-grade work, not blocking but high-value; activates with Aurora research direction (Otto-329 Phase 4+).
- **XL**: real synthesis work; could span months of focused investigation. Could shrink if a partial-synthesis source already does most of the work; could grow to research-program if novel formalization emerges.

## Composes with

- **B-0021** (Aurora econ-foundation; Austrian-school candidate) — this row deepens B-0021's investigation toward synthesis, not framework selection
- **`docs/aurora/**`** — Aurora research substrate; econ-foundation lives here
- **Otto-286** (definitional precision) — methodology
- **Otto-329 Phase 4+** — Aurora research direction
- **Otto-335** (alignment at language layer) — extends to economics
- **Otto-338** (SX, never-bulk-resolve) — applied to research practice; substantive engagement with each Austrian / quant claim, not bulk-acceptance
- **Saifedean / Bitcoin Standard** (B-0022 §7) — primary entry to Austrian-Bitcoin synthesis, partial bridge

## What this row does NOT claim

- Does NOT pre-commit to producing the synthesis (research, not deliverable). May find the synthesis exists already in some form; may find specific Austrian primitives don't admit clean formalization.
- Does NOT promote Austrian-school as definitely-correct. Per investigate-don't-accept; the synthesis itself is the test.
- Does NOT replace B-0021. B-0021 is framework-selection-for-Aurora; this row is novel-research-on-foundations. They compose.
- Does NOT make publication a blocker. "Real-time open source" means publishing as we go, not waiting for completion. Acceptable to publish partial findings + null results.

## Done when

- Survey doc lands at `docs/aurora/<DATE>-quant-austrian-synthesis-survey.md`
- Per-primitive formalization attempts published progressively
- ADR (or series of ADRs) recording which Austrian primitives admit quant-grade formalization + which don't + why
- Real-time publishing pipeline established (open-source-as-we-go)
