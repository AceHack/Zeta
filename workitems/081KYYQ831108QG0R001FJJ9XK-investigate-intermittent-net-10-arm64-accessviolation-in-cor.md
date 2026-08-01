---
id: 081KYYQ831108QG0R001FJJ9XK
type: bug
state: backlog
priority: P2
slug: investigate-intermittent-net-10-arm64-accessviolation-in-cor
title: "Investigate intermittent .NET 10 ARM64 AccessViolation in CoreCLR GC and Roslyn"
created: 2026-08-01T13:12:06.945Z
depends_on: []
composes_with: []
---

# Investigate intermittent .NET 10 ARM64 AccessViolation in CoreCLR GC and Roslyn

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KYYQ831108QG0R001FJJ9XK-*.md` glob. -->

## Problem

Local full-gate runs on one Apple Silicon Mac terminated twice in native .NET
failure paths on 2026-08-01. Immediate isolated and full reruns passed, so the
failure is intermittent. A successful rerun is evidence against a deterministic
source failure, but it does not explain or resolve memory corruption.

Environment at observation time:

- macOS 26.5.2 (25F84), Mac14,14, ARM64.
- .NET SDK 10.0.302, host and runtime 10.0.10.
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

These are observations, not a root-cause assignment. The two managed workloads
may expose one runtime fault, a repository native-lifetime bug, a machine fault,
or unrelated defects.

## Non-reproduction evidence

After the first crash:

- `dotnet test tests/Tests.FSharp/Tests.FSharp.fsproj -c Release --no-build`
  passed 4,463 tests with 4 skipped.
- `dotnet test Zeta.sln -c Release --no-build` passed.
- A later complete `bun run preflight` passed all 14 checks.

Repository history also records transient exit-139 failures and already retries
one such formatter failure. A retry limits disruption; it is not a correctness
proof or a diagnosis.

## Investigation

1. Add a bounded stress reproducer that repeatedly runs the affected test and
   formatter/analyzer paths while retaining iteration, process, exit-code, and
   crash-report metadata.
2. Capture a native dump or trace on first failure. Keep raw dumps out of git;
   preserve a sanitized stack and environment transcript in the workitem.
3. Compare workstation and server GC, serial and parallel project execution,
   and the pinned runtime against the next available .NET 10 patch. Do not make
   a GC-mode workaround permanent without a measured cause.
4. Run the same reproducer on the macOS ARM64 build host. A single-machine-only
   result must be reported as such.
5. Audit unsafe/native interop and finalizer lifetimes exercised by the failing
   graph, including Arrow, LibGit2Sharp, and BLAKE3 call sites. Loaded native
   images alone are not evidence that a library caused the crash.
6. If a minimal repository-independent runtime or Roslyn reproducer exists,
   file it upstream with runtime version and native stack. Otherwise land the
   repository lifetime fix with a focused regression test.

## Acceptance

- The stress run reports iteration counts and failures rather than silently
  retrying them away.
- The issue is reproduced with a captured actionable stack, or a documented
  bounded run on two ARM64 Macs establishes the current non-reproduction limit.
- Any claimed fix survives the stress reproducer and the full preflight on both
  machines.
- The final disposition names the demonstrated cause. If the cause remains
  unknown, the workitem stays open and says so.
