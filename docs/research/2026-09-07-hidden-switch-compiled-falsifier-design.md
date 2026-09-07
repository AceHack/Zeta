# Guarded hidden-switch compilation: proposed executable falsifier contract

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: native DTO agreed; revised independent design review pending

## Scope and unchanged registration

This proposes the finite evidence contract needed to close section D of the
[frozen compiled protocol](2026-09-07-hidden-switch-compiled-protocol.md).
It changes no registered model, source seed, source domain, action arm,
ordinary/cost row, threshold or tag. No additional registered stream,
behavior run or timing measurement is authorized by this note.

The coordinator approved this bounded design pass before implementation.
The intended writer boundary is a new pure
`hidden_switch_compiled_falsifiers.py` and matching tests after the native
DTO and independent review agree. The coordinator owns exact choice-buffer
replay, outer envelopes, source/runtime admission, storage, JSON decoding
and their negative evidence. The native author owns executable conformance
hooks, observed call/event collection and native wiring. This writer owns
independent reconstruction and relation checks on decoded witnesses.

The existing [222-scalar/48-new-hand checker](2026-09-07-hidden-switch-compiled-pure-replay-validation.md)
and [24-old-control checker](2026-09-07-hidden-switch-compiled-old-replay-validation.md)
remain full checks. Their currently recorded test inputs are Python-produced;
they do not become native-produced evidence by appearing in this design.
Actual native output and its complete envelopes must still be admitted.

## Proposed exact top-level payload

The existing native hand payload remains exactly `Scalars`, `Episodes`,
`OldControls` and `Falsifiers`. Proposed `Falsifiers` fields are:

- `Schema`: `zeta.hidden-switch.compiled.falsifiers.v1`.
- `ScalarCoverage`: the ordered indices 0 through 221, referring to the
  actual complete scalar slice in this same hand payload.
- `HandCoverage`: 24 ordered rows `{OldIndex, NewIndices}`, with row i
  referencing old i and new `[2*i, 2*i+1]` in the same payload.
- `InvocationCases`: the ten ordered cases specified below.
- `InterventionCases`: the ten ordered cases specified below.
- `RefusalCases`: the fifteen ordered logical-input cases specified below.
- `OuterNegativeEvidence`: one lossless artifact descriptor referring to the
  coordinator-owned outer-negative envelope, as specified below. The pure
  checker validates and retains its shape; admission of its bytes and finite
  refusal roster remains a separate coordinator obligation.

No `Passed` map substitutes for inputs, outputs or observed invocation data.
Coverage references are not certificates on their own. The coordinator
accepted direct revalidation for the initial API: it takes the three decoded
slices and re-executes their existing complete checkers, without caller-made
summary counts. Offline duplicate work is acceptable here. It is outside
the registered native setup and measurement schedules.

The checker derives a fixed coverage result from accepted witnesses. It
does not trust a caller's assertion that a category has been covered.
Unknown fields, missing/duplicate/reordered cases, noncanonical numeric
encodings or changed references refuse with a concrete case/field location.
The return scope remains falsifier/slice replay, never whole-runtime success.

## Ten invocation cases

The ordered cases are six `unsupported-runtime` rows, two `real-fallback`
rows and two `stubbed-fallback` rows. All use the admitted numerical
certificate and current software binary64 source identity.

The six unsupported rows use belief `0.5`, effect true then false, and depth
one, two, three innermost. The mode explicitly disables every fast path.
Each row must return path four, zero guard comparisons and an observed
real recursive invocation, including depth-one and null cases. Compare
the complete output with the independently reconstructed recursive result.
This conformance mode admits no measured unsupported runtime.

The real-fallback rows use effect true, depths two then three, and the
binary64 successor of that depth's admitted `Smax`. Before executing the
witness, require this input to lie strictly below `Hmin`; absence of an
interior value refuses the fixture. This construction comes from the
verified guards, without fitting a new boundary. Require actual recursion,
correct path/work and exact action against the independent arithmetic.

The two stubbed rows reuse those exact inputs. First reconstruct and verify
the preceding real-fallback baseline row. A deliberately incorrect
conformance delegate returns the opposite of the verified baseline action,
without performing real tree work. Retain the actual stub invocation, its
exact returned values and the selector's resulting record. The independent
checker itself compares that retained mutant with the ordinary contract,
requires a typed mismatch, and retains the concrete mismatch in its replay
result. The native producer cannot claim that this later Python comparison
already ran. A claimed refusal flag alone is insufficient. A stub call
cannot earn a recursive-work count.

