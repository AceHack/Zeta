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

    // Event-log generators (increment 1). Ids come from a SMALL pool so that
    // redeliveries (same id AND op) and id collisions (same id, different op)
    // actually occur in generated logs — those collisions are exactly where
    // the dedup/conflict story earns its keep.
    static member SchemaOp() =
        gen {
            let! fid = SchemaArb.FieldId().Generator
            let! other = SchemaArb.FieldId().Generator
            let! which = Gen.choose (0, 3)
            return
                match which with
                | 0 -> AddField fid
                | 1 -> DropField fid
                | 2 -> RenameField(fid.Name, other.Name, fid.Type)
                | _ -> RetypeField(fid.Name, fid.Type, other.Type)
        }
        |> Arb.fromGen

    static member SchemaEvent() =
        gen {
            let! id = Gen.elements [ "e1"; "e2"; "e3"; "e4"; "e5" ]
            let! op = SchemaArb.SchemaOp().Generator
            return SchemaEvent.create id op
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

// ═══════════════════════════════════════════════════════════════════
// Slice 2 — MigrationZ.compile: the data plane DERIVED from the delta.
// ═══════════════════════════════════════════════════════════════════

let private obj' kvs = DynamicValue.Object kvs
let private unwrap r = match r with Ok m -> m | Error e -> failwithf "compile failed: %s" e

[<Fact>]
let ``compiled add: Up supplies the default, Down removes it — round-trip id`` () =
    let delta = SchemaZ.addFieldDelta "flag" DynamicValueType.Bool
    let m = MigrationZ.compile 1 [] (Map [ "flag", DynamicValue.Bool false ]) delta |> unwrap
    let v = obj' [ "x", DynamicValue.Int 1L ]
    let up = m.Up v
    match up with
    | DynamicValue.Object kvs -> Assert.True(kvs |> List.exists (fun (k, x) -> k = "flag" && x = DynamicValue.Bool false))
    | _ -> Assert.True(false)
    Assert.True(((m.Down.Value) up = v), "down(up(v)) must equal v")

[<Fact>]
let ``compiled remove is windowed-lossless: the value survives in the dump and Down restores it exactly`` () =
    let delta = SchemaZ.removeFieldDelta "secret" DynamicValueType.String
    let m = MigrationZ.compile 3 [] Map.empty delta |> unwrap
    let v = obj' [ "keep", DynamicValue.Int 7L; "secret", DynamicValue.String "s3" ]
    let up = m.Up v
    // gone from the top level, stashed in the dump
    match up with
    | DynamicValue.Object kvs ->
        Assert.False(kvs |> List.exists (fun (k, _) -> k = "secret"))
        Assert.True(kvs |> List.exists (fun (k, _) -> k = SchemaEvolution.dumpKey))
    | _ -> Assert.True(false)
    Assert.True(((m.Down.Value) up = v), "restoreFromDump must be position-exact")

[<Fact>]
let ``compiled rename WITH hint carries the value across — round-trip id`` () =
    let delta = SchemaZ.renameFieldDelta "old" "new" DynamicValueType.Int
    let m = MigrationZ.compile 5 [ { MigrationZ.From = "old"; MigrationZ.To = "new" } ] Map.empty delta |> unwrap
    let v = obj' [ "old", DynamicValue.Int 42L ]
    let up = m.Up v
    Assert.True((up = obj' [ "new", DynamicValue.Int 42L ]))
    Assert.True(((m.Down.Value) up = v))

[<Fact>]
let ``THE AMBIGUITY THEOREM: rename and remove+add are EQUAL deltas but different data planes — and unhinted loses nothing`` () =
    // Schema plane: identical
    let renameDelta = SchemaZ.renameFieldDelta "a" "b" DynamicValueType.Int
    let removeAddDelta =
        SchemaZ.applyDelta (SchemaZ.addFieldDelta "b" DynamicValueType.Int) (SchemaZ.removeFieldDelta "a" DynamicValueType.Int)
    Assert.True((renameDelta = removeAddDelta), "the algebra deliberately cannot tell them apart")
    // Data plane: hinted carries the value; unhinted takes the conservative windowed form
    let v = obj' [ "a", DynamicValue.Int 9L ]
    let hinted = MigrationZ.compile 1 [ { MigrationZ.From = "a"; MigrationZ.To = "b" } ] Map.empty renameDelta |> unwrap
    let unhinted = MigrationZ.compile 1 [] (Map [ "b", DynamicValue.Int 0L ]) renameDelta |> unwrap
    Assert.True((hinted.Up v = obj' [ "b", DynamicValue.Int 9L ]))
    let uv = unhinted.Up v
    match uv with
    | DynamicValue.Object kvs ->
        // "b" got the default, "a"'s real value is stashed in the dump — NOT silently lost
        Assert.True(kvs |> List.exists (fun (k, x) -> k = "b" && x = DynamicValue.Int 0L))
        Assert.True(kvs |> List.exists (fun (k, _) -> k = SchemaEvolution.dumpKey))
    | _ -> Assert.True(false)
    // and both round-trip
    Assert.True(((unhinted.Down.Value) uv = v))

[<Fact>]
let ``compiled mixed delta (rename + remove + add) round-trips`` () =
    let delta =
        SchemaZ.fold
            [ SchemaZ.renameFieldDelta "id" "user_id" DynamicValueType.Int
              SchemaZ.removeFieldDelta "legacy" DynamicValueType.String
              SchemaZ.addFieldDelta "email" DynamicValueType.String ]
            SchemaZ.empty
    let m =
        MigrationZ.compile 7 [ { MigrationZ.From = "id"; MigrationZ.To = "user_id" } ]
            (Map [ "email", DynamicValue.String "" ]) delta
        |> unwrap
    let v = obj' [ "id", DynamicValue.Int 1L; "legacy", DynamicValue.String "old" ]
    let up = m.Up v
    Assert.True(((m.Down.Value) up = v), "full mixed round-trip must be id")

[<Fact>]
let ``compile errors are surfaced, never silent`` () =
    // non-unit weight
    let dup = SchemaZ.fold [ SchemaZ.addFieldDelta "a" DynamicValueType.Int; SchemaZ.addFieldDelta "a" DynamicValueType.Int ] SchemaZ.empty
    Assert.True(match MigrationZ.compile 1 [] Map.empty dup with Error _ -> true | _ -> false)
    // hint that matches nothing
    let d = SchemaZ.addFieldDelta "x" DynamicValueType.Int
    Assert.True(match MigrationZ.compile 1 [ { MigrationZ.From = "p"; MigrationZ.To = "q" } ] Map.empty d with Error _ -> true | _ -> false)
    // add without default
    Assert.True(match MigrationZ.compile 1 [] Map.empty d with Error _ -> true | _ -> false)
    // retype disguised as rename hint (types differ)
    let retype = SchemaZ.retypeFieldDelta "age" DynamicValueType.String DynamicValueType.Int
    Assert.True(match MigrationZ.compile 1 [ { MigrationZ.From = "age"; MigrationZ.To = "age" } ] Map.empty retype with Error _ -> true | _ -> false)

[<Fact>]
let ``compiled migrations slot into the SchemaEvolution.migrate stream`` () =
    let m1 = MigrationZ.compile 1 [] (Map [ "b", DynamicValue.Int 0L ]) (SchemaZ.addFieldDelta "b" DynamicValueType.Int) |> unwrap
    let m2 = MigrationZ.compile 2 [ { MigrationZ.From = "b"; MigrationZ.To = "c" } ] Map.empty (SchemaZ.renameFieldDelta "b" "c" DynamicValueType.Int) |> unwrap
    let v = obj' [ "a", DynamicValue.Int 1L ]
    match SchemaEvolution.migrate [ m1; m2 ] 1 3 v with
    | Ok v3 ->
        Assert.True((v3 = obj' [ "a", DynamicValue.Int 1L; "c", DynamicValue.Int 0L ]))
        match SchemaEvolution.migrateDown [ m1; m2 ] 3 1 v3 with
        | Ok back -> Assert.True((back = v))
        | Error e -> Assert.True(false, e)
    | Error e -> Assert.True(false, e)

// ═══════════════════════════════════════════════════════════════════
// Increment 1 (081KYWE8Q4008QG0R000H558SH) — SchemaLog: schema as EVENTS.
//
// The schema is the FOLD of an append-only +1/−1 event log, never a stored
// desired-state map. Four laws carry the architecture; each is quantified,
// not exemplified:
//   L1  op inversion       — delta (invert op) = −(delta op)
//   L2  order-independence — any permutation of the log folds to the same
//                            schema (the load-bearing DST / merge property)
//   L3  replay / prefix    — fold(prefix) then fold(rest) == fold(all)
//   L4  retraction cancels — grant then revoke ⇒ weight 0 ⇒ field ABSENT
// Plus idempotency, stated in BOTH directions (it holds for redelivery,
// and it deliberately does NOT hold for duplicate intent).
// ═══════════════════════════════════════════════════════════════════

let private ev id op = SchemaEvent.create id op

// ── L1: every op has an exact additive inverse ───────────────────────

[<Property(Arbitrary = [| typeof<SchemaArb> |])>]
let ``L1 op inversion: delta (invert op) is the ring negate of delta op`` (op: SchemaOp) =
    SchemaOp.delta (SchemaOp.invert op) = -(SchemaOp.delta op)

[<Property(Arbitrary = [| typeof<SchemaArb> |])>]
let ``L1 invert is an involution`` (op: SchemaOp) =
    SchemaOp.invert (SchemaOp.invert op) = op

// ── L2: order-independence — the load-bearing DST / merge property ───

[<Property(Arbitrary = [| typeof<SchemaArb> |])>]
let ``L2 order-independence: ANY permutation of the log folds to the SAME schema`` (log: SchemaEvent list) =
    Prop.forAll (Arb.fromGen (Gen.shuffle log)) (fun perm ->
        SchemaLog.current perm = SchemaLog.current log
        && SchemaLog.foldRaw perm = SchemaLog.foldRaw log)

[<Property(Arbitrary = [| typeof<SchemaArb> |])>]
let ``L2 corollary: two writers' logs merge to the same schema in either concatenation order``
    (a: SchemaEvent list) (b: SchemaEvent list) =
    SchemaLog.current (a @ b) = SchemaLog.current (b @ a)

// ── L3: replay / prefix-split — checkpoint-and-resume is arithmetic ──

[<Property(Arbitrary = [| typeof<SchemaArb> |])>]
let ``L3 replay: folding a prefix then the rest equals folding all`` (log: SchemaEvent list) (n: int) =
    let k = if List.isEmpty log then 0 else abs n % (List.length log + 1)
    let prefix = List.truncate k log
    let rest = List.skip k log
    SchemaLog.foldRawFrom (SchemaLog.foldRaw prefix) rest = SchemaLog.foldRaw log

[<Property(Arbitrary = [| typeof<SchemaArb> |])>]
let ``L3 on a duplicate-free log the deduped fold IS the raw fold`` (log: SchemaEvent list) =
    let clean = SchemaLog.dedupe log
    SchemaLog.current clean = SchemaLog.foldRaw clean

// ── L4: retraction cancels — revoke ≡ Z-set retraction ───────────────

[<Property(Arbitrary = [| typeof<SchemaArb> |])>]
let ``L4 retraction cancels: appending a compensating event per entry folds back to the EMPTY schema``
    (log: SchemaEvent list) =
    let deduped = SchemaLog.dedupe log
    let undo =
        deduped
        |> List.mapi (fun i e -> SchemaEvent.compensate (sprintf "undo-%d-%s" i e.EventId) e)
    SchemaLog.current (deduped @ undo) = SchemaZ.empty

[<Fact>]
let ``L4 grant then revoke: the field is ABSENT from the folded schema, not tombstoned`` () =
    let fid = f "email" DynamicValueType.String
    let log =
        [ ev "e1" (AddField(f "id" DynamicValueType.Int))
          ev "e2" (AddField fid)
          ev "e3" (DropField fid) ]
    let s = SchemaLog.current log
    Assert.True(SchemaZ.wellFormed s)
    Assert.Equal<FieldId list>([ f "id" DynamicValueType.Int ], SchemaZ.fields s)
    // weight 0 ⇒ the row is gone from the Z-set entirely (consolidation), so
    // "absent" is not a flag anyone has to remember to check.
    Assert.Equal(0L, s.[fid])
    Assert.Equal(1, s.Count)

// ── Idempotency, stated in BOTH directions (discipline #6) ───────────

[<Property(Arbitrary = [| typeof<SchemaArb> |])>]
let ``idempotent under REDELIVERY: replaying the whole log again changes nothing`` (log: SchemaEvent list) =
    SchemaLog.current (log @ log) = SchemaLog.current log

[<Property(Arbitrary = [| typeof<SchemaArb> |])>]
let ``dedupe is itself idempotent`` (log: SchemaEvent list) =
    SchemaLog.dedupe (SchemaLog.dedupe log) = SchemaLog.dedupe log

[<Fact>]
let ``NOT idempotent by intent: two DISTINCT events adding the same field is a DETECTED conflict`` () =
    // Same field, two different idempotency keys — this is two writers each
    // deciding to add "status", NOT one event delivered twice. The fold says
    // weight 2 and names the row; it never silently picks a winner.
    let fid = f "status" DynamicValueType.String
    let log = [ ev "w1" (AddField fid); ev "w2" (AddField fid) ]
    let s = SchemaLog.current log
    Assert.False(SchemaZ.wellFormed s)
    Assert.Equal(2L, s.[fid])
    Assert.Equal<(FieldId * int64) list>([ fid, 2L ], SchemaLog.conflicts log)
    // whereas ONE event delivered twice is a no-op
    let redelivered = [ ev "w1" (AddField fid); ev "w1" (AddField fid) ]
    Assert.True(SchemaZ.wellFormed (SchemaLog.current redelivered))

[<Fact>]
let ``revoke-before-grant is DETECTED (weight -1), never a silent no-op`` () =
    let log = [ ev "e1" (DropField(f "ghost" DynamicValueType.Int)) ]
    Assert.False(SchemaZ.wellFormed (SchemaLog.current log))
    Assert.Equal<(FieldId * int64) list>([ f "ghost" DynamicValueType.Int, -1L ], SchemaLog.conflicts log)

// ── A version is a POSITION in the log ───────────────────────────────

[<Fact>]
let ``a schema version is a prefix of the event log, not a stored integer`` () =
    let log =
        [ ev "e1" (AddField(f "id" DynamicValueType.Int))
          ev "e2" (AddField(f "email" DynamicValueType.String))
          ev "e3" (RenameField("id", "user_id", DynamicValueType.Int))
          ev "e4" (RetypeField("email", DynamicValueType.String, DynamicValueType.Bool))
          ev "e5" (DropField(f "email" DynamicValueType.Bool)) ]
    let names n = SchemaLog.at n log |> SchemaZ.fields |> List.map (fun x -> x.Name) |> List.sort
    Assert.Equal<string list>([], names 0)
    Assert.Equal<string list>([ "id" ], names 1)
    Assert.Equal<string list>([ "email"; "id" ], names 2)
    Assert.Equal<string list>([ "email"; "user_id" ], names 3)
    Assert.Equal<string list>([ "email"; "user_id" ], names 4)
    Assert.Equal<string list>([ "user_id" ], names 5)
    // every prefix of a linear single-writer history is well-formed
    for n in 0 .. 5 do
        Assert.True(SchemaZ.wellFormed (SchemaLog.at n log), sprintf "prefix %d ill-formed" n)
    // and the retype at e4 really did change the type, not just the name
    Assert.Equal<FieldId list>(
        [ f "email" DynamicValueType.Bool; f "user_id" DynamicValueType.Int ] |> List.sortBy (fun x -> x.Name),
        SchemaLog.at 4 log |> SchemaZ.fields |> List.sortBy (fun x -> x.Name))

// ── Id collisions: reported as the neutral fact, never resolved ──────

[<Fact>]
let ``an EventId carrying two DIFFERENT ops is reported, not silently resolved`` () =
    let log =
        [ ev "dup" (AddField(f "a" DynamicValueType.Int))
          ev "dup" (DropField(f "b" DynamicValueType.Int))
          ev "ok" (AddField(f "b" DynamicValueType.Int)) ]
    match SchemaLog.idCollisions log with
    | [ (id, ops) ] ->
        Assert.Equal<string>("dup", id)
        Assert.Equal(2, List.length ops)
    | other -> Assert.True(false, sprintf "expected exactly one collision, got %A" other)
    // a clean log reports none
    Assert.Empty(SchemaLog.idCollisions [ ev "e1" (AddField(f "a" DynamicValueType.Int)) ])

// ── The event layer agrees with the delta layer it sits on ───────────

[<Property(Arbitrary = [| typeof<SchemaArb> |])>]
let ``the event fold agrees with SchemaZ.fold over the same deltas`` (log: SchemaEvent list) =
    SchemaLog.foldRaw log = SchemaZ.fold (log |> List.map SchemaEvent.delta) SchemaZ.empty

[<Fact>]
let ``an event log compiles to a data-plane migration through MigrationZ`` () =
    // The whole point: one log drives BOTH planes — schema (this file's
    // algebra) and data (SchemaEvolution's Up/Down), with no privileged
    // stop-the-world migration channel.
    let log = [ ev "e1" (RenameField("id", "user_id", DynamicValueType.Int)) ]
    let m =
        MigrationZ.compile 1 [ { MigrationZ.From = "id"; MigrationZ.To = "user_id" } ] Map.empty (SchemaLog.current log)
        |> unwrap
    Assert.True((m.Up (obj' [ "id", DynamicValue.Int 3L ]) = obj' [ "user_id", DynamicValue.Int 3L ]))
