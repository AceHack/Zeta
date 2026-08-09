# Halsey 2026 (arXiv:2607.02216) — Connection to Z-2 and the HL Amplitude Test

**Author:** Lumen (Manus AI)  
**Date:** 2026-08-09  
**Status:** Research note — verified citation, §B conjecture update  
**Beacon anchors:** §A #22 (T-1/12 Euler-Maclaurin), §B Z-2 (Halsey amplitude formula)

---

## 1. The Paper

Thomas C. Halsey, "Exact amplitude relations for diffusion-limited aggregation," arXiv:2607.02216v1 [cond-mat.stat-mech], July 3 2026. Dept. of Chemical and Biomolecular Engineering, Rice University.

**Citation status:** VERIFIED. This is a real paper. The earlier "UNVERIFIED" flag in `z2-halsey-redischarge.ts` was incorrect and has been removed.

---

## 2. What the Paper Proves

### 2.1 The τ(3) = D scaling law (known since 1987)

The starting point is the capacity scaling argument of Halsey (1987, 1988) [^halsey87] [^halsey88]. The growth rate of the cluster radius R with particle count n satisfies:

```
d log R / d log n = 2πn f̄ Σᵢ pᵢ³ ~ n · (a/R)^τ(3)
```

Since `d log R / d log n = 1/D` by the fractal scaling `n ∝ R^D`, this immediately gives **τ(3) = D**. This is the scaling law — it constrains the exponent but not the amplitude of the third moment.

### 2.2 The HL amplitude relation (new in 2026)

The key new result (Eq. 15 of the paper) uses the Hastings-Levitov conformal map formulation [^hl98]. The capacity of the cluster is encoded in the Laurent coefficient g₁ ∝ R of the conformal map w(z). For the addition of one particle at angle θₙ with size parameter λₙ:

```
δ log R / δn = aλ₀ |dw_{n-1}/dz|^{-2}_{z=e^{iθₙ}} + O(λ₀²)
```

Averaging over the growth angle θ and using the fractal scaling `n ∝ R^D`:

```
aλ₀ ∫(dθ/2π) ⟨|dw_{n-1}/dz|^{-2}⟩ = 1/(Dn)    [Eq. 15]
```

**This is stronger than τ(3) = D.** It pins the *universal amplitude* of the third moment integral to `1/D`, not just the scaling exponent. The amplitude is universal because the HL formulation makes the conformal structure explicit — the parameter f̄ in the original argument, which seemed to depend on microscopic details, is now determined by the conformal map.

### 2.3 The cylindrical companion (Eq. 16)

For DLA in a cylinder of circumference L with periodic boundary conditions:

```
aλ₀ ∫(dθ/2π) ⟨|dv_{n-1}/du|^{-2}⟩ = dv^(0)/dn    [Eq. 16]
```

where v^(0) is the effective height of the growing interface. The cylindrical D ≈ 1.67 (consistent with literature), with a possible crossover to D ≈ 1.71 at very large cylinder widths (λ₀ ~ 10⁻⁶).

### 2.4 Numerical confirmation

100 HL clusters at n = 20,000 particles, λ₀ = 0.004, a = 2/3:

| Method | D estimate |
|---|---|
| Fit to ν(n) = A + Bn^{-ξ} | 1.703 ± 0.001 |
| Plateau average (10,000 < n < 20,000) | 1.710 ± 0.005 |
| Accepted value [^davidovitch00] | 1.713 ± 0.003 |

The plateau average is within one standard deviation of the accepted value.

---

## 3. Connection to Z-2

### 3.1 What Z-2 asks

The Z-2 conjecture in our register asks: *Is the Condorcet-weighted i-sensor (Oracle 6) posterior D_f equal to the amplitude of the third moment of the DLA harmonic measure?*

The paper directly addresses the second part of this question — the amplitude of the third moment. The HL amplitude relation (Eq. 15) gives the exact universal amplitude: `1/(Dn)`.

### 3.2 The two-level structure

