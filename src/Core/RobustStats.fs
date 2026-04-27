namespace Zeta.Core

open System


/// **Robust statistical aggregation** — median plus median-absolute-
/// deviation (MAD) with an outlier filter. The canonical operational
/// shape for numeric-oracle aggregation proposed in Amara's 10th
/// courier ferry (`docs/aurora/2026-04-23-amara-aurora-deep-research-
/// report-10th-ferry.md`) — first graduation from the Amara-
/// absorb-to-ship cadence (see the Otto-105 feedback memory
/// `feedback_amara_contributions_must_operationalize_*_2026-04-24`).
///
/// **Why this shape** — the arithmetic mean inherits everything bad
/// about every sample, including the ones that are wrong. The
/// median survives half its inputs being adversarial. MAD is to the
/// median what standard deviation is to the mean: a scale estimate
/// that also survives outliers. The 3-sigma-equivalent filter
/// (`|x - median| <= 3 * max(MAD, epsilon)`) is the classical robust-
/// aggregation move; `epsilon` is a degenerate-input floor that
/// stops the filter from collapsing to "median only" when the
/// sample is perfectly uniform and MAD = 0.
///
/// **Relation to Zeta substrate** — this is a pure-function helper
/// for downstream oracle / bullshit-detector / reputation-aggregation
/// code; it does not depend on the Z-set algebra or the operator
/// graph and does not need a streaming/incremental variant at this
/// scale. If incremental-median is needed later, that's a separate
/// module (t-digest / p-squared / HdrHistogram territory).
///
/// **Anti-consensus framing** — the implementation follows Amara's
/// explicit rationale: *"agreement alone is not proof; what matters
/// is independent, bounded, falsifiable convergence."* The robust
/// aggregate reduces one mechanical failure mode — "a few loud
/// outliers pull the mean" — without claiming it resolves
/// independence-of-sources (that's `antiConsensusGate` territory,
/// a separate graduation).
[<AutoOpen>]
module RobustStats =

    /// Degenerate-MAD floor used by `robustAggregate` when the
    /// sample's MAD collapses to zero (all values equal, or
    /// insufficient sample). `1e-9` matches Amara's 10th-ferry
    /// snippet; any positive floor is fine.
    [<Literal>]
    let MadFloor = 1e-9

    /// Median of a sequence of `double`. Returns `None` on empty
    /// input. Ties at even-length split to the arithmetic mean of
    /// the two centre elements (the standard R-7 convention).
    let median (xs: double seq) : double option =
        let arr = Seq.toArray xs
        if arr.Length = 0 then None
        else
            Array.Sort(arr)
            let n = arr.Length
            if n % 2 = 1 then Some arr.[n / 2]
            else Some ((arr.[n / 2 - 1] + arr.[n / 2]) / 2.0)

    /// Median-absolute-deviation around the sample's own median.
    /// `None` on empty input. Uses the raw MAD definition (no
    /// Gaussian-consistency scale factor `1.4826`; callers can apply
    /// if they want standard-deviation-equivalent units).
    let mad (xs: double seq) : double option =
        let arr = Seq.toArray xs
        if arr.Length = 0 then None
        else
            match median arr with
            | None -> None
            | Some m ->
                let devs = arr |> Array.map (fun x -> abs (x - m))
                median devs

    /// **Robust aggregate** — drop outliers outside
    /// `|x - median| <= 3 * max(MAD, MadFloor)`, then return the
    /// median of the kept set. `None` on empty input.
    ///
    /// Amara's 10th-ferry F# snippet (preserved verbatim in
    /// `docs/aurora/2026-04-23-amara-aurora-deep-research-report-
    /// 10th-ferry.md` under §Prioritized implementation plan)
    /// reproduced here against Zeta's `Array`-first shape:
    ///
    /// ```
    /// let robustAggregate (xs: float list) =
    ///     let median = Statistics.median xs
    ///     let mad = Statistics.median (xs |> List.map (fun x -> abs (x - median)))
    ///     let kept = xs |> List.filter (fun x -> abs (x - median) <= 3.0 * max mad 1e-9)
    ///     Statistics.median kept
    /// ```
    let robustAggregate (xs: double seq) : double option =
        let arr = Seq.toArray xs
        if arr.Length = 0 then None
        else
            match median arr with
            | None -> None
            | Some m ->
                match mad arr with
                | None -> Some m
                | Some d ->
                    let threshold = 3.0 * max d MadFloor
                    let kept = arr |> Array.filter (fun x -> abs (x - m) <= threshold)
                    median kept

    /// **Robust z-score.** Given a `baseline` distribution
    /// and a `measurement`, return
    /// `(measurement - median(baseline)) / (1.4826 * MAD(baseline))`.
    /// The 1.4826 constant scales MAD to be consistent with
    /// the standard deviation of a normal distribution (so
    /// robust z-scores are directly comparable to ordinary
    /// z-scores when the baseline actually IS normal).
    ///
    /// Returns `None` when the baseline is empty. When
    /// MAD collapses to zero (every baseline value
    /// identical), `MadFloor` is substituted so the
    /// function returns `Some` finite value rather than
    /// `None` or infinity — the floor reflects "scale is
    /// below epsilon" rather than "scale is undefined."
    /// Per Copilot review thread 59VhYb: the earlier doc
    /// contradicted the implementation by claiming None
    /// on MAD=0; the implementation is the contract.
    ///
    /// Why robust z-scores for adversarial data: ordinary
    /// z-scores assume Gaussian baseline; an attacker can
    /// poison a ~normal distribution by adding a few outliers
    /// that inflate the standard deviation, making subsequent
    /// real attacks look "within one sigma" and evade
    /// detection. Median+MAD survives ~50% adversarial
    /// outliers.
    ///
    /// Provenance: Amara 17th-ferry Part 2 correction #4
    /// (robust statistics for adversarial data in
    /// CoordinationRiskScore composition).
    let robustZScore (baseline: double seq) (measurement: double) : double option =
        // Materialize the baseline once. `median` + `mad`
        // both need to walk the sequence; re-enumerating
        // `double seq` costs O(n) twice AND can yield
        // inconsistent results if the seq is lazy/non-
        // repeatable (Copilot review thread 59VhYq).
        let baselineArr = Seq.toArray baseline
        match median baselineArr with
        | None -> None
        | Some med ->
            match mad baselineArr with
            | None -> None
            | Some m ->
                let scale = 1.4826 * max m MadFloor
                let z = (measurement - med) / scale
                // Per Codex review on PR #26 (P2): if `measurement`
                // is non-finite (NaN / ±Infinity), the ratio is also
                // non-finite. Returning Some NaN propagates silently
                // through downstream `coordinationRiskScore` arithmetic
                // and corrupts the score. Match the same NaN-guard
                // pattern as `TemporalCoordinationDetection`'s
                // Pearson + circular-mean (Otto-358 fix).
                if Double.IsFinite z then Some z else None
