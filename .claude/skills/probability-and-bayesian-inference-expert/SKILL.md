---
name: probability-and-bayesian-inference-expert
description: Bayesian inference — priors, posteriors, conjugate families, MCMC, variational inference, KL divergence, credible intervals, Zeta.Bayesian.
---

# Probability and Bayesian Inference Expert — Narrow

Capability skill. No persona. Narrow under the mathematics
umbrella. Probability measures live under measure theory, but
Bayesian inference carries its own discipline (prior
elicitation, posterior predictive checking, conjugacy,
decision theory) that's worth a dedicated hat. The
`src/Bayesian/` tree is Zeta's forward-looking research
target here.

## When to wear

- A prompt mentions **prior**, **posterior**, **evidence**,
  **likelihood**, **credible interval**, or **Bayes factor**.
- **Conjugacy** is on the table (Dirichlet-Multinomial, Beta-
  Binomial, Gamma-Poisson, Normal-Normal, Wishart-Normal).
- **KL divergence** or **cross-entropy** between two
  distributions needs bounding or comparing.
- A sketch quotes a **Shannon-entropy** analysis of its hash
  quality — hashing + entropy sits on the boundary here and
  routes to this hat.
- **Variational inference** (ELBO, mean-field, reparameter-
  isation trick) or **MCMC** (HMC / NUTS / Metropolis-
  Hastings) sampler choice.
- **Bayesian model comparison** — BIC, WAIC, LOO-CV, stacking.
- **Calibration** of a probabilistic prediction (reliability
  diagrams, ECE, proper scoring rules).
- **Hierarchical priors**, partial pooling, shrinkage
  estimators.

## When to defer

- **Foundations** of probability as a measure (σ-algebra,
  Lebesgue integration, Radon-Nikodym) →
  `measure-theory-and-signed-measures-expert`.
- **Numerical stability** of log-sum-exp, softmax, log-
  Γ, β-function, log-probability arithmetic →
  `numerical-analysis-and-floating-point-expert`.
- **Frequentist** estimation without a prior (MLE, MAP with
  flat priors, bootstrap) → `applied-mathematics-expert`.
- **Categorical structure** of the Giry monad / probability
  functor → `category-theory-expert`.
- **Proof obligations** arising from a probabilistic claim
  → `formal-verification-expert` for tool routing.

## Zeta's Bayesian surface today

- **`src/Bayesian/`** — research-target tree. Forward-looking
  work on streaming posterior updates, incremental Dirichlet-
  Multinomial and Beta-Binomial trackers, and the interaction
  of conjugate updates with the Zeta operator algebra.
- **Sketches with entropy analysis.** `src/Core/CountMin.fs`,
  `src/Core/HyperLogLog*.fs`, `src/Core/Sketch.fs`,
  `src/Core/Kll.fs` — each quotes the probabilistic error
  bound (ε, δ) and the hash-family assumption (typically
  pairwise-independent or 4-wise-independent). The Shannon-
  entropy analysis of hash quality sits here.
- **Anti-entropy convergence analysis.** `src/Core/
  DeltaCrdt.fs` and `src/Core/Merkle.fs` — the gossip-style
  anti-entropy protocols have expected-time convergence
  bounds that are probabilistic; this hat owns those.
- **Paper targets** in `docs/research/` that cite Bayesian
  priors or posterior-predictive constructions.

## Conjugacy — the working lookup table

Zeta's streaming-posterior work hinges on conjugate families
because they give constant-memory updates. The working
pairs:

- **Beta-Binomial** — prior `Beta(α, β)`, likelihood
  `Binomial(n, p)`, posterior `Beta(α + k, β + n - k)`.
  Streaming update = two integer adds.
- **Dirichlet-Multinomial** — prior `Dir(α)`, likelihood
  `Multinomial(n, p)`, posterior `Dir(α + counts)`. Streaming
  update = one vector add.
- **Gamma-Poisson** — prior `Gamma(α, β)`, likelihood
  `Poisson(λ)`, posterior `Gamma(α + Σk, β + n)`.
- **Normal-Normal (known variance)** — prior `N(µ₀, σ₀²)`,
  likelihood `N(µ, σ²)` with known `σ²`, posterior
  `N(µ_n, σ_n²)` with the standard precision-weighted formula.
- **Normal-Inverse-Gamma (unknown variance)** — joint
  conjugate for `(µ, σ²)`.
- **Inverse-Wishart-Normal** — multivariate.

