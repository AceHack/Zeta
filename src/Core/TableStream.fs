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
module TableStream =

    open ZetaCli

    /// A stream delta (DBSP Z-set style). Data events (`Upsert`/`Retract`) AND **`Meta` events live on the
    /// SAME stream** (Aaron #7032: stream-metadata is an event within the same stream as the data — in-band).
    type Delta =
        | Upsert of key: string * value: string // data: set a keyed row
        | Retract of key: string // data: remove a keyed row
        | Meta of key: string * value: string // META: describes the stream itself, in-band, same stream

    /// The `stream` noun: the ordered changelog of deltas (the primitive).
    type Stream = Delta list

    /// The `table` noun: materialized current state (the fold of a stream).
    type Table = Map<string, string>

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

    [<Literal>]
    let StreamSeamName = "stream"

    [<Literal>]
    let TableSeamName = "table"

    /// Is this command on the `stream` seam (`zeta stream <verb> <noun>`)?
    let isStreamCommand (cmd: ZetaCommand) = cmd.Seam = Some StreamSeamName

    /// Is this command on the `table` seam (`zeta table <verb> <noun>`)?
    let isTableCommand (cmd: ZetaCommand) = cmd.Seam = Some TableSeamName
