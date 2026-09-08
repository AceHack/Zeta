# Checked mixed-message epoch: bounded source contract

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade proposed source contract
Lifecycle: active
Status: proposed; no source implementation or experiment authorized by this document alone
Work item: 081M1Z63YMC087G0R003N5FH9X

## 1. Scope and source basis

This is the executable-boundary companion to the
[proposed ADR](../DECISIONS/2026-09-08-checked-mixed-message-module-epochs.md).
It refines accepted proposal `9928404da` and independent review `6f5c62198`;
the original proposal and its [24-file source census](2026-09-08-mixed-message-learned-module-epoch-source-pins.json)
remain unchanged. Current source was reread at
`15c634e096674c757f3656c0b8ff9aaa0b5cf203`, including the actual scheduler error
path, checked kernels, learner, process helper and reference signatures. The
additional source identities are recorded in section 10. They are read-only
snapshots, not final build/runtime or source-to-machine admission.

Only these future source additions and their dedicated tests are proposed:

| Path | Responsibility |
| --- | --- |
| `src/Bayesian/BoundedModuleLearner.fs` | The fixed 57-parameter learner and immutable artifact admission; no generic autodiff. |
| `src/Bayesian/MixedMessageEpoch.fs` | Typed plans, checked family operations, scheduler wrapper, independent ledger and compensation. |
| `src/Research.FSharp/MixedMessageEpochReplay.fsx` | One finite F# peer; source-fixed request/response and checkpoint serialization. |
| `src/Interp.Python/zeta_interp/mixed_message_epoch_bridge.py` | One admitted coordinator, real projection service, direct child custody and one recorder. |
| `tests/Bayesian.Tests/BoundedModuleLearner.Tests.fs` | Learner controls in M5/M8. |
| `tests/Bayesian.Tests/MixedMessageEpoch.Tests.fs` | M1-M8 core and actual scheduler-route controls. |
| `src/Interp.Python/tests/test_mixed_message_epoch_bridge.py` | Strict bridge, prefix and custody controls, plus the separately archived real integration calls. |

Necessary edits are limited to `src/Bayesian/Bayesian.fsproj`,
`tests/Bayesian.Tests/Bayesian.Tests.fsproj` and derived
`src/Core.TypeScript/ace/build-graph.json`. Compile learner and adapter after
the existing message/kernel/projection prerequisites. No existing numerical
source, old source archive, case roster or shared index is changed by this task.

## 2. Closed data and API boundary

The following are proposed exact public record members. `Hash` is 64 uppercase
hex SHA256 characters; `Bits` is 16 uppercase binary64 hex characters. Numeric
data uses `Bits`, retaining signed zero; ordinary JSON numbers are exact bounded
integers and never booleans. All records have exact keys. IDs are ASCII
`[A-Za-z0-9][A-Za-z0-9._/-]{0,63}`; paths cannot be interpreted as code.
Reject duplicate JSON keys, invalid UTF8, nonfinite constants, unknown variants
and counts before allocating arrays or entering numerical code. Sources and
expected hashes come from independently admitted caller inputs, not receipts.
Canonical hash preimages use compact UTF8 JSON, ordinal object-key order,
retained array order, exact base10 integers, lowercase JSON literals and the
specified Bits/Hash strings. Data IDs/paths and their keys are ASCII; JSON
quote/backslash escaping is explicit. Exclude only a record's named self-hash:
EvidenceRow.ContentSha256 hashes its other exact fields. Unknown fields and
floating JSON numbers cannot enter these canonical data preimages.

| Type | Exact fields / variants |
| --- | --- |
| `Failure` | `Code,Stage,Field,Message`; codes `Admission,Conflict,Stale,Family,Improper,Arithmetic,Service,Uncertified,Budget,Storage,Transport,Unexpected`; stage from `admit,learn,forward,gamma,gaussian,project,apply,publish,retract,scheduler`; optional field at most 256 ASCII characters, message at most 1024 UTF8 bytes. Original nested failures remain separately retained. |
| `EvidenceRow` | `Id,ContentSha256,Origin,FeatureAvailable,TargetTime,LabelAvailable,Split,Features,Target,Uses`; eight feature bits, target bits or null; split `train,validation,test,control`. `Uses` is ordered `ContributionUse` records. Times are exact nonnegative int64 logical source times. |
| `ContributionUse` | `ContributionId,Role,ProducerArtifact,ProducerTrainingCut`; role `observation,prior,forecast`; absent producer fields explicitly null. IDs do not establish independence. |
| `EvidenceCut` | `Id,Rows,ActiveIds,PriorOwners,ParentCut,Retractions`; ordered unique row/active IDs; retractions name earlier active IDs; prior owners map variable IDs to one contribution ID. Same ID with changed content refuses. |
| `Preprocessing` | `TrainingCut,Count,Means,Scales`; exactly eight finite means and positive scales in bits. |
| `ModuleArtifact` | `Id,ParentVersion,TrainingCut,Architecture,Ports,Parameters,Preprocessing,UpdateReceiptSha256,SourceBindings`; architecture is exactly `point-mlp-12-4-1-v1`; parameters are exactly 57 finite bit strings. `Ports` declares each ordered child slot `required,optional,absent`. Version is the hash of these canonical bytes, excluding an embedded self-hash. |
| `Node` | `Id,InstancePath,Kind,Inputs,Artifact,Prior,Unary,Children,OutputAlias`; kind `neural,precision-gate,composite`; unused fields null, as defined below. |
| `EpochPlan` | `Id,Mode,EvidenceCut,QueryRowId,Nodes,SelectedVersions,InitialState,Operations,Sweeps,Damping,Training,Horizon,SourceBindings`; mode `train,query,compensate`; source-fixed operations are validated against the graph and mode, not dynamically dispatched producer code. Horizon is a positive integer at most 1024, frozen for the plan. |
| `Training` | Null outside train mode; otherwise `Artifacts,RowIds,CutEnd,ChildCuts,ChildForecasts`, in ordinal artifact order. `RowIds` maps each artifact to its unique ordered training IDs; `ChildCuts` supplies the full independently admitted evidence cuts named by child artifact lineage. Every cut hash is recomputed from its canonical content. ChildForecasts is the exact ordered per-artifact/row/slot mapping defined below. |
| `State` | `Revision,Weights,GaussianSites,GammaSites,Outputs,ActiveCut`; maps in canonical ordinal order, site keys `(InstancePath,Factor,Port,ContributionId)`. Sites contain existing `Gaussian` or `GammaKernel` fields encoded in bits. |
| `Observation` | `Sequence,Operation,InputRevision,Inputs,Call,Proposal,Admission,AppliedRevision,Failure`; `Call` is `NotEntered`, `Returned` with its complete source-specific public result, or `Raised` with bounded exception type/message. Union-specific keys only; no runtime type-name instantiation. |
| `EpochResult` | `PlanSha256,Outcome,Termination,Failure,LastCommitted,ProposedArtifacts,Observations,Counters,PendingRequest,Scheduler,Publication`; outcome `completed,refused`; Termination is respectively `BudgetCompleted,Refused`; scheduler retains actual returned `Ok` or `Error`/raised observation. Publication separates retained-in-memory values from actual artifact references and its own failure. |

