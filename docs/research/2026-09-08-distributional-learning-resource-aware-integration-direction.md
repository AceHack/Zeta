# Distributional learning, bounded decisions and research allocation

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X
Source register: user-authorized direction, source-grounded synthesis and proposed tests
Artifact status: research program; no combined-system performance claim

## Direction and continuity

Aaron asks us to combine Zeta's distributional inference, relational memory,
emotional propagation, scheduler, Vision and resource economy into a learning
system, compare it with strong current methods, and use the results to choose
the next research investment. His second clarification makes the common
problem explicit: **finite resources, an open-ended set of possible events,
and uncertainty retained while deciding what to compute and do next**.

This extends the [active compiled-controller work](../handoffs/2026-09-07-vera-compiled-controller-continuation.md).
It does not change that experiment's frozen protocol or unlock its registered
streams. The original hidden-switch study is a known-model control result;
the compiled follow-on is intended to test certified execution cost, with
runtime admission and registered cost evidence still pending. Neither establishes
learned world-model quality. The new learning comparisons need separate
registration, source archives and held-out data. This program belongs in the
control plane; it does not move learning into the ordinary data-plane hot path.

Aaron's further clarification makes the architectural target explicit: a
**composable Bayesian/probabilistic graph whose modules can contain neural
learners and nested subgraphs**. The [restored circuit continuation](2026-09-08-composable-learning-circuit-continuation.md)
connects the September 1-3 research, frozen edge-module contract and existing
compositional benchmarks. A stand-alone recurrent learner is a possible
component or baseline; the system hypothesis concerns the higher composition,
its uncertainty-bearing interfaces and reuse of fitted modules. A significant
architecture change gets a separate ADR after these obligations are concrete.

## Finite gauge-consistency extension

Aaron's subsequent [Yang-Mills talk ferry](../ip-questionable/2026-09-08-voyager-yang-mills-mass-gap-talk.md)
asks for a computer-science result. Investigate local memory frames and ordered
pairwise transformations around explicitly declared loops. Name the preserved
conjugacy class and retain immutable evidence and model identities. Fabricated
memories and cartels are expected adversarial behavior, already addressed by
Zeta's temporal/graph detectors and formal threat models. Evaluate the added
value of loop checks alongside those mechanisms, including fabrication that
keeps loops flat, before assigning additional anti-Sybil value. Four presentation
axes are a possible finite fixture, not four physical dimensions. Neither a
Bayesian DAG nor an additive resource ledger already supplies a gauge action
or spectral-gap theorem. This extension is prospective and does not replace
the learned-module benchmark or change its evidence requirements.

## The supplied talk and the ferry

