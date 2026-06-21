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