Row fields are exactly `CaseId`, `Input`, `Mode`, `Choice`, `Invocations`
and `Mutation`. `Input` is exactly `{BeliefBits, Effect, Depth}`;
`Choice` is the existing eight-field choice-work DTO. The native author
accepted each invocation log entry as exactly `Sequence`, `Kind`, `Input`,
`DelegateEntries`, `EvaluatorEntries`, `Returned` and `Failure`.

Sequence is zero-based and consecutive. Kind is `real-recursive` or
`deliberate-stub`. Input repeats the exact three scalar fields. The entry
records one actual delegate entry, separately from the actual evaluator-root
entry delta: real calls have one of each; deliberate stubs have one delegate
entry and zero evaluator entries. `Returned` is a choice-work record or
null; `Failure` is the complete current native failure record or null.
Exactly one is present. A failed/interrupted invocation remains in the
available event prefix and outer failure envelope; all ten accepted hand
rows require a successful result.

`Returned.Nodes` is the recursive-node traversal counter returned by the
reviewed unchanged evaluator. It is distinct from both delegate entries and
root evaluator entries; one root invocation may traverse many nodes. The
source review must verify the actual counter increments and collector sites.
No independent instrumentation of every recursive node is claimed here.

Normal rows use `Mutation=null`. Each stub row uses exactly
`{BaselineCaseId, Kind}`, where Kind is `opposite-action-no-evaluator` and
BaselineCaseId names the preceding matching real-fallback row. The retained
stub result has zero real evaluator/traversal work and the opposite action.
The independent replay records its own observed rejection, not a producer's
asserted expected outcome.

The normal measured service must remain bound to the real recursive
implementation. Injection and call observation belong to explicit
conformance entry points. The agreed source arrangement shares an internal
native evaluator helper and selector fallback branch. Normal services bind
the unchanged evaluator directly; conformance binds a logged wrapper whose
evaluator-entry increment occurs immediately before the actual evaluator
call. The deliberate stub never calls that helper. Concrete source and
actual call sites still need independent review; a delegate log is evidence
under admitted code/runtime, not a cryptographic proof that arbitrary
uninspected code executed.

## Ten intervention cases

The outer order is the five kinds below; native-recursive then
compiled-guarded is innermost. Complete episodes use the explicit `sparse`
hand tape, effect true, dot geometry, fixed palette and semantic index 18.
The caller-copy fixture instead uses the explicitly described one-observation
prefix with effect true, dot geometry and fixed palette. Complete witnesses
retain every no-Q field and must be independently reconstructed, not only
compared with each other.

1. `action-before-feedback`: record the actual event sequence at the
   observation/committed-choice/private-feedback boundaries. The successful
   sequence has 17 observations and 16 choices/feedback steps, with each
   choice committed before its feedback: observe 0, then choose i, feedback i,
   observe i+1 for i from 0 through 15. The source review must tie events
   to actual boundary sites; a fabricated expected sequence proves nothing.
2. `future-suffix`: flip only drift bit 8 after copying the explicit tape.
   Independently reconstruct both complete episodes. The first nine actions
   and observations through index 8 remain equal; state and cue at index 9
   must differ, establishing a real suffix intervention. Later action
   differences are not required.
3. `scorer-receipt-noninterference`: override only recorded evaluator
   `Reward4` entries to zero and recompute `TotalReward4`. Carrier state,
   actual private reward pixels, observations and policy behavior remain
   those of the baseline. Retain 16 actual scorer-hook input/output events,
   and require at least one recorded reward change.
4. `private-band-noninterference`: replace all 512 lower-band cells with
   the alternating binary pattern `cell[i] = i mod 2` after rendering each
   of the 17 frames and before projection. Retain full before/after frame
   data or independently reproducible exact bit records and hashes. Upper
   pixels and every projection/policy field must remain equal, while each
   full-frame hash changes. Rewards and hidden transitions are unchanged.
