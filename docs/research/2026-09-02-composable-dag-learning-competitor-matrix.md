# Composable DAG Learning: Competitors, Benchmarks, and Zeta’s Current Boundary

**Status:** Source-grounded taxonomy; CFB-A/B/C measurements independently reproduced

**Author:** Manus AI

## Key Recommendation

Zeta should not advertise itself as a **DAG-learning competitor** yet. Its implemented strength is uncertainty-preserving inference over a declared composable factor graph and a declared reference-frame heterarchy. The highest-value immediate benchmark is therefore an exact Gaussian **chain-versus-branched-DAG inference census** with a dense linear-algebra oracle. The highest-value external follow-on is the Static slice of the 2026 Precision-Gated Experts benchmark. Causal-DAG recovery, probabilistic-circuit density estimation, neural architecture search, and Monty active perception remain separate comparison tracks until Zeta implements the corresponding learned object.

## 1. Architecture Classification

The word “DAG” names a graph shape, not a single learning problem. Different systems learn or infer different objects, and their published numbers are not interchangeable.

| Architecture class | Representative competitors | What is learned or inferred | Topology | Uncertainty | Fair Zeta comparison now? |
|---|---|---|---|---|---|
| Declared factor-graph inference | RxInfer / ReactiveMP; Infer.NET; ForneyLab | Posterior beliefs and sometimes parameters | Declared by modeler | Explicit messages/distributions | **Yes**: same Gaussian graph, evidence, marginals, runtime, memory, and order controls |
| Composed closed-form factor graphs | Precision-Gated Experts | Gaussian/Gamma parameters and probabilistic routing | Declared composition; inferred gates | Explicit predictive and gate uncertainty | **Partly**: Static Gaussian fusion now; Dynamic/Noisy after new message families |
| Probabilistic circuits | PyJuice and SPN/PC systems | Distribution parameters; sometimes circuit structure | Constrained DAG, fixed or learned | Explicit joint distribution | Not yet: Zeta lacks a learned smooth/decomposable circuit and compatible likelihood task |
| Causal DAG discovery | SDCD, NOTEARS, DAGMA, DiBS | Directed causal structure and mechanisms | Learned from data | Usually point structure; DiBS models structure uncertainty | No: Zeta currently consumes topology rather than discovering it |
| Neural architecture growth/search | arbitrary-DAG growth, DARTS/NAS families | Deterministic computation graph and weights | Learned/searched | Usually absent from prediction | No: requires a supervised learner and matched parameter/FLOP search budget |
| Dynamic modular routing | MoE and neural module networks | Expert weights, routes, and task parameters | Fixed supergraph; input-dependent path | Routing weights, usually not calibrated predictive uncertainty | Later: use a shared compositional task and capacity-matched router |
| Sensorimotor heterarchy | Thousand Brains / Monty | Object/reference-frame models and pose hypotheses | Declared modules and message links | Multiple object-plus-pose hypotheses | Later: shared active 3D task, movement policy, sensor budget, and YCB split |
| Historical self-organizing polynomial DAG | GMDH | Polynomial units and network structure | Grown/selected by external criterion | Usually deterministic | Separate prior-art baseline; explicitly not the user’s unresolved remembered name |

The current Zeta implementation consists of `FactorGraph<'M>`, `IMessage<'M>`, BP/EP factor types, the Gaussian chain-specialized `MultilayerBnn`, and the `ReferenceFrameFactorHeterarchy`. `MultilayerBnn.Sequential` is an exact Gaussian chain smoother. Its multi-parent hand-written sweeps are approximate; `tryMarginalsViaFactorGraph` is the real per-edge DAG inference path. RFFH performs Bayesian evidence fusion and pose transport, not weight or topology learning.

## 2. Closest Current Competitors

### 2.1 Reactive message passing

Reactive Message Passing defines schedule-free local reactions on a declared factor graph and supports BP, VMP, EP, and EM through constrained Bethe-free-energy inference.[1] The authors report execution on state-space models with hundreds of thousands of random variables on a standard laptop, but that systems claim must be reproduced under matched model, hardware, convergence tolerance, and allocation measurement before ranking Zeta.

