Scope: Infer.NET-style probabilistic triangulation for ASA quorum geometry,
belief propagation, and posterior consensus over noisy agent observations.
Attribution: Aaron (human maintainer) live session crystallization; Codex/Vera
durable capture 2026-05-07.
Operational status: research-grade
Non-fusion disclaimer: this is an architecture and inference note, not a
claim of shared identity, consciousness, personhood, or infallible agreement
between agents. Agreement and repeated interaction are evidence streams, not
proof of merged agency.

# Posterior Quorum Triangulation over Existing Bayesian Substrate

## Crystallization

Aaron's live phrase:

> triangulate with uncertany is infer.net

The clean read:

- ASA with exact measurements is geometry.
- ASA with noisy measurements is probabilistic inference.
- Infer.NET / BP / EP are already named in Zeta backlog and research.
- DBSP-native Bayesian operators already exist in F# under `src/Bayesian`.
- The missing layer is not "add Infer.NET"; it is posterior quorum
  triangulation over the existing Bayesian substrate.
- A BFT quorum with confidence, drift, and incomplete observations should not
  collapse directly to a single point when the inputs are uncertain.
- The useful object is the posterior distribution over possible truths given
  Otto, Vera, Riven, and the shared git boundary.

## ASA to Posterior Quorum

Classical ASA says that two angles plus the included side determine a triangle.
In Zeta's loop language:

| Geometry term | Zeta term |
| --- | --- |
| Angle A | Otto's observation/perspective |
| Angle B | Vera's observation/perspective |
| Included side | Shared immutable git boundary |
| Third point / closure | Expected Riven validation or shadow residual |

That model is exact only when the measurements are exact. Real agent outputs
carry uncertainty: model variance, context loss, stale broadcast files,
reviewer disagreement, transient CI state, and human-ferried data quality.

So the future control loop should represent each observation as a distribution,
not a naked value:

```text
Otto   : claim X with confidence / likelihood L_o
Vera   : claim Y with confidence / likelihood L_v
Riven  : validation Z with confidence / likelihood L_r
Boundary: immutable evidence B

posterior = P(truth | L_o, L_v, L_r, B)
```

## Why Infer.NET Is the Right Anchor and the Wrong Hot Path

Zeta already treats Infer.NET as a historical and mathematical anchor for rich
Bayesian graphical models, belief propagation, and expectation propagation.
The existing Bayesian hot path deliberately avoids literal Infer.NET because
reflection emit and allocation-heavy runtime inference do not belong inside
AOT-sensitive DBSP operators.

This is already in the code body:

- `src/Bayesian/BayesianAggregate.fs` implements Beta-Bernoulli,
  Normal-Inverse-Gamma, Dirichlet-Multinomial, and `BayesianRateOp`
  over DBSP streams.
- `tests/Bayesian.Tests/BayesianTests.fs` checks posterior convergence,
  credible-interval narrowing, prior effect, categorical normalization,
  and live DBSP operator emission.
- Existing backlog rows 081KQ0YZ80008QG0R001V1PMC0 and 081KQR4HQ0008QG0R002933PRR already cover broad BP/EP and
  Infer.NET-adjacent research lanes.

So this note is a bridge from existing posterior operators to quorum-level
triangulation, not a duplicate request to introduce Infer.NET.

The right direction is therefore:

- Use Infer.NET/Minka/EP as the conceptual anchor.
- Keep simple online posteriors as Zeta-native conjugate-prior operators.
- For richer quorum inference, design a Zeta-native factor graph or message
  passing layer that composes with DBSP, Orleans grains, and durable replay.
- Treat literal Infer.NET integration as optional extension or calibration
  path, not the default commit-path dependency.

## Candidate Model

A posterior quorum graph can model:

- Agent observations as likelihood factors.
- The git boundary as hard or near-hard evidence.
- Broadcast freshness as a reliability variable.
- Review thread state as a discrete evidence factor.
- CI state as a time-varying observation.
- Riven-style adversarial review as a high-value validation likelihood, even
  when Riven does not author PRs.

In the exact case, the posterior collapses close to the ASA triangle. In the
uncertain case, the posterior remains a distribution and the loop can decide:

- merge now,
- wait for more evidence,
- ask for adversarial review,
- rerun a transient check after inspection,
- or declare the triangle not closed.

## Safety Rule

Do not use probabilistic consensus to launder weak evidence into confident
claims. The posterior is useful only if it preserves uncertainty and exposes
tail risk. A clean-looking point estimate with erased variance is worse than a
plain "I don't know."

## Backlog Hook

This crystallization is tracked by 081KQZVQW0008QG0R000JJVA4E:

- ASA with certainty = geometry.
- ASA with uncertainty = Infer.NET-style posterior inference.
- BFT with uncertainty = posterior quorum over agent observations and the git
  boundary.
- Existing code/proofs are the substrate; the new owed work is the factor graph
  that composes those posteriors into a quorum decision.