5. `caller-copy-isolation`: observe a caller-owned projected cue-zero
   frame, then mutate that same caller buffer into valid cue-one geometry
   before choose. The admitted policy belief/choice must remain that of
   cue zero. A fresh control observes the mutated buffer and must have the
   independently computed different belief. Retain actual before/after
   caller bytes and both observations/choices so a no-op mutation cannot pass.

Each row has `CaseId`, `Strategy`, `Input`, `Before`, `After` and `Events`.
The kind determines exact nested types; arbitrary dictionary extension is
not allowed. Complete-episode kinds use the existing no-Q DTO. The caller
copy case uses a smaller explicit observation/choice DTO, never a fake
`Complete` episode with missing fields. Frame cells use exactly 2048 binary
characters, avoiding implicit byte-array/base64 serializer behavior.

The native author accepted the event envelope as exactly
`{Sequence, Kind, Index, Input, Output}`. Sequence is zero-based and
consecutive within one case. Snapshot is the actual native policy record
with exactly `Effect`, `Geometry`, `BeliefBits`, `Observed`, `PendingAction`
and `FilterCounters`; the last record has `Predictions` and `Updates`.
Tape contains exactly `Initial`, `Drift` and `Errors`, with a binary integer
initial state and bit strings of lengths 16 and 17. All counts and binary
integers exclude booleans. Each kind has these exact payload keys:

| Kind | Input | Output |
| --- | --- | --- |
| `observe` | `{Cells, Before: Snapshot}` | `{Cue, After: Snapshot}` |
| `choose` | `{Before: Snapshot}` | `{Choice: ChoiceWork, After: Snapshot}` |
| `feedback` | `{State, Action, Drift}` | `{State, Reward4}` |
| `score` | `{Reward4}` | `{Reward4}` |
| `frame-replace` | `{Cells}` | `{Cells}` |
| `caller-mutate` | `{Cells}` | `{Cells}` |
| `tape-replace` | `{Tape}` | `{Tape}` |

Cells in observe events are the actual projected input bytes. Event frames
have fixed width 64, height 32 and palette 2; malformed-frame metadata is
retained separately in refusal cases. Feedback state/reward is private
evaluator/carrier data retained only in conformance output, never passed
to policy input. The collector records observation and committed-choice
results immediately after their actual calls, feedback after actual carrier
transition, scorer replacement after actual reward, and full-frame
replacement before projection. Dedicated hand orchestration collects these
events; measured services do not collect this ledger.

Chronology cases retain 49 events: observe 0 followed by choose i,
feedback i and observe i+1 for i=0..15. Score cases retain 16 score events
with indices 0..15. Frame cases retain 17 replacement events with indices
0..16. Suffix cases retain one tape-replace event with index 8. Caller-copy
cases retain five events, all at index zero: observe, caller-mutate, choose,
observe, choose. The second observe/choose pair uses an independently
created fresh controller, visible in its initial snapshot. The first pair
uses the actual retained successor from the original observation.

The native author accepted the final case-level `Input`, `Before` and
`After` union below; these records are not silently inferred from
event flags:

- Complete-episode Input is exactly `{Tape: "sparse", Effect: true,
  Geometry: "dot", Palette: "fixed", Index: 18}`. For action-before-feedback,
  Before is null and After is the complete episode. The other three episode
  kinds retain complete Before and After episodes.
- Caller-copy Input is exactly `{Effect: true, Geometry: "dot",
  Palette: "fixed"}`. Before is `{Cells, Snapshot}`, retaining cue-zero
  cells and the actual successor immediately after observation. After is
  `{Cells, RetainedChoice, RetainedSnapshot, ControlObservedSnapshot,
  ControlChoice, ControlSnapshot}`. The retained choice occurs after the
  mutation; the control uses a newly created controller. The complete event
  sequence and independent arithmetic must agree with all these records.

The native author confirmed that the unchanged old scorer hook changes
only the recorded reward after the carrier transition. The proposed new
receipt-only case preserves that semantics. The existing independent
Python `scorer_override` also changes subsequent private frame marks;
it is a different combined intervention and must not silently supply this
case. The independent checker can reconstruct the ordinary baseline and
apply exactly the receipt-only field transformation, while separately
replaying and checking the observed hook log. Band intervention remains
a separate case and can use the existing frame-replacement model.

