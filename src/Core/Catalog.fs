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
