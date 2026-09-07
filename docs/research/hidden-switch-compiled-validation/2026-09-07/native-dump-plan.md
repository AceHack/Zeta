# Separate graph dump and offline extent feasibility plan

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Status: prelaunch plan; no dump or analyzer execution yet

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
5. Only then resolve selected recorded callable stubs and their pointer cells
   using bounded code-related dump reads, never stack/heap/environment scans.
   Unsupported command or stub forms refuse. Query `ip2md <body-IP>` then
   `clru -n -o <same-body-IP>` on a successfully bound body address.
6. Query `runtimes` again after a successful DAC-dependent query and compare
   the actual cached DAC path/identity with the pinned local file. Missing
   or mismatched evidence refuses extent admission. Explicit `exit` and a
   bounded join end the analyzer; owned kill/join is fallback cleanup.

Exact raw code bytes, method token/MVID, resolved address, compiler bytes
and DAC-reported hot/cold extents must agree before any candidate gains a
stronger extent claim. Tool compatibility, memory availability and method
query errors remain typed refusals. A successful extent query alone does
not establish all indirect call targets, actual guard-register association,
floating-point environment stability or complete executing closure. All
full admission flags remain false for this feasibility attempt.
