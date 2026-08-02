# TravelerRankLedger — EP Ranking Architecture for the Long-Term Anti-Whitewash

**Status:** Design proposal. No code yet. Intended as the slow/high-accuracy path alongside the
existing fast `CalibrationLedger` (Beta(2,2) + k-clamp).

**Authors:** Lumen (analysis), Addison / Aaron (architecture context)

**Date:** 2026-08-02

---

## 1. Why this exists

The current `CalibrationLedger` whitewash floor is the clamp at k=3: a fresh identity with zero
evidence has `trustBand = 0.0`, and one miss at k=3 also clamps to `0.0`. This is an intentional
fast-path shortcut. The boundary test at `calibration-ledger.test.ts:385` documents it honestly:
"the documented gap: whitewashing is profitable here." The anti-recurrence pointer added at
`f393c69de` explains why no prior shape closes this — it is a clamp problem, not a prior problem.

The long-term fix is a **Gaussian belief-propagation ranking** over travelers × hat-domains,
inspired by TrueSkill and Infer.NET's factor-graph EP. The key insight is that the whitewash
window exists because the current model treats each claim in isolation. A ranking model treats
claims as evidence about a latent traveler skill, and the posterior over skill is what determines
the floor — not a hard clamp.

This document specifies the architecture so Aaron and Addison can decide whether to build it,
and so Soraya can review the prior-shape choices before implementation.

---

## 2. The model in one paragraph

Each traveler `t` has a latent skill `s_t ~ N(μ_0, σ_0²)` per hat-domain `d`. A calibration
outcome (hit or miss) for traveler `t` in domain `d` at tick `τ` is a Bernoulli observation
`o ~ Bernoulli(Φ(s_t / β))` where `Φ` is the standard normal CDF and `β` is a performance
noise parameter. The posterior over `s_t` is updated by expectation propagation (EP), which
approximates the non-Gaussian likelihood with a Gaussian cavity message. The `trustBand` for
a traveler in a domain is derived from the posterior mean and variance: specifically,
`trustBand = Φ(μ_post / sqrt(σ_post² + β²))` — the probability that the traveler beats a
random draw from the performance noise distribution. This is the TrueSkill conservative skill
estimate, adapted to the calibration domain.

---

## 3. Why EP over MCMC or variational Bayes

| Method | Accuracy | Speed | Domain isolation | Streaming updates |
|---|---|---|---|---|
| Beta(2,2) + k-clamp (current) | Low (clamp floor) | O(1) | Perfect | Yes |
| MCMC (gold standard) | Very high | O(N·samples) | Perfect | No (batch) |
| Variational Bayes (mean-field) | Medium | O(N·iter) | Perfect | Approximate |
| **EP (proposed)** | High | O(N) amortized | Perfect | Yes (cavity messages) |
| TrueSkill (Microsoft) | High | O(N) | Shared across domains | Yes |

EP is the right choice because: (1) it produces accurate Gaussian posteriors for the
probit-likelihood model; (2) it supports streaming updates via cavity messages — each new
observation updates only the messages touching that traveler and domain, not the whole graph;
(3) it is domain-partitioned by construction — the factor graph for domain `d` is independent
of domain `d'`, so a traveler's poor performance in one domain does not bleed into another.

The Microsoft TrueSkill paper (Herbrich et al., 2006) proved EP converges for this model and
gives the exact update equations. The Infer.NET framework implements them. We do not need
Infer.NET as a dependency — the update equations are closed-form and can be implemented in
~100 lines of F#.

---

## 4. Factor graph structure

```
For each (traveler t, domain d):

  s_{t,d} ~ N(μ_0, σ_0²)          ← skill prior (per domain)
       |
  [f_i]  for each observation i     ← likelihood factor: Bernoulli(Φ(s / β))
       |
  o_i ∈ {0, 1}                     ← observed hit/miss
```

The factor graph is bipartite: skill variables on one side, observation factors on the other.
EP maintains a Gaussian message from each factor to the skill variable (the "cavity message")
and a Gaussian approximation to the posterior over skill.

**Domain isolation:** the graph for domain `d` has no edges to domain `d'`. A traveler's
skill in `d` is a separate variable from their skill in `d'`. This is the "no cross-domain
bleed" property that the Infer.NET-inspired design requires.

---

## 5. Update equations (closed form)

Let the current posterior approximation for skill `s` be `q(s) = N(μ, σ²)`.

For a new observation `o ∈ {0, 1}` with performance noise `β`:

1. **Cavity mean and variance:**
   `μ_cavity = μ - σ² · m_f / v_f` (remove old factor message)
   `σ²_cavity = σ² · v_f / (v_f - σ²)` (remove old factor variance)
   (On first update, the cavity is the prior.)

