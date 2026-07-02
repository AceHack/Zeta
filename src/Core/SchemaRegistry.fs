namespace Zeta.Core

/// **SchemaRegistry — schemas-as-rows over DynamicValue (the 081KSRGFP0008QG0R001Y6RTY9 registry slice).**
///
/// The runtime-usable layer on top of [[SchemaEvolution]]: a catalog keyed by schema-id, where
/// each migration is stored as DATA (a declarative list of field-ops), not a function — so the
/// WHOLE registry is itself a `DynamicValue` that rides the proven JSON/CBOR/XML/Arrow codecs
/// (schemas-as-rows; Datomic schema-as-data; Kafka Schema Registry analog). A payload carrying a
/// `schema-id` + version resolves, at runtime, to the consumer's version by composing the
/// declarative ops into the `SchemaEvolution.migrate` chain — version-swap without recompile.
///
/// This is the seed the schema-required binary formats (protobuf/gRPC) plug into: a proto's
/// field-add/reserve/rename IS this op vocabulary; its forward/backward-compat IS the
/// SchemaEvolution proofs. The deeper 081KSRGFP0008QG0R001Y6RTY9 form (registry as a retraction-native DBSP stream)
/// catalogs these rows later; this is the in-memory, self-describing core.
[<RequireQualifiedAccess>]
module SchemaRegistry =

    /// A declarative, serializable field operation (interpreted into a DynamicValue transform).
    type FieldOp =
        | AddField of key: string * def: DynamicValue
        | RemoveField of key: string
        | RenameField of oldKey: string * newKey: string

    /// An adjacent-version migration stored as DATA (ops), not a function.
    type Migration = { From: int; To: int; Ops: FieldOp list }

    /// The catalog: schema-id → ordered migrations.
    type Registry = { Schemas: Map<string, Migration list> }

    let empty: Registry = { Schemas = Map.empty }

    /// Register (upsert) a schema's migration chain.
    let register (schemaId: string) (migrations: Migration list) (r: Registry) : Registry =
        { r with Schemas = Map.add schemaId migrations r.Schemas }

    // ── interpret declarative ops into a DynamicValue transform (via the proven SchemaEvolution) ──
    let applyOp (op: FieldOp) : DynamicValue -> DynamicValue =
        match op with
        | AddField (k, d) -> SchemaEvolution.addField k d
        | RemoveField k -> SchemaEvolution.removeField k
        | RenameField (o, n) -> SchemaEvolution.renameField o n

    let applyOps (ops: FieldOp list) (v: DynamicValue) : DynamicValue =
        List.fold (fun acc op -> applyOp op acc) v ops

    /// Invert one op for the DOWN direction. `AddField`/`RenameField` are LOSSLESS-invertible;
    /// `RemoveField` is **non-invertible at the registry level** (the removed value is gone and the op
    /// carries no down-default), so it returns `None` — the whole migration's `Down` then becomes `None`
    /// (rollback there needs compensation, not an inverse — the honest taxonomy).
    let invertOp (op: FieldOp) : FieldOp option =
        match op with
        | AddField (k, _) -> Some(RemoveField k)
        | RenameField (o, n) -> Some(RenameField(n, o))
        | RemoveField _ -> None

    /// Invert a migration's op list: invert each op AND reverse the order (the inverse of `f ∘ g` is
    /// `g⁻¹ ∘ f⁻¹`). `None` if any op is non-invertible.
    let invertOps (ops: FieldOp list) : FieldOp list option =
        let rec loop acc =
            function
            | [] -> Some acc // already reversed by prepending
            | op :: rest ->
                match invertOp op with
                | Some inv -> loop (inv :: acc) rest
                | None -> None
        loop [] ops

    let private seMigsOf (migs: Migration list) : SchemaEvolution.Migration list =
        migs
        |> List.map (fun m ->
            { SchemaEvolution.From = m.From
              SchemaEvolution.To = m.To
              SchemaEvolution.Up = applyOps m.Ops
              // Down derived by inverting the op list (reversed); None if any op is non-invertible.
              SchemaEvolution.Down = invertOps m.Ops |> Option.map applyOps })

    /// Migrate a value of `schemaId` from `fromV` up to `toV` by composing the registered ops.
    /// Clean Error on unknown schema / missing step / downgrade (total).
    let migrateValue (r: Registry) (schemaId: string) (fromV: int) (toV: int) (value: DynamicValue) : Result<DynamicValue, string> =
        match Map.tryFind schemaId r.Schemas with
        | None -> Error(sprintf "unknown schema '%s'" schemaId)
        | Some migs -> SchemaEvolution.migrate (seMigsOf migs) fromV toV value

    /// Migrate a value of `schemaId` DOWN from `fromV` to `toV` using the derived per-op inverses.
    /// Errors (not silent pass) on unknown schema, a missing step, or a non-invertible migration
    /// (one containing a `RemoveField` — rollback there needs compensation).
    let migrateValueDown (r: Registry) (schemaId: string) (fromV: int) (toV: int) (value: DynamicValue) : Result<DynamicValue, string> =
        match Map.tryFind schemaId r.Schemas with
        | None -> Error(sprintf "unknown schema '%s'" schemaId)
        | Some migs -> SchemaEvolution.migrateDown (seMigsOf migs) fromV toV value

    // ── schemas-as-rows: the registry IS a DynamicValue (rides the proven codecs) ──
    let private opToDynamic (op: FieldOp) : DynamicValue =
        match op with
        | AddField (k, d) -> DynamicValue.Object [ "op", DynamicValue.String "add"; "key", DynamicValue.String k; "default", d ]
        | RemoveField k -> DynamicValue.Object [ "op", DynamicValue.String "remove"; "key", DynamicValue.String k ]
        | RenameField (o, n) -> DynamicValue.Object [ "op", DynamicValue.String "rename"; "from", DynamicValue.String o; "to", DynamicValue.String n ]

    let private migToDynamic (m: Migration) : DynamicValue =
        DynamicValue.Object
            [ "from", DynamicValue.Int(int64 m.From)
              "to", DynamicValue.Int(int64 m.To)
              "ops", DynamicValue.Array(m.Ops |> List.map opToDynamic) ]

    /// Serialize the whole registry to a self-describing `DynamicValue` (schemas-as-rows).
    let toDynamic (r: Registry) : DynamicValue =
        DynamicValue.Object
            [ for KeyValue (id, migs) in r.Schemas -> id, DynamicValue.Array(migs |> List.map migToDynamic) ]

    let private opOfDynamic (dv: DynamicValue) : Result<FieldOp, string> =
        match dv with
        | DynamicValue.Object fields ->
            let m = Map.ofList fields
            let str k = match Map.tryFind k m with | Some (DynamicValue.String s) -> Some s | _ -> None
            match str "op" with
            | Some "add" ->
                match str "key", Map.tryFind "default" m with
                | Some k, Some d -> Ok(AddField(k, d))
                | _ -> Error "malformed add op"
            | Some "remove" -> (match str "key" with Some k -> Ok(RemoveField k) | None -> Error "malformed remove op")
            | Some "rename" -> (match str "from", str "to" with Some o, Some n -> Ok(RenameField(o, n)) | _ -> Error "malformed rename op")
            | _ -> Error "unknown field-op"
        | _ -> Error "field-op must be an object"

    let private migOfDynamic (dv: DynamicValue) : Result<Migration, string> =
        match dv with
        | DynamicValue.Object fields ->
            let m = Map.ofList fields
            let getI k = match Map.tryFind k m with | Some (DynamicValue.Int i) -> Some(int i) | _ -> None
            match getI "from", getI "to", Map.tryFind "ops" m with
            | Some f, Some t, Some (DynamicValue.Array ops) ->
                ops
                |> List.fold (fun acc o -> acc |> Result.bind (fun xs -> opOfDynamic o |> Result.map (fun x -> x :: xs))) (Ok [])
                |> Result.map List.rev
                |> Result.map (fun parsed -> { From = f; To = t; Ops = parsed })
            | _ -> Error "malformed migration"
        | _ -> Error "migration must be an object"

    /// Reconstruct a registry from its serialized `DynamicValue` (inverse of `toDynamic`).
    let fromDynamic (dv: DynamicValue) : Result<Registry, string> =
        match dv with
        | DynamicValue.Object fields ->
            fields
            |> List.fold
                (fun acc (id, v) ->
                    acc
                    |> Result.bind (fun reg ->
                        match v with
                        | DynamicValue.Array migs ->
                            migs
                            |> List.fold (fun a m -> a |> Result.bind (fun xs -> migOfDynamic m |> Result.map (fun x -> x :: xs))) (Ok [])
                            |> Result.map List.rev
                            |> Result.map (fun parsed -> { Schemas = Map.add id parsed reg.Schemas })
                        | _ -> Error(sprintf "schema '%s' must map to an array of migrations" id)))
                (Ok empty)
        | _ -> Error "registry must be an object"

    // ═════════════════════════════════════════════════════════════════
    //  The schema-plane projection (081KWFXTHJY step 5, slice 3): the
    //  registry's op stream folded into a SchemaZ — "a schema version is
    //  a prefix of the delta stream" made operational on the EXISTING
    //  registry, no new storage.
    //
    //  The ops carry no explicit type, so the fold is STATEFUL: AddField
    //  reads the type from its default's runtime tag; RemoveField and
    //  RenameField resolve the current (name, type) row from the schema
    //  folded so far. An op that references a field absent from the fold
    //  (ghost remove / ghost rename) is a SURFACED error — an
    //  inconsistent op stream is detected, never silently absorbed.
    // ═════════════════════════════════════════════════════════════════

    /// Fold one declarative op into the schema plane. Stateful: the current
    /// schema resolves the types RemoveField/RenameField retract.
    let private foldOp (schema: SchemaZ) (op: FieldOp) : Result<SchemaZ, string> =
        match op with
        | AddField (k, def) ->
            Ok(SchemaZ.applyDelta (SchemaZ.addFieldDelta k (DynamicValue.typeOf def)) schema)
        | RemoveField k ->
            match SchemaZ.fields schema |> List.tryFind (fun f -> f.Name = k) with
            | Some fid -> Ok(SchemaZ.applyDelta (SchemaZ.removeFieldDelta fid.Name fid.Type) schema)
            | None -> Error(sprintf "RemoveField '%s': field not present in the folded schema (ghost remove)" k)
        | RenameField (o, n) ->
            match SchemaZ.fields schema |> List.tryFind (fun f -> f.Name = o) with
            | Some fid -> Ok(SchemaZ.applyDelta (SchemaZ.renameFieldDelta o n fid.Type) schema)
            | None -> Error(sprintf "RenameField '%s'->'%s': field not present in the folded schema (ghost rename)" o n)

    /// The schema (as a SchemaZ) of `schemaId` AT `version` — the fold of
    /// every registered op on the version prefix `[minFrom, version)`.
    /// Version 1 (or the chain's smallest `From`) is the empty schema's
    /// first successor; asking for a version past the chain is an error.
    let schemaAt (r: Registry) (schemaId: string) (version: int) : Result<SchemaZ, string> =
        match Map.tryFind schemaId r.Schemas with
        | None -> Error(sprintf "unknown schema id '%s'" schemaId)
        | Some migs ->
            let start = migs |> List.map (fun m -> m.From) |> function [] -> version | xs -> List.min xs
            let rec step cur schema =
                if cur = version then Ok schema
                else
                    match migs |> List.tryFind (fun m -> m.From = cur && m.To = cur + 1) with
                    | None -> Error(sprintf "no migration registered from version %d to %d" cur (cur + 1))
                    | Some m ->
                        m.Ops
                        |> List.fold (fun acc op -> acc |> Result.bind (fun s -> foldOp s op)) (Ok schema)
                        |> Result.bind (step (cur + 1))
            if version < start then Error(sprintf "version %d precedes the chain's first version %d" version start)
            else step start SchemaZ.empty

    /// Schema DIFF between two versions — a Z-set difference on the schema
    /// plane: rows with weight +1 were ADDED going v1→v2, weight −1 were
    /// REMOVED. Free from the algebra; no per-op diffing code.
    let schemaDiff (r: Registry) (schemaId: string) (v1: int) (v2: int) : Result<SchemaZ, string> =
        match schemaAt r schemaId v1, schemaAt r schemaId v2 with
        | Ok s1, Ok s2 -> Ok(s2 - s1)
        | Error e, _ | _, Error e -> Error e