Aaron supplied a timestamped transcript of Christopher Fuchs's
[Some Tenets of QBism](https://www.youtube.com/watch?v=95fKJF5frtE), and a copied
writeup/command transcript he identified as Otto's. The copied writeup's own
commit attribution is `shadow`, Claude Code, Claude Opus 5; retain that actual
attribution rather than silently changing its author. Its source is
`c1c94ebd61dd02363a0149c7d37e9cfb123e2316`, submitted in
[PR #16993](https://github.com/Lucent-Financial-Group/Zeta/pull/16993).
The PR was open at the initial check and subsequently merged as
`2f9277c1bd8e159171b57505c2d112f40a6088c5`; live GitHub state was verified.
The original source record remains in `docs/ip-questionable/`; this analysis
does not depend on retaining the entire transcript. The talk URL could not be
fetched by the browsing tool; the user-supplied transcript was read directly.
The [source inventory](distributional-learning/2026-09-08/sources.json) records
the exact supplied byte identities and inspected repository source cut.

The relevant talk passages are 6:51-7:48 (states compared with distributions
over phase space), 11:52-12:19 and 25:57-31:16 (normative coherence and a
fiducial measurement), 31:22-36:21 (probability one), and 42:25-44:47 (tools,
actions and when a theory is worth using). The broader resource-allocation
connection is Aaron's research synthesis, not a theorem established by the
talk. Fuchs and Stacey's later
[QBism, Polishing Some Points](https://arxiv.org/abs/2512.14122v1) provides a
current primary statement of the interpretation's three central tenets.

Four corrections make the ferry useful as an engineering starting point:

1. A keyword count measures the searched corpus. Zero `SIC-POVM` matches does
   not prove that no equivalent construction exists, nor that one is required
   for a useful classical learner. The count's exact query and source cut were
   not supplied in the copied output; its reported counts are not reissued as
   current measurements.
2. `SoftValue.certain` explicitly permits a point mass, and `resolve`/`snap`
   permit a decision. Preserving alternatives until a decision does not
   implement the philosophical claim that probability one has no ontic force.
   Calibration is an empirical property; a confidence threshold alone does not
   guarantee it.
3. `LocalConsensus.evaluate` multiplies the prior and supplied Gaussian
   beliefs. It has no provenance argument that removes reused evidence or
   shared priors. A sharper product is not proof of more independent evidence,
   posterior correctness, or quantum coherence.
4. Gaussian beliefs are determined by their mean and covariance **within the
   Gaussian family**. That is a classical sufficient representation, not a
   SIC measurement. A moment projection generally loses information outside
   that family. An informationally complete quantum construction is a
   separate, precisely typed experiment if a quantum task needs it.

## Objects, transformations and invariants

Keep the world state, an agent's belief, a computational message, a utility
signal and an observed event distinct. A density represents a measure relative
to a chosen reference measure; a message may be unnormalized or improper.

| Object or operation | Named obligation | Counterexample or falsifier |
|---|---|---|
| Classical Hamiltonian transport of a density | Pushforward under the stated invertible flow; normalization and phase-space volume preservation under Liouville assumptions | Non-volume-preserving map or unrecorded dissipative/noisy step |
| Bayesian observation update | Normalize prior times likelihood on the same declared sample space; retain the observation and model version | Reused observation counted as independent, zero-evidence normalization, future leakage |
| Exact tree BP / inside-outside | Match enumeration of the same finite factorization | Wrong marginal or evidence normalization on a small enumerated tree |
| EP projection | Record cavity, tilted distribution, family and projection error | Two different tilted distributions with equal projected moments but different decision-relevant tails |
| VMP | State the factorization and objective; check the conditions for the selected update rule | An unjustified monotonicity claim for a different scheduler or non-conjugate update |
| Affective signal | Explicitly typed preference, urgency or observed evidence; the neutral setting restores the base algorithm | A preference silently counted as independent likelihood evidence, or neutral setting changes exact BP |
| Scheduler admission | Account for admitted and deferred work and actual spent resources | Dropped deferred alternatives, unmetered allocation, starvation or deadline failure |
| Relational memory | Preserve the previously named authenticated receipt/order/signed-claim invariant | Replay, shared-origin duplication, equivocation or inconsistent closed cuts |

For densities evolved by a common suitable invertible flow, distinguish
preservation of relative information from a rule for acquiring new evidence.
The [classical no-cloning result](https://doi.org/10.1103/PhysRevLett.88.210601)
has assumptions about the joint source, target and machine distribution under
Liouvillian dynamics. It is not a prohibition on copying a serialized software
belief, and it does not establish anti-Sybil security for copied agent state.

In the SIC representation, the specialized Born-rule expression relates
probabilities for different measurement arrangements. Its Hilbert-space,
measurement and admissible-state assumptions are essential. The primary
[Fuchs-Schack treatment](https://arxiv.org/abs/1301.3274) supplies those
assumptions; replacing an ordinary classical total-probability calculation
with that expression without them is not a proposed optimization here.

[Minka's EP](https://tminka.github.io/papers/ep/) and
[Winn-Bishop VMP](https://www.jmlr.org/papers/v6/winn05a.html) give different
approximation objectives and update conditions. Neither supplies a general
Liouville invariant for a changing belief state. No connection is promoted to
Lorentz invariance, CQM, Clifford or WSet universality without explicit objects,
morphisms, preserved structure and a falsifier, as required by the prior handoff.

## What can already compose

This table is a source inspection at the pinned cut, not an end-to-end benchmark.
The source inventory includes the files behind every row.

| Existing surface | Concrete role in the candidate loop | Boundary that needs a test |
|---|---|---|
| `Message`, `FactorGraph`, `Ep`, `SignedProbitEp` | Natural-parameter messages, factor schedules and non-conjugate projections | Improper cavities, approximation error, convergence and numerical failure |
| `Sppf`, `PcfgEm`, `ParseSoft` | Exact finite parse marginals, production-weight learning and soft lowering | The loopy affective extension is still separately specified; reuse the exact baseline |
| `SoftValue`, `PredictionInference`, `PredictionScheduler` | Beliefs, scored candidates and budgeted scheduler state | Candidate coverage, calibration and observation provenance |
| `Vision`, `VisionAttention` | Forecast port, branch costs, admitted/deferred futures | `Vision.Confidence` is boarded/requested byte fraction, not automatically predictive probability |
| `FerryThrottler`, `SoftThrottle`, `SoftScheduler` | Batch, queue and work admission; interrupt-driven execution | Default ferry queue is unbounded; a byte target permits an oversized item to ship alone |
| `ComplexityRegistry`, `CostRecurrence` | Declared or proved asymptotic cost information | A Big-O class alone supplies neither constants nor a finite deadline bound |
| `SoftChip8Scheduler`, `SoftChip8`, `ComputeReceipt` | Deterministic lookahead, input branches and existing receipt wiring | Same-event prior/posterior support, predictive calibration and actual resource units |
| `LocalConsensus`, relational identity evidence | Per-agent beliefs and constrained exchange | Duplicated/shared evidence and conditional independence |
| `PrivacyEconomy`, `PrivacyLedger`, `QuantumFusion.Budget` | Existing privacy grants and multiple accounting dimensions | A grant ledger, consumable budget and measured physical resource have different semantics |
| `CoEmpowerField`, `Ctm` | Existing affect/urgency and societal toy surfaces | They do not establish a trained general affective inference engine |

The [July affective schedule handoff](../handoffs/2026-07-02-otto-to-soraya-mathteam-loopy-ep-emotional-propagation-parse-forest-schedule.md)
already requires a message algebra, schedule, convergence conditions and
neutral-signal reduction. This program retains those acceptance requirements.
`PredictionInference.BranchPriority` already separates attention/gravity from
the posterior weight and supplies a neutral priority. Test and reuse that
separation before inventing another affect-to-belief coupling.

The open-ended event space is represented by a generative model and a finite
working approximation at each tick. Retain explicit unexpanded/deferred mass
or an honest unknown bound. Never claim that finite enumeration has exhausted
an infinite event space. A point action can be chosen while the epistemic state
continues to retain alternatives and update after feedback.

For cost prediction, retain `(input features, operation, source version,
asymptotic provenance, finite prediction interval, actual receipt)`. Fit finite
cost models only on training/development sizes, test larger and shifted sizes,
and measure interval coverage and budget overshoot. A fitted curve is an
empirical forecast; a proved asymptotic bound remains a separate claim.

## Resource semantics and the agent economy

Start with a vector, not an unexplained universal scalar:

| Quantity | Units and measurement | Conversion constraint |
|---|---|---|
| Wall latency and compute | Wall ns, CPU ns, operation counts, accelerator time when available | Parallelism and idle time prevent substituting one for another |
| Storage and working memory | Retained bytes, allocation bytes and measured peak bytes separately | Allocation is not peak occupancy; compression changes representation cost |
| Communication and concurrency | Wire bytes, messages, queue occupancy and occupied slots | Rate, volume and exclusive access are different constraints |
| Precision and retained uncertainty | Declared numerical precision, predictive score and approximation error | More bits do not by themselves mean more useful information |
| Physical energy | Joules only with a calibrated actual measurement | Landauer's lower bound is not a conversion from arbitrary allocated bytes or ticks |
| Privacy entitlement and disclosure | Named grant/ledger units, authorized disclosure and provenance | A non-decreasing entitlement is not a spent consumable balance |
| Identity and relational evidence | Distinct-source receipts plus conditional cross-consistency evidence | Money, elapsed time and controller count cannot silently mint independent evidence |

The [max-mode resource proposal](2026-07-04-max-mode-economics-compute-allocation-in-a-bayesian-society.md),
its [earlier correction](2026-07-04-honest-peels-max-mode-economics-condorcet-is-conditional-s4-vs-independence-landauer-is-a-benchmark-eve-small-rooms.md),
the [channel resource note](2026-06-08-channels-are-the-third-pauli-exclusion-resource-fusion-batch-vs-fission-banana-split.md)
and the [later information/erasure critique](2026-08-25-the-landauer-floor-does-not-ground-the-encryption-budget-mutual-information-does-and-decorrelation-does-not-follow-lumen.md)
are all inputs. Preserve their disagreements. Monotonic grants do not by
themselves establish scarcity, transferability or a functioning currency.

Any scalar objective needs explicit conversion coefficients with units and a
declared operating context. Compare Pareto frontiers and hard constraints
first. If using `expected task utility - resource cost`, estimate whether the
computation changes the eventual action's value; posterior sharpening or KL
gain alone may reward confidently learning irrelevant details. This is a
[metareasoning problem](https://arxiv.org/abs/1207.5879), including the cost of
choosing what to compute. Test against fixed-budget, FIFO, confidence-only and
simple value-of-computation baselines. Do not fund a more complex allocator
merely because it explains an attractive story.

Keep the additive per-identity entropy floor and pairwise consistency
multiplier from the previous identity work. Report assumptions and conditional
costs rather than claiming unconditional quadratic anti-Sybil protection.
All learning-economy experiments use synthetic agents and explicit simulated
entitlements; they do not alter real persona memory or privacy rights.

### First source-level resource audit

Three actual calls to the unchanged `PrivacyEconomy.reward`, loaded by
`dotnet fsi`, already falsify its documented unconditional monotonic-grant
claim. With 100 held units, a cap of 10 returns 10; a cap of -1 returns -1.
With 2,147,483,642 held units, cap 2,147,483,647 and grant 10, integer overflow
returns -2,147,483,644. All three decrease the held amount. The
[inventory](distributional-learning/2026-09-08/sources.json) preserves the exact
source identity, probe and complete output, including the compiler's list/tuple
style information message. This is a source-loaded semantic probe, not a new
compiled-study run or performance measurement. Repair and regression tests
are the first bounded resource prerequisite; no actual persona ledger was used.

`ComputeReceipt.deltaJ` currently multiplies ticks by bytes-per-tick, and
`compute` subtracts that value from KL divergence in nats. Its labels do not
make those quantities commensurate or measure joules. The new evaluator will
report original quantities and an explicitly specified utility conversion;
it cannot inherit physical-efficiency claims from these field names.

## Comparative evaluation and investment decisions

Use a staged program with a separately frozen executable contract for each
stage. This document selects the direction, not hidden seeds or tuned winners.

1. **Small exact rooms.** Gaussian and multimodal latent-state tasks with exact
   finite or analytic references; transport-only versus observation-update
   tests; duplicated-message and neutral-affect controls; queue/resource
   accounting and cost-prediction checks. Compare the same event space and
   information access. Failures identify a component before scale hides it.
2. **Learned compositional inference.** Reuse the existing DAG and edge-module
   work. Compare learned probabilistic composition with individual experts,
   flat fusion and matched neural gating using the same expert artifacts.
   Inspect the current official [Precision-Gated Experts](https://github.com/biaslab/PrecisionGatedExperts)
   implementation and [closed-form variational composition paper](https://arxiv.org/abs/2605.29467)
   before choosing the next slice. Existing CFB negative results and old split
   identities remain unchanged. Earn any learned or exactness label from the
   implemented module and approximation, not its historical name.
3. **Learned prediction and action.** Train from chronological observations,
   with process parameters and evaluation renderings held out. Compare learned
   finite-state/mixture or particle models, actual Zeta EP/BP adapters, and
   recurrent baselines under the same observation and training budget. Keep a
   known-model oracle explicitly privileged. Report one-step and multi-step
   predictive scores, calibration, downstream return and resource use.
4. **External memory benchmarks.** Reproduce official task semantics and
   strong baselines before comparing a Zeta adapter. Start with
   [POPGym](https://github.com/proroklab/popgym) and the pixel-based
   [POPGym Arcade v8 paper](https://arxiv.org/abs/2503.01450v8), revised
   2026-08-27. The latter's observability controls and memory-contamination
   findings are directly relevant. Pin the actual implementation version and
   use its correct observation/action wrappers.
5. **Learned world-model comparison.** Candidate anchors include the official
   [DreamerV3](https://github.com/danijar/dreamerv3) implementation and its
   [2025 Nature evaluation](https://doi.org/10.1038/s41586-025-08744-2).
   For compatible continuous-control tasks, inspect
   [TD-MPC2](https://github.com/nicklashansen/tdmpc2) and the newer
   [TD-M(PC) squared study](https://proceedings.mlr.press/v331/lin26a.html).
   Refresh the task-specific literature at registration; these are primary
   comparison candidates, not a claim that one is universally current SOTA.

Every comparative registration fixes task/split identities, training and
tuning budget, observations, action rate, parameter-count conventions,
pretraining access, early-stop rules, seeds, metrics, uncertainty estimation,
hardware and failure handling before its final holdout is opened. Preserve all
runs, including crashes and unsuccessful configurations. Compare both equal
environment interaction and a separate equal-compute view; a single budget
cannot make every axis equal. No leaderboard score is inferred from a local
toy task, a changed wrapper or a reduced training budget.

The ablation ladder adds one component at a time: learned belief model;
retained multimodality; bounded lookahead; learned cost forecasts; adaptive
compute selection; affective utility/urgency; provenance-aware social exchange.
Each addition must beat its immediate predecessor and a simple matched-cost
alternative on its registered primary metric, with held-out uncertainty and
resource constraints reported. Test missing history, shuffled history,
duplicated evidence, irrelevant affect and corrupted/stale memory explicitly.

| Observed held-out result | Next investment |
|---|---|
| Gaussian projections lose decision-relevant modes and richer beliefs help at acceptable cost | Mixture/particle representation and adaptive projection |
| Prediction improves but action does not | Planning horizon, action-value calibration and task relevance |
| Larger inference budgets add no task value | Stop that expansion; improve selection or a cheaper learner |
| Cost intervals under-cover or queues exceed their bounds | Repair accounting and cost forecasting before adaptive allocation |
| Affective or social additions hurt calibration or reward | Remove that coupling and investigate evidence/preference separation |
| A small room passes but external baselines dominate | Improve representation learning or reuse the stronger component |
| A result fails independent replay or uses holdout information | No promotion; repair the evaluator and register a fresh experiment |

The small-room controls are now implemented and independently checked. The
next concrete work restores the current compositional learner census and
preregisters a faithful learned-DAG comparison with structural ablations. The existing compiled study
continues in its own lane. The final research decision will cite actual
comparative results, including negative outcomes, rather than the number of
subsystems assembled.

## First accounting repair and validation boundary

The [PrivacyEconomy repair record](distributional-learning/2026-09-08/privacy-grant-repair/README.md)
retains the lower-cap and integer-overflow counterexamples, original failed
regressions, repaired 16-test result and the separate first full-gate process
crashes. Source `e2a8f7fb23b57aba614da2499273f679bf0935ad` preserves held
entitlements and bounds the sum in Int64. No successful full-gate claim is
substituted for the recorded compiler/test-process failures. The exact finite
room reference is separately co-claimed and will compare distributions,
transport, conditioning and decisions before any learned-system benchmark.

The [fixed small-room protocol](2026-09-08-distributional-learning-small-room-protocol.md)
now records the exact controls, sixteen Zeta observations and failure journal
before the actual F# room run. These known-answer controls precede a separately
registered learned-system comparison.

The unchanged-source full-gate retry subsequently passed all 18 checks; both
attempts remain in the repair record. The formatter's zero exit is separately
qualified because that tool does not support F# projects.

## Actual small-room results

The [actual Zeta room record](distributional-learning/2026-09-08/actual-zeta-rooms/README.md)
retains the known-answer controls, original compile and FSI process-exit
failures, and all five corrected process outcomes. The independent reference
validates ten exact finite rows, sixteen Zeta observations and all designated
fault prefixes; the integrated 124-test suite passes.

The next learner should retain decision-relevant distribution shape, distinguish
repeated evidence from independent evidence, and expose funding separately from
posterior probabilities. Those requirements follow from these controls. They do
not establish a learned-performance advantage. The next comparison requires
actual fitting, chronological holdout, feasible strong baselines and explicit
interaction/compute budgets before further system investment is justified.

The [integrated validation](distributional-learning/2026-09-08/integration-validation/README.md)
passes all 18 repository checks at source `3d1da6b9f7505924a804974100e2758184f0fe7c`
and verifies the preserved remote source. The [independent evidence audit](2026-09-08-distributional-learning-room-evidence-review.md)
accepts the actual room and independent-reference archives without rerunning
the observed processes.
