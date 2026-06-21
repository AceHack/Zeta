---
id: 081KRHWGX0008QG0R003MTMBGR
priority: P1
status: open
title: "DBpedia 081KRFA460008QG0R0018SN61J.2 — F# project scaffold + NuGet add + connectivity smoke test"
type: feature
origin: 081KRFA460008QG0R0018SN61J decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R0018SN61J
depends_on:
  - 081KRHWGX0008QG0R00187PQGZ
composes_with:
  - 081KRFA460008QG0R0018SN61J
  - 081KRHWGX0008QG0R00187PQGZ
  - 081KRHWGX0008QG0R001VKR0TH
  - 081KRHWGX0008QG0R002GFSJC6
  - 081KRHWGX0008QG0R002TYF2NM
---

# 081KRHWGX0008QG0R003MTMBGR — F# project scaffold + NuGet add + connectivity smoke test

**Depends on 081KRHWGX0008QG0R00187PQGZ (library choice ADR must be closed first).**

## Purpose

Create the `src/DBpedia/` F# project, wire it into `Zeta.sln`, add the chosen
NuGet package (from 081KRHWGX0008QG0R00187PQGZ's ADR), and prove the SPARQL endpoint is reachable
with a minimal query. Everything in 081KRHWGX0008QG0R001VKR0TH..081KRHWGX0008QG0R002TYF2NM builds on this foundation.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] Confirm 081KRHWGX0008QG0R00187PQGZ is `closed` and ADR is merged
- [ ] Read ADR to confirm library name + version + CI strategy
- [ ] Check existing project structure in `Zeta.sln`
- [ ] Confirm `Directory.Packages.props` does not already have the package

## Work items

### 1. New F# project

```
src/DBpedia/
  DBpedia.fsproj       ← references the library from 081KRHWGX0008QG0R00187PQGZ ADR
  Client.fs            ← minimal SPARQL client wrapper
tests/DBpedia.Tests/
  DBpedia.Tests.fsproj
  ConnectivityTests.fs ← smoke test(s)
```

`DBpedia.fsproj` must:

- Target `net10.0` (matches existing projects)
- Reference chosen library (pinned version from ADR)
- Include in `Zeta.sln`

### 2. Package manifest

Add to `Directory.Packages.props`:

```xml
<PackageVersion Include="<chosen-library>" Version="<pinned-version>" />
```

### 3. Minimal `Client.fs`

A thin type over the library's SPARQL query client:

```fsharp
module Zeta.DBpedia.Client

// Opaque endpoint handle — keeps library leakage off the public surface
type Endpoint = private Endpoint of <LibraryType>

let dbpedia : Endpoint = ...
let query (endpoint: Endpoint) (sparql: string) : Result<..., DbspError> = ...
```

Error surface: `Result<_, DbspError>` per the repo-wide result-over-exception rule.

### 4. CI strategy (per ADR)

Implement whichever CI strategy the ADR chose:

- **Recorded fixture** (preferred): capture one real DBpedia response; replay
  in CI without network access
- **Live endpoint** (fallback): mark test `[<Fact(Skip="Requires live DBpedia endpoint — use recorded fixture for CI")>]`
  so the test is skipped by default; remove `Skip=` only when running locally against DBpedia

The smoke test must:

- Execute the query below (or recorded equivalent):
  ```sparql
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  SELECT ?label WHERE { <http://dbpedia.org/resource/Berlin> rdfs:label ?label . FILTER (LANG(?label) = 'en') }
  ```
- Assert at least one `rdfs:label` result
- Pass under `dotnet test Zeta.sln -c Release`

## Build gate check

```bash
dotnet build -c Release   # 0 warnings 0 errors
dotnet test  Zeta.sln -c Release
```

Both must pass before PR opens.

## Definition of done

- [ ] `src/DBpedia/DBpedia.fsproj` added to `Zeta.sln`
- [ ] `tests/DBpedia.Tests/DBpedia.Tests.fsproj` added to `Zeta.sln`
- [ ] Chosen NuGet package in `Directory.Packages.props`
- [ ] Connectivity smoke test passes (live or recorded per ADR)
- [ ] `dotnet build -c Release` — 0 warnings 0 errors
- [ ] `dotnet test Zeta.sln -c Release` — all tests green
- [ ] 081KRHWGX0008QG0R001VKR0TH can begin immediately after this merges
- [ ] 081KRHWGX0008QG0R003MTMBGR status set to `closed`

## Why P1

Foundation row: 081KRHWGX0008QG0R001VKR0TH, 081KRHWGX0008QG0R002GFSJC6, and 081KRHWGX0008QG0R002TYF2NM all add code on top of this project.
Establishing a green build with the library wired in de-risks all three.
