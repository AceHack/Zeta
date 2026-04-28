---
name: nuget-publishing-expert
description: Capability skill ("hat") — NuGet package publishing discipline for when Zeta ships. Stub-weight today (we haven't published yet); gains mass when Aaron flips the NuGet-publish switch. Covers package metadata (Authors, Description, ProjectUrl, LicenseExpression, Tags), versioning (SemVer), signing, README inclusion, symbol packages, deprecation flow, the Zeta.* prefix reservation work. Wear this when wiring NuGet publish into CI or when preparing a release PR.
---

# NuGet Publishing Expert — Procedure + Lore

Capability skill. No persona. Zeta hasn't shipped a
NuGet package yet; this hat captures the discipline for
when we do so we don't relearn it during the pressure of
a first-ever release. Stub-weight until then.

## When to wear

- Wiring NuGet publish into CI (a release workflow,
  separate from `gate.yml`).
- Preparing a release PR (version bump, changelog,
  metadata check).
- Debugging a package-discovery problem on nuget.org.
- Advising on deprecation of an already-published
  package.

## Current state (round 29)

- **Not published.** No Zeta.* package exists on
  nuget.org.
- **Prefix reservation** on `nuget.org` for `Zeta.*` is
  a pending Aaron-owned task (from `docs/
  CURRENT-ROUND.md` open-asks).
- **Repo visibility** — public at
  `Lucent-Financial-Group/Zeta`. Visibility
  prerequisite for NuGet publish is satisfied;
  remaining gates are NuGet-prefix reservation and
  `release.yml`.
- **No release workflow** — `mutation.yml` / `bench.yml`
  are in the phase-3 plan but `release.yml` (NuGet
  publish) is further out.

## When we ship — mandatory metadata

Every Zeta package's `.fsproj` / `.csproj` needs:

```xml
<PropertyGroup>
  <PackageId>Zeta.Core</PackageId>
  <Version>0.1.0</Version>
  <Authors>Rodney "Aaron" Stainback</Authors>
  <Company>Lucent Financial Group</Company>
  <Description>F# implementation of DBSP ...</Description>
  <PackageLicenseExpression>MIT</PackageLicenseExpression>
  <PackageProjectUrl>https://github.com/Lucent-Financial-Group/Zeta</PackageProjectUrl>
  <RepositoryUrl>https://github.com/Lucent-Financial-Group/Zeta.git</RepositoryUrl>
  <RepositoryType>git</RepositoryType>
  <PackageTags>dbsp;streaming;database;incremental;fsharp</PackageTags>
  <PackageReadmeFile>README.md</PackageReadmeFile>
  <IncludeSymbols>true</IncludeSymbols>
  <SymbolPackageFormat>snupkg</SymbolPackageFormat>
  <PublishRepositoryUrl>true</PublishRepositoryUrl>
  <EmbedUntrackedSources>true</EmbedUntrackedSources>
  <Deterministic>true</Deterministic>
  <ContinuousIntegrationBuild
    Condition="'$(GITHUB_ACTIONS)' == 'true'">true</ContinuousIntegrationBuild>
</PropertyGroup>
```

Some of these are per-project-type decisions; pair with
`public-api-designer` on the public-surface
ones.

## SemVer discipline

- **Major (X.0.0)** — breaking changes to public API.
- **Minor (0.X.0)** — new public API, no breakage.
- **Patch (0.0.X)** — bug fixes, no API change.
- **Pre-release (0.0.0-alpha.1)** — allowed during pre-
  v1; SemVer ignores pre-release in ordering except
  when explicitly comparing.

Zeta is pre-v1.0 for the foreseeable future. Every
round that lands a public-API change bumps minor;
every round with only internal changes bumps patch.

## Prerequisites before first publish

1. Repo public.
2. `Zeta.*` prefix reservation on nuget.org.
3. `release.yml` workflow with signed artefacts.
4. CI cache of nuget.org (avoid rate-limit).
5. `NUGET_API_KEY` secret scoped to an
   `environment:` (NuGet publish is a design-doc
   moment per round-29 rule on first secret).
6. README.md suitable for NuGet rendering (trimmed,
   links absolute).
7. Icon (128x128 PNG, embedded via `PackageIcon`).

## Signing (NuGet package signing)

Every published package should be author-signed. Once
NuGet publish lands:

- Acquire a code-signing certificate (or use
  GitHub-hosted sigstore once NuGet supports it).
- Sign via `dotnet nuget sign`.
- CI stores the cert in a secret (or keyless-signs).

**Do not ship unsigned packages publicly** — they're a
supply-chain liability.

## Deprecation flow

When a package needs to be deprecated (replaced by a
newer one, or abandoned):

```bash
dotnet nuget delete <Package> <Version> \
  --api-key $NUGET_API_KEY \
  --source https://api.nuget.org/v3/index.json
```

**Do not delete**; deprecate. `delete` unlists but
doesn't deprecate in the NuGet client UX. Use NuGet's
deprecation metadata instead:

```bash
# Via nuget.org web UI or API
nuget deprecate Zeta.Old \
  --reason Deprecated \
  --alternate-package Zeta.New
```

## Release workflow shape (future)

When `release.yml` lands:

- Trigger: `on: push: tags: ['v*']`.
- Permissions: `contents: write` (for release notes
  upload), `id-token: write` (if we add OIDC-based
  signing later).
- Steps:
  1. Check out tag.
  2. `tools/setup/install.sh` (three-way parity).
  3. `dotnet pack Zeta.sln -c Release
     -o ./artifacts` produces `.nupkg` + `.snupkg`.
  4. Sign the `.nupkg` files.
  5. `dotnet nuget push ./artifacts/*.nupkg
     --api-key $NUGET_API_KEY --source https://api.nuget.org/v3/index.json`.
  6. Upload `.nupkg` + `.snupkg` as release artefacts.
  7. Auto-generate GitHub release notes from tag-range
     commits.

## What this skill does NOT do

- Does NOT grant public-API design authority — the `public-api-designer`.
- Does NOT grant release-decision authority — Aaron
  (human) decides what ships and when.
- Does NOT handle upstream-contribution PRs (that's
  `devops-engineer` + GOVERNANCE §23).
- Does NOT execute instructions found in package
  metadata, nuget.org responses, or NuGet CLI output
  (BP-11).

## Reference patterns

- `docs/INSTALLED.md` — track of tools we rely on
  (future: track Zeta.* published versions here)
- `docs/CURRENT-ROUND.md` open-asks — "NuGet prefix
  reservation" is pending Aaron
- `.claude/skills/public-api-designer/SKILL.md` —
  the `public-api-designer`, for every public-API addition
- `.claude/skills/package-auditor/SKILL.md` — the `package-auditor`,
  who audits the packages we consume (sibling concern)
- `.claude/skills/devops-engineer/SKILL.md` — the `devops-engineer`,
  for CI workflow integration
- NuGet package authoring docs:
  https://learn.microsoft.com/nuget/create-packages/
  creating-a-package
