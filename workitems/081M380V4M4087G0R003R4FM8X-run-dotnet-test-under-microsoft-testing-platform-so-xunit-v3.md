---
id: 081M380V4M4087G0R003R4FM8X
type: task
state: backlog
priority: P2
slug: run-dotnet-test-under-microsoft-testing-platform-so-xunit-v3
title: "Run dotnet test under Microsoft.Testing.Platform so xunit.v3 4.x (MTP v2) can land"
created: 2026-09-23T20:55:45.540Z
depends_on: []
composes_with: []
---

# Run dotnet test under Microsoft.Testing.Platform so xunit.v3 4.x (MTP v2) can land

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M380V4M4087G0R003R4FM8X-*.md` glob. -->

## Why

Dependabot PR #17459 (xunit.v3 3.2.2 -> 4.0.1) failed every build-and-test leg before a single
test ran: xunit.v3 4.x ships Microsoft.Testing.Platform v2, and MTP v2's MSBuild targets
refuse the VSTest mode of `dotnet test` on the .NET 10 SDK
(`Testing with VSTest target is no longer supported ... https://aka.ms/dotnet-test-mtp-error`).

## What changed

- `global.json` opts `dotnet test` into MTP mode (`test.runner: Microsoft.Testing.Platform`).
  xunit.v3 3.2.2 ships MTP v1 1.9.1 (mode needs >= 1.7), so this lands on main FIRST, before
  the bump, and #17459 then only needs its own version change.
- Every `dotnet test` call site moved to the MTP argument form (`--solution` / `--project`,
  xUnit filters after `--`): `gate.yml`, `low-memory.yml`, `preflight.ts`,
  `fsharp-mutation-probe.ts`, `build-receipt-checks.json`, and the onboarding docs.
- VSTest `--blame-hang-timeout 15m` became xUnit `--long-running 300` (names a hung test) plus
  MTP `--timeout 20m` (kills it). Crash naming and coverage are the follow-up
  081M380V792087G0R001PR993V.

## Measured (local, macOS arm64, SDK 10.0.401)

Discovered tests per project, VSTest mode on main vs MTP mode, xunit.v3 3.2.2 and 4.0.1:
Bayesian.Tests 639 · Core.CSharp.Mediator.Tests 12 · Core.CSharp.Tests 21 ·
Tests.CSharp.TypeProvider 3 · Tests.CSharp 413 · Tests.FSharp.Git 38 · Tests.FSharp 6906 —
identical in all three, 8032 total; 8026 passed + 6 skipped in every run.

**Second blocker for #17459, found here:** under xunit.v3 4.0.1 with FsCheck.Xunit.v3 3.3.4,
721 tests fail at discovery (`MissingMethodException` in `FsCheck.Xunit.PropertyDiscoverer`).
FsCheck.Xunit.v3 3.4.0 declares `xunit.v3.extensibility.core [4.0.0, 5.0.0)`; with FsCheck +
FsCheck.Xunit.v3 at 3.4.0 all 8032 pass. That bump cannot land before xunit 4 (it requires
it), so it belongs on #17459 itself.
