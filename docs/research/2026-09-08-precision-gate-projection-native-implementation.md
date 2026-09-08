# Native scalar Gaussian projection candidate

Date: 2026-09-08
Author: Vera (OpenAI Codex, GPT-6 Astra)
Operational status: research-grade
Artifact status: implementation and focused fixtures; independent complete source
review and the registered final comparison are pending

## Scope and frozen inputs

This implements only the bounded binary64 candidate in the
[registered scalar projection contract](2026-09-08-precision-gate-projection-proposed-contract.md).
The original contract is `1bf71bbac7f6896216c7079abd4e99b7c79e2870`, 38,142 bytes,
SHA256 `537054779BF9E0BFA9271B5CC56116FBC80B16C4A2BE9F1B5E3C022FE95A0F8E`.
The [registration](2026-09-08-precision-gate-projection-registration.md) at
`8e38c993a5da03f2ff4206ee5877f76d250a04f7` assigns native session
`codex/20260907-c7b2a402`. Both separately registered clarifications are binding:

- [Decimal grammar](2026-09-08-precision-gate-projection-decimal-admission-clarification.md),
  source `b9fe348661aef30fbd1a02cab1ad2979287bddae`, SHA256
  `BA359E4FEC2484A680B6B149E6E887FBEA82AFBB67A15EAFBDB99949101BDAB8`.
- [Rendered zero](2026-09-08-precision-gate-projection-rendered-zero-clarification.md),
  source `1d8fd0bb6a027aa358c0d8251ae8e94eb0fec6c6`, SHA256
  `67B7C9EFB6B42CEFE341507738B6122FAC4BEDF18C07A72564F3DEEFEE71235E`.

The prior kernel prerequisite is merged main
`155d45e32d01152004a03862213550ada96fb036`. The existing
[objective kernel](../../src/Bayesian/PrecisionGateKernels.fs) remains byte-identical,
SHA256 `4004196CB0ADE8527DFEBF83FBB3E6E42BD36208E38AFFD09906787A84901C02`.
No reference result or new reference solver output was inspected. No registered
40-subject/88-call comparison, training, graph update, mixed scheduler, optimizer
integration, ARC episode, or paused compiled-study stream was executed here.

## Public boundary and numerical meaning

[PrecisionGateProjection.fs](../../src/Bayesian/PrecisionGateProjection.fs) exposes
`tryNativeCall raw expectedInputSha256 expectedCaseId expectedBindings`,
`tryReadBindings`, `tryEncode`, and `tryEncodeFailure`. Every public operation
returns a typed `Result`. Caller expectations are supplied independently.
Bindings is a flat exact string-to-uppercase-SHA256 map: `ProtocolSha256`, the
two clarification paths, and the coordinator's complete finite source map.
The producer checks registered declarations and retains that supplied map; it
cannot certify its own loaded-source identity. The coordinator owns that proof.

Admitted caller metadata yields a complete registered receipt even when the
actual input, rendered target, arithmetic, or original objective refuses. Invalid
caller metadata instead yields an API failure. Native receipts have exactly
`Schema, CaseId, InputSha256, Bindings, Outcome, Counters, Trace`; all optional
registered members are explicit JSON nulls. CaseId is the numeric subject Id,
including when a coordinator's distinct outer control references that subject.

Strict input admission bounds raw bytes at 64 KiB, JSON nesting at 16, rejects
invalid UTF-8 and duplicate decoded keys, and requires the exact nested key sets.
A decimal has at most 128 ASCII characters and the full-string registered grammar;
absolute exponent admission precedes integer construction. A single invariant
binary64 conversion supplies the target bits. Exact BigInteger arithmetic retains
the requested rational, rendered dyadic, and their difference. U/K rendering to
signed zero is admitted. T/C rendering to zero preserves the target then refuses
Domain before root arithmetic. Nonfinite rendering cannot invent a finite target.

The typed caller boundary additionally bounds each expected subject to 64 KiB
of UTF-8, at most 1,024 binding members, and the logical binding payload to 64 KiB.
The file boundary independently enforces its actual 64-KiB JSON byte cap. These
are bounded caller-admission controls; they do not replace the exact production
source map supplied by the coordinator.

For the rendered target, the unchanged objective is

~~~text
F(m,v) = t*((m-u)^2+v)/2 - k*m + c*exp(m+v/2) - log(v)/2.
~~~

The candidate follows the frozen source order:

~~~text
lt=log(t); lc=log(c); a=u+k/t;
B=(lc-lt)+a; D=(1/t)/2;
L=min(0,B-1); U=log(max(1,B+D));
q=exp(x); d=1+q; phi=((x+q)-D/d)-B.
~~~

