# Minimal mixed-message and learned-module epochs

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade design proposal
Lifecycle: active
Status: proposed; not registered, implemented or experimentally validated
Work item: 081M1Z63YMC087G0R003N5FH9X

## Decision proposed

Build one small checked adapter over the existing Bayesian message maps and
Core scheduling, then use it in a learned compositional comparison. The
candidate remains a DAG of modules, including neural learners and nested DAGs;
it is not replaced by a standalone neural baseline or a static oracle. The
adapter fixes which evidence and weights a query reads, which local rule runs,
and when a returned proposal becomes an applied site. It does not create a
second inference framework or promise global convergence.

The [September 3 frozen contract](2026-09-03-bayesian-circuit-and-edge-module-contract.md)
and [September 8 continuation](2026-09-08-composable-learning-circuit-continuation.md)
remain the architecture baseline. The earlier
[fold/epoch proposal](2026-09-03-bayesian-circuit-vs-network-split-and-edge-bnn-spec-fold-vs-epoch-learn-parameters-not-messages.md)
is useful lineage, not adopted wholesale: canonical evidence union does not
make finite approximate inference permutation-invariant, and a learned factor
does not have to claim a learned weight posterior. No namespace migration is
proposed here. Promotion to an ADR/source contract is separate from this note.

## What is actually reusable

The [source census](2026-09-08-mixed-message-learned-module-epoch-source-pins.json)
binds 24 inspected files at `15c634e096674c757f3656c0b8ff9aaa0b5cf203` with
Git blob, length and SHA256. This is a source snapshot, not loaded-code custody,
dependency closure or source-to-machine proof. Historical status sentences in
earlier kernel notes do not erase the subsequently implemented scalar solver.

| Existing surface | Reuse and exact limit |
| --- | --- |
| `src/Bayesian/Message.fs`: `IMessage<'M>`, `Gaussian` | Natural-parameter representation and product/divide convention. Raw operators and `Gaussian.blend` are unchecked; `isProper` tests only positive precision; `ofMeanVariance` can throw. They are not the new admission boundary. |
| `src/Bayesian/FactorGraph.fs`: `Factor<'M>`, `FactorGraph<'M>` | `varToFactor` already excludes the receiving factor; `passOnce` replaces the factor-to-variable map. Keep these semantics. `ComputeMessages` is homogeneous and cavity-based, without typed failure, VMP marginal inputs or a weight epoch. |
| `src/Bayesian/PrecisionGateKernels.fs` | Reuse `RealMoments`, `GammaKernel`, `GammaEncoding`, `KernelError` and checked Gaussian/Gamma products, quotients and moments; `trySoftDotVmp`, `tryNormalPrecisionVmp`, `tryGammaRateVmp`, orientation-specific log kernels and objective. No mixed schedule or forward positive-family projection is supplied. |
| `src/Bayesian/PrecisionGateProjection.fs`; the two Python projection modules | A native candidate and independent interval certification for one Gaussian-family reverse-KL target. A certificate is not an exact posterior, native trajectory proof or composed-graph convergence proof. |
| `src/Bayesian/SignedProbitEp.fs` | A concrete stored-site cavity/project/damp/replace pattern with typed query failures. It is a scoped probit implementation, not the proposed complete update ledger. |
| `src/Bayesian/ToyBosonFermionBnn.fs` | Actual learning: 37 fixed features, diagonal Gaussian weight posterior and one ordered ADF pass. The raw learner can return its old posterior on invalid moments and clamps variance. It is a narrow classifier, not a general hidden-layer NN or a ready typed epoch adapter. |
| `src/Bayesian/MultilayerBnn.fs` | `Topology`, `Network`, message replacement and declared linear-Gaussian exactness receipts. Its name does not supply a neural weight learner; its exactness labels cannot be copied to arbitrary mixed factors. |
| `src/Bayesian/ReferenceFrameFactorHeterarchy.fs` | `ColumnMessage`, evidence/conflict receipts and separate Gaussian3/categorical factor graphs show an existing family-separated design. Frame fusion is not a learner or a generic evidence adapter for this model. |
| `src/Core/Graph.fs`; `NestedCircuit.fs` | Signed topology updates and bounded nested execution. Graph multiplicities are not statistical independence or likelihood weights; `NestedCircuit.Converged` is an operator predicate, not a Bayesian theorem. Retain an explicit module/port table, including isolated nodes. |
| `src/Core/SoftScheduler.fs`; `ReceiptScheduler.fs` | Deterministic cooperative `Handler`/`Source`/`ISoftScheduler` and receipt composition. Use an explicit finite source of scheduled operations. Ticks do not count inner solver/learner work; abstract joule telemetry is not measured energy. |
| TS `crdt-belief-fusion.ts`, `crdt-evidence-query-adapter.ts`, `etth1-static-ensemble.ts` | Existing evidence union/conflict/canonical query and frozen fitted artifacts. These research adapters are not a generic F# cryptographic evidence store or the new NN candidate. No old split or fitted result is changed. |

