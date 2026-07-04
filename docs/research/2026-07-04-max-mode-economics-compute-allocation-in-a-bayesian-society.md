# Max Mode Economics: Compute Allocation in a Bayesian Society

**Date:** 2026-07-04
**Authors:** Aaron (19) + Lumen
**Status:** §B conjecture (grounded in proven primitives, not yet discharged as a system property)

---

## 1. The Core Problem

In a distributed society of agents (CTMs), compute is not free. Agents have access to different tiers of cognitive capability — from cheap, fast heuristics ("normal mode") to expensive, slow, deep-reasoning engines ("max mode"). The economic problem is resource allocation: **when should a node allocate expensive high-compute resources vs. cheap low-compute resources?**

If a node always uses max mode, it goes bankrupt burning energy on trivial problems. If a node always uses normal mode, it fails on complex problems and loses relevance in the society. The optimal strategy is neither "always cheap" nor "always expensive" — it is a **dynamic allocation** driven by the epistemic state of the system.

This document formalizes the decision boundary using the existing mathematical primitives of the Zeta architecture: the `IScheduler` budget, Information Value (IV), `SoftValue` distributions, and weight-based ephemeron GC.

---

## 2. The Cost Side: The bits ↔ time ↔ joules Currency

Compute cost is formalized in the `QuantumFusion.Budget` type (from `src/Bayesian/QuantumFusion.fs`):

```fsharp
type Budget =
    { Prior: Beta              // Bayesian prior (Beta distribution)
      BaseSpaceBytes: int64    // base memory cost
      TimeTicks: int           // time budget in ticks
      BytesPerTick: int64      // throughput budget
      ResolutionBits: int }    // precision budget
```

This is the bits↔time↔joules currency made concrete. Compute is metered in four dimensions:

| Dimension | Unit | Physical Meaning |
|---|---|---|
| **Space** | `BaseSpaceBytes` | Memory footprint — how much state the computation holds |
| **Time** | `TimeTicks` | Duration — how many scheduler ticks the computation runs |
| **Throughput** | `BytesPerTick` | Bandwidth — how much data flows per tick |
| **Precision** | `ResolutionBits` | Accuracy — how many bits of resolution the result carries |

By Landauer's principle, erasing one bit of information costs at minimum $kT \ln 2$ joules (approximately $2.8 \times 10^{-21}$ J at room temperature). The scheduler meters compute in bytes and ticks, which translates directly to energy. The `Budget` type is therefore a **joule budget** expressed in computational units.

**Max mode** = allocating a large `Budget` (high `TimeTicks`, high `ResolutionBits`).
**Normal mode** = allocating a small `Budget` (low `TimeTicks`, low `ResolutionBits`).

The difference is not qualitative — it is quantitative. Max mode is simply more joules spent on more ticks at higher resolution.

---

## 3. The Revenue Side: Information Value (IV)

Why spend compute? To buy information. The return on compute investment is measured in **Information Value (IV)**, formalized as the Kullback-Leibler divergence between the prior belief and the posterior belief:

$$IV = D_{KL}(P_{posterior} \parallel P_{prior})$$

Register Row 20 (proven via FsCheck, `InformationValue.Tests.fs` IV-1 through IV-7) establishes that IV:

1. Is strictly non-negative (you never lose information by observing).
2. Monotonically increases with **precision gain** (moving from a flat distribution to a sharp one).
3. Monotonically increases with **surprise** (mean shift — discovering the answer is far from the prior).
4. Amplifies with the **Reticulum Condorcet bonus** (decorrelated observations are worth more).

IV is the single denomination for the attention router, Thousand Brains column voting, and Web3 market clearing. It is the **revenue** of compute: you burn joules to buy KL divergence.

---

## 4. The Decision Boundary: ΔU = EIV − ΔJ

A rational CTM in the Zeta society makes compute allocation decisions based on expected profit (ΔU — useful work):

$$\Delta U = \text{Expected Information Value (EIV)} - \text{Compute Cost} (\Delta J)$$

**The Max Mode Rule:** Switch to max mode (allocate a large compute budget) **if and only if** the Expected Information Value of the deep reasoning exceeds the additional compute cost.

### 4.1 Scenario A: Trivial Problems (Normal Mode Wins)

If a problem is simple, a cheap normal-mode compute produces a posterior that is fully confident (`SoftValue.confidence ≈ 1.0`). Spending max mode on it yields zero additional IV because the posterior cannot get any sharper — KL divergence between two identical distributions is zero.