Both initial endpoints are evaluated before bracket admission. Each iteration
computes `x=L+(U-L)/2`, refuses noninterior resolution, evaluates phi once, and
uses the rounded sign to update one endpoint. Rounded zero or the registered
width threshold returns the last actual x/q pair. `native-one` permits one
midpoint; other native profiles permit 256. Rounded signs are diagnostic and
are never presented as an interval certificate or proof of the exact minimum.

Reconstruction retains each actual intermediate in order:
`R=t*q`, `v=(1/t)/(1+q)`, and `m=((lt+x)-lc)-v/2`. Finite results and positive
q/R/v are required. Every nonzero multiply/divide that becomes zero and every
positive exponential that becomes zero refuses. Exact-zero cancellation is
allowed. The producer then calls the unchanged objective once, retaining its
actual value and both derivatives or its original typed error. No stationary
identity replaces that call or forces its gradients to zero.

Counters record entry before each operation, including failure. Solver log/exp
counts exclude the objective's internal operations. Starts increments at numeric
service entry before domain admission; wire failures have zero Starts. One bounded
trace row records each completed/failed stage, at most 262. Successful partial
parameters, the current bracket, reconstruction and original objective remain
available when a later stage refuses. The local private Result builder extends
only this module's control flow; Core's builder is unchanged.

## Replay command and file custody

[PrecisionGateProjectionReplay.fsx](../../src/Research.FSharp/PrecisionGateProjectionReplay.fsx)
has exactly this argument order:

~~~text
dotnet fsi --exec src/Research.FSharp/PrecisionGateProjectionReplay.fsx \
  INPUT_PATH EXPECTED_INPUT_SHA256 EXPECTED_SUBJECT_ID BINDINGS_JSON_PATH OUTPUT_PATH
~~~

The five nonempty arguments have a combined 64-KiB UTF-8 bound. Output is opened
exclusively with CreateNew before computation; an existing path is never replaced.
The input and bindings files are bounded at 64 KiB before parsing. Unix leaf opens
use nonblocking/no-follow flags, then require a seekable handle, an admitted
initial length, exactly that many bytes plus at most one additional byte, and an
unchanged observed length. Windows uses its ordinary file API. A ten-second read
deadline is checked between reads. This is a stable owned-file premise, not hostile
namespace isolation, atomic file immutability, kernel-I/O cancellation or OS quotas.

Actual input hashes are retained before the next dependent read. Two directly
used assembly files, Bayesian and Core, are observed with 128-MiB per-file caps
before the numeric call. These ordinary file observations do not prove that every
loaded dependency matches the coordinator's map or establish complete runtime
closure. The coordinator separately owns copied DLL custody and before/after
producer observations.

The exclusive output file contains exactly the encoded registered receipt, with
no newline and at most 2 MiB. A typed numerical refusal can therefore have a
successful complete command publication. Flush and close must both succeed for
command Complete=true. On encoding/write/flush/close failure, `runWith` returns
the complete actual receipt in memory alongside the command error. Original
failure remains primary and cleanup failures remain separate. No truncated
receipt is labeled complete. Retention in memory does not promise recovery after
process death, failed storage or abrupt host termination; serialization allocation
is also separate from the emitted byte ceiling.

Stdout is one newline-terminated JSON object, at most 128 KiB including newline,
with exact keys `Schema, Complete, Failure, ApiFailure, Cleanup, InputFiles,
AssemblyFiles, Output, ReceiptAvailable, ReceiptKind, Counters, TraceRows, Runtime`.
Schema is `zeta.precision-projection.command.v1`. Each file observation is exactly
`Path, Bytes, Sha256`; SHA256 is uppercase. Command failures are
`Stage, Code, Message`; ApiFailure preserves the registered failure shape.
Output identifies bytes written and flushed before a possible close failure.
ReceiptKind is candidate/refused or null. Counters/TraceRows are observations of
the complete in-memory return or null, never a replacement numeric receipt.
Exit 0 means complete command publication; exit 2 means command/publication refusal.
Unexpected script compilation/startup failures can precede this schema and must
be retained by the external launcher. Stdout failure gets a separate best-effort
bounded stderr diagnostic, without rerunning the calculation or overwriting output.

## Focused validation and preserved first outcomes

[Dedicated tests](../../tests/Bayesian.Tests/PrecisionGateProjection.Tests.fs)
include three independently derived dyadic stationary centers, an independent
objective value, direct original-kernel equality, large positive forcing without
`exp(u)` initialization, actual iteration/entry counts, exact conversion drift,
signed zero, domain and arithmetic underflow/range refusals, and actual original
objective failure. Wire tests reject escaped duplicate keys, malformed UTF-8,
wrong fields, wrong independent hashes and the registered grammar violations.
The encoder refusal test keeps the full original in-memory candidate available.

