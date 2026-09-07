# Guarded hidden-switch compilation: fixed static replay

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra, independent reference writer
Artifact status: bounded implementation validation; independent review pending

The [static replay module](../../src/Interp.Python/zeta_interp/hidden_switch_compiled_static_replay.py)
checks the 32 source-fixed static cases and their 36 shared-API call slots from
the [accepted outer-negative design](2026-09-07-hidden-switch-compiled-outer-negative-design.md).
It reconstructs fixture expectations from the unchanged preparation module and
an independently supplied `BindingContext`, then executes the actual fixed
operation for every present, admitted slot. This is separate from the complete
92-case recorder, filesystem fixtures, Python children, native execution,
registered source generation and runtime admission.

## Input and returned-result contract

`replay_static_cases(records, context=...)` requires an ordered tuple of
`RecordedCase` values and the explicit caller context. Each case contains its
fixed `CaseId`, exact ordered `NamedInput` bytes, ordered supporting artifacts
with complete `File/Stored/Original` values, and ordered `RecordedCall` values.
A recorded call contains `Operation`, ordered `InputRoles` and original
`ResultRaw` bytes. The producer cannot select executable functions or redefine
expected fixture bytes through these fields.

The replay obtains the current fixed catalog and freshly prepares each case.
It compares every input and supporting artifact against that preparation,
including the caller's independently checked context. It then calls the
unchanged fixed dispatcher once for each present slot. The complete actual
returned object is placed in the replay ledger before producer call metadata,
result parsing or encoding can fail. A missing call has no invented execution;
a raised boundary exception has no invented return.

The actual return is encoded by the reviewed bounded public-result encoder.
Producer result bytes pass the strict JSON reader and the same canonical
encoder as plain data. Comparing these canonical bytes checks every
`Type/Fields/BytesHex` member and nested scalar without importing or constructing
producer-named types. Result JSON whitespace may vary; bool/int, int/float and
signed-zero distinctions remain significant. The strict decoder preserves
lexical `-0` as binary64 negative zero. The raw producer bytes and their observed
length/hash remain retained independently of that semantic comparison.

The per-result admission/encoding ceiling is **1 MiB**, an implementation
resource bound. At most 36 admitted result slots therefore contain 36 MiB of
recorded result bytes. Caller-provided objects, rejected oversized inputs,
retained metadata and canonical/parsed copies are outside that arithmetic;
it is not a process peak-memory or hostile-Python guarantee. Values are
caller-held observations, not deep copies. Sequential execution, stable input
objects and trusted loaded implementation code remain premises.

`StaticReplaySucceeded` and `StaticReplayFailed` retain all preparation and
call observations, including raised exception type/message separately from
actual returned values. Counts distinguish prepared cases, started calls,
returned calls, matched calls and matched complete cases. A later malformed
result, unexpected refusal/success, missing suffix or extra row preserves the
first failure and actual earlier execution prefix. The success scope is only
`32-static-cases-and-36-shared-api-calls-only`; outer source and runtime
admission remain `not-performed`.

## Exact source and diagnostics

Source/test commit: `dc42bd64b302981e9b9a093db8b02183b52e5d05`.
The six local dependency imports preserve the coordinator's unchanged schedule,
cost ledger, binding primitive and static fixture histories; they should not
be reimported into the coordinator. The dependency manifest checks their final
seven shared-module bytes against coordinator
`ba5359b726b10521f5573b09d5ad73bcdfd7f668` before implementation execution.

The [lossless evidence manifest](hidden-switch-compiled-validation/2026-09-07/static-replay-attempt-1/manifest.json)
binds fifteen current source/test files and 97 original artifacts, containing
3,460,606 original bytes. Each gzip artifact retains its raw and stored length
and SHA256, and decompression was verified byte for byte. Fourteen loaded task
module paths and current source bytes are observations in the capture record;
they are not complete Python entry/module/runtime admission or a proof of
source-to-bytecode correspondence. Some dependencies import numerical helpers;
this capture does not execute policies or source generators.

The initial focused run passed 39 tests and failed five parameterizations of
one assertion. The test expected bare `Admitted(False)`, while the actual
half-median helper correctly returned the complete exact numerator,
denominator and `AtMostHalf=False` object. The original source and failure log
are retained. Four typing diagnostics and five loop-closure lint findings were
resolved using distinct typed locals and explicitly bound `partial` calls.
One formatting command used the wrong working directory, refused both missing
paths and changed no files; the corrected command and disposition are retained.

The corrected 44-case suite passed in 4.53 seconds. Three additional explicit
call-role and returned-byte discriminators brought the final suite to
**47 passed in 4.36 seconds**. Strict source/test mypy, Ruff and format checks
passed. The tests distinguish same-value bool/int, `1/1.0`, signed zeros,
complete byte values, wrong refusal/success/type labels, changed input/support
bytes, order and omission, malformed late JSON and both encoder boundaries.
They retain real returns through late failure and distinguish started from
returned calls when the actual fixed dispatcher raises. The signed-zero and
byte-result tests explicitly inject returned values to exercise the generic
comparison boundary; they do not claim those are the ordinary fixture outputs.

## Retained actual static calls

The separate capture harness executes 36 actual producer calls over the fixed
synthetic fixtures, retaining each actual result before proceeding. It then
performs three fresh replay passes: complete (36 calls), late malformed result
(36 calls), and late missing final call (35 calls). Producer calls and replay
calls remain separate; the latter total 107 actual calls. These are no-I/O
shared-API conformance calls, not scientific measurement rows.

The complete replay has counts `32/36/36/36/32`. A duplicate key in the last
recorded result yields `32/36/36/35/31` and retains the actual complete final
ratio object. Omitting that last call yields `32/35/35/35/31`; it does not
invent a 36th invocation. Counts are ordered prepared/started/returned/matched
calls/matched cases. The capture retains 32 preparation results, 36 actual
producer results, the complete recorded fixture tuple, and all three full
replay outputs, alongside source observations and raw stdout/stderr.

The capture writes its own exclusive evidence files outside the pure replay
API. It does not launch file/Python fixtures, native code or policies, generate
registered tapes, measure cost, or admit the whole coordinator envelope.

All sixteen quick-preflight checks passed on the source and report draft. The
raw gate and focused Markdown logs are included in the lossless manifest.
