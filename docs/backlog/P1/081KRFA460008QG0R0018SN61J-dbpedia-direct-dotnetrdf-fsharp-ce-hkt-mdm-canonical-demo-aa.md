---
id: 081KRFA460008QG0R0018SN61J
priority: P1
status: decomposed
title: "DBpedia via direct dotNetRDF + F# CE — HKT-MDM canonical demo (Path B, do now)"
type: feature
origin: Aaron 2026-05-13 (autonomous-loop substrate cascade)
created: 2026-05-13
last_updated: 2026-05-14
children:
  - 081KRHWGX0008QG0R00187PQGZ
  - 081KRHWGX0008QG0R003MTMBGR
  - 081KRHWGX0008QG0R001VKR0TH
  - 081KRHWGX0008QG0R002GFSJC6
  - 081KRHWGX0008QG0R002TYF2NM
composes_with:
  - 081KQ3HBZ0008QG0R000Q4Y00F
  - memory/feedback_aaron_dbpedia_is_free_master_data_human_curated_fsharp_type_provider_archived_resurrect_for_hkt_mdm_canonical_demo_fork_fsharp_compiler_for_ai_safety_real_hkt_over_clifford_2026_05_13.md
  - memory/feedback_aaron_ontology_hkt_applies_directly_to_master_data_every_company_has_one_human_lineage_2026_05_13.md
  - memory/feedback_aaron_clifford_hkt_ontology_vocabulary_axis_basis_rudders_rotors_steering_cartographer_navigator_edge_mapper_world_model_civsim_edge_runner_5_control_structures_or_4_plus_meta_2026_05_13.md
---

# DBpedia via direct dotNetRDF + F# CE — HKT-MDM canonical demo (Path B, do now)

## Aaron's directive (with correction)

Aaron 2026-05-13 (first): *"dude is there still a free f# type
provider for this? https://www.dbpedia.org/ this is like free
master data with human curtatino"*

Aaron 2026-05-13 (correction): *"sorry i said it backwards the
first one after f# fork"* + *"Build fresh F# type provider on
dotNetRDF or RDFSharp the hard one we wait and do with fork"*.

**Corrected ordering**:

- **Path B (THIS ROW — do NOW)**: Direct dotNetRDF API + F#
  computation expressions
- **Path A (DEFERRED)**: Build F# type provider — waits for
  F#-compiler-fork-for-AI-safety with real HKT over Clifford

## Why Path B now

