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

    // ── db noun-class: native vs interpreted (the per-test #7049 generalized to `db`, sequence step 2) ──
    //
    // Same discipline as `table` above, for `Db.DbEvent` (structural DepSetup/PushDown/JitResolve + data
    // Create/Update/Delete, #6996). `encodeDbEvent`/`decodeDbEvent` are the homoiconic stored-proc form; the
    // differential test compares `Db.apply` (native fold) with `interpretDbApply` (independent interpreter).

    /// Encode a `Db.DbEvent` as a homoiconic stored-proc (`DynamicValue.Object`). String lists ride as an
    /// `Array` of `String`; data values ride as-is (already `DynamicValue`, #7041).
    let encodeDbEvent (ev: Db.DbEvent) : DynamicValue =
        let s = DynamicValue.String

        match ev with
        | Db.DepSetup(n, deps) ->
            DynamicValue.Object
                [ OpKey, s "depsetup"
                  KeyKey, s n
                  "deps", DynamicValue.Array(deps |> List.map s) ]
        | Db.PushDown n -> DynamicValue.Object [ OpKey, s "pushdown"; KeyKey, s n ]
        | Db.JitResolve(n, r) -> DynamicValue.Object [ OpKey, s "jitresolve"; KeyKey, s n; ValKey, s r ]
        | Db.Create(p, v) -> DynamicValue.Object [ OpKey, s "create"; KeyKey, s p; ValKey, v ]
        | Db.Update(p, v) -> DynamicValue.Object [ OpKey, s "update"; KeyKey, s p; ValKey, v ]
        | Db.Delete p -> DynamicValue.Object [ OpKey, s "delete"; KeyKey, s p ]
        | Db.GSetCreate(p, capOpt, hsOpt) ->
            let fields = [ OpKey, s "gsetcreate"; KeyKey, s p ]
            let fields' = match capOpt with Some cap -> fields @ [ "capacity", DynamicValue.Int (int64 cap) ] | None -> fields
            let fields'' = match hsOpt with Some hs -> fields' @ [ "heatsink", s hs ] | None -> fields'
            DynamicValue.Object fields''
        | Db.ZSetCreate(p, capOpt, hsOpt) ->
            let fields = [ OpKey, s "zsetcreate"; KeyKey, s p ]
            let fields' = match capOpt with Some cap -> fields @ [ "capacity", DynamicValue.Int (int64 cap) ] | None -> fields
            let fields'' = match hsOpt with Some hs -> fields' @ [ "heatsink", s hs ] | None -> fields'
            DynamicValue.Object fields''
        | Db.GSetAdd(p, item) ->
            DynamicValue.Object [ OpKey, s "gsetadd"; KeyKey, s p; "item", s item ]
        | Db.ZSetAdd(p, item, w) ->
            DynamicValue.Object [ OpKey, s "zsetadd"; KeyKey, s p; "item", s item; "weight", DynamicValue.Int w ]

    let private getField k (fields: (string * DynamicValue) list) =
        fields |> List.tryPick (fun (fk, fv) -> if fk = k then Some fv else None)

    /// Decode a stored-proc back to a `Db.DbEvent` (round-trips with `encodeDbEvent`). `Error` if malformed.
    let decodeDbEvent (sp: DynamicValue) : Result<Db.DbEvent, string> =
        match sp with
        | DynamicValue.Object fields ->
            let key () =
                match getField KeyKey fields with
                | Some(DynamicValue.String k) -> Ok k
                | _ -> Error "stored-proc missing string 'key'"

            let optInt name =
                match getField name fields with
                | Some(DynamicValue.Int i) -> Some (int i)
                | _ -> None

            let optString name =
                match getField name fields with
                | Some(DynamicValue.String s) -> Some s
                | _ -> None

            match getField OpKey fields with
            | Some(DynamicValue.String "depsetup") ->
                match key (), getField "deps" fields with
                | Ok n, Some(DynamicValue.Array items) ->
                    let deps = items |> List.choose (function DynamicValue.String d -> Some d | _ -> None)
                    Ok(Db.DepSetup(n, deps))
                | _ -> Error "depsetup requires key:String and deps:Array<String>"
            | Some(DynamicValue.String "pushdown") -> key () |> Result.map Db.PushDown
            | Some(DynamicValue.String "jitresolve") ->
                match key (), getField ValKey fields with
                | Ok n, Some(DynamicValue.String r) -> Ok(Db.JitResolve(n, r))
                | _ -> Error "jitresolve requires key:String and value:String"
            | Some(DynamicValue.String "create") ->
                match key (), getField ValKey fields with
                | Ok p, Some v -> Ok(Db.Create(p, v))
                | _ -> Error "create requires key:String and value"
            | Some(DynamicValue.String "update") ->
                match key (), getField ValKey fields with
                | Ok p, Some v -> Ok(Db.Update(p, v))
                | _ -> Error "update requires key:String and value"
            | Some(DynamicValue.String "delete") -> key () |> Result.map Db.Delete
            | Some(DynamicValue.String "gsetcreate") ->
                key () |> Result.map (fun p -> Db.GSetCreate(p, optInt "capacity", optString "heatsink"))
            | Some(DynamicValue.String "zsetcreate") ->
                key () |> Result.map (fun p -> Db.ZSetCreate(p, optInt "capacity", optString "heatsink"))
            | Some(DynamicValue.String "gsetadd") ->
                match key (), getField "item" fields with
                | Ok p, Some(DynamicValue.String item) -> Ok(Db.GSetAdd(p, item))
                | _ -> Error "gsetadd requires key:String and item:String"
            | Some(DynamicValue.String "zsetadd") ->
                match key (), getField "item" fields, getField "weight" fields with
                | Ok p, Some(DynamicValue.String item), Some(DynamicValue.Int w) -> Ok(Db.ZSetAdd(p, item, w))
                | _ -> Error "zsetadd requires key:String, item:String, and weight:Int"
            | Some(DynamicValue.String op) -> Error(sprintf "unknown db op '%s'" op)
            | _ -> Error "db stored-proc missing 'op'"
        | _ -> Error "db stored-proc must be a DynamicValue.Object"

    /// **Interpret** a db stored-proc against a `Db.DbState` — an INDEPENDENT code path from `Db.apply`: it
    /// reads the `DynamicValue` fields and mutates the state's maps/sets directly, so the differential test
    /// compares two genuine implementations. `Error` on a malformed proc.
    let interpretDbApply (st: Db.DbState) (sp: DynamicValue) : Result<Db.DbState, string> =
        match sp with
        | DynamicValue.Object fields ->
            let strKey () =
                match getField KeyKey fields with
                | Some(DynamicValue.String k) -> Some k
                | _ -> None

            let optInt name =
                match getField name fields with
                | Some(DynamicValue.Int i) -> Some (int i)
                | _ -> None

            let optString name =
                match getField name fields with
                | Some(DynamicValue.String s) -> Some s
                | _ -> None

            match getField OpKey fields, strKey () with
            | Some(DynamicValue.String "depsetup"), Some n ->
                match getField "deps" fields with
                | Some(DynamicValue.Array items) ->
                    let deps = items |> List.choose (function DynamicValue.String d -> Some d | _ -> None)
                    Ok { st with Deps = Map.add n deps st.Deps }
                | _ -> Error "depsetup requires deps:Array<String>"
            | Some(DynamicValue.String "pushdown"), Some n -> Ok { st with PushedDown = Set.add n st.PushedDown }
            | Some(DynamicValue.String "jitresolve"), Some n ->
                match getField ValKey fields with
                | Some(DynamicValue.String r) -> Ok { st with Resolved = Map.add n r st.Resolved }
                | _ -> Error "jitresolve requires value:String"
            | Some(DynamicValue.String "create"), Some p
            | Some(DynamicValue.String "update"), Some p ->
                match getField ValKey fields with
                | Some v ->
                    let oldFileOpt =
                        st.Database
                        |> Seq.tryPick (fun entry ->
                            match entry.Key with
                            | Db.ZSetEntry(path, valStr) when path = p -> Some(entry.Key, entry.Weight)
                            | _ -> None)
                    let json =
                        match DynamicValue.toCanonicalJson v with
                        | Ok s -> s
                        | Error e -> failwithf "toCanonicalJson failed: %A" e
                    let delta =
                        match oldFileOpt with
                        | Some(oldKey, oldW) -> ZSet.ofSeq [ oldKey, -oldW; Db.ZSetEntry(p, json), 1L ]
                        | None -> ZSet.singleton (Db.ZSetEntry(p, json)) 1L
                    let nextDb = st.Database + delta
                    Ok { st with Database = nextDb; Files = Db.projectFiles nextDb }
                | None -> Error "create/update requires value"
            | Some(DynamicValue.String "delete"), Some p ->
                let oldFileOpt =
                    st.Database
                    |> Seq.tryPick (fun entry ->
                        match entry.Key with
                        | Db.ZSetEntry(path, valStr) when path = p -> Some(entry.Key, entry.Weight)
                        | _ -> None)
                let delta =
                    match oldFileOpt with
                    | Some(oldKey, oldW) -> ZSet.singleton oldKey -oldW
                    | None -> ZSet.Empty
                let nextDb = st.Database + delta
                Ok { st with Database = nextDb; Files = Db.projectFiles nextDb }
            | Some(DynamicValue.String "gsetcreate"), Some p ->
                let oldMeta =
                    st.Database
                    |> Seq.tryPick (fun entry ->
                        match entry.Key with
                        | Db.ZSetMeta(path, _, _) when path = p -> Some(entry.Key, entry.Weight)
                        | _ -> None)
                let capOpt = optInt "capacity"
                let hsOpt = optString "heatsink"
                let newKey = Db.ZSetMeta(p, capOpt, hsOpt)
                let delta =
                    match oldMeta with
                    | Some(oldK, oldW) -> ZSet.ofSeq [ oldK, -oldW; newKey, 1L ]
                    | None -> ZSet.singleton newKey 1L
                let nextDb = st.Database + delta
                Ok { st with Database = nextDb; GSetBounds = Db.projectGSetBounds nextDb; GSetHeatSinks = Db.projectGSetHeatSinks nextDb }
            | Some(DynamicValue.String "zsetcreate"), Some p ->
                let oldMeta =
                    st.Database
                    |> Seq.tryPick (fun entry ->
                        match entry.Key with
                        | Db.ZSetMeta(path, _, _) when path = p -> Some(entry.Key, entry.Weight)
                        | _ -> None)
                let capOpt = optInt "capacity"
                let hsOpt = optString "heatsink"
                let newKey = Db.ZSetMeta(p, capOpt, hsOpt)
                let delta =
                    match oldMeta with
                    | Some(oldK, oldW) -> ZSet.ofSeq [ oldK, -oldW; newKey, 1L ]
                    | None -> ZSet.singleton newKey 1L
                let nextDb = st.Database + delta
                Ok { st with Database = nextDb; ZSetBounds = Db.projectZSetBounds nextDb; ZSetHeatSinks = Db.projectZSetHeatSinks nextDb }
            | Some(DynamicValue.String "gsetadd"), Some p ->
                match getField "item" fields with
                | Some(DynamicValue.String item) ->
                    let delta = ZSet.singleton (Db.ZSetEntry(p, item)) 1L
                    let nextDb = st.Database + delta
                    let count =
                        nextDb
                        |> Seq.filter (fun entry ->
                            match entry.Key with
                            | Db.ZSetEntry(path, _) when path = p && entry.Weight > 0L -> true
                            | _ -> false)
                        |> Seq.length
                    let capOpt = Db.projectGSetBounds nextDb |> Map.tryFind p
                    let heatLog' =
                        match capOpt with
                        | Some cap when count > cap ->
                            let hsOpt = Db.projectGSetHeatSinks nextDb |> Map.tryFind p
                            let hs = defaultArg hsOpt "default"
                            let detail = sprintf "GSet capacity exceeded at path '%s': count = %d, cap = %d" p count cap
                            (p, "gset-saturation", 1, int64 (count - cap), detail) :: st.HeatLog
                        | _ -> st.HeatLog
                    Ok { st with Database = nextDb; GSets = Db.projectGSets nextDb; HeatLog = heatLog' }
                | _ -> Error "gsetadd requires item:String"
            | Some(DynamicValue.String "zsetadd"), Some p ->
                match getField "item" fields, getField "weight" fields with
                | Some(DynamicValue.String item), Some(DynamicValue.Int w) ->
                    let delta = ZSet.singleton (Db.ZSetEntry(p, item)) w
                    let nextDb = st.Database + delta
                    let supportCount =
                        nextDb
                        |> Seq.filter (fun entry ->
                            match entry.Key with
                            | Db.ZSetEntry(path, _) when path = p && entry.Weight <> 0L -> true
                            | _ -> false)
                        |> Seq.length
                    let capOpt = Db.projectZSetBounds nextDb |> Map.tryFind p
                    let heatLog' =
                        match capOpt with
                        | Some cap when supportCount > cap ->
                            let hsOpt = Db.projectZSetHeatSinks nextDb |> Map.tryFind p
                            let hs = defaultArg hsOpt "default"
                            let detail = sprintf "ZSet capacity exceeded at path '%s': support count = %d, cap = %d" p supportCount cap
                            (p, "zset-saturation", 1, int64 (supportCount - cap), detail) :: st.HeatLog
                        | _ -> st.HeatLog
                    Ok { st with Database = nextDb; ZSets = Db.projectZSets nextDb; HeatLog = heatLog' }
                | _ -> Error "zsetadd requires item:String and weight:Int"
            | Some(DynamicValue.String op), _ -> Error(sprintf "unknown db op '%s'" op)
            | _ -> Error "db stored-proc missing 'op'/'key'"
        | _ -> Error "db stored-proc must be a DynamicValue.Object"

    /// **Interpret** a batch (list) of db stored-procs against a `Db.DbState` (interpreting events sequentially).
    /// Returns the final accumulated `Db.DbState`, or the first error encountered.
    let interpretDbFold (st: Db.DbState) (sps: DynamicValue list) : Result<Db.DbState, string> =
        let rec loop state items =
            match items with
            | [] -> Ok state
            | sp :: rest ->
                match interpretDbApply state sp with
                | Ok nextState -> loop nextState rest
                | Error e -> Error e
        loop st sps
