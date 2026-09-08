# Guarded hidden-switch compilation: native-dependent pure replay

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra, independent reference writer
Artifact status: bounded implementation validation; corrected source independently accepted

The [new pure replay](../../src/Interp.Python/zeta_interp/hidden_switch_compiled_native_replay.py)
executes the 43 Python operations in the fixed 38 native-dependent cases and
compares their complete recorded results. It separately checks 31 supplied
native certificate reports. It launches no native process, generates no
registered source stream and performs no standalone policy run. Complete
comparison of this slice does not complete the 92-case coordinator or admit
native execution, source custody, loaded artifacts or runtime closure.

The [accepted case design](2026-09-07-hidden-switch-compiled-outer-negative-design.md)
and [unchanged fixture preparator](2026-09-07-hidden-switch-compiled-native-fixture-validation.md)
define the finite input and operation roster. The coordinator and independent
reviewer accepted this reader's bounded contract before implementation. Its
initial source and tests are pinned at e2dde77cf59de9fe435dcc69eb63cf842bc48578.
The reviewed correction is e4946ec091981ccbd3057eb568d56069e79df4f2; both
versions and their source-bound captures remain retained.

## Independent preparation and complete returned results

The caller supplies an issued verified certificate, its independently expected
binding map and six original prerequisite byte strings: certificate, bindings,
hand slices, semantic witnesses, selector witness and choice context. Fresh
preparation reconstructs all 38 cases and ordered input bytes. The recorded
case ID, control ID, inputs, call names and ordered roles must match that fixed
expectation. Producer labels never select a function, mutation or type.

Preparation helpers execute separately from case operations. The preparator's
opaque issued capability stays private. A successful reader exposes an
explicit PreparationSnapshot of the complete public Cases, Inputs, Preparation
helper outcomes and scope fields. It does not present that snapshot as the raw
serialized capability return. A failed preparation retains its actual public
failure and helper/input/case prefix; an ordinary raised error remains distinct
from a returned result.

Each present Python call executes the unchanged dispatch exactly once. Its
complete actual return is retained before recorded result metadata, parsing,
encoding or later native evidence admission can fail. The reader compares
canonical encodings of the actual public result and strict-decoded recorded
result tree. Every Type, Fields, BytesHex and scalar value participates;
producer-named types are never instantiated. Harmless JSON whitespace is
permitted while bool/int, integer/float and signed-zero differences remain
load-bearing. Raw recorded bytes stay retained and require separate outer byte
binding.

## Actual native report boundary

NativeCertificateEvidence carries a fixed CaseId and the original complete
RawReport supplied independently by the coordinator. The actual native
certificate-check entry was pinned at
34b4395175cd58ee2caba179e6061e54521673f6. The full original report has fifteen
fields, including command completion, invocation count, actual input hashes,
assembly/runtime observations, arguments and timestamps. The case result uses
only InputSha256, BindingsSha256 and Outcome; that projection is derived after
strict report admission, never substituted for the original raw report.

A usable prerequisite report must have Complete=true, Failure=null,
VerifyCalls=1, SourceDraws=0 and RuntimeAdmitted=false with exact JSON types.
The latter is the native entry's truthful prerequisite status, not evidence of
final runtime admission. Both input hashes must match the freshly constructed
certificate case and exact supplied binding bytes. All fifteen raw/decoded
fields remain retained. This reader validates the declared report shape and
outcome semantics; the coordinator separately admits actual launch, source,
artifact custody, argument/path associations and chronology. Flags and matching
bytes cannot prove that a native process executed.

The native author confirmed the source-specific refusal boundaries independently
of the Python parser's messages. The reader uses fixed positions from the
31-case source roster:

| Native case positions | Required actual outcome |
| --- | --- |
| 0, baseline | Accepted, with the independent complete certificate digest. |
| 1 through 25, 27 and 28 | numeric-certificate / mismatch. |
| 26 and 30 | numeric-certificate / json. |
| 29, empty input | numeric-certificate / bytes. |

