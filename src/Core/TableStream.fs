namespace Zeta.Core

/// **The `table` and `stream` noun-classes — the DBSP table↔stream duality.**
///
/// Aaron #7029: *"we should have a table and stream nouns/interfaces — one or the other too."* #7031: *"stream
/// metadata is just a stream too; this is the ultimate base of table-meta-as-table and file-meta-as-file."*
///
/// The **stream is the primitive** — the ordered changelog of deltas, i.e. the one DBSP Z-set stream
/// (#6997/#7000). A **table is its fold** — the materialized current state. They are "one or the other": two
/// views of the same data (Kafka KStream/KTable; DBSP; CQRS read-model vs event-log):
///   - `table = toTable stream`  (fold the changelog → current state)
///   - `stream = toStream table` (the upsert deltas that reconstruct the table)
/// with the duality `toTable (toStream t) = t`.
///
/// **`db` (#6996), `file` (#7002), `key` (#6998) are all this pattern** — a table/tree/keyring folded from a
/// stream. So `stream` is the ULTIMATE BASE of the self-hosting meta-recursion (#7027/#7028): file-meta is a
/// file and table-meta is a table because both are folds of a stream — and (Aaron #7032) **stream-metadata is
/// just an event WITHIN THE SAME STREAM as the data**: there are `Meta` events interleaved over the stream,
/// in-band. The recursion bottoms out here — the stream describes itself with its own events; nothing more
/// primitive, and no *separate* meta-stream. Fold the data events → the table; fold the `Meta` events → the
/// metadata; both from the ONE stream.
///
/// Idempotency (#6): `Upsert`/`Retract`/`Meta` are upsert/tombstone ⇒ apply-N == apply-once; the fold is
/// deterministic + replayable (DST §7). F# reference oracle; C#/Rust/TS ports follow.
///
/// **Homoiconic values (Aaron #7038/#7041):** values are `DynamicValue`, not `string` — so metadata and data
/// share ONE representation (#7038). `DynamicValue` is `NoComparison`, so it can only be a Map *value*, not a
/// key; **keys stay `string`** (which also keeps the key free to carry version/namespace/scope qualification
/// later, #7042). Data values and `Meta` values are the same `DynamicValue` shape — homoiconicity made literal.
module TableStream =

    open ZetaCli

    /// A stream delta (DBSP Z-set style). Data events (`Upsert`/`Retract`) AND **`Meta` events live on the
    /// SAME stream** (Aaron #7032: stream-metadata is an event within the same stream as the data — in-band).
    /// Values are `DynamicValue` (homoiconic, #7038); keys stay `string`.
    type Delta =
        | Upsert of key: string * value: DynamicValue // data: set a keyed row
        | Retract of key: string // data: remove a keyed row
        | Meta of key: string * value: DynamicValue // META: describes the stream itself, in-band, same stream

    /// The `stream` noun: the ordered changelog of deltas (the primitive).
    type Stream = Delta list

    /// The `table` noun: materialized current state (the fold of a stream). Values are `DynamicValue` (#7038).
    type Table = Map<string, DynamicValue>

    let emptyTable: Table = Map.empty

    /// Apply one delta to the DATA table. Upsert = set; Retract = remove (idempotent, #6). `Meta` events do
    /// NOT affect the data table (they fold into the metadata view instead — `toMeta`).
    let applyDelta (t: Table) (d: Delta) : Table =
        match d with
        | Upsert(k, v) -> Map.add k v t
        | Retract k -> Map.remove k t
        | Meta _ -> t

    /// `table = fold(data events of stream)` — the materialized view (deterministic, replayable; DST §7).
    let toTable (s: Stream) : Table = List.fold applyDelta emptyTable s

    /// The metadata view = fold of the **`Meta` events on the same stream** (#7032). Stream-metadata is in-band;
    /// this is just a second projection over the one stream — no separate meta-stream.
    let toMeta (s: Stream) : Table =
        s
        |> List.fold
            (fun (m: Table) d ->
                match d with
                | Meta(k, v) -> Map.add k v m
                | _ -> m)
            emptyTable

    /// `stream = changelog(table)` — the `Upsert` deltas that reconstruct the table, keys ordinal-sorted for
    /// determinism. Round-trips: `toTable (toStream t) = t` (the duality).
    let toStream (t: Table) : Stream =
        t
        |> Map.toList
        |> List.sortWith (fun (a, _) (b, _) -> System.String.CompareOrdinal(a, b))
        |> List.map Upsert

    /// **The shared base interface with the Z-set `I`/`D` duality** —
    /// `IStreamTableDuality` (`StreamTableDuality.fs`).
    ///
    /// This module and `Circuit.IntegrateZSet`/`DifferentiateZSet` were
    /// written independently and implement the same NOUN PAIR over
    /// different algebras. They are deliberately NOT merged: read the
    /// header of `StreamTableDuality.fs` for the two measured differences
    /// and the reason a merge would have to lie about one of them.
    ///
    /// The one flag that discriminates them is `FoldIsCommutative`, and
    /// this instance answers **false**, which is a real constraint on how
    /// `toTable` may be used rather than a wart:
    ///
    /// ```
    /// toTable [ Upsert("k", v); Retract "k" ]  =  {}         // empty
    /// toTable [ Retract "k"; Upsert("k", v) ]  =  {k -> v}   // not empty
    /// ```
    ///
    /// So this fold reads receive order. It is correct as a LOCAL
    /// materialization of a stream a node already holds in order, and it
    /// must not be used as a shared conclusion over deltas that reached
    /// different nodes in different orders —
    /// `.claude/rules/local-time-never-enters-the-shared-fold.md`.
    /// `StreamTableDuality.Tests.fs` measures both flags against both
    /// instances, so neither declaration can drift from its behaviour.
    let duality: IStreamTableDuality<Stream, Table> =
        { new IStreamTableDuality<Stream, Table> with
            member _.DualityName = "tablestream-lww"
            member _.ToTable s = toTable s
            member _.ToStream t = toStream t
            // Last-writer-wins over an ordered fold — see the worked
            // counter-example above.
            member _.FoldIsCommutative = false
            // `toTable` collapses the history to a snapshot; `toStream`
            // can only re-emit one canonical `Upsert` per surviving key.
            member _.TableDeterminesStream = false }

    [<Literal>]
    let StreamSeamName = "stream"

    [<Literal>]
    let TableSeamName = "table"

    /// Is this command on the `stream` seam (`zeta stream <verb> <noun>`)?
    let isStreamCommand (cmd: ZetaCommand) = cmd.Seam = Some StreamSeamName

    /// Is this command on the `table` seam (`zeta table <verb> <noun>`)?
    let isTableCommand (cmd: ZetaCommand) = cmd.Seam = Some TableSeamName
