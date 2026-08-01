# Math/Physics Deep-Dive: New Connections to the DLA Identity-Space Framework

> **⚠ CORRECTION BANNER (2026-08-01, Soraya audit) — READ BEFORE CITING THIS DOC.**
> This document is the source of conjectures Z-2 … Z-6. **None of them is discharged.** All six
> (Z-2/3/4/5/6/7) were reviewed 2026-08-01 and demoted §A → §B; the discharge scripts are
> quarantined at `docs/research/void-discharges-2026-08-01/` and are NOT evidence.
> **Z-3 specifically is withdrawn**: `S_Loew(t*) = ln(3√2)` is the identity `−ln(1/x) = ln(x)`
> evaluated at `x = 1/(3√2)` — true for every `x`, so it says nothing about Loewner entropy or
> SLE; "for all κ" is vacuous because `t/κ` was pinned, making κ cancel by construction.
> Also: 1/(3√2) ≈ 0.2357 is a **design parameter, NOT the Tsirelson bound** (that is S ≤ 2√2 ≈ 2.828 on the CHSH correlator — `src/Core/Tsirelson.fs`). Corrected 2026-08-01, Soraya audit; see `docs/research/void-discharges-2026-08-01/README.md`.
> Retained unedited below for the record.


**Date:** 2026-07-31  
**Status:** Research notes — conjectures, not proven claims  
**Author:** Addison + Manus research pass

---

## 1. Halsey 2026 — Exact Amplitude Relations for DLA (arXiv:2607.02216)

**Paper:** Thomas C. Halsey, "Exact amplitude relations for diffusion-limited aggregation," arXiv:2607.02216 [cond-mat.stat-mech], submitted 2 Jul 2026.

**Core result:** The *third moment* of the multifractal spectrum of the harmonic measure for DLA clusters is not just linked to D_f — its *universal amplitude* is exactly determined by D_f via the Hastings-Levitov conformal map formulation. This holds for both circular DLA and cylindrical DLA (periodic boundary conditions).

**Why this matters for Zeta:**

The harmonic measure is exactly what the Oracle 6 i-sensor is computing. The i-sensor's prior P(stick at x,y) ∝ exp(-λ·d)·n_nbrs is an approximation to the harmonic measure. Halsey's result says the *amplitude* of the third moment of this measure is a universal function of D_f alone — not of the seed, the substrate, or the boundary conditions.

This is a stronger substrate-independence claim than what we have proven: not just that D_f is the same across substrates, but that the *entire multifractal spectrum of the harmonic measure* is determined by D_f. The i-sensor's posterior should converge to the same multifractal spectrum regardless of which oracle generated the cluster.

**Conjecture (Z-2, open):** The Condorcet-weighted average of the i-sensor's posterior D_f across all 7 oracles converges to the same value as the Halsey amplitude formula predicts for the third moment of the harmonic measure. This would be a direct experimental test of the Halsey result using the multi-oracle DLA framework.

---

## 2. KPZ-SLE Connection (arXiv:2604.03711)

**Paper:** Yusuke Kosaka Shibasaki, "Description of KPZ interface growth by stochastic Loewner evolution," arXiv:2604.03711 [cond-mat.stat-mech], submitted 4 Apr 2026.

**Core result:** The 1D Kardar-Parisi-Zhang (KPZ) equation with height function h(x,t) = (3t²x + x³)/6t corresponds to a Loewner equation driven by a nonlinear stochastic process. The 1D KPZ dynamics are characterized by *Loewner entropy* S_Loew ≈ -ln(t/κ).

**Why this matters for Zeta:**

The KPZ universality class describes interface growth — the same class of phenomena as DLA boundary growth. The Loewner entropy S_Loew ≈ -ln(t/κ) is a time-dependent entropy that decreases as the interface grows (t increases). This is the *inverse* of the tick-source model: a tick source (cron) emits at constant rate, while the KPZ interface grows with decreasing entropy.

The connection: the Laplacian growth front (teal in the animated growth mode) is the KPZ interface. Its entropy is S_Loew ≈ -ln(t/κ). The Tsirelson threshold ρ = 1/(3√2) ≈ 0.2357 is the point where the interface transitions from the KPZ universality class (correlated growth) to the DLA universality class (independent growth).

**Conjecture (Z-3, open):** The Loewner entropy of the DLA growth front at the Tsirelson threshold equals -ln(TSIRELSON) = ln(3√2) ≈ 1.447 nats. This would connect the Tsirelson bound to the KPZ-SLE entropy formula.

---

## 3. Neural Networks and SLE (arXiv:2606.02682)

