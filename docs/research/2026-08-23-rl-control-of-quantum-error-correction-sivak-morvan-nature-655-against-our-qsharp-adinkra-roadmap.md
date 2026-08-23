# RL control of quantum error correction (Sivak, Morvan et al., *Nature* 655) — read against our Q# lane, our adinkra ECC, and our ρ meter

**Register: `metered`.** Peer-reviewed, open-access, named reviewers, published data, hardware
results on a real processor. This is not a ferried transcript and it is not in
`ip-questionable/` — it is a citable paper, and the claims below that come from it carry the
paper's own evidence, not ours.

**Ferried:** 2026-08-23, by the shadow, at Aaron's framing (verbatim in §1).
**Sibling in flight:** an agent is working the `measured-latent-geometry` research doc. The
latent-geometry question is **not** addressed here; this document stops at QEC, RL control, and
the code-theoretic layer.

---

## 0. Citation, licence boundary, and what the authors themselves withheld

> Sivak, V. V., Morvan, A. *et al.* (Google Quantum AI and Google DeepMind).
> **"Reinforcement learning control of quantum error correction."**
> *Nature* **655**, 879–884 (23 July 2026). https://doi.org/10.1038/s41586-026-10759-2
>
> Received 11 November 2025 · Accepted 4 June 2026 · Published online 8 July 2026.
> Open access under **CC BY-NC-ND 4.0**. Corresponding authors: Volodymyr Sivak, Alexis Morvan.
> Project supervised by P. V. Klimov. Data: Zenodo https://doi.org/10.5281/zenodo.17566521.
> Peer review: *Nature* thanks **Marin Bukov**, **Giovanni Cemin**, and other anonymous
> reviewer(s); peer reviewer reports are available.

**Licence handling.** CC BY-NC-ND permits non-commercial sharing with credit and forbids sharing
**adapted** material. Everything reproduced below is a **quotation under attribution** — the
abstract, and short sentences carrying the numbers. This document is a *comparison against our
own tree*, not a rewrite, condensation, or adaptation of the article. Anyone wanting the paper
should read the paper; the DOI is above and it is free.

**The honest boundary the authors drew themselves,** quoted in full because it is the one real
limitation on the whole result:

> "The custom code used in this study is the proprietary property of Google and cannot be made
> publicly available. A detailed mathematical description of the RL algorithm is provided in
> Supplementary Information section VIII to allow independent replication."

So: **reproducible in principle from the mathematics, not from their code.** The data are open
(Zenodo), the algorithm is described, the implementation is closed. By this repo's own standard
that is *better* than most and still short of a falsifier we could run: we can re-derive, we
cannot re-execute. Record it as such and do not round it up.

**One further boundary, relevant to `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`
and to `Wall.Whitebox` in `src/Core/DerivationProtocol.fs`:** the paper's own competing-interests
statement declares that

> "Author-affiliated entities have filed US and international patent applications related to RL
> calibration of the QEC decoder and quantum computer control parameters, including US18/680,288
> and US19/345,222."

Citing the paper is free. **Practising those claims is gated**, and we hold no licence. Anything
downstream of this document that looks like "RL calibration of a decoder" must route through the
same clean-room / unknown-licence-blocks discipline that governs the Itron hub patent. This is
recorded now, before anyone builds toward it, for the same reason that rule was written before
the code existed.

---

## 1. Aaron's framing, verbatim

> "Paper to compare to our q# and roadmap, this is almost exactly what we are going for, this is
> the never collapse kind of, and the ECC built in similar to our adinkras but not exactly."

Three claims, one hedge. The hedge — *"similar to our adinkras but not exactly"* — is the most
load-bearing word in the sentence and §4 is written to preserve it rather than resolve it in
either direction.

---

## 2. The paper, in its own words

**Abstract, verbatim** (reference superscripts removed for legibility; no other change):

> Quantum error correction (QEC) is the primary strategy for protecting a quantum computer from
> the environment. The prerequisite of QEC is that errors must remain sufficiently rare, which
> requires perpetually adapting the control parameters of the computer to the drifting
> environmental conditions. The current solution to this problem is to terminate the entire
> quantum computation for recalibration, but it is incompatible with the long runtimes of future
> quantum algorithms. Here we address this challenge by unifying calibration with computation. We
> grant the QEC process a dual role: its error-detection events are not only used to correct the
> logical quantum state but are also repurposed as a learning signal, teaching a reinforcement
> learning agent to continuously steer the control parameters and stabilize the quantum system
> during computation. We experimentally demonstrate this framework on a Willow superconducting
> processor, improving the logical stability of the surface code 3.5-fold against injected drift.
> By synthesizing our full suite of technological advances, we achieve record performance of the
> surface and colour codes, with average logical error per cycle of 7.72(9) × 10⁻⁴ and
> 8.19(14) × 10⁻³, respectively. Numerical simulations of large codes with tens of thousands of
> control parameters confirm the scalability of our RL framework, revealing an optimization speed
> that is independent of system size. This work thus enables a new paradigm: a quantum computer
> that learns from its errors and never stops computing.

