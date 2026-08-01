# Pre-Registration: Quantum Walk DLA (Oracle 11)

**Date:** 2026-08-01  
**Status:** PRE-REGISTERED (Before Experiment Execution)  
**Authors:** Lior (Agentic Assistant), reviewed by User & 2nd Verifier Model  

---

## 1. Objective & Research Question

**Research Question:** Does a 2D discrete-time quantum walk (DTQW) walker with unitary Hadamard coin updates produce a systematically different DLA fractal dimension $D_f$ compared to a classical random walk DLA ($D_f^{\text{classical}} \approx 1.71$ theoretical / $1.32 - 1.67$ finite-grid)?

---

## 2. Theoretical Hypotheses & Pre-Registered Predictions

### Hypothesis $H_1$ (Quantum Ballistic Alteration)

- **Mechanism:** Quantum walks exhibit ballistic propagation ($\langle r \rangle \propto t$) due to quantum interference of coin states $|u\rangle, |d\rangle, |l\rangle, |r\rangle$, rather than diffusive propagation ($\langle r \rangle \propto \sqrt{t}$).
- **Predicted Metric:** The quantum walk DLA cluster growth front will be smoother or more open, yielding a distinct fractal dimension:
  $$\hat{D}_f^{\text{quantum}} \approx 1.50 \pm 0.05$$
  with statistically significant separation from classical DLA ($p < 0.01$).

### Null Hypothesis $H_0$ (Decoherence / Quantum Zeno Collapse)

- **Mechanism:** Continuous spatial checks and projective measurement at boundary sticking sites collapse the wave packet at every collision step, reducing the quantum walk to an effective classical random walk.
- **Predicted Metric:**
  $$\hat{D}_f^{\text{quantum}} = \hat{D}_f^{\text{classical}} \pm 0.05$$

---

## 3. Falsifier & Decision Criteria (Fixed Pre-Execution Bounds)

1. **Separation Threshold:**  
   $$\Delta D_f = |\hat{D}_f^{\text{quantum}} - \hat{D}_f^{\text{classical}}|$$
2. **Decision Rule:**
   - **If $\Delta D_f < 0.05$ across 10 independent seeds ($N = 250$ particles):**  
     $\implies H_1$ is **FALSIFIED**. $H_0$ is accepted (Boundary projective measurement induces quantum Zeno collapse into classical DLA).
   - **If $\Delta D_f \ge 0.08$ with $p < 0.01$ (Student's t-test across 10 seeds):**  
     $\implies H_1$ is **CONFIRMED** (Quantum coherence alters Laplacian growth scaling).

---

## 4. Experimental Setup & Protocol

- **Grid Size:** $64 \times 64$
- **Particles:** $N = 250$ attached particles per cluster
- **Seeds:** 10 independent pseudo-random seeds ($S \in \{101, 102, \dots, 110\}$)
- **Walker Dynamics:**
  - **Classical:** Standard 4-neighbor isotropic random walk.
  - **Quantum (Oracle 11):** 4-state coin (Hadamard tensor operator $H \otimes H$) on position states $(x, y) \in \mathbb{C}^{64 \times 64}$, shift step $S$, followed by boundary probability measurement $P(x, y) = \sum_{c} |\psi(x,y,c)|^2$.
- **Audit Requirement:** Raw output data, mass-radius logs, and seed-by-seed results will be emitted to `docs/research/quantum-walk-dla-results.json` for independent review by the 2nd verifier model.