## Fifteen logical-input refusal cases

Freeze the following ordered roster before native implementation:

1. NaN belief bits at scalar admission.
2. Positive-infinity belief bits at scalar admission.
3. Negative-infinity belief bits at scalar admission.
4. Least negative subnormal belief, outside the admitted interval.
5. Successor-of-one belief, outside the admitted interval.
6. Depth zero.
7. Depth four.
8. Noncanonical finite-bit string.
9. Nonbinary frame cell.
10. Wrong frame dimensions.
11. Choose before an observation.
12. Observe again without a committed action.
13. Choose twice after one observation.
14. Choose after the terminal observation.
15. Invalid action at the common prediction boundary.

Each logical group retains `CaseId` and its ordered `Operations` array.
Every operation retains complete input, outcome and actual call counts.
A refusal must have a
typed native stage/code agreed for that operation, no accepted action and
no fabricated successful output. The pure checker independently classifies
the same input as invalid. Source-specific native and Python error strings
need an explicit reviewed mapping; equality of their prose is not required.
These are conformance calls, not extra policy arms or ordinary source runs.

The read-only review of initial draft `541b8c773f2afba2009344a4ebe6bfcaf254ebd6`
identified that a standalone admission-helper call would not establish that
the native and compiled service paths actually refuse invalid inputs. The
native author accepted the following fixed expansion of the fifteen logical
groups into **53 failing operations**, with setup calls recorded separately:

| Logical group | Ordered operations | Count |
| --- | --- | ---: |
| Invalid belief, groups 1 through 5 | For each group, native then compiled; inside each, `(effect=true, depth=1)`, `(false, 3)`, `(true, 3)` | 30 |
| Invalid depth, groups 6 and 7 | For each group, native then compiled; inside each, effect true then false, belief `3FE0000000000000` | 8 |
| Noncanonical bits, group 8 | Actual parsing/dispatch entry, native then compiled | 2 |
| Frame/order, groups 9 through 14 | Actual policy entry, native then compiled | 12 |
| Invalid prediction action, group 15 | Actual unchanged common prediction boundary | 1 |

Groups 1 through 5 use respectively `7FF8000000000000`,
`7FF0000000000000`, `FFF0000000000000`, `8000000000000001` and
`3FF0000000000001`. A clearly named fixture operation decodes the exact
unsigned 64-bit pattern into a native double **without finite admission**,
then calls the actual selected service. This deliberately lets nonfinite
values reach each service's own checks. It does not replace the ordinary
wire parser or weaken the measured service. Depth-one and null calls
exercise paths that would be trivial compiled fast paths for valid inputs.

Groups 6 and 7 use depths zero and four. Group 8 uses
`3fe0000000000000`, reaching the actual strategy parser/dispatcher; expected
service entries are zero after parser refusal. Groups 9 and 10 start with
a valid dot/fixed projected cue-zero frame, then respectively set cell zero
to 2 or width to 63. The order groups retain their complete successful
setup prefixes and the actual final refused operation; terminal setup uses
the explicit sparse hand prefix. Group 15 uses action 2, belief one half
and effect true at common prediction.

The native author verified this stage/code mapping against current source:

| Groups | Expected native stage/code |
| --- | --- |
| 1 through 5, raw-bits fixture reaching service | `policy` / `belief` |
| 6 and 7 | `policy` / `depth` |
| 8 | `input` / `binary64-bits` |
| 9 | `observation` / `frame-palette` |
| 10 | `observation` / `frame-shape` |
| 11, 13 and 14 | `policy` / `choice-order` |
| 12 | `policy` / `observation-order` |
| 15 | `policy` / `prediction-input` |

The ordinary `parseFiniteBits` path would instead refuse NaN/infinity as
`input` / `nonfinite`. That parser-only observation must not substitute
for the registered service-refusal witnesses above. Source admission must
recheck these mappings if their implementation changes before archival.

The native author accepted each failing-operation record as exactly
`OperationId`, `Strategy`, `Operation`, `Input`, `Setup`, `Outcome` and
`Calls`. Strategy is `native-recursive` or `compiled-guarded`, with `common`
only for the final prediction case. Scalar Input is the same three-field
record as invocation Input. Frame and repeat-observe Input is `{Frame}`,
where Frame is exactly `Width`, `Height`, `Palette` and `CellsHex`.
CellsHex has 4096 uppercase hexadecimal characters representing the actual
2048 bytes, allowing a nonbinary byte such as `02` to be retained losslessly.
Choose Input is the empty object. Prediction Input is exactly
`BeliefBits`, `Effect` and `Action`.

