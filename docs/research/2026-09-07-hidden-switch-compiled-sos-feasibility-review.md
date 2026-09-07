# Guarded controller: bounded SOS debugger-host feasibility

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: both bounded no-target probes failed; target/runtime admission unchanged

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

## Authorized explicit-host variant

After committing the first failure as `29df46b0a`, the reviewer performed
the coordinator-authorized single no-target variant. Its
[separate six-record manifest](hidden-switch-compiled-validation/2026-09-07/sos-no-target-attempt-2/manifest.json)
preserves the full invocation/settings/output/completion and lossless second
crash report. No original record was replaced. All 13 previously recorded local
file identities remained unchanged when checked after the variant.

The only host-selection change was the documented command before SOS help:

```text
sethostruntime -major 10 /Users/acehack/.local/share/mise/dotnet-root/shared/Microsoft.NETCore.App/10.0.11
```

The command printed version 10.0 and that exact path. LLDB process 99246
then exited by signal 9 at 2026-09-07 18:44:26 UTC after
0.25634462499874644 seconds, again without reaching its 20-second timeout.
The second crash record confirms the loaded CoreCLR UUID now matches
10.0.11 and names the same `EXC_GUARD` / `SET_EXCEPTION_BEHAVIOR` location
during host initialization. Explicitly choosing this installed newer host
therefore did not resolve the observed failure. No broader runtime-cause or
platform-stability conclusion follows from these two probes.

Both probes reached the verified offline LLDB settings, but neither reached
SOS symbol-store verification or a method query. The variant's additional
debugger-image collector command was also unreached; its absence is not
silently replaced by fabricated output. The actual loaded-host association
comes from the second crash's image UUID, matched to the local file metadata.
No target was created. No further retry, tool installation, signature change
or protection bypass was performed. The optional SOS route remains unavailable
under this tested debugger-host setup and must stay outside the working
candidate collector unless a separately reviewed change establishes feasibility.

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

## Read-only alternative-host inspection

After both failures, the reviewer inspected installed alternatives without
launching another debugger or diagnostic host. Homebrew LLVM versions 23.1.0,
22.1.8 and 21.1.8 are installed, but their enumerated trees contain no matching
LLDB executable/library. The searched Rust toolchain trees and editor extension
directories also provided no alternate LLDB. The installed `rust-lldb` script
prefers a Rust-bundled debugger when present and otherwise invokes PATH LLDB;
the wrapper alone is not an independent debugger installation. This is the
scope of the search, not a claim that every host filesystem location was checked.

The existing `dotnet-dump` 9.0.661903 DLL is locally available under its
`tools/net8.0/any` package directory. Its runtime configuration targets .NET
8.0.0 with major roll-forward. No adjacent `extensions` directory is present.
Official documentation describes dump analysis without a native debugger and
lists `ip2md`, managed `clru` disassembly and explicit DAC-path selection.
It does not promise that this particular installed version can inspect the
study's runtime 10.0.11. [Official dotnet-dump documentation](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/dotnet-dump)

A no-target `analyze --help` invocation would test frontend startup only. It
would not establish SOS/DAC initialization, code-version lookup or method
extent agreement, so it was not executed or offered as that discriminator.
The useful candidate is a separately coordinated, bounded offline analysis of
an owned graph-process dump retaining candidate addresses, code bytes and
matching runtime metadata. No such graph dump is currently retained. A future
procedure must establish capture ownership and memory completeness, pin the
analysis executable/SOS/DAC, clear and inspect symbol-store configuration,
then compare actual-IP metadata and hot/cold extents with the independent
captured bytes. Missing memory or incompatible metadata must refuse.