Every refusal retains the full nine-field Failure. Its six location fields
are null for this entry. Fixed mismatch/bytes details are checked exactly;
actual JSON parser detail is retained from the independent original report
and fully compared against the recorded case result. The invalid UTF8 and
unpaired-surrogate corpus inputs each contain only one property: the native
full-object cardinality check refuses before accessing those malformed names.
They do not exercise its separate delayed-string json-string exception path.

Absent native evidence as a whole produces a distinct NativeReplayPending
result: all 43 Python calls may match, while 31 native slots remain pending.
A supplied incomplete, reordered, malformed or mismatching report tuple fails
at its exact position and retains earlier actual Python returns and native
comparisons. NativeReplayCompleted counts 43 Python returns and 31 native
comparisons separately; it never claims 74 new executions. A pending result
matches seven complete non-certificate cases, with the other 31 cases still
pending. All result variants explicitly leave native execution/runtime and
whole outer admission unperformed.

## Bounds and ordinary caller premises

Each recorded result and native report is limited to 1 MiB. Consumed raw and
canonical byte positions are limited to 128 MiB per replay. Charges include
prerequisite raw inputs, the public preparation's flat input bytes, recorded
fixed case inputs/results, native raw reports and both canonical result
encodings. Repeated positions are charged again. The bounded encoder receives
the remaining allowance before expanding a result.

These implementation limits are separate from the scientific protocol and its
sample/cost thresholds. They do not bound caller-held objects, preparation
allocation, rejected raw values already retained by the caller, temporary
copies or process peak memory. Sequential calls and stable ordinary Python
objects are assumed. Issued handles are an accidental-misuse boundary, not a
hostile-Python capability or source-to-bytecode proof.

## Tests and retained interpretation

The first focused suite passed 49 cases in 75.65 seconds. Strict typing found
seven diagnostics in dynamic dataclass replacement and reused local variable
names; style checks found two unused imports. The original source and outputs
are retained. The corrected source passed the same 49 cases in 76.28 seconds;
strict source/test mypy, Ruff and format checks passed.

The tests discriminate fixed input/control/operation rosters, fresh dispatch,
late missing/extra cases/calls/native evidence, complete nine-field native
refusal checks and native input/binding substitutions. They preserve an actual
Python return before a later native report failure, result parser refusal,
encoder failure or quota refusal. Full Type/Fields changes, same-value numeric
type substitutions, signed zero, duplicate JSON keys and nonfinite values
refuse. Both complete and pending returned DTOs pass the unchanged bounded
public-result encoder.

The [unchanged original native report fixtures](hidden-switch-compiled-validation/2026-09-07/native-replay-inputs/manifest.json)
retain all 31 reports and exact binding bytes from the coordinator's earlier
actual capture. Existing actual semantic and selector receipts supply the
hand values. Their placeholder maps differ: the certificate capture names
hand/source.py while the semantic capture names hand-validation. This is
explicit numerical fixture reuse for testing the pure reader. It is not a
combined native/source/runtime admission and does not silently alter any
original receipt. Parent coordination must supply an admitted coherent final
prerequisite set before using this slice in the final outer chain.

## Source-bound standalone capture

The [lossless validation manifest](hidden-switch-compiled-validation/2026-09-07/native-replay-attempt-1/manifest.json)
retains 104 compressed artifacts containing 72,103,126 original bytes. Fifteen
Python source/helper/test pins match the source commit; three additional
native source snapshots bind the report and refusal-boundary interpretation.
All 79 captured public-result byte identities were independently checked
against the retained files before lossless packaging.

The harness saves every returned producer dispatch before proceeding. It
records 43 actual Python operation returns and 31 explicit unexecuted native
requests. It then retains the recorded case tuple, independently supplied
native report tuple and three complete actual reader returns:

| Capture | Python returned / matched | Native compared / pending | Matched cases |
| --- | --- | --- | ---: |
| Complete supplied reports | 43 / 43 | 31 / 0 | 38 |
| Absent native evidence | 43 / 43 | 0 / 31 | 7 |
| Missing final native report | 31 / 31 | 30 / 0 | 30 |

The last run retains its first refusal at NativeEvidence[30], including the
31st actual Python return immediately before that missing native slot. Its
result is NativeReplayFailed, not an expected native certificate rejection.
The completed and pending runs retain their distinct public types and scope.
No native process was launched by this harness; original native execution
remains attributable only to the separately retained earlier capture.

Fourteen loaded task module paths/current hashes are recorded observations.
They are not a complete parent Python entry/module/runtime admission or a
source-to-bytecode theorem. The archive also retains both focused-suite outputs,
the initial and corrected sources, typing/style diagnostics and the exact
capture/preservation harnesses. Aggregate archived bytes and helper counts are
implementation validation quantities, not scientific sample sizes or cost rows.

## Review findings, correction and fresh capture

Independent review found two failure-path defects in e2dde77. A normally
returned DispatchFailure or other unexpected return was retained but omitted
from PythonReturned. Separately, a Dispatched value containing Call=None or a
mapping could raise AttributeError before returning the typed replay failure.
These were accepted as implementation defects, despite the original 49-case
success. New exact metadata checking also exposed False being accepted as
CallIndex=0.

All six added regressions failed against the original source: three normal
returns were undercounted, two malformed nested calls escaped and the boolean
index was admitted. The corrected source counts every non-raised return before
asking whether it represents a completed operation, then checks the exact
nested CallResult and scalar/role metadata types before dereferencing members.
PythonReturned means all normal dispatch returns; it does not itself claim a
completed conformance operation. Matched operation counts and retained actual
completion metadata remain separate.

The corrected implementation passed all 55 cases in 71.27 seconds. Five
subsequent test typing diagnostics concerned a list annotation and formatter-
moved type-ignore comments for deliberately malformed inputs. Explicit test
casts resolved them without changing runtime values or the source module.
The six focused regressions then passed in 9.61 seconds, with strict
source/test typing and Ruff/format checks clean. Every diagnostic, original
regression failure and test/source snapshot remains retained.

Reviewer Vera, OpenAI Codex using GPT-6 Astra, accepted exact corrected source
e4946ec091981ccbd3057eb568d56069e79df4f2 after checking committed/current
module and test bytes and reading the complete source and discriminators.
The source review retains both original findings and the boolean-index
regression; no material source finding remained in this bounded scope. The
reviewer did not execute fixtures, native code, policies or source streams.
Actual evidence preservation is a separate audit.

The [repaired capture manifest](hidden-switch-compiled-validation/2026-09-07/native-replay-repair/manifest.json)
retains a fresh exclusive capture under e4946ec, with 81 public-result
artifacts. The complete, pending and missing-final-native replay result bytes
are each identical to the corresponding original capture; both copies and
their independent byte identities remain preserved. Two additional owned
dispatch interventions return a typed refusal and a malformed nested Call.
Each actual replay retains one started/normal-returned dispatch, zero matches,
and a typed failure. Those interventions are implementation fixtures, not
completed scientific operations or native calls.

The repaired inventory contains 106 artifacts and 113,048,682
original bytes, with fifteen current Python source/helper/test pins and the
same three pinned native boundary sources. Validation counts are aggregate
implementation evidence; the 128 MiB consumed-position bound applies to each
reader call and makes no promise about the total stored multi-attempt archive.


The exact-source review is preserved independently in signed commit
5d329128194c9cefe194c489e9b13cd6aa6ec2db and was delivered to the coordinator
for indexing. It specifically binds the final mypy-final, Ruff and format
outputs; the earlier mypy-repair diagnostics remain retained as history.
Focused Markdown validation and all sixteen final quick-preflight checks pass.
Their raw outputs are retained alongside the corresponding original/repaired
attempt; these publication checks do not constitute full runtime or outer
coordinator admission.