Setup is exactly `{Initial, Events}`. Scalar, wire and prediction operations
have null Initial and an empty Events array. Policy operations retain the
actual initial snapshot immediately after create. Frame and choose-before
cases have no setup events. Repeat-observe has observe 0; duplicate-choose
has observe 0 then choose 0; terminal-choose has the complete 49-event sparse
hand prefix. The actual immutable policy successor from that setup is
passed to the refused operation; the collector cannot substitute a fresh
controller while retaining a claimed terminal prefix.

Outcome is exactly `{Kind: "refused", Failure}`. The full native Failure
record has exactly `Stage`, `Code`, `Detail`, `Panel`, `Mode`, `Strategy`,
`Replicate`, `Episode` and `Call`. These conformance refusals leave the last
six context fields null. Detail is a nonempty string; its prose need not
match the independent Python refusal. The agreed stage/code and operation
input determine the checked refusal meaning.

Calls is exactly `{Setup, Operation}`, each containing exact nonnegative
integer `EntryCalls`, `ServiceEntries` and `EvaluatorEntries`. EntryCalls
counts actual tested policy/wire/prediction entries. Setup includes its
actual create call when Initial is nonnull, plus observe/choose calls in
Events; private carrier-feedback calls do not increment this counter.
Thus scalar/wire/prediction setup has zero entries; empty created setup has
one; observe prefix has two; observe-plus-choose prefix has three; terminal
prefix has 34 (create plus 17 observations plus 16 choices).

Every final refused operation has EntryCalls one. Direct scalar service
operations have ServiceEntries one and EvaluatorEntries zero; final wire,
frame, order and prediction refusals have both zero. Successful setup's
service/evaluator counters are recorded at actual call sites separately:
the native terminal setup has 16 evaluator-root calls; compiled setup may
use fewer. The checker compares these observed totals with independently
reconstructed setup behavior, rather than accepting totals inferred by the
native producer from event length or returned ChoiceWork.

The native author accepted these exact literal names:

- Invocation CaseId is `unsupported-runtime-effect-{true|false}-depth-{1|2|3}`
  for the first six rows, then `real-fallback-depth-{2|3}` and
  `stubbed-fallback-depth-{2|3}`. Mode is `unsupported-runtime` for the first
  six and `guarded` for the others; neither asserts actual runtime admission.
- Intervention CaseId is `{kind}/{strategy}`, with the exact five kind
  names above and the existing strategy strings.
- Refusal CaseIds, in group order, are `belief-nan`,
  `belief-positive-infinity`, `belief-negative-infinity`,
  `belief-negative-subnormal`, `belief-above-one`, `depth-zero`, `depth-four`,
  `noncanonical-bits`, `nonbinary-frame`, `wrong-frame-dimensions`,
  `choose-before-observe`, `observe-without-action`, `duplicate-choose`,
  `terminal-choose` and `invalid-prediction-action`.
- For the first seven refusal groups, OperationId is
  `{CaseId}/{Strategy}/effect-{true|false}-depth-{integer}`. For the others,
  it is `{CaseId}/{Strategy}`. Operation is `fixture-raw-bits-service` for
  groups 1..7, `parse-dispatch` for group 8, `observe` for groups 9/10/12,
  `choose` for groups 11/13/14 and `predict` for group 15.
- The noncanonical wire case uses effect true and depth 3. Every policy
  prefix uses effect true, dot geometry and fixed palette; complete sparse
  prefixes use semantic index 18. Empty scalar setup does not create a
  controller. The common prediction case uses Strategy `common`.

Braces in these name templates denote substitution, not literal braces.
The fixed ordering, member shapes and literal names were agreed without
running the native witnesses or changing registered behavior rows.

## Pure checker interface and partial-result accounting

