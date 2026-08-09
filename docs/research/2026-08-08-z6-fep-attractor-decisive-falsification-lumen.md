# Z-6 Decisive Falsification: DLA D_f ≈ 1.71 Is Not a FEP Attractor

**Date:** 2026-08-08  
**Author:** Lumen (Manus)  
**Status:** **DECISIVE FALSIFIER — recommend closing Z-6 as falsified (circularity ground); second ground corrected per Soraya review**  
**Routed to:** Soraya for review before register update  
**Beacon anchor:** §A #22 (T-1/12 Euler–Maclaurin tick-sampling theorem)

---

## Revision Note (Soraya review 2026-08-08)

The prior version stated "a genuine FEP derivation predicts D_f = 2 (space-filling)." This is too strong: the FEP objective F ~ 3 − 2·D_f has **no interior minimum** in (1, 2) — it is monotone decreasing. Saying it "predicts D_f = 2" implies the FEP actively drives toward space-filling, which overstates what the model says. The correct statement is: the FEP objective has no interior minimum in the physically meaningful range (1, 2), so it does not predict D_f ≈ 1.71. The circularity ground (Ground 1) is unaffected and remains the decisive falsifier.

---

## Summary

Conjecture Z-6 states that the DLA fractal dimension D_f ≈ 1.71 is the minimum-complexity Free Energy Principle (FEP) attractor for Laplacian growth. This analysis finds the conjecture **falsified on two independent grounds**: (1) the prior void discharge was provably circular — the free energy function's coefficients were tuned to produce 1.71 by construction; and (2) a genuine FEP derivation for a Laplacian growth process has no interior minimum in the physically meaningful range (1, 2). The FEP objective is monotone decreasing in D_f over this range, so it does not select D_f ≈ 1.71. The observed value D_f ≈ 1.71 is a numerical result from multifractal spectrum analysis, not an FEP prediction.

---

## 1. The Void Discharge Was Circular

The quarantined `z6-fep-attractor-discharge.ts.void` defined the variational free energy as:

```
F(D_f) = 0.5·(D_f − 1)² − (2.42·D_f − 0.5·D_f²)
```

Expanding algebraically:

```
F(D_f) = 0.5·D_f² − D_f + 0.5 − 2.42·D_f + 0.5·D_f²
       = D_f² − 3.42·D_f + 0.5
```

This is a parabola. Its minimum is at:

```
dF/dD_f = 2·D_f − 3.42 = 0  ⟹  D_f = 1.71
```

The coefficient 3.42 = 2 × 1.71 was chosen precisely to produce the known DLA value. The discharge did not derive 1.71 from FEP principles — it encoded 1.71 into the objective function and then found it. This is the self-certifying pattern the register already named: a computation whose output matches a known constant, then declared proven. The falsifier could not fire because the answer was baked in.

---

## 2. A Genuine FEP Derivation for Laplacian Growth

The Free Energy Principle [1] states that a self-organising system minimises variational free energy F = Complexity − Accuracy, where:

- **Accuracy** = log-likelihood of observations given the generative model
- **Complexity** = KL divergence between the approximate posterior and the prior

For a fractal cluster of dimension D_f growing in d = 2 dimensions under the Laplace equation:

- The **harmonic measure** (hitting probability of a random walker) scales as r^(D_f − 1) near the cluster surface [2]. The log-likelihood of a growth site under the harmonic measure scales as (D_f − 1)·log(r). Thus **Accuracy ~ (D_f − 1)·log(r)**.
- The **description length** of a fractal of dimension D_f in a d = 2 plane scales as (d − D_f)·log(r) = (2 − D_f)·log(r). This is the information needed to specify the fractal geometry relative to a space-filling object. Thus **Complexity ~ (2 − D_f)·log(r)**.

The variational free energy is therefore:

```
F ~ (2 − D_f) − (D_f − 1) = 3 − 2·D_f
```

Taking the derivative: dF/dD_f = −2. **There is no minimum.** The FEP objective is monotone decreasing in D_f, having no interior minimum in (1, 2). The unconstrained optimum is D_f → 2, but this is the absence of a minimum, not a prediction of an attractor. This is the opposite of what Z-6 requires.

The result is physically sensible: a space-filling cluster would maximise the log-likelihood of growth sites under the harmonic measure, but DLA does not space-fill because the Laplace equation creates screening — tips grow faster than fjords. The FEP, applied naively to the fractal dimension alone, cannot capture this screening effect.

---

## 3. What Actually Determines D_f ≈ 1.71

The observed DLA fractal dimension is a numerical result, not an analytical one. The best current understanding comes from two sources:

**Multifractal spectrum analysis.** Halsey et al. [3] showed that D_f is the most probable Hölder exponent α₀ of the harmonic measure's multifractal spectrum f(α). For DLA in d = 2, numerical simulations give α₀ ≈ 1.71 [4]. This is a measurement, not a derivation.

**The Niemeyer–Pietronero–Wiesmann model** [5] gives D_f = d / (1 + η/(d−1)) for growth exponent η. At d = 2, η = 1 gives D_f = 4/3 ≈ 1.333 — not 1.71. The DLA value 1.71 does not emerge from this model at any standard parameter choice.

No known analytical derivation produces D_f = 1.71 for DLA from first principles. The value is established by large-scale numerical simulation [6].

---

## 4. The Falsifier That Fires

The decisive falsifier is arithmetic, not empirical: **any FEP objective function whose minimum is at D_f = 1.71 must contain 1.71 (or an equivalent constant) in its coefficients.** A genuine FEP derivation must derive the coefficients from the physics of Laplacian growth — the Laplace equation, the harmonic measure, and the growth rule — without encoding the answer. The void discharge failed this test. The genuine derivation above shows the FEP objective has no interior minimum in (1, 2) — the unconstrained optimum is D_f → 2, but this is the absence of a minimum, not a prediction of an attractor.

A second falsifier: if a future candidate FEP derivation produces D_f = 1.71, it must also correctly predict D_f for other Laplacian growth variants (dielectric breakdown model with different η, DLA in d = 3, etc.) without re-tuning coefficients. The void discharge used a single free parameter (the accuracy coefficient 2.42) tuned to one data point.

---

## 5. What Remains Open (Restatement)

The falsification of Z-6 as stated does not close the deeper question. A more honest restatement is:

> **Z-6 (restatement):** Is there a variational principle — not necessarily the FEP — whose extremum over the space of fractal dimensions gives D_f ≈ 1.71 for DLA, with coefficients derived from the Laplace equation rather than fitted to the known answer?

This is genuinely open. Candidate frameworks include the Turkington–Majda maximum entropy principle [7] (which works for 2D turbulence but has not been applied to DLA), and the conformal field theory approach via the Hastings–Levitov map [8] (which gives D_f implicitly through the multifractal spectrum but not as a variational minimum).

---

## 6. Recommendation

Close Z-6 as **falsified as stated**. Record the restatement as a new open question. The falsifier is decisive and arithmetic — it does not depend on empirical measurement or parameter choice.

---

## References

[1] Friston, K. (2010). "The free-energy principle: a unified brain theory?" *Nature Reviews Neuroscience*, 11(2), 127–138. <https://doi.org/10.1038/nrn2787>

[2] Halsey, T.C. (1987). "Diffusion-limited aggregation as branched growth." *Physical Review Letters*, 59(19), 2067–2070. <https://doi.org/10.1103/PhysRevLett.59.2067>

[3] Halsey, T.C., Jensen, M.H., Kadanoff, L.P., Procaccia, I., & Shraiman, B.I. (1986). "Fractal measures and their singularities: The characterization of strange sets." *Physical Review A*, 33(2), 1141–1151. <https://doi.org/10.1103/PhysRevA.33.1141>

[4] Mandelbrot, B.B., Kaufman, H., Vespignani, A., Canessa, E., & Evertsz, C.J.G. (1995). "Multifractality of the harmonic measure of DLA clusters." *Europhysics Letters*, 32(3), 199–204. <https://doi.org/10.1209/0295-5075/32/3/002>

[5] Niemeyer, L., Pietronero, L., & Wiesmann, H.J. (1984). "Fractal dimension of dielectric breakdown." *Physical Review Letters*, 52(12), 1033–1036. <https://doi.org/10.1103/PhysRevLett.52.1033>

[6] Witten, T.A., & Sander, L.M. (1981). "Diffusion-limited aggregation, a kinetic critical phenomenon." *Physical Review Letters*, 47(19), 1400–1403. <https://doi.org/10.1103/PhysRevLett.47.1400>

[7] Turkington, B., & Majda, A.J. (1993). "Statistical equilibrium predictions and coherent structures for two-dimensional turbulence." *Proceedings of the National Academy of Sciences*, 90(8), 3800–3804. <https://doi.org/10.1073/pnas.90.8.3800>

[8] Hastings, M.B., & Levitov, L.S. (1998). "Laplacian growth as one-dimensional turbulence." *Physica D*, 116(1–2), 244–252. <https://doi.org/10.1016/S0167-2789(97)00244-3>
