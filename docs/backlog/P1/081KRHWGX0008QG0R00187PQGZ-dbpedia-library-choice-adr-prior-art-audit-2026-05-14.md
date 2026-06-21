---
id: 081KRHWGX0008QG0R00187PQGZ
priority: P1
status: open
title: "DBpedia 081KRFA460008QG0R0018SN61J.1 — library-choice ADR (dotNetRDF vs RDFSharp) + prior-art audit"
type: research
origin: 081KRFA460008QG0R0018SN61J decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R0018SN61J
depends_on: []
composes_with:
  - 081KRFA460008QG0R0018SN61J
  - 081KRHWGX0008QG0R003MTMBGR
  - 081KRHWGX0008QG0R001VKR0TH
  - 081KRHWGX0008QG0R002GFSJC6
  - 081KRHWGX0008QG0R002TYF2NM
  - docs/backlog/P3/081KQ3HBZ0008QG0R000Q4Y00F-universal-company-government-information-substrate.md
  - memory/feedback_aaron_dbpedia_is_free_master_data_human_curated_fsharp_type_provider_archived_resurrect_for_hkt_mdm_canonical_demo_fork_fsharp_compiler_for_ai_safety_real_hkt_over_clifford_2026_05_13.md
---

# 081KRHWGX0008QG0R00187PQGZ — DBpedia library-choice ADR + prior-art audit

**Gate row for 081KRHWGX0008QG0R003MTMBGR..081KRHWGX0008QG0R002TYF2NM.** No code is written until this row closes.

## Purpose

1. Survey all prior-art in the codebase relevant to 081KRFA460008QG0R0018SN61J (F# CE patterns,
   existing SPARQL/RDF substrate, 081KQ3HBZ0008QG0R000Q4Y00F scope).
2. Choose between **dotNetRDF 3.x** and **RDFSharp 3.x** via an ADR.
3. Document the Path-A (type-provider) transition plan in the same ADR so
   future work knows the intended upgrade path.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] Survey existing F# CE patterns in `src/Core/Dsl.fs` (CircuitBuilder model)
- [ ] Check `Directory.Packages.props` for any existing RDF/SPARQL packages
- [ ] Read 081KQ3HBZ0008QG0R000Q4Y00F to confirm demo scope alignment
- [ ] Walk `composes_with:` chain (081KRFA460008QG0R0018SN61J, 081KQ3HBZ0008QG0R000Q4Y00F, PR #2913, PR #2915)
- [ ] Otto-364: WebSearch current NuGet download counts + GitHub star counts for
      both libraries before asserting recency

## Prior-art surfaces to audit

| Surface | Path | What to verify |
|---------|------|----------------|
| F# CE model | `src/Core/Dsl.fs` | CircuitBuilder pattern — applies to SparqlBuilder |
| Package manifest | `Directory.Packages.props` | Confirm no RDF packages already present |
| 081KQ3HBZ0008QG0R000Q4Y00F parent | `docs/backlog/P3/081KQ3HBZ0008QG0R000Q4Y00F-*.md` | Scope of universal-business-templates |
| PR #2913 | GitHub | HKT-MDM universality — confirm `M<'T>` substrate shape |
| DV2.0 rule | `.claude/rules/dv2-data-split-discipline-activated.md` | Hub-satellite partition applies |
| Aaron's DBpedia memory | `memory/feedback_aaron_dbpedia_is_free_master_data_*.md` | Confirm Path A vs Path B ordering |

## Evaluation criteria for library choice

| Criterion | dotNetRDF 3.x | RDFSharp 3.x |
|-----------|---------------|--------------|
| Last NuGet publish | Verify via search | Verify via search |
| CI offline capability | Needs recording or mocking | Needs recording or mocking |
| SPARQL 1.1 query support | Yes | Yes |
| RDF-Star support | Yes (claimed) | Partial |
| API surface size | Large | Small/focused |
| F# ergonomics | Verify | Verify |

**Use Otto-364 WebSearch to verify current NuGet activity before asserting.**

## ADR output

Path: `docs/DECISIONS/2026-05-14-dbpedia-library-choice-dotnetrdf-vs-rdfsharp.md`

Must include:

1. Decision: which library, version pinned
2. Rationale (table above filled in with current data)
3. CI strategy: how SPARQL queries are tested in CI (live endpoint / recorded
   fixture / mock; offline-first preferred per `dotnet test` isolation requirement)
4. Path-A transition plan: when F# compiler fork lands, how to migrate from
   direct-API CE (081KRHWGX0008QG0R001VKR0TH) to a proper type provider
5. Where in the solution the new project lives: `src/DBpedia/` under `Zeta.sln`

## Definition of done

- [ ] ADR written and merged at canonical path above
- [ ] CI strategy decision recorded in ADR
- [ ] Path-A transition plan recorded in ADR
- [ ] `composes_with:` pointers backfilled on 081KRFA460008QG0R0018SN61J and 081KQ3HBZ0008QG0R000Q4Y00F
- [ ] 081KRHWGX0008QG0R003MTMBGR can begin immediately after this merges (no remaining blockers)
- [ ] 081KRHWGX0008QG0R00187PQGZ status set to `closed`

## Why P1 / gate

All four implementation rows (081KRHWGX0008QG0R003MTMBGR..081KRHWGX0008QG0R002TYF2NM) depend on the library
choice. Executing the ADR first prevents throwaway implementation work
if the library choice flips mid-stream.