Before any such analysis, remove ambient `DOTNET_DIAGNOSTIC_EXTENSIONS` and
inspect the actual tool's extension directory. Upstream documents these as
automatic extension-loading surfaces. Their absence would be a bounded
configuration observation, not a hostile-process guarantee.
[Official extension-loading design](https://github.com/dotnet/diagnostics/blob/main/documentation/design-docs/dotnet-dump-extensibility.md)
No new dump, target, help probe, tool installation or platform-protection change
was performed in this follow-up inspection. The working candidate collector
and its unresolved graph obligations remain unchanged.

The coordinator subsequently authorized the native owner to prepare one owned,
nonregistered graph-process dump and a bounded offline procedure, subject to
prelaunch review. The dump remains local-only; its raw hash/size and the
source/runtime/DAC/address correspondence may be retained without publishing
or ingesting the dump's memory. This authorization does not change either
failed Apple-host record or admit an executing graph.

Pinned official `Analyzer.cs` opens the dump, then installs a default symbol
server/cache/dump-directory search before running command-line commands.
Consequently the offline procedure must first disable the store and inspect
the observed empty configuration. It must stop if that fails, before issuing
DAC or method queries; a blind multi-command batch cannot substitute for this
check. Command success and content matter independently of process exit zero.
This source is guidance for the installed package, not binary derivation proof.
[Pinned analysis-host source](https://github.com/dotnet/diagnostics/blob/65349e35e532e2d9c300b0b6a1738bbcd8f360f1/src/Tools/dotnet-dump/Analyzer.cs)

That host also attempts history-file reads/writes. The matching upstream helper
uses `Environment.SpecialFolder.UserProfile`, not a demonstrated CLI-home
override, and contains an apparent inverted empty-path guard. The reviewer
therefore retracted an initial suggestion to rely on a CLI-home setting: no
such isolation switch or installed history behavior has been established.
The procedure must preserve user history and avoid repointing HOME; this
source discrepancy is not a reason to modify the installed tool.
[Pinned directory helper](https://github.com/dotnet/diagnostics/blob/65349e35e532e2d9c300b0b6a1738bbcd8f360f1/src/Microsoft.Diagnostics.DebugServices.Implementation/Utilities.cs)

## Installed analyzer history and offline command boundary

The package metadata identifies repository commit
`d7b455b46332b31fd9ba3a3f3e020387984c511a`. That version differs from the
newer source consulted above. The reviewer inspected installed IL to resolve
the difference; the earlier current-source observation is retained as history,
not asserted as installed behavior. The
[static-inspection manifest](hidden-switch-compiled-validation/2026-09-07/dump-analyzer-static-inspection/manifest.json)
initially indexed 12 losslessly compressed records, including exact invocations, complete
or partial outputs and empty error streams. Its 13 local file identities are
a post-inspection snapshot, not a complete loaded-reader dependency inventory.

The already installed `monodis` reader exited by signal 11 while reading
`dotnet-dump.dll` and `Microsoft.Diagnostics.DebugServices.Implementation.dll`.
Both partial outputs and zero-length error streams are retained; neither is
called a complete disassembly. Reading `Microsoft.Diagnostics.Repl.dll`
completed with exit zero. The separately installed `dotnet-ildasm` 0.12.2 then
read only the selected helper and analyzer methods successfully, using the
explicit installed .NET 10.0.11 host. These were static file-reader executions;
the subject analyzer, SOS and a diagnostic target were not executed. The record
contains no retrospective timing log and makes no cause claim for the crashes.

Installed `Utilities.GetDotNetHomeDirectory` reads `HOME` on this platform.
If absent, it throws before returning a history directory. Installed
`Analyzer.Analyze` initializes its history filename to null, catches that
specific early exception, and only reads/writes history after a filename has
been assigned. Redirected input alone does not prevent these accesses. Thus
the approved procedure omits `HOME` only from the private analysis child's
environment dictionary. It does not reassign `HOME`, change the parent's
environment, inspect user history or modify user settings. Startup might still
refuse elsewhere; that outcome must be retained without widening the procedure.
[Version-specific helper](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/Microsoft.Diagnostics.DebugServices.Implementation/Utilities.cs),
[version-specific analyzer](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/Tools/dotnet-dump/Analyzer.cs)

The installed REPL's redirected-input path emits an initial
`<END_COMMAND_OUTPUT>` marker, followed by success or error markers after
nonempty commands. Empty input or EOF is not an exit request. A bounded owner
must send `exit` or terminate/join its own process on timeout. Markers are
transport evidence: SOS may print a semantic failure without a host-command
exception, so output contents must also be checked. These facts support a
gated command loop, not a blind batch whose only check is process exit zero.
[Version-specific console source](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/Microsoft.Diagnostics.Repl/ConsoleService.cs)

Before DAC or method queries, the proposed loop must complete
`setsymbolserver -disable`, then inspect `setsymbolserver`. The expected
configuration is the symbol-settings header with no store entries; the
version-specific implementation clears the store and prints each remaining
entry with an arrow. Any unexpected entry or failed command stops analysis.
This disables the analyzer's default store after startup, not network access
at the operating-system boundary. No unverified claim of an absent startup
network request is inferred from source ordering.
[Symbol command](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/Microsoft.Diagnostics.ExtensionCommands/Host/SetSymbolServerCommand.cs),
[symbol store implementation](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/Microsoft.Diagnostics.DebugServices.Implementation/SymbolService.cs)

Next set and inspect `setclrpath` using the exact installed runtime 10.0.11
directory. This selects the local DAC/DBI directory; it does not prove that a
particular file has loaded. Retain `runtimes` output and actual module/library
identities without changing signature verification or runtime-selection
policy. Then query only body addresses established from this dump's own
stub/cell/code reads with `ip2md <IP>` and `clru -n -o <IP>`. The installed
platform help documents these command names and flags. Require the observed
method identity and hot/cold extents to agree with captured code; preserve
missing-memory, unknown-method or compatibility failures as unresolved.
[DAC path command](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/Microsoft.Diagnostics.ExtensionCommands/Host/SetClrPathCommand.cs),
[runtime metadata command](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/Microsoft.Diagnostics.ExtensionCommands/Host/RuntimesCommand.cs)

The authorized dump belongs to one nonregistered graph process and remains
local-only. Its hash, size, capture identity and code-related observations may
be retained; its memory is not ingested or published. Direct runtime-IPC
collection while the graph process waits is a different snapshot from an LLDB
stop. No analyzer or dump capture has run in the reviewer's lane. The native
owner's complete ownership, timeout, collection and command plan still required
prelaunch review at that point; the subsequent bounded disposition follows.

## Capture-only source acceptance and raw-read qualification

The collection script and plan at
`1bbc2ea8b9df319eb238c3efd615a07328274ebc` are accepted for the coordinator's
one authorized direct graph-process dump. The reviewed script SHA256 is
`398d2750c087f3a88710375e1220bab2d70f0aaf63dbcc2a0690431dd9014f0f`.
It owns an exclusive attempt directory and direct target/collector sessions,
bounds readiness/collection/target exit to 30/60/5 seconds, and retains
failures without retrying or deleting partial dumps. The eight-GiB cap is
polled, with a twelve-GiB free-space precondition; neither is a hard quota.
Cleanup bounds direct-child management, not arbitrary descendant containment.

Review required three repairs before launch: dump identity/stat errors must
still permit terminal outcome publication; the single completion record must
name the owned PID and affirm completion and guard-pin release; and collector
package/configuration/native-library identities must accompany its apphost
hash. The accepted source implements these and retains a collector-only host
resolution trace. Target runtime 10.0.11 is not silently assigned to the
collector. A failed dump's hash is at most a post-direct-child snapshot.
No reviewer dump, analyzer or target ran; offline analysis remains separate.

One further static class inspection of the installed command assembly
completed with exit zero and empty stderr. Its three additional retained
records bring the manifest to 15. Installed command attributes and IL confirm
the `readmemory` alias, explicit count/element-size/row-width options and
display flags. Address and formatting state can persist between commands.
For selected bytes, set all fields explicitly with a positive bounded count,
element length one, and both string modes disabled. Never use a string scan,
implicit prior address or default count. Missing bytes print question marks
and need not cause command failure: require the exact requested contiguous
addresses and byte count independently of the transport marker.
[Version-specific memory command](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/Microsoft.Diagnostics.ExtensionCommands/Host/ReadMemoryCommand.cs)

Version-specific target construction wraps dump reads in native and managed
image-mapping services on macOS. A missing or partial read can therefore be
filled from a local module file even when network symbol lookup is disabled.
An analyzer-view byte string alone does not establish physical dump backing.
No source or runtime setting is changed to hide this distinction.
[Target construction](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/Microsoft.Diagnostics.DebugServices.Implementation/TargetFromDataReader.cs),
[image fallback](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/Microsoft.Diagnostics.DebugServices.Implementation/ImageMappingMemoryService.cs)

The planned physical check reads bounded format/segment metadata and only
the already selected code, stub, pointer-cell or guard ranges. Require exact
file backing, checked address/file arithmetic, complete reads and unambiguous
range coverage. Unknown format, overlap, missing bytes or zero-fill refuses.
For Mach-O, the local SDK defines `SG_HIGHVM` as placing file contents at the
high end of a segment; a simple low-address mapping must reject that flag.
Its header identity is recorded as format guidance, not dump/runtime identity.
Only selected offsets, lengths, hashes and comparison results may leave the
local helper; the raw dump and unrelated memory remain unexamined/unpublished.
The actual range parser and analyzer driver still require source review.
[Apple format definitions](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h)

Finally, version-specific runtime creation uses `ignoreMismatch:true` when
opening the DAC-backed CLR model. Set the exact local directory before the
first dependent query and inspect cached DAC paths afterward. Independent
target/runtime/DAC identities remain necessary; successful metadata commands
alone do not establish version matching or method/body correspondence.
[Version-specific runtime source](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/Microsoft.Diagnostics.DebugServices.Implementation/Runtime.cs)

## Physical reader and initial offline-driver review

The native owner's bounded `MachCore` reader was accepted by source and
synthetic-fixture inspection, before an analyzer launch. The reviewed source
SHA256 is `680b00b038265ef6bc50ee8a0463d8c540106d11b77f9588c06f39ffa62e0665`;
the five-fixture test source is
`6d67d0c4cbdd5befa5a889230f4474ed80caf4190db3c318222c80c496aae208`.
These were uncommitted source identities at review, not an invented commit pin.
The parser accepts only the observed little-endian 64-bit ARM64 core format,
checks exact bounded load-command traversal and segment arithmetic, skips
thread-state payloads, and refuses unsupported commands, sections or segment
flags. Each selected range must fit one unambiguous, wholly stored segment
and contain at most 65,536 bytes. Missing bytes, overlap, a gap, partial
backing and zero-fill refuse. The caller still owns the held file descriptor,
its identity and the selected-range roster. The reviewer did not open the
actual dump or rerun the tests.

The initial uncommitted offline driver, reviewed over native writer head
`c05a133965d43b004baa1d615e2aea443bc52eea`, required four corrections before
launch. First, the redirected analyzer echoes the exact command, and path or
method substrings are insufficient semantic acknowledgements. Second, hashing
one dump pathname open and reading another fails to bind the selected bytes
to the hashed object; successful stub/cell prefixes also need immediate
metadata publication before a later dependent read can fail. Third, the
actual executable argument must match its captured analyzer pin. Fourth,
command-side output limits did not bound the asynchronous reader's queue or
stdout file, and stderr needed an explicit polled bound. The owner accepted
all four findings for repair; this paragraph records initial findings, not
acceptance of an unseen successor.

Installed REPL IL confirms a `>` prompt followed by one ASCII space passed into the callback even for
redirected input. The version-specific analyzer writes prompt plus trimmed
command before executing it. Command parsing must remove exactly that
expected echo and independently check the terminal marker and payload.
The DAC-path command has distinct exact set and query acknowledgements;
runtime output has named module-path, configured-directory and cached-DAC
fields. Unique anchored fields avoid accepting a path repeated only inside
an error or unrelated row. These are source and installed-IL grammar
expectations; the reviewer has not observed an analyzer session. The runtime
formatter also includes library, resource, export and settings information,
so those rows must not be mistaken for a second runtime or silently used as
its identity.
[Analyzer callback](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/Tools/dotnet-dump/Analyzer.cs),
[REPL dispatch](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/Microsoft.Diagnostics.Repl/ConsoleService.cs),
[DAC-path acknowledgements](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/Microsoft.Diagnostics.ExtensionCommands/Host/SetClrPathCommand.cs),
[runtime formatting](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/Microsoft.Diagnostics.DebugServices.Implementation/Runtime.cs)

## Corrected offline-driver prelaunch acceptance

Final source-only acceptance binds the driver to SHA256
`aca9ef2a1c9261375c3c267ba135dbf5dd0e0c13819c11c4730b4a0caf504aa6`
and its eight-case test source to
`e7eb546f10df1e3202ae4f7c3d596ac44cf30acd8c9c367def99ab6e5a6dddbe`.
The physical reader's final SHA256 is
`f0d1d2f30d4a08cb3f7cdc8d402574f494a5920e40d0a05dfcbe2487af342537`;
its only change from the earlier accepted bytes is blank-line formatting.
The five-case parser test hash is unchanged. The author reports all 13
synthetic tests passing. The reviewer read the complete four-file surface
and these fixtures without executing them or opening the actual dump.

All four initial findings are resolved. Dump hashing and selected physical
reads use one held regular descriptor, checked against its pathname and
metadata before and after the analyzer's separate open. Each successful
stub, pointer-cell and body range publishes its own metadata immediately.
The actual resolved analyzer executable must match exactly one captured pin.
Exact command echo, terminal framing, symbol-store state, DAC-path
acknowledgements and unique anchored runtime/method fields replace substring
admission. The reader retains at most four MiB of stdout, bounds individual
lines and its queue, and reports the retained prefix on refusal. The eight-MiB
stderr/host-trace limit is polled and can overshoot; it is not a disk quota.

A final review finding also removed read-until-EOF hashing: initial file size
must equal the captured bounded length before any byte read, and hashing
consumes exactly that length plus at most one extra byte. The producing-stream
fixture demands the actual size/one-byte read sequence; a separate deadline
fixture refuses elapsed hashing. Its 120-second deadline is checked between
bounded regular-file reads, not a kernel cancellation guarantee. Analyzer
commands separately have 15-second bounds within a 120-second session bound;
these are not a claim that every preparation and cleanup operation shares
one 120-second end-to-end deadline. Explicit exit and owned kill/join remain
bounded, primary failures survive cleanup/publication failures, and a failed
reader join does not authorize closing a stream it still owns.

This permits the owner's one already authorized local-only analysis attempt
on the stable captured file. It does not establish an immutable snapshot
under hostile pathname changes or in-place writes. It does not establish
loaded-DAC binary identity, complete method extents, executing call closure
or runtime admission. The selected methods are only `predict`, `condition`
and `select`; successful command capture still leaves `BodyResolved`,
`ClosureAdmitted` and `RuntimeAdmitted` false pending interpretation. No raw
dump or unrelated memory is included in this review or its publication.

## First offline result and observed-field correction

The accepted four-file preparation was committed by its owner as
`e0e2eb082f2d7ed150f7a2ca4ad3a38d62876a7d`. The first actual analysis is
retained at `ad930de307a0dfa4424c01d46e439559ca0ca917`, with its
[37-record manifest](hidden-switch-compiled-validation/2026-09-07/native-dump-analysis-attempt-1/manifest.json).
The reviewer independently checked every stored and decompressed length/hash
and equality to its retained original, together with the three exact source
helper identities at the executed commit. This verification read source and
published diagnostic metadata, not the local-only raw dump.

Physical comparison metadata reports exact compiler equality for `predict`,
`condition` and `select`: respectively 252, 532 and 224 bytes, totaling 1,008.
The reviewer checked each retained compiler/body hash equality, without
independently rereading those ranges from the dump. Analyzer startup, both
empty symbol-store checks, the exact local DAC-path set/query, and runtime
metadata completed. The runtime record names the expected module path and
build identifier; its displayed version is `10.0.1126.37416`, distinct from
the installation-directory spelling `10.0.11`.

The driver then refused at `ip2md-predict` because the initial parser expected
`Name`. Actual retained SOS output uses `Method Name` and `Current CodeAddr`,
plus a separately labeled historical `CodeAddr` under version history.
The initial field grammar had not been validated against actual installed
SOS output; the first capture exposed that compatibility assumption. The
actual predict token is `06000495` and current body address `10B720A20`, both
matching the retained selected-method metadata. The analyzer exited zero
with empty cleanup failures; the driver exited two and retained its first
parser refusal. No `clru` or post-query cached-DAC command ran, and every
method/closure/runtime admission flag remained false.

The coordinator authorized one separately reviewed corrected attempt.
The two-file correction, committed as
`88c60b5f137cc1770d38ab886c54d8ec586261de` and checked against its immutable
source bytes, is accepted by source review at driver SHA256
`e03f666c423f01a2a36b2f4c9a7bca92186f51f96d110f154ff47e41247d4550`
and test SHA256
`ba281d04b92845c920bf814d0f1617c36d66588eaf6fc2a31d8013bf1c93aef3`.
It requires unique anchored actual method-name/current-address fields and
`IsJitted: yes`, while retaining exact token/address/name checks. The retained
actual command response is a positive parser fixture. Wrong current address
with matching history, missing/duplicate current fields and non-jitted output
refuse. The owner reports all 14 parser/driver tests passing; the reviewer
inspected these cases without executing them. Physical reads, capture bounds,
command sequencing, first-failure preservation and all false admission flags
are unchanged. This accepts a correction to the parser, not a replacement
for the first attempt or advance acceptance of later method extents.

## Second refusal and host-specific export boundary

Second-attempt source `88c60b5f137cc1770d38ab886c54d8ec586261de` and its
[39 diagnostic records](hidden-switch-compiled-validation/2026-09-07/native-dump-analysis-attempt-2/manifest.json)
are retained in owner commit `bd2393522c44908e377a390d301cadc9d4fc3942`.
The reviewer verified all stored and decompressed lengths/hashes and read
the actual command refusal. Current predict method identity now passes;
`clru` fails with an unrecognized-command error and the error delimiter.
Driver exit two, analyzer exit zero and empty cleanup remain distinct.
No extent or post-query cached-DAC response occurred. The original attempt
is unchanged, and no raw dump was opened for this review.

The shared Unix SOS help lists `u` and `clru`, but that text does not establish
the latter as an alias in this host. The initial plan carried that unsupported
host-compatibility assumption. Static installed export inspection now finds
`_u` and no `_clru`. Installed host-command IL shows the generic SOS fallback;
version-specific native-library dispatch resolves the exact export name.
Three new bounded file-only inspections completed with exit zero and empty
stderr. Their nine lossless records bring the static manifest to 24, with
added SOS hosting/native-library and inspection-tool identities. These
inspectors did not load the subject library, start an analyzer or run a target.
[Host command dispatch](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/Tools/dotnet-dump/Commands/SOSCommand.cs),
[native export dispatch](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/SOS/SOS.Hosting/SOSLibrary.cs)

The export alone is insufficient. Installed `SOSHost.Disassemble` IL returns
`E_NOTIMPL`, clears its output and leaves the end offset unchanged. The
version-specific non-debugger host connects this callback to its LLDB service
adapter. Its ARM64 unassembly loop ignores the disassembler status through
`DisasmAndClean`, so lack of progress and an output/time-bound refusal are
concrete possibilities. This is an implementation observation and source
inference, not a claim that the third attempt has occurred or must fail.
[Host callback](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/SOS/SOS.Hosting/SOSHost.cs),
[adapter binding](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/SOS/SOS.Hosting/LLDBServices.cs),
[ARM64 loop](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/SOS/Strike/disasmARM64.cpp),
[disassembler wrapper](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/SOS/Strike/disasm.cpp)

Version-specific `u` obtains `DacpCodeHeaderData` and prints its managed method
name and begin/size, including hot/cold extents when present, before the
instruction loop. A bounded response prefix could therefore contain useful
prospective extent metadata even if the command never completes. The revised
plan obtains all three fixed method identities and then cached-DAC runtime
metadata before the export-backed `u` requests. Explicit owned analyzer PID
and return code improve custody. No failed or undelimited response becomes
successful; any retained extent still needs independent interpretation, and
all method/closure/runtime admission flags remain false. The coordinator
separately authorized one third attempt; actual revised source and outcome
are separate review boundaries.
[Extent-before-disassembly ordering](https://github.com/dotnet/diagnostics/blob/d7b455b46332b31fd9ba3a3f3e020387984c511a/src/SOS/Strike/strike.cpp)
