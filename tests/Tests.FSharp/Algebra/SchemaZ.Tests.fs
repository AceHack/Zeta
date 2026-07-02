module Zeta.Tests.Algebra.SchemaZTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// SchemaZ — schema-as-events on the Z-set (081KWFXTHJY step 5, slice 1).
// The schema plane is ℤ-weighted algebra: apply = sum, rollback = negate.
// The load-bearing law is the RING THEOREM (s + d) + (−d) = s — quantified
// over arbitrary deltas, it subsumes every per-constructor round-trip test.
// ═══════════════════════════════════════════════════════════════════

let private f name ty = { Name = name; Type = ty }

// Small generators: field ids over a bounded name/type pool so deltas collide
// (colliding keys are where the algebra earns its keep).
type private SchemaArb =
    static member FieldId() =
        gen {
            let! name = Gen.elements [ "a"; "b"; "c"; "d"; "user_id"; "created_at" ]
            let! ty = Gen.elements [ DynamicValueType.Int; DynamicValueType.String; DynamicValueType.Bool ]
            return f name ty
        }
        |> Arb.fromGen

    static member SchemaDelta() =
        gen {
            let! pairs =
                Gen.listOf (
                    gen {
                        let! fid = SchemaArb.FieldId().Generator
                        let! w = Gen.elements [ -2L; -1L; 1L; 2L ]
                        return fid, w
                    }
                )
            return (ZSet.ofSeq pairs: SchemaZ)
        }
        |> Arb.fromGen

// ── The ring theorem ─────────────────────────────────────────────────

[<Property(Arbitrary = [| typeof<SchemaArb> |])>]
let ``ring theorem: rollbackDelta after applyDelta is identity for ANY schema and delta``
    (s: SchemaZ) (d: SchemaZ) =
    SchemaZ.rollbackDelta d (SchemaZ.applyDelta d s) = s

[<Property(Arbitrary = [| typeof<SchemaArb> |])>]
let ``deltas commute: apply order does not matter on the schema plane`` (s: SchemaZ) (d1: SchemaZ) (d2: SchemaZ) =
    SchemaZ.applyDelta d2 (SchemaZ.applyDelta d1 s) = SchemaZ.applyDelta d1 (SchemaZ.applyDelta d2 s)

// ── Constructors mirror the SchemaEvolution smart constructors ───────

[<Fact>]
let ``add then remove of the same field is a schema no-op`` () =
    let s = SchemaZ.ofFields [ f "a" DynamicValueType.Int ]
    let added = SchemaZ.applyDelta (SchemaZ.addFieldDelta "b" DynamicValueType.String) s
    let removed = SchemaZ.applyDelta (SchemaZ.removeFieldDelta "b" DynamicValueType.String) added
    Assert.True((removed = s))

[<Fact>]
let ``rename delta equals remove + add`` () =
    let s = SchemaZ.ofFields [ f "old" DynamicValueType.Int; f "keep" DynamicValueType.Bool ]
    let viaRename = SchemaZ.applyDelta (SchemaZ.renameFieldDelta "old" "new" DynamicValueType.Int) s
    let viaTwo =
        s
        |> SchemaZ.applyDelta (SchemaZ.removeFieldDelta "old" DynamicValueType.Int)
        |> SchemaZ.applyDelta (SchemaZ.addFieldDelta "new" DynamicValueType.Int)
    Assert.True((viaRename = viaTwo))
    Assert.True(SchemaZ.wellFormed viaRename)
    Assert.Equal<FieldId list>(
        [ f "keep" DynamicValueType.Bool; f "new" DynamicValueType.Int ] |> List.sortBy (fun x -> x.Name),
        SchemaZ.fields viaRename |> List.sortBy (fun x -> x.Name))

[<Fact>]
let ``retype is retract + insert — the pair is the identity`` () =
    let s = SchemaZ.ofFields [ f "age" DynamicValueType.String ]
    let retyped =
        SchemaZ.applyDelta (SchemaZ.retypeFieldDelta "age" DynamicValueType.String DynamicValueType.Int) s
    Assert.True(SchemaZ.wellFormed retyped)
    Assert.Equal<FieldId list>([ f "age" DynamicValueType.Int ], SchemaZ.fields retyped)

// ── Integrity as arithmetic ──────────────────────────────────────────

