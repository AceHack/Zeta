namespace Zeta.Core

/// **Schema evolution over DynamicValue — the zero-downtime versioning seed (081KSRGFP0008QG0R001Y6RTY9 foundation).**
///
/// A value is self-describing (`DynamicValue`); a SCHEMA VERSION labels its shape; a MIGRATION
/// is a pure `DynamicValue -> DynamicValue` transform from version N to N+1. The full
/// schema-registry-over-DBSP (081KSRGFP0008QG0R001Y6RTY9) catalogs these as rows; this module is the foundational
/// PRIMITIVE the registry composes — the migration algebra + the compatibility guarantees that
/// make version-swap-without-recompile (zero-downtime) safe:
///
///   - **Forward compatibility** (old reader, new data): an old reader IGNORES fields it does
///     not know — the extensible-data passthrough ("polymorphic round-trip in the extra data").
///     Unknown fields are PRESERVED through migrations that don't touch them.
///   - **Backward compatibility** (new reader, old data): a new reader SUPPLIES a default for a
///     field absent in the old shape (`addField`).
///
/// The field operations (`addField` / `removeField` / `renameField`) are the building blocks of
/// migrations; they operate on `Object` shapes and pass every other shape through unchanged
/// (so a migration is total over `DynamicValue`). Order-significant `Object` semantics are
/// respected. Composes [[DynamicValue]]; lineage: Datomic schema-as-data, Kafka Schema Registry.
[<RequireQualifiedAccess>]
module SchemaEvolution =

    /// An adjacent-version migration: `Up` transforms shape `From` into `To = From+1`; `Down` is the
    /// inverse (`To -> From`) used for zero-downtime ROLLBACK. `Down = None` means **non-invertible** —
    /// rollback requires compensation, not an inverse (the invertibility taxonomy: lossless / lossy / none).
    /// Use the smart constructors (`addFieldMigration` / `renameFieldMigration` / `removeFieldMigration`)
    /// to get a correct `Up`+`Down` pair; the bare record stays available for custom migrations.
    type Migration =
        { From: int
          To: int
          Up: DynamicValue -> DynamicValue
          Down: (DynamicValue -> DynamicValue) option }

    /// Ensure `key` is present, supplying `def` when absent (BACKWARD compat: a new reader gives
    /// old data a default for a field it didn't have). Idempotent; preserves existing value + order.
    let addField (key: string) (def: DynamicValue) (v: DynamicValue) : DynamicValue =
        match v with
        | DynamicValue.Object kvs ->
            if kvs |> List.exists (fun (k, _) -> k = key) then v
            else DynamicValue.Object(kvs @ [ key, def ])
        | other -> other

    /// Drop `key` if present (FORWARD compat from the old reader's view: it doesn't carry the
    /// new field). Preserves order of the rest.
    let removeField (key: string) (v: DynamicValue) : DynamicValue =
        match v with
        | DynamicValue.Object kvs -> DynamicValue.Object(kvs |> List.filter (fun (k, _) -> k <> key))
        | other -> other

    /// Rename `oldKey` to `newKey` in place (lossless field migration); preserves value + order.
    let renameField (oldKey: string) (newKey: string) (v: DynamicValue) : DynamicValue =
        match v with
        | DynamicValue.Object kvs ->
            DynamicValue.Object(kvs |> List.map (fun (k, x) -> if k = oldKey then (newKey, x) else (k, x)))
        | other -> other

    /// Project to only the keys an old reader knows (drops everything else). The "old reader"
    /// view used to state forward compatibility: unknown fields are simply not seen.
    let project (knownKeys: Set<string>) (v: DynamicValue) : DynamicValue =
        match v with
        | DynamicValue.Object kvs -> DynamicValue.Object(kvs |> List.filter (fun (k, _) -> knownKeys.Contains k))
        | other -> other

    /// `addField` is **lossless-invertible**: the inverse is `removeField key` — removing a field the
    /// up-migration added restores the prior shape exactly, so `down(up(x)) = x`.
    let addFieldMigration (fromV: int) (key: string) (def: DynamicValue) : Migration =
        { From = fromV; To = fromV + 1; Up = addField key def; Down = Some(removeField key) }

    /// `renameField` is **lossless-invertible**: the inverse is the rename swapped.
    let renameFieldMigration (fromV: int) (oldKey: string) (newKey: string) : Migration =
        { From = fromV
          To = fromV + 1
          Up = renameField oldKey newKey
          Down = Some(renameField newKey oldKey) }

    /// `removeField` is **LOSSY**: the removed value cannot be recovered, so the down-migration restores
    /// only `downDefault` (it NAMES the loss rather than pretending to invert). Round-trip is therefore
    /// `down(up(x)) = x` only on the fields other than `key`; `key` returns as `downDefault`.
    let removeFieldMigration (fromV: int) (key: string) (downDefault: DynamicValue) : Migration =
        { From = fromV; To = fromV + 1; Up = removeField key; Down = Some(addField key downDefault) }

    /// The reserved key under which a windowed removal stashes lossy data (the "garbage dump", Aaron
    /// 2026-06-07). A dump is an `Object` of `removedKey -> removedValue`, GC'd at contract-complete.
    [<Literal>]
    let dumpKey = "__evo_dump__"

    // A dump entry records the removed value AND its original index among the non-dump fields, so restore
    // is position-exact (`down∘up = id`, not just same-key-set). Shape: `key -> Object[ "idx", Int i; "val", v ]`.
    let private dumpEntry (idx: int) (value: DynamicValue) : DynamicValue =
        DynamicValue.Object [ "idx", DynamicValue.Int(int64 idx); "val", value ]

    let private splitDump (kvs: (string * DynamicValue) list) : (string * DynamicValue) list * (string * DynamicValue) list =
        let nonDump = kvs |> List.filter (fun (k, _) -> k <> dumpKey)
        let dump =
            match kvs |> List.tryPick (fun (k, x) -> if k = dumpKey then Some x else None) with
            | Some(DynamicValue.Object d) -> d
            | _ -> []
        nonDump, dump

    /// Move `key`'s value INTO the dump (lossless stash): remove `key` from the top level and record its
    /// value + original index under `dumpKey`. No-op if `key` is absent. Other shapes pass through.
    let stashToDump (key: string) (v: DynamicValue) : DynamicValue =
        match v with
        | DynamicValue.Object kvs ->
            let nonDump, dump = splitDump kvs
            match nonDump |> List.tryFindIndex (fun (k, _) -> k = key) with
            | None -> v
            | Some idx ->
                let removed = nonDump |> List.item idx |> snd
                let newNonDump = nonDump |> List.filter (fun (k, _) -> k <> key)
                let newDump = (dump |> List.filter (fun (k, _) -> k <> key)) @ [ key, dumpEntry idx removed ]
                DynamicValue.Object(newNonDump @ [ dumpKey, DynamicValue.Object newDump ])
        | other -> other

    /// Restore `key` FROM the dump (the position-exact inverse of `stashToDump`): reinsert `key`'s stashed
    /// value at its original index and drop it from the dump (removing the dump entirely when it empties).
    /// No-op if `key` is not in the dump. Other shapes pass through.
    let restoreFromDump (key: string) (v: DynamicValue) : DynamicValue =
        match v with
        | DynamicValue.Object kvs ->
            let nonDump, dump = splitDump kvs
            match dump |> List.tryPick (fun (k, x) -> if k = key then Some x else None) with
            | Some(DynamicValue.Object entry) ->
                let idx =
                    match entry |> List.tryPick (fun (k, x) -> if k = "idx" then Some x else None) with
                    | Some(DynamicValue.Int i) -> int i
                    | _ -> List.length nonDump
                let value =
                    entry |> List.tryPick (fun (k, x) -> if k = "val" then Some x else None) |> Option.defaultValue DynamicValue.Null
                let clamped = max 0 (min idx (List.length nonDump))
                let restored = (List.truncate clamped nonDump) @ [ key, value ] @ (List.skip clamped nonDump)
                let remaining = dump |> List.filter (fun (k, _) -> k <> key)
                let reattach = if List.isEmpty remaining then [] else [ dumpKey, DynamicValue.Object remaining ]
                DynamicValue.Object(restored @ reattach)
            | _ -> v
        | other -> other

    /// Drop the whole garbage dump (the GC step, run at contract-complete once rollback is no longer
    /// possible/needed — gated by the same horizon `EvolutionWindow` tracks).
    let dropDump (v: DynamicValue) : DynamicValue = removeField dumpKey v

    /// `removeField` made **windowed-lossless**: `Up` stashes the removed value in the dump instead of
    /// discarding it; `Down` restores the REAL value from the dump (not a default). So `down(up(x)) = x`
    /// for any `x` that doesn't already use the reserved `dumpKey` — a true inverse for the duration of the
    /// window. After the window, `dropDump` GCs the stash (the removal becomes permanent/irreversible).
    let removeFieldWithDumpMigration (fromV: int) (key: string) : Migration =
        { From = fromV
          To = fromV + 1
          Up = stashToDump key
          Down = Some(restoreFromDump key) }

    /// Migrate `value` from version `fromV` up to `toV` by composing the adjacent migrations in
    /// `migrations` (each must step From -> From+1). Returns Error if a step is missing or a
    /// downgrade is requested (use `migrateDown` for the inverse direction).
    let migrate (migrations: Migration list) (fromV: int) (toV: int) (value: DynamicValue) : Result<DynamicValue, string> =
        if toV < fromV then Error(sprintf "downgrade %d -> %d not supported by migrate; use migrateDown" fromV toV)
        else
            let rec step cur v =
                if cur = toV then Ok v
                else
                    match migrations |> List.tryFind (fun m -> m.From = cur && m.To = cur + 1) with
                    | Some m -> step (cur + 1) (m.Up v)
                    | None -> Error(sprintf "no migration registered from version %d to %d" cur (cur + 1))
            step fromV value

    /// Migrate `value` DOWN from `fromV` to `toV` (`toV <= fromV`) by composing the registered `Down`
    /// inverses in reverse order. Returns Error if a step is missing OR is **non-invertible** (`Down = None`
    /// — rollback there requires compensation, not an inverse). This is the zero-downtime ROLLBACK path:
    /// rollback by replaying inverses, distinct from "root selection" rollback at the store layer.
    let migrateDown (migrations: Migration list) (fromV: int) (toV: int) (value: DynamicValue) : Result<DynamicValue, string> =
        if toV > fromV then Error(sprintf "migrateDown requires toV <= fromV, got %d -> %d" fromV toV)
        else
            let rec step cur v =
                if cur = toV then Ok v
                else
                    match migrations |> List.tryFind (fun m -> m.To = cur && m.From = cur - 1) with
                    | Some m ->
                        match m.Down with
                        | Some down -> step (cur - 1) (down v)
                        | None ->
                            Error(
                                sprintf "migration %d -> %d is non-invertible (rollback needs compensation, not an inverse)" m.From m.To
                            )
                    | None -> Error(sprintf "no migration registered from version %d to %d" (cur - 1) cur)
            step fromV value