The paper reveals that Z-2 has a two-level structure:

| Level | Claim | Status |
|---|---|---|
| Scaling | τ(3) = D | Supported by Halsey 1987, 1988, and this paper |
| Amplitude | `aλ₀ ∫|w'|^{-2} dθ/2π = 1/(Dn)` | New result, Halsey 2026 |

Our `z2-halsey-redischarge.ts` module tests the scaling level. The amplitude level requires implementing the HL conformal map — a significantly more complex computation (O(n²) per cluster).

### 3.3 The honest falsifier at each level

**Scaling falsifier (already in the module):** `|β − τ(3)| > 0.1` where β is the measured third-moment scaling exponent and τ(3) is from the measured f(α) spectrum. This can fire.

**Amplitude falsifier (new, from the paper):** For a cluster of n particles with the HL conformal map, measure `ν(n) = aλ₀n ∫|w'|^{-2} dθ/2π`. Fit to `ν(n) = A + Bn^{-ξ}`. The falsifier fires if `|1/A − D_measured| > 0.01` (tight, because the HL method directly measures D from the amplitude). This is the stronger test.

### 3.4 What the paper does NOT resolve

The paper does not address the first part of the Z-2 question: whether the *Condorcet-weighted i-sensor posterior* D_f matches the harmonic measure amplitude. That connection — between our Oracle 6 inference and the HL amplitude — remains the genuinely open part of Z-2.

---

## 4. Implementation Plan

### 4.1 Short term (already done in this session)

The scaling-level falsifier is implemented in `z2-halsey-redischarge.ts`. The UNVERIFIED flag has been removed. The module uses the multifractal τ(3) (not the monofractal limit 2·D_f), which is the correct null for the scaling test.

### 4.2 Medium term (HL amplitude test)

Implement the HL conformal map in TypeScript:

```typescript
// HL bump function: f_{λ,θ}(z) = e^{iθ} f_bump(e^{-iθ}z)
// f_bump(z) = z^{1-a} * [1 + λ²z/(z+1) * ...]^a
// with a = 2/3 (Davidovitch et al. 1999 recommendation)
```

This is O(n²) per cluster — feasible for n ≤ 5,000 on a single machine, expensive for n = 20,000. The amplitude test `ν(n) → 1/(Dn)` is the strongest available falsifier for Z-2.

### 4.3 Long term (Oracle 6 connection)

The genuinely open part of Z-2: does the Condorcet-weighted i-sensor posterior D_f (Oracle 6) converge to the same value as the HL amplitude estimate? This requires running both measurements on the same cluster and comparing. If they agree, Z-2 is supported. If they disagree, Z-2 is falsified.

---

## 5. Strong fluctuations note

The paper explicitly notes "quite strong fluctuations, seen both in the fractal dimension and in the growth measure moment, for moderate-sized clusters, especially in the circular geometry." This is relevant to our `z2-halsey-redischarge.ts` module, which uses small clusters (N ≤ 500 walkers). The current INCONCLUSIVE result for small clusters is expected — the measurement needs N ≥ 5,000 walkers and N_probes ≥ 2,000 for a statistically reliable result.

---

## References

[^halsey87]: T. C. Halsey, "Some consequences of an equation of motion for diffusive growth," Phys. Rev. Lett. 59, 2067 (1987).  
[^halsey88]: T. C. Halsey, "Scaling laws for diffusive growth," Phys. Rev. A 38, 4789 (1988).  
[^hl98]: M. B. Hastings and L. S. Levitov, "Laplacian growth as one-dimensional turbulence," Physica D 116, 244 (1998).  
[^davidovitch00]: B. Davidovitch, A. Levermann, and I. Procaccia, "Convergent calculation of the asymptotic dimension of diffusion limited aggregates," Phys. Rev. E 62, R5919 (2000).  
[^halsey2026]: T. C. Halsey, "Exact amplitude relations for diffusion-limited aggregation," arXiv:2607.02216v1 [cond-mat.stat-mech], July 3 2026.