### 2.1 The numbers, verbatim where they are quoted

| quantity | value | source in paper |
|---|---|---|
| distance-7 surface code logical error per cycle | **ε_L = 7.72(9) × 10⁻⁴** (AlphaQubit2 decoder, averaged over X and Z logical bases) | main text |
| distance-5 colour code logical error per cycle | **ε_L = 8.19(14) × 10⁻³** (Tesseract most-likely-error decoder) | main text |
| RL fine-tuning after full conventional calibration **and human expert tuning** | **≈ 20 % additional suppression of the LER** | Fig. 3a |
| LER reduction under injected drift, vs fixed policy | **24 %**, rising to **31 %** with decoder steering | Fig. 4c |
| LER **stability** improvement (s.d. of the LER distribution) | **2.4×**, rising to **3.5×** with decoder steering | Fig. 4c |
| learning response time (exponential fit, step-like XY-amplitude drift) | **≈ 130 epochs** | Fig. 4b |
| critical drift frequency below which real-time steering beats a fixed policy | **≈ 1/150 epochs** | Fig. 5a |
| suppression of low-frequency LER fluctuation from *natural* drift | **≈ 4 dB** (Fourier analysis) | SI §III |
| control parameters under the agent | **> 1,000** (d = 5), **> 2,000** (d = 7), **≈ 40,000** simulated (d = 15, 30 params/gate) | main text, Fig. 5b |
| factor-graph density, d = 5 surface code | each detector node → **302** parameter nodes on average; each parameter node → **18** detector nodes | Fig. 2d |
| surrogate-to-true gradient relation | **∇log ε_L = ((d+1)/2) · ∇log C** | main text, confirmed in Fig. 2c |
| scaling model the surrogate is derived from | **ε_L ∝ Λ^(−d/2)**, Λ = ε_th/ε | main text |
| convergence law near the optimum | **1 − Λ/Λ\* ∝ e^(−γt)**, with γ **independent of system size** | Fig. 5c |

Algorithm, in the authors' words: built on **parameter-exploring policy gradients** (Sehnke et
al. 2010), with **proximal policy optimization** (Schulman et al. 2017) for stability, **entropy
regularization** (Haarnoja et al. 2018) to maintain exploration, a **replay buffer** (Mnih et al.
2015) for sample efficiency, and gradient masking over the factor graph for variance reduction of
the Monte-Carlo gradient estimator (Mohamed et al. 2020). The policy distribution is a
**factorized multivariate Gaussian** with mean μ(t) and diagonal covariance σ(t)² — deliberately
simple, because "the limited data rate … currently hampers our ability to learn complex policy
distributions such as neural networks."

---

## 3. Connection 1 — "this is the never collapse kind of"

**Aaron is right, and the mechanism is explicit rather than inferred.** Two sentences from the
paper carry it:

> "This is achieved by the entropy regularization technique, which ensures that the policy
> distribution never becomes deterministic, enabling the agent to continuously explore and adapt
> to changes in a non-stationary environment."

> "μ(t) learns to track the optimal policy over time, whereas σ(t)² maintains finite spread to
> never cease exploring."

### 3.1 The shared object, exhibited

The correspondence is not "both talk about uncertainty." It is a specific object appearing on
both sides:

> **A sampling distribution over a population of candidate hypotheses, evaluated in parallel, with
> a floor on its spread — where the floor is justified because the estimator built on that
> population carries zero information when the population degenerates.**

- **Theirs.** PEPG samples a *batch of policy candidates* from π(θ) = N(μ(t), diag σ(t)²) each
  epoch, ranks them by the surrogate objective, and converts the ranking into a gradient step. At
  σ = 0 every sample is identical, the ranking is empty, and the Monte-Carlo gradient estimate is
  exactly zero. Entropy regularisation is the floor.