`Inputs`, source-specific `Call` and `Proposal` use only the finite variants
`LearnStep,NeuralForward,GammaBlock,GaussianBlock,Projection,Apply,Compensate`:
their members are the actual admitted inputs and full returns enumerated in
sections 3-6. No arbitrary `object` is accepted from the wire as an operation.
Public F# APIs are `tryAdmit(plan,admittedForecasts) -> Result<AdmittedPlan,Failure>`,
`runEpoch(admitted,service,recorder) -> Task<EpochResult>` and
`tryEncode(result,remainingBytes) -> Result<byte[],PublicationFailure>`.
`AdmittedPlan` and service/session handles have private constructors under
ordinary same-process trust. `PublicationFailure` retains the actual result
in memory plus its encoding failure; it is not a published result. A completed
training epoch returns at most four ProposedArtifacts; a refused training epoch returns no publishable artifacts
while retaining working weights. `trySelectArtifacts(currentManifest,
expectedParents,completedTraining) -> Result<SelectedManifest,Failure>` checks
all expected old versions and atomically returns a new immutable manifest.
It never changes an active query. Malformed caller admission has zero
operations; a numerical refusal returns an actual `EpochResult` with its
complete observed prefix. State.Weights contains only current 57-vectors and
their vector hashes/base artifact IDs, not repeated provenance/source maps.
Outputs maps computational node IDs to `{Mean,Variance,SourceSequence}`;
variance is null for a point NN and the actual admitted variance for a precision
node. Composite outputs resolve aliases without another stored belief. A
NeuralForward proposes a new output, then follows the same ACK/atomic swap/Commit
route before a parent can consume it. Gaussian block application replaces its
sites and output together; failed publication never silently supplies a new mean.
`UpdateReceiptSha256` hashes the canonical ordered actual LearnStep ledger for
that artifact, excluding ProposedArtifacts, manifest selection and final epoch
publication. Each step names the old/new vector hashes and input artifact ID,
not the later artifact version. This makes the artifact/receipt dependency
acyclic; retain that exact ledger preimage.

Each cut contains at most 1024 rows/active IDs/retractions and eight uses/row;
there are at most 16 child cuts and 32 prior owners. `Node.Inputs` is an ordered
list of `{SourceNode,SourcePort,TargetSlot}` with unique target slots 0/1 and
existing source nodes; the only output port is `mean`,
with a precision node also retaining its variance in its result. Neural nodes
have an artifact ID and null prior/unary/children/OutputAlias. Precision nodes
have null artifact/children/OutputAlias, prior `{Gaussian,Gammas}` (existing
natural fields and ordered shape/rate inputs), and unary `{K,C}`. Composites
have ordered child IDs, empty Inputs, null artifact/prior/unary and exactly one
OutputAlias `{SourceNode,SourcePort}` selecting the `mean` of one declared
child. No guessed first child, averaging or incoming remapping. Nested aliases
resolve statically through the declared child map, within depth 3, before DAG
order is admitted. Children keep their explicit global input edges; aliases do
not create a second variable, observation or model factor.
`SelectedVersions` maps each neural artifact ID to exact `{Version,Artifact}`.
Artifact is the complete ModuleArtifact, with matching Id; its canonical bytes
must hash to Version. Thus the admitted plan supplies the actual 57 parameters
and preprocessing, not a hash-only reference requiring an unspecified loader.
Resolve every neural node through this map; no "latest" lookup is allowed.
Training's `Artifacts` contains `{Id,ParentVersion,Ports}` requests; every new
training artifact starts from the fixed initializer, not a warm start that may
retain withdrawn data. ParentVersion is a publication precondition and lineage.
In query mode QueryRowId names exactly one active target-null row; require
FeatureAvailable <= Origin and TargetTime=Origin+Horizon. Other cut rows are
lineage only and cannot silently supply features. QueryRowId is null in train
and compensate modes. Compensating replay inherits the exact selected row
from its retained original query plan; if that row is no longer active, refuse
rather than choose another row. Query Sweeps is an integer 1..8; training uses zero. Compensation uses zero
for a direct retained-checkpoint restoration, or 1..8 for active-cut replay;
Training is null and the new compensation plan names its target revision in
its initial Compensate operation. Independently derive the
exact Operations list before admission: training traverses artifact ID, pass
0..1 and its declared row order; query traverses sweep, topological/ordinal
node order, neural forward or nonempty Gamma block then Gaussian block.
Composite and empty Gamma blocks introduce no numerical operation. Each
operation carries only its fixed kind, node/artifact ID, sweep/pass and row ID
where applicable; unknown, reordered, duplicate or omitted operations refuse.
Messages may change under a fixed contribution's state revisions without
becoming a new immutable evidence row. Compensation derives one Compensate
operation followed, when needed, by the same bounded query schedule; it cannot
accept a producer-selected replay operation list.

## 3. One bounded actual learner

