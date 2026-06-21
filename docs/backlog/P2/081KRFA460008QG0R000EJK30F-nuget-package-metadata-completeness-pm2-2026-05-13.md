---
id: 081KRFA460008QG0R000EJK30F
priority: P2
status: open
title: "NuGet package metadata completeness — description, tags, SourceLink, semantic versioning"
type: friction-reducer
origin: PM-2 gap-prediction pass (081KR2E4K0008QG0R003VB7ZZR) 2026-05-13
created: 2026-05-13
last_updated: 2026-05-13
depends_on: []
composes_with: [081KQGDBJ0008QG0R002NV04N9]
tags: [nuget, package-metadata, discoverability, sourcelink, versioning, dotnet]
---

# 081KRFA460008QG0R000EJK30F — NuGet package metadata completeness

## PM-2 signal

`Directory.Build.props` has `<Authors>zeta contributors</Authors>` but
no `PackageDescription`, `PackageTags`, `RepositoryUrl`,
`PackageLicenseExpression`, or `PackageVersion`. `dotnet pack` currently
produces a `.nupkg` with a blank description, no tags, and version `1.0.0`
baked in. A developer searching NuGet for "incremental streaming F#"
would not find Zeta.

## What

Add to `Directory.Build.props`:

```xml
<PackageDescription>
  Zeta — retraction-native incremental view maintenance for .NET.
  An F# implementation of the DBSP algebra (Budiu et al., VLDB'23).
  Streaming, reproducible, near-zero-allocation.
</PackageDescription>
<PackageTags>dbsp;incremental;streaming;retraction;fsharp;dotnet;ivm</PackageTags>
<RepositoryUrl>https://github.com/Lucent-Financial-Group/Zeta</RepositoryUrl>
<PackageProjectUrl>https://github.com/Lucent-Financial-Group/Zeta</PackageProjectUrl>
<PackageLicenseExpression>Apache-2.0</PackageLicenseExpression>
```

Semantic versioning: drive `Version` from a `VERSION` file checked into
git root (e.g., `1.0.0-alpha.1`) so every `dotnet pack` produces a
deterministic version tied to source.

SourceLink: add `Microsoft.SourceLink.GitHub` to `Directory.Packages.props`
and `<PublishRepositoryUrl>true</PublishRepositoryUrl>` in `Directory.Build.props`
so debugger source-navigation works for downstream consumers.

## Why now

The Aurora pitch (PR #2924) and 081KQGDBJ0008QG0R002NV04N9 (GitHub Pages SEO) are preparing
the external-consumption story. A NuGet package with no description and
a static version looks abandoned and is invisible to search.

## Non-goals

- Does not require publishing to nuget.org yet.
- Does not change any F# or C# source code.

## Acceptance criteria

- [ ] `dotnet pack` produces a `.nupkg` with Description, Tags,
      RepositoryUrl, LicenseExpression populated.
- [ ] `Version` is driven from a `VERSION` file, not hard-coded.
- [ ] `dotnet pack --include-symbols` produces a `.snupkg` with SourceLink.
- [ ] `dotnet build -c Release` 0 warnings after the change.

## Kill criteria

If NuGet publishing is explicitly WONT-DO before the Aurora pitch closes,
defer to P3 and note that decision in this row.
