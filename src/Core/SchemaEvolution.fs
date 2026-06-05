namespace Zeta.Core

/// **Schema evolution over DynamicValue — the zero-downtime versioning seed (B-0930 foundation).**
///
/// A value is self-describing (`DynamicValue`); a SCHEMA VERSION labels its shape; a MIGRATION
/// is a pure `DynamicValue -> DynamicValue` transform from version N to N+1. The full
/// schema-registry-over-DBSP (B-0930) catalogs these as rows; this module is the foundational
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

    /// An adjacent-version migration: transforms a value of shape `From` into shape `To = From+1`.
    type Migration =
        { From: int
          To: int
          Up: DynamicValue -> DynamicValue }

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

    /// Migrate `value` from version `fromV` up to `toV` by composing the adjacent migrations in
    /// `migrations` (each must step From -> From+1). Returns Error if a step is missing or a
    /// downgrade is requested (the seed is forward-only; downgrade = a separate Down direction).
    let migrate (migrations: Migration list) (fromV: int) (toV: int) (value: DynamicValue) : Result<DynamicValue, string> =
        if toV < fromV then Error(sprintf "downgrade %d -> %d not supported in the evolution seed" fromV toV)
        else
            let rec step cur v =
                if cur = toV then Ok v
                else
                    match migrations |> List.tryFind (fun m -> m.From = cur && m.To = cur + 1) with
                    | Some m -> step (cur + 1) (m.Up v)
                    | None -> Error(sprintf "no migration registered from version %d to %d" cur (cur + 1))
            step fromV value