For a neural node, the twelve inputs are eight preprocessed observations,
two child prediction means and two presence bits. Absent child slots are value
zero with presence zero only for a declared optional or absent slot; a present
zero is distinct. A missing required dependency refuses. Child slot order and
required/optional/absent semantics are part of the frozen artifact and cannot
be changed to manufacture an individual or topology-ablation baseline.
A child's uncertainty is not propagated through this point NN: using its mean
is an explicit plug-in approximation. A composite has no weights or density;
its ordered child/port map identifies the same underlying instances rather
than duplicating their evidence. Each node has at most two data inputs and the
complete graph is acyclic. All child artifact versions are frozen by the plan.

Neural order is `W[h,j]` row-major for h=0..3,j=0..11 (48 entries), four hidden
biases, four output weights `V[h]`, then one output bias. Define
`a[h]=b[h]+sum_j W[h,j]*x[j]`, `H[h]=tanh(a[h])`,
`prediction=d+sum_h V[h]*H[h]`, `loss=(prediction-target)^2/2`.
No regularizer, minibatching, momentum, shuffling, clipping or adaptive rate.
Use binary64 scalar operations, fixed left folds beginning with the bias,
explicit multiply then add, and `System.Math.Tanh`. Do not introduce fused
multiply-add. This is not an exact-arithmetic or cross-hardware bit theorem.

Initialization is source-fixed, with no RNG:
`W[h,j]=(((h+1)*(j+1) mod 7)-3)/32`, `b[h]=0`,
`V[h]=(h+1)/16`, `d=0`. Learning rate is exactly `1/1024`.
There are exactly two passes in the admitted row order, no early stopping.
For error `e=prediction-target`, gradients are
`gV[h]=e*H[h]`, `gd=e`,
`delta[h]=(e*V_old[h])*(1-H[h]*H[h])`,
`gW[h,j]=delta[h]*x[j]`, `gb[h]=delta[h]`.
All gradients use one complete pre-update vector, including the old output
weights. Form all 57 replacements `old-(gradient/1024)` privately in canonical
order; publish the vector atomically only after every operation and parameter
passes finite/range admission. Ordinary NN underflow/zero is retained as
binary64 behavior; the separate precision-kernel underflow rules are unchanged.

`LearnStep` retains row ID, old vector, twelve actual inputs, target,
preactivations, hidden activations, prediction, loss, full gradient vector,
proposed vector, actual validation and committed version. A late failure keeps
the old committed weights, actual intermediate prefix and spent work. A
returned valid replacement followed by recorder failure is retained as an
unpublished proposal and is not committed. Gradient correctness needs M5's
independent derivative discriminator; byte movement alone is insufficient.

Fit preprocessing only on that artifact's admitted training rows: ordinal row
order; mean by a left-fold sum divided by N; variance by a second left-fold
sum of squared deviations divided by N; scale `sqrt(variance)`, using scale
one only when variance is exactly zero. Eight fitted means/scales are stored.
Raw training features and targets are finite with absolute value at most 64;
processed observations at most 8, child means at most 64, parameters at most 64,
and prediction at most 64. Refuse excess; do not clip or refit on query data.
Query features use the stored transformation and same finite processed bounds.

Train rows must have `FeatureAvailable <= Origin < TargetTime`,
`TargetTime = Origin + Horizon`, and `LabelAvailable >= TargetTime` and at most
the training cut end. Validation/test labels cannot enter training. A parent
training row's child forecast must bind a child artifact whose maximum training
label-availability time is strictly before that row's origin; no in-sample
child predictions are laundered through a different row ID. The first pool
uses a chronological inner split for these child forecasts, not an additional
model-selection search. Training never evaluates a child implicitly: it consumes
only precomputed immutable forecasts from completed query epochs. Each exact
ChildForecast row is `{ArtifactId,TrainingRowId,TargetSlot,BundleSha256,
QueryRowId,ProducerNode,OutputPort,ProducerVersion,ProducerTrainingCut,
ObservationSequence,CommitRevision,Mean}`. Slots are unique and ordered;
missing required rows refuse. Optional absence is explicit. Mean is Bits and
must equal the selected actual committed output, not a supplied prediction
with a matching producer verdict.

The coordinator admits each unique bundle from independently supplied raw
bytes and expected SHA before peer launch. Exact bundle keys are
`Schema,Plan,Result,ProducerModels,Ancestry`, schema
`zeta.mixed-epoch.forecast.v1`: Plan is the complete
query EpochPlan and Result is the complete actual returned EpochResult, with
its full source-specific observations and nonrecursive artifact references.
No recorder-helper snapshots or producer-named type instantiation. The bundle
must represent a completed query with matching plan/source/version/cut/row
identities, actual successful scheduler return, no failure, and the selected
observation plus applied/committed revision. Extract neural output from the
actual NeuralForward result; extract precision output from the actual admitted
applied marginal. Bind the selected source node and mean port exactly.

Resolve composite aliases before identifying the producer. Neural
ProducerVersion is its selected artifact hash. For each resolved precision
producer, ProducerModels contains the exact preimage `{Node,Dependencies,
SourceBindings}`: Node is its complete admitted node record; Dependencies is
the ordinal list of `{Id,Kind,Version}` for its resolved direct input producers;
SourceBindings equals the query plan's full map. A neural dependency's Version
is its artifact hash and a precision dependency's Version is defined by the
same acyclic preimage rule. ProducerVersion hashes this exact preimage. Verify
all preimages against the bundle plan; producer-chosen missing dependencies
refuse. Composites do not acquire a separate invented parameter version.

Ancestry maps each resolved producer to its exact ordinal list
`{NodeId,ArtifactVersion,TrainingCut}` for every selected neural ancestor,
including the producer itself when neural, deduplicated by node identity.
ProducerTrainingCut hashes that whole list, including the one-cut case;
it is null only for an empty list. Do not confuse it with one direct cut hash.
Require every named full cut in Training.ChildCuts, validate each artifact/cut
association and require every ancestor's maximum label-availability time to
precede the parent row origin. Preserve reused evidence IDs in those cuts;
ancestry branches do not create independent data by being separate nodes.

A partial/unanswered peer or an unpublished in-memory result cannot supply a
forecast. Complete source/process/artifact custody is a separate independently
admitted caller premise; these raw checks cannot prove a query was executed.

