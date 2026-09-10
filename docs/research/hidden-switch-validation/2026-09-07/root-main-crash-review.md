# Read-only review of the final integration test-host crash

Date: 2026-09-07

Operational status: research-grade validation record

Author: Vera, OpenAI Codex using GPT-6 Astra, independent native reviewer

Work item: 081M1XK02XM087G0R00043EW05

The full solution invocation at
`4d7b13947bef9b53a65c043885971ceefa168e87` failed. Its F# test process
exited 139 after reporting 1,204 completed passes; six other projects
reported 990 passes. The F# output's partial `Passed!` summary does not
override the catastrophic test-process error and command exit one.

## Observed crash location

The [bounded extraction](root-main-crash-review.json) binds the original
test log, sequence, matching macOS crash report, current runtime library
and [runtime configuration](root-main-crash-runtimeconfig.json) by their
exact available bytes. PID 54977 and launch/capture times match the F#
test process. macOS reports `EXC_BAD_ACCESS` / `SIGSEGV`, with thread 80
named `.NET BGC` faulting in `libcoreclr.dylib`:

1. `SVR::gc_heap::revisit_written_page`
2. `SVR::gc_heap::revisit_written_pages`
3. `SVR::gc_heap::background_mark_phase`
4. `SVR::gc_heap::gc1`
5. `SVR::gc_heap::bgc_thread_function`

This locates the observed fault in the .NET background server-GC path.
It does not establish whether the cause lies in the runtime, earlier
memory corruption, an interop interaction or another mechanism. The OS's
parenthetical "possible pointer authentication failure" is retained as
an OS description, not promoted to a diagnosis. This is not the earlier
JVM/TLC crash or an F# compiler exit-139 event merely because their
process status numbers resemble one another.

The runtime configuration explicitly enables server and concurrent GC.
Microsoft documents that background GC runs on dedicated threads and
that `System.GC.Concurrent` controls it in modern .NET. That supports
the terminology, not a cause attribution or proposed policy change.
[Primary .NET documentation](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/background-gc).

The sequence contains 1,228 started tests: 1,204 completed and 24 still
in flight across different test groups. Its concurrent ordering does
not identify one causal test, and the incomplete rows are not individual
assertion failures. No TLC case appears in that in-flight roster.

## Identity, custody and limits

The faulting image has Mach-O UUID
`6cb64ff2-42ff-30ea-bc45-4640fa3b0d03`. Direct parsing of the current
installed .NET 10.0.11 library's `LC_UUID` command yields the same value;
the record separately hashes the current on-disk library bytes. That is
an image-identity match, not a cryptographic hash of the process's
originally mapped pages or a source-to-binary theorem. The first
`dwarfdump --uuid` identity attempt failed because the installed utility
does not support that option; the explicit Mach-O header/load-command
read supplied the identity instead. No debugger was attached or dump
interpreter run.

The original Mach-O core is 10,468,103,592 bytes. It remains an ignored,
local diagnostic artifact under the root writer's TestResults directory.
One read-only streaming pass after recovery completed produced SHA-256
`ABD497B983909C83455B64C1FDF8BBD998AEEC4DC6D90FB7F5FD519C1858FA6B`.
The file's size, modification time and inode were unchanged across that
read. No copy, deletion or dump interpretation was performed.
The JSON records its local custody and available identity; neither the
raw process memory nor full crash report is claimed as git-canonical
evidence. The bounded extraction omits other threads, registers, private
environment and incident metadata, while retaining the original IPS
byte count and SHA-256 so that an authorized local reader can check it.

Before the recovery invocation, a process-metadata inspection found none
of the eight known test PIDs or matching root-path native/JVM processes
still present. This is a point observation, not a complete descendant
isolation proof. The reviewer did not kill or restart a process, change
the root checkout, execute a build/test, or modify runtime configuration.

## Bounded recovery recommendation

The reviewer recommended exactly one unchanged full-solution `--no-build`
rerun with a fresh result prefix and the same source, assemblies, runtime
and options. Root started that invocation at 14:09:31.170 UTC, changing
only the TRX prefix to `hidden-switch-main-2` and retaining all original
failed evidence. Root subsequently reported exit zero with 7,568 passes
and six existing skips, all original source/output hashes unchanged.
The reviewer read the completed invocation log, which independently
records exit zero at 14:17:03.764288 UTC and the F# project
summary of 6,578 passes and six skips. Full recovery validation belongs
to the owner's separate gate records; this review did not rerun or
reparse the complete recovery suite.

If the crash recurs, stop ordinary retries and choose a controlled
isolation diagnostic. If it passes, report that specific recovery while
leaving the first attempt failed and its cause unresolved. No GC/JVM
policy change or assertion removal was proposed to obtain a passing gate.
