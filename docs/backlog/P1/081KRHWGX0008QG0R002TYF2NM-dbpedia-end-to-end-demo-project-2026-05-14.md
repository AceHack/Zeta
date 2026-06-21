---
id: 081KRHWGX0008QG0R002TYF2NM
priority: P1
status: open
title: "DBpedia 081KRFA460008QG0R0018SN61J.5 — end-to-end demo project + integration test"
type: feature
origin: 081KRFA460008QG0R0018SN61J decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R0018SN61J
depends_on:
  - 081KRHWGX0008QG0R002GFSJC6
composes_with:
  - 081KRFA460008QG0R0018SN61J
  - 081KRHWGX0008QG0R002GFSJC6
  - 081KQ3HBZ0008QG0R000Q4Y00F
  - docs/backlog/P3/081KQ3HBZ0008QG0R000Q4Y00F-universal-company-government-information-substrate.md
  - memory/feedback_aaron_dbpedia_is_free_master_data_human_curated_fsharp_type_provider_archived_resurrect_for_hkt_mdm_canonical_demo_fork_fsharp_compiler_for_ai_safety_real_hkt_over_clifford_2026_05_13.md
---

# 081KRHWGX0008QG0R002TYF2NM — DBpedia end-to-end demo project

**Depends on 081KRHWGX0008QG0R002GFSJC6 (HKT-MDM bindings must exist). Closes 081KRFA460008QG0R0018SN61J.**

## Purpose

Wire together the full stack built in 081KRHWGX0008QG0R003MTMBGR..081KRHWGX0008QG0R002GFSJC6 into an end-to-end
demo that:

1. Constructs a SPARQL query using the `sparql { }` CE
2. Executes against DBpedia (live or recorded per ADR strategy)
3. Binds results to HKT-MDM entities (hub + satellite)
4. Demonstrates the DV2.0 hub-satellite separation visibly

This is the "definition of done" deliverable for 081KRFA460008QG0R0018SN61J and the canonical
demo that composes with 081KQ3HBZ0008QG0R000Q4Y00F (universal-business-templates).

## Demo shape

A console app or xUnit integration test — whichever the ADR CI strategy
implies is more appropriate.

### Preferred: xUnit integration test (recorded fixture)

```fsharp
// tests/DBpedia.Tests/DemoIntegrationTests.fs
[<Trait("Category", "Integration")>]
module DemoIntegrationTests

[<Fact>]
let ``DBpedia master-data demo — persons with birthDate`` () =
    let query =
        sparql {
            prefix "dbo" "http://dbpedia.org/ontology/"
            prefix "rdfs" "http://www.w3.org/2000/01/rdf-schema#"
            select ["?person"; "?name"; "?birth"]
            where (IsA ("?person", "dbo:Person"))
            where (HasProp ("?person", "rdfs:label", "?name"))
            where (HasProp ("?person", "dbo:birthDate", "?birth"))
            where (Filter "LANG(?name) = 'en'")
        }
    let result = query |> DBpedia.run Client.dbpedia
    match result with
    | Ok entities ->
        entities |> List.iter (fun sat ->
            printfn "Hub: %A  Name: %s  Born: %A" sat.Hub sat.Name sat.BirthDate)
        Assert.True(List.length entities > 0)
    | Error e ->
        Assert.True(false, $"Query failed: {e}")
```

### Required output visible in CI / test output

```
Hub: PersonHub "http://dbpedia.org/resource/Alan_Turing"
     Name: "Alan Turing"  Born: Some 1912-06-23
     (DV2.0 satellite — attributes; Hub = stable Wikipedia URI)
```

The comment in the output (or in the test's assertion message) must explicitly
name the DV2.0 hub-satellite split so it reads as a canonical demo.

### ADR appendix update

Add a section to the ADR from 081KRHWGX0008QG0R00187PQGZ:

```markdown
## Path-A transition plan

After the F#-compiler-fork-for-AI-safety ships real HKT over Clifford:

1. Generate a type provider on `FSharp.TypeProviders.SDK` targeting DBpedia's
   SPARQL endpoint.
2. Replace `SparqlBuilder.fs` CE with compile-time `dbpedia.Person` /
   `dbpedia.Organization` type provider projections.
3. The `Entities.fs` hub-satellite types stay unchanged — the DV2.0 partition
   is library-agnostic.
4. Migration guide: swap `open Zeta.DBpedia.SparqlBuilder` → `open DBpedia.TP`.
```

## Composes-with 081KQ3HBZ0008QG0R000Q4Y00F check

Read `docs/backlog/P3/081KQ3HBZ0008QG0R000Q4Y00F-*.md` and verify:

- The demo query (persons / organizations) overlaps with 081KQ3HBZ0008QG0R000Q4Y00F's
  "universal company + government information substrate" scope
- Add a pointer from 081KQ3HBZ0008QG0R000Q4Y00F to 081KRHWGX0008QG0R002TYF2NM in `composes_with:` on both rows
- Write one sentence in the demo comment: _"DBpedia master data — canonical
  demonstration for 081KQ3HBZ0008QG0R000Q4Y00F universal-business-templates"_

## Build gate

```bash
dotnet build -c Release   # 0 warnings 0 errors
dotnet test  Zeta.sln -c Release
```

CI runs `dotnet test Zeta.sln -c Release` with no category filter — every
test (including `[<Trait("Category", "Integration")>]` tests) runs by default.
The recorded fixture path is therefore required for CI safety: it replays a
captured response without network access. The live-endpoint fallback requires
an explicit workflow change (add `--filter "Category!=Integration"` to both
`gate.yml` and `low-memory.yml`) before it may be used.

## Definition of done

- [ ] End-to-end demo test in `tests/DBpedia.Tests/DemoIntegrationTests.fs`
- [ ] Demo test passes with recorded fixture or live endpoint per ADR
- [ ] Output visibly labels hub and satellite with DV2.0 language
- [ ] ADR from 081KRHWGX0008QG0R00187PQGZ updated with Path-A transition plan section
- [ ] 081KQ3HBZ0008QG0R000Q4Y00F `composes_with:` backfilled with 081KRHWGX0008QG0R002TYF2NM pointer
- [ ] `dotnet build -c Release` — 0 warnings 0 errors
- [ ] `dotnet test Zeta.sln -c Release` — all tests green
- [ ] 081KRFA460008QG0R0018SN61J status updated to `closed` with PR link
- [ ] 081KRHWGX0008QG0R002TYF2NM status set to `closed`

## Why P1 / closes 081KRFA460008QG0R0018SN61J

081KRHWGX0008QG0R002TYF2NM is the only row that produces the externally-visible demo Aaron
named ("DBpedia HKT-MDM canonical demo"). Without it the four implementation
rows don't constitute a "canonical demo" — they're plumbing. This row
stitches them together and closes the parent row.