The existing coordinator retains each original bundle through the one Store,
then constructs a private AdmittedForecast containing its complete evidence
and a public compact binding equal to ChildForecast. Start carries those exact
compact bindings inside Training. The peer rechecks row/port/version/value
correspondence under the selected source-admitted coordinator premise; it does
not infer full remote evidence from hashes. There is no extra wire protocol or
hidden training service call. At most 256 unique bundles are admitted, each at
most 8 MiB and aggregate at most 16 MiB, with bounded reads/decoding before
expansion and duplicate bytes charged at each input position. Stored copies
consume the same 256 MiB/4096-artifact budget, not a separate allowance.

Query and training rows have distinct immutable IDs and full content hashes.
The query Target is null; separately require exact equality of its Features,
Origin, FeatureAvailable, TargetTime and Horizon projection to the corresponding
training row. Never reuse an evidence ID with changed target content. Prior
forecast generation, including fitting, forwards, projection and failed calls,
must remain charged to the enclosing registered budget before these inputs
are admitted; artifact reuse does not erase its production cost. Within this
training epoch P follows only its explicit operations, so it has no child
solver launch. Missing prior work/custody records refuse that control.

Dataset/source truth behind these admitted records remains an external
data-provenance obligation. Query receives target=null;
held-out scoring is separate. Withdrawing a training row invalidates descendant
lineage and requires a separately budgeted new artifact; no inverse SGD claim.

## 4. Mixed rules, blocks and scheduler retention

A precision-gate node owns one z variable, a proper Gaussian prior, zero to
two feature means, corresponding proper Gamma shape/rate priors, and finite
k, positive c. Its declared potential is
`GaussianPrior(z) * exp(k*z-c*exp(z)) * product_i Normal(z;mu_i,1/gamma_i)`
times the Gamma priors, relative to `dz product_i dgamma_i`.
Every child mean, including another precision node's output, is consumed as
`RealMoments(Mean=childMean,Variance=0)`: a declared clamped plug-in feature.
Retaining the child's variance in its receipt does not propagate it through
this Normal factor. Child forecasts are not separately observed independent
evidence; message revision changes do not create new evidence rows. Variational family is `q(z) product_i q(gamma_i)`.
Local supervised neural fitting is not optimization of this model's
parameter-dependent conditional normalizer.

Use existing family maps and checked `PrecisionGateKernels` operations. Cavity
products exclude the receiving factor in sorted factor order, matching
`FactorGraph.varToFactor`, but use checked products rather than its unchecked
`IMessage.Product`. VMP inputs are current other-variable marginals, not BP
cavities. For feature mean mu and z moments m,v, the precision site is
`GammaKernel(1/2,((m-mu)^2+v)/2)`; call and retain the full actual
`tryNormalPrecisionVmp` return. Its message to z is
`Gaussian(Egamma*mu,Egamma)`. Clamped mean ports are not updated.

Each sweep visits computational nodes in topological then ordinal order, once
each: neural nodes perform one forward call using the current admitted child
outputs; composites add no call. For each precision node, propose/damp/admit all
Gamma sites from one block-entry snapshot,
then atomically replace that block; next construct its Gaussian base from the
new Gamma moments, retaining the actual Gaussian site proposals and checked
sums. Set native target t to base precision, u to the checked eta/t quotient,
and k,c to the node constants. Retain base bits, constructed target bits and
native round-trip decimal rendering; certification covers those rendered
dyadics, not an assumed exact inverse from u to eta.

After certified projected moments are converted using checked Gaussian
admission, form the unary site by checked projected-belief/base quotient.
Replace the old site; never multiply the projected belief as a new site.
All private Gaussian proposals and projection depend on the same block-entry
revision and explicit private intermediates. Commit only the complete block.
Earlier committed Gamma blocks survive a later Gaussian refusal.

Alpha is an admitted finite binary64 value in (0,1], fixed for the epoch.
Interpolate natural site coefficients with explicit `(1-alpha)*old +
alpha*proposal`, checked operations, no silent retries or alpha reduction.
Finite improper sites are allowed; all combined beliefs need the existing
checked finite proper moments and represented Gamma shape. Retain encoding
drift. The certificate covers the undamped proposed Gaussian only, not the
damped or reconstructed belief. Report exactly the requested finite sweeps as
`BudgetCompleted`; never infer a global fixed point from a small damped delta.
Retain undamped and applied site deltas for the M8 discriminator.

Use exactly one `SoftScheduler.Handler` whose state is the next operation
index, one explicit `Source` yielding `[TimerElapsed 0]` per admitted operation,
and `drive.Run` with seed=0 and exactly that finite tick budget. Do not call
`seedSource`, `runDeterministic`, or create an adaptive schedule. The handler
closure owns an independent append-only ledger and last committed state;
it retains actual returns/refusals before fallible publication. For an update,
first encode/store its full proposal checkpoint and await the matching actual
store acknowledgment; on refusal, do not apply. Then swap the admitted state
and retain the actual apply observation in the holder before publishing Commit.
A Commit publication failure after that swap preserves the actual new state
in memory; it cannot be mislabeled an unapplied proposal. The handler yields
`Error(Failed failureCode)` on failure. `runEpoch` awaits the actual scheduler
return, retains it, and forms its result from the independent holder. It never
assumes `Error` contains local scheduler state. M4 must use real `drive` and
exercise success, an applied first block and a later refused block. Unexpected
task exceptions are observed as exceptions and converted at the public boundary,
with the existing prefix retained. No cancellation exception is relabeled a
normal successful stop.

Applied revisions are monotonic and bind expected old state/site hashes.
Identical repeated contribution-delivery content returns its old receipt;
changed content under that ID conflicts. This is the internal contribution
idempotency law, not permission to repeat a bridge request or resume a session. A stale proposal applies nothing. Compensation is
an append-only revision: select the retained pre-update checkpoint when it has
no descendants; otherwise replay the active cut from that checkpoint through
the same declared operations under a new epoch identity and inherited outer
budget. Never negate an approximate update, refund spent work or alter history.