> “The absence of a fixed message passing schedule improves robustness, scalability and execution time of the inference procedure.” — Bagaev and de Vries[1]

This is Zeta’s nearest current systems competitor because both execute explicit uncertainty-bearing messages on declared graphs. The first compatible benchmark should use the same linear-Gaussian model and compare posterior error against an exact dense solve, update-order sensitivity, runtime, peak memory, and failed-message behavior.

### 2.2 Composed non-conjugate factor graphs

Lukashchuk et al. define five typed factor primitives—bilinear, exponential, Gamma, Gaussian, and equality—and prove closed-form variational messages for compositions ranging from static ensembles through input-dependent gates and split-branch decision trees.[2] Their application evaluates seven forecasting experts on ETTh1, ETTh2, Exchange Rate, Electricity, and Traffic, with horizons 96, 192, 336, and 720. The official implementation is `biaslab/PrecisionGatedExperts`.[3]

This paper is the strongest recent match to the user’s “multiple lower layers compose under one above” description, but it does not identify the older forgotten term. Zeta can implement the Static precision-fusion slice with its existing Gaussian algebra. Matching the Dynamic and Noisy variants requires Gaussian/Gamma messages, an exponential-link factor, inferred gating, and the same expert-prediction artifacts.

### 2.3 Probabilistic circuits

PyJuice compiles constrained probabilistic-circuit DAGs into block-based GPU operations and reports one-to-two orders-of-magnitude training speedup and two-to-five-times lower GPU memory against prior PC systems under the paper’s hardware and workloads.[4] Its image and language density-estimation results evaluate a learned distribution, not factor-graph posterior inference. PyJuice is a valuable future competitor after Zeta has a learned smooth/decomposable circuit and compatible bits-per-dimension task; it is not a valid current leaderboard opponent.

## 3. Adjacent but Incompatible Leaderboards

| Family | Recent anchor | Native benchmark | Why current Zeta numbers would be invalid |
|---|---|---|---|
| Differentiable causal discovery | SDCD[5] | Synthetic observational/interventional graph recovery; structural accuracy and convergence | Zeta has no topology-learning objective or recovered adjacency matrix |
| Arbitrary neural-DAG growth | Douka et al.[6] | Supervised neural accuracy versus parameter and compute cost | Zeta has no comparable backpropagated weight learner or growth criterion |
| Compositional neural modules | recent modular-learning literature | Systematic generalization, routing accuracy, and parameter efficiency | RFFH messages are declared Bayesian factors, not trained neural modules |
| Monty | Thousand Brains Project papers[7] | Active YCB object/pose recognition under movement and sensor budgets | Zeta has no trained object model, action policy, or shared sensor episode yet |
| Spatial-language grounding | StepGame and CLUTRR[8] [9] | Held-out relation accuracy, NLL, calibration, and compositional depth | The experiment is preregistered but no parser or fitted benchmark model has run |

## 4. Benchmark Ladder

### Stage A — exact chain-versus-DAG inference census

Generate deterministic linear-Gaussian models with chain, fork, diamond, balanced-tree, and reconvergent DAG topologies. For every model, construct the same joint precision system and exact dense posterior oracle. Compare these lanes:

| Lane | Description | Purpose |
|---|---|---|
| `exact-dense` | Cholesky or pivoted solve of the complete Gaussian information system | Independent correctness oracle |
| `zeta-chain` | `MultilayerBnn.Sequential` on chain instances only | Positive calibration for the specialized smoother |
| `zeta-factor-dag` | `FactorGraph<Gaussian>` with one message per declared edge | Current composable DAG path |
| `chain-projection` | Capacity-matched chain that drops or folds branch edges by a declared deterministic rule | Falsifier for the claim that branch topology is unnecessary |
| `order-mutant` | Same factor graph with one message omitted, duplicated, or scheduled through a noncommutative fold | Teaching controls for missing and double-counted evidence |

Report marginal mean error, covariance error, held-out Gaussian NLL, empirical interval coverage, runtime, allocations, graph size, edge count, update count, and convergence tolerance. The positive result is not “DAGs beat chains” universally. It is the finite statement that retaining declared branch factors improves posterior agreement on generated branch-dependent models while the exact chain implementation remains optimal or equivalent on true chains.

