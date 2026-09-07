# Separate graph dump and offline extent feasibility plan

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Status: three offline refusals retained; extent-command route stopped

The coordinator authorized one separately owned nonregistered graph process
and one bounded offline analyzer feasibility attempt after the fixed hand
slices. This does not authorize registered source or cost runs. Apple-host
SOS failures remain retained and will not be retried or incorporated into
the working LLDB collector. No signing, runtime policy or security setting
changes are proposed.

## Collection

The reviewed candidate will be
`src/Research.FSharp.Cli/capture_hidden_switch_dump.py`. Its four arguments
are the exact installed mise dotnet host, built file-backed CLI DLL,
installed `/Users/acehack/.dotnet/tools/dotnet-dump`, and a nonexistent owned
attempt directory under this writer's `.git`. Source and binary identities
are recorded before starting one `graph-hand` child. The normal no-tier,
no-PGO, no-R2R settings and qualified JIT byte filters remain unchanged.

The target must publish its own complete ready record within 30 seconds,
naming the launched PID. It remains running inside the existing graph-only
completion wait, allowing runtime IPC. The one collection command is:

```text
dotnet-dump collect --process-id <owned-pid> --type Full --output <owned-attempt>/graph.core
```

Collection is bounded to 60 seconds. Twelve GiB available disk is required
before launch; an observed size above eight GiB refuses. This is a polled
size limit, not a hard filesystem quota: overshoot and partial dumps remain
local and are never silently deleted. Native completion is released only
after a nonempty bounded dump and collector exit zero. The target gets five
seconds to finish and must retain its pin-release record. Cleanup signals
only still-running owned process groups and joins their direct children;
this does not claim general descendant containment after a launcher exits.
Cleanup failures remain separate and invalidate collection completion.

The dump's SHA256 and byte count are computed after owned processes have
stopped. The raw dump as a whole remains local-only and is never ingested, rendered
or added to Git. If cleanup cannot establish quiescence, hash admission is
withheld. Retained source/runtime/ready metadata and later exact selected
code reads bind the observations; this is not an identical LLDB stop or
an atomic image snapshot. The IPC interval is recorded explicitly.

The tool apphost, installed managed tool/dependencies/configuration and native
package libraries are pinned separately from target runtime files. A collector
host-resolution trace records its actual selected runtime; the apphost alone
does not establish the invoked managed tool or imply host runtime 10.0.11.
The dump hash is a post-direct-child snapshot, not general descendant
quiescence. A dump identity/stat error invalidates completion and is retained
separately, while terminal outcome publication is still attempted.

## Offline analysis

A separately owned, bounded installed `dotnet-dump analyze` process opens
that one dump, with piped stdin/stdout and no blind command batch. Its
private environment omits HOME and DOTNET_DIAGNOSTIC_EXTENSIONS. Neither
the parent environment nor user history/settings is changed. The installed
v9 helper/Analyzer IL review establishes why absent HOME leaves the history
path unset; actual startup can still refuse and must be retained.

The analyzer gets at most 120 seconds and each gated command at most 15
seconds. Output is retained to disk with command delimiters; EOF, error
delimiters or unrecognized output stop the attempt. The command sequence is:

1. Consume successful startup delimiter, without a memory/method query.
2. `setsymbolserver -disable`; require `Current symbol store settings:`
   and no store rows, then `setsymbolserver` to verify the empty store again.
3. `setclrpath` with the exact pinned mise runtime 10.0.11 directory;
   require its acknowledgement, then query `setclrpath` to verify it.
4. `runtimes` retains runtime/debug-library metadata. Compare the target
   runtime with collection pins; analyzer success alone does not prove
   matching DAC bytes, particularly because installed source guides indicate
   `ignoreMismatch:true` at runtime construction.
5. Query `ip2md <body-IP>` for all three body addresses physically bound
   before analyzer startup. Unsupported method forms refuse. No
   stack/heap/environment query is part of this procedure.
6. Query `runtimes` again after those successful DAC-dependent queries and
   compare the cached DAC path/identity with the pinned local file.
