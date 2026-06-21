namespace Zeta.Core

/// GeneratorCatalog — **the SQL over the generator catalog: SELECT a categoried generator, get its
/// ZetaId, unfold from its seed** (ferry 37: "WHY = ZetaId = a specific generator with category…";
/// Aaron 2026-06-12: "that one already has a cart we made we just need the SQL").
///
/// The `GeneratorRegistry` is the STORE (generators-with-seeds, content-addressed). This is the
/// QUERY side: the registry's `known` entries read as a RELATION — one row per generator, the
/// CATEGORY (the dotted-name prefix: `shape`, `algebra`, `boundary`, `shader`, …) projected out as
/// a first-class column. The query shape is relational combinators (FROM = `rows`, WHERE = `where`,
/// SELECT = ordinary projection over the result) rather than a SQL-string parser — a parser is a
/// large permanent contract surface; combinators are total, minimal, and compose. The DBSP path
/// (the catalog as a Z-set, a query as an incremental circuit) is the future, not this MVP.
///
/// Surface scoped to Ilyana's v1 review (public-api-designer, PR #8013): `Row` WRAPS the registry
/// `Entry` (carries it, never copies its fields — so Entry-growth flows through, no drift); the
/// exposed members are the minimum that serves the unfold path (`rows`/`where`/`categories`/
/// `byCategory` + the one earned predicate `inCategory`); projections (zetaIds, name lookup,
/// other predicates) are left to the consumer's `map`/`where` rather than named — add a member
/// when a real second consumer asks, not before.
///
/// Culture-invariant by default (081KT07NV0008QG0R001YDB73K): all string comparison is `StringComparer.Ordinal` /
/// ordinal `IndexOf` — categories must sort and match identically on every machine (the catalog is
/// shared substrate; a locale-sorted category list would diverge across nodes).
[<RequireQualifiedAccess>]
module GeneratorCatalog =

    open System

    /// A catalog row: the registry `Entry` (carried, not copied) plus its CATEGORY projected as the
    /// one genuinely-new column. Read `r.Entry.ZetaId` / `.Name` / `.Version`; `Category` is derived.
    /// (Wrap-don't-copy per Ilyana P1-1 — if `Entry` grows a column, `Row` inherits it for free.)
    type Row =
        { Entry: GeneratorRegistry.Entry
          Category: string }

    /// The category of a generator name: the prefix before the first '.', ordinal — or the whole
    /// name if it has no dot (a category-less generator is its own category).
    let categoryOf (name: string) : string =
        match name.IndexOf('.', StringComparison.Ordinal) with
        | -1 -> name
        | i -> name.Substring(0, i)

    /// FROM: the catalog as a relation — every known generator, one row, category projected.
    let rows: Row list =
        GeneratorRegistry.known
        |> List.map (fun e -> { Entry = e; Category = categoryOf e.Name })

    /// SELECT DISTINCT category — the catalog's categories, ordinal-sorted (stable across machines).
    let categories: string list =
        rows
        |> List.map (fun r -> r.Category)
        |> List.distinct
        |> List.sortWith (fun a b -> String.CompareOrdinal(a, b))

    /// WHERE: filter rows by a predicate (the general query; SELECT is ordinary projection after,
    /// e.g. `byCategory "shape" |> List.map (fun r -> r.Entry.ZetaId)` — the unfold path).
    let where (predicate: Row -> bool) : Row list = rows |> List.filter predicate

    /// The one earned predicate: rows in a given category (ordinal exact match). Earns a name
    /// because it is the headline filter AND it encodes the ordinal-match discipline for consumers.
    let inCategory (category: string) (r: Row) : bool =
        String.Equals(r.Category, category, StringComparison.Ordinal)

    /// SELECT * WHERE category = … (the headline query: every generator of a kind — its ZetaIds
    /// are then `|> List.map (fun r -> r.Entry.ZetaId)`, the addresses a `gen` line unfolds from).
    let byCategory (category: string) : Row list = where (inCategory category)
