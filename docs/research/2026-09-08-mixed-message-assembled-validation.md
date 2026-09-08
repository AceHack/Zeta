# Mixed-message assembly: original failures and diagnostic recovery

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra, coordinator
Operational status: research-grade implementation validation
Lifecycle: active
Work item: 081M1Z63YMC087G0R003N5FH9X
Status: diagnostic recovery passed; final Python test correction pending

## Source and actual first gate

The assembled core is owner `d7e8e3806`, imported as `1a71b4ff0`, with completed
peer `d16bafa2a`, bridge `567a9f004` and fixed invoker `50610f191`.
The [core model review](2026-09-08-mixed-message-core-model-independent-review.md)
at `419c7a81d` and [invoker review](2026-09-08-mixed-message-invocation-independent-review.md)
at `2c8adb74c` are imported after fresh remote verification. Their acceptance
is bounded source evidence; no named actual route has run.

The first `bun run preflight` exited 1 after 249.879 seconds. Seventeen checks,
including the Release build, passed; the full solution test command failed
with an xUnit catastrophic process exit 139. Printed project/pass summaries
are completed prefixes, not authority to override that failed process outcome.
The separate formatter exited 0 in 16.092 seconds, with its recorded F# support
limitation. Strict three-file Python mypy exited 0 in 26.799 seconds.

The dedicated bridge pytest invocation used ordinary default temporary-file
placement. It passed 110 tests and failed one in 4.76 reported test seconds:
`test_source_identity_refusal_keeps_actual_read_and_hash` attempted to express
a temporary file outside the repository as a repository-relative path. That
exception occurred before the intended source-read/hash discriminator. The
original source/output and actual argv are retained; choosing a special temp
root would hide this portability defect. The test owner is correcting the
fixture against its actual repository source without changing production code.

## Crash evidence and one unchanged diagnostic rerun

The [separate crash review](2026-09-08-mixed-message-assembled-crash-review.md)
at `274016c6c` binds the contemporaneous macOS report to Tests.FSharp and a
.NET background server-GC fault. Its runtime image and first fault frames
match the earlier retained September-7 signature. This locates the fault;
it does not establish its cause, blame an individual test, prove determinism,
or justify changing GC settings, packages or source.

A point process inspection found no matching root-path dotnet/test/fsi command
before the one diagnostic recovery. That is not complete descendant isolation.
The recovery used `dotnet test Zeta.sln -c Release --no-build`, fresh TRX and
VSTest diagnostic paths, and unchanged selected source, assemblies and runtime
options. It exited 0 in 463.376 seconds. All seven project results completed:
7,835 passed, zero failed and six existing skips. All 12 selected source,
DLL and runtime-configuration length/hash pairs match before and after.

The seven original TRX files and their actual counters are retained unchanged.
The F# TRX aggregate reports notExecuted=0 while its six individual skipped
rows have outcome NotExecuted and total minus executed is six. The separate
qualification retains both observations instead of rewriting the aggregate.
The console also reports six skips. This successful diagnostic run does not
turn the original crashed invocation into a pass or explain its cause.

## Custody and remaining boundary

The [validation capsule](mixed-message-epoch-implementation/2026-09-08/assembled-validation-1/manifest.json)
retains 86 originals, 66,539,151 original bytes, through 69 distinct byte
objects in a 6,147,915-byte archive, SHA256
`7685B51BECB144499A1621DD048A234CA7F64C17E6DCC1C23D9CF1B8C4C945C2`.
Each original is recoverable byte-for-byte; sharing identical stored objects
loses no repeated original. Every row and archive member was reopened against
its recorded identity. The archive includes failed/passing stdout/stderr,
commands/times/exits, selected-source snapshots, all seven TRX originals,
diagnostic logs, and independent source-review import observations.

This is an assembled development gate and its diagnostic recovery. It includes
existing numerical unit tests, but no named M4, M5, frozen nested query or new
chronological comparison. Final Python fixture source/checks, selected-source
and direct-runtime freeze, independent assembled admission and the registered
actual controls remain separate. The original full-preflight command remains
failed; the later diagnostic test command supplies the passing test result.
