---
id: 081M0WN5YH1087G0R003BMSK9R
type: task
state: backlog
priority: P2
slug: roll-net-sdk-10-0-303-10-0-400-feature-band-with-the-coupled
title: "Roll .NET SDK 10.0.303 -> 10.0.400 (feature band) with the coupled Roslyn/CodeAnalysis bump"
created: 2026-08-25T14:28:54.433Z
depends_on: []
composes_with: []
---

# Roll .NET SDK 10.0.303 -> 10.0.400 (feature band) with the coupled Roslyn/CodeAnalysis bump

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0WN5YH1087G0R003BMSK9R-*.md` glob. -->

## What

Move the .NET SDK from 10.0.303 to 10.0.400 and carry every value that is
coupled to it in the SAME commit, because the guards refuse a half-fix:

| file | 10.0.303 | 10.0.400 |
|---|---|---|
| `.mise.toml` `dotnet` (single declared source) | 10.0.303 | 10.0.400 |
| `global.json` `sdk.version` (restatement) | 10.0.303 | 10.0.400 |
| `Directory.Packages.props` `Microsoft.CodeAnalysis.CSharp` | 5.6.0 | 5.9.0 |
| `Directory.Packages.props` `Microsoft.CodeAnalysis.Analyzers` | 5.6.0 | 5.9.0 |
| `Directory.Packages.props` `FSharp.Core` | 10.1.400 | 10.1.400 (unchanged, see below) |

## Why the CodeAnalysis pins moved

This is a FEATURE-band roll, and a feature band is the thing that moves the
SDK's bundled Roslyn minor. Measured, not inferred, by executing each SDK's own
`Roslyn/bincore/csc.dll -version` (the method `audit-codeanalysis-sdk-match.ts`
itself uses), with the two previously-recorded rows reproduced first as a control:

    10.0.302 -> 5.6.0-2.26329.109   (control, matched the recorded value)
    10.0.303 -> 5.6.0-2.26377.103   (control, matched the recorded value)
    10.0.400 -> 5.9.0-1.26379.115   <- the minor moved, 5.6 -> 5.9

5.9.0 is exactly the version Dependabot proposed on PR #13590 and the guard
correctly refused when the SDK was still on 5.6.0. The bot had the right version
at the wrong time; it could see the package feed and could not see the SDK.

## Why FSharp.Core did NOT move

A measurement, not an omission. Each SDK declares its implicit FSharp.Core as
`<FSCorePackageVersion>` under `<sdk>/FSharp/`:

    SDK 10.0.303 -> FSharp.Core 10.1.303
    SDK 10.0.400 -> FSharp.Core 10.1.400

The repo already pinned 10.1.400, i.e. it was pinned AHEAD of the SDK it ran on.
This roll does not bump FSharp.Core; it makes the existing pin correct.

## Verification

- `dotnet build -c Release`: 0 warnings, 0 errors (TreatWarningsAsErrors on).
- `dotnet test Zeta.sln -c Release`: 6545 total, 6539 passed, 0 failed, 6 skipped,
  across 7 assemblies. Counts summed from every summary line in the full log,
  not read off a truncated tail.
- Guards, exit codes read directly: `audit-dotnet-pin-parity.ts` 0,
  `audit-codeanalysis-sdk-match.ts` 0, `mise-pin-parity.ts` 0,
  `audit-mise-toolchain-couplings.ts` 0; their 59 unit tests pass.