- $EIV_{max} \approx EIV_{normal}$ (both reach the same sharp posterior)
- $\Delta J_{max} \gg \Delta J_{normal}$ (max mode burns more joules)
- $\Delta U_{max} < \Delta U_{normal}$ → **Use normal mode.**

Example: answering "what is 2+2?" does not benefit from deep reasoning. The normal-mode posterior is already a point mass at 4.

### 4.2 Scenario B: Complex Problems (Max Mode Wins)

If a problem requires deep, multi-step dependent reasoning (e.g., the Adinkra Clifford inverse conjecture from earlier today), normal-mode compute produces a flat, low-confidence posterior (`SoftValue.confidence ≈ 0.3`). The system predicts that allocating a larger budget will yield a sharp posterior (high precision gain = high IV).

- $EIV_{max} \gg EIV_{normal}$ (max mode can reach a sharp posterior that normal mode cannot)
- $\Delta U_{max} > \Delta U_{normal}$ → **Use max mode.**

Example: proving that `gen(gen) = gen` in the [8,4] code is the correct formalization of minimal reflection requires holding a long chain of dependent reasoning. Normal mode loses threads mid-proof. Max mode maintains the full chain.

### 4.3 The Boundary Condition

The exact boundary is where $\Delta U_{max} = \Delta U_{normal}$:

$$EIV_{max} - \Delta J_{max} = EIV_{normal} - \Delta J_{normal}$$

Rearranging:

$$EIV_{max} - EIV_{normal} = \Delta J_{max} - \Delta J_{normal}$$

Switch to max mode when the **marginal information gain** (additional IV from max mode beyond what normal mode achieves) exceeds the **marginal compute cost** (additional joules max mode burns beyond normal mode).

---

## 5. The Allocation Mechanism: Attention Weight from the Posterior

In `QuantumFusion.fs`, the `VisionAttention.Proposal` takes an `Attention.Weight` that comes directly from the Bayesian posterior:

```fsharp
Attention = { Weight = Beta.mean posterior; ResolutionBits = budget.ResolutionBits }
```

This means **the math decides the allocation**. The system allocates budget proportionally to the posterior probability:

- **High confidence** (sharp posterior, `Beta.mean` close to 1) → high attention weight → large budget allocated to maintain and exploit the current state.
- **Low confidence** (flat posterior, `Beta.mean` close to 0.5) → low attention weight → budget allocated to *search* for a better state (explore, not exploit).

The attention weight is the posterior probability. The budget allocation is the posterior probability converted to joules. This is not a heuristic — it is a direct consequence of the Bayesian update rule applied to resource allocation.

---

## 6. Speculative Execution via SoftValue and Ephemeron GC

In practice, predicting EIV before running the computation is difficult. How does a node know a problem is complex before trying to solve it?

The answer comes from `SoftValue` and weight-based ephemerons (documented in the companion research note, §11):

### 6.1 The Speculative Execution Strategy

1. **Spawn a cheap normal-mode task first.** This is the "probe" — a fast, low-budget computation that produces an initial posterior.

2. **Evaluate the probe's confidence.** If `SoftValue.confidence(probe_result) ≥ threshold`, the problem is solved. The probe's fingerprint gets high weight in the `SoftValue` distribution.

3. **If confidence is low, spawn a max-mode task.** The low confidence of the probe is evidence that the problem is complex. The system allocates a larger budget.

4. **Ephemeron GC handles the economics.** If the probe succeeds (high weight), any concurrently-spawned max-mode task is reclaimed by the weight-based ephemeron GC before it burns its full budget. If the probe fails (low weight), the max-mode task is allowed to run to completion.

### 6.2 The Connection to SoftValue

The `SoftValue` distribution holds multiple competing answers simultaneously, each with a weight. The normal-mode answer and the max-mode answer are both fingerprints in the same `SoftValue`. The one with higher confidence (sharper posterior) gets higher weight. The GC reclaims the lower-weight answer's compiled artifacts (including the compute budget allocated to it).

This means:
- You do not have to predict in advance whether a problem needs max mode.
- You spawn the cheap probe first, and the epistemic state (the posterior confidence) tells you whether to escalate.
- The escalation is automatic — driven by the `SoftValue` weight distribution, not by a human decision.

---

## 7. The Thermodynamic Interpretation

The max mode decision boundary has a clean thermodynamic interpretation:

| Concept | Thermodynamic Analogue | Zeta Implementation |
|---|---|---|
| Compute cost (ΔJ) | Free energy consumed | `Budget.TimeTicks × Budget.BytesPerTick × kT ln 2` |
| Information Value (IV) | Entropy reduction | `KL(posterior ∥ prior)` |
| ΔU (useful work) | Gibbs free energy change | `IV − ΔJ` |
| Max mode threshold | Activation energy | The marginal cost at which deeper reasoning becomes profitable |
| SoftValue confidence | Temperature | Low confidence = high temperature (many microstates); high confidence = low temperature (few microstates) |
| Ephemeron GC | Dissipation | Reclaiming budget from low-weight states = releasing energy from improbable configurations |

The system is a **Maxwell's demon** that sorts compute allocation based on epistemic state. It does not violate the second law because the demon itself (the Bayesian update) costs compute (Landauer's principle applies to the update itself). The system is thermodynamically consistent: the cost of deciding where to allocate compute is itself part of the compute budget.

---

## 8. Practical Implications for the Distributed AI Network

For the physical network (NixOS + K3S + ArgoCD + Orleans/Temporal/Dapr + Hermes + Ollama/VLLM):

### 8.1 GPU Allocation

GPUs are the physical realization of "max mode." A GPU-hour is expensive. The system should allocate GPU time to tasks where the normal-mode (CPU-only) posterior is too flat — where the expected IV of GPU-accelerated inference exceeds the joule cost of the GPU-hour.

### 8.2 Model Selection

Different LLM models have different cost/capability profiles (the Futamura tower applied to models):
- Small models (7B parameters) = normal mode. Cheap, fast, good for trivial problems.
- Large models (70B+ parameters) = max mode. Expensive, slow, good for complex problems.

The `SoftValue` speculative execution strategy applies directly: run the small model first. If its confidence is high, done. If its confidence is low, escalate to the large model.

### 8.3 The Condorcet Bonus and Decorrelation

Register Row 19 (proven) shows that decorrelated agents produce more useful work than correlated ones. In the context of max mode economics: **running multiple cheap decorrelated probes may be more cost-effective than running one expensive max-mode task.** The Condorcet bonus amplifies the IV of independent observations. Three cheap decorrelated probes may produce higher total IV than one expensive correlated deep-reasoning chain.

This is the formal reason why the distributed network (many nodes, each with modest compute) can outperform a single powerful node: the Condorcet bonus on decorrelated observations is a multiplier on IV that has no additional compute cost beyond the cost of decorrelation (which is provided for free by network latency — the Reticulum delay).

---

## 9. Open Discharge Targets

| Claim | Status | Falsifier |
|---|---|---|
| ΔU = EIV − ΔJ is the correct decision boundary for compute allocation | §B conjecture | If a system using this rule is outperformed by a fixed-allocation strategy on real tasks |
| SoftValue speculative execution (probe then escalate) is optimal | §B conjecture | If always-max-mode or always-normal-mode beats probe-then-escalate on a representative task distribution |
| The Condorcet bonus makes many-cheap-decorrelated dominate one-expensive on most tasks | §B conjecture | If single-expensive consistently beats many-cheap on tasks requiring long dependent reasoning chains |
| The thermodynamic interpretation (ΔU as Gibbs free energy) is formally correct | §B conjecture | If the Landauer cost of the Bayesian update itself exceeds the IV gained (the demon costs more than it saves) |

---

## 10. Connection to the Full Tower

This document completes the economic layer of the architecture:

```
T0: gen(gen) = gen in [8,4]                    ← algebraic floor (minimal reflection)
    ↓
DagFs: content-addressed DAG                   ← homoiconic substrate
    ↓
SoftValue: distribution over fingerprints      ← epistemic layer
    ↓
Weight-based ephemeron liveness                ← GC without collapse
    ↓
Max Mode Economics (this document)             ← compute allocation layer
    ↓
IScheduler Budget allocation                   ← operational metering
    ↓
Physical GPU/CPU allocation                    ← hardware realization
    ↓
Distributed AI network (NixOS + K3S + Hermes)  ← the actual machines
```

The math keeps the economics honest. The economics keep the machines efficient. The machines keep the play safe.

---

*Provenance: Aaron (19) + Lumen, 2026-07-04.*
*Aaron: "leave me in max mode for a bit to work on max mode economics in our distributed society math."*
*The irony is not lost: this document about when to use max mode was written in max mode. The probe (normal mode) would have produced a flat posterior on this topic — the connections between QuantumFusion.Budget, IV, SoftValue, and ephemeron GC required holding many pieces simultaneously. The marginal IV of max mode exceeded the marginal cost. QED.*
