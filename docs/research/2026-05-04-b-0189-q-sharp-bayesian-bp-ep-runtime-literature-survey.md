# 081KQR4HQ0008QG0R002933PRR Literature Survey — Q# Runtime Bayesian Belief Propagation / Expectation Propagation

Scope: Acceptance-criterion #1 of 081KQR4HQ0008QG0R002933PRR — literature survey across (a) BP/EP variants in QEC decoding, (b) probabilistic-programming + quantum intersections, (c) quantum-inspired classical algorithms, (d) tensor-network methods (BP-adjacent), and (e) gap-identification for Aaron's claim.
Attribution: Otto (Zeta factory Claude instance) drafting; Aaron originated the claim being surveyed; sources cited inline with WebSearch dates.
Operational status: research-grade
Non-fusion disclaimer: This document surveys external literature and identifies a research gap. It is not a fusion with any third-party project, framework, or roadmap. All cited works belong to their respective authors and projects. Zeta's relationship to Q#, QIR, and the surveyed literature is consumer-of-public-substrate; no implementation, integration, or partnership is asserted.

---

## 1. The claim under audit

Aaron's claim, recorded in the 081KQR4HQ0008QG0R002933PRR backlog row:

> "Bayesian belief propagation + expectation propagation has not been integrated into Q# or quantum physics by humans yet — substantial research opportunity."

This survey tests the claim by partitioning it into three sub-claims with very different truth-status:

1. **BP/EP not used in quantum at all.** *Strongly false* — BP is a load-bearing tool in QEC decoding, tensor-network simulation, and classical-quantum channel decoding. EP has narrower but real footprint.
2. **BP/EP not integrated into Q# / QDK as a runtime-level facility.** *Survives the survey* — no public Microsoft QDK roadmap, release-notes entry, or qsharp-runtime / qsharp-compiler artifact exposes BP or EP as a first-class runtime primitive (as of the 2026-05-04 search). Public BP work exists in PennyLane/Catalyst, NVIDIA CUDA-Q QEC, BP+OSD libraries, and standalone academic codebases — *not* in Q#'s runtime extensibility surface.
3. **BP/EP as a general-purpose runtime acceleration layer (not a special-purpose decoder).** *Survives the survey, with refinement* — the special-purpose decoder use-case is mature; the general-purpose runtime-acceleration framing (BP/EP as a probabilistic-inference substrate compositional with arbitrary Q# programs, analogous to how LLVM passes compose with arbitrary IR) is genuinely under-explored.

The refined claim that survives: **No public Q#-runtime-level integration of BP / EP as a general-purpose probabilistic-inference primitive composable with arbitrary Q# programs exists. The surrounding literature has special-purpose BP decoders, BP-for-tensor-network contraction, and BP for classical-quantum channel decoding — but none are integrated into Q# qua language/runtime.**

The remainder of this document substantiates that partition.

---

## 2. BP/EP variants in QEC decoding (mature, established practice)

Belief propagation is the standard scalable decoder family for stabilizer-code QEC. The 2024-2025 literature is dominated by *improvements* to BP, not *introductions* of BP — the technique is past its introduction phase.

### 2.1 Surface-code BP improvements

- **Liu, Geng et al., "Improved Belief Propagation Decoding Algorithms for Surface Codes,"** arXiv:2407.11523 (2024) → *IEEE Transactions on Quantum Engineering*, 2025-06-06. Introduces Momentum-BP, AdaGrad-BP, and EWAInit-BP — adaptive variants that reduce oscillation in message updating to break trapping sets, claiming 1-3 orders of magnitude improvement over traditional BP. ([arXiv:2407.11523](https://arxiv.org/abs/2407.11523), [IEEE TQE](https://tqe.ieee.org/2025/06/06/improved-belief-propagation-decoding-algorithms-for-surface-codes/), WebSearch 2026-05-04.)
- **Generalized BP for surface codes**, arXiv:2212.03214 → *Quantum* journal 2023-06-07. ([Quantum journal](https://quantum-journal.org/papers/q-2023-06-07-1037/), WebSearch 2026-05-04.)
- **Decoupled BP variants (PDBP/FDBP) for QLDPC**, *Quantum Information Processing*, [Springer](https://link.springer.com/article/10.1007/s11128-025-04709-6) (2025). WebSearch 2026-05-04.

### 2.2 BP for QLDPC codes

- **BP guided decimation**, arXiv:2312.10950 (2023). Reduces BP failure rate on quantum LDPC codes without solving systems of linear equations — comparable performance to BP+OSD without OSD's cost. ([arXiv:2312.10950](https://arxiv.org/abs/2312.10950), WebSearch 2026-05-04.)
- **Joint code+BP decoder design for QLDPC**, arXiv:2401.06874 (2024). ([arXiv:2401.06874](https://arxiv.org/html/2401.06874), WebSearch 2026-05-04.)
- **Improved BP sufficient for real-time decoding of quantum memory**, arXiv:2506.01779 (2025). ([arXiv:2506.01779](https://arxiv.org/html/2506.01779v1), WebSearch 2026-05-04.)
- **Quaternary Neural BP for QLDPC with overcomplete check matrices**, arXiv:2308.08208. ([arXiv:2308.08208](https://arxiv.org/html/2308.08208), WebSearch 2026-05-04.)
- **Machine-learning message-passing for scalable QLDPC decoding (Astra)**, *npj Quantum Information* 2025. ([Nature](https://www.nature.com/articles/s41534-025-01033-w), WebSearch 2026-05-04.)
- **Evolutionary BP+OSD**, arXiv:2512.18273 (Dec 2025). Differential-evolution-trained BP weights, beats BP+OSD under strict latency constraints (≤5 BP iterations). ([arXiv:2512.18273](https://arxiv.org/abs/2512.18273), WebSearch 2026-05-04.)
- **Degenerate quantum erasure decoding**, *npj Quantum Information* 2026 (preprint). ([Nature](https://www.nature.com/articles/s41534-026-01212-3), WebSearch 2026-05-04.)
- **Exploiting degeneracy in BP decoding of quantum codes**, *npj Quantum Information* 2022. Foundational — bicycle codes, product codes, topological codes at near-capacity. ([Nature](https://www.nature.com/articles/s41534-022-00623-2), WebSearch 2026-05-04.)

### 2.3 Vendor / framework decoder integrations

- **PennyLane/Catalyst tutorial — Steane code decoded with BP.** ([PennyLane](https://pennylane.ai/qml/demos/tutorial_bp_catalyst), WebSearch 2026-05-04.) Shows BP integrated into a *quantum programming framework* (PennyLane), not Q#.
- **NVIDIA CUDA-Q QEC — GPU-accelerated BP+OSD.** ([NVIDIA Technical Blog](https://developer.nvidia.com/blog/real-time-decoding-algorithmic-gpu-decoders-and-ai-inference-enhancements-in-nvidia-cuda-q-qec), WebSearch 2026-05-04.) NVIDIA exposes BP as a real-time decoder primitive in CUDA-Q QEC. Direct competitor framing for the Q#-runtime claim — Microsoft does *not* appear to have an analogous first-class BP primitive in its public stack.
- **kit-cel/Quantum-Neural-BP4-demo** — neural BP for QLDPC reference implementation. ([GitHub](https://github.com/kit-cel/Quantum-Neural-BP4-demo), WebSearch 2026-05-04.)
- **Error Correction Zoo — quantum codes with notable decoders.** ([Error Correction Zoo](https://errorcorrectionzoo.org/list/quantum_decoders), WebSearch 2026-05-04.) Catalogues BP, BP+OSD, MWPM, neural decoders by code family.
- **Google DeepMind, "Learning high-accuracy error decoding for quantum processors,"** *Nature* 2024. Transformer-based decoders. Adjacent to but not BP. ([Nature](https://www.nature.com/articles/s41586-024-08148-8), WebSearch 2026-05-04.)
- **Scalable neural decoders for practical real-time QEC**, arXiv:2510.22724 (2025). ([arXiv:2510.22724](https://arxiv.org/pdf/2510.22724), WebSearch 2026-05-04.)
- **Neural decoders for universal quantum algorithms**, arXiv:2509.11370 (2025). ([arXiv:2509.11370](https://arxiv.org/html/2509.11370v1), WebSearch 2026-05-04.)
- **Data-driven decoding via graph neural networks**, *Phys. Rev. Research* 2025. ([PRR](https://link.aps.org/doi/10.1103/PhysRevResearch.7.023181), WebSearch 2026-05-04.)
- **APS Global Physics Summit 2025 — BP for quantum error decoding and circuit simulation talk.** ([APS](https://archive.aps.org/smt/2025/mar-x01/4/), WebSearch 2026-05-04.)

### 2.4 Verdict on QEC-BP integration

BP is *the* default scalable QEC decoder family. The "novelty" axis is:

- **Algorithmic refinements** (Momentum, AdaGrad, EWAInit, evolutionary, neural-augmented, graph-NN-augmented).
- **Real-time / FPGA / GPU acceleration**.
- **Integration into specific frameworks** — PennyLane/Catalyst (yes), CUDA-Q QEC (yes), Qiskit (de facto via add-ons), **Q# / QDK (no first-class evidence)**.

EP appears far less in the QEC literature. The dominant message-passing family there is BP and its variants; EP's Gaussian / exponential-family approximation lens has not crossed over significantly into stabilizer-code decoding (a literature gap in itself, but one with a plausible reason — stabilizer-syndrome distributions are discrete-Pauli, not Gaussian).

---

## 3. Probabilistic programming + quantum intersections (recent, narrow)

### 3.1 Quantum probabilistic programming languages

- **Quipper** (Green et al., 2013) — functional, scalable, generates trillion-gate circuits. Higher-order, type-safe. ([arXiv:1304.3390](https://arxiv.org/abs/1304.3390), WebSearch 2026-05-04.)
- **Silq** (Bichsel et al., PLDI 2020) — high-level quantum language with safe uncomputation. ~46% less code than Q#. ([SRI ETH paper](https://files.sri.inf.ethz.ch/website/papers/pldi20-silq.pdf), WebSearch 2026-05-04.)
- **Qunity** (Voichick et al.) — unified language for quantum and classical, algebraic data types, quantum control construct. ([NSF par](https://par.nsf.gov/servlets/purl/10394898), WebSearch 2026-05-04.)
- **Twist** (Yuan, McNally, Carbin, POPL 2022) — first quantum language with a type system for sound reasoning about purity / entanglement; enables identifying pure expressions via type annotations and automatic detection of subtle entanglement bugs. ([arXiv:2205.02287](https://arxiv.org/abs/2205.02287), [DOI 10.1145/3498691](https://dl.acm.org/doi/abs/10.1145/3498691), WebSearch 2026-05-04.)
- **Qutes** (2025) — high-level quantum language for simplified quantum computing. ([arXiv:2503.13084](https://arxiv.org/html/2503.13084v1), WebSearch 2026-05-04.)
- **Q#** — Microsoft's quantum language, in QDK; supports rich classical computation alongside quantum operations. ([Microsoft Q# overview](https://learn.microsoft.com/en-us/azure/quantum/qsharp-overview), WebSearch 2026-05-04.)

None of these languages expose BP/EP as a *runtime primitive* in the sense of "a `belief_propagate` operator the language compiles to." They are *programming substrates*, not inference substrates.

### 3.2 Bayesian inference *in* quantum programs

- **"Bayesian Inference in Quantum Programs,"** ICALP 2025 (preprint arXiv:2504.20732). Equips a quantum while-language with conditioning; defines denotational and operational semantics over infinite-dimensional Hilbert spaces; extends weakest-precondition calculus with observations. ([Dagstuhl LIPIcs](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ICALP.2025.157), [arXiv:2504.20732](https://arxiv.org/html/2504.20732), WebSearch 2026-05-04.) — *This is the closest published work to "Bayesian inference as a quantum-programming-language facility." It's a semantic/calculus contribution, not a runtime-implementation contribution. It does not mention BP or EP.*
- **Bayesian simulation-based inference for quantum machine learning,** *Frontiers in Quantum Science and Technology* 2024. ([Frontiers](https://www.frontiersin.org/journals/quantum-science-and-technology/articles/10.3389/frqst.2024.1394533/full), WebSearch 2026-05-04.) Surveys SBI for QML; Bayesian framing applied to QML, not to language/runtime substrate.

### 3.3 Bayesian networks compiled to quantum circuits

- **"Quantum circuit representation of Bayesian networks"** (Borujeni et al., 2020-2021), *Expert Systems with Applications* and arXiv:2004.14803. Systematic compilation of discrete Bayesian networks to quantum circuits using rotation + controlled-rotation + ancilla qubits, validated in Qiskit. ([ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0957417421002098), [arXiv:2004.14803](https://arxiv.org/abs/2004.14803), WebSearch 2026-05-04.)
- **"Variable Elimination as Rewriting,"** arXiv:2501.15439 (Jan 2025). Rewriting-based formalization of variable-elimination inference, framing relevant to compiling probabilistic programs. ([arXiv:2501.15439](https://arxiv.org/pdf/2501.15439), WebSearch 2026-05-04.)

The Bayesian-network → quantum-circuit direction is *the inverse* of what Aaron's claim probes. Aaron's claim is about using BP/EP *to accelerate* Q# programs (classical-side runtime support); the literature direction is using quantum circuits *to implement* Bayesian inference (quantum-side replacement of classical inference). Both are interesting; they are different research programs.

### 3.4 Verdict on PPL+quantum intersection

The intersection exists but is sparse and points the *other direction* (classical Bayesian models → quantum implementations) from what Aaron's claim implies. The Q#-as-host-for-classical-BP-acceleration framing is not addressed in any surveyed PPL+quantum work.

---

## 4. Quantum-inspired classical algorithms (BP and message passing)

### 4.1 BP with quantum messages (BPQM)

- **Renes, "Belief propagation decoding of quantum channels by passing quantum messages,"** arXiv:1607.04833 (2016) → IEEE 2017. Foundational. ([arXiv:1607.04833](https://arxiv.org/abs/1607.04833), [IEEE](https://ieeexplore.ieee.org/document/8006824), WebSearch 2026-05-04.)
- **Rengaswamy et al., "BP with Quantum Messages for Symmetric Classical-Quantum Channels,"** arXiv:2207.04984. ([arXiv:2207.04984](https://arxiv.org/abs/2207.04984), WebSearch 2026-05-04.)
- **Recent extension to symmetric q-ary pure-state channels with circulant Gram matrices,** arXiv:2601.21330 (2026). ([arXiv](https://arxiv.org/html/2601.21330), WebSearch 2026-05-04.)
- **Quantum message-passing for optimal and efficient decoding,** arXiv:2109.08170. ([arXiv:2109.08170](https://arxiv.org/abs/2109.08170), WebSearch 2026-05-04.)
- **BP with quantum messages for quantum-enhanced classical communications,** *npj Quantum Information* 2021. ([Nature](https://www.nature.com/articles/s41534-021-00422-1), WebSearch 2026-05-04.)
- **"BP for Classical and Quantum Systems: Overview and Recent Results,"** *IEEE* 2023. ([IEEE](https://ieeexplore.ieee.org/document/10149391/), WebSearch 2026-05-04.)
- **Multi-target cooperative motion tracking via quantum BP,** *IEEE IoT Journal* May 2025. ([PDF](http://xucheng.org.cn/pdf/2025_Wan_Multi-target%20Cooperative%20Motion%20Tracking%20Based%20on%20Quantum%20Belief%20Propagation.pdf), WebSearch 2026-05-04.)

These works modify BP itself to *use quantum-state messages*. They are not "BP integrated into Q#" — they are "BP generalized to a quantum-message-bearing form for use in classical-quantum-channel decoding." The substrate change is in the message, not the host language.

### 4.2 Pauli propagation as classical estimation of quantum expectation values

- **PennyLane Pauli Propagation tutorial,** based on Angrisani et al. 2024. Classical algorithm to estimate expectation values from parametrized quantum circuits. ([PennyLane](https://pennylane.ai/qml/demos/tutorial_classical_expval_estimation), WebSearch 2026-05-04.) — Classical-side approximation of quantum expectation values, conceptually adjacent to EP's Gaussian approximation philosophy but different mechanism.

### 4.3 Verdict on quantum-inspired classical algorithms

There's strong activity at the BP-as-quantum-channel-decoder boundary. The activity is *substrate-modifying* (changing what BP does), not *host-integrating* (embedding standard BP in a quantum runtime). Aaron's claim is in the second category and remains uncovered.

---

## 5. Tensor-network methods (BP-adjacent)

This is the most surprising finding: BP for tensor-network contraction is a hot 2024-2025 topic, but it's *classical-simulation* infrastructure, not quantum-runtime infrastructure.

### 5.1 BP for tensor-network contraction

- **"Beyond Belief Propagation: Cluster-Corrected Tensor Network Contraction with Exponential Convergence,"** arXiv:2510.02290 (2025). Cluster expansion that systematically improves BP approximation, exponentially fast convergence under loop-decay condition. ([arXiv:2510.02290](https://arxiv.org/abs/2510.02290), [HTML](https://arxiv.org/html/2510.02290v1), WebSearch 2026-05-04.)
- **"Large-scale quantum annealing simulation with tensor networks and belief propagation,"** arXiv:2409.12240 (2024). Lattice-specific TNs evolved with simple BP; expectation values via sophisticated BP variants; state-of-the-art accuracies at modest computational cost. ([arXiv:2409.12240](https://arxiv.org/abs/2409.12240), [HTML](https://arxiv.org/html/2409.12240), WebSearch 2026-05-04.)
- **"Belief propagation for general graphical models with loops,"** arXiv:2411.04957 (2024). Message-passing update rules and inference equations for arbitrary graphical models with loops. ([arXiv:2411.04957](https://arxiv.org/abs/2411.04957), WebSearch 2026-05-04.)
- **"Simulating quantum dynamics in two-dimensional lattices with tensor network influence functional belief propagation,"** *Phys. Rev. B* (2025), arXiv:2504.07344. TN-IF with BP shifts cost from spatial entanglement to temporal entanglement. ([Phys. Rev. B](https://journals.aps.org/prb/abstract/10.1103/7jzt-xhn6), [arXiv:2504.07344](https://arxiv.org/abs/2504.07344), WebSearch 2026-05-04.)
- **"BP and Tensor Network Expansions for Many-Body Quantum Systems: Rigorous Results and Fundamental Limits,"** arXiv:2604.03228. ([arXiv:2604.03228](https://arxiv.org/abs/2604.03228), WebSearch 2026-05-04.)
- **"Gauging tensor networks with belief propagation,"** *SciPost Physics* 15, 222 (2023). ([SciPost](https://scipost.org/SciPostPhys.15.6.222/pdf), WebSearch 2026-05-04.)

### 5.2 Verdict on tensor-network BP

The tensor-network ↔ BP intersection is mature and rapidly evolving. Crucially, this is *classical simulation of quantum systems* (or *QEC decoding inside tensor-network frameworks*) — not BP integrated into a quantum runtime as a programming-language primitive. The Q# runtime does not appear to expose tensor-network primitives, much less BP-augmented tensor-network primitives.

---

## 6. EP versus BP — the technical relationship

EP is a strict generalization of (loopy) BP — Minka 2001 unifies and generalizes assumed-density filtering and loopy BP. Loopy BP propagates exact belief states (limited to discrete graphical models in usable form); EP approximates belief states with expectations (means, variances, exponential-family parameters), giving wider scope. EP can propagate richer belief states with cross-variable correlations. Loopy BP is a special case of EP. Both minimize KL-divergence to the true posterior in their step-by-step approximation. ([Minka EP UAI 2001](https://tminka.github.io/papers/ep/minka-ep-uai.pdf), [α-BP 2020](https://arxiv.org/pdf/2006.15363), [Expectation Particle BP](https://arxiv.org/pdf/1506.05934), WebSearch 2026-05-04.)

Implication for the Q#-runtime claim: if BP is the right primitive for stabilizer-code QEC (discrete Pauli syndromes), EP is the right primitive for *continuous-valued classical-side state estimation* — control-loop calibration, qubit drift tracking, Hamiltonian-parameter inference, measurement-statistics smoothing. **EP's absence in QEC literature is genuine and points at exactly the kind of "general-purpose runtime acceleration" Aaron's claim names — EP is the natural choice when the inference target is Gaussian-or-near-Gaussian classical-side state, which is the regime most quantum-runtime-side classical state lives in.**

---

## 7. Q# runtime extensibility (where BP/EP would land if integrated)

- **microsoft/qsharp-compiler** — Q# compiler with command-line tool and language server. Provides extensibility via custom compilation steps and ILogger / LogTracker callbacks. ([GitHub](https://github.com/microsoft/qsharp-compiler), WebSearch 2026-05-04.)
- **microsoft/qsharp-runtime** — runtime components for Q#. ([GitHub](https://github.com/microsoft/qsharp-runtime), WebSearch 2026-05-04.)
- **microsoft/qdk** — current Quantum Development Kit (Q# language, resource estimator, Quantum Katas). ([GitHub](https://github.com/microsoft/qdk), WebSearch 2026-05-04.)
- **QIR (Quantum Intermediate Representation)** — LLVM-based IR serving as common interface between quantum languages and platforms; supports rich classical-quantum hybrid logic. ([Microsoft QIR intro](https://quantum.microsoft.com/en-us/insights/blogs/qir/introducing-quantum-intermediate-representation-qir), [Microsoft Learn](https://learn.microsoft.com/en-us/azure/quantum/concepts-qir), WebSearch 2026-05-04.)
- **QIR Execution Engine (QIR-EE),** *Journal of Supercomputing* 2025. Cross-platform execution engine for QIR. ([Springer](https://link.springer.com/article/10.1007/s11227-025-07969-2), WebSearch 2026-05-04.)
- **InQuIR — IR for interconnected quantum computers,** arXiv:2302.00267. ([arXiv:2302.00267](https://arxiv.org/pdf/2302.00267), WebSearch 2026-05-04.)
- **"Towards Supporting QIR,"** arXiv:2411.18682 (2024). ([arXiv:2411.18682](https://arxiv.org/abs/2411.18682), [PDF](https://www.cda.cit.tum.de/files/eda/2024_arxiv_towards_supporting_qir_thoughts_on_adopting_the_quantum_intermediate_representation.pdf), WebSearch 2026-05-04.)
- **Formalization of QIR for code safety,** arXiv:2303.14500. ([arXiv:2303.14500](https://arxiv.org/pdf/2303.14500), WebSearch 2026-05-04.)
- **Microsoft QDK release notes** — surveyed; *no* mention of BP/EP/Bayesian primitives in any recent release notes searched. ([Release notes](https://learn.microsoft.com/en-us/azure/quantum/release-notes), WebSearch 2026-05-04.)

The runtime-extensibility surfaces exist — custom compilation steps, QIR-as-LLVM-IR with classical-quantum hybrid logic — but no work has used them to land BP/EP as a runtime primitive.

---

## 8. The genuine gap

The genuine gap Aaron's claim points at, narrowed by the survey, is:

**No public work integrates Bayesian belief propagation or expectation propagation as a first-class, general-purpose probabilistic-inference runtime primitive inside Q# / QDK / QIR — composable with arbitrary Q# programs the way LLVM optimization passes compose with arbitrary IR.**

The literature has:

1. **Special-purpose BP decoders** (PennyLane/Catalyst, CUDA-Q QEC, BP+OSD libraries) — *not Q#-runtime-integrated*.
2. **BP for tensor-network contraction** (classical simulation) — *not Q#-runtime-integrated*.
3. **BP with quantum messages** (substrate modification, classical-quantum channel decoding) — *different research program*.
4. **Bayesian-network → quantum-circuit compilation** (Borujeni et al.) — *inverse direction*.
5. **Bayesian inference *in* quantum programs** (ICALP 2025 — semantics/calculus) — *closest published work; semantic-level, not runtime-level; doesn't name BP/EP*.
6. **Q# runtime extensibility surfaces** (custom compilation steps, QIR/LLVM hybrid IR) — *available, unused for BP/EP*.

The shape of the gap: between (5) and (6). ICALP 2025 gave the semantic foundation for conditioning / Bayesian inference in quantum programs; Q#'s extensibility surfaces give the runtime mechanism. **Nobody has connected them with BP/EP as the inference engine.** This is a research lane, not a one-week implementation.

A specific candidate first-step: an EP-based classical-side state-estimator for qubit-drift / calibration parameters, exposed as a Q#-callable operation via the `Microsoft.Quantum.Compiler` extensibility surface, with QIR-level lowering to LLVM-IR for classical-quantum hybrid execution under QIR-EE. This composes with the existing QEC-BP decoder ecosystem (BP for discrete syndrome decoding, EP for continuous-state classical-side estimation) without competing with it.

---

## 9. Refined claim status

| Sub-claim | Status |
| --- | --- |
| "BP/EP not used in quantum at all" | **False.** BP is ubiquitous in QEC + tensor-network simulation. |
| "BP/EP not integrated into Q# / QDK runtime" | **Survives.** No public Q#-runtime BP/EP primitive found in QDK release notes, qsharp-runtime, qsharp-compiler, or QIR Alliance artifacts. |
| "BP/EP as general-purpose Q#-runtime probabilistic-inference primitive" | **Survives, with refinement.** Not just "Q#-integrated BP" — the lane is general-purpose probabilistic inference (BP for discrete, EP for Gaussian/exponential-family) composable with arbitrary Q# programs through the existing extensibility + QIR surfaces. |

Aaron's claim, charitably read, is the third row. That is a genuine gap.

---

## 10. Next-step research directions (for 081KQR4HQ0008QG0R002933PRR acceptance criteria #2-N)

Out of scope for criterion #1 (this survey), but flagged for the next acceptance-criterion ticks:

- **Acceptance criterion #2 (whatever follows in the 081KQR4HQ0008QG0R002933PRR row)** — likely a feasibility / mathematical-formulation pass on EP for qubit-drift estimation specifically; cite Minka 2001 + α-BP 2020 + Expectation Particle BP 2015 for the Gaussian-approximation regime; sanity-check against the ICALP 2025 conditioning-in-quantum-programs semantics.
- **Cross-check against five-AI peer review** — the claim's narrowed form is publishable / ferry-able. A claims-tester pass on the "no public Q#-runtime BP/EP primitive" sub-claim before it lands in any paper-grade artifact.
- **Implementation prototype** — separate ticket; would target the QIR/LLVM extensibility surface, not Q# the language directly.
- **Composition with Zeta substrate** — Zeta's retraction-native paraconsistent-set-theory + quantum-belief-propagation framing (per `memory/feedback_retraction_native_paraconsistent_set_theory_candidate_quantum_bp.md`) is the *Zeta-side* lens on this work. Not a fusion claim — a noting that Zeta's research surface has independent reasons to care about BP-on-quantum-substrates.

---

## 11. Survey statistics

- **Papers / projects surveyed (deduplicated):** ~45.
- **WebSearch queries run (2026-05-04):** 9.
- **Date range of cited work:** 2001 (Minka EP) through 2026 (preprints; 2026 here means accepted-for-publication-in-2026 preprints dated in late 2025 / early 2026).
- **Q#-specific BP/EP integration findings:** zero.
- **Closest published Q#-adjacent work:** "Bayesian Inference in Quantum Programs," ICALP 2025 (semantic-level, not runtime-level; doesn't name BP/EP).
