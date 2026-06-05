module Zeta.Tests.SchemaEvolutionTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module SE = Zeta.Core.SchemaEvolution

// ═══════════════════════════════════════════════════════════════════
// Schema evolution (B-0930 seed) — the compatibility proofs that make version-swap-without-
// recompile (zero-downtime) safe. The migration algebra over DynamicValue is proven to honor:
//   • FORWARD compat — an old reader IGNORES unknown fields; migrations that don't touch a
//     field PRESERVE it (the extensible-data passthrough).
//   • BACKWARD compat — a new reader SUPPLIES a default for an absent field (addField).
//   • migration chains COMPOSE; field ops are involutive/idempotent where they should be.
// ═══════════════════════════════════════════════════════════════════

// ── generator: DynamicValue.Object with DISTINCT keys from a fixed alphabet (a..e) ──
let private genSimple : Gen<DynamicValue> =
    Gen.oneof
        [ Gen.constant DynamicValue.Null
          Gen.elements [ true; false ] |> Gen.map DynamicValue.Bool
          Gen.choose (-1000, 1000) |> Gen.map (int64 >> DynamicValue.Int)
          Gen.elements [ "x"; "y"; "z"; "" ] |> Gen.map DynamicValue.String ]

let private genObj : Gen<DynamicValue> =
    gen {
        let! keys = Gen.elements [ []; [ "a" ]; [ "a"; "b" ]; [ "a"; "b"; "c" ]; [ "b"; "c" ]; [ "a"; "c"; "d"; "e" ] ]
        let! vals = Gen.listOfLength (List.length keys) genSimple
        return DynamicValue.Object(List.zip keys vals)
    }

type ObjArb() =
    static member O() = Arb.fromGen genObj

// "zzz" is never in the a..e key alphabet → a safe "new field" the old shape lacks.
let private NEW = "zzz"
let private DEF = DynamicValue.Int 42L

let private keysOf =
    function
    | DynamicValue.Object kvs -> kvs |> List.map fst |> Set.ofList
    | _ -> Set.empty

// ── FORWARD compatibility: old reader drops the field it doesn't know → recovers the original ──

[<Property(Arbitrary = [| typeof<ObjArb> |])>]
let ``Schema: old reader ignoring a new field recovers the original (forward compat)`` (v: DynamicValue) =
    // add a v(N+1) field, then the old reader (which doesn't know NEW) drops it → original back.
    SE.removeField NEW (SE.addField NEW DEF v) = v

[<Property(Arbitrary = [| typeof<ObjArb> |])>]
let ``Schema: a migration that adds a field PRESERVES every other field (extensible-data passthrough)`` (v: DynamicValue) =
    // the original keys' values survive unchanged through addField (the unknown/extra data is preserved).
    SE.project (keysOf v) (SE.addField NEW DEF v) = v

// ── BACKWARD compatibility: new reader supplies a default for the absent field ──

[<Property(Arbitrary = [| typeof<ObjArb> |])>]
let ``Schema: new reader supplies a default for an absent field (backward compat)`` (v: DynamicValue) =
    match SE.addField NEW DEF v with
    | DynamicValue.Object kvs -> (kvs |> List.tryFind (fun (k, _) -> k = NEW)) = Some(NEW, DEF)
    | _ -> true // non-object passes through

[<Property(Arbitrary = [| typeof<ObjArb> |])>]
let ``Schema: addField is idempotent (re-applying the default never overwrites an existing value)`` (v: DynamicValue) =
    SE.addField NEW DEF (SE.addField NEW DEF v) = SE.addField NEW DEF v

// ── field-rename is involutive (lossless) ──

[<Property(Arbitrary = [| typeof<ObjArb> |])>]
let ``Schema: renameField is involutive when the target key is fresh (lossless rename)`` (v: DynamicValue) =
    // rename a -> zzz then zzz -> a recovers the original (v never contains zzz).
    SE.renameField NEW "a" (SE.renameField "a" NEW v) = v

// ── migration chains compose ──

let private m12 : SE.Migration = { From = 1; To = 2; Up = SE.addField "f2" (DynamicValue.Int 0L) }
let private m23 : SE.Migration = { From = 2; To = 3; Up = SE.addField "f3" (DynamicValue.String "") }
let private regstry = [ m12; m23 ]

[<Property(Arbitrary = [| typeof<ObjArb> |])>]
let ``Schema: migrate v1->v3 equals composing v1->v2 then v2->v3`` (v: DynamicValue) =
    let direct = SE.migrate regstry 1 3 v
    let stepwise = SE.migrate regstry 1 2 v |> Result.bind (SE.migrate regstry 2 3)
    direct = stepwise

[<Fact>]
let ``Schema: migrate applies the registered chain and reports a missing step`` () =
    let v = DynamicValue.Object [ "a", DynamicValue.Int 1L ]
    match SE.migrate regstry 1 3 v with
    | Ok (DynamicValue.Object kvs) ->
        Assert.Contains(("a", DynamicValue.Int 1L), kvs) // original preserved
        Assert.Contains(("f2", DynamicValue.Int 0L), kvs) // v2 field added
        Assert.Contains(("f3", DynamicValue.String ""), kvs) // v3 field added
    | other -> failwithf "expected migrated object, got %A" other
    // a missing step is a clean Error, not an exception
    match SE.migrate [ m12 ] 1 3 v with
    | Error _ -> ()
    | Ok _ -> failwith "expected Error for the missing 2->3 migration"
    // downgrade is rejected in the seed
    match SE.migrate regstry 3 1 v with
    | Error _ -> ()
    | Ok _ -> failwith "expected Error for downgrade"

[<Fact>]
let ``Schema: zero-downtime scenario — v1 data is readable by a v3 consumer, v3 data by a v1 consumer`` () =
    // A v1 producer's value, read by a v3 consumer: migrate up, the new fields get defaults.
    let v1 = DynamicValue.Object [ "id", DynamicValue.Int 7L ]
    let asV3 = SE.migrate regstry 1 3 v1
    Assert.True(
        (match asV3 with
         | Ok (DynamicValue.Object kvs) ->
             kvs |> List.exists (fun (k, _) -> k = "f2") && kvs |> List.exists (fun (k, _) -> k = "f3")
         | _ -> false))
    // A v3 producer's value, read by a v1 consumer that only knows {id}: it projects to what it
    // knows and IGNORES f2/f3 (forward compat) — the extra data round-trips untouched if re-emitted.
    let v3 = DynamicValue.Object [ "id", DynamicValue.Int 9L; "f2", DynamicValue.Int 0L; "f3", DynamicValue.String "" ]
    Assert.Equal(DynamicValue.Object [ "id", DynamicValue.Int 9L ], SE.project (Set.ofList [ "id" ]) v3)
