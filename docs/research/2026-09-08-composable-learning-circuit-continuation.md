# Composable learning circuits: restored architecture and comparison scope

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X
Status: source-grounded continuation; no new trained model or benchmark run

## Aaron's clarification

Aaron specifies the system as a composition of neural learners over a higher
DAG whose modules themselves compose. He identifies the Bayesian-circuit
lineage as the relevant prior art. This corrects the coordinator's overly
narrow emphasis on choosing a stand-alone recurrent pixel learner. A recurrent
learner remains a possible component or comparison baseline; it does not
define the intended Zeta architecture.

The [September 1 search record](2026-09-01-a-dag-of-bayesian-networks-candidate-anchors-none-confirmed.md)
was explicitly resolved on September 2 as **probabilistic circuits**. The
[September 3 edge-module proposal](2026-09-03-bayesian-circuit-vs-network-split-and-edge-bnn-spec-fold-vs-epoch-learn-parameters-not-messages.md)
then developed learned modules inside the compositional inference structure,
including a distinction between learning epochs and queries using frozen
parameter artifacts. The later [frozen architecture contract](2026-09-03-bayesian-circuit-and-edge-module-contract.md)
is the current naming/interface boundary. It explicitly does not adopt that
earlier proposal wholesale or perform its suggested namespace migration.

## System candidate

The research candidate is a declared compositional graph of typed probabilistic
modules. Modules may be analytic factors, approximate message updates, learned
neural parameterizations or nested subgraphs with declared ports. The graph
structure, message semantics, parameter versions and evidence provenance are
part of the model. A flat neural replacement does not test this hypothesis.

The [current online DAG contract](2026-09-02-multilayer-factor-graph-online-update-contract.md)
already records implemented per-edge Gaussian inference, exact-once evidence
absorption and explicit convergence/exactness results. `FactorGraph` exposes
factor-local message computation; `MultilayerBnn` consumes declared topology.
Their historical names alone do not establish learned neural weights. The
separately scoped `ToyBosonFermionBnn` does have parameter learning. The next
implementation census must identify how much of the proposed learned-module
composition has actually landed before adding another parallel abstraction.

The code also has typed geometric composition: `ReferenceFrameFactorHeterarchy`
fuses object and pose evidence using separate categorical and Gaussian factor
graphs, retaining evidence/conflict receipts; `AdinkraEquivariantFactorLayer`
provides deterministic signed-permutation sectorization. Their source explicitly
scopes them as non-learners. These are existing integration surfaces to inspect,
not grounds for claiming that learned parameter composition has landed.

A neural module with point-estimated parameters and a Bayesian neural module
with a weight posterior are distinct admissible choices. A nonlinear neural
map of an uncertain input generally requires an approximation; putting it in
an acyclic graph does not make the resulting message exact. Each module must
declare its variable families, factor/likelihood, parameter state, learning
objective, approximation, convergence and uncertainty meaning.

Evidence-set merge, inference and training remain separate operations. A
canonical evidence query names the evidence, graph structure, frozen parameter
artifact and numerical algorithm/order. Training consumes a declared ordered
dataset and produces a new parameter artifact. Query replay must not silently
train, reabsorb evidence or change parameter versions. The evidence payload's
idempotent union does not make arbitrary floating-point inference commutative.

## Closest comparisons and existing negative evidence

The [composable-learning competitor matrix](2026-09-02-composable-dag-learning-competitor-matrix.md)
already separates declared inference, learned circuit parameters, neural
modules and structure discovery. Its existing CFB results remain binding
historical evidence: balanced reduction lowered ideal depth without improving
the same Gaussian posterior; static fusion under-covered, and validation-selected
ridge beat it; the selected covariance correction eliminated all off-diagonal
terms. Those outcomes do not establish an advantage for learned composition.

