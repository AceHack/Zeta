namespace Zeta.Core

open System
open System.Collections.Generic
open System.Runtime.CompilerServices
open System.Text


/// Query plan metadata — per-operator estimates produced by a single topo walk over the
/// circuit. Used by `Circuit.Explain()` to produce a cost-annotated plan tree, and by
/// anything that wants to *choose* between two physical operators that compute the same
/// result.
///
/// **Register: `unmetered`** (`.claude/rules/toy-is-free-metered-must-be-earned.md`).
/// Implemented, used, and constrained by tests that pin the *formulas* — but not by any
/// measurement. The nanosecond weights below have never been calibrated against a
/// benchmark; what is earned is their **ordering** (a random-write hash insert costs more
/// per row than a sequential merge step), not their magnitudes. Read them as a ranking,
/// never as a timing. Do not promote.
///
/// **What this buys, stated honestly.** Leis, Gubichev, Mirchev, Boncz, Kemper &amp; Neumann,
/// *How Good Are Query Optimizers, Really?* (PVLDB 9(3), 2015) and their 2025 retrospective
/// (PVLDB 18(12)) both find that **cost-model error is dwarfed by cardinality-estimation
/// error**. So distinguishing these two joins buys operator **choice** — the planner can now
/// express a preference at all, which it provably could not before — and it does **not** buy
/// speed. Speed lives in the cardinality estimates, which here are still static heuristics.
[<Struct>]
type OpCost = {
    /// Estimated output cardinality (Selinger's `NCARD` propagated through the plan).
    EstimatedRows: int64
    /// Estimated distinct values of the key this operator's output is (or would be) joined
    /// on — Selinger's `ICARD`. This is the **denominator** of the join-cardinality formula.
    EstimatedDistinctKeys: int64
    /// Estimated CPU nanoseconds for this operator alone (not cumulative over its inputs).
    EstimatedCpuNanos: int64
    /// `true` when this operator's output already carries key order — Selinger 1979's
    /// **interesting order**, materialised. A sort-merge join over ordered inputs pays no
    /// sort, and this flag is what lets the cost model price that at zero.
    DeliversKeyOrder: bool
    /// The **weakest** provenance among the catalog statistics this estimate derives from.
    /// A formula over a planner default is itself a default; propagating the weakest value
    /// is what stops an unmeasured number from reading like a measured one downstream.
    StatisticsSource: StatSource
}


