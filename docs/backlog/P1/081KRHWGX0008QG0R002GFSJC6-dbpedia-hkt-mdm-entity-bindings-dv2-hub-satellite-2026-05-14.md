---
id: 081KRHWGX0008QG0R002GFSJC6
priority: P1
status: open
title: "DBpedia 081KRFA460008QG0R0018SN61J.4 — HKT-MDM entity bindings + DV2.0 hub-satellite types"
type: feature
origin: 081KRFA460008QG0R0018SN61J decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R0018SN61J
depends_on:
  - 081KRHWGX0008QG0R001VKR0TH
composes_with:
  - 081KRFA460008QG0R0018SN61J
  - 081KRHWGX0008QG0R001VKR0TH
  - 081KRHWGX0008QG0R002TYF2NM
  - 081KQ3HBZ0008QG0R000Q4Y00F
  - .claude/rules/dv2-data-split-discipline-activated.md
  - memory/feedback_aaron_ontology_hkt_applies_directly_to_master_data_every_company_has_one_human_lineage_2026_05_13.md
  - memory/feedback_aaron_clifford_hkt_ontology_vocabulary_axis_basis_rudders_rotors_steering_cartographer_navigator_edge_mapper_world_model_civsim_edge_runner_5_control_structures_or_4_plus_meta_2026_05_13.md
---

# 081KRHWGX0008QG0R002GFSJC6 — HKT-MDM entity bindings + DV2.0 hub-satellite types

**Depends on 081KRHWGX0008QG0R001VKR0TH (SPARQL CE must exist).**

## Purpose

Bind DBpedia SPARQL results to the factory's HKT `M<'T>` substrate (PR #2913)
and apply the DV2.0 hub-satellite partition to the resulting types. This row
is the MDM (Master Data Management) layer — it turns raw SPARQL rows into
typed, DV2.0-structured F# entities.

## DV2.0 partition design

Per `.claude/rules/dv2-data-split-discipline-activated.md`, separate by
change rate:

| DV2.0 type | DBpedia shape | Change rate |
|------------|---------------|-------------|
| **Hub** | Wikipedia article URI (stable business key) | Rare — stable across edits |
| **Satellite** | Named attributes (label, birth date, occupation, etc.) | Frequent — wiki edits |
| **Link** | Relationships between entities (e.g. Person → Organization) | Medium |

## F# types to implement

### `src/DBpedia/Entities.fs`

```fsharp
module Zeta.DBpedia.Entities

open System

// ── Hubs (stable business keys) ──────────────────────────────────────────
[<Struct>]
type PersonHub       = PersonHub       of uri: string
[<Struct>]
type OrganizationHub = OrganizationHub of uri: string
[<Struct>]
type EventHub        = EventHub        of uri: string

// ── Satellites (versioned attributes) ────────────────────────────────────
type PersonSatellite = {
    Hub          : PersonHub
    Name         : string
    BirthDate    : DateOnly option
    Occupation   : string option
    AsOf         : DateTimeOffset   // revision timestamp (DV2.0 effective date)
}

type OrganizationSatellite = {
    Hub          : OrganizationHub
    Name         : string
    Founded      : DateOnly option
    Industry     : string option
    AsOf         : DateTimeOffset
}

type EventSatellite = {
    Hub          : EventHub
    Label        : string
    Date         : DateOnly option
    Location     : string option
    AsOf         : DateTimeOffset
}

// ── HKT binding (factory M<'T> parametric over entity type) ──────────────
// M<'T> follows PR #2913 pattern — parametric wrapper that composes with
// the DV2.0 satellite, making each entity type a named "slot" in the MDM.
type M<'T> = { Entity: 'T }

module Person =
    let ofSparqlRow (hub: PersonHub) (row: SparqlRow) : Result<PersonSatellite, DbspError> = ...

module Organization =
    let ofSparqlRow (hub: OrganizationHub) (row: SparqlRow) : Result<OrganizationSatellite, DbspError> = ...

module Event =
    let ofSparqlRow (hub: EventHub) (row: SparqlRow) : Result<EventSatellite, DbspError> = ...
```

`SparqlRow` is the result row type returned by `Client.query` (defined in 081KRHWGX0008QG0R003MTMBGR).

## Tests (`tests/DBpedia.Tests/EntityBindingTests.fs`)

All tests are pure (use fixture rows, not network). For each entity type:

- Happy-path binding from a valid SPARQL row
- Missing optional field → `None` (not an error)
- Missing required field → `Error DbspError`
- Hub URI round-trip: `PersonHub "http://dbpedia.org/resource/Alan_Turing"` renders
  correctly in the SPARQL CE (compose with 081KRHWGX0008QG0R001VKR0TH query)

At minimum 6 tests (2 per entity type).

## FsCheck property

```fsharp
[<Property>]
let ``Hub URI is preserved through satellite round-trip``
    (uri: NonEmptyString) =
    let hub = PersonHub uri.Get
    let row = ... // synthetic fixture
    match Person.ofSparqlRow hub row with
    | Ok sat -> sat.Hub = hub
    | Error _ -> true  // error case doesn't violate invariant
```

## Build gate

```bash
dotnet build -c Release   # 0 warnings 0 errors
dotnet test  Zeta.sln -c Release
```

## Definition of done

- [ ] `Entities.fs` in `src/DBpedia/` with hub + satellite types for 3 entities
- [ ] `ofSparqlRow` bindings for Person, Organization, Event
- [ ] `M<'T>` wrapper type present
- [ ] `EntityBindingTests.fs` with ≥ 6 tests + ≥ 1 FsCheck property
- [ ] All tests pure
- [ ] `dotnet build -c Release` — 0 warnings 0 errors
- [ ] `dotnet test Zeta.sln -c Release` — all tests green
- [ ] 081KRHWGX0008QG0R002GFSJC6 status set to `closed`
- [ ] 081KRHWGX0008QG0R002TYF2NM can begin immediately after this merges

## Why P1

Without the MDM binding layer the demo (081KRHWGX0008QG0R002TYF2NM) is just a raw SPARQL query
result dump, not an HKT-MDM canonical demonstration. This row is what makes
081KRFA460008QG0R0018SN61J a "canonical demo" rather than a connectivity spike.