The missing work is a finite typed rule adapter, an immutable module artifact
boundary, and one actual general-purpose neural learner adapter for the chosen
comparison. Reusing the toy classifier can test epoch mechanics; passing that
control must not be reported as the intended neural system already existing.

## Model and local rule declarations

Topology describes allowed calls and shared variables. It does not establish
conditional independence. Shared inputs, a shared prior, reused training rows,
shared weights and correlated expert errors retain their identities across
nested module boundaries. Two predictions from the same receipt cut are not
two independent observations just because their producer nodes differ.

Each factor declares its density/potential, base measure, random versus clamped
ports, approximation family, and one rule from this finite initial catalog:

| Rule | Inputs and meaning |
| --- | --- |
| Existing closed-form Gaussian BP | Product of other-factor messages, in fixed order, excluding the receiving factor. Exactness remains conditional on the declared Gaussian model. |
| Scalar Gaussian/Gamma VMP | Current other-variable marginals under an explicit variational factorization. Do not substitute BP cavities. Reuse the checked kernel result without discarding unused returned fields. |
| Gaussian reverse-KL projection | Proper Gaussian cavity times `exp(k*z-c*exp(z))`, `c > 0`, relative to `dz`; certify the exact rendered target before applying. This minimizes `KL(q || target)`, not EP's moment-matching direction. |
| Frozen learned module | Deterministic forward map with versioned weights, typed ports and an explicit point/posterior/output-family label. A learned message rule must be labeled as such, with its own training objective; it is not renamed an exact analytic factor. |

