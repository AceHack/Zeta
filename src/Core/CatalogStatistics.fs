namespace Zeta.Core

/// **Catalog statistics — the numbers a Selinger-style cost model is a formula OVER.**
///
/// Anchor (Beacon): Selinger, Astrahan, Chamberlin, Lorie &amp; Price, *Access Path Selection
/// in a Relational Database Management System*, SIGMOD 1979. Their cost model is not a
/// formula over the query text — it is a formula over **catalog statistics**: `NCARD`
/// (relation cardinality) and `ICARD` (index distinct keys) in the paper's notation.
/// Zeta shipped the formula shape and none of the statistics, so every number the planner
/// produced was a constant wearing an estimate's clothes.
///
/// **Register: `unmetered`** (`.claude/rules/toy-is-free-metered-must-be-earned.md`). The
/// structure below is real and honestly typed. Nothing in it is calibrated against a
/// measured workload, and no falsifier here can refuse a *wrong* number — only a
/// *mislabelled* one. Do not promote it.
///
/// **The one thing this module refuses to do.** It does not source `DistinctKeys` from the
/// shipped HyperLogLog sketch (`Sketch.fs`). HLL merges by `max` over its registers and has
/// no decrement, so on a retracting DBSP stream it counts *keys ever seen*, never *keys
/// currently present*. Distinct-values sits in the **denominator** of the join-cardinality
/// formula, so a monotonically-growing NDV deflates the join estimate monotonically — a
/// planner that gets quietly more wrong the longer the stream runs. A distinct-value
/// estimate is admissible here only if it is retraction-correct, or if it is labelled
/// `UpperBoundNotRetractionSafe` so the consumer can see what it is holding.
[<RequireQualifiedAccess>]
type StatSource =
    /// Counted exactly from the relation as it currently stands.
    | Measured
    /// A sketch or bound that is genuinely an upper bound but is **not** retraction-safe
    /// (an HLL-style monotone estimator over a stream that retracts). Honest to hold,
    /// dishonest to treat as `Measured`.
    | UpperBoundNotRetractionSafe
    /// No statistic exists. The value accompanying this label is a **named planner
    /// default**, not a measurement of anything.
    | DefaultNoStatistic


/// One cardinality number **plus where it came from**. The pairing is the whole point:
/// an unmeasured quantity must never be indistinguishable from a measured one at the site
/// that consumes it.
[<Struct>]
type Stat = {
    Value: int64
    Source: StatSource
}


/// What the planner consumes for **one source stream**: how many rows it carries, and how
/// many distinct values the column it is keyed/joined on takes. This is the projection of a
/// `TableStatistics` onto a single join key — `NCARD` and one column's `ICARD`.
[<Struct>]
type SourceStatistics = {
    RowCount: Stat option
    DistinctKeys: Stat option
}


/// Statistics for one catalog relation: its row count, and per-column distinct-value
/// counts. Both halves are `option`/sparse — a catalog with no statistics is the normal
/// case, and it must stay expressible.
type TableStatistics = {
    RowCount: Stat option
    /// `ICARD` per column name. Absent key ⇒ no statistic for that column.
    DistinctValues: Map<string, Stat>
}


[<RequireQualifiedAccess>]
module CatalogStatistics =

    /// Weakest-wins ordering over provenance: `DefaultNoStatistic` &lt; `UpperBound…` &lt;
    /// `Measured`. A formula over a default **is** a default, and this is how that
    /// propagates through a plan without anyone having to remember to say so.
    let rank (s: StatSource) : int =
        match s with
        | StatSource.DefaultNoStatistic -> 0
        | StatSource.UpperBoundNotRetractionSafe -> 1
        | StatSource.Measured -> 2

    /// The weaker of two provenances — the fold used when an estimate combines inputs.
    let weaker (a: StatSource) (b: StatSource) : StatSource = if rank a <= rank b then a else b

    /// A statistic counted exactly.
    let measured (value: int64) : Stat = { Value = value; Source = StatSource.Measured }

    /// A statistic that is a genuine upper bound but is **not** retraction-safe. Labelled,
    /// never silently promoted to `Measured`.
    let upperBound (value: int64) : Stat =
        { Value = value; Source = StatSource.UpperBoundNotRetractionSafe }

    /// The named fallback: a planner default carrying its own admission that it measured
    /// nothing. Every absent statistic degrades to exactly this, never to a bare number.
    let defaulted (value: int64) : Stat = { Value = value; Source = StatSource.DefaultNoStatistic }

    /// A relation we hold no statistics for at all.
    let emptyTable : TableStatistics = { RowCount = None; DistinctValues = Map.empty }

    /// A source stream we hold no statistics for at all.
    let emptySource : SourceStatistics = { RowCount = None; DistinctKeys = None }

    /// Resolve an optional statistic against a **named** fallback constant. The result is
    /// always a `Stat`, so the caller cannot lose the provenance by accident.
    let orDefault (fallback: int64) (stat: Stat option) : Stat =
        match stat with
        | Some s -> s
        | None -> defaulted fallback

    /// Project a relation's statistics onto one join key — `NCARD` plus that column's
    /// `ICARD`. An unknown column name yields `DistinctKeys = None`, which the planner then
    /// degrades to its named fallback.
    let forJoinKey (column: string) (t: TableStatistics) : SourceStatistics =
        { RowCount = t.RowCount
          DistinctKeys = Map.tryFind column t.DistinctValues }

    /// Record a measured row count.
    let withRowCount (stat: Stat) (t: TableStatistics) : TableStatistics = { t with RowCount = Some stat }

    /// Record a distinct-value count for one column.
    let withDistinctValues (column: string) (stat: Stat) (t: TableStatistics) : TableStatistics =
        { t with DistinctValues = Map.add column stat t.DistinctValues }