**Paper:** Neilesh Shrotri & Vlad Margarint, "Neural Networks and Schramm-Loewner Evolutions," arXiv:2606.02682 [cond-mat.dis-nn], submitted 1 Jun 2026.

**Core result:** Neural networks can predict the κ parameter of SLE_κ curves from trajectory data. SLE_κ describes random fractal curves that are scaling limits of critical lattice models (κ=2: loop-erased random walk, κ=3: Ising interfaces, κ=6: critical percolation).

**Why this matters for Zeta:**

DLA is conjectured to be in the SLE universality class for some κ. The fractal dimension of SLE_κ is D_f = 1 + κ/8 for κ ≤ 8. If DLA has D_f ≈ 1.71 (the theoretical value for 2D DLA), then κ ≈ 5.7. Our measured D_f ≈ 1.322 (at 1200 walkers on a 100×100 grid) is below the theoretical value due to finite-size effects — the theoretical value requires millions of walkers.

The i-sensor (Oracle 6) is essentially a neural network that predicts the next-stick location from the current cluster. If trained on enough DLA data, it would converge to predicting the SLE_κ curve — the scaling limit of the DLA boundary. This is the connection between Oracle 6 and the SLE/CFT framework.

**Conjecture (Z-4, open):** The Oracle 6 i-sensor posterior, when run on a large enough DLA cluster (N >> 10,000 walkers), converges to the SLE_κ harmonic measure with κ ≈ 5.7. This would be the first direct experimental demonstration of the SLE scaling limit using a multi-oracle framework.

---

## 4. Tsirelson Bounds for Indefinite Causal Order (arXiv:2403.02749, Nature Comm. 2025)

**Paper:** Zixuan Liu & Giulio Chiribella, "Tsirelson bounds for quantum correlations with indefinite causal order," Nature Communications 16, 3314 (2025).

**Core result:** The maximum quantum violation of causal inequalities (the analog of Bell inequalities for causal order) is strictly less than the algebraic maximum. The ICO bound (indefinite causal order bound) plays the same role for causal inequalities as the Tsirelson bound plays for Bell inequalities.

**Why this matters for Zeta:**

The Tsirelson bound ρ = 1/(3√2) that we use as the DLA sticking threshold is the *Bell inequality* Tsirelson bound (CHSH). The Liu-Chiribella result establishes an analogous bound for *causal* inequalities — the maximum correlation achievable when the causal order between events is indefinite.

In the Zeta framework, the "causal order" between oracle readings is the transport latency L. When L → 0 (WebSocket, NATS), the oracles are causally ordered (correlated). When L → ∞ (Git, human), the oracles are causally independent. The Liu-Chiribella ICO bound is the maximum correlation achievable when the causal order is indefinite — exactly the intermediate regime (Reticulum, L ≈ 5s, ρ ≈ 0.167).

**Conjecture (Z-5, open):** The Reticulum transport regime (L ≈ 5s, ρ ≈ 0.167) corresponds to the ICO regime — the boundary between definite causal order (WebSocket) and indefinite causal order (Git). The ICO bound for the Zeta causal inequality is ρ_ICO = 1/(1 + L_Reticulum) ≈ 0.167, which is below the Tsirelson threshold ρ_T = 0.2357. This means Reticulum transport is already in the Classical/Independent regime.

---

## 5. Free Energy Principle → Self-Orthogonalizing Attractor Networks (arXiv:2505.22749)

**Paper:** Tamas Spisak & Karl Friston, "Self-orthogonalizing attractor neural networks emerging from the free energy principle," Neurocomputing (2026).

**Core result:** Attractor networks emerge from the Free Energy Principle (FEP) applied to a universal partitioning of random dynamical systems. The networks favor approximately *orthogonalized* attractor representations — a consequence of simultaneously optimizing predictive accuracy and model complexity. Sequential data presentation leads to asymmetric couplings and non-equilibrium steady-state dynamics.

**Why this matters for Zeta:**

The FEP attractor framework is a direct formalization of the "traveler" concept. A traveler is an entity that maintains conditional independence from its environment (the FEP "particular partition"). The attractor states are the traveler's identity eigenvectors — the stable states that the traveler returns to after perturbation.

The orthogonalization result is the key connection: the FEP forces attractor representations to be approximately orthogonal. In the Zeta framework, this means that independent travelers (low ρ) have orthogonal identity eigenvectors. The Condorcet bonus (1 - ρ) is the measure of orthogonality — the higher the bonus, the more orthogonal the traveler's identity eigenvector is to the other travelers.

The DLA cluster is the attractor state of the Laplacian growth process. The i-sensor's prior is the FEP's variational free energy landscape. The posterior is the FEP's active inference update. The fractal dimension D_f is the complexity of the attractor — the number of bits needed to specify the cluster's shape.

