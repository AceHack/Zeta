---
id: 081KYYQ831108QG0R001FJJ9XK
type: bug
state: backlog
priority: P2
slug: investigate-intermittent-net-10-arm64-accessviolation-in-cor
title: "Investigate intermittent ARM64 GC crashes across .NET and Node"
created: 2026-08-01T13:12:06.945Z
depends_on: []
composes_with: []
---

# Investigate intermittent ARM64 GC crashes across .NET and Node

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KYYQ831108QG0R001FJJ9XK-*.md` glob. -->

## Problem

Local gate runs on one Apple Silicon Mac terminated three times in native
garbage-collection or corrupting-state paths on 2026-08-01: twice under .NET
and once under Node/V8. Immediate isolated and full reruns passed, so the
failure is intermittent. A successful rerun is evidence against a deterministic
source failure, but it does not explain or resolve memory corruption.

Environment at observation time:

- macOS 26.5.2 (25F84), Mac14,14, ARM64.
- .NET SDK 10.0.302, host and runtime 10.0.10.
- Node 24.16.0 from the repository's mise-managed toolchain.
- `DOTNET_gcServer=0` (workstation GC).
- Repository `global.json` pinned SDK 10.0.302 with `latestPatch` roll-forward.

## Observations

### Native GC segmentation fault

- Command context: the .NET test phase of `bun run preflight`.
- Process: `Tests.FSharp`.
- Result: exit 139; macOS recorded `EXC_BAD_ACCESS`, `SIGSEGV`, and
  `KERN_INVALID_ADDRESS`.
- Faulting thread: `.NET TP Worker`.
- First native frames:
  `WKS::gc_heap::plan_phase`, `WKS::gc_heap::gc1`,
  `WKS::gc_heap::garbage_collect`, and
  `WKS::GCHeap::GarbageCollectGeneration`.
- Local crash report:
  `~/Library/Logs/DiagnosticReports/Tests.FSharp-2026-08-01-083006.ips`.

### Roslyn analysis fail-fast

- Command context: a later local full preflight run during C# analysis.
- Process: `dotnet`.
- Result: `AccessViolationException` followed by exit 134; the console trace
  included `Microsoft.CodeAnalysis.SyntaxToken.get_Span()`.
- macOS recorded `EXC_CRASH`, `SIGABRT`, and a CoreCLR corrupting-state
  fail-fast path on a `.NET TP Worker`.
- Local crash report:
  `~/Library/Logs/DiagnosticReports/dotnet-2026-08-01-084841.ips`.

### V8 scavenger segmentation fault

- Command context: repository-wide Markdown lint through the local
  `markdownlint-cli2` Node entry point.
- Process: `node` 24.16.0.
- Result: exit 139 with no lint output; macOS recorded `EXC_BAD_ACCESS`,
  `SIGSEGV`, and `KERN_INVALID_ADDRESS`.
- Faulting thread: `MainThread`.
- First native frames:
  `v8::internal::Scavenger::ScavengePage`,
  `v8::internal::ScavengerCollector::JobTask::ProcessItems`, and
  `v8::internal::Heap::Scavenge`.
- Local crash report:
  `~/Library/Logs/DiagnosticReports/node-2026-08-01-093800.ips`.
- The identical command passed on the immediate rerun without file changes.

These are observations, not a root-cause assignment. Independent CoreCLR and
V8 garbage collectors failing on the same host weakens a .NET-only hypothesis.
The evidence still does not distinguish an OS or hardware fault, process-wide
resource pressure, repository native-lifetime corruption, separate runtime
defects, or another cause.

## Non-reproduction evidence

After the first crash:

- `dotnet test tests/Tests.FSharp/Tests.FSharp.fsproj -c Release --no-build`
  passed 4,463 tests with 4 skipped.
- `dotnet test Zeta.sln -c Release --no-build` passed.
- A later complete `bun run preflight` passed all 14 checks.
- Repository-wide Markdown lint passed immediately after the Node crash with
  no file changes.
- Another complete `bun run preflight` passed all 14 checks after the V8 crash.

Repository history also records transient exit-139 failures and already retries
one such formatter failure. A retry limits disruption; it is not a correctness
proof or a diagnosis.

## Investigation

1. Add a bounded stress reproducer that repeatedly runs the affected test,
   formatter/analyzer, and Node Markdown paths while retaining iteration,
   process, exit-code, resident-memory, and crash-report metadata.
2. Capture a native dump or trace on first failure. Keep raw dumps out of git;
   preserve a sanitized stack and environment transcript in the workitem.
3. Compare workstation and server GC, serial and parallel project execution,
   and the pinned runtimes against the next available .NET 10 and Node 24
   patches. Do not make a GC-mode workaround permanent without a measured
   cause.
4. Run the same reproducer on the macOS ARM64 build host. A single-machine-only
   result must be reported as such.
5. Run host-level memory and hardware diagnostics, inspect unified logs around
   all three incidents, and record whether failures continue after a cold boot.
   Do not label the machine faulty unless those measurements support it.
6. Audit unsafe/native interop and finalizer lifetimes exercised by the failing
   graph, including Arrow, LibGit2Sharp, and BLAKE3 call sites. Loaded native
   images alone are not evidence that a library caused the crash.
7. If a minimal repository-independent runtime, Roslyn, or V8 reproducer
   exists, file it upstream with runtime version and native stack. Otherwise
   land the demonstrated repository or host fix with a focused regression.

## Acceptance

- The stress run reports iteration counts and failures rather than silently
  retrying them away.
- The issue is reproduced with a captured actionable stack, or a documented
  bounded run on two ARM64 Macs establishes the current non-reproduction limit.
- Any claimed fix survives both runtime stress paths and the full preflight on
  both machines.
- The final disposition names the demonstrated cause. If the cause remains
  unknown, the workitem stays open and says so.
