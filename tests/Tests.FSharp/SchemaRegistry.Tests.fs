module Zeta.Tests.SchemaRegistryTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core
open Zeta.Tests.Support

module SR = Zeta.Core.SchemaRegistry

// ═══════════════════════════════════════════════════════════════════
// SchemaRegistry (081KSRGFP0008QG0R001Y6RTY9 slice) — the schemas-as-rows catalog on the SchemaEvolution seed.
// Headline proof: the registry is itself a DynamicValue that round-trips through the proven
// JSON/CBOR/XML codecs and reconstructs identically (self-describing schemas-as-rows). Plus:
// runtime migrate-to-consumer-version, clean errors, register upsert.
// ═══════════════════════════════════════════════════════════════════

let private reg : SR.Registry =
    SR.empty
    |> SR.register "user"
        [ { From = 1; To = 2; Ops = [ SR.AddField("email", DynamicValue.String "") ] }
          { From = 2; To = 3; Ops = [ SR.RenameField("name", "fullName"); SR.AddField("age", DynamicValue.Int 0L) ] } ]
    |> SR.register "order" [ { From = 1; To = 2; Ops = [ SR.RemoveField "legacyId" ] } ]

// ── runtime version-swap: a v1 value read by a v3 consumer ──

[<Fact>]
let ``SchemaRegistry: migrate v1 user data up to v3 (add + rename + default)`` () =
    let v1 = DynamicValue.Object [ "name", DynamicValue.String "Ada" ]
    match SR.migrateValue reg "user" 1 3 v1 with
    | Ok (DynamicValue.Object kvs) ->
        let m = Map.ofList kvs
        Assert.Equal(Some(DynamicValue.String "Ada"), Map.tryFind "fullName" m) // renamed from name
        Assert.Equal(Some(DynamicValue.String ""), Map.tryFind "email" m)       // added at v2
        Assert.Equal(Some(DynamicValue.Int 0L), Map.tryFind "age" m)            // added at v3 (default)
        Assert.False(m.ContainsKey "name")                                       // old key gone
    | other -> failwithf "expected migrated object, got %A" other

[<Fact>]
let ``SchemaRegistry: unknown schema / downgrade / missing step are clean Errors (total)`` () =
    let v = DynamicValue.Object [ "name", DynamicValue.String "x" ]
    Assert.True(match SR.migrateValue reg "nope" 1 2 v with Error _ -> true | _ -> false)        // unknown id
    Assert.True(match SR.migrateValue reg "user" 3 1 v with Error _ -> true | _ -> false)         // downgrade
    Assert.True(match SR.migrateValue reg "order" 1 5 v with Error _ -> true | _ -> false)        // missing step

[<Fact>]
let ``SchemaRegistry: register upserts (re-registering a schema replaces its chain)`` () =
    let r2 = reg |> SR.register "user" [ { From = 1; To = 2; Ops = [ SR.AddField("v", DynamicValue.Bool true) ] } ]
    match SR.migrateValue r2 "user" 1 2 (DynamicValue.Object []) with
    | Ok (DynamicValue.Object kvs) -> Assert.Contains(("v", DynamicValue.Bool true), kvs)
    | other -> failwithf "expected upserted schema, got %A" other

// ── ★ schemas-as-rows: the registry is self-describing data ──

[<Fact>]
let ``SchemaRegistry: fromDynamic ∘ toDynamic = id (the registry is round-trippable data)`` () =
    Assert.Equal<Result<SR.Registry, string>>(Ok reg, SR.fromDynamic (SR.toDynamic reg))

[<Fact>]
let ``SchemaRegistry: the catalog rides the proven JSON/CBOR/XML codecs and reconstructs identically`` () =
    let dv = SR.toDynamic reg
    for rt in [ SerializerLegs.jsonRT; SerializerLegs.cborRT; SerializerLegs.xmlRT ] do
        match rt dv with
        | Some dv2 -> Assert.Equal<Result<SR.Registry, string>>(Ok reg, SR.fromDynamic dv2)
        | None -> failwith "registry DynamicValue failed a serializer round-trip"
    // and Arrow too (the .NET columnar leg)
    match SerializerLegs.arrowRT dv with
    | Some dv2 -> Assert.Equal<Result<SR.Registry, string>>(Ok reg, SR.fromDynamic dv2)
    | None -> failwith "registry DynamicValue failed Arrow round-trip"

// ── op interpreter matches the proven SchemaEvolution field ops ──

[<Fact>]
let ``SchemaRegistry: applyOps interprets to the same transform as SchemaEvolution`` () =
    let v = DynamicValue.Object [ "a", DynamicValue.Int 1L ]
    let viaOps = SR.applyOps [ SR.AddField("b", DynamicValue.Int 2L); SR.RenameField("a", "id") ] v
    let viaSE = v |> SchemaEvolution.addField "b" (DynamicValue.Int 2L) |> SchemaEvolution.renameField "a" "id"
    Assert.Equal(viaSE, viaOps)

// ── registry-derived inverses: migrateValueDown (Evolution down-direction over schemas-as-rows) ──

[<Fact>]
let ``SchemaRegistry: migrateValueDown round-trips a lossless (add+rename) schema back to the original`` () =
    let v1 = DynamicValue.Object [ "name", DynamicValue.String "Ada" ]
    let back = SR.migrateValue reg "user" 1 3 v1 |> Result.bind (SR.migrateValueDown reg "user" 3 1)
    Assert.Equal<Result<DynamicValue, string>>(Ok v1, back)

[<Fact>]
let ``SchemaRegistry: migrateValueDown errors on a non-invertible (RemoveField) schema`` () =
    // "order" v1->v2 is a RemoveField (the dropped value is gone) => non-invertible, must error not silently pass.
    let v2 = DynamicValue.Object [ "id", DynamicValue.Int 1L ]
    match SR.migrateValueDown reg "order" 2 1 v2 with
    | Error msg -> Assert.Contains("non-invertible", msg)
    | Ok _ -> Assert.Fail "expected non-invertible error for the RemoveField migration"

[<Fact>]
let ``SchemaRegistry: invertOps reverses order and inverts each op; None if any op is non-invertible`` () =
    Assert.Equal<SR.FieldOp list option>(
        Some [ SR.RemoveField "b"; SR.RenameField("new", "old") ],
        SR.invertOps [ SR.RenameField("old", "new"); SR.AddField("b", DynamicValue.Int 0L) ]
    )
    Assert.Equal<SR.FieldOp list option>(None, SR.invertOps [ SR.RemoveField "x" ])