The proposed public entry is `replay_falsifiers(scalars, episodes,
old_controls, falsifiers, certificate)`, using this lane's existing
`Success[T] | Failure` result convention and an actually issued
`VerifiedCertificate`. Inputs are already decoded plain JSON values; the
checker still validates every exact nested key/type and full ordered roster.
It does not decode raw JSON, inspect files, collect runtime identities,
generate source tapes or import the native implementation. No cache is
planned for this bounded hand replay.

It first re-executes the existing complete 222-scalar/48-new-hand and
24-old-control checkers on the supplied slices. It then checks the exact
coverage references and every ordered invocation, intervention and refused
operation against independent reconstruction. Complete episodes are checked
field by field, including terminal observation and every hash; no Q fields
are discarded from the old controls. Supplying Python-produced fixtures
tests the checker; native conformance requires later native-produced inputs
with separate complete-envelope and source/runtime admission.

Success retains the exact validated outer-negative descriptor and explicit
counts for scalar positions, new and old hand episodes, complete invocation
cases, complete intervention cases, completed refusal operations and
completed refusal groups. It separately retains the two actual typed mutant
mismatches computed during replay. Delegate and evaluator totals derive
from the admitted actual log, after per-call checking; returned traversal
counts are compared separately with the independent execution model.

A failure reports a concrete path and only work already checked: completed
scalar/episode rows, complete preceding invocation/intervention cases, and
completed refused operations/groups. It never reports the currently failing
case as accepted. Failure and success both retain the bounded scope;
`OuterNegativeAdmission` remains `pending-coordinator-replay` and runtime
admission remains outside this module. The exact public result dataclass
fields will be pinned with the first implementation commit for caller review.

## Separate outer negatives and closure prerequisites

The coordinator retains wrong epsilon, swapped/outward guards, inclusive
switch tie, omitted subtraction error, changed model/depth/effect,
missing candidates/intervals, fabricated work, source/hash/runtime identity,
reused output path, duplicate/nonfinite JSON and truncated/reordered-data
negative evidence at its existing certificate/outer/storage/choice-buffer
boundaries. These are separate executable obligations, not waived by this
pure module. Existing unit-test counts alone are insufficient.

The coordinator selected a lossless descriptor with exactly `File`, `Bytes`,
`Sha256`, `Encoding`, `StoredBytes` and `StoredSha256`, matching the existing
pure artifact admission boundary. Lengths are exact nonnegative integers
at most signed-int64 maximum, excluding booleans; hashes are 64 uppercase
hexadecimal characters. `File` is a nonempty relative ASCII POSIX path
containing only letters, digits, dot, underscore, slash and hyphen, without
empty, `.` or `..` segments. Encoding is exactly `identity` or `gzip`;
identity storage requires equal raw/stored lengths and hashes, and gzip
requires a `.gz` suffix.

This module opens no files and does not import the coordinator's filesystem,
runtime or envelope machinery. It retains the validated descriptor and
returns `OuterNegativeAdmission="pending-coordinator-replay"`. Complete
hand/whole-phase admission must separately read, bind and replay the exact
referenced negative envelope and every case. A descriptor hash or case
count cannot establish that the outer negatives passed.

Before checker implementation, the coordinator/reviewer must accept the
complete revised design. Before complete conformance admission and
implementation archival, source review must additionally verify the actual
helper/call-site implementation, refusal mapping, instrumentation and
real/stub distinction. The coordinator must independently close its finite
outer-negative envelope and replay. Its separate byte admission does not
block defining this pure module's descriptor-only boundary.

The coordinator accepted the finite coverage and scorer/band separation,
and selected direct revalidation of all three raw slices for the initial
API. No caller-made summary count or pass flag can replace that work.

The independent reviewer read the initial pinned draft without executing
tests, guards, policies or sources. The reviewer accepted the suffix
indices, discriminating caller/band controls and scorer semantics, then
identified the standalone-refusal-helper gap and the ambiguous phrase
"actual tree-entry count." The 53-operation expansion and separate
delegate/evaluator/node counts above preserve those findings and their
source-owner-approved dispositions. Final revised-design review is pending.

This draft preserves the native scorer-semantics coordination and a concrete
finite starting roster for review. It claims no new implementation, actual
falsifier execution, native conformance or experimental outcome.

For this documentation-only draft, focused Markdown lint, all six repository
hygiene checks and diff whitespace validation passed. No native build,
Python policy/test execution or experiment was needed or performed.
