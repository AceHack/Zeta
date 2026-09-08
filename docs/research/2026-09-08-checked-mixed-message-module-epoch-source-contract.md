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

| Type | Exact fields / variants |
| --- | --- |
| `Failure` | `Code,Stage,Field,Message`; codes `Admission,Conflict,Stale,Family,Improper,Arithmetic,Service,Uncertified,Budget,Storage,Transport,Unexpected`; stage from `admit,learn,forward,gamma,gaussian,project,apply,publish,retract,scheduler`; optional field at most 256 ASCII characters, message at most 1024 UTF8 bytes. Original nested failures remain separately retained. |
| `EvidenceRow` | `Id,ContentSha256,Origin,FeatureAvailable,TargetTime,LabelAvailable,Split,Features,Target,Uses`; eight feature bits, target bits or null; split `train,validation,test,control`. `Uses` is ordered `ContributionUse` records. Times are exact nonnegative int64 logical source times. |
| `ContributionUse` | `ContributionId,Role,ProducerArtifact,ProducerTrainingCut`; role `observation,prior,forecast`; absent producer fields explicitly null. IDs do not establish independence. |
| `EvidenceCut` | `Id,Rows,ActiveIds,PriorOwners,ParentCut,Retractions`; ordered unique row/active IDs; retractions name earlier active IDs; prior owners map variable IDs to one contribution ID. Same ID with changed content refuses. |
| `Preprocessing` | `TrainingCut,Count,Means,Scales`; exactly eight finite means and positive scales in bits. |
| `ModuleArtifact` | `Id,ParentVersion,TrainingCut,Architecture,Ports,Parameters,Preprocessing,UpdateReceiptSha256,SourceBindings`; architecture is exactly `point-mlp-12-4-1-v1`; parameters are exactly 57 finite bit strings. `Ports` declares each ordered child slot `required,optional,absent`. Version is the hash of these canonical bytes, excluding an embedded self-hash. |
| `Node` | `Id,InstancePath,Kind,Inputs,Artifact,Prior,Unary,Children`; kind `neural,precision-gate,composite`; unused fields null, as defined below. |
| `EpochPlan` | `Id,Mode,EvidenceCut,Nodes,SelectedVersions,InitialState,Operations,Sweeps,Damping,Training,Horizon,SourceBindings`; mode `train,query,compensate`; source-fixed operations are validated against the graph and mode, not dynamically dispatched producer code. Horizon is a positive integer at most 1024, frozen for the plan. |
| `Training` | Null outside train mode; otherwise `Artifacts,RowIds,CutEnd,ChildCuts`, in ordinal artifact order. `RowIds` maps each artifact to its unique ordered training IDs; `ChildCuts` supplies the full independently admitted evidence cuts named by child artifact lineage. Every cut hash is recomputed from its canonical content. |
| `State` | `Revision,Weights,GaussianSites,GammaSites,ActiveCut`; maps in canonical ordinal order, site keys `(InstancePath,Factor,Port,ContributionId)`. Sites contain existing `Gaussian` or `GammaKernel` fields encoded in bits. |
| `Observation` | `Sequence,Operation,InputRevision,Inputs,Call,Proposal,Admission,AppliedRevision,Failure`; `Call` is `NotEntered`, `Returned` with its complete source-specific public result, or `Raised` with bounded exception type/message. Union-specific keys only; no runtime type-name instantiation. |
| `EpochResult` | `PlanSha256,Outcome,Failure,LastCommitted,Observations,Counters,PendingRequest,Scheduler,Publication`; outcome `completed,refused`; scheduler retains actual returned `Ok` or `Error`/raised observation. Publication separates retained-in-memory values from actual artifact references and its own failure. |

