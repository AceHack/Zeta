# The constants zoo — spectrum classes as canonical reference, and Brownian LLM ensembles

*Shadow ferry + reference carve, 2026-07-03. Aaron, on the math team's bridge map, verbatim:*

> "we need to save this somewhere and brownian motion is how i'm treating local basyian neural
> networks and others llm some are better at different tasks. these are the numbers for sure here"

*So: (1) the zoo gets its own durable reference page (this file), and (2) the Brownian
observation is ferried — it gives the zoo a JOB in the architecture, not just a gallery wall.*

## The zoo (canonical table — sympy-verified, scripts in `scripts/2026-07-03-bernoulli-bridges-*.py`)

| Spectrum class (per-mode information Iₙ) | Regularized / summed value | Constant | Meaning in the tick-vs-continuum setup |
|---|---|---|---|
| **Flat** (Iₙ = const — white noise, bandlimited channel mode-count) | ζ(0) | **−1/2** | The naive "sample white noise forever" case — the falsifier that killed the naive −1/12 reading. |
| **Linear** (Iₙ ∝ n — energy-per-mode ∝ frequency, the ½ℏω structure) | ζ(−1) | **−1/12** | The celebrity. Real only where a linear mode spectrum exists; no natural Zeta quantity found yet (Conjecture Z-1's open antecedent). |
| **Cubic** (Iₙ ∝ n³ — the REAL 3-D parallel-plate Casimir, after angular integration) | ζ(−3) | **+1/120** | Even the physical Casimir isn't −1/12 in 3-D — the meme number is the 1-D toy's. |
| **Log** (Σ log n — Gaussian log-determinants, GP information) | ζ′(0) | **−½ log 2π** | The constant that actually shows up in Gaussian-process/log-det territory (Ray–Singer). |
| **Wiener / Brownian** (Iₙ ∝ 1/n² — the 1/ν² spectrum) | ζ(2) | **π²/6 — CONVERGENT** | **No regularization needed at all.** The sum honestly converges: finite total IV, no scheme-dependence, no renormalization drama. |

Companion constants that are *already in the codebase's mathematics* (bridge map, same date):
the trapezoid/Euler–Maclaurin correction coefficient **1/12** (finite-Δ tick-sampling error, same
B₂ as Casimir, elementary); Stirling's **1/12N** (Bernoulli numbers verbatim in every conjugate
Bayesian log-evidence — the terms BIC truncates).

## The Brownian reading — why the convergent row is the load-bearing one

Aaron's practice: **treat local Bayesian neural networks and heterogeneous LLMs as Brownian
motion** — a fleet of stochastic experts, each a random walk over its own competence landscape,
"some better at different tasks."

The zoo says something sharp about that choice: **the Brownian class is the one whose total
information honestly converges.** π²/6, no regularization, no scheme-dependence, no infinities
to subtract. Read through the architecture:

1. **A Brownian expert has a finite, well-defined total IV** — you can integrate what a 1/ν²
   source tells you without any renormalization scheme, so pricing a Brownian expert's stream in
   nats is mathematically *clean* in a way flat or linear sources are not. The attention economy
   over Brownian experts needs no −1/12-style cap; the convergence IS the cap.
2. **Heterogeneous-experts = decorrelated walkers.** "Some better at different tasks" is the
   Thousand-Brains / Condorcet structure: walkers exploring different regions of competence
   space, valuable *because* their walks are independent. The delay-decorrelation bonus and the
   hard-money entropy budgets (the real hyperinflation guard) compose with this directly: what
   an ensemble member is paid for is exactly its uncorrelated-and-unique step.
3. **Brownian is the honest prior for an expert you haven't measured.** Wiener's 1/ν² weights
   the recent past most and forgets smoothly — a martingale: current state is the best predictor,
   no free lookahead. Treating an LLM as Brownian is treating it as *no-arbitrage*: it can't be
   pumped for information it hasn't actually accumulated. (Anchors: Einstein 1905; Wiener 1923;
   the martingale property; Matérn/GP smoothness families as the tunable generalization — a
   smoother-than-Brownian expert is a *claim* that should be earned by calibration, not assumed.)

One honest seam, per register discipline: rows 1–5 and the convergence facts are **register A**
(theorems, verified). The mapping "LLM ensemble ≡ Brownian walkers" is **register C** — a
modeling choice with good anchors (GP treatments of neural nets; random-walk models of skill),
assessable by calibration data, not provable. Aaron's "these are the numbers for sure here" is
right in the A-sense: whatever model you pick from the smoothness family, *these five constants
are the complete menu* of what discrete-vs-continuous accounting can return — the zoo is the
menu, the Brownian row is the dish that needs no chef's tricks.

## Pointers

- `2026-07-03-bernoulli-bridge-map-…` — the full bridge map this zoo is carved from (+ replayable scripts).
- `2026-07-03-soraya-verdict-minus-one-twelfth-…` — the falsifier (flat → −1/2) and Z-1's B-path.
- `2026-07-03-ferry-hard-money-entropy-budgets-cap-iv-…` — the real hyperinflation guard the Brownian pricing composes with.
- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B-zeta — Conjecture Z-1 (the linear row's open antecedent).
- Anchors (Beacon): Euler/Maclaurin; Hardy *Divergent Series*; Casimir 1948; Ray–Singer 1971; Basel problem (Euler 1734 — π²/6); Einstein 1905 / Wiener 1923 (Brownian motion); Neal 1996 (BNNs as GPs); Matérn family.
