module Zeta.Tests.GeneratorCatalogTests

// SQL over the generator catalog (ferry 37 — "we just need the SQL"): the relational query
// surface over GeneratorRegistry, scoped to Ilyana's v1 review (PR #8013). Total functions,
// ordinal comparison, the registry as a relation, Row WRAPS Entry (no field copy / no drift).

open global.Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Core

[<Fact>]
let ``categoryOf takes the dotted prefix, ordinal; no-dot names are their own category`` () =
    Assert.Equal("shape", GeneratorCatalog.categoryOf "shape.braid")
    Assert.Equal("algebra", GeneratorCatalog.categoryOf "algebra.mod2")
    Assert.Equal("kernel", GeneratorCatalog.categoryOf "kernel.rbf")
    Assert.Equal("loner", GeneratorCatalog.categoryOf "loner") // no dot → whole name

[<Fact>]
let ``FROM: every registry entry becomes exactly one row, carrying the Entry (not copying it)`` () =
    Assert.Equal(List.length GeneratorRegistry.known, List.length GeneratorCatalog.rows)
    for e in GeneratorRegistry.known do
        let row = GeneratorCatalog.rows |> List.find (fun r -> r.Entry.Name = e.Name && r.Entry.Version = e.Version)
        Assert.Equal(e, row.Entry) // wraps the exact Entry — Entry-growth flows through for free
        Assert.Equal(GeneratorCatalog.categoryOf e.Name, row.Category)

[<Fact>]
let ``SELECT DISTINCT category is ordinal-sorted and includes the known kinds`` () =
    let cats = GeneratorCatalog.categories
    Assert.Equal<string list>(List.sortWith (fun a b -> System.String.CompareOrdinal(a, b)) cats, cats)
    Assert.Equal<string list>(List.distinct cats, cats)
    for expected in [ "shape"; "algebra"; "boundary"; "shader"; "audio"; "engine" ] do
        Assert.Contains(expected, cats)

[<Fact>]
let ``WHERE category = shape returns only shape.* generators, and finds the braid`` () =
    let shapes = GeneratorCatalog.byCategory "shape"
    Assert.NotEmpty(shapes)
    Assert.All(shapes, fun r -> Assert.Equal("shape", r.Category))
    Assert.Contains("shape.braid", shapes |> List.map (fun r -> r.Entry.Name))

[<Fact>]
let ``the SELECT→unfold path: byCategory |> map zetaId matches the registry's ids for those names`` () =
    // the consumer-composed unfold path (Ilyana cut the named zetaIdsInCategory in favour of map)
    for r in GeneratorCatalog.byCategory "shape" do
        Assert.Equal(GeneratorRegistry.idOf r.Entry.Name r.Entry.Version, r.Entry.ZetaId)

[<Fact>]
let ``inCategory is ordinal: case matters`` () =
    Assert.NotEmpty(GeneratorCatalog.where (GeneratorCatalog.inCategory "shape"))
    Assert.Empty(GeneratorCatalog.where (GeneratorCatalog.inCategory "SHAPE")) // ordinal — no case fold

[<Property>]
let ``every row's category is the prefix of its name (the projection is faithful)`` (i: int) =
    let rs = GeneratorCatalog.rows
    if List.isEmpty rs then true
    else
        let r = rs.[((i % rs.Length) + rs.Length) % rs.Length]
        r.Entry.Name.StartsWith(r.Category, System.StringComparison.Ordinal)

[<Property>]
let ``where composes from inCategory + a consumer predicate (the WHERE vocabulary)`` (v: int) =
    let cat = "shape"
    let both = GeneratorCatalog.where (fun r -> GeneratorCatalog.inCategory cat r && r.Entry.Version = v)
    both |> List.forall (fun r -> r.Category = cat && r.Entry.Version = v)
