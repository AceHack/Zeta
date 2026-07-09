module Zeta.Tests.SchemaEvolutionTests

open System.IO
open System.Reflection
open System.Text.Json
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module SE = Zeta.Core.SchemaEvolution

// ═══════════════════════════════════════════════════════════════════
// Schema evolution (081KSRGFP0008QG0R001Y6RTY9 seed) — the compatibility proofs that make version-swap-without-
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

let private m12 : SE.Migration = SE.addFieldMigration 1 "f2" (DynamicValue.Int 0L)
let private m23 : SE.Migration = SE.addFieldMigration 2 "f3" (DynamicValue.String "")
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

// ── bidirectional migration (the Evolution down-direction; 081KSRGFP0008QG0R001Y6RTY9 extension) ──

[<Fact>]
let ``Schema: migrateDown inverts a lossless addField chain back to the original`` () =
    let v = DynamicValue.Object [ "a", DynamicValue.Int 1L ]
    let up = SE.migrate regstry 1 3 v
    match up with
    | Ok up3 ->
        match SE.migrateDown regstry 3 1 up3 with
        | Ok back -> Assert.Equal<DynamicValue>(v, back) // down(up(x)) = x for lossless add
        | Error e -> Assert.Fail(sprintf "migrateDown failed: %s" e)
    | Error e -> Assert.Fail(sprintf "migrate failed: %s" e)

[<Fact>]
let ``Schema: renameFieldMigration round-trips losslessly via migrateDown`` () =
    let reg = [ SE.renameFieldMigration 1 "old" "new" ]
    let v = DynamicValue.Object [ "old", DynamicValue.Int 7L ]
    let back = SE.migrate reg 1 2 v |> Result.bind (SE.migrateDown reg 2 1)
    Assert.Equal<Result<DynamicValue, string>>(Ok v, back)

[<Fact>]
let ``Schema: removeFieldMigration is LOSSY - down restores the named default, not the original`` () =
    let reg = [ SE.removeFieldMigration 1 "secret" (DynamicValue.String "REDACTED") ]
    let v = DynamicValue.Object [ "secret", DynamicValue.String "hunter2" ]
    let back = SE.migrate reg 1 2 v |> Result.bind (SE.migrateDown reg 2 1)
    // the original value is gone; the down-migration names the loss with the default
    Assert.Equal<Result<DynamicValue, string>>(Ok(DynamicValue.Object [ "secret", DynamicValue.String "REDACTED" ]), back)

[<Fact>]
let ``Schema: a non-invertible migration (Down=None) makes migrateDown error, not silently pass`` () =
    let reg = [ { SE.From = 1; SE.To = 2; SE.Up = SE.addField "x" (DynamicValue.Int 0L); SE.Down = None } ]
    match SE.migrateDown reg 2 1 (DynamicValue.Object [ "x", DynamicValue.Int 0L ]) with
    | Error msg -> Assert.Contains("non-invertible", msg)
    | Ok _ -> Assert.Fail "expected non-invertible error"

// ── bidirectional round-trip LAWS (FsCheck — the "as math proof" leg, over arbitrary objects) ──
// NEW = "zzz" is never in the a..e key alphabet, so it is always a fresh target/field.

[<Property(Arbitrary = [| typeof<ObjArb> |])>]
let ``Schema law: addFieldMigration is lossless — down∘up = id for any object`` (v: DynamicValue) =
    let reg = [ SE.addFieldMigration 1 NEW DEF ]
    (SE.migrate reg 1 2 v |> Result.bind (SE.migrateDown reg 2 1)) = Ok v

[<Property(Arbitrary = [| typeof<ObjArb> |])>]
let ``Schema law: renameFieldMigration is lossless — down∘up = id for any object`` (v: DynamicValue) =
    let reg = [ SE.renameFieldMigration 1 "a" NEW ]
    (SE.migrate reg 1 2 v |> Result.bind (SE.migrateDown reg 2 1)) = Ok v

[<Property(Arbitrary = [| typeof<ObjArb> |])>]
let ``Schema law: removeFieldMigration down∘up = addField default ∘ removeField (the named loss, well-defined)`` (v: DynamicValue) =
    let reg = [ SE.removeFieldMigration 1 "a" DEF ]
    let rt = SE.migrate reg 1 2 v |> Result.bind (SE.migrateDown reg 2 1)
    rt = Ok(SE.addField "a" DEF (SE.removeField "a" v))

[<Property(Arbitrary = [| typeof<ObjArb> |])>]
let ``Schema law: the lossy remove round-trip is idempotent (converges to a fixed shape)`` (v: DynamicValue) =
    let reg = [ SE.removeFieldMigration 1 "a" DEF ]
    let once w = SE.migrate reg 1 2 w |> Result.bind (SE.migrateDown reg 2 1)
    match once v with
    | Ok w1 -> once w1 = Ok w1 // applying the round-trip again changes nothing
    | Error _ -> false

// ── windowed-lossless removal via the garbage dump (Aaron 2026-06-07) ──