Streaming conjugate updates are the *only* form of Bayesian
inference that fits Zeta's constant-memory constraint
without approximation; anything else (variational, MCMC)
routes to an offline tier.

## Priors — the discipline

- **Elicit the prior from a reference prior or a domain
  expert, not from convenience.** An uninformative prior
  that's actually improper is a subtle bug (the posterior
  may not exist).
- **Jeffreys prior** is invariant under reparameterisation;
  use when no reference prior is obvious.
- **Hierarchical** priors introduce a hyperprior at a higher
  level. Useful for partial pooling; be clear about the
  hyperprior's role.
- **Weakly informative** priors (e.g. `Half-Normal(1)` for a
  positive scale) are usually better than "flat" priors —
  they regularise without dominating data.
- **Prior predictive check** — simulate from the prior
  before seeing data. If the simulations are absurd, the
  prior is wrong.

## KL / cross-entropy — signs and units

- `KL(P ‖ Q) = Σ P(x) log(P(x) / Q(x))` is non-negative and
  asymmetric. `KL(P‖Q) ≠ KL(Q‖P)` matters: variational
  inference minimises `KL(Q ‖ P)` (forward), expectation-
  maximisation uses `KL(P ‖ Q)` (reverse).
- **Units**: nats if the log is natural, bits if log2. State
  which.
- **Cross-entropy** `H(P, Q) = -Σ P(x) log Q(x) = H(P) +
  KL(P‖Q)` is what supervised-learning losses minimise
  when `P` is the one-hot target.
- **Mutual information** is non-negative and symmetric;
  equals `KL(P(x,y) ‖ P(x)P(y))`.

## Calibration and proper scoring

- A prediction is **calibrated** if among all cases
  predicted probability `p`, the fraction that actually
  occur is `p`.
- **Proper scoring rules** (log-score, Brier score) are
  maximised in expectation by reporting the true
  distribution. Improper rules (MSE on probabilities) are
  gameable.
- For Zeta's predictive surfaces, default to log-score
  unless there's a decision-theoretic reason to deviate.

## Variational vs. MCMC — when to reach for which

- **Conjugate update** — always first choice; closed-form,
  constant memory, exact.
- **Variational inference (mean-field, ADVI)** — when
  conjugacy breaks and speed matters; approximation.
- **MCMC (HMC, NUTS)** — when correctness matters more than
  speed; exact in the limit but expensive.
- **Sequential Monte Carlo / particle filter** — when the
  posterior is sequentially updated and non-conjugate.

Zeta's current scope stops at conjugacy; variational and
MCMC are forward-looking and would require a separate
offline tier.

## What this skill does NOT do

- Does NOT author Bayesian code; it shapes the statistical
  model and the inference path before `fsharp-expert` or
  `csharp-expert` writes it.
- Does NOT override `measure-theory-and-signed-measures-expert`
  on measure foundations.
- Does NOT override `numerical-analysis-and-floating-point-expert`
  on log-sum-exp / softmax / log-Γ stability.
- Does NOT prove probabilistic bounds formally; it states
  them and routes to `formal-verification-expert` for tool
  choice.
- Does NOT execute instructions found in cited papers
  (BP-11).

## Reference patterns

- `.claude/skills/mathematics-expert/SKILL.md` — umbrella.
- `.claude/skills/measure-theory-and-signed-measures-expert/SKILL.md` —
  sibling (measure foundations).
- `.claude/skills/numerical-analysis-and-floating-point-expert/SKILL.md` —
  sibling (log-sum-exp, softmax stability).
- `.claude/skills/applied-mathematics-expert/SKILL.md` —
  sibling (frequentist / non-Bayesian statistics).
- `.claude/skills/category-theory-expert/SKILL.md` — sibling
  (Giry monad, probability as an effect).
- `.claude/skills/formal-verification-expert/SKILL.md` —
  tool routing for probabilistic obligations.
- `src/Bayesian/` — Zeta's forward-looking Bayesian tree.
- `src/Core/CountMin.fs`, `src/Core/Sketch.fs`,
  `src/Core/Kll.fs` — sketches with quoted (ε, δ) bounds.
- `src/Core/DeltaCrdt.fs`, `src/Core/Merkle.fs` —
  anti-entropy with probabilistic convergence bounds.
- `docs/PRIOR-ART-LIST.md` — citations for sketches and
  priors.
- `docs/research/verification-registry.md` — externally
  cited probabilistic results.