## 5. Real projection bridge and trust boundary

`ProjectionService` is an async function over the exact request below returning
the exact response or a transport failure retaining the received prefix. Its
injected function identity is an ordinary caller trust premise, not a proof.
Fixture delegates may test the core but cannot satisfy the real integration
controls or be labeled source-admitted service execution.

One Python coordinator owns one exclusive attempt and record store, prepares
the native helper once using actual `prepare_native(source_root,custody_root,
host,expected_files)`, and launches one F# epoch peer. The peer supplies the
finite async request channel as its service. Python calls
`launch_native(prepared,raw_input,expected_sha,case_id,expected_bindings,
unique_attempt_root,timeout_seconds=30)` once, retains its complete returned
`NativeObservation`, and if a complete admitted raw receipt exists calls
`certify_native(raw_input,raw_native,expected_bindings,
expected_input_sha256=expected_sha,expected_case_id=case_id)` once.
No separate `reference_root` call is made: its actual nested call is retained
inside the certificate result. Counts separately name native launches,
certificate entries and nested reference entries; do not count one computation
twice as two top-level calls. Native/API refusal and no-candidate remain distinct.

The coordinator owns both direct peer and native child observations. It reuses
the existing native process helper, not the old fixed-roster driver. It binds
the selected Python executable, actually loaded task-module origins/bytes,
script copies, host and expected three native #r DLL files before work and
observes them after work. Complete source bindings are an independently
supplied flat path-to-uppercase-SHA map with `ProtocolSha256` and reviewed
direct helpers/build wiring; no producer may select expected hashes. This
adapter's source manifest is a new reviewed cut; the old 40/88 archive is unchanged.
Metadata equality does not prove execution or transitive runtime closure.
The native flat map keeps ProtocolSha256 bound to the unchanged scalar
projection contract; this ADR/source contract and service source are included
under their exact repository paths. ServiceSha256 is the independently supplied
identity of the selected service manifest. It is not an authority minted from
a response, and no new source document replaces the scalar numerical contract.

Wire is one non-resumable session, sequential LF-terminated strict UTF8 NDJSON;
stdout contains protocol only and stderr is separately capped. Exact outer keys:

| Direction/kind | Exact fields |
| --- | --- |
| Coordinator `Start` | `Kind,Schema,SessionId,Plan,PlanSha256,ServiceSha256,ExpectedBindings`; schema `zeta.mixed-epoch.peer.v1`. |
| Peer `Ready` | `Kind,Schema,SessionId,PlanSha256,ServiceSha256`; sent once after admission, before numerical entry. |
| Peer `Checkpoint` | `Kind,Schema,SessionId,Sequence,Observation,LastRevision,StateSha256`; full bounded pre-apply observation, AppliedRevision=null, with the old committed revision/hash. Nonmutating operations also await storage ACK. |
| Peer `ProjectionRequest` | `Kind,Schema,SessionId,Sequence,RequestId,InputRevision,Base,TargetBits,RawInputHex,InputSha256,CaseId,BindingsSha256,Remaining`; remaining is the full named session counter allowance. |
| Coordinator `CheckpointAck` | `Kind,Schema,SessionId,Sequence,CheckpointSha256,Outcome`; Outcome is `{Kind:'stored',Artifact}` or `{Kind:'refused',Failure}`. Artifact uses exact `File,Encoding,Bytes,Sha256,StoredBytes,StoredSha256` from the existing lossless descriptor. Hash the complete original checkpoint frame including LF. |
| Peer `Commit` | `Kind,Schema,SessionId,Sequence,CheckpointSha256,AppliedRevision,LastCommitted,Counters`; this reports an actual state swap after its proposal ACK. |
| Coordinator `ProjectionResponse` | `Kind,Schema,SessionId,Sequence,RequestId,InputSha256,BindingsSha256,ServiceSha256,Native,Certificate,Failure`; `Native` is the full encoded public `NativeObservation` or null, `Certificate` is the full actual reference API return or null. No `Verified=true` substitute. |
| Peer `Terminal` | `Kind,Schema,SessionId,Outcome,Termination,Failure,Counters,LastCommitted,LedgerCount,LedgerSha256,PendingRequest,Publication`; a bounded reference summary derived from an actually returned `EpochResult`, never a duplicate of its full recorder snapshots. |

The coordinator stores a complete checkpoint exclusively before sending a
stored ACK, retaining the actual Store result first. Peer awaits that matching
ACK before applying; wrong session/hash/sequence, missing ACK or refused ACK
stops the epoch. Stored proposal is not observed application: only a real
Commit frame advances the coordinator's observed committed prefix. If Commit
is lost, retain the stored proposal and last observed committed state with
application status unknown. Neither endpoint invents the missing return.
Commit frames are retained raw in memory and stored in fixed pages of at most
16 frames or 1 MiB, flushed before a projection request or terminal and at the
page limit. Before acknowledging the next checkpoint, flush any full page;
on a failed write withhold that ACK, stop requests and close the peer while
retaining the actual pending page and observed committed prefix. The peer may
have returned the next proposal before observing that failure; retain it
without applying it. No observer claims a rollback of an already observed
Commit. These pages do not allocate one Store artifact per scalar or duplicate full Store
snapshots. Learn/forward proposal checkpoints remain individual records.

Requests are built internally from the fixed schedule; sequence is 1-based
and counts peer Checkpoint and ProjectionRequest operations only. ACK/Commit
reuse their checkpoint sequence; a response reuses its request sequence.
There is exactly one outstanding request or checkpoint acknowledgment.
The raw native input uses the unchanged scalar input schema/default profile;
binary64 target values are rendered with invariant round-trip decimals,
lowercase `e`, and explicit negative zero, then independently checked to round
back to the same bits. Session-derived CaseIds are data, never dispatch keys.
The service checks raw/input/binding identity before calls. The peer checks
full response shape, correspondence, native/reference bindings and actual
certificate outcome before application; the source-admitted bridge is still
the premise for process/actual-call provenance, not something JSON can prove.