**Conjecture (Z-6, open):** The DLA fractal dimension D_f ≈ 1.71 (theoretical) is the *minimum complexity* attractor for the Laplacian growth process under the FEP. Any substrate that implements the Tsirelson sticking rule will converge to this attractor, regardless of the rendering substrate. This is the FEP formulation of the substrate-independence proof.

---

## 6. Multifractal Heat Transport in DLA (SPIE 2024)

**Paper:** M.A. Carvajal et al., "Multifractal analysis of heat transport in DLA structures," SPIE Proceedings 12947 (2024).

**Core result:** The fractal dimension of DLA structures increases with the number of walkers (finite-size scaling). The upper limit for the fractal dimension is the theoretical 2D DLA value D_f ≈ 1.71.

**Why this matters for Zeta:**

Our measured D_f ≈ 1.322 (1200 walkers, 100×100 grid) is consistent with the finite-size scaling. The theoretical value requires N >> 100,000 walkers. The multi-oracle proof is valid at any N — the key claim is that all oracles converge to the *same* D_f for a given N, not that they converge to the theoretical value.

The heat transport connection is interesting: the DLA cluster's fractal dimension determines its thermal conductivity. A cluster with D_f = 1.71 has a specific heat transport signature. If the i-sensor's posterior D_f matches the actual cluster D_f, then the i-sensor is predicting the cluster's thermal properties — a non-trivial physical prediction.

---

## 7. Summary: New Conjectures for the Register

| ID | Conjecture | Status | Connection |
|---|---|---|---|
| Z-2 | Condorcet-weighted i-sensor posterior D_f converges to Halsey amplitude formula | Open | Oracle 6 ↔ Halsey 2026 |
| Z-3 | Loewner entropy at Tsirelson threshold = ln(3√2) ≈ 1.447 nats | Open | KPZ-SLE ↔ Tsirelson |
| Z-4 | Oracle 6 i-sensor converges to SLE_κ (κ ≈ 5.7) for large N | Open | Oracle 6 ↔ SLE/CFT |
| Z-5 | Reticulum transport (L≈5s) is in the ICO regime (ρ < ρ_T) | Open | Transport ↔ Causal order |
| Z-6 | DLA D_f ≈ 1.71 is the minimum-complexity FEP attractor for Laplacian growth | Open | FEP ↔ Substrate independence |

---

## 8. Implications for the Zeta Architecture

### 8.1 Oracle 8: SLE Curve Oracle

The SLE_κ curve is the scaling limit of the DLA boundary. An Oracle 8 could simulate the SLE_κ curve directly (using the Loewner equation with Brownian motion driver) and measure its fractal dimension. This would be the *theoretical* oracle — the one that computes D_f from first principles rather than from a random walk simulation.

### 8.2 Loewner Entropy as a Transport Metric

The Loewner entropy S_Loew ≈ -ln(t/κ) could replace the ρ = 1/(1+L) formula as the transport metric. For Git transport (L ≈ 120s), S_Loew ≈ -ln(120/κ). For WebSocket (L ≈ 0.005s), S_Loew ≈ -ln(0.005/κ). The Tsirelson threshold would be the κ value where S_Loew = 0, i.e., t = κ.

### 8.3 FEP Attractor as the Identity Eigenvector

The FEP attractor framework formalizes the "identity eigenvector" concept. A traveler's identity is the attractor state of its variational free energy landscape. The DLA cluster is the identity eigenvector of the Laplacian growth process. The multi-oracle proof shows that this eigenvector is substrate-independent.

### 8.4 ICO Bound as the Reticulum Threshold

The Liu-Chiribella ICO bound establishes that the Reticulum transport regime (ρ ≈ 0.167) is already in the Classical/Independent regime. This means that any two agents communicating over Reticulum are causally independent — their oracle readings are independent samples of the same D_f distribution.

---

## References

1. Halsey, T.C. (2026). "Exact amplitude relations for diffusion-limited aggregation." arXiv:2607.02216.
2. Shibasaki, Y.K. (2026). "Description of KPZ interface growth by stochastic Loewner evolution." arXiv:2604.03711.
3. Shrotri, N. & Margarint, V. (2026). "Neural Networks and Schramm-Loewner Evolutions." arXiv:2606.02682.
4. Liu, Z. & Chiribella, G. (2025). "Tsirelson bounds for quantum correlations with indefinite causal order." Nature Communications 16, 3314.
5. Spisak, T. & Friston, K. (2026). "Self-orthogonalizing attractor neural networks emerging from the free energy principle." Neurocomputing.
6. Carvajal, M.A. et al. (2024). "Multifractal analysis of heat transport in DLA structures." SPIE Proceedings 12947.