/// Analytic cost model over catalog statistics — cardinality propagation plus a
/// per-operator CPU term that reflects each physical operator's actual algorithmic shape.
///
/// Anchor (Beacon): Selinger et al., SIGMOD 1979 (access-path selection over catalog
/// statistics; interesting orders). Sort-merge / hash comparison: Shapiro,
/// *Join Processing in Database Systems with Large Main Memories*, TODS 11(3), 1986;
/// Graefe, *Query Evaluation Techniques for Large Databases*, ACM Computing Surveys 25(2),
/// 1993 §4.
[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module Plan =

    // ── Named fallbacks ───────────────────────────────────────────────────────────
    // Every constant an absent statistic degrades to is named here. The point of the
    // naming is that `Explain` can then say `stats=default` beside the number, so nobody
    // reads a fallback as a measurement.

    /// Rows assumed for a source with no catalog row-count statistic.
    [<Literal>]
    let DefaultSourceRows = 1024L

    // ── Per-row nanosecond weights (UNCALIBRATED — ordering only) ─────────────────

    /// Hash-join build side: hash the key and insert into the table. Charged more per row
    /// than a probe because the insert is a random write that dirties a cache line and,
    /// past a working-set threshold this model does not attempt to locate, spills.
    [<Literal>]
    let HashBuildNanosPerRow = 60L

    /// Hash-join probe side: hash the key and look it up.
    [<Literal>]
    let HashProbeNanosPerRow = 30L

    /// Sort-merge join: advance one cursor over an already-sorted run. Sequential,
    /// prefetch-friendly, the cheapest per-row step in the model — which is exactly why an
    /// interesting order is worth having.
    [<Literal>]
    let MergeNanosPerRow = 10L

    /// Sort cost is charged per row **per comparison level**, i.e. `n * ceil(log2 n)` steps.
    [<Literal>]
    let SortNanosPerRowPerLevel = 12L

    /// Materialising one output row (allocate/copy the combined tuple, consolidate).
    [<Literal>]
    let EmitNanosPerRow = 40L

    /// Every operator without a bespoke cost function: the legacy flat per-row charge.
    [<Literal>]
    let DefaultNanosPerRow = 40L

    /// Floor on the row count used for the default per-operator CPU charge — preserves the
    /// original `max 40L rows * 40L` behaviour so a trivial operator is never free.
    [<Literal>]
    let MinChargedRows = 40L

    // ── Small helpers ─────────────────────────────────────────────────────────────

    /// `ceil(log2 n)` for `n >= 1`, computed in integers so the model stays exactly
    /// reproducible across the four oracles (no float rounding to diverge on).
    let internal log2Levels (n: int64) : int64 =
        if n <= 1L then 0L
        else
            let mutable levels = 0L
            let mutable v = n - 1L
            while v > 0L do
                v <- v >>> 1
                levels <- levels + 1L
            levels

    /// Distinct keys can never exceed rows, and never drop below one.
    let internal clampDistinct (rows: int64) (distinct: int64) : int64 = max 1L (min rows distinct)

    /// **Cost of establishing the required order.** Zero when the input already carries it —
    /// Selinger's interesting order, materialised and therefore free at join time. This is
    /// the single line that stops a sort-merge join over `IndexedZSet` inputs (which are
    /// sorted **by construction**) from being charged for a sort it does not perform.
    let internal sortNanos (alreadyOrdered: bool) (rows: int64) : int64 =
        if alreadyOrdered then 0L else rows * log2Levels rows * SortNanosPerRowPerLevel

    /// **Hash join** — the shape `ZSet.join` actually has: build a `Dictionary` over the
    /// right input, then stream the left input through it as probes. Asymmetric on purpose:
    /// the cost is sensitive to which side is the **build** side, because that is the real
    /// property that decides whether a hash join is a good idea.
    let internal hashJoinNanos (buildRows: int64) (probeRows: int64) (outRows: int64) : int64 =
        max DefaultNanosPerRow (
            buildRows * HashBuildNanosPerRow
            + probeRows * HashProbeNanosPerRow
            + outRows * EmitNanosPerRow)

    /// **Sort-merge join** — the shape `IndexedZSet.join` actually has: one linear merge
    /// walk over two key-sorted runs. Cheap per row, but it *requires* the order, so its
    /// cost is dominated by whether the inputs already have it.
    let internal sortMergeJoinNanos
        (leftOrdered: bool)
        (rightOrdered: bool)
        (leftRows: int64)
        (rightRows: int64)
        (outRows: int64)
        : int64 =
        max DefaultNanosPerRow (
            sortNanos leftOrdered leftRows
            + sortNanos rightOrdered rightRows
            + (leftRows + rightRows) * MergeNanosPerRow
            + outRows * EmitNanosPerRow)

    /// Selinger's equi-join cardinality: `|A| * |B| / max(ICARD_A, ICARD_B)`.
    /// With no statistics the distinct counts fall back to the row counts (the
    /// "assume every key is unique" default), and this collapses to the historical
    /// `(a * b) / max a b` — so an unconfigured planner behaves exactly as it did before.
    let internal joinRows (leftRows: int64) (rightRows: int64) (leftDistinct: int64) (rightDistinct: int64) : int64 =
        (leftRows * rightRows) / max 1L (max leftDistinct rightDistinct)

    /// The default per-operator CPU charge for operators with no bespoke cost function.
    let internal defaultNanos (rows: int64) : int64 = (max MinChargedRows rows) * DefaultNanosPerRow

    // ── The estimator ─────────────────────────────────────────────────────────────

    /// An input whose cost has not been computed (a dangling dependency). Degrades to the
    /// named source defaults rather than to a bare literal.
    let internal unknownInput : OpCost =
        { EstimatedRows = DefaultSourceRows
          EstimatedDistinctKeys = DefaultSourceRows
          EstimatedCpuNanos = defaultNanos DefaultSourceRows
          DeliversKeyOrder = false
          StatisticsSource = StatSource.DefaultNoStatistic }

    /// Cardinality + CPU + physical properties for one operator, keyed on its `Name`.
    ///
    /// `sourceStats` is consulted only for `"input"` operators; everything else derives
    /// from its inputs.
    let internal estimateOp
        (opName: string)
        (sourceStats: SourceStatistics option)
        (inputs: OpCost array)
        : OpCost =

        // Provenance folds weakest-wins across the inputs.
        let inheritedSource =
            if inputs.Length = 0 then
                StatSource.DefaultNoStatistic
            else
                inputs
                |> Array.fold (fun acc c -> CatalogStatistics.weaker acc c.StatisticsSource) StatSource.Measured

        /// An operator with no bespoke CPU cost: rows + distinct + whether order survives.
        let plain (rows: int64) (distinct: int64) (ordered: bool) : OpCost =
            let r = max 1L rows
            { EstimatedRows = r
              EstimatedDistinctKeys = clampDistinct r distinct
              EstimatedCpuNanos = defaultNanos r
              DeliversKeyOrder = ordered
              StatisticsSource = inheritedSource }

        match opName, inputs with
        | "input", _ ->
            let stats = defaultArg sourceStats CatalogStatistics.emptySource
            let rowStat = CatalogStatistics.orDefault DefaultSourceRows stats.RowCount
            // Absent NDV degrades to "assume every key is unique" — named, and chosen so the
            // Selinger formula reproduces the pre-statistics behaviour exactly.
            let ndvStat = CatalogStatistics.orDefault rowStat.Value stats.DistinctKeys
            let rows = max 1L rowStat.Value
            // A `ZSetInput` IS sorted (ZSet is sorted by construction) — but it is sorted on
            // the *element*, which is not in general the join key. Claiming the order here
            // would be the free-lunch error: only `indexWith` establishes order ON A KEY.
            { EstimatedRows = rows
              EstimatedDistinctKeys = clampDistinct rows ndvStat.Value
              EstimatedCpuNanos = defaultNanos rows
              DeliversKeyOrder = false
              StatisticsSource = CatalogStatistics.weaker rowStat.Source ndvStat.Source }

        // ── Linear / order-destroying ────────────────────────────────────────────
        // `map` and `flatMap` may rewrite the key, so key order does not survive them.
        | "map", [| a |] -> plain a.EstimatedRows a.EstimatedDistinctKeys false
        | "flatMap", [| a |] -> plain (a.EstimatedRows * 2L) a.EstimatedDistinctKeys false

        // ── Order-preserving ─────────────────────────────────────────────────────
        // `filter` removes rows without reordering or re-keying them.
        | "filter", [| a |] -> plain (a.EstimatedRows / 2L) a.EstimatedDistinctKeys a.DeliversKeyOrder
        | "neg", [| a |] -> plain a.EstimatedRows a.EstimatedDistinctKeys a.DeliversKeyOrder
        | "z^-1", [| a |] -> plain a.EstimatedRows a.EstimatedDistinctKeys a.DeliversKeyOrder
        | "differentiate", [| a |] -> plain a.EstimatedRows a.EstimatedDistinctKeys a.DeliversKeyOrder
        | "integrate", [| a |] -> plain (a.EstimatedRows * 2L) a.EstimatedDistinctKeys a.DeliversKeyOrder
        | "distinct", [| a |] ->
            let rows = a.EstimatedRows / 2L
            plain rows rows a.DeliversKeyOrder
        | "plus", [| a ; b |] ->
            plain (a.EstimatedRows + b.EstimatedRows)
                  (a.EstimatedDistinctKeys + b.EstimatedDistinctKeys)
                  (a.DeliversKeyOrder && b.DeliversKeyOrder)
        | "minus", [| a ; b |] ->
            plain (a.EstimatedRows + b.EstimatedRows)
                  (a.EstimatedDistinctKeys + b.EstimatedDistinctKeys)
                  (a.DeliversKeyOrder && b.DeliversKeyOrder)

        // ── Aggregation ──────────────────────────────────────────────────────────
        | "groupBySum", [| a |] -> let r = a.EstimatedRows / 4L in plain r r false
        | "count", [| a |] -> let r = a.EstimatedRows / 4L in plain r r false
        | "average", [| a |] -> let r = a.EstimatedRows / 4L in plain r r false

        // ── `indexWith` — where the interesting order is PAID FOR ────────────────
        // `IndexedZSet.indexWith` builds a key-sorted structure. That sort is charged here,
        // once, and every downstream sort-merge join then reuses it for free. Making the
        // order free at the join AND free to establish would be the free lunch.
        | "indexWith", [| a |] ->
            let rows = max 1L a.EstimatedRows
            { EstimatedRows = rows
              EstimatedDistinctKeys = clampDistinct rows a.EstimatedDistinctKeys
              EstimatedCpuNanos =
                max DefaultNanosPerRow (sortNanos false rows + rows * MergeNanosPerRow)
              DeliversKeyOrder = true
              StatisticsSource = inheritedSource }

        // ── The two physical joins — DIFFERENT cost functions ────────────────────
        // `ZSet.join` is a HASH join: `Dictionary` over `b` (build), stream `a` (probe).
        | "join", [| a ; b |] ->
            let rows =
                max 1L (joinRows a.EstimatedRows b.EstimatedRows a.EstimatedDistinctKeys b.EstimatedDistinctKeys)
            { EstimatedRows = rows
              EstimatedDistinctKeys = clampDistinct rows (min a.EstimatedDistinctKeys b.EstimatedDistinctKeys)
              EstimatedCpuNanos = hashJoinNanos b.EstimatedRows a.EstimatedRows rows
              // A hash join emits in probe-then-consolidate order; no key order survives.
              DeliversKeyOrder = false
              StatisticsSource = inheritedSource }

        // `IndexedZSet.join` is a SORT-MERGE join: one merge walk over two key-sorted runs.
        | "indexedJoin", [| a ; b |] ->
            let rows =
                max 1L (joinRows a.EstimatedRows b.EstimatedRows a.EstimatedDistinctKeys b.EstimatedDistinctKeys)
            { EstimatedRows = rows
              EstimatedDistinctKeys = clampDistinct rows (min a.EstimatedDistinctKeys b.EstimatedDistinctKeys)
              EstimatedCpuNanos =
                sortMergeJoinNanos a.DeliversKeyOrder b.DeliversKeyOrder a.EstimatedRows b.EstimatedRows rows
              // The output is a `ZSet<'C>` of combined tuples, not a keyed index.
              DeliversKeyOrder = false
              StatisticsSource = inheritedSource }

        | "cartesian", [| a ; b |] ->
            let rows = max 1L (a.EstimatedRows * b.EstimatedRows)
            plain rows rows false

        // ── Scalar-shaped operators ──────────────────────────────────────────────
        // These produce a single value, not a relation. The wildcard used to hand them
        // their input's cardinality, which is how `Plan scalar count gives 1-row estimate`
        // came to be named after a number the model never produced.
        | ("scalarCount" | "scalarSum" | "scalarFold" | "input-scalar" | "const"), _ ->
            plain 1L 1L false

        | _, remaining ->
            let a = if remaining.Length > 0 then remaining.[0] else unknownInput
            plain a.EstimatedRows a.EstimatedDistinctKeys false

    // ── Plan walk ─────────────────────────────────────────────────────────────────

    /// Compute plan costs for every operator in the circuit via a single topo walk,
    /// consulting `sourceStats` for each source (`"input"`) operator by its `Op.Id`.
    ///
    /// The caller that built the circuit is the one that knows which input operator reads
    /// which relation, so the mapping is supplied here rather than guessed. `None` for an
    /// operator means "no statistics", which degrades to the named fallbacks above.
    let computeWith (sourceStats: int -> SourceStatistics option) (circuit: Circuit) : Dictionary<int, OpCost> =
        circuit.Build()
        let costs = Dictionary<int, OpCost>()
        for op in circuit.Ops do
            let inputs =
                op.Inputs |> Array.map (fun d ->
                    match costs.TryGetValue d.Id with
                    | true, c -> c
                    | _ -> unknownInput)
            costs.[op.Id] <- estimateOp op.Name (sourceStats op.Id) inputs
        costs

    /// Compute plan costs with **no** catalog statistics — every source degrades to
    /// `DefaultSourceRows` and the "assume every key is unique" distinct-value fallback, and
    /// every resulting estimate is labelled `StatSource.DefaultNoStatistic`.
    let compute (circuit: Circuit) : Dictionary<int, OpCost> = computeWith (fun _ -> None) circuit


[<Extension>]
type PlanExtensions =

    /// Human-readable explain plan with per-operator cost estimates.
    /// Format mirrors `EXPLAIN` output: each line is
    /// `id: name (rows≈N, ndv≈M, ns≈K, stats=S) [inputs]`, with `ordered` appended when the
    /// operator delivers an interesting order.
    [<Extension>]
    static member Explain(this: Circuit) : string =
        let costs = Plan.compute this
        let sb = StringBuilder()
        sb.AppendLine $"Circuit (%d{this.OperatorCount} operators):" |> ignore
        for op in this.Ops do
            let cost = costs.[op.Id]
            let depIds =
                op.Inputs
                |> Array.map (fun d -> (d.Id: int).ToString())
                |> String.concat ","
            let deps =
                if String.IsNullOrEmpty depIds then "source"
                else $"[%s{depIds}]"
            let strict = if op.IsStrict then " *strict*" else ""
            let ordered = if cost.DeliversKeyOrder then " ordered" else ""
            let stats =
                match cost.StatisticsSource with
                | StatSource.Measured -> "measured"
                | StatSource.UpperBoundNotRetractionSafe -> "upper-bound"
                | StatSource.DefaultNoStatistic -> "default"
            sb.AppendLine
                $"  %d{op.Id}: %s{op.Name}%s{strict} (rows≈%d{cost.EstimatedRows}, ndv≈%d{cost.EstimatedDistinctKeys}, ns≈%d{cost.EstimatedCpuNanos}, stats=%s{stats})%s{ordered} %s{deps}"
            |> ignore
        sb.ToString()

    /// Per-operator cost map (for programmatic use).
    [<Extension>]
    static member Costs(this: Circuit) : IReadOnlyDictionary<int, OpCost> =
        Plan.compute this :> IReadOnlyDictionary<int, OpCost>

    /// Per-operator cost map computed against catalog statistics supplied per source
    /// operator id.
    [<Extension>]
    static member Costs(this: Circuit, sourceStats: Func<int, SourceStatistics option>) : IReadOnlyDictionary<int, OpCost> =
        Plan.computeWith sourceStats.Invoke this :> IReadOnlyDictionary<int, OpCost>