Retain every response object before comparing or encoding it. In particular,
the existing reference `ReceiptFailure` preserves an actual in-memory receipt;
it is a publication failure, not an encoded certificate. The peer must refuse
application, while the coordinator retains that original return and artifact
failure. After any protocol/storage failure, stop new requests and retain any
unanswered request, last observed peer checkpoint and actual EOF/exit/cleanup
observations. Never construct the `EpochResult` a terminated peer failed to
return. A terminal must be followed by EOF and closed direct child; extra bytes,
missing LF, premature EOF, duplicate terminal or nonzero normal-success exit
refuse closure. No reconnect, retry or resumed session under the same identity.

## 6. Fixed absolute caps

These limits apply to one whole adapter session, including nested modules,
training, compensating replay and service calls. Descendants share the same
budget object; they do not start fresh counters. A later benchmark must also
cap the aggregate of its sessions before fitting. Byte bounds are refusal and
retention bounds, not peak-memory or hostile-runtime guarantees.

| Resource | Ceiling / rule |
| --- | --- |
| Topology | 8 total module instances including composites; depth 3; at most 4 neural and 4 precision nodes within that total; 32 scalar variables; 64 directed sites; 2 data inputs/node; reject cycles. |
| Query work | At most 8 sweeps, 4096 scheduler operations, 32 projection requests, 256 checked kernel entries and 1024 NN forwards, all counted before actual entry. No zero-work convergence shortcut. |
| Total NN work | At most 4096 forward evaluations/session, including the one old-weight evaluation inside each training step; query additionally has the 1024 bound above. Count the nested forward as NN work, not as a second training example or second scheduler operation. |
| Training | At most 256 distinct rows/artifact, exactly 2 passes, at most 4 artifacts and 2048 SGD attempts/session. An attempted step counts even if it refuses before commit. No extra hyperparameter/seed search. |
| Parameters | Exactly 57 weights plus 16 preprocessing scalars/artifact; at most 292 fitted scalars / 2336 binary64 bytes across four artifacts. Each canonical artifact at most 64 KiB including bounded provenance. At most 64 additional fixed model scalars. |
| Input | Start/plan at most 1 MiB; native input and bindings each at most 64 KiB; projection request frame at most 256 KiB; all incoming IDs/lists admitted before expansion. |
| Per-return/frame | Learn/forward/non-projection Checkpoint, ACK and Commit at most 64 KiB; native raw and reference result each retain their existing 2 MiB bound; projection response frame at most 12 MiB; a projection-bearing Checkpoint at most 16 MiB; terminal at most 1 MiB. Checkpoint embeds the structured actual service response without hex-encoding that already encoded frame again; original response bytes are retained separately and bound by their hash. No truncation. Before expansion the encoder gets the smaller of the per-frame cap and remaining allowance. |
| Transcript | Sum of original admitted/sent protocol bytes at most 64 MiB, with 1 MiB of that reserved for the terminal; at most 16384 total protocol frames, including ACK and Commit. Repeated bytes, including projection response/checkpoint duplication, count at each position. A completed return survives later encoding failure in memory with explicit durable-prefix status. |
| Process | One peer launch, one native preparation, at most 32 native launch attempts, 32 certificate entries and 32 nested reference entries; inherited scalar 256 midpoint and 80/160/320 context limits unchanged. Native timeout 30 seconds with existing cleanup outcomes. Peer stderr cap 64 KiB; process stdout is the bounded protocol. |
| Elapsed | 300-second cooperative session deadline, checked before/after each operation and while awaiting peer transport; the native helper has its own 30-second bound. A pure reference call is bounded by its existing operation/context limits, not preempted inside Decimal. Deadline overshoot and incomplete child cleanup remain actual observations, not a claimed hard real-time guarantee. |
| Owned retention | One existing Store, combined raw-plus-stored 256 MiB, 4096 artifact slots, fixed 8 MiB combined final-journal reserve inside the total. Reserve all external owned native files before their creation as below; no refunds, overwrites or retry of failed paths. |

Derive P, the complete planned projection-request count, before setup. If P>0,
reserve external owned-file budget
`D=2*(script bytes + three DLL bytes + P*(64 KiB + 64 KiB + 2 MiB))`
and `A=4+3*P` artifact slots from independently admitted identities. P=0 has
D=A=0 and makes no native preparation. Open the one Store with
`CombinedBytes=256 MiB-D`, `Artifacts=4096-A`, and the same 8 MiB journal
reserve. The script/DLL copies and each planned native input, bindings and
receipt file are already charged in D/A, including failed/partial files and
unentered later calls. They stay owned in place; link them rather than copy
them as a second uncharged archive. Host and original peer-source bytes are
observed, not copied. Protocol/metadata records use the Store's remaining
allowance and existing exclusive APIs. Setup refuses unless it leaves strictly
more than 10 MiB and at least three Store slots: journal, terminal and ordinary
room. The terminal reserves 2 MiB combined within that remainder. No refunds
of failed or unused reservations, overwrites or retries. Maximum simultaneous
counts need not fit. Finalize once, preserving that failure separately from
the first failure. Setup/prepare failure before Store creation retains its
actual owned prefix in memory without inventing successful ownership.

`Counters` has exact integer members `SchedulerEntered,KernelEntered,
ForwardEntered,LearnEntered,Returned,Proposed,Certified,Applied,
ProjectionRequested,ProtocolBytes,ReservedBytes,ArtifactSlots`, plus `Remote`.
Remote has exact keys `NativeCallEntered,NativeLaunchAttempted,NativeReturned,
CertificateEntered,CertificateReturned,NestedReferenceEntered`, each a record
`{Observed:int,Complete:bool}`. Observed is the actually retained prefix; false
Complete means the total is unknown after an unanswered request or abnormal
close, not zero work. Native API entry and actual child-launch attempt are
separate. Nested reference entries come from the actual retained reference
receipt, not an extra invocation or an inference from a requested certificate.
Counts distinguish started work, actual normal returns, numerical proposals,
certificates and commits.

## 7. Eight fixed control groups

Each listed discriminator is required; these are future tests, not observations.
No extra benchmark/vector sweep is implied. Failed attempts and repairs stay
retained. M4 includes two real bridge calls after source review/archive.