- Works on current F# (no compiler fork required)
- Medium effort (vs High for type provider)
- Composes with existing F# CE substrate in the codebase
- Demonstrates HKT-MDM (PR #2913) at internet scale via real
  human-curated master data
- Unblocks 081KQ3HBZ0008QG0R000Q4Y00F (universal-business-templates) canonical
  demo
- Aurora pitch (PR #2924) gets a working demonstration

## Why Path A is deferred

Type-provider authoring with current F# requires workarounds
(SRTPs + functor encodings) for the HKT-like patterns the
HKT-MDM ontology needs. After the F#-compiler-fork adds real
HKT over Clifford (per `memory/feedback_aaron_dbpedia_is_free_master_data_*.md`),
type-provider authoring becomes substantially cleaner.

## Implementation outline (Path B)

### Foundation library choice

| Library | Pros | Cons |
|---|---|---|
| **dotNetRDF 3.x** (active Feb 2026) | Most mature; RDF-Star + SPARQL-Star; broad RDF feature support | Larger API surface |
| **RDFSharp 3.23.0** (active March 2026) | Lightweight; clean API; semantic-web focused | Less coverage of RDF-Star |

ADR-grade choice owed during execution.

### F# computation expression layer

Wrap chosen library with F# CE for SPARQL query authoring:

```fsharp
// Pseudo-substrate — actual API per chosen library
let query = sparql {
    prefix "dbo" "http://dbpedia.org/ontology/"
    prefix "dbr" "http://dbpedia.org/resource/"
    select ["name"; "birth"; "occupation"]
    where (fun person ->
        person |> isA "dbo:Person"
        person |> hasProp "dbo:birthDate" "birth"
        person |> hasProp "dbo:name" "name"
    )
}

let results = query |> DBpedia.run
```

### HKT-MDM ontology binding

DBpedia entities → factory HKT `M<'T>` substrate (per PR
\#2913):

- `M<Person>` parametric over Person entity type
- `M<Organization>` parametric over Organization
- `M<Event>` parametric over Event
- DV2.0 hub-satellite partition (PR #2915):
  - Hubs: stable Wikipedia article IDs
  - Satellites: revision-versioned attributes

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

1. **Prior-art search**:
   - Original archived F# DBpedia type provider source (for
     ontology insights, not implementation reuse)
   - dotNetRDF `SparqlQueryClient` API
   - RDFSharp client wrappers
   - Existing F# computation expression patterns in `Zeta.*`
   - Soraya formal-verification portfolio for SPARQL-query
     safety properties

2. **Dependency restructure** — walk composes_with chain:
   - 081KQ3HBZ0008QG0R000Q4Y00F (universal-business-templates — Path B IS the
     canonical demo for this)
   - PR #2913 (HKT-MDM universality)
   - PR #2924 (Aurora pitch master-data scope)
   - PR #2915 (DV2.0 wake-time rule — partition by change-rate
     informs DBpedia hub-vs-satellite design)

3. **Per-task scope decisions**:
   - Read-only first; write-back to DBpedia is out-of-scope
   - SPARQL query construction via F# CE
   - Entity → HKT-MDM ontology binding
   - Optional: result-caching layer for substrate-engineering
     reproducibility
   - Demo project showing master-data querying

4. **Soraya consultation** for SPARQL-query type-safety
   properties + formal verification scope

## What this row does NOT commit to

- **NOT Path A** — type provider resurrection is separate
  backlog row (deferred until F# fork)
- **NOT P0** — backlog priority among other strategic substrate
  work
- **NOT a write-API to DBpedia** — read-only scope
- **NOT a F# fork** — Path A's prerequisite is its own multi-
  year undertaking

## Definition of done

- Working F# CE for SPARQL querying DBpedia
- Demo project showing master-data ontology binding
- Test coverage at query + HKT-binding scope
- Composes with 081KQ3HBZ0008QG0R000Q4Y00F universal-business-templates substrate
- ADR recording the dotNetRDF-vs-RDFSharp choice + future-Path-A-
  after-F#-fork transition plan

## Why P1

- Composes with 081KQ3HBZ0008QG0R000Q4Y00F (universal-business-templates already
  backlogged)
- Strategic-substrate (per PR #2902 Otto strategic encryption
  authority) — DBpedia demo is HIGH-VISIBILITY factory work
- Composes with Aurora pitch deployment (PR #2924)
- Aaron has explicitly named the work
- Unblockable NOW (no compiler fork prerequisite)

## Future Path A backlog row (separate)

When F#-compiler-fork-for-AI-safety substrate matures (real
HKT over Clifford), open a separate backlog row for:

- Resurrect F# DBpedia type provider on `FSharp.TypeProviders.SDK`
- Foundation: Don Syme's
  [`fsprojects/FSharp.TypeProviders.SDK`](https://github.com/fsprojects/FSharp.TypeProviders.SDK)
- Substrate-fit: BEST after fork — `M<'T>` real-HKT
  parametric over DBpedia entity types with compile-time
  Clifford-grade type-checking
- Composes with this row's direct-API substrate (transition
  path documented in this row's ADR)

## Decomposition (Otto, 2026-05-14)

This row was too broad to implement atomically. Decomposed into 5 dependency-ordered
child rows:

| Row | Title | Type | Depends on |
|-----|-------|------|------------|
| [081KRHWGX0008QG0R00187PQGZ](081KRHWGX0008QG0R00187PQGZ-dbpedia-library-choice-adr-prior-art-audit-2026-05-14.md) | Library-choice ADR + prior-art audit | research (gate) | — |
| [081KRHWGX0008QG0R003MTMBGR](081KRHWGX0008QG0R003MTMBGR-dbpedia-fsharp-project-scaffold-nuget-connectivity-2026-05-14.md) | F# project scaffold + NuGet + connectivity smoke | feature | 081KRHWGX0008QG0R00187PQGZ |
| [081KRHWGX0008QG0R001VKR0TH](081KRHWGX0008QG0R001VKR0TH-dbpedia-sparql-fsharp-ce-computation-expression-2026-05-14.md) | SPARQL F# computation expression | feature | 081KRHWGX0008QG0R003MTMBGR |
| [081KRHWGX0008QG0R002GFSJC6](081KRHWGX0008QG0R002GFSJC6-dbpedia-hkt-mdm-entity-bindings-dv2-hub-satellite-2026-05-14.md) | HKT-MDM entity bindings + DV2.0 hub-satellite | feature | 081KRHWGX0008QG0R001VKR0TH |
| [081KRHWGX0008QG0R002TYF2NM](081KRHWGX0008QG0R002TYF2NM-dbpedia-end-to-end-demo-project-2026-05-14.md) | End-to-end demo project (closes 081KRFA460008QG0R0018SN61J) | feature | 081KRHWGX0008QG0R002GFSJC6 |

**Work on 081KRHWGX0008QG0R00187PQGZ first.** All subsequent rows depend on the library-choice ADR.

## Composes with

- 081KQ3HBZ0008QG0R000Q4Y00F (universal-company-government-information-substrate)
- 081KRFA460008QG0R000VKJF0H (Axis 3 — Code/English split; this is Code-side
  substrate)
- 081KRFA460008QG0R0007RWSN1 (Axis 2 — Mirror/Beacon; this is Beacon-tier as it
  ships)
- 081KRFA460008QG0R001H98EXJ (Stage 1 factory split — Path B lives in Forge or
  Zeta?)
- PR #2913 / PR #2914 / PR #2915 / PR #2917 / PR #2924
- PR #2892 (KSK — typed-safety motivation composes)
- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md`
- `.claude/rules/dv2-data-split-discipline-activated.md`
  (DBpedia satellites change; hubs stable)
- `algebra-owner` skill (Z-set + Clifford + BP/EP F# substrate)
- Soraya formal-verification authority
