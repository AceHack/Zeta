namespace Zeta.Core

/// **Interpreted stored-procs — verb-noun ops as homoiconic `DynamicValue`, differential-tested vs native.**
///
/// Aaron #7049: *"anywhere we have interfaces and nouns we should implement the verb-noun with plugins and
/// DynamicValue / SoftValue / yin-yang stored procs; we just need to per-test the F#-native versions vs our
/// interpreted."* So every noun-class op gets **two** implementations:
///   1. **native** — the F# fold (`TableStream.applyDelta`, `Db.apply`, `Files.apply`, …) — fast, the oracle.
///   2. **interpreted** — the op encoded as a homoiconic **stored-proc** (`DynamicValue`, #7041) and executed
///      by an *independent* interpreter (a different code path) — the pluggable, serializable, ship-anywhere
///      form (the yin/yang stored proc, #7046/#7048).
/// A **differential test** then asserts `native ≡ interpreted` for the same input — a cross-check oracle
/// (BP-16): two implementations that must agree, so a bug in either is caught.
///
/// This module is the REFERENCE instance for the `table` noun-class (#7029). Same pattern generalizes to
/// `db`/`file`/`catalog`; the per-test discipline (native vs interpreted) is the deliverable. F# reference
/// oracle; C#/Rust/TS ports follow.
module StoredProc =

    open TableStream

    [<Literal>]
    let private OpKey = "op"

    [<Literal>]
    let private KeyKey = "key"

    [<Literal>]
    let private ValKey = "value"

    /// Encode a table delta as a homoiconic stored-proc (`DynamicValue.Object`). The value rides as-is (it is
    /// already a `DynamicValue`, #7041) — the op is data describing data.
    let encodeDelta (d: Delta) : DynamicValue =
        match d with
        | Upsert(k, v) ->
            DynamicValue.Object [ OpKey, DynamicValue.String "upsert"; KeyKey, DynamicValue.String k; ValKey, v ]
        | Retract k -> DynamicValue.Object [ OpKey, DynamicValue.String "retract"; KeyKey, DynamicValue.String k ]
        | Meta(k, v) ->
            DynamicValue.Object [ OpKey, DynamicValue.String "meta"; KeyKey, DynamicValue.String k; ValKey, v ]

    /// Decode a stored-proc back to a `Delta` (round-trips with `encodeDelta`). `Error` on a malformed proc.
    let decodeDelta (sp: DynamicValue) : Result<Delta, string> =
        match sp with
        | DynamicValue.Object fields ->
            let get k =
                fields |> List.tryPick (fun (fk, fv) -> if fk = k then Some fv else None)

            match get OpKey, get KeyKey with
            | Some(DynamicValue.String "upsert"), Some(DynamicValue.String k) ->
                match get ValKey with
                | Some v -> Ok(Upsert(k, v))
                | None -> Error "upsert stored-proc missing 'value'"
            | Some(DynamicValue.String "retract"), Some(DynamicValue.String k) -> Ok(Retract k)
            | Some(DynamicValue.String "meta"), Some(DynamicValue.String k) ->
                match get ValKey with
                | Some v -> Ok(Meta(k, v))
                | None -> Error "meta stored-proc missing 'value'"
            | Some(DynamicValue.String op), _ -> Error(sprintf "unknown op '%s'" op)
            | _ -> Error "stored-proc missing 'op'/'key'"
        | _ -> Error "stored-proc must be a DynamicValue.Object"

    /// **Interpret** a stored-proc against a table — an INDEPENDENT code path from `TableStream.applyDelta`:
    /// it reads the `DynamicValue` fields and mutates the `Table` directly (no `Delta` round-trip), so it is a
    /// genuine second implementation for the differential test to compare against the native fold.
    let interpretApply (t: Table) (sp: DynamicValue) : Result<Table, string> =
        match sp with
        | DynamicValue.Object fields ->
            let get k =
                fields |> List.tryPick (fun (fk, fv) -> if fk = k then Some fv else None)

            match get OpKey with
            | Some(DynamicValue.String "upsert") ->
                match get KeyKey, get ValKey with
                | Some(DynamicValue.String k), Some v -> Ok(Map.add k v t)
                | _ -> Error "upsert requires key:String and value"
            | Some(DynamicValue.String "retract") ->
                match get KeyKey with
                | Some(DynamicValue.String k) -> Ok(Map.remove k t)
                | _ -> Error "retract requires key:String"
            | Some(DynamicValue.String "meta") -> Ok t // meta does not change the data table (mirrors applyDelta)
            | Some(DynamicValue.String op) -> Error(sprintf "unknown op '%s'" op)
            | _ -> Error "missing 'op'"
        | _ -> Error "stored-proc must be a DynamicValue.Object"

    /// A table operation as an **interface** — the hexagonal port (#7019) both the native fold and the
    /// DynamicValue-backed interpreter satisfy. Native and interpreted are then *interchangeable behind one
    /// interface*, and the differential test (#7049) compares two implementations of the SAME interface.
    type ITableProc =
        abstract member Apply: Table -> Table

    /// The **native** implementation of the interface (the F# fold).
    let nativeProc (d: Delta) : ITableProc =
        { new ITableProc with
            member _.Apply(t) = applyDelta t d }

    /// The **interpreted** implementation of the SAME interface, backed by a `DynamicValue` stored-proc via an
    /// F# **object expression** (Aaron #7051: *"implement the interface in DynamicValue in F# — return a
    /// `{ new Interface with … }`"*). Validates the proc once (`decodeDelta`); `Apply` then runs the
    /// independent interpreter (`interpretApply`). `Error` if the stored-proc is malformed.
    let dynamicProc (sp: DynamicValue) : Result<ITableProc, string> =
        match decodeDelta sp with
        | Error e -> Error e
        | Ok _ ->
            Ok
                { new ITableProc with
                    member _.Apply(t) =
                        match interpretApply t sp with
                        | Ok r -> r
                        | Error e -> failwithf "validated stored-proc failed at Apply: %s" e }