EP remains an explicitly different future/catalog extension unless the scoped
existing probit adapter is selected. The distinction follows
[Minka's corrected EP paper](https://tminka.github.io/papers/ep/minka-ep-uai.pdf)
and [Winn and Bishop's VMP formulation](https://www.jmlr.org/papers/v6/winn05a.html).
Their local-update results do not prove convergence of this mixed, damped,
finite-precision schedule. [Reactive message passing](https://arxiv.org/abs/2112.13251v1)
is prior art for explicit local form/factorization constraints, not a proposal
to import another scheduler. [Probabilistic neural circuits](https://arxiv.org/abs/2403.06235v1)
motivates studying neural/circuit composition; a DAG of arbitrary modules does
not thereby inherit that paper's tractability properties.

A small closed integration fixture can use frozen neural predictions
`mu_i = h_theta_i(x)` as clamped conditional features, a proper Gaussian prior
on `z`, proper Gamma priors on `gamma_i`, and potentials
`Normal(z; mu_i, 1/gamma_i)` plus the fixed unary potential above. Declare
`q(z) product_i q(gamma_i)` as the variational family. Normal/Gamma updates use
the implemented VMP rule; the Gaussian base has `t > 0`, `u = eta/t`, so the
unary update reaches the existing scalar certificate. This is a product-factor
model conditional on `x`, not evidence that the expert errors are independent.
It is also not a full PrecisionGatedExperts reproduction: no unimplemented
Exp/Log forward Gamma projection is hidden inside it.

For this first fixture, neural modules are fitted with declared local supervised
objectives and frozen during inference; the fixed unary coefficients are not
learned. Do not claim joint maximum likelihood. A normalized conditional
product and an unnormalized factor product have a parameter-dependent
partition function and different training objectives, as preserved in the
[PGE audit](2026-09-08-precision-gated-experts-design-and-source-audit.md).
Full PGE learning or uncertain neural input/weight integration requires a
separately declared rule; plug-in means must stay labeled plug-in means.

## Minimal epoch and update records

These are proposed records, not new implemented public types. Keep family
maps using existing `Gaussian` and `GammaKernel`; a small tagged port table
selects the checked rule. Do not force VMP through `Factor.ComputeMessages`
with a fabricated cavity or create a heterogeneous unchecked `IMessage`.

| Record | Required content |
| --- | --- |
| `EvidenceCut` | Ordered immutable content/version IDs, active-cut selection and conflict disposition; observed/prior/forecast roles; shared-prior owner and dependency IDs; training/validation/test membership. Deduplication prevents repeated contribution; it does not establish independence. |
| `ModuleArtifact` | Stable module ID and instance path; source/architecture and parameter bytes; point estimate or declared posterior family; parent weight version, training-cut hash, objective, preprocessing, optimizer/update order, actual work and any RNG provenance. A nested module binds every child version and its explicit port map. |
| `QueryEpoch` | Evidence cut, complete nested module-version manifest, graph/port/rule identities, initial site state, finite operation order, damping and all budgets. Fixed arithmetic/source expectations and a declared runtime observation scope accompany it. |
| `UpdateAttempt` | Sequence, block and factor/port IDs; input revision and excluded site; exact consumed cavities/marginals and their lineage; old site; entered/returned call observations; full proposal/certificate; damped proposal and proper-belief check; applied revision or first refusal. |
| `EpochResult` | Actual attempt prefix, distinct entered/returned/proposed/certified/applied counts, last committed state, pending observations and typed first failure. A failed encoder retains the full actual returned value in memory and identifies the durable prefix separately. |

The query reads one version manifest and never trains or updates weights.
Training is a separate bounded epoch over the declared training cut and order,
which proposes a new immutable artifact. Publishing it requires an expected
parent-version check and changes the complete selected manifest at the next
query boundary. No nested call may observe half of the old and half of the new
weight set. A parameter artifact is provenance/state, not an additional
likelihood contribution; overlapping training evidence remains declared even
when two weight artifacts have different hashes.

The first NN adapter may fit point weights; that is learning with point
parameters, not a Bayesian weight posterior. A nested learned module may
consume frozen child outputs, but training those parent maps must use declared
training-only cross-fitting or a chronological inner split when predictions
on their own fitting labels would otherwise leak. Preprocessing is fitted on
training data only. No implicit online update, random draw, validation fit or
held-out target access is allowed in a frozen query. Final held-out inputs may
be read at their declared observation time; scoring targets remain separate.
This is a finite epoch boundary,
not a promise of bit-identical learning across arbitrary hardware.

## One sequential application rule

Use a fixed block Gauss-Seidel schedule in declared factor/port order. Within a
block, all graph reads use one immutable block-entry revision. Dependent local
arithmetic may consume retained private proposals, with that dependency named
explicitly rather than reported as an already applied site. Publish the block's
replacement map atomically only after all its required checks pass.
Later blocks read the newly committed revision. For the small fixture, first
update Gamma sites from the current Gaussian marginal, then prepare the
Gaussian base and its unary projection as one block. A failed Gaussian block
does not erase an already applied Gamma block: the receipt retains that prefix.

For BP/projection, recompute the cavity by the existing other-factor exclusion
semantics, avoiding a quotient round trip where possible. Identify sites by
`(module instance path, factor, target port, contribution ID)`; another route to
the same contribution cannot silently create another likelihood. VMP instead
reads the declared other-variable marginals from the same block snapshot.
Shared priors have one owner, not one copy per module boundary.

Retain each actual service return before checking its shape, certificate or
encoding. A native candidate is only a proposal. For projection, retain the
reference and certificate outcomes before any decision to apply. Recheck the
expected input revision and old-site identity before replacing the map; refuse
a stale proposal. Repeating identical content for an already applied attempt
ID is an idempotent receipt lookup, not a second multiply; changed content under
that ID is a conflict.

Damping is fixed natural-parameter interpolation
`new = (1-alpha)*old + alpha*proposed`, with finite `0 < alpha <= 1`.
Use checked arithmetic and the kernel admission rules, not unchecked
`Gaussian.blend`. Finite improper or neutral sites are allowed. The combined
candidate belief must have finite admitted moments and positive precision or
represented Gamma shape/rate as appropriate; retain `GammaEncoding` drift.
A rule needing a proper cavity refuses if it lacks one. Do not clamp a failed
belief into validity or silently reduce alpha/retry with a larger budget.

Keep topology class, factor/approximation classes, weight-learning class and
termination status separate. A small damped step alone is not convergence:
record the undamped proposed change and actual residual criterion. The first
comparison may simply run a fixed sweep count and report `BudgetCompleted`,
without advertising a fixed point, global ELBO ascent or an exact posterior.

## Bounded failure and compensating retraction

Proposed first source limits are at most 8 module instances, nesting depth 3,
32 scalar variables, 64 directed sites and 8 sweeps. Charge every actual local
rule, native proposal, independent certificate/nested root and neural forward
call before entry under one parent budget; nested execution does not reset it.
The existing scalar 256-step and 80/160/320-digit limits remain unchanged when
that rule is used. The implementation registration must name a finite encoded
receipt-byte limit and a separate training-step/example/parameter-byte cap;
these are required finite numbers, not new searches for general resource proofs.

The actual registered `stress/cancellation` result is the decisive application
control: rows 45/46/47 are respectively a native candidate, reference
`IterationLimit`, and certificate `NoRootEnclosure`. Its
[result report at 61f8e14](https://github.com/Lucent-Financial-Group/Zeta/blob/61f8e14ba9f89e790dce635ce5c86db5c619b63c/docs/research/2026-09-08-precision-gate-projection-registered-results.md)
links the full observation. Here the report and coordinator-supplied row
identities are the source; this design pass did not independently replay raw
results. The future adapter must retain all three returns and apply zero sites
for that proposal. An exhausted reference budget is not permission to trust
the native candidate or expand precision invisibly.

Retraction appends a compensating revision tied to an actually applied revision.
With no dependent updates, it can select the retained prior snapshot; otherwise
start a new query from the declared checkpoint and active evidence cut, replaying
only retained active contributions in the declared schedule. Never pretend
negative floating addition reverses approximation or an SGD step. Retracting
training data invalidates descendant artifact lineage and proposes a separately
budgeted replacement training epoch; it does not subtract from learned weights.
Old raw attempts and spent budgets remain. Evidence storage can stay append-only
while active-cut selection records a retraction; this does not redefine set union.

## Eight essential control groups and the exit into learning

Each group needs one passing control and an actually exercised distinguishing
mutant at the adapter boundary. These are proposed future tests, all unrun here.

| ID | Required discriminator |
| --- | --- |
| M1 contribution and cavity | Re-deliver a contribution through two nested paths; retain one contribution or refuse incompatible use. Include the factor's own site deliberately: the control must distinguish it. Separate factor IDs cannot launder the duplicate. |
| M2 rule and model identity | On unequal cavity/marginal inputs, swap BP and VMP inputs; change the Exp/Log orientation or suppress a required normalizer in a claimed likelihood objective. Refuse the wrong rule/model identity, not merely a nonfinite number. |
| M3 proper application | Admit an improper site that yields a proper combined belief; refuse an improper/nonfinite combined belief, bad alpha, and lost represented Gamma shape. A refused block leaves its entry state unchanged. |
| M4 retained work and budget | Exercise a late returned failure and serialization failure after earlier calls. Use the archived cancellation result as the candidate-without-certificate control; never apply it. Count nested work and distinguish returned from certified/applied. |
| M5 epoch freeze and learning | A real learner changes parameter bytes on a named nontrivial training fixture; query leaves them unchanged. Swap a child weight version mid-query, reuse an old proposal revision, or present a validation/test training row: refuse before application. |
| M6 composition and dependence | Flatten a nested module while preserving the same model/ports/order: outputs agree under the fixed numerical criterion. Duplicate a correlated expert, shared prior or training lineage: no invented independent evidence. A deliberately different factorization must be labeled different, not exactness-preserving refactoring. |
| M7 compensation | Retract an applied contribution and compare the new active-cut query with a fresh replay from the same checkpoint. A no-op proposal cannot be retracted as if applied; learned weights cannot be inverted by a message quotient. |
| M8 termination and null learning | A tiny damped change must not conceal a large undamped residual. A frozen/untrained or label-permuted training control must be distinguishable from the actual learner without touching held-out labels. Report failure if the data fixture offers no learning signal. |

Exit the prerequisite when these eight groups pass on the reviewed adapter,
one real learner has produced an immutable artifact with a retained update
receipt, and a nested frozen query consumes that artifact without mutation.
Do not require full PGE, arbitrary-family closure, a distributed scheduler,
learned scheduling, an optimizer theorem or a global convergence proof first.
One bounded implementation/review cycle should either meet this exit or publish
the concrete failed control and stop that proposed configuration.

Then register one small chronological learned comparison before fitting its
models. Keep original held-out data unopened until source, split and selection
rules are fixed; this note selects no dataset, downloads nothing and reuses no
old registered stream. Freeze one compatible pool of neural/analytic module
artifacts after training-only fitting and permitted validation selection.
Compare individual modules, flat fusion, one shallow DAG and one deeper DAG
using the same frozen pool, input access and declared inference budgets. Include
an unchanged-model nested-versus-flat control separately: changing topology can
also change the model, so a structural performance result must state both.

Require at least one actual neural learner in the pool; a hand-built filter or
the static scalar oracle does not meet the exit. Nodes may themselves be
nested learned DAGs. Compatible ports and lineage must be fixed before the pool
is trained, and a topology-specific retraining comparison is a separate row,
not silently substituted for frozen-artifact ablation. Parent-module fitting
uses the training-only prediction protocol above. Strong feasible controls are
the best individual frozen neural module, equal fusion and a simple trained
flat combiner; all receive the same allowed data and their own counted fitting.

Preregister one proper predictive score and one task loss, chronological
train/validation/test boundaries, a finite candidate/seed roster and a total
training/inference wall-time and interaction budget. Count failed fits, inner
cross-fitting, module reuse, solver refusals and abstentions; do not drop hard
queries from denominators. Test once after validation fixes selection. Report
whether composition improves the registered score versus those controls within
the budget. A negative result ends this investment slice without expanding
prerequisites until a structural win is manufactured. Scalar certificates
remain component evidence, not the learning benchmark.

## Work performed for this note

Read-only source and primary-literature inspection, source-identity collection
and documentation checks only. No Bayesian/projection module imports, solver calls, generated
vectors, data download, model deserialization, training, benchmark or new
registered workload ran. The source-pins companion is indexed by this note;
coordinator indexing and any accepted operational/source contract remain a
separate integration step.
