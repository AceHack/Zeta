---
id: B-0021.2
zetaid: 081KR7JY10008QG0R001RR02BP
priority: P3
status: open
title: "B-0021.2 — Austrian-school strengths survey + Rodney's Razor pass (time-preference, ABCT, calculation problem, sound money)"
created: 2026-05-10
last_updated: 2026-05-10
depends_on: [B-0021.1]
parent: B-0021
classification: buildable-after-B-0021.1
type: research
effort: M
tags: [aurora, economics, austrian-school, rodney-razor, abct, time-preference, capital-structure, calculation-problem]
---

# B-0021.2 — Austrian-school strengths survey + Rodney's Razor pass

**Slice of:** [B-0021](../P2/B-0021-aurora-austrian-school-economic-foundation-rigorous-why-teaching-anti-deception.md)  
**Depends on:** B-0021.1 (definitions of "rigorous-why" and "anti-deception" must exist before strength can be evaluated against them)

## What

Survey the four core Austrian-school strengths named in B-0021 against the evaluation criteria produced by B-0021.1. Apply Rodney's Razor standard form (essential-vs-accidental complexity cut on shipped Austrian artifacts) to each:

1. **Time-preference theory** (Böhm-Bawerk → Mises → Rothbard): does this mechanism satisfy the "rigorous-why" definition from B-0021.1? What is the observable-variable test for whether interest rates are non-arbitrary under this theory?
2. **Capital-structure theory / Hayekian triangle + ABCT**: does production-stage distortion under monetary expansion satisfy the "anti-deception" definition? What is the precise mechanism from credit expansion → malinvestment → bust, stated falsifiably?
3. **Calculation problem** (Mises 1920): does the argument that central economic planning fails due to dispersed price-information satisfy the definitions? What observable conditions would confirm or disconfirm?
4. **Sound-money / hard-money thesis**: what is the precise causal claim linking hard money to civilizational time-preference anchoring? Rodney's Razor: what is essential vs what is accidental embellishment?
5. **Methodological individualism**: how does micro-foundations-as-primary compose with the "rigorous-why" requirement for Aurora's world-modeling?

Produce `docs/aurora/econ/B-0021.2-austrian-strengths-survey.md` with:

- Per-strength assessment against B-0021.1 definitions.
- Rodney's Razor output: what survives the essential-vs-accidental cut.
- What each strength enables for Aurora specifically (per B-0021: "what questions Aurora can ask").

## Why

The strengths survey gated on B-0021.1 definitions prevents the failure mode where Austrian wins by framing the question in Austrian terms. By applying the independently-defined "rigorous-why" test (B-0021.1) to Austrian claims, the survey is fair both to the framework and to Aurora's actual needs. Per investigate-don't-accept (Otto-322/331): the investigation must be structurally independent of the framework being investigated.

## Acceptance criteria

1. `docs/aurora/econ/B-0021.2-austrian-strengths-survey.md` committed.
2. Each of the 5 strengths evaluated against B-0021.1 definitions (not against Austrian self-description).
3. Rodney's Razor output per strength: what is essential (survives), what is accidental (conditional on additional assumptions).
4. Aurora-relevance column per strength: which Aurora subsystems (per B-0021 `composes_with`) benefit.
5. No conclusion about which school wins (that's B-0021.5); only strength-per-criterion assessment.
6. Primary sources cited: Mises *Human Action* (key chapters), Hayek *Prices and Production*, Rothbard *Man, Economy, and State* (selective), Saifedean *Bitcoin Standard* (Chapter 1-3 minimum).
7. Build gate green, Rule 0 compliant.

## Out of scope

- Austrian weakness audit (B-0021.3).
- Cross-school comparison (B-0021.4).
- Post-Keynesian or complexity-economics frameworks (B-0021.3/B-0021.4 scope).
- ADR or commitment (B-0021.5).

## Composes with

- **B-0021.1** — definitions consumed here.
- **B-0021.3** — weakness audit runs after this; strengths and weaknesses pair for honest assessment.
- **`reducer` skill / Rodney's Razor** — Quantum Rodney's Razor (possibility-space pruning) applied to pending framework decision; standard Rodney's Razor applied to shipped Austrian artifacts.
- **Otto-335** anti-deception at language layer — each strength evaluated on whether it enables Aurora to catch economic lies.
