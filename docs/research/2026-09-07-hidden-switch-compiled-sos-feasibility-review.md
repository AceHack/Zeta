# Guarded controller: bounded SOS debugger-host feasibility

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: first no-target probe failed; target/runtime admission unchanged

This supplements the [candidate evidence review](2026-09-07-hidden-switch-compiled-candidate-evidence-review.md).
The reviewer inspected installed tools, official source guidance and a bounded
debugger-only probe. No study target, policy call, guard computation, build,
registered stream or measurement ran. No installation, signing or platform
protection change occurred. SOS remains an optional method-extent cross-check;
the frozen protocol requires sufficient executing-graph evidence, not this
particular diagnostic tool.

## Original no-target failure

The [six-record manifest](hidden-switch-compiled-validation/2026-09-07/sos-no-target-attempt-1/manifest.json)
indexes the exact prelaunch invocation, completion, complete stdout/stderr,
lossless crash report and separately observed local file identities. The crash
record is gzip-preserved with both stored and decompressed lengths/hashes;
decompression was verified byte-for-byte. The file identities are a post-probe
snapshot, not a claim that every listed file was loaded. The invocation and
completion were retained during execution; no retrospective execution log
was invented.

The 20-second-bounded probe exited by signal 9 after 0.6590507079963572 seconds;
the timeout did not fire. It confirmed these settings in a fresh LLDB with
initialization files disabled:

```text
symbols.enable-external-lookup = false
target.load-script-from-symbol-file = false
plugin.symbol-locator.debuginfod.server-urls = []
```

It then printed the exact plugin-load command and `soshelp u`, with no help
output. Later requested commands were not reached. Empty stderr is retained.
Thus the LLDB settings are observed; SOS symbol-store disabling and method
commands are not yet verified. A successful setting is not a network-isolation
theorem, and this probe does not claim that SOS completed initialization.

The matching macOS report names LLDB process 94856, launched at
2026-09-07 18:37:53.0889 UTC, with `EXC_GUARD`,
`GUARD_TYPE_MACH_PORT` and `SET_EXCEPTION_BEHAVIOR`. Its main-thread stack
contains `thread_swap_exception_ports`, `CPalThread::EnableMachExceptions`,
`PAL_InitializeCoreCLR` and SOS `InitializeNetCoreHost`.
The loaded host CoreCLR UUID `43B09202-812A-3BCB-B5FF-CB4829A9C699`
matches the installed mise runtime 8.0.0. It differs from the study runtime
10.0.11 UUID `6CB64FF2-42FF-30EA-BC45-4640FA3B0D03`.
This locates the observed failure in debugger-host initialization, before
any target method inspection. It does not establish a defect in the study
runtime or classify an unqueried target method as unavailable.

The upstream diagnostics project records a similar Apple-LLDB/CoreCLR
initialization stack under a Mach-port guard failure. That historical report
supports a competing host-compatibility explanation, not proof of an identical
cause on this newer OS. Apple's documentation explains the named exception
behavior restriction. [Upstream issue 4551](https://github.com/dotnet/diagnostics/issues/4551),
[Apple Mach IPC documentation](https://developer.apple.com/documentation/xcode/conforming-to-mach-ipc-security-restrictions)

## Available tool boundary and proposed controlled variant

Installed SOS comes from `dotnet-dump` 9.0.661903. LLDB reports
2100.0.17.203; its actual executable is the Xcode LLDB selected by `/usr/bin/lldb`.
The local SOS plugin links an LLDB framework compatibility version 1.0.0 and
current version 1700.0.9. These observations neither prove nor disprove ABI
compatibility. Matching runtime 10.0.11 DAC/DBI files are locally available;
their exact identities are retained in the manifest's local-file record.

The installed `sosdocsunix.txt` documents `sethostruntime -major` for selecting
the runtime hosting SOS's own managed code, separately from `setclrpath` for
the target DAC/DBI. The coordinator authorized one separate, still no-target
variant using the exact installed 10.0.11 host before the first SOS command.
That variant is not executed in this initial record. It must retain the old
failure, exact new invocation/settings/outputs/exit and observed loaded-host
identity, without an automatic retry if it fails.

The intended offline setup also requires `setsymbolserver -disable` followed
by an observed empty store, before target inspection. Do not combine disabling
with options that add a server or cache. The public Learn command table has
a contradictory sentence about `-disable`; the official command implementation
clears the store, then separately processes any added options. Use the actual
installed help/output to confirm compatibility. This source inspection is
guidance, not derivation proof for the installed SOS binary.
[Pinned command source](https://github.com/dotnet/diagnostics/blob/65349e35e532e2d9c300b0b6a1738bbcd8f360f1/src/Microsoft.Diagnostics.ExtensionCommands/Host/SetSymbolServerCommand.cs)

## Method inspection if the debugger-host boundary passes

Keep the metadata probe separate from the already working candidate collector
until host compatibility is demonstrated. At a bounded owned target stop,
record actual target/runtime modules and set the exact matching DAC path.
For each actual resolved candidate body IP, retain `ip2md <IP>` and
`sos u -n -o <IP>` outputs, command success and failure. Querying the actual
IP rather than only MethodDesc preserves the intended code-version association.
Callable stubs, native helpers and unrecognized dynamic targets need separate
classification; a failed `ip2md` is not permission to omit them.

The installed help describes whole-method annotated disassembly. Official SOS
source obtains code-header information through the runtime DAC and distinguishes
hot/cold regions. Require exact identity, start, size and any cold-region
agreement with independently read bytes; never silently truncate at the first
return or treat compiler-provided length alone as this second observation.
This is additional runtime metadata evidence, not a source-to-native theorem
or complete indirect-call proof. [Official SOS documentation](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/sos-debugging-extension),
[code-header implementation](https://github.com/dotnet/diagnostics/blob/65349e35e532e2d9c300b0b6a1738bbcd8f360f1/src/SOS/Strike/strike.cpp)

A separately justified closed reachable control-flow graph can address reachable
code coverage without claiming a metadata-defined method extent. Its premises
must cover supported opcodes, every branch/fallthrough/return and possible
indirect destination, including exception or secondary-entry paths relevant
to the admitted execution. A second decoder's control-flow label is supporting
evidence, not a completeness oracle. Unknown paths remain refusal conditions.
