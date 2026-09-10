# Guarded hidden-switch compilation: complete binary invocation replay

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: pure replay slice; native runtime and whole-phase admission pending

## Scope and source

Source `a561868de51b3ae444fbb7d4bb919088db038746` introduces
[one binary choice-buffer checker](../../src/Interp.Python/zeta_interp/hidden_switch_compiled_choice_replay.py)
and its tests under the unchanged
[registration](2026-09-07-hidden-switch-compiled-protocol.md).
The [manifest](hidden-switch-compiled-validation/2026-09-07/choice-buffer-replay/manifest.json)
pins the source, five direct source/test dependencies and lossless logs.
Each compressed artifact retains separate original/stored lengths and hashes.

The caller supplies one immutable ordered cycle of `ChoiceInput` records,
a positive integer pass count, an independently issued certificate, one of
the two measured strategies, and caller-admitted source-manifest/native-runtime
hashes. Every input preserves belief bits, effect and depth, including signed
zero and duplicate positions. Limits of 1,024 tuple positions and 65,536 total
calls cover every registered per-row warmup or measured choice buffer.
Unknown strategies, mutable buffers, malformed tuples, extra/truncated bytes,
invalid hashes and unissued certificates refuse.

The checker independently evaluates each distinct tuple and decodes every
retained 28-byte record. Equality includes action, path, both reserved bytes
and all six executed-work counters. It sums the actual decoded counters only
after each complete record matches. A mismatch retains the exact call index
and already-checked call/byte prefix. There is no selected-pass or summary-only
comparison. Local reference memoization includes source, certificate, runtime,
strategy and every numerical argument; it never changes a measured strategy.

Success is explicitly `one-cyclic-choice-buffer-only`. The caller must still
reconstruct and admit the actual tuple roster, pass count, complete fifty-row
schedule, timing, source/runtime identities and artifact hashes. Equal records
alone cannot distinguish two exchanged inputs that produce identical output;
that is why independent roster and source binding remain mandatory. This API
does not execute a native process, source generator or episode runner, and
does not admit unsupported-runtime conformance as a measurement arm.

## Validation and integration

The focused suite passed **54 tests in 3.81 seconds**, with strict mypy and
Ruff passes for both new files. Witnesses flip each of the 28 bytes in a late
repeated record, exercise reordering and duplicate substitution, preserve
signed-zero cache keys, refuse malformed domains and identities, and check
all 65,536 records of the largest admitted buffer. The latter is a synthetic
repeated explicit hand input, not a generated cost corpus or timed run.
Spies forbid source generation and episode execution during binary replay.

Initial test type checking found an intentionally wrong boolean-typed input
without its narrow annotation and a reused variable with incompatible inferred
types. Those test annotations/names were corrected before the passing run.
A pass-count witness initially encountered an empty-roster refusal first; it
was corrected to use a valid roster and require the intended `PassCount` code.

The subsequent integration suite passed **401 tests in 12.82 seconds** across
ten compiled-study modules. This includes the separate 51-case signed-zero
decoder, 53-case Python identity collector and 57-case old-control replay.
The fixtures remain explicitly generated Python hand evidence, not completed
native conformance or registered behavior/cost measurements.

An additional strict audit of all twenty source/test files reported 174 errors
in seven test files, mostly missing test annotations; it is retained as a failed
audit, not described as a passing strict gate. The project lane's configured
type check and strict checking of implementation modules are separate scopes.
Integration Ruff found five missing third-party/project import separators in
new test files. Those whitespace-only corrections preserve the original source
pins and their historical validation records. All twenty files passed format
checking, and the corrected import check passed.

The configured Interp lane check passed all **59 source/test files**. A separate
strict implementation-only audit initially found seven errors in the identity
collector: six redundant casts and an untyped local stat-field projection.
Source `cbbabc092` removes those casts and annotates the unchanged projection;
all ten compiled-study implementation modules then passed strict mypy and all
53 identity tests passed in 0.95 seconds. Formatting initially requested two
blank lines around the new local function; the corrected twenty-file format
check passed. These scope distinctions preserve the failed stricter test audit.

Independent read-only review accepted exact binary replay source `a561868de`
without a material finding. It reconciled every record byte, actual work sums,
complete local cache key, finite limits and first-mismatch prefix. The reviewer
executed no tests, native processes or study streams.
