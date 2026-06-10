# hooks/ — the hooks (our common ground), at root

`hooks/` holds the **hooks** — the points where we **hook into a running system** to read, instrument, and
steer it. The load-bearing one (Aaron 2026-06-10): the **.NET runtime hook** — *"that Cheat-Engine-like
hook"* — **our common ground we build Zeta outward from.**

## Yes — we CAN hook into .NET (the answer)

`dotnet` is deeply hookable; this is the Cheat-Engine-on-our-own-runtime, real and supported:

- **ClrMD** (`Microsoft.Diagnostics.Runtime`) — read a **live .NET process's heap/memory/threads/objects**
  programmatically. The closest to Cheat Engine's memory scan: *scan the managed heap, find values, inspect
  objects.*
- **CLR Profiler API** (`ICorProfilerCallback`) — the deep hook: **JIT, method enter/leave, allocation, GC,
  exceptions.** This is **"find what writes/runs this"** = **antecedent-tracing** (effect → cause), the
  Cheat-Engine "find what accesses this address" for managed code.
- **EventPipe + `DiagnosticSource`/`EventSource`** + `dotnet-trace`/`dotnet-counters`/`dotnet-dump`/
  `dotnet-monitor` — the live event/trace/counter stream from a running process (no debugger) → the
  **DORA-metrics** feed.
- **ICorDebug** — the debugging API (breakpoints, step, inspect) = **triggers** (conditional breakpoints).
- **Harmony / MonoMod** — runtime **IL patching/hooking** (the game-modding lineage; literally the
  Cheat-Engine-adjacent runtime patch for .NET).

So the lived **Cheat-Engine method** (scan → find-what-writes = antecedent → set a trigger → read the
metric; "how I debug assembly + write triggers + DORA in Cheat Engine") maps **1:1 onto .NET**: ClrMD =
scan, Profiler = find-what-writes/antecedent, ICorDebug = triggers, EventPipe = DORA, Harmony = patch.
**This hook is the common ground** — we build Zeta outward from it (the finalizer/runtime, the uncertainty
meter, the DORA feed all ride it).

## Other hooks here

- **git hooks** (commit/merge — the heartbeat-via-commit; AgencySignature) · **trigger hooks** (`triggers/`
  fire via these) · **update hooks** (`updates/`).

## Honest scope / security

- **Profiling/ClrMD on OUR OWN processes** (our runtime, our cluster) — security by clarity, our own PKI.
  Hooking *foreign* processes is out of scope (not a malware tool). Profiler/ClrMD are standard MS
  diagnostics, not exploits.

## Pointers

- `triggers/` + `updates/` · `src/Core/FinalizerRuntime.fs` (the tick engine the hook feeds) · the
  antecedent-tracing / Cheat-Engine / Rx-ray-tracing-itself captures (`docs/research/2026-06-10-*antecedent*`,
  `…zetamax…`). · ClrMD / CLR Profiler API / EventPipe / ICorDebug / Harmony (Beacon anchors).