`Inputs`, source-specific `Call` and `Proposal` use only the finite variants
`LearnStep,NeuralForward,GammaBlock,GaussianBlock,Projection,Apply,Compensate`:
their members are the actual admitted inputs and full returns enumerated in
sections 3-6. No arbitrary `object` is accepted from the wire as an operation.
Public F# APIs are `tryAdmit(plan) -> Result<AdmittedPlan,Failure>`,
`runEpoch(admitted,service,recorder) -> Task<EpochResult>` and
`tryEncode(result,remainingBytes) -> Result<byte[],PublicationFailure>`.
`AdmittedPlan` and service/session handles have private constructors under
ordinary same-process trust. `PublicationFailure` retains the actual result
in memory plus its encoding failure; it is not a published result. Malformed
caller admission has zero operations; a numerical refusal returns an actual
`EpochResult` with its complete observed prefix.

Each cut contains at most 1024 rows/active IDs/retractions and eight uses/row;
there are at most 16 child cuts and 32 prior owners. `Node.Inputs` is an ordered
list of `{SourceNode,SourcePort,TargetSlot}`; the only output port is `mean`,
with a precision node also retaining its variance in its result. Neural nodes
have an artifact ID and null prior/unary/children. Precision nodes have null
artifact/children, prior `{Gaussian,Gammas}` (existing natural fields and
ordered shape/rate inputs), and unary `{K,C}`. Composites have ordered child
IDs and null artifact/prior/unary, with explicit exposed port mappings through
Inputs. Composite aliases do not create a second variable or model factor.
`SelectedVersions` resolves every neural artifact; no "latest" lookup is allowed.
Training's `Artifacts` contains `{Id,ParentVersion,Ports}` requests; every new
training artifact starts from the fixed initializer, not a warm start that may
retain withdrawn data. ParentVersion is a publication precondition and lineage.
Query Sweeps is an integer 1..8; training uses zero. Independently derive the
exact Operations list before admission: training traverses artifact ID, pass
0..1 and its declared row order; query traverses sweep, topological/ordinal
node order, neural forward or nonempty Gamma block then Gaussian block.
Composite and empty Gamma blocks introduce no numerical operation. Each
operation carries only its fixed kind, node/artifact ID, sweep/pass and row ID
where applicable; unknown, reordered, duplicate or omitted operations refuse.
Messages may change under a fixed contribution's state revisions without
becoming a new immutable evidence row. Compensation carries its target
revision and replays the same independently derived schedule if needed.

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
model-selection search. Dataset/source truth behind these admitted records
remains an external data-provenance obligation. Query receives target=null;
held-out scoring is separate. Withdrawing a training row invalidates descendant
lineage and requires a separately budgeted new artifact; no inverse SGD claim.

## 4. Mixed rules, blocks and scheduler retention

A precision-gate node owns one z variable, a proper Gaussian prior, zero to
two feature means, corresponding proper Gamma shape/rate priors, and finite
k, positive c. Its declared potential is
`GaussianPrior(z) * exp(k*z-c*exp(z)) * product_i Normal(z;mu_i,1/gamma_i)`
times the Gamma priors, relative to `dz product_i dgamma_i`.
Feature means are frozen module outputs; they are not separately observed
independent evidence. Variational family is `q(z) product_i q(gamma_i)`.
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
it retains actual returns/refusals and updates that holder before yielding
`Error(Failed failureCode)` on failure. `runEpoch` awaits the actual scheduler
return, retains it, and forms its result from the independent holder. It never
assumes `Error` contains local scheduler state. M4 must use real `drive` and
exercise success, an applied first block and a later refused block. Unexpected
task exceptions are observed as exceptions and converted at the public boundary,
with the existing prefix retained. No cancellation exception is relabeled a
normal successful stop.

Applied revisions are monotonic and bind expected old state/site hashes.
Identical repeated attempt content returns its old receipt; changed content
under that ID conflicts. A stale proposal applies nothing. Compensation is
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
| Peer `Checkpoint` | `Kind,Schema,SessionId,Sequence,Observation,LastRevision,StateSha256`; full bounded observation, not only a producer verdict. |
| Peer `ProjectionRequest` | `Kind,Schema,SessionId,Sequence,RequestId,InputRevision,Base,TargetBits,RawInputHex,InputSha256,CaseId,BindingsSha256,Remaining`; remaining is the full named session counter allowance. |
| Coordinator `ProjectionResponse` | `Kind,Schema,SessionId,Sequence,RequestId,InputSha256,BindingsSha256,ServiceSha256,Native,Certificate,Failure`; `Native` is the full encoded public `NativeObservation` or null, `Certificate` is the full actual reference API return or null. No `Verified=true` substitute. |
| Peer `Terminal` | `Kind,Schema,SessionId,Outcome,Failure,Counters,LastCommitted,LedgerCount,LedgerSha256,PendingRequest,Publication`; a bounded reference summary derived from an actually returned `EpochResult`, never a duplicate of its full recorder snapshots. |

