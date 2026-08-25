namespace Zeta.Core

/// **The catalog as metadata tables — no DDL, just `ensure` → a DU of DML meta-updates.**
///
/// Realizes the principle stack (Aaron #7038/#7039/#7040): metadata is homoiconic to data (#7038), so the
/// schema/catalog lives in **metadata tables** (#7028) — ordinary `TableStream` rows. Therefore there is **no
/// DDL**: defining/evolving a schema is **DML** (`Upsert`/`Retract`) on those catalog rows (#7039). And you
/// don't hand-write that DML: **DDL collapses to `ensure`** (idempotent declarative target), and **automatic
/// schema evolution is a DU over the DML meta-updates** (#7040) — `ensure` diffs the desired schema against
/// the current catalog and *derives* the `Delta` list (the meta-DML) to evolve current → desired.
///
/// Catalog rows are encoded as ordinary `TableStream` keys (homoiconic; the catalog IS a table):
///   `table:<name>`           → `"1"`         (a declared table)
///   `column:<table>.<col>`   → `<type>`      (a column + its type)
/// Editing those rows = DML deltas = events on the one stream (#7032/#7036); evolution replays under DST,
/// merges as a CRDT, and is idempotent (#6) — the same guarantees data gets. F# reference oracle.
module Catalog =

    open TableStream

    /// A desired schema: each table with its (column, type) pairs. This is the `ensure` TARGET.
    type Schema = (string * (string * string) list) list

    [<Literal>]
    let private TablePrefix = "table:"

    [<Literal>]
    let private ColumnPrefix = "column:"

    let private tableKey (t: string) = TablePrefix + t
    let private columnKey (t: string) (c: string) = ColumnPrefix + t + "." + c

    /// The desired catalog as the flat metadata-table rows it implies (table + column rows). Values are
    /// `DynamicValue` (homoiconic, #7038): a table row is `Bool true` (exists); a column row is `String <type>`.
    let private desiredRows (schema: Schema) : Map<string, DynamicValue> =
        schema
        |> List.collect (fun (t, cols) ->
            (tableKey t, DynamicValue.Bool true)
            :: (cols |> List.map (fun (c, ty) -> columnKey t c, DynamicValue.String ty)))
        |> Map.ofList

    /// **`ensure schema current`** — the automatic schema evolution as a **DU over the DML meta-updates**
    /// (#7040): diff the desired schema against the `current` catalog table and return the ordered `Delta`
    /// list (the meta-DML) that evolves current → desired. `Upsert` for new/changed rows, `Retract` for rows
    /// no longer desired. **Idempotent** (#6): when the catalog already matches, returns `[]` (a no-op).
    /// Deterministic: deltas are ordinal-sorted by key (retracts before upserts is not required — applied as a
    /// set — but ordering is stable for diffable golden vectors).
    let ensure (schema: Schema) (current: Table) : Delta list =
        let desired = desiredRows schema

        // Upserts: desired rows that are absent or have a different value in current.
        let upserts =
            desired
            |> Map.toList
            |> List.filter (fun (k, v) ->
                match Map.tryFind k current with
                | Some cur -> cur <> v
                | None -> true)
            |> List.map Upsert

        // Retracts: current rows (catalog rows only) no longer desired.
        let retracts =
            current
            |> Map.toList
            |> List.filter (fun (k, _) ->
                (k.StartsWith(TablePrefix, System.StringComparison.Ordinal)
                 || k.StartsWith(ColumnPrefix, System.StringComparison.Ordinal))
                && not (Map.containsKey k desired))
            |> List.map (fun (k, _) -> Retract k)

        (retracts @ upserts)
        |> List.sortWith (fun a b ->
            let keyOf =
                function
                | Upsert(k, _) -> k
                | Retract k -> k
                | Meta(k, _) -> k

            System.String.CompareOrdinal(keyOf a, keyOf b))

    /// Apply `ensure`'s deltas to evolve the catalog (fold the meta-DML over the current table).
    let evolve (schema: Schema) (current: Table) : Table =
        ensure schema current |> List.fold applyDelta current

    /// Read back the schema from a catalog table (tables + their columns), ordinal-sorted — the inverse view.
    let readSchema (current: Table) : Schema =
        let tables =
            current
            |> Map.toList
            |> List.choose (fun (k, _) ->
                if k.StartsWith(TablePrefix, System.StringComparison.Ordinal) then
                    Some(k.Substring(TablePrefix.Length))
                else
                    None)
            |> List.sortWith (fun a b -> System.String.CompareOrdinal(a, b))

        tables
        |> List.map (fun t ->
            let colPrefix = ColumnPrefix + t + "."

            let cols =
                current
                |> Map.toList
                |> List.choose (fun (k, v) ->
                    if k.StartsWith(colPrefix, System.StringComparison.Ordinal) then
                        // column value is a homoiconic DynamicValue.String <type>; extract the type name
                        let ty =
                            match v with
                            | DynamicValue.String s -> s
                            | other -> string other

                        Some(k.Substring(colPrefix.Length), ty)
                    else
                        None)
                |> List.sortWith (fun (a, _) (b, _) -> System.String.CompareOrdinal(a, b))

            t, cols)

    // ═══════════════════════════════════════════════════════════════════════════════
    // Statistics — the catalog's SATELLITE (DV2.0 #5: partition by change rate)
    // ═══════════════════════════════════════════════════════════════════════════════
    //
    // A Selinger-style cost model is a formula over CATALOG STATISTICS (`NCARD`, `ICARD`
    // in Selinger et al., SIGMOD 1979). This catalog held none, so `Plan.fs` had a formula
    // over nothing and every number in it was a constant.
    //
    // Statistics live on the same metadata table as the schema (still homoiconic, still
    // DML, #7038/#7039) but under their own key prefixes, because they change at a
    // completely different rate: a schema changes when someone edits it; a row count
    // changes every tick. Schema rows are the hub, statistics rows are the satellite.
    //
    //   `stat:rows:<table>`         → `Int <n>`   (NCARD — relation cardinality)
    //   `stat:ndv:<table>.<col>`    → `Int <n>`   (ICARD — distinct values in a column)
    //   `stat:src:<...>`            → `String`    (provenance of the number above)
    //
    // `ensure`/`evolve` above deliberately do NOT retract these: their retract filter
    // matches only `table:` / `column:`, so evolving a schema leaves the statistics alone.
    // That is the change-rate split doing its job, not an oversight.
    //
    // **Register: `unmetered`.** These are storage and provenance for statistics. Nothing
    // here collects them, and nothing here validates that a number labelled `measured`
    // was in fact measured — the label is an assertion by whoever wrote the row.

    [<Literal>]
    let private StatRowsPrefix = "stat:rows:"

    [<Literal>]
    let private StatNdvPrefix = "stat:ndv:"

    [<Literal>]
    let private StatSourcePrefix = "stat:src:"

    let private statRowsKey (t: string) = StatRowsPrefix + t
    let private statNdvKey (t: string) (c: string) = StatNdvPrefix + t + "." + c

    let private sourceToken (s: StatSource) =
        match s with
        | StatSource.Measured -> "measured"
        | StatSource.UpperBoundNotRetractionSafe -> "upper-bound-not-retraction-safe"
        | StatSource.DefaultNoStatistic -> "default-no-statistic"

    /// Parse a provenance token. **An unrecognised or absent token degrades to
    /// `UpperBoundNotRetractionSafe`, never to `Measured`** — a number whose provenance we
    /// cannot read is not a number we may present as measured.
    let private tokenToSource (token: string option) =
        match token with
        | Some "measured" -> StatSource.Measured
        | Some "default-no-statistic" -> StatSource.DefaultNoStatistic
        | _ -> StatSource.UpperBoundNotRetractionSafe

    /// The `Delta` list that records one statistic (value row + provenance row).
    let private statDeltas (key: string) (stat: Stat) : Delta list =
        [ Upsert(key, DynamicValue.Int stat.Value)
          Upsert(StatSourcePrefix + key, DynamicValue.String(sourceToken stat.Source)) ]

    /// **`ensureStats table stats`** — the meta-DML that records a relation's statistics on
    /// the catalog table. Same shape as `ensure`: idempotent, ordinal-sorted, Upsert-only
    /// (a statistic is replaced, never implicitly deleted).
    let ensureStats (table: string) (stats: TableStatistics) : Delta list =
        let rowDeltas =
            match stats.RowCount with
            | Some s -> statDeltas (statRowsKey table) s
            | None -> []

        let ndvDeltas =
            stats.DistinctValues
            |> Map.toList
            |> List.collect (fun (col, s) -> statDeltas (statNdvKey table col) s)

        (rowDeltas @ ndvDeltas)
        |> List.sortWith (fun a b ->
            let keyOf =
                function
                | Upsert(k, _) -> k
                | Retract k -> k
                | Meta(k, _) -> k

            System.String.CompareOrdinal(keyOf a, keyOf b))

    /// Apply `ensureStats` to a catalog table.
    let evolveStats (table: string) (stats: TableStatistics) (current: Table) : Table =
        ensureStats table stats |> List.fold applyDelta current

    let private readStat (current: Table) (key: string) : Stat option =
        match Map.tryFind key current with
        | Some(DynamicValue.Int v) ->
            let token =
                match Map.tryFind (StatSourcePrefix + key) current with
                | Some(DynamicValue.String s) -> Some s
                | _ -> None

            Some { Value = v; Source = tokenToSource token }
        | _ -> None

    /// Read back one relation's statistics. **An absent statistic reads back as `None`, not
    /// as a zero or a guess** — the whole reason `TableStatistics` is sparse is so that
    /// "we do not know" survives the round trip.
    let readStats (table: string) (current: Table) : TableStatistics =
        let ndvPrefix = StatNdvPrefix + table + "."

        let distinct =
            current
            |> Map.toList
            |> List.choose (fun (k, _) ->
                if k.StartsWith(ndvPrefix, System.StringComparison.Ordinal) then
                    readStat current k
                    |> Option.map (fun s -> k.Substring(ndvPrefix.Length), s)
                else
                    None)
            |> List.sortWith (fun (a, _) (b, _) -> System.String.CompareOrdinal(a, b))
            |> Map.ofList

        { RowCount = readStat current (statRowsKey table)
          DistinctValues = distinct }
