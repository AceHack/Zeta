---
id: B-0484
zetaid: 081KRHWGX0008QG0R002TYF2NM
priority: P1
status: open
title: "DBpedia B-0428.5 — end-to-end demo project + integration test"
type: feature
origin: B-0428 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0428
depends_on:
  - B-0483
composes_with:
  - B-0428
  - B-0483
  - B-0043
  - docs/backlog/P3/B-0043-universal-company-government-information-substrate.md
  - memory/feedback_aaron_dbpedia_is_free_master_data_human_curated_fsharp_type_provider_archived_resurrect_for_hkt_mdm_canonical_demo_fork_fsharp_compiler_for_ai_safety_real_hkt_over_clifford_2026_05_13.md
---

# B-0484 — DBpedia end-to-end demo project

**Depends on B-0483 (HKT-MDM bindings must exist). Closes B-0428.**

## Purpose

Wire together the full stack built in B-0481..B-0483 into an end-to-end
demo that:

1. Constructs a SPARQL query using the `sparql { }` CE
2. Executes against DBpedia (live or recorded per ADR strategy)
3. Binds results to HKT-MDM entities (hub + satellite)
4. Demonstrates the DV2.0 hub-satellite separation visibly

This is the "definition of done" deliverable for B-0428 and the canonical
demo that composes with B-0043 (universal-business-templates).

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

Add a section to the ADR from B-0480:

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

## Composes-with B-0043 check

Read `docs/backlog/P3/B-0043-*.md` and verify:

- The demo query (persons / organizations) overlaps with B-0043's
  "universal company + government information substrate" scope
- Add a pointer from B-0043 to B-0484 in `composes_with:` on both rows
- Write one sentence in the demo comment: _"DBpedia master data — canonical
  demonstration for B-0043 universal-business-templates"_

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
- [ ] ADR from B-0480 updated with Path-A transition plan section
- [ ] B-0043 `composes_with:` backfilled with B-0484 pointer
- [ ] `dotnet build -c Release` — 0 warnings 0 errors
- [ ] `dotnet test Zeta.sln -c Release` — all tests green
- [ ] B-0428 status updated to `closed` with PR link
- [ ] B-0484 status set to `closed`

## Why P1 / closes B-0428

B-0484 is the only row that produces the externally-visible demo Aaron
named ("DBpedia HKT-MDM canonical demo"). Without it the four implementation
rows don't constitute a "canonical demo" — they're plumbing. This row
stitches them together and closes the parent row.