[<Fact>]
let ``Schema: removeFieldWithDump restores the REAL value on rollback (windowed-lossless, not a default)`` () =
    let reg = [ SE.removeFieldWithDumpMigration 1 "secret" ]
    let v = DynamicValue.Object [ "id", DynamicValue.Int 1L; "secret", DynamicValue.String "hunter2" ]
    let back = SE.migrate reg 1 2 v |> Result.bind (SE.migrateDown reg 2 1)
    Assert.Equal<Result<DynamicValue, string>>(Ok v, back) // exact original, secret recovered

[<Fact>]
let ``Schema: up stashes into the dump; dropDump GCs it (removal becomes permanent after the window)`` () =
    let v = DynamicValue.Object [ "secret", DynamicValue.String "s" ]
    let up = SE.stashToDump "secret" v
    // top-level secret is gone; it lives in the dump
    match up with
    | DynamicValue.Object kvs ->
        Assert.False(kvs |> List.exists (fun (k, _) -> k = "secret"))
        Assert.True(kvs |> List.exists (fun (k, _) -> k = SE.dumpKey))
    | _ -> Assert.Fail "expected object"
    // GC the dump: now the value is truly gone (post-window) and restore is a no-op
    let gced = SE.dropDump up
    Assert.Equal<DynamicValue>(DynamicValue.Object [], gced)
    Assert.Equal<DynamicValue>(gced, SE.restoreFromDump "secret" gced) // nothing to restore after GC

[<Property(Arbitrary = [| typeof<ObjArb> |])>]
let ``Schema law: removeFieldWithDump is lossless — down∘up = id for any object (key 'a')`` (v: DynamicValue) =
    let reg = [ SE.removeFieldWithDumpMigration 1 "a" ]
    (SE.migrate reg 1 2 v |> Result.bind (SE.migrateDown reg 2 1)) = Ok v

let private repoRoot () : string =
    let mutable dir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)
    while not (File.Exists(Path.Combine(dir, "Zeta.sln"))) do
        dir <- Path.GetDirectoryName(dir)
    dir

let rec private buildValue (v: JsonElement) : DynamicValue =
    match v.GetProperty("t").GetString() with
    | "null" -> DynamicValue.Null
    | "bool" -> DynamicValue.Bool(v.GetProperty("v").GetBoolean())
    | "int" -> DynamicValue.Int(int64 (v.GetProperty("v").GetString()))
    | "float" -> DynamicValue.Float(double (v.GetProperty("v").GetString()))
    | "str" -> DynamicValue.String(v.GetProperty("v").GetString())
    | "arr" ->
        let items = [ for item in v.GetProperty("v").EnumerateArray() -> buildValue item ]
        DynamicValue.Array items
    | "obj" ->
        let pairs = [
            for item in v.GetProperty("v").EnumerateArray() do
                let arr = [ for x in item.EnumerateArray() -> x ]
                let key = arr.[0].GetString()
                let valNode = buildValue arr.[1]
                yield key, valNode
        ]
        DynamicValue.Object pairs
    | other -> failwithf "unknown tag %s" other

let private buildOp (v: JsonElement) : SE.Migration =
    let op = v.GetProperty("op").GetString()
    match op with
    | "add" ->
        let key = v.GetProperty("key").GetString()
        let def = buildValue (v.GetProperty("default"))
        SE.addFieldMigration 0 key def
    | "rename" ->
        let fromKey = v.GetProperty("from").GetString()
        let toKey = v.GetProperty("to").GetString()
        SE.renameFieldMigration 0 fromKey toKey
    | "remove" ->
        let key = v.GetProperty("key").GetString()
        let def = buildValue (v.GetProperty("default"))
        SE.removeFieldMigration 0 key def
    | "remove_with_dump" ->
        let key = v.GetProperty("key").GetString()
        SE.removeFieldWithDumpMigration 0 key
    | other -> failwithf "unknown op %s" other

[<Fact>]
let ``Schema: replays golden vectors schema evolution`` () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "dynamic-value", "golden-vectors-schema-evolution.json")
    use doc = JsonDocument.Parse(File.ReadAllText(path))
    let root = doc.RootElement
    let vectors = root.GetProperty("vectors").EnumerateArray()

    for vec in vectors do
        let name = vec.GetProperty("name").GetString()
        let input = buildValue (vec.GetProperty("input"))
        let expectedUp = buildValue (vec.GetProperty("expected_up"))
        let expectedDown = buildValue (vec.GetProperty("expected_down"))
        let ops = [ for op in vec.GetProperty("ops").EnumerateArray() -> buildOp op ]

        // Run Up migrations
        let mutable value = input
        for op in ops do
            value <- op.Up value
        Assert.Equal<DynamicValue>(expectedUp, value)

        // Run Down migrations
        let mutable backVal = value
        for i in (ops.Length - 1) .. -1 .. 0 do
            let op = ops.[i]
            match op.Down with
            | Some down -> backVal <- down backVal
            | None -> failwithf "Vector %s: down migration missing" name
        Assert.Equal<DynamicValue>(expectedDown, backVal)

