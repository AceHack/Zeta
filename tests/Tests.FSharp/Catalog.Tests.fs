module Zeta.Tests.CatalogTests

open global.Xunit
open Zeta.Core
open Zeta.Core.TableStream
open Zeta.Core.Catalog

let private schema1: Schema =
    [ "users", [ "id", "int"; "name", "text" ] ]

[<Fact>]
let ``ensure on empty catalog: CREATE TABLE collapses to DML upserts`` () =
    let deltas = ensure schema1 emptyTable
    // table row + 2 column rows, all Upserts (no DDL — just DML)
    Assert.Equal<Delta list>(
        [ Upsert("column:users.id", "int"); Upsert("column:users.name", "text"); Upsert("table:users", "1") ],
        deltas
    )

[<Fact>]
let ``ensure is idempotent: re-ensuring a satisfied schema yields [] (apply-N == apply-once)`` () =
    let cat = evolve schema1 emptyTable
    Assert.Equal<Delta list>([], ensure schema1 cat)

[<Fact>]
let ``ALTER (add column) is an Upsert; automatic evolution as a DU over DML`` () =
    let cat = evolve schema1 emptyTable
    let schema2: Schema = [ "users", [ "id", "int"; "name", "text"; "email", "text" ] ]
    Assert.Equal<Delta list>([ Upsert("column:users.email", "text") ], ensure schema2 cat)

[<Fact>]
let ``ALTER (change column type) is an Upsert of the changed row`` () =
    let cat = evolve schema1 emptyTable
    let schema2: Schema = [ "users", [ "id", "bigint"; "name", "text" ] ]
    Assert.Equal<Delta list>([ Upsert("column:users.id", "bigint") ], ensure schema2 cat)

[<Fact>]
let ``DROP column is a Retract`` () =
    let cat = evolve schema1 emptyTable
    let schema2: Schema = [ "users", [ "id", "int" ] ] // dropped name
    Assert.Equal<Delta list>([ Retract "column:users.name" ], ensure schema2 cat)

[<Fact>]
let ``DROP table retracts the table row and its columns`` () =
    let cat = evolve schema1 emptyTable
    Assert.Equal<Delta list>(
        [ Retract "column:users.id"; Retract "column:users.name"; Retract "table:users" ],
        ensure [] cat
    )

[<Fact>]
let ``evolve reaches the desired schema; readSchema round-trips`` () =
    let cat = evolve schema1 emptyTable
    Assert.Equal<Schema>(schema1, readSchema cat)

[<Fact>]
let ``full lifecycle: create -> alter -> drop, each via DML deltas, readSchema reflects`` () =
    let s1: Schema = [ "t", [ "a", "int" ] ]
    let s2: Schema = [ "t", [ "a", "int"; "b", "text" ] ]
    let c1 = evolve s1 emptyTable
    let c2 = evolve s2 c1
    Assert.Equal<Schema>(s2, readSchema c2)
    let c3 = evolve [] c2 // drop everything
    Assert.Equal<Schema>([], readSchema c3)