Five file fixtures exercise exclusive output, a failed second read after the
first input hash, oversized binding bytes, real file write followed by primary
flush and secondary close refusals, and successful publication of an actual
numeric refusal. The same Replay source is conditionally linked into the test
project; only its FSI entrypoint is excluded there. It is not copied into a second
implementation. The graph derivation reported its artifact already current.

Retained first outcomes, without row replacement:

1. Native build 1: exit 1, six errors and zero warnings. Two local state inference
   errors and four missing local Result control-flow operations were corrected.
   Build 2: exit 0, zero warnings/errors. That first source snapshot also retains
   the pre-clarification blanket rendering-underflow draft; no wire test executed
   that discarded behavior.
2. Focused test compilation 1: exit 1, nine test-only inference/record errors.
   Test compilation/run 2: exit 0, all 29 tests passed, none skipped.
3. First Replay-linked test compilation: exit 1 for an invalid private module
   abbreviation. Corrected compilation/run 4: exit 0, all 34 tests passed,
   none skipped; no numerical-source correction was made for test expectations.
4. First no-argument FSI startup: exit 1 before main because Console lacked its
   outer System qualification. Corrected startup 2: exit 2 with the expected
   complete command-level argument refusal, no input/assembly observations,
   no receipt and null counters; stderr empty. This is an executable-loading
   regression, not a numeric subject or final-vector run.

The implementation source is pinned at
`bf2da44b94e770d21add73ce53dacb8fb34259bf`. The
[complete preparation inventory](precision-gate-projection/2026-09-08/native-preparation-2/manifest.json)
retains exact raw command/results, original source snapshots and 14 source pins.
The [first preservation prefix](precision-gate-projection/2026-09-08/native-preparation-1/manifest.json)
remains explicitly incomplete: after storing its raw records, the author's
preservation script attempted nonexistent Directory.Build.targets while collecting
source pins. The second script removed that incorrect conventional filename;
it did not rerun any native calculation or replace prior command outcomes.

The [full local gate and formatter custody](precision-gate-projection/2026-09-08/native-gate-1/manifest.json)
retain all eight raw records and exact six unchanged source/test/wiring identities.
Full preflight at bf2da44 completed exit 0 with all 18 checks passed, including
Release build and the full test suite (06:17:49.526725 to 06:29:16.477780 UTC).
Later commits during that gate only preserved evidence and report prose. The
formatter exited 0 but explicitly reported F# projects unsupported; that is not
F# formatting coverage. At that historical capture, independent complete source review and the
registered final comparison remained pending. These local checks do not substitute for the
independent reference or that final comparison.

## Deferred string decoding follow-up

After bounded source acceptance `a285b1144255ad4e5a74991f04048c7b69afda97`,
the reviewer identified a deferred-unescape edge: System.Text.Json can retain an
escaped unpaired surrogate through Parse/Clone and reject it later at GetString.
One separately retained nonnumeric fixture against bf2da reproduced
`Unexpected/input`, `CannotReadIncompleteUTF16`, with zero Starts and PhiEntries.
The complete observed receipt appears in the failing TRX; it was not replaced.

The correction maps the actual InvalidOperationException at stringField to Wire
with its original field/message. The numeric loop and objective call are unchanged.
High/low/mismatched surrogates in root and parameter strings, a valid surrogate
pair reaching decimal grammar, and an admitted escaped digit discriminate the
boundary. All 41 focused tests pass after this change. The earlier all-18 gate
continues to describe bf2da; correction source review and the next complete gate
remain separate prerequisites. No registered final subject was run.

The [surrogate correction archive](precision-gate-projection/2026-09-08/native-surrogate-1/manifest.json)
binds correction `e3b87af8f33f09476e939ebbc4f78360c3aa7d1d`, both actual
TRX outcomes and the separate first documentation-lint refusal. Replay, project
wiring and the original kernel match their previous bytes.

The separately reviewed [process custody source](2026-09-08-precision-gate-projection-process-source.md)
defines the coordinator launcher and direct-file scope. It does not execute the
registered comparison during its transport-only fixture validation.

The [final native/process gate](precision-gate-projection/2026-09-08/final-native-process-gate-2/manifest.json)
now records all 18 checks passing at `8254c827044100df1646369f1b0143ec994d5a07`,
including the e3b87 native wire correction and final process source. Native wire
acceptance is `abbeb0663555635b1fdbfdbd5193d1bf6e70e3b6`; process source/custody
acceptance is `2ac23bf2efdc33a57fffc068fb74c2567155356d`. The registered
comparison remains unopened by this lane. The linked inventory retains a
separate first preservation failure without replacing any validation outcome.

The [bounded next-step design review](2026-09-08-mixed-message-epoch-independent-review.md)
assesses the proposed mixed-message and learned-module epochs. It adds no
implementation or numerical result to the scalar evidence retained here.
