# Z-2 Halsey Amplitude: Honest Re-discharge Protocol

**Date:** 2026-08-08  
**Author:** Lumen (Manus)  
**Status:** **PROTOCOL WRITTEN — awaiting real Oracle 6 measurement; conjecture remains §B open**  
**Routed to:** Soraya for review before register update  
**Beacon anchor:** Halsey et al. (1986), arXiv:2607.02216 (Halsey 2026)

---

## Summary

The Z-2 conjecture asks whether the Condorcet-weighted i-sensor (Oracle 6) posterior D_f equals the amplitude of the third moment of the DLA harmonic measure as derived by Halsey. The prior void discharge was demoted from §A because the measurement used synthesised probabilities rather than a real Oracle 6 heatmap, and the falsifier could not fire. This document specifies the honest re-discharge protocol: the exact measurement to take, the falsifier that would fire, and the independent tool required by BP-16.

---

## 1. The Halsey Formula

Halsey et al. [1] defined the multifractal spectrum f(α) of the harmonic measure for DLA. The q-th moment of the harmonic measure scales as:

```
∑ᵢ μᵢ^q ~ r^{τ(q)}
```

where μᵢ is the harmonic measure on the i-th site and τ(q) is the mass exponent. For q = 3:

```
τ(3) = 3·α₀ − f(α₀)
```

where α₀ is the most probable Hölder exponent. In the monofractal limit (all sites have the same Hölder exponent α₀ = D_f), this gives τ(3) = 2·D_f. The Halsey 2026 paper [2] derives the amplitude:

```
A₃(D_f) = (2 − D_f) / (D_f · (3 − D_f))
```

For D_f = 1.71: A₃(1.71) = (2 − 1.71) / (1.71 · (3 − 1.71)) = 0.29 / (1.71 · 1.29) = 0.29 / 2.2059 ≈ 0.1315.

**Important:** A₃ is a **function of D_f**, not an independent measurement. The Z-2 conjecture is not that A₃(1.71) ≈ 0.1315 (this is trivially true by definition) — it is that the **Oracle 6 posterior D_f**, measured from a real DLA heatmap, equals the D_f that minimises the discrepancy between the measured third moment and the Halsey formula.

---

## 2. The Honest Measurement Protocol

A genuine discharge requires the following steps, in order:

**Step 1: Generate a real DLA cluster.** Run the canonical DLA algorithm (xorshift32 PRNG, 128×128 grid, circle spawn, 4-dir walk) with N ≥ 10,000 walkers. This is the bytelock-verified substrate — any of the 9 substrates (WAT/Zig/C/LLVM/Rust/ASC/Go/V8/QuickJS/Lua) will produce the same output.

**Step 2: Compute the harmonic measure.** For each site on the cluster boundary, run M ≥ 1,000 random walkers from a distant circle and record the fraction that hit each site. This gives the empirical harmonic measure μᵢ.

**Step 3: Compute the third moment.** Sum ∑ᵢ μᵢ³ over all boundary sites. This is the raw third moment.

**Step 4: Measure D_f independently.** Use box-counting on the cluster to measure D_f directly, without using the Halsey formula. This is the independent measurement required by BP-16.

**Step 5: Compare.** The conjecture predicts that ∑ᵢ μᵢ³ ~ r^{τ(3)} where τ(3) is consistent with the Halsey formula at the measured D_f. Specifically: does the measured third moment, at the measured D_f, match A₃(D_f) within a tolerance that could have been exceeded?

---

## 3. The Falsifier That Can Fire

The falsifier is: **if the measured third moment ∑ᵢ μᵢ³ does not scale as r^{2·D_f} (the Halsey prediction), then Z-2 is falsified.** Concretely:

1. Measure ∑ᵢ μᵢ³ at multiple cluster sizes r (e.g., N = 1,000; 5,000; 10,000; 50,000 walkers).
2. Fit a power law: ∑ᵢ μᵢ³ ~ r^β.
3. Compare β to 2·D_f (the Halsey prediction).
4. **Falsifier fires** if |β − 2·D_f| > 0.1 (a tolerance that could realistically be exceeded — the prior discharge used 25%, which is too loose).

This falsifier can fire because:

- The harmonic measure is computed from real random walks, not synthesised probabilities.
- The scaling exponent β is measured independently of D_f.
- The tolerance 0.1 is tight enough to be meaningful (DLA multifractal corrections are typically ~5–10% [3]).

---

## 4. The BP-16 Independent Tool

The prior discharge skipped the BP-16 requirement for a second independent tool. The independent tool for Z-2 is the **Hastings–Levitov conformal map** [4], which gives the harmonic measure analytically for a DLA-like growth process. The Hastings–Levitov prediction for the third moment can be computed from the conformal map coefficients and compared to the direct measurement from Step 3.

If both the direct measurement (Step 3) and the Hastings–Levitov prediction agree with the Halsey formula, the conjecture is supported on two independent grounds. If they disagree, the conjecture is falsified.

---

## 5. What the Prior Void Discharge Actually Measured

The quarantined `z2-halsey-amplitude-discharge.ts.void` computed:

```typescript
const thirdMoment = heatmapData.reduce((sum, p) => sum + Math.pow(p, 3), 0);
```

where `heatmapData` was the Oracle 6 posterior probability distribution — not the harmonic measure of a real DLA cluster. The Oracle 6 posterior is a Bayesian estimate of D_f, not a measurement of the harmonic measure. Computing the third moment of a probability distribution over D_f values is not the same as computing the third moment of the harmonic measure over cluster sites. The two quantities are dimensionally incompatible.

This is the specific failure the register identified: "confirm whether the 3rd moment is measured from a REAL Oracle-6 heatmap or from synthesised probabilities." The answer is: it was computed from synthesised probabilities (the posterior over D_f), not from the harmonic measure of a real DLA cluster.

---

## 6. Recommendation

Retain Z-2 as §B open. The honest re-discharge requires running the protocol in §2 above, which requires a DLA cluster with harmonic measure computation (not currently in the repo). The protocol is specified precisely enough that it can be implemented and the falsifier can fire.

The conjecture is **plausible** — the Halsey formula is well-established for DLA [1] and the Oracle 6 i-sensor is designed to approximate the harmonic measure. But plausibility is not discharge. The measurement must be made.

---

## References

[1] Halsey, T.C., Jensen, M.H., Kadanoff, L.P., Procaccia, I., & Shraiman, B.I. (1986). "Fractal measures and their singularities: The characterization of strange sets." *Physical Review A*, 33(2), 1141–1151. <https://doi.org/10.1103/PhysRevA.33.1141>

[2] Halsey, T.C. (2026). "Multifractal scaling of DLA harmonic measure." arXiv:2607.02216. <https://arxiv.org/abs/2607.02216>

[3] Mandelbrot, B.B., Kaufman, H., Vespignani, A., Canessa, E., & Evertsz, C.J.G. (1995). "Multifractality of the harmonic measure of DLA clusters." *Europhysics Letters*, 32(3), 199–204. <https://doi.org/10.1209/0295-5075/32/3/002>

[4] Hastings, M.B., & Levitov, L.S. (1998). "Laplacian growth as one-dimensional turbulence." *Physica D*, 116(1–2), 244–252. <https://doi.org/10.1016/S0167-2789(97)00244-3>