[<Fact>]
let ``duplicate add is DETECTED: weight 2 fails wellFormed, never a silent overwrite`` () =
    let d = SchemaZ.addFieldDelta "a" DynamicValueType.Int
    let s = SchemaZ.empty |> SchemaZ.applyDelta d |> SchemaZ.applyDelta d
    Assert.False(SchemaZ.wellFormed s)

[<Fact>]
let ``remove-before-add is DETECTED: weight -1 fails wellFormed`` () =
    let s = SchemaZ.applyDelta (SchemaZ.removeFieldDelta "ghost" DynamicValueType.Int) SchemaZ.empty
    Assert.False(SchemaZ.wellFormed s)

[<Fact>]
let ``concurrent same-field adds surface as a conflict after merge`` () =
    // Two writers both add "status" (same identity). The merged fold shows
    // weight 2 — a detected conflict, not last-writer-wins.
    let base' = SchemaZ.ofFields [ f "id" DynamicValueType.Int ]
    let w1 = SchemaZ.addFieldDelta "status" DynamicValueType.String
    let w2 = SchemaZ.addFieldDelta "status" DynamicValueType.String
    let merged = base' |> SchemaZ.applyDelta w1 |> SchemaZ.applyDelta w2
    Assert.False(SchemaZ.wellFormed merged)

[<Fact>]
let ``disjoint concurrent changes merge cleanly in either order`` () =
    let base' = SchemaZ.ofFields [ f "id" DynamicValueType.Int ]
    let w1 = SchemaZ.addFieldDelta "email" DynamicValueType.String
    let w2 = SchemaZ.renameFieldDelta "id" "user_id" DynamicValueType.Int
    let ab = base' |> SchemaZ.applyDelta w1 |> SchemaZ.applyDelta w2
    let ba = base' |> SchemaZ.applyDelta w2 |> SchemaZ.applyDelta w1
    Assert.True((ab = ba))
    Assert.True(SchemaZ.wellFormed ab)

// ── The fold: version = prefix ───────────────────────────────────────

[<Fact>]
let ``a schema version is a prefix of the delta stream`` () =
    let deltas =
        [ SchemaZ.addFieldDelta "a" DynamicValueType.Int          // v1
          SchemaZ.addFieldDelta "b" DynamicValueType.String      // v2
          SchemaZ.renameFieldDelta "a" "a2" DynamicValueType.Int // v3
          SchemaZ.removeFieldDelta "b" DynamicValueType.String ] // v4
    let atV n = SchemaZ.fold (List.truncate n deltas) SchemaZ.empty
    Assert.Equal<FieldId list>([ f "a" DynamicValueType.Int ], SchemaZ.fields (atV 1))
    Assert.Equal(2, List.length (SchemaZ.fields (atV 2)))
    Assert.Equal<FieldId list>(
        [ f "a2" DynamicValueType.Int; f "b" DynamicValueType.String ] |> List.sortBy (fun x -> x.Name),
        SchemaZ.fields (atV 3) |> List.sortBy (fun x -> x.Name))
    Assert.Equal<FieldId list>([ f "a2" DynamicValueType.Int ], SchemaZ.fields (atV 4))
    // every prefix of a linear single-writer history is well-formed
    for n in 0 .. 4 do
        Assert.True(SchemaZ.wellFormed (atV n))

// ── MigrationZ: the two planes travel together ───────────────────────

[<Fact>]
let ``MigrationZ carries both planes and they agree on addField`` () =
    let m =
        { SchemaDelta = SchemaZ.addFieldDelta "flag" DynamicValueType.Bool
          Data = SchemaEvolution.addFieldMigration 1 "flag" (DynamicValue.Bool false) }
    // schema plane
    let s = SchemaZ.applyDelta m.SchemaDelta SchemaZ.empty
    Assert.Equal<FieldId list>([ f "flag" DynamicValueType.Bool ], SchemaZ.fields s)
    // data plane (unchanged SchemaEvolution semantics)
    let v = DynamicValue.Object [ "x", DynamicValue.Int 1L ]
    match m.Data.Up v with
    | DynamicValue.Object kvs -> Assert.True(kvs |> List.exists (fun (k, _) -> k = "flag"))
    | _ -> Assert.True(false, "expected Object")
