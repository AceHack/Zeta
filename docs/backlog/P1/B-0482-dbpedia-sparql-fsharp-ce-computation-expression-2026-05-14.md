---
id: B-0482
zetaid: 081KRHWGX0008QG0R001VKR0TH
priority: P1
status: open
title: "DBpedia B-0428.3 — SPARQL F# computation expression (query authoring CE)"
type: feature
origin: B-0428 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0428
depends_on:
  - B-0481
composes_with:
  - B-0428
  - B-0481
  - B-0483
  - B-0484
  - src/Core/Dsl.fs
  - .claude/rules/fsharp-anchor-dotnet-build-sanity-check.md
---

# B-0482 — SPARQL F# computation expression

**Depends on B-0481 (project + NuGet must be in place).**

## Purpose

Implement a `sparql { }` F# computation expression that lets callers author
SPARQL SELECT queries in a typed, composable way — without raw string
manipulation. This is the core CE row; all HKT-MDM bindings (B-0483) and the
demo (B-0484) consume this layer.

## F# anchor

The `CircuitBuilder` in `src/Core/Dsl.fs` is the reference implementation.
Key properties to mirror:

- CE type is a delegate/reader over the endpoint context (analogous to
  `CircuitM<'T> = delegate of Circuit -> 'T`)
- All builder methods are `inline` with `[<InlineIfLambda>]` where applicable
- Public surface returns `Result<_, DbspError>` — no exceptions on hot paths

## Implementation outline

### `Sparql.fs` — query model types

```fsharp
module Zeta.DBpedia.Sparql

type Prefix = { Alias: string; Uri: string }

type SelectVar = string

type WhereClause =
    | IsA        of subject: string * rdfType: string
    | HasProp    of subject: string * prop: string * var: string
    | Filter     of expr: string

type SparqlQuery = {
    Prefixes  : Prefix list
    Variables : SelectVar list
    Where     : WhereClause list
}
```

### `SparqlBuilder.fs` — CE builder

```fsharp
module Zeta.DBpedia.SparqlBuilder

open Zeta.DBpedia.Sparql

// Accumulator threaded through the CE
type QueryState = { Prefixes: Prefix list; Vars: SelectVar list; Where: WhereClause list }

type SparqlM<'T> = QueryState -> QueryState * 'T

[<Sealed>]
type SparqlBuilder() =
    member _.Yield(()) = fun s -> s, ()
    member _.Return(x) = fun s -> s, x
    // prefix, select, where, filter operations
    member _.prefix alias uri : SparqlM<unit> = ...
    member _.select vars       : SparqlM<unit> = ...
    member _.where clause      : SparqlM<unit> = ...

let sparql = SparqlBuilder()
```

### `QueryRenderer.fs` — SparqlQuery → string

Renders a `SparqlQuery` to a SPARQL 1.1 SELECT string. Pure function; no I/O.
This is the primary unit-testable surface.

### Integration with `Client.fs` (from B-0481)

```fsharp
let run (endpoint: Endpoint) (query: SparqlQuery) : Result<SparqlResult list, DbspError> =
    query |> QueryRenderer.render |> Client.query endpoint
```

## Tests (`tests/DBpedia.Tests/SparqlCeTests.fs`)

All tests are **pure** (no network): render a query and assert the SPARQL
string. Example:

```fsharp
[<Fact>]
let ``sparql CE produces correct PREFIX and SELECT`` () =
    let q = sparql {
        prefix "dbo" "http://dbpedia.org/ontology/"
        select ["?name"]
        where (IsA ("?person", "dbo:Person"))
    }
    let s = QueryRenderer.render q
    test <@ s.Contains "PREFIX dbo:" @>
    test <@ s.Contains "SELECT ?name" @>
```

At minimum:

- PREFIX rendering test
- SELECT variable test
- WHERE clause (IsA, HasProp, Filter) tests
- Round-trip: render → parse → render produces identical string (if library
  provides a parser; else skip)

## Build gate

```bash
dotnet build -c Release   # 0 warnings 0 errors
dotnet test  Zeta.sln -c Release
```

## Definition of done

- [ ] `Sparql.fs` (query model) in `src/DBpedia/`
- [ ] `SparqlBuilder.fs` (CE builder) in `src/DBpedia/`
- [ ] `QueryRenderer.fs` (pure renderer) in `src/DBpedia/`
- [ ] `SparqlCeTests.fs` in `tests/DBpedia.Tests/` with ≥ 4 tests
- [ ] All tests pure (no network required)
- [ ] `dotnet build -c Release` — 0 warnings 0 errors
- [ ] `dotnet test Zeta.sln -c Release` — all tests green
- [ ] B-0483 can begin immediately after this merges
- [ ] B-0482 status set to `closed`

## F# anchor check

`dotnet build` IS the sanity check that the CE types compose correctly.
Per `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md`: build
passing = type-level claims validated.