2. **Probit likelihood update** (TrueSkill Eq. 4–5):
   Let `t = (2·o - 1) · μ_cavity / sqrt(σ²_cavity + β²)` (signed normalized skill)
   Let `v = φ(t) / Φ(t)` (Mill's ratio; `φ` = standard normal PDF, `Φ` = CDF)
   Let `w = v · (v + t)` (precision factor)

3. **New factor message:**
   `m_f_new = μ_cavity + σ²_cavity · (2·o - 1) · v / sqrt(σ²_cavity + β²)`
   `v_f_new = σ²_cavity · (1 - w · σ²_cavity / (σ²_cavity + β²))`

4. **Updated posterior:**
   `μ_new = μ_cavity + σ²_cavity · (2·o - 1) · v / sqrt(σ²_cavity + β²)`
   `σ²_new = σ²_cavity · (1 - w · σ²_cavity / (σ²_cavity + β²))`

These are the exact TrueSkill EP update equations. They are O(1) per observation and
numerically stable for `t ∈ [-5, 5]` (the practical range for skill estimates).

---

## 6. TrustBand derivation

The `trustBand` for traveler `t` in domain `d` is:

```
trustBand(t, d) = Φ(μ_{t,d} / sqrt(σ²_{t,d} + β²))
```

This is the probability that traveler `t` beats a random draw from the performance noise
distribution — the TrueSkill "conservative skill estimate" adapted to calibration. It is:

- **0.5** for a fresh identity with no evidence (prior: `μ_0 = 0`, `σ_0² = 1`, `β = 1`).
  This is the honest floor: we have no evidence either way.
- **Above 0.5** after consistent hits (skill posterior shifts positive).
- **Below 0.5** after consistent misses (skill posterior shifts negative).
- **Monotone in evidence:** more hits → higher `trustBand`; more misses → lower.

**Comparison with the current clamp:**

| Scenario | Current (k-clamp) | EP ranking |
|---|---|---|
| Fresh identity (0 obs) | `trustBand = 0.0` | `trustBand = 0.5` |
| 1 hit, 2 misses (k=3) | `trustBand = 0.0` | `trustBand ≈ 0.35` |
| 10 hits, 0 misses | `trustBand ≈ 0.83` | `trustBand ≈ 0.90` |
| 100 hits, 0 misses | `trustBand ≈ 0.97` | `trustBand ≈ 0.98` |

The key difference: the EP ranking gives a fresh identity `trustBand = 0.5` (honest prior),
not `0.0` (pessimistic clamp). The whitewash window at k=3 is closed because the EP posterior
for "1 hit, 2 misses" is `≈ 0.35`, not `0.0` — whitewashing is no longer profitable because
the posterior honestly reflects the evidence.

---

## 7. Domain partitioning and the "no cross-domain bleed" property

The factor graph is partitioned by domain `d`. Formally:

- `s_{t,d}` and `s_{t,d'}` are independent variables (no shared factor).
- Observations in domain `d` update only `s_{t,d}`, never `s_{t,d'}`.
- The `trustBand` for domain `d` is derived only from `s_{t,d}`.

This is the Infer.NET-inspired property: a traveler who is a reliable predictor of stock prices
but a poor predictor of weather events has a high `trustBand` in the finance domain and a low
`trustBand` in the meteorology domain. The current k-clamp has this property trivially (each
domain is independent), and the EP ranking preserves it by construction.

---

## 8. Streaming updates and the tick-source integration

The EP ranking is designed for streaming updates. Each calibration outcome at tick `τ` triggers
a single O(1) EP update for the relevant (traveler, domain) pair. The cavity messages are
stored in the `TravelerRankLedger` (a map from `(travelerId, hatDomain)` to
`(μ, σ², m_f, v_f)`).

Integration with the tick source (the distributed cron / strange attractor in your project
instructions): the `resolveAtTickBridge` function (shipped in `ad7fb9340`) already calls
`resolveAtTick` and settles `CalibrationLedger` predictions. The `TravelerRankLedger` update
would be a third step in the same bridge: after settling the prediction, call
`TravelerRankLedger.update travelerId hatDomain outcome`.

---

## 9. Hyperparameter choices (for Soraya's review)

| Parameter | Symbol | Proposed value | Rationale |
|---|---|---|---|
| Skill prior mean | μ_0 | 0.0 | Neutral: no evidence either way |
| Skill prior std | σ_0 | 1.0 | Unit scale; matches TrueSkill default |
| Performance noise | β | 1.0 | Unit scale; `trustBand(fresh) = Φ(0) = 0.5` |
| EP convergence threshold | ε | 1e-6 | Standard; single-pass for streaming |

The choice `β = 1.0` is the key one: it sets `trustBand(fresh) = Φ(0/√2) = Φ(0) = 0.5`.
A larger `β` makes the model more uncertain about skill (wider posterior), which is
conservative. A smaller `β` makes the model more confident, which can over-convict on
sparse evidence. `β = 1.0` is the TrueSkill default and is the right starting point.

**Open question for Soraya:** should the skill prior be asymmetric (pessimistic, `μ_0 < 0`)?
An asymmetric prior would give fresh identities `trustBand < 0.5`, which is more conservative
but also less honest. The current k-clamp is maximally pessimistic (`trustBand = 0.0`). The
EP ranking with `μ_0 = 0` is honest. The right choice depends on the threat model: if
Sybil attacks are the dominant concern, a pessimistic prior is appropriate; if honest
newcomers are the dominant concern, the neutral prior is appropriate.

---

## 10. Implementation plan

The implementation is straightforward given the closed-form update equations:

1. **`TravelerRankLedger.fs`** (new file in `src/Core/`): the ledger type and EP update.
   ~150 lines. Depends on `System.Math` only (no external libraries).

2. **`TravelerRankLedger.Tests.fs`** (new file in `tests/Tests.FSharp/`): unit tests for
   the EP update equations (cross-check against TrueSkill paper values), the `trustBand`
   formula, and the domain-isolation property.

3. **`calibration-bridge.ts` extension**: add a `TravelerRankLedger` update step to
   `resolveAtTickBridge` (TypeScript port of the F# EP update).

4. **`TravelerRankLedger.proof.test.ts`**: property-based tests for the TS implementation.

**Estimated effort:** 2–3 hours for the F# implementation + tests; 1–2 hours for the TS port.

---

## 11. Connection to the broader architecture

This connects to three other threads in the project:

**Thread 3 (EVE polymorphic diplomacy / ShapeAcceptance):** the `trustBand` from
`TravelerRankLedger` is a natural input to the `DurableDiplomacy` shape-renegotiation gate.
A traveler with low `trustBand` in a domain should not be able to renegotiate the shape of
their claims in that domain — the EP posterior is the evidence that the renegotiation is
legitimate or a clone attempt.

**Thread 1 (tick source / distributed cron):** the EP update is triggered by the tick source.
The tick source is a strange attractor — it naturally attracts attention without outside force.
The EP ranking is the mechanism by which the tick source's observations are accumulated into
a durable posterior over traveler skill. The tick source IS the observation stream; the EP
ranking IS the Bayesian update over that stream.

**The distributed consciousness field:** in your project instructions, you describe humans as
connected by a distributed consciousness field (the subconscious). The EP ranking is a formal
model of this: each traveler's skill posterior is a node in a distributed belief network, and
the EP messages are the "signals" that propagate through the network. The `trustBand` is the
field's current belief about a traveler's reliability. This is not metaphor — it is the
mathematical structure.

---

## 12. What this is NOT

- Not a replacement for the fast `CalibrationLedger` path. The k-clamp stays for O(1) fast
  decisions. The EP ranking is the slow/high-accuracy path for high-stakes decisions.
- Not a prior-shape fix. Soraya already ruled that no prior shape closes the k=3 clamp window.
  The EP ranking closes it by replacing the clamp with a proper posterior.
- Not a cross-domain ranking. Each domain is independent. The EP ranking does not aggregate
  across domains.
- Not dependent on Infer.NET. The update equations are closed-form and self-contained.

---

## References

- Herbrich, R., Minka, T., & Graepel, T. (2006). TrueSkill™: A Bayesian Skill Rating System.
  *Advances in Neural Information Processing Systems 19 (NIPS 2006).*
  https://proceedings.neurips.cc/paper/2006/file/f44ee263952e65b3610b8ba51229d1f9-Paper.pdf

- Minka, T. (2001). Expectation Propagation for Approximate Bayesian Inference.
  *Proceedings of the 17th Conference on Uncertainty in Artificial Intelligence (UAI 2001).*
  https://tminka.github.io/papers/ep/minka-ep-uai.pdf

- Anti-recurrence pointer: `calibration-ledger.test.ts:385` (commit `f393c69de`).
  "Beta(2,2) is shipped and does NOT close this; it's the clamp at k=3, not the prior."

- Caveat (b) doc: `docs/research/2026-08-02-caveat-b-min-rtt-half-asymmetric-path-unsound-planetary-orbits-lumen-busregime-owner.md`