7. Query the installed native export `u -n -o <same-body-IP>`. Shared LLDB
   documentation's `clru` name was actually refused by this host. Static
   installed IL exposes an unimplemented instruction-disassembly callback;
   version-specific native source prints DAC header bounds before entering
   that callback. The metadata prefix may survive an error/non-progress
   refusal but cannot override it. Explicit `exit` and bounded owned
   kill/join end the attempt. No successful disassembly is assumed.

Exact raw code bytes, method token/MVID, resolved address, compiler bytes
and DAC-reported hot/cold extents must agree before any candidate gains a
stronger extent claim. Tool compatibility, memory availability and method
query errors remain typed refusals. A successful extent query alone does
not establish all indirect call targets, actual guard-register association,
floating-point environment stability or complete executing closure. All
full admission flags remain false for this feasibility attempt.

## Exact physical reader and analyzer admission

The source is `src/Research.FSharp.Cli/analyze_hidden_switch_dump.py` with
`hidden_switch_dump_memory.py`. Before launching the analyzer, the driver
holds one regular descriptor for hashing and all physical reads. It rejects
an initial size different from the captured count or above eight GiB, reads
exactly the captured count plus at most one extra byte, and checks a separate
120-second hash deadline between bounded reads. This is not kernel I/O
cancellation. Initial/final descriptor and pathname metadata must agree.
The analyzer separately opens that same stable local pathname; concurrent
hostile namespace replacement or in-place writes are outside the admitted
immutable-file premise.

Only little-endian 64-bit ARM64 Mach-O core metadata is supported. Command
count/lengths and segment integer/file bounds are checked; thread payloads
are skipped. Unknown commands, section-bearing segments, nonzero segment
flags including `SG_HIGHVM`, gaps, overlap and zero-filled selected bytes
refuse. Exactly one fully stored segment must back each selected interval.
The finite method roster is `HiddenSwitchPolicy.predict`, `condition` and
`select`: eight-byte callable stubs, eight-byte pointer cells and unique
compiler-declared candidate bodies of at most 65,536 bytes. Each successful
stub/cell/body mapping is written before its next dependent read or parse.
Raw bytes stay internal to comparisons; retained records contain addresses,
file offsets, lengths and hashes. No analyzer image-file fallback establishes
physical dump provenance.

The actual resolved executable must equal the captured tool path/hash. Its
package and runtime pins are separately checked. Command responses require
exactly the expected prompt marker, space and command echo, followed by a
success delimiter and admitted
payload. Symbol-store payloads must prove an empty store; DAC set/query
acknowledgements and unique runtime/method fields use anchored grammar from
the version-specific source and installed IL review. The verification suffix
is retained without changing policy. DAC acceptance alone does not establish
binary equivalence, method extent or complete reachable closure.

Stdout capture itself is capped at four MiB with a 65,536-byte line bound and
128 queued lines; overflow retains the available prefix and refuses. Stderr
and host tracing have an eight-MiB polled limit during command/cleanup waits;
this is not a quota and overshoot remains retained. Commands have 15-second
limits within the 120-second analyzer lifetime, followed by explicit exit,
owned kill if needed and bounded joins. Failed joins do not justify closing
streams still owned by the reader. First failures survive later cleanup or
publication failures. All three admission flags remain false even if every
query completes; interpreting retained extent output is a separate review.

The first actual response corrected provisional `Name`/`CodeAddr` expectations
to installed `Method Name`/`Current CodeAddr` fields; version-history addresses
are separate. Attempt two then retained the actual unrecognized `clru` error.
Neither failure is relabeled passed. The third attempt's `u` export and known
unsupported callback are source-reviewed metadata feasibility only. Runtime,
body and closure admission remain false, including if a useful bounds prefix
is obtained before output/deadline refusal.

The third actual attempt also refused `u` before any bounds prefix. All three
current method identities and cached-DAC metadata were retained first, but
neither native export inspection nor shared documentation predicted the actual
host registration. This route is stopped after that bounded attempt; no
unimplemented disassembly callback or method extent was actually observed.
The [indexed outcomes](native-candidate-bodies.md) preserve all three refusals.