| Group | Passing control and exact distinguishing faults |
| --- | --- |
| M1 contribution/cavity | Prior Gaussian(0,1) plus one keyed site; redelivery keeps one site. Change the same ID's content, alias the same contribution through a composite, and include the receiving factor in its own cavity: refuse/conflict or distinguish the wrong product without inventing new evidence. |
| M2 rule/model | Current z mean 2, variance 3 and clamped mu=-1 yield residual 12/rate 6; substituting cavity mean 0/variance 1 yields residual 2/rate 1. Gamma prior(2,3) plus correct site has shape 5/2/rate 9. Mutate the declared rule input role, Normal half-log-power or Exp/Log identity; reject. A claimed normalized-likelihood objective lacking its model-dependent normalizer is not the selected local supervised learner. |
| M3 proper/site/damping | Target(t,u,k,c)=(1,3/2,-3/4,1), projected(m,v)=(-1/4,1/2), base(eta,t)=(3/2,1) gives site(-2,1). Belief-as-site produces(1,3) and must fail the expected reconstruction. Alpha=1/2 from neutral yields proper(eta,t)=(1/2,3/2), not the minimizer. Also distinguish improper site/proper total from improper total; reject nonfinite/bad alpha and lost represented shape. These are analytic controls until executed. |
| M4 actual retention/bridge | Use real SoftScheduler.drive: apply an initial block, then fail the next; retain the first state despite outer Error. Inject encoding failure after an actual return and premature peer EOF with an outstanding request. Run one actual bridge request for M3's positive target and one for t='1e-300',u='0',k='0',c='1', default scalar budgets. The latter must retain actual native candidate/reference IterationLimit/certificate NoRootEnclosure and apply zero unary updates, or report the changed actual outcome as a failed control. The nested reference is not a separate top-level reference run. |
| M5 learner/epoch | One explicit four-row training fixture exercises nonzero features/targets; retain the full gradient and all 57 replacements. Check the full displayed analytic gradient and the fixed central-difference discriminator below; mutate hidden gradient to use a newly updated V. Test late arithmetic/encoding failure, child-version swap, stale apply and validation/test training-row refusal. Parameter movement alone cannot pass. |
| M6 structure/dependence | Equivalent composite flattening must match output bits and numerical site/marginal bits exactly under its explicit OutputAlias resolution, with the same model, arithmetic and operation order. Duplicate expert/prior/training lineage cannot mint independent observations. Present a changed factorization as an exact refactor: reject its model identity. |
| M7 compensation | Compensate an applied contribution and compare with a fresh active-cut replay from the same checkpoint. Reject retracting an unapplied proposal; preserve spent work and history. Training-data withdrawal invalidates descendants, never uses a weight quotient. |
| M8 termination/null | Retain a large undamped change with small-alpha applied change and refuse any inferred fixed-point claim. Compare the learned four-row control with frozen initial weights and fixed label permutation; no held-out labels used. A fixture without learning signal is a failed discrimination, not evidence of a learned system. |

The live M4 plan is one sweep over two zero-feature precision nodes, in order:
`control/0-positive` has base(eta,t)=(3/2,1), k=-3/4,c=1;
`control/1-cancellation` has base(eta,t)=(0,1e-300), k=0,c=1. Empty Gamma blocks
are skipped. Thus one actual peer session must retain the first applied
Gaussian block when the second projection refuses, using exactly two native
and two certificate calls with their actual nested reference work. Report any
different outcome rather than changing inputs or budgets to force the control.

M6 retains both full receipts. Compare numeric work counts and all numerical
bits after the independently declared alias/instance-ID mapping. Artifact
versions, source/data hashes, contribution/prior identities and dependency
sets remain equal; only the explicit structural/session/path mapping may
rename identity fields. Protocol byte counts and process observations are
retained as actual values, not normalized into equality. No numeric tolerance,
unlisted field erasure or producer-selected mapping is allowed.

M5/M8's sole four-row control has raw observations all zero except the first
coordinate `[-1,-1/2,1/2,1]`, targets equal to that coordinate, absent children,
IDs `control/learn/0` through `control/learn/3`, origins/feature times
0,2,4,6, horizon 1, target/label-availability times 1,3,5,7, split=train and
training cut end 7. No missing labels. Preprocessing is fitted only on these
four rows. The fixed permutation swaps targets 0<->3 and 1<->2. Use no RNG.
At the initializer and first preprocessed row, independently evaluate the loss
at plus/minus h for W[0,0] and V[0], with h=2^-20, holding all other parameters
at that same old vector. Compare each central difference with its analytic
gradient using absolute error <= 1e-7 + 1e-6*abs(central difference). Count the
four actual forward/loss entries, without SGD updates. The old-V mutant must
fail this same check, or the discriminator fails; do not loosen its tolerance.
Source tests assert the full analytic gradient and both numerical checks rather
than just fit direction. Local loss reduction is not held-out performance.

M5 also exercises a real child-to-parent receipt path using only these four
rows. Fit a child on rows 0/1 (cut end 3); query its frozen artifact on distinct
target-hidden rows `control/child-query/2` and `/3`, with origins 4/6 and the
last two feature vectors; fit a parent on training rows 2/3 (cut end 7), with
slot 0 required and slot 1 absent. Child scaler mean=-3/4 and scale=1/4 imply
processed query values 5 and 7, within 8. The latest child label 3 precedes both
query origins. The two fits each use four SGD attempts; combined new work is
eight SGD attempts and ten forwards, including the two separate frozen child
queries, with zero projection requests. Retain both full query bundles and
parent inputs; corrupt target-hidden row association, child version, mean,
commit or generation work record and refuse. This is a composition control,
not the later benchmark or a new data fixture.

This composition subcontrol uses four finite non-resumable peer sessions
(child train, two single-row queries, parent train), with one enclosing
coordinator, Store and budget ledger; finalize that Store only after the whole
subcontrol stops. Each session has its own unique identity. Each session still uses the exact per-session protocol/caps;
all four share at most the same 64 MiB transcript, 256 MiB retention and
300-second cooperative outer allowance. Count all four launches explicitly;
no session or child resets the enclosing work/byte ledger. Source tests may
exercise pure gradients separately; those are counted separately and cannot
substitute for this actual retained composed route.

