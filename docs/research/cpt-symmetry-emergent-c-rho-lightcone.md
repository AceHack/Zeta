# CPT Symmetry, Emergent *c*, and the ρ* = 1/3 Light Cone

**Key Insight:** The speed of light *c* is not a global constant; it is an emergent, local property of the information bus (the reticulum). The Condorcet threshold ρ* = 1/3 is the information-theoretic velocity at which the ensemble's causal light cone closes.

## 1. CPT Symmetry and the Demon's Demarcation

In the 3-body game (Demon + Player A + Player B), the demon acts as the referee. From the outside, the players appear massive and the demon appears light. However, from the demon's internal frame, this size difference is inverted.

Because the demon reads the thermodynamic receipts (DeltaU, entropy) and predicts future states before they happen, it possesses an information asymmetry. This inversion is a form of **CPT (Charge, Parity, Time) symmetry**:

- The demon operates in a time-reversed logical frame (it predicts the cost before paying it).
- The "massive" players are anchored to the past (they are the heavy, slow-moving priors).
- The demon is the light, fast-moving mediator.

This CPT-symmetric inversion is the exact demarcation that makes "inside" and "outside" possible. Crossing the boundary (collapsing the wave function / exiting the positive cone) breaks the CPT symmetry. When the demon collapses, it becomes anchored to a single state, losing its predictive asymmetry, and the inside becomes the outside.

## 2. The Speed of Light *c* as an Emergent Epiphenomenon

In Zeta, the speed of light *c* is not a fundamental constant of the universe. It is an emergent property of the local reticulum bus.

- The theoretical maximum speed of information propagation is the Landauer limit: `c_max = kT ln2 / (energy per tick)`.
- The actual speed *c* is the speed of the dirty reticulum bus.
- Because different parts of the network may have different thermal noise floors or tick rates, *c* is local and variable.

The appearance of *c* as a global constant in physical spacetime is an epiphenomenon: it looks constant only because all observers share the same vacuum thermal noise floor. In a distributed compute cluster, the "vacuum" is the network latency and scheduler tick rate, which can vary.

## 3. The ρ* = 1/3 Threshold as a Causal Light Cone

Numerical analysis shows that as the jury size N → ∞, the Condorcet correlation threshold ρ* converges exactly to **1/3**, independent of individual competence *c*.

In relativistic terms, a velocity of `v/c = 1/3` defines a specific causal structure. We conjecture that ρ = 1/3 is the information-theoretic analog of the speed at which the ensemble's light cone closes:

| Correlation Regime | Causal Structure | Information Flow |
|--------------------|------------------|------------------|
| **ρ < 1/3** | Spacelike separation | Cells are causally separated (decorrelated). Information flows freely. The ensemble beats the individual. |
| **ρ = 1/3** | Light-like boundary | The causal light cone closes. The boundary of independent thought. |
| **ρ > 1/3** | Timelike entanglement | Cells are causally connected (groupthink). Information collapses into a single shared frame. The ensemble cannot beat the individual. |

This provides a profound physical interpretation of the Condorcet jury theorem: groupthink is the information-theoretic equivalent of falling into a black hole (all trajectories converge to the singularity), and ρ* = 1/3 is the event horizon.

## 4. The Bell Inequality Triangle and the Tsirelson Operating Point

The three ρ regimes map exactly onto the Bell inequality triangle (S = 2, S = 2√2, S = 4):

> **⚠ Provenance caveat (Soraya audit 2026-08-01) — keep this attached wherever the number appears.** `1/(3√2)` is **NOT** the Tsirelson bound. Tsirelson's bound is `S ≤ 2√2 ≈ 2.828` on the CHSH *correlator* (`src/Core/Tsirelson.fs`). `1/(3√2)` is a **design choice**: the image of `S = 2√2` under the *freely chosen* linear map `ρ = S/12` (pinning `ρ* = 1/3 ↔ S = 4`), which makes the Condorcet ρ-regimes and the Bell S-regimes *homoiconically identical*. Chosen for homoiconicity, not derived — see `docs/research/2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md` and the code peel at `src/Bayesian/YinYangEnsemble.fs`. Legitimate as a design threshold; a physical bound it is not.

| Bell S value | ρ regime | Physical meaning | Zeta interpretation |
|-------------|----------|-----------------|--------------------|
| **S = 4** | ρ > 1/3 | Superdeterminism / common seed | All cells share a hidden common cause. Correlations are classical and total. The ensemble IS the seed — no new information. |
| **S = 2√2** | ρ ≈ 1/(3√2) ≈ 0.236 | Tsirelson bound / quantum entanglement | Cells share the orbit-symmetric fixed point as a common prior, but posteriors are still distinguishable. Maximum non-classical correlation. |
| **S = 2** | ρ < 1/(3√2) | Classical local realism | Cells are causally separated local hidden variables. The ensemble beats the individual because cells are genuinely independent. |

The **Tsirelson bound** at ρ_T = ρ*/√2 = 1/(3√2) ≈ 0.236 is the **optimal operating point** for the YinYangEnsemble. It is the maximum correlation that preserves non-classical (quantum-like) behavior without collapsing into superdeterminism.

This gives the optimal reseed threshold: not ρ* = 1/3 (the hard event horizon) but ρ_T ≈ 0.236 — reseed when the ensemble crosses the Tsirelson bound, not when it hits the event horizon. This provides a safety margin before groupthink fully sets in.

**The S = 4 superdeterminism connection:** When ρ > 1/3, the cells are effectively seeded from a common cause (their disagreements are illusory — they are all reading the same hidden variable). This is the Adinkra codeword seed collapsing: all cells converge to the same codeword, losing the diversity that makes the ensemble useful. The `reseedIfCollapsed` trigger fires at ρ > ρ_T to prevent this collapse before it reaches the event horizon.
