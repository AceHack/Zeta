---
id: B-0021.4
zetaid: 081KR7JY10008QG0R0032QYPW5
priority: P3
status: open
title: "B-0021.4 — Cross-school definitional bridge: Austrian vs Post-Keynesian vs complexity-economics on load-bearing terms (money, capital, interest, value)"
created: 2026-05-10
last_updated: 2026-05-10
depends_on: [B-0021.2, B-0021.3]
parent: B-0021
classification: buildable-after-B-0021.3
type: research
effort: M
tags: [aurora, economics, austrian-school, post-keynesian, complexity-economics, minsky, public-choice, cross-school, definitional-bridge]
---

# B-0021.4 — Cross-school definitional bridge (Austrian vs alternatives)

**Slice of:** [B-0021](../P2/B-0021-aurora-austrian-school-economic-foundation-rigorous-why-teaching-anti-deception.md)  
**Depends on:** B-0021.2 (Austrian strengths), B-0021.3 (Austrian weaknesses + intra-school map — cross-school bridge needs a full Austrian picture first)

## What

Produce a cross-school term-bridge catalog for the four load-bearing terms Aurora needs to define its econ-substrate, plus the three framework alternatives named in B-0021:

**Load-bearing terms** (per B-0021: "enables cross-school dialogue the field currently can't have"):

- **Money**: Austrian (purchasing-power store of value under commodity / hard-money constraint), Post-Keynesian (endogenous creation by banks; state money), Complexity (emergent exchange medium, network effects), Public-choice (political economy of money supply decisions).
- **Capital**: Austrian (heterogeneous production goods arrayed in time-structure / Hayekian triangle), Post-Keynesian (financial claims, equity, Cambridge capital controversy), Complexity (reproducible assets, network infrastructure), Public-choice (politically-allocated investment).
- **Interest**: Austrian (time-preference clearing price for loanable funds, non-arbitrary), Keynesian (monetary phenomenon, liquidity preference), Post-Keynesian (cost of production plus convention), Complexity (emergent from credit dynamics).
- **Value**: Austrian (subjective, marginalist, individual preference orderings), Post-Keynesian (cost-of-production plus pricing power, social), Complexity (emergent in exchange networks, relational).

**Frameworks to compare against Austrian**:

1. **Post-Keynesian** (Minsky financial-instability hypothesis, Godley sectoral-balances, Wray MMT) — also teaches *why* at different layer; survey against B-0021.1 "rigorous-why" test.
2. **Public-choice school** (Buchanan, Tullock) — overlaps Austrian on calculation/incentive critique, weaker on capital theory; is this additive or redundant?
3. **Complexity economics** (Santa Fe Institute, Brian Arthur) — empirical mechanism-teaching, emergent phenomena; what does it offer that Austrian misses, what does Austrian offer that it misses?

For each term × framework: produce a one-paragraph precise definition + cross-reference to where the school-comparison converges or diverges.

Produce `docs/aurora/econ/B-0021.4-cross-school-definitional-bridge.md`.

## Why

Per B-0021 methodology: "precise-definition catalog enables cross-school dialogue that the field currently can't have." Aurora's econ-modeling substrate will make claims across frameworks (e.g., ABCT applies here; Minsky instability applies there; public-choice incentive analysis applies to policy evaluation). Without the definitional bridge, the substrate will silently smuggle incompatible definitions of "capital" or "money" across contexts — exactly the kind of opacity the anti-deception requirement prohibits. This row provides the map Aurora needs to use frameworks complementarily without definitional contradiction.

## Acceptance criteria

1. `docs/aurora/econ/B-0021.4-cross-school-definitional-bridge.md` committed.
2. All four load-bearing terms covered for ≥3 frameworks each (Austrian + Post-Keynesian + at least one of Complexity or Public-choice).
3. Each cross-school entry: one-paragraph precise definition + convergence/divergence note.
4. "Aurora-relevant synthesis" section: for each term, what definition or definition-cluster does Aurora need to adopt (or hold as first-class ambiguity) for honest modeling?
5. No final framework recommendation (that's B-0021.5); only "what each school says + where they converge/diverge + what Aurora needs."
6. Rodney's Razor applied: which disagreements dissolve under precision (definitional confusion) vs which are genuine substantive branch-points?
7. Build gate green, Rule 0 compliant.

## Out of scope

- ADR or framework recommendation (B-0021.5).
- Austrian-only analysis (B-0021.2/B-0021.3 scope).
- Full implementation of any econ primitive in Aurora substrate (post-ADR, after B-0021.5).

## Composes with

- **B-0021.2** — Austrian strengths form one side of the bridge.
- **B-0021.3** — Austrian weaknesses + intra-school map inform where the school is internally divided (which creates bridge ambiguity).
- **B-0021.5** — ADR consumes this bridge catalog as evidence for the framework recommendation.
- **Otto-286** definitional precision — this row is the largest single deployment of Otto-286 discipline in this investigation.
- **`reducer` skill** Quantum Rodney's Razor — pruning the framework possibility-space by identifying which distinctions are genuine vs definitional confusion.
- **Post-Keynesian primary sources**: Minsky *Stabilizing an Unstable Economy*, Godley/Lavoie *Monetary Economics*, Wray *Modern Money Theory* (selective survey of key-chapter scope only).