Requests are built internally from the fixed schedule; sequences are 1-based,
strictly ordered, with one outstanding request and exact response correspondence.
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
| Training | At most 256 distinct rows/artifact, exactly 2 passes, at most 4 artifacts and 2048 SGD attempts/session. An attempted step counts even if it refuses before commit. No extra hyperparameter/seed search. |
| Parameters | Exactly 57 weights plus 16 preprocessing scalars/artifact; at most 292 fitted scalars / 2336 binary64 bytes across four artifacts. Each canonical artifact at most 64 KiB including bounded provenance. At most 64 additional fixed model scalars. |
| Input | Start/plan at most 1 MiB; native input and bindings each at most 64 KiB; projection request frame at most 256 KiB; all incoming IDs/lists admitted before expansion. |
| Per-return/frame | Learn/forward/checkpoint at most 64 KiB; native raw and reference result each retain their existing 2 MiB bound; full projection response frame at most 12 MiB; terminal summary at most 1 MiB. Before hex/tree expansion the encoder gets the smaller of this cap and remaining session allowance. |
| Transcript | Sum of original admitted/sent protocol bytes at most 64 MiB, with 1 MiB of that reserved for the terminal; at most 4096 checkpoint/response records. Repeated bytes count at each position. A completed return survives later encoding failure in memory with explicit durable-prefix status. |
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
| M5 learner/epoch | One explicit four-row training fixture exercises nonzero features/targets; retain the full gradient and all 57 replacements. Independently differentiate half squared loss on paper/reference or finite differences for one hidden and one output parameter; mutate hidden gradient to use a newly updated V. Test late arithmetic/encoding failure, child-version swap, stale apply and validation/test training-row refusal. Parameter movement alone cannot pass. |
| M6 structure/dependence | Equivalent composite flattening preserves model, port order, artifacts and outputs under a predeclared numerical comparison. Duplicate expert/prior/training lineage cannot mint independent observations. Present a changed factorization as an exact refactor: reject its model identity. |
| M7 compensation | Compensate an applied contribution and compare with a fresh active-cut replay from the same checkpoint. Reject retracting an unapplied proposal; preserve spent work and history. Training-data withdrawal invalidates descendants, never uses a weight quotient. |
| M8 termination/null | Retain a large undamped change with small-alpha applied change and refuse any inferred fixed-point claim. Compare the learned four-row control with frozen initial weights and fixed label permutation; no held-out labels used. A fixture without learning signal is a failed discrimination, not evidence of a learned system. |

The live M4 plan is one sweep over two zero-feature precision nodes, in order:
`control/positive` has base(eta,t)=(3/2,1), k=-3/4,c=1;
`control/cancellation` has base(eta,t)=(0,1e-300), k=0,c=1. Empty Gamma blocks
are skipped. Thus one actual peer session must retain the first applied
Gaussian block when the second projection refuses, using exactly two native
and two certificate calls with their actual nested reference work. Report any
different outcome rather than changing inputs or budgets to force the control.

M5/M8's sole four-row control has raw observations all zero except the first
coordinate `[-1,-1/2,1/2,1]`, targets equal to that coordinate, absent children,
IDs `control/learn/0` through `control/learn/3`, origins/feature times
0,2,4,6, horizon 1, target/label-availability times 1,3,5,7, split=train and
training cut end 7. No missing labels. Preprocessing is fitted only on these
four rows. The fixed permutation swaps targets 0<->3 and 1<->2. Use no RNG.
Source tests must assert the independently derived gradient rather than just
fit direction; local training-loss reduction is not a held-out performance claim.

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
