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

    /// The materialized db state = the incremental FOLD (DBSP IVM) over the stream (event sourcing; #6994).
    /// Every projection below is backend-INVARIANT — the same stream folds identically on any backend; only
    /// durability differs.
    type DbState =
        { Backend: Backend
          Files: Map<string, DynamicValue> // the infinite file's contents (path → value; homoiconic #7041)
          Deps: Map<string, string list> // dependency edges established by DepSetup
          PushedDown: Set<string> // nouns declared push-down (resolved outside the container)
          Resolved: Map<string, string> } // JIT/dynamic resolutions (DI, inside the container)

    /// An empty db on a given backend.
    let empty backend =
        { Backend = backend
          Files = Map.empty
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
        | Update(p, v) -> { st with Files = Map.add p v st.Files }
        | Delete p -> { st with Files = Map.remove p st.Files }

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