- **Ours.** `src/Bayesian/YinYangEnsemble.fs` maintains a population of cells and measures
  `rhoProxy` — the mean spread of the cell means. At ρ = 1 every cell votes identically, the
  Condorcet gain over one member is exactly zero, and the ensemble is "a single voter" (the
  module's own docstring, line 129). `reseedIfCollapsed` is the floor.

Both floors are justified by *the same fact*: **the estimator's information content vanishes when
the population degenerates.** That is a theorem-shape shared across the two, not a rhyme, and
each side can be pointed at in code. Register: **structural.**

### 3.2 What separates the two — and it is not in our favour

The two floors are **not the same functional**. Gaussian policy entropy is Σ log σᵢ; `rhoProxy` is
`1 − variance/maxPossibleVariance`. They agree on the *degenerate* endpoint and nowhere else.
More sharply:

**Their coefficient is earned; our constant is not.** The module says so itself, and this is one
of the very few sites in the tree that stated its own provenance honestly before anyone audited
it (`src/Bayesian/YinYangEnsemble.fs`, at `tsirelsonThreshold`):

> "⚠ **The name is a misnomer** … A DESIGN CHOICE, not a first-principles derivation — the
> *homoiconic linear identification* of the Condorcet ρ-regimes with the Bell/CHSH S-regimes."

ρ_T = 1/(3√2) ≈ 0.2357 is chosen so that two regime diagrams line up. Nothing measures what
happens on either side of it. The paper's Fig. 5a is the exact experiment our threshold has never
had: they **sweep** the entropy-regularisation coefficient against drift frequency and read off a
boundary — a **critical drift frequency of about 1/150 epochs**, consistent with the independently
measured 130-epoch response time of Fig. 4b. Below it, exploration pays for itself; above it, the
exploration noise costs more than the tracking buys and a frozen policy wins.

That is what turns a knob into a metered quantity: not a derivation, a **measured consequence of
setting it wrong in both directions.** Under
`.claude/rules/toy-is-free-metered-must-be-earned.md`, their coefficient is `metered` and
`tsirelsonThreshold` is `unmetered`. Saying so is the whole value of the comparison.

### 3.3 A gap this comparison exposes in our value layer

`src/Core/SoftValue.fs` holds a distribution rather than a point and its `resolve` is a *read*, not
a state transition — so a SoftValue never collapses in the sense the paper forbids. Good. But:

**`observe` sharpens monotonically and there is no widening operator.** Grepping
`src/Core/SoftValue.fs`, `src/Core/DynamicValue.fs`, and `src/Bayesian/*.fs` finds no forgetting
factor, no tempering, no entropy floor, no covariance inflation. Under a **non-stationary** source
the posterior concentrates on stale evidence and has no mechanism to re-open. The paper's σ(t)²
floor is exactly the missing term.

Our only re-widening mechanism in the tree is `reseedIfCollapsed`, and it acts at the *ensemble*
level (replace a cell) rather than the *distribution* level (widen a belief). Those are different
repairs and only one of them is present. **Named gap, not a bug filed** — the honest statement is
that the never-collapse discipline is implemented on the ensemble axis and absent on the value
axis, and the paper's non-stationary setting is what makes that visible.

---

## 4. Connection 2 — "the ECC built in similar to our adinkras but not exactly"

The hedge is correct and it is resolvable to a precise statement in both directions. There is a
real shared object *and* a real gap, and neither cancels the other.

### 4.1 What genuinely transfers: both are isotropic subspaces of the symplectic 𝔽₂ geometry

Their codes — surface and colour — are **stabiliser codes**. So, under the Calderbank–Rains–Shor–
Sloane correspondence, is ours. The repo already derived this leg itself, in
`docs/research/2026-06-12-gates-ecc-tsirelson-math-team-REPORT-6-the-code-is-the-bell-inert-half-the-span-is-nebe-rains-sloane.md`:

> "a doubly-even self-dual code lifts to a **maximal commuting family of involutions in Γ** — a
> stabilizer group. That is CRSS verbatim … codes = isotropic subspaces of the symplectic 𝔽₂
> geometry."

And our code is concrete, in-tree, and named: `src/Core/AdinkraCode.fs` pins the generator matrix
of the **[8,4,4] extended Hamming code** — doubly-even and self-dual — with the doubly-even
property, linearity, minimum distance 4, and the weight of every generator row proved
exhaustively over all 16 codewords in `AdinkraCode.Tests`.

The link to their side is one classical operation away and it is textbook:

- Puncture the [8,4,4] extended Hamming code at any coordinate → the **[7,4,3] Hamming code**.
- CSS(C, C^⊥) on that → the **Steane code [[7,1,3]]** (Steane 1996).
- Which is exactly the **distance-3 triangular 2D colour code** (Bombín & Martín-Delgado 2006) —
  the smallest member of the family whose distance-5 instance this paper runs at
  ε_L = 8.19(14) × 10⁻³.

So the shared object is exhibitable and narrow: **the classical code sitting in
`src/Core/AdinkraCode.fs` is one puncture from the parent of the smallest colour code.** That is
the strongest honest form of "similar."

### 4.2 What does not transfer — three things, each checkable

**(a) Ours is self-dual, so the direct CSS construction yields k = 0.** For a self-dual classical
[8,4] code, CSS(C, C) gives [[n, 2k − n, d]] = **[[8, 0, 4]]** — a stabiliser *state*, not a code
with logical qubits. A surface code has k ≥ 1 by construction; that is the entire point of it.
Our code is the *commuting skeleton*, and REPORT #6 already named what that costs:

> "the code is precisely the sub-structure that cannot violate any Bell inequality … the ECC is
> the Bell-*satisfying* part of the structure."

The same sentence, read against this paper, says: our code is the part that stores nothing.

**(b) Nothing in the tree performs the quantum construction.** Grepping the whole of `src/` for
"stabilizer" returns `src/Core/ClaimLane.fs`, `src/Core/Cl3.fs`, and two TypeScript budget files —
none of them a stabiliser code. There is **no surface code, no syndrome extraction, no detector,
no decoder** in the repo. `src/Core.QSharp.ReferenceOracle/` is a byte-lock parity oracle for a
finite-resolution model (its own README: "it is not a runtime heat sink", "without putting Q# in
the runtime loop"), not a QEC stack.

**(c) The two ECCs correct different things, and this is Aaron's "not exactly" in one line:**

| | theirs | ours |
|---|---|---|
| what drifts | **physical** — qubit frequencies, pulse amplitudes, CZ couplings, in an analogue substrate | **representational** — the same structure diverging across four language oracles and across replays |
| the error model | a stochastic noise channel with a threshold ε_th ≈ 10⁻³–10⁻² | disagreement between oracles, or between a replay and its recorded trajectory |
| the detector | stabiliser measurement producing a syndrome | golden-vector comparison / byte-lock across oracles |
| the corrector | a decoder (AlphaQubit2, Tesseract, sparse blossom) inferring the likely error pattern | **regeneration from the free object** — `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md`: "regenerating from the irreducible IS the correction" |
| distance / threshold | measured, scaled, and the headline result | **neither defined nor measured** |

The last row is the one to sit with. "The generator IS the ECC" is a rule we assert; it has no
distance, no threshold, and no decoder, so it has no *rate* at which it fails. Theirs has all
three and they are the paper's contribution. Both are ECC; they are not the same ECC, and the
asymmetry in evidence runs entirely one way.

**Register: structural at the classical-code layer (§4.1, the shared object is exhibited and
in-tree); the broader reading "our adinkra ECC is like their surface code" is analogy with a
checkable consequence** — and the consequence, k = 0, is checkable today and convicts the broad
reading.

---

## 5. Connection 3 — "compare to our q# and roadmap", and a priority correction

### 5.1 What the repo said, and when

`docs/research/2026-06-12-ferry-13-the-destination-stack-bnn-qnn-transformer-on-qsharp-starts-at-0-training-equals-running-the-sim-mea-cut-braid.md`
— Aaron, streamed, **2026-06-12**, verbatim:

> "it runs on quantium Q# / but it starts at 0 and training and running it are the same thing the
> simulate mesure cut braid"

and the ferry's own peel:

> "No pretrain/deploy split — **one loop is both** … **Bayesian filtering, exactly**: in a filter,
> 'training' (posterior update) and 'running' (prediction) are the same recursion — there is no
> other mode."

The paper's thesis, in the abstract: *"unifying calibration with computation … a quantum computer
that learns from its errors and never stops computing."* Same shape, different substrate: their
"calibration" is our "training," their "computation" is our "running," and both refuse the offline
phase.

### 5.2 The correction — we did not say it first, and the honest form is better anyway

The framing that produced this document offered the ferry’s date as the headline **if** the
repo said it first. It did not, and rounding that up would be exactly the failure the register
rules exist to prevent:

- This paper was **received 11 November 2025** — seven months *before* the 2026-06-12 ferry.
- Its own lineage is older still: Kelly et al., *"Scalable in situ qubit calibration during
  repetitive error detection"* (Phys. Rev. A **94**, 032321, 2016), which this paper credits as "a pioneering
  attempt … to leverage this by engineering a direct feedback loop from error detection to
  physical control"; Sivak et al., *"Model-free quantum control with reinforcement learning"* (PRX
  12, 2022); Sivak et al., *"Real-time quantum error correction beyond break-even"* (Nature 616,
  50–55, 2023).

**Priority belongs to the paper, comfortably.** What the repo has is an *independent arrival in its
own vocabulary*, with no prior exposure to this work claimed and none needed. Under
`.claude/rules/anti-babel-preserve-reconcilability.md` that is the more interesting datum anyway:
a coinage generated inside the factory ("training and running are the same thing … the sim·mea·cut
braid") compresses cleanly onto an externally-anchored term ("unifying calibration with
computation") without loss. **That is the Mirror→Beacon compression succeeding on a live case.**
It is a reconcilability result, not a priority result, and calling it the latter would be
flattering the history — the failure mode already on file at
`user_aaron_history_optimizes_the_flattering_reading_for_everyone_*`.

### 5.3 The transferable consequence ferry-13 does not carry

The paper supplies something the ferry's claim lacks, and it is a genuine cost:

> "the algorithm inevitably samples policy candidates whose performance is worse than that of the
> μ(t) policy. This 'exploration noise' is irrelevant in our experimental setting … However, in
> the future, this steering must be done in real time during the single-shot execution of a long
> logical algorithm. In that case, the exploration noise, although necessary for learning, will be
> detrimental to the performance of the logical algorithm."

**Unifying training with running is not free.** The running system pays for the learner's
exploration, and Fig. 5a shows there is a **regime where a frozen policy wins** — above the
critical drift frequency, online adaptation is strictly worse than not adapting. Ferry-13's claim
is stated without that boundary. The checkable prediction for us: any implementation of
`sim·mea·cut` as *the training algorithm* should exhibit a drift rate above which it
underperforms a frozen model. If it does not, either the exploration is not doing anything or the
comparison was never run.

### 5.4 The rest of the Q#/QNN lane, and where it actually stands

The lane exists and is honest about itself. Ferry-13, §3, at ferry time:

> "the Q# lane is **simulator-backed** today … **P0-B stands as the blocker**: the bridge functor
> from our braid/qubit structures to the quantum semantics (QubitIso) is missing … The QNN rung is
> a destination, priced by an already-filed P0, not a current capability."

Read against this paper that scoping holds up. The relevant surfaces:
`src/Core.QSharp.ReferenceOracle/` (ZetaReferenceOracle.qs, DbspOperators.qs,
QuantumTransactionPorts.qs, ZSetISA.qs, `qsharp-golden.json`),
`docs/research/2026-06-10-quantum-language-oracle-qsharp-toymodel-validates-fsharp-realmodel-*`,
`docs/research/2026-06-10-vera-brief-qsharp-reference-oracle-for-the-finite-resolution-qubits-framework.md`,
`docs/research/2026-05-04-b-0189-q-sharp-bayesian-bp-ep-runtime-literature-survey.md`.

**What that lane is:** a fourth oracle for byte-lock parity on a finite-resolution model.
**What it is not:** a QEC stack. Nothing in it detects, decodes, or corrects a physical error.
The distance between "we have a Q# lane" and "we have a QEC roadmap comparable to this paper" is
the whole of the paper.

---

## 6. Correspondence Aaron did not name — "errors teach"

`docs/research/2026-08-09-errors-teach-both-sides-cli-and-protocol-error-as-training-signal-for-the-online-bnn-aaron.md`,
Aaron, streamed **2026-08-09**:

> "the errors are costly so they should teach every time, so the other side can learn and become
> better. i'm building an online learning BNN … it will fit right in with this vibe"

and the doc's peel: *"the value of an error message is exactly the **uncertainty it removes from
the peer** — Shannon's definition, applied to the failure path."*

The paper's central move is the same sentence in a different substrate: error-detection events are
"not only used to correct the logical quantum state but are also repurposed as a learning signal."
Ours is dated and independent; theirs is again earlier (received 2025-11-11), and again the
priority is not the point.

**The consequence that transfers is a Goodhart guard, and it is the half our doc does not have.**
An error signal used as a training signal creates an incentive to *suppress the signal* rather
than the error. The authors check this explicitly rather than assuming it:

> "To confirm that suppression of detection events is not due to hindered detection capability but
> is due to suppressed errors, we evaluate the logical performance in Fig. 4c."

That check — *did the agent reduce errors, or did it break the detector?* — is the exact failure
mode "errors teach" invites and does not name. **Register: analogy with a checkable consequence**,
and the consequence is a specific test any teaching-error design here must carry.

---

## 7. The surrogate objective — the most transferable thing in the paper

This is the section to keep even if every other correspondence in this document is discarded.

### 7.1 Their problem, and why the obvious objective is unusable

The quantity they actually care about is the logical error rate ε_L. They cannot optimise it. The
Methods give three reasons, quoted:

> "(1) The LER is suppressed with the code distance d as ε_L ∝ Λ^(−d/2) … Thus, accurately
> resolving the LER would require an exponentially large number of QEC cycles. (2) The
> optimization involves a vast number of parameters—already more than 2,000 in our d = 7
> experiment, and scaling as O(d²)—which renders global optimization from a single scalar metric
> impractical. (3) The LER is unsuitable for real-time calibration and steering during a quantum
> computation, as the logical state is generally unknown."

So they optimise a proxy: **C = Ê[D]**, the average rate of error-detection events over all
detectors — cheap, local, computable from data already flowing, and resolvable to fixed relative
accuracy in O(ε⁻¹) cycles **independent of code distance**.

### 7.2 The discipline: they measured that the proxy tracks the objective

A proxy is a liability until someone checks it. They derive the expected relation from the scaling
model — since C ∝ ε, ∇log ε_L = ((d+1)/2)·∇log C — and then, rather than assert it:

> "To confirm that this relation is approximately satisfied in a real experimental setting, we
> sample Gaussian perturbations in the control parameter space and evaluate finite-difference
> partial derivatives (Fig. 2c). We observe good empirical agreement in the regime of small
> perturbations."

Fig. 2c is a scatter of ∂_p log ε_L against ∂_p log C along random directions in a >1,000-
dimensional space, with the predicted slope (d+1)/2 drawn on it. **The proxy's validity is an
experimental result with a stated regime of validity ("small perturbations"), not a modelling
assumption.**

And §6's check is the second half of the same discipline: having established the proxy tracks the
objective *in gradient*, they separately verify that driving the proxy down actually moved the
objective, by measuring logical performance (Fig. 4c) rather than trusting the surrogate.

### 7.3 Our own proxy, and what happened to it

`docs/research/2026-08-22-the-decorrelation-meter-left-its-band-and-i-may-be-the-reason.md`,
settled the day it was written. The ρ statistic in
`src/Core.TypeScript/society/effective-agent-count.ts` —

```
independentUnion = 1 - (1 - c)^n
ρ = (independentUnion - observedCoverage) / (independentUnion - c)
```

— was carried as a "standing claim about how much plurality the society is actually buying," with
a declared band [0.3, 0.6] and a test that went red at 0.6012. The settlement:

> "ρ over an append-only corpus is a **ratchet**: simulate three agents whose sampling
> distribution never changes and the cumulative ρ climbs from 0 to 0.95 as the corpus grows. The
> bound was going to fail on a timer no matter what the fleet did."

**The proxy was measuring corpus growth, not agent correlation.** Nobody had run the analogue of
Fig. 2c — perturb the thing you care about and check the proxy's gradient follows. The refutation
came from a time series (`db/effective-agent-count/`, `src/Core.TypeScript/society/rho-series.ts`)
that could have been run at any point since the meter was written.

### 7.4 The rule this states, which we already hold and did not apply

> **A surrogate objective is `unmetered` until its gradient has been measured against the true
> objective's gradient, on the real system, with a stated regime of validity. Until then it is a
> number that moves, not a measurement of the thing you care about.**

This is `.claude/rules/toy-is-free-metered-must-be-earned.md` and
`.claude/rules/anchor-to-human-prior-art.md`'s "checked, not merely cited" applied to *meters*
rather than to models and citations. It is also the general form of the vacuity class: a proxy
nobody validated is a check that cannot fail in the direction you care about.

**Register: structural (methodological).** The shared object is exhibited on both sides — a cheap
local statistic standing in for an expensive global one, plus the question of whether its gradient
tracks. The asymmetry is that they answered the question and we did not, and were wrong.

**Beacon anchors for the general form:** Goodhart (1975) — a measure that becomes a target ceases
to be a good measure; Manheim & Garrabrant, *Categorizing Variants of Goodhart's Law* (2018), whose
"regressional" and "extremal" variants are exactly the two failures above (a proxy valid only in a
small-perturbation regime, and a proxy that drifts from the objective as the corpus grows).

---

## 8. One more, offered at its true register — the factor graph

Both sides use a factor graph, and it is the same mathematical object (Kschischang, Frey &
Loeliger 2001): a bipartite graph of factor nodes and variable nodes. Theirs is detectors ×
control parameters, with the measured density quoted in §2.1. Ours is `src/Core/InferenceLadder.fs` and
`BpExactOnTree.tla`, running BP/EP.

**But the uses differ**, and pretending otherwise would be the count-matching error. They do not
run belief propagation on it; they use its sparsity for **gradient masking** — variance reduction
of the Monte-Carlo gradient estimator, a technique they take from appendix G of Sivak, Newman &
Klimov's decoder-prior work. We run inference on ours and do no gradient estimation.

**Register: analogy with a checkable consequence.** The consequence is concrete and small:
gradient masking over a known sparsity pattern is a variance-reduction technique our BP/EP
machinery is positioned to adopt, and it is the kind of thing that is either measurable as a
variance reduction or it is nothing.

---

## 9. Register table (`.claude/rules/numerology-vs-number-theory.md`)

Dense-resonance session, so every connection is triaged rather than exempted. Five entries,
different verdicts.

| connection | register | the shared object, or the consequence |
|---|---|---|
| **never-collapse ⇄ entropy regularisation** (§3) | **structural** | *Object exhibited:* a floored-spread sampling distribution over a candidate population. *Invariant shared:* the estimator built on it carries zero information at zero spread — their PEPG gradient, our Condorcet gain, same fact. Sites: `src/Bayesian/YinYangEnsemble.fs` ↔ π(θ)=N(μ, diag σ²). |
| **surrogate objective ⇄ our ρ meter** (§7) | **structural (methodological)** | *Object exhibited:* cheap local statistic proxying an expensive global one, plus proxy-tracking verification. Fig. 2c is the verification; `effective-agent-count.ts` is the same construction with the verification missing, and it was wrong. |
| **adinkra ECC ⇄ surface/colour codes** (§4) | **structural at the classical-code layer; analogy (convicted) at the broad reading** | *Object exhibited:* isotropic subspaces of the symplectic 𝔽₂ geometry (CRSS). `src/Core/AdinkraCode.fs`'s [8,4,4] is one puncture from [7,4,3] Hamming → Steane [[7,1,3]] → the d=3 colour code. *Convicting consequence:* CSS(C,C) on a self-dual [8,4] gives **k = 0**; a surface code has k ≥ 1. |
| **"training = running" ⇄ "unifying calibration with computation"** (§5) | **analogy with a checkable consequence** | *Consequence:* exploration is not free. Fig. 5a exhibits a drift regime where a frozen policy beats the online learner. Prediction for `sim·mea·cut`-as-training: such a regime must exist, or the exploration is inert. **No priority claim** — the paper was received seven months before the ferry. |
| **"errors teach" ⇄ detection events as learning signal** (§6) | **analogy with a checkable consequence** | *Consequence:* the Goodhart guard. Optimising an error *signal* invites suppressing the detector rather than the error; the paper checks this (Fig. 4c) and our doc does not name it. |
| **factor graph both sides** (§8) | **analogy with a checkable consequence** | Same object (Kschischang–Frey–Loeliger), different use — BP vs gradient masking. Consequence: gradient masking is an adoptable variance reduction, measurable or nothing. |
| **"optimization speed independent of system size" ⇄ manifesto §1 scale-free** | **coincidence** | Same words, different referents. Theirs is an empirical property of a gradient estimator's convergence rate γ; ours is a design constraint forbidding a central point of control. Recorded so it does not silently become a belief. |
| **their entropy-regularisation sweep range (10⁻³–10⁻¹) ⇄ our ρ_T ≈ 0.2357** | **coincidence — refused** | No relation. Different quantities, different units, different roles. Noted only because a number-to-number comparison was available and would have been numerology. |

---

## 10. The falsifiers — what would show this is superficial

**The strongest one first, because it is the look-elsewhere check and it convicts two rows.**

> **Substitute an arbitrary RL-under-non-stationarity paper for this one. Which claims survive
> unchanged?**

- §3 (never-collapse ⇄ entropy regularisation) — **survives**. Any entropy-regularised policy-
  gradient paper gives it. So it is *true and low-information*: it tells us our never-collapse
  instinct is standard practice in RL, which is worth knowing and is not a discovery.
- §5 (training = running) — **survives**. Any online-learning paper gives it.
- §4 (the ECC) — **does not survive.** It needs stabiliser codes specifically, and it produces a
  falsifiable arithmetic statement (k = 0).
- §7 (the surrogate) — **does not survive.** It needs the (d+1)/2 relation, Fig. 2c, and the
  hindered-detection check.

**So §4 and §7 are the two that carry information specific to this paper. §3 and §5 are real and
generic.** That is the honest ranking, and it is the answer to "do not return five interestings."

**Per-connection falsifiers, each runnable:**

1. **§3 is superficial if spread buys no tracking.** Drive `YinYangEnsemble` with a drifting source
   at a range of drift rates and plot tracking error against ρ. If no critical drift frequency
   appears — no rate above which reseeding costs more than it buys — then our ensemble diversity
   is not doing the job entropy regularisation does, and the shared "estimator degenerates at zero
   spread" fact is present but inert. The paper's number to beat: theirs is ≈ 1/150 epochs against
   a 130-epoch response time.
2. **§4 is superficial the moment the construction is actually attempted.** Run CSS(C, C) on
   `AdinkraCode.generator`. It yields [[8, 0, 4]] — zero logical qubits. If anyone ever writes
   "our adinkra ECC protects data the way a surface code does," that computation refutes it, and
   it takes four lines of GF(2) arithmetic.
3. **§5 is superficial if there is no exploration cost.** Implement `sim·mea·cut` as the training
   loop and search for the drift regime where a frozen model wins. If none exists at any drift
   rate, the loop is not exploring and "training = running" is a naming convention.
4. **§7 is superficial if our meters are already validated.** Audit every standing numeric band in
   the tree for whether anyone ever measured that the statistic tracks the thing it claims to
   measure. `effective-agent-count.ts` failed that audit on 2026-08-22. If it turns out to be the
   only one, the lesson is narrow. If it is not, §7 is the most useful section here.
5. **The whole document is superficial if none of the above is ever run.** A correspondence that
   generates no measurement is a resonance doing its proper job as a generator — and nothing more.
   This document is written so that four specific measurements are available and named; the
   register table stays as written until one of them is performed.

---

## 11. Anchors (Beacon)

**The paper's own lineage, as the paper cites it:**

- Shor, P. W. *Scheme for reducing decoherence in quantum computer memory.* Phys. Rev. A **52**,
  R2493 (1995) — the origin of QEC, the paper's reference 1.
- Nielsen, M. A. & Chuang, I. L. *Quantum Computation and Quantum Information* (CUP, 2010).
- Sutton, R. S. & Barto, A. G. *Reinforcement Learning: An Introduction* (MIT Press, 2018) — the
  exploration/exploitation trade-off the paper cites at its own limitation.
- Sehnke, F. *et al.* *Parameter-exploring policy gradients.* Neural Netw. **23**, 551–559 (2010)
  — the algorithm the whole learner is built on; a policy is sampled *in one piece*, which is what
  makes the interface to a classical controller clean.
- Schulman, J., Wolski, F., Dhariwal, P., Radford, A. & Klimov, O. *Proximal policy optimization
  algorithms.* arXiv:1707.06347 (2017) — stability.
- Haarnoja, T., Zhou, A., Abbeel, P. & Levine, S. *Soft actor-critic: off-policy maximum entropy…*
  — **entropy regularisation**, the mechanism §3 turns on.
- Mohamed, S., Rosca, M., Figurnov, M. & Mnih, A. *Monte Carlo gradient estimation in machine
  learning.* JMLR **21**, 1–62 (2020) — the estimator that gradient masking reduces the variance of.
- Mnih, V. *et al.* *Human-level control through deep reinforcement learning.* Nature **518**,
  529–533 (2015) — the replay buffer.
- Gidney, C. *Stim: a fast stabilizer circuit simulator.* Quantum **5**, 497 (2021); McEwen, Bacon
  & Gidney — **detecting regions**, the locality that makes the factor graph sparse.
- Higgott & Gidney — sparse blossom; Beni, Higgott & Shutty — **Tesseract**; Senior *et al.* —
  **AlphaQubit2**: the decoders behind the two headline numbers.
- Kelly, J. *et al.* *Scalable in situ qubit calibration during repetitive error detection.* Phys.
  Rev. A **94**, 032321 (2016) — the
  prior attempt this work supersedes, and the reason §5.2's priority correction was necessary.

**Our side:**

- Doran, Faux, Gates, Hübsch, Iga & Landweber. *Relating doubly-even error-correcting codes,
  graphs, and irreducible representations of N-extended supersymmetry.* J. Phys. A (2008),
  arXiv:0806.0051 — the adinkra ↔ doubly-even code correspondence, cited in `AdinkraCode.fs`.
  **S. James Gates Jr.** is the named human anchor for the ECC-in-the-adinkra claim.
- Calderbank, Rains, Shor & Sloane. *Quantum error correction and orthogonal geometry.* PRL (1997);
  *…codes over GF(4)* (1998) — **the bridge**: codes as isotropic subspaces of the symplectic 𝔽₂
  geometry, which is what makes §4.1 a shared object rather than a rhyme.
- Steane, A. M. *Error correcting codes in quantum theory.* PRL **77**, 793 (1996) — [[7,1,3]].
- Bombín, H. & Martín-Delgado, M. A. *Topological quantum distillation.* PRL **97**, 180501 (2006)
  — colour codes; the family the Steane code is the d=3 member of.
- Nebe, Rains & Sloane. *The invariants of the Clifford groups.* Des. Codes Cryptogr. **24** (2001)
  — the span REPORT #6 identified.
- Condorcet (1785) — the jury theorem behind `YinYangEnsemble`'s ρ and its collapse condition.
- Kschischang, Frey & Loeliger. *Factor graphs and the sum-product algorithm.* IEEE Trans. Inf.
  Theory **47** (2001) — §8's shared object.
- Goodhart, C. (1975); Manheim, D. & Garrabrant, S. *Categorizing Variants of Goodhart's Law*
  (2018) — §7's failure taxonomy.

**In-tree surfaces this document reads (all verified present at the commit it was written on):**
`src/Bayesian/YinYangEnsemble.fs` · `src/Core/SoftValue.fs` · `src/Core/AdinkraCode.fs` ·
`src/Core/E8Lattice.fs` · `src/Core.QSharp.ReferenceOracle/` ·
`src/Core.TypeScript/society/effective-agent-count.ts` ·
`docs/research/2026-06-12-ferry-13-*` · `docs/research/2026-06-12-gates-ecc-tsirelson-math-team-REPORT-6-*` ·
`docs/research/2026-07-10-keystone-never-collapse-the-uncertainty-*` ·
`docs/research/2026-08-09-errors-teach-both-sides-*` ·
`docs/research/2026-08-22-the-decorrelation-meter-left-its-band-*` ·
`docs/research/2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md`