## 8. Exit to the chronological learned comparison

Exit after one reviewed implementation cycle passes M1-M8, including the actual
bridge routes, actual correctly differentiated neural update and nested frozen
query. A named failed control stops that configuration; do not expand the
prerequisite into full PGE or a general learning platform.

Then separately register one small chronological data comparison before fitting:
eight declared as-of features, one target/horizon, exact train/validation/test
cuts and overlap embargo at least the target horizon, training-only scaler and
chronological inner child-prediction cut. Preserve the untouched test until
validation fixes choices. Compare the same frozen compatible pool as individual,
flat, shallow and deeper modules; use best individual NN, equal fusion and a
trained flat combiner as controls. State when topology changes the statistical
model. Count all fitting, inner fitting, requests, refusals and abstentions in
one declared outer budget and denominator. Modules with required child inputs
remain composites when evaluated; do not weaken an individual baseline by
silently zeroing required ports. Identify a current primary published comparator
and feasible pinned executable implementation before claiming a SOTA comparison;
if it cannot run within the budget, report that limitation. The 57-parameter
adapter learner is not that baseline. Preserve the PGE audit's separate faithful
and density-consistent model identities; full PGE/PNC replication is not an
adapter prerequisite. Fix one proper predictive score and one task loss,
finite run count and stop criteria in that registration. No dataset, model
artifact or held-out value is read by this source-contract task.

## 9. Literature and validation scope

The local-rule distinctions retain
[Winn/Bishop VMP](https://www.jmlr.org/papers/v6/winn05a.html),
[Minka's corrected EP](https://tminka.github.io/papers/ep/minka-ep-uai.pdf),
[reactive message-passing form constraints](https://arxiv.org/abs/2112.13251v1)
and the accepted [PGE audit](2026-09-08-precision-gated-experts-design-and-source-audit.md).
The NN derivatives follow the displayed chain rule, not a claim of novel
learning theory. No theorem from a pure VMP/EP model is transferred to this
mixed finite schedule. Scope is one local learner plus compositional execution.

This task only read source/reviews and wrote the ADR/contract. Documentation
gates and identity collection are separate from future implementation tests.
No scheduler, NN, solver, old 9307/9409 stream, new data or numerical workload
ran. Co-claim, independent source-contract review, source/test implementation
and immutable pre-execution archive are still required before the named actual
integration controls. They are the same single adapter cycle, not deferred work
that can be satisfied with caller booleans or mocks.

## 10. Additional source identities

The following table is generated only by reading committed source bytes at the
stated root snapshot. It adds the actual selected scheduler/bridge/storage and
project entrypoints to the unchanged proposal census; it is not a final source
manifest or a claim to have executed those entrypoints.

| Source path | Bytes | SHA256 |
| --- | --- | --- |
| `src/Core/IntrCtx.fs` | 5142 | `620C95D5AEC416E516FC281632FAF98C0AC7B26D27A9C9C5F82C6F126580A9A0` |
| `src/Interp.Python/zeta_interp/precision_gate_projection_process.py` | 35009 | `EC3EADA6DA2AC70067EEE2CE7121F2C553FC9817F6F147FA18965D2E8729EF88` |
| `src/Interp.Python/zeta_interp/precision_gate_projection_cases.py` | 9695 | `D5EA9704C1E33429D990F66BA862BC5ED25A1F5C7C9A15E33A8B8D621CA71124` |
| `src/Interp.Python/zeta_interp/hidden_switch_compiled_record_store.py` | 20305 | `75BA7825F7E925460B411C977C4F9F4F34D55BA40383B4F47482C1DB652E1008` |
| `src/Interp.Python/zeta_interp/hidden_switch_compiled_record_encoding.py` | 9555 | `892B59A1572B093805171E0F495126F006A72D56CA87260251C9544C29019744` |
| `src/Interp.Python/zeta_interp/hidden_switch_compiled_storage.py` | 10694 | `3C7A9C8FECF51B10AA034E4764D18E773AB892382E8CDB4BE3E0945D3CD01750` |
| `src/Research.FSharp/PrecisionGateProjectionReplay.fsx` | 12723 | `C1174406CC4E7D3164714C536207AD2BD72F085A38A3A816C8BC1B14ADE917B2` |
| `src/Bayesian/Bayesian.fsproj` | 3329 | `00A6A4C62843516AF63D7DAE6F712732A4142FD4691B180C2CEEAB853B40BB6C` |
| `tests/Bayesian.Tests/Bayesian.Tests.fsproj` | 3770 | `DD863D702023CE99CED1C1E7CDA5B5E4732D7EAE0EC10A3006B4176C107E3736` |

## 11. Draft review history

Initial source-contract draft `31b29e17e` is retained unchanged. Root requested
explicit composite output aliases, exact M6 bit comparison, clamped child-mean
semantics and a projection-checkpoint cap consistent with the full return. The
author identified the missing store-ACK-before-apply step; the correction adds
that ACK and observed Commit, with unknown application on lost Commit. A
training-internal forward counter clarification avoids conflating query and
whole-session allowances. Independent reviewer predictor_audit found that the
original positive/cancellation names sort in the opposite order to M4's promised
applied prefix. The correction uses control/0-positive and control/1-cancellation
under the unchanged ordinal scheduler. Artifact-update hash preimages, commit
page failure handling and the M5 derivative tolerance are now explicit. These
are design repairs, not test or numerical results. The reviewer also identified
unspecified training child-forecast generation and the missing selected query
row. Root accepted explicit QueryRowId and source-admitted precomputed bundles,
with target-hidden row correspondence and prior generation charged externally;
the same four-row M5 control now exercises this actual composition route.
Final review also fixed explicit artifact bytes in SelectedVersions, the
precision-producer model hash preimage and a sorted ancestry-cut manifest;
these avoid unspecified loaders or treating multiple training cuts as one.
The first two documentation gates passed their retained draft bytes; the
normal push gate binds the final committed correction separately. Only the two owned new
documents change.
