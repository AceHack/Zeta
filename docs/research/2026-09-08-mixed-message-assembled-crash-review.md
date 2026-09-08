# Mixed-message assembled gate: bounded test-process crash review

Date: 2026-09-08

Operational status: research-grade diagnostic record

Author: Vera, OpenAI Codex using GPT-6 Astra, independent core verification lane

Work item: 081M1Z63YMC087G0R003N5FH9X

The assembled full preflight at `1a71b4ff0eebd80e7528bfa93d8971d8726b4470`
failed. Seventeen other checks, including the build, passed. The test output
contains seven passing project summaries, including Bayesian's 639 passes and
Tests.FSharp's 4,695 passes plus two skips, followed by xUnit's fatal
`Test process crashed with exit code 139`. The enclosing command exited one.
These summaries describe completed results before failure; they do not establish
completion of the full suite. No assertion removal or source repair is justified
by that output alone.

The [selected observation](mixed-message-epoch-implementation/2026-09-08/assembled-crash-review-1/observation.json)
binds exact original stdout, stderr, completion and source identities. Its
[inventory](mixed-message-epoch-implementation/2026-09-08/assembled-crash-review-1/inventory.json)
indexes the copied gate records, five source/configuration files from the exact
Git cut, current runtime configuration, image-UUID command returns, and extraction
source. The raw OS report remains local; its byte count and SHA-256 are retained.
Incident identifiers, other thread/register contents and unrelated process or
machine information are excluded from the selected extraction.

## Observed process and fault location

A contemporaneous macOS report identifies `Tests.FSharp`, PID 94259, launched at
14:42:21.3427 UTC and crashing at 14:42:33.1445 UTC. Its parent was `dotnet`, PID
94232. The gate ran from 14:39:23.271994 to 14:43:33.152186 UTC. The OS reports
`EXC_BAD_ACCESS`, `SIGSEGV`, and invalid address `0x00000c010dc889b8`.

Faulting thread 75 is named `.NET BGC`. Its first five frames are:

1. `SVR::gc_heap::revisit_written_page`
2. `SVR::gc_heap::revisit_written_pages`
3. `SVR::gc_heap::background_mark_phase`
4. `SVR::gc_heap::gc1`
5. `SVR::gc_heap::bgc_thread_function`

This is an observed background server-GC fault location. Microsoft documents
background GC as work on dedicated threads and identifies `System.GC.Concurrent`
as its modern .NET setting. The observed runtime configuration enables both
server and concurrent GC. That terminology does not establish a cause.
[Primary .NET documentation](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/background-gc).

The OS executable path is privacy-redacted. Project name, launch/crash interval,
approximately 12-second process lifetime and apphost image UUID support the
association with the gate's Tests.FSharp result. The original preflight supplied
no test sequence, TRX or process tree to identify a final or in-flight test.
The apphost UUID alone does not distinguish writer checkouts. Nothing here
identifies one test as causal or proves the whole project finished before a
shutdown-only failure.

## Runtime association and prior evidence

The faulting image UUID is `6cb64ff2-42ff-30ea-bc45-4640fa3b0d03`. A successful
read-only `dwarfdump --uuid` invocation matches the current installed .NET 10.0.11
`libcoreclr.dylib`. Its current file is 6,217,584 bytes with SHA-256
`10B24D0B11C7F6D838114744097BF10DF9B08B906AFC9016567631A1C009DFD0`.
The size, modification time and inode were stable across that read. This is a
current file identity plus Mach-O image association, not a digest of original
mapped pages or proof relating machine execution to library source.

The [September 7 crash extraction](hidden-switch-validation/2026-09-07/root-main-crash-review.json)
contains exactly the same first seven image names, UUIDs, offsets, symbols and
symbol offsets. The current runtime configuration hash also matches that record.
Its [review](hidden-switch-validation/2026-09-07/root-main-crash-review.md)
explicitly left cause unresolved, despite a later successful unchanged recovery.
This is a repeated fault signature, not a known deterministic explanation.
Runtime defects, earlier memory corruption, interop and host causes remain
undistinguished. An older broad machine-failure hypothesis is not a diagnosis
of this event.

## Minimal next verification and limits

Preserve this failed gate and perform one root-owned full-solution diagnostic
recovery with the same .NET sources, binaries, runtime and settings, a fresh TRX
prefix and diagnostic output path. Record source, relevant binaries/configuration
and command identities before and after. No GC mode, package version, test filter
or assertion should change to obtain a passing result. Root reported starting
that exact bounded recovery with `--no-build`, TRX and VSTest diagnostics while
this note was prepared; its outcome is outside this review.

If it completes, report that recovery separately and leave the first failure and
unresolved cause intact. If it crashes again, stop ordinary retries and use the
new process/test sequence evidence to choose a controlled isolation diagnostic.
There is currently no supported source repair. This lane performed no test,
build, named M4/M5 route, learner, solver, debugger or runtime change and wrote
only its own diagnostic note and companion evidence. Root owns execution and
final integration-gate disposition.