### Stage B — external Static ensemble benchmark

Reproduce the Static Gaussian precision-fusion model from Precision-Gated Experts on one small public dataset/horizon first, using the authors’ expert predictions when available. Compare MSE, NLL, interval coverage, parameter count, and runtime. Do not compare to Dynamic/Noisy rows until their factors are implemented.

### Stage C — non-conjugate composition

Add typed Gamma and exponential-link messages behind the existing `IMessage<'M>` port. Reproduce input-dependent precision and split-branch routing with the same five public datasets and authors’ splits. This is the point where Zeta becomes a direct learned compositional-factor competitor.

### Stage D — structure learning

Only after a declared topology-search posterior exists should Zeta enter ER/SF synthetic and Sachs causal-DAG recovery benchmarks. Required metrics are structural Hamming distance, edge precision/recall, interventional likelihood where available, calibration over structures, runtime, and memory. A factor graph that merely fits parameters on the true graph is not a structure-learning result.

## 5. Preregistered Falsifiers

The first executable benchmark is rejected if the exact dense oracle and chain calibration disagree beyond declared tolerance, if a branch-free dataset still gives the DAG lane an unexplained advantage, if the chain projection receives fewer parameters or less evidence without explicit accounting, if update order changes a commutative Gaussian result, if duplicate evidence is silently counted twice, if runtime excludes graph construction for one lane but not another, or if published competitor numbers are copied into the same leaderboard despite different tasks or hardware.

## 6. Measured Practical Verdict

Zeta is useful as a typed, uncertainty-preserving **inference substrate** for declared graphs, but the first public-data usefulness benchmark is negative under its frozen rule. CFB-A shows that chain and balanced-DAG reductions preserve the same commutative Gaussian posterior while ideal depth falls from `63` to `6` at 64 leaves. This is an execution-topology result, not predictive superiority.

CFB-B shows that static precision fusion improves MSE over equal weighting on the pinned ETTh1 split, but coverage falls to `0.7501`, residual correlation reaches `0.8738`, and validation-selected ridge has lower MSE and NLL. CFB-C restores coverage to `0.9608` with shrinkage-covariance weights but selects `α=1`, eliminating every off-diagonal covariance; the diagonal-only mutation is identical and MSE worsens to `10.8695`. The attempted correlated-error mechanism is therefore vacuous in the selected artifact and the frozen verdict remains **not supported**.

Zeta is not yet demonstrated as a topology-learning system, a trained neural DAG, a probabilistic-circuit compiler, or a Monty-equivalent active learner. The next fair direct-competitor step remains implementation of the declared Gaussian/Gamma and exponential-link messages with the authors’ actual expert artifacts. Any structure-learning program remains separate.

## References

The [September 8 pinned-source audit and factor-module design](2026-09-08-precision-gated-experts-design-and-source-audit.md)
records later packaging/split/metric checks and material equation/link-rule
inconsistencies in Precision-Gated Experts. It qualifies the prospective
non-conjugate implementation path above without replacing the historical
CFB measurements or admitting a new learned model.

[1]: https://arxiv.org/abs/2112.13251 "Bagaev and de Vries, Reactive Message Passing for Scalable Bayesian Inference"
[2]: https://arxiv.org/abs/2605.29467 "Lukashchuk et al., Composing Non-Conjugate Factor Graphs with Closed-Form Variational Inference"
[3]: https://github.com/biaslab/PrecisionGatedExperts "Precision-Gated Experts official implementation"
[4]: https://arxiv.org/abs/2406.00766 "Liu, Ahmed, and Van den Broeck, Scaling Tractable Probabilistic Circuits"
[5]: https://arxiv.org/abs/2311.10263 "Nazaret et al., Stable Differentiable Causal Discovery"
[6]: https://hal.science/hal-04902059v2 "Douka et al., Growth strategies for arbitrary DAG neural architectures"
[7]: https://arxiv.org/abs/2507.04494 "Leadholm et al., Thousand-Brains Systems"
[8]: https://arxiv.org/abs/2204.08292 "Shi et al., StepGame"
[9]: https://aclanthology.org/D19-1458/ "Sinha et al., CLUTRR"