The next direct comparison should therefore investigate the missing learned
compositional object. [Precision-Gated Experts](https://github.com/biaslab/PrecisionGatedExperts)
provides a close primary implementation with static, dynamic and hierarchical
compositions and a neural gating comparison. Its [2026 paper](https://arxiv.org/abs/2605.29467)
derives local variational messages for specified Gaussian/Gamma, bilinear and
exponential-link primitives. These are conditions to reproduce, not a theorem
for arbitrary neural DAGs. Pin current source, actual available expert artifacts
and split semantics before selecting an executable slice; preserve old CFB
source and split identities unchanged.

[Probabilistic Neural Circuits](https://ojs.aaai.org/index.php/AAAI/article/view/29675)
is a second relevant lineage for combining neural expressivity with circuit
structure. Smoothness, decomposability and other tractability premises must be
checked for the selected construction. A shared DAG shape does not transfer
those guarantees to Zeta automatically.

## Required structural ablations

Use the same module artifacts and information access to compare individual
experts, flat fusion, shallow composition and the declared deeper composition.
Separate structure changes from extra parameters, training examples, inference
updates and compute. Test whether replacing or reusing one frozen submodule
preserves the other modules and yields the declared composite semantics.
Compare analytic versus learned parameters versus learned message approximation
where those are meaningful alternatives for the same task.

The first controls should detect reused evidence, stale or mismatched weights,
unjustified exactness labels, non-convergence, accidental retraining during a
query and loss of decision-relevant distribution shape. Scheduler, affect and
relational-memory extensions then operate on these explicitly typed quantities.
They must preserve the neutral controls already tested in the small rooms.

POPGym Arcade remains a possible later action/memory test. No CountRecall pilot
was registered or run. Its prospective GRU/MLP and runtime findings are
baseline-only research: the initial MinGRU suggestion was corrected because
the inspected compatible released registry exposes GRU, not that named key.
No installation, training or validation/test stream resulted from that proposal.

The next investment is the current implementation census and a separately
registered compositional comparison. The criterion is improved held-out
prediction, calibration or decisions at a declared resource budget, with
component reuse and structural effects measured rather than inferred from names.

## Equation review before the next learned module

The [independent precision-gating equation review](2026-09-08-precision-gated-experts-equation-review.md)
checks the current comparison paper against its defining densities and pinned
upstream rules. It finds material message-parameter, Jacobian and variational
stationarity inconsistencies. A faithful upstream reproduction and a learner
using density-consistent rules must retain separate model identities. Before
implementation, fix the factor orientation, base measure, kernel/proper-belief
distinction, projection objective and mixed inference schedule. Local analytic
updates do not establish exact global inference or benchmark superiority.

The [local-kernel ADR](../DECISIONS/2026-09-08-density-consistent-precision-gate-kernels.md)
turns the equation findings into a bounded first implementation: typed scalar
Gaussian/Gamma kernels, explicit factor orientation and a projection objective
with independent discriminators. It leaves the mixed schedule and learned
module epoch interface explicit as the following integration step.

The [pinned-source design report](2026-09-08-precision-gated-experts-design-and-source-audit.md)
retains source packaging, data-split and score-sign hazards as well as the local
math. These findings must remain in any reproduction protocol; earlier CFB
results keep their original dataset and source identities.

The [native/reference kernel replay contract](2026-09-08-precision-gate-kernels-native-reference-replay.md)
fixes 24 input rows, numerical tolerance, explicit shape-encoding differences
and comparator controls before the first cross-language invocation.


## Assembled projection source

The [current integration register](2026-09-08-precision-gate-projection-integration-register.md)
updates the preceding design-stage status: the native optimizer, independent
enclosures and recording components are implemented and reviewed; the driver
and source archive passed independent review before the first registered run.
The [actual result](2026-09-08-precision-gate-projection-registered-results.md)
completes all 88 calls and twelve core certificates, retaining numerical
refusals. It directs the next investment to mixed-message and module-epoch
semantics before a learned compositional comparison.
This does not yet establish a mixed learned gate or a held-out advantage.


## Bounded next proposal

The [mixed-message and learned-module epoch proposal](2026-09-08-mixed-message-learned-module-epoch-proposal.md)
reuses the existing graph/message interfaces and defines eight essential
control groups before one actual learned compositional comparison. It remains
a research proposal accepted by [independent design review](2026-09-08-mixed-message-epoch-independent-review.md).
The subsequent [ADR](../DECISIONS/2026-09-08-checked-mixed-message-module-epochs.md)
and [exact source contract](2026-09-08-checked-mixed-message-module-epoch-source-contract.md)
passed [independent contract review](2026-09-08-checked-mixed-message-epoch-contract-independent-review.md).
The [implementation register](2026-09-08-mixed-message-epoch-implementation-register.md)
now owns that finite next step. No fit or held-out result is implied by this
index. The actual scheduler error route and child-to-parent forecasts remain
required executable controls.
