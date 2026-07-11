namespace Zeta.Core

/// **The `db` noun-class — pluggable persistence, backend-invariant DU-fold over ONE DBSP Z-set stream.**
///
/// `db` is zeta-native at the SEMANTICS layer (event stream + fold + idempotent merge) but PERSISTS over a
/// pluggable substrate (#6994/#6995): git-native is the DEFAULT; multi-file (tiny per-dep files on an existing
/// filesystem) and single-file (one "infinite .fs/.ace" file on DagFs/ContentStore) share the SAME semantics —
/// only WHERE the bytes land changes. Swap the substrate, keep the proofs.
///
/// **Everything is an event on ONE DBSP Z-set stream (Aaron #6996/#6997):** dependency setup, push-down, and
/// JIT resolution are *just events on the zset stream*, exactly like file create/update/delete — NOT a separate
/// resolution phase. Each event is a `+1` delta; the db state is the incremental fold (DBSP IVM) over the
/// stream. "After the deps are set up" is therefore just *stream order*: the `DepSetup`/`PushDown`/`JitResolve`
/// events for a node precede the data events that need it, on the one stream.
///
/// The stream is **open-ended all the way down to bootstrap (Aaron #7000):** the OS itself, a USB being
/// *created* then later *inserted*, an account *logged into* or its *keys forwarded* — all the same DBSP Z-set
/// stream. Those are further event variants at the provisioning/hardware layer (the OS is the ultimate
/// push-down — kernel-level, outside the container); this module models the file + dependency layer, but the
/// `DbEvent` DU is the same shape that layer extends.
///
/// The fold is deterministic + replayable (DST §7); Create/Update are upsert, Delete is a tombstone, and the
/// structural events are upserts into their maps/sets — so apply-N == apply-once (idempotency #6): replay /
/// redelivery / partial fold land on one state. (Z-set retraction `+1` then `−1` is *correction*, a distinct
/// mechanism from this idempotent tombstone — see the culture/idempotency rules.)
///
/// `materialize` is a CONVENIENCE that LINEARIZES a declarative set of `ZetaCli` commands into a valid stream:
/// it derives a dependency order (`ZetaGraph.topoOrder`, #6984) — one valid linearization of the declarative
/// `dependson` edges — emits the `DepSetup` events, then the data events. The stream is primary; topo-order is
/// just one way to produce it.
///
/// **Declarative lowers to a DU over imperative (Aaron #6998):** *most* declarative commands end up being a DU
/// over imperative commands — which is exactly `materialize`: a declarative `ZetaCommand` set is lowered into
/// the `DbEvent` (a discriminated union) imperative stream. The EXCEPTION is *clever declarative* that does
/// CRDT/CAS-like things — those need NO imperative ordering because they converge by construction (content-
/// address / idempotent merge). Here the upsert/tombstone `apply` IS that clever-declarative path: `Files`
/// upserts are order-independent and idempotent (CAS/CRDT-like), so the *data* events don't actually depend on
/// imperative sequencing; only the *structural* `DepSetup` ordering is the imperative part. F# reference oracle;
/// C#/Rust/TS ports follow.
module Db =

    open ZetaCli

    /// Pluggable persistence substrate (#6995). `GitNative` is the default (commits = events, the control
    /// plane #6994); the others share the SAME Z-set-fold semantics below.
    type Backend =
        | GitNative // commits = events; distributed; the db control plane (DEFAULT)
        | MultiFile // tiny per-dep files on top of an existing filesystem
        | SingleFile // one "infinite .fs/.ace" file on top of our DagFs / ContentStore (CAS, BLAKE3)

    /// git-native by default (#6994); the others are opt-in by criteria (distribution? dedup? no-git-dep?).
    let defaultBackend = GitNative

    /// An event (`+1` delta) on the one DBSP Z-set stream (#6997). Structural events (dependency lifecycle)
    /// and data events (the infinite file) live on the SAME stream — no separate phases.
    type DbEvent =
        // — structural / dependency-lifecycle events (Aaron #6997: deps setup, push-down, JIT resolution are
        //   JUST events on the zset stream) —
        | DepSetup of noun: string * dependsOn: string list // edges established (the deps are "set up")
        | PushDown of noun: string // declared push-down dep (kernel/OS/global, OUTSIDE the container)
        | JitResolve of noun: string * resolved: string // lazy/dynamic resolution = DI, INSIDE the container
        // — data events over the (single, infinite) file (values are homoiconic `DynamicValue`, #7041) —
        | Create of path: string * value: DynamicValue
        | Update of path: string * value: DynamicValue
        | Delete of path: string
        | GSetCreate of path: string * capacity: int option * heatSink: string option
        | GSetAdd of path: string * item: string
        | ZSetCreate of path: string * capacity: int option * heatSink: string option
        | ZSetAdd of path: string * item: string * weight: int64

    /// A single record in the unified database Z-set representing collections and files as Z-sets.
    type DbRecord =
        | ZSetEntry of path: string * item: string
        | ZSetMeta of path: string * capacity: int option * heatSink: string option

    /// The materialized db state = the incremental FOLD (DBSP IVM) over the stream (event sourcing; #6994).
    /// Every projection below is backend-INVARIANT — the same stream folds identically on any backend; only
    /// durability differs.
    type DbState =
        { Backend: Backend
          Database: ZSet<DbRecord> // The single source-of-truth Z-set containing all database records
          Files: Map<string, DynamicValue> // helper projected view of file contents
          GSets: Map<string, GSet<string>> // helper projected view of GSets
          ZSets: Map<string, ZSet<string>> // helper projected view of ZSets
          GSetBounds: Map<string, int>
          ZSetBounds: Map<string, int>
          GSetHeatSinks: Map<string, string>
          ZSetHeatSinks: Map<string, string>
          HeatLog: (string * string * int * int64 * string) list
          Deps: Map<string, string list> // dependency edges established by DepSetup
          PushedDown: Set<string> // nouns declared push-down (resolved outside the container)
          Resolved: Map<string, string> } // JIT/dynamic resolutions (DI, inside the container)

    // -- Projections mapping the unified Z-set into structured record/collection views --

    let projectFiles (db: ZSet<DbRecord>) : Map<string, DynamicValue> =
        db
        |> Seq.choose (fun entry ->
            match entry.Key with
            | ZSetEntry(path, json) when entry.Weight > 0L ->
                match DynamicValue.fromCanonicalJson json with
                | Ok dv -> Some(path, dv)
                | _ -> Some(path, DynamicValue.String json)
            | _ -> None)
        |> Map.ofSeq

    let projectGSets (db: ZSet<DbRecord>) : Map<string, GSet<string>> =
        db
        |> Seq.choose (fun entry ->
            match entry.Key with
            | ZSetEntry(path, item) when entry.Weight > 0L -> Some(path, item)
            | _ -> None)
        |> Seq.groupBy fst
        |> Seq.map (fun (path, items) -> path, GSet.ofSeq (items |> Seq.map snd))
        |> Map.ofSeq

    let projectZSets (db: ZSet<DbRecord>) : Map<string, ZSet<string>> =
        db
        |> Seq.choose (fun entry ->
            match entry.Key with
            | ZSetEntry(path, item) when entry.Weight <> 0L -> Some(path, (item, entry.Weight))
            | _ -> None)
        |> Seq.groupBy fst
        |> Seq.map (fun (path, pairs) ->
            let entries = pairs |> Seq.map snd
            path, ZSet.ofSeq entries)
        |> Map.ofSeq

    let projectGSetBounds (db: ZSet<DbRecord>) : Map<string, int> =
        db
        |> Seq.choose (fun entry ->
            match entry.Key with
            | ZSetMeta(path, Some cap, _) when entry.Weight > 0L -> Some(path, cap)
            | _ -> None)
        |> Map.ofSeq

    let projectZSetBounds (db: ZSet<DbRecord>) : Map<string, int> =
        db
        |> Seq.choose (fun entry ->
            match entry.Key with
            | ZSetMeta(path, Some cap, _) when entry.Weight > 0L -> Some(path, cap)
            | _ -> None)
        |> Map.ofSeq

    let projectGSetHeatSinks (db: ZSet<DbRecord>) : Map<string, string> =
        db
        |> Seq.choose (fun entry ->
            match entry.Key with
            | ZSetMeta(path, _, Some hs) when entry.Weight > 0L -> Some(path, hs)
            | _ -> None)
        |> Map.ofSeq

    let projectZSetHeatSinks (db: ZSet<DbRecord>) : Map<string, string> =
        db
        |> Seq.choose (fun entry ->
            match entry.Key with
            | ZSetMeta(path, _, Some hs) when entry.Weight > 0L -> Some(path, hs)
            | _ -> None)
        |> Map.ofSeq

    /// An empty db on a given backend.
    let empty backend =
        { Backend = backend
          Database = ZSet.Empty
          Files = Map.empty
          GSets = Map.empty
          ZSets = Map.empty
          GSetBounds = Map.empty
          ZSetBounds = Map.empty
          GSetHeatSinks = Map.empty
          ZSetHeatSinks = Map.empty
          HeatLog = []
          Deps = Map.empty
          PushedDown = Set.empty
          Resolved = Map.empty }

    /// Apply one stream event (a `+1` delta). All updates are upserts/tombstones ⇒ apply-twice == apply-once
    /// (idempotency #6); the fold is deterministic (DST §7).
    let apply (st: DbState) (ev: DbEvent) : DbState =
        match ev with
        | DepSetup(n, deps) -> { st with Deps = Map.add n deps st.Deps }
        | PushDown n -> { st with PushedDown = Set.add n st.PushedDown }
        | JitResolve(n, r) -> { st with Resolved = Map.add n r st.Resolved }
        | Create(p, v)
        | Update(p, v) ->
            let oldFileOpt =
                st.Database
                |> Seq.tryPick (fun entry ->
                    match entry.Key with
                    | ZSetEntry(path, valStr) when path = p -> Some(entry.Key, entry.Weight)
                    | _ -> None)
            let json =
                match DynamicValue.toCanonicalJson v with
                | Ok s -> s
                | Error e -> failwithf "toCanonicalJson failed: %A" e
            let delta =
                match oldFileOpt with
                | Some(oldKey, oldW) -> ZSet.ofSeq [ oldKey, -oldW; ZSetEntry(p, json), 1L ]
                | None -> ZSet.singleton (ZSetEntry(p, json)) 1L
            let nextDb = st.Database + delta
            { st with Database = nextDb; Files = projectFiles nextDb }
        | Delete p ->
            let oldFileOpt =
                st.Database
                |> Seq.tryPick (fun entry ->
                    match entry.Key with
                    | ZSetEntry(path, valStr) when path = p -> Some(entry.Key, entry.Weight)
                    | _ -> None)
            let delta =
                match oldFileOpt with
                | Some(oldKey, oldW) -> ZSet.singleton oldKey -oldW
                | None -> ZSet.Empty
            let nextDb = st.Database + delta
            { st with Database = nextDb; Files = projectFiles nextDb }
        | GSetCreate(p, capOpt, hsOpt) ->
            let oldMeta =
                st.Database
                |> Seq.tryPick (fun entry ->
                    match entry.Key with
                    | ZSetMeta(path, _, _) when path = p -> Some(entry.Key, entry.Weight)
                    | _ -> None)
            let newKey = ZSetMeta(p, capOpt, hsOpt)
            let delta =
                match oldMeta with
                | Some(oldK, oldW) -> ZSet.ofSeq [ oldK, -oldW; newKey, 1L ]
                | None -> ZSet.singleton newKey 1L
            let nextDb = st.Database + delta
            { st with Database = nextDb; GSetBounds = projectGSetBounds nextDb; GSetHeatSinks = projectGSetHeatSinks nextDb }
        | ZSetCreate(p, capOpt, hsOpt) ->
            let oldMeta =
                st.Database
                |> Seq.tryPick (fun entry ->
                    match entry.Key with
                    | ZSetMeta(path, _, _) when path = p -> Some(entry.Key, entry.Weight)
                    | _ -> None)
            let newKey = ZSetMeta(p, capOpt, hsOpt)
            let delta =
                match oldMeta with
                | Some(oldK, oldW) -> ZSet.ofSeq [ oldK, -oldW; newKey, 1L ]
                | None -> ZSet.singleton newKey 1L
            let nextDb = st.Database + delta
            { st with Database = nextDb; ZSetBounds = projectZSetBounds nextDb; ZSetHeatSinks = projectZSetHeatSinks nextDb }
        | GSetAdd(p, item) ->
            let delta = ZSet.singleton (ZSetEntry(p, item)) 1L
            let nextDb = st.Database + delta
            let count =
                nextDb
                |> Seq.filter (fun entry ->
                    match entry.Key with
                    | ZSetEntry(path, _) when path = p && entry.Weight > 0L -> true
                    | _ -> false)
                |> Seq.length
            let capOpt = projectGSetBounds nextDb |> Map.tryFind p
            let heatLog' =
                match capOpt with
                | Some cap when count > cap ->
                    let hsOpt = projectGSetHeatSinks nextDb |> Map.tryFind p
                    let hs = defaultArg hsOpt "default"
                    let detail = sprintf "GSet capacity exceeded at path '%s': count = %d, cap = %d" p count cap
                    (p, "gset-saturation", 1, int64 (count - cap), detail) :: st.HeatLog
                | _ -> st.HeatLog
            { st with Database = nextDb; GSets = projectGSets nextDb; HeatLog = heatLog' }
        | ZSetAdd(p, item, w) ->
            let delta = ZSet.singleton (ZSetEntry(p, item)) w
            let nextDb = st.Database + delta
            let supportCount =
                nextDb
                |> Seq.filter (fun entry ->
                    match entry.Key with
                    | ZSetEntry(path, _) when path = p && entry.Weight <> 0L -> true
                    | _ -> false)
                |> Seq.length
            let capOpt = projectZSetBounds nextDb |> Map.tryFind p
            let heatLog' =
                match capOpt with
                | Some cap when supportCount > cap ->
                    let hsOpt = projectZSetHeatSinks nextDb |> Map.tryFind p
                    let hs = defaultArg hsOpt "default"
                    let detail = sprintf "ZSet capacity exceeded at path '%s': support count = %d, cap = %d" p supportCount cap
                    (p, "zset-saturation", 1, int64 (supportCount - cap), detail) :: st.HeatLog
                | _ -> st.HeatLog
            { st with Database = nextDb; ZSets = projectZSets nextDb; HeatLog = heatLog' }

    /// Fold a whole Z-set stream into state — deterministic and replayable (DST §7). Backend-INVARIANT: the
    /// same stream folds to the same projections on any backend (only durability differs).
    let fold backend (events: DbEvent list) : DbState =
        List.fold apply (empty backend) events

    [<Literal>]
    let SeamName = "db"

    /// Is this command on the `db` seam (`zeta db <verb> <noun>`)?
    let isDbCommand (cmd: ZetaCommand) = cmd.Seam = Some SeamName

    /// Interpret a db-seam command as a DATA mutation event. `value` supplies the payload (None for delete /
    /// non-mutating verbs). `write` is an alias for upsert. Non-mutating verbs (read/list/…) → None (queries,
    /// not events). Structural events come from `dependson` edges via `materialize`, not from here.
    let toEvent (value: DynamicValue option) (cmd: ZetaCommand) : DbEvent option =
        match cmd.Verb, value with
        | "create", Some v -> Some(Create(cmd.Noun, v))
        | "update", Some v
        | "write", Some v -> Some(Update(cmd.Noun, v)) // write = upsert
        | "delete", _ -> Some(Delete cmd.Noun)
        | _ -> None

    /// Linearize a declarative set of `db`-seam commands into ONE Z-set stream and fold it. The stream
    /// interleaves structural and data events on the SAME stream (#6997): for each command, in dependency
    /// order (`ZetaGraph.topoOrder`, #6984 — one valid linearization of the `dependson` edges), emit its
    /// `DepSetup` event (the deps being "set up", #6996) followed by its data event. So "after the deps are
    /// set up" is just stream order. `Error cycleNouns` if the dependency graph is cyclic (no strict order —
    /// same contract as `ZetaGraph.topoOrder`).
    let materialize
        (backend: Backend)
        (payloadOf: ZetaCommand -> DynamicValue option)
        (cmds: ZetaCommand list)
        : Result<DbState, string list> =
        match ZetaGraph.topoOrder cmds with
        | Error cycle -> Error cycle
        | Ok ordered ->
            ordered
            |> List.filter isDbCommand
            |> List.collect (fun c ->
                let structural =
                    match c.DependsOn with
                    | [] -> []
                    | deps -> [ DepSetup(c.Noun, deps) ]

                structural @ (toEvent (payloadOf c) c |> Option.toList))
            |> fold backend
            |> Ok
