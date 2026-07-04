namespace Zeta.Core

/// **ComputeReceipt — thermodynamic accounting for compute allocation (Aaron + Lumen, 2026-07-04).**
///
/// Every computation that consumes a `SoftScheduler` budget emits a `ComputeReceipt`. The receipt
/// captures the five quantities that make the Landauer-limit economics observable:
///
///   • `IV`            — Information Value purchased: KL(posterior ‖ prior) in nats. The revenue.
///   • `DeltaJ`        — Joules spent (abstract): ticks × bytes/tick × Landauer constant. The cost.
///   • `DeltaU`        — Net useful work: IV − DeltaJ. Positive = profitable; negative = heat.
///   • `Heat`          — Wasted compute: DeltaJ where IV ≈ 0. Tracks thermodynamic inefficiency.
///   • `Entropy`       — Remaining uncertainty: H(posterior) in nats. How much is still unknown.
///   • `LandauerRatio` — Efficiency vs. the theoretical minimum: DeltaJ / (IV × kT ln 2 per nat).
///                       1.0 = operating at the Landauer limit. Higher = less efficient.
///
/// **Design principles (Eve's small-rooms law, 2026-07-04):**
/// "Rooms should be small so you can know easily what went wrong and was uncertain."
/// A small room has low entropy. A failing small room has a tight failure surface. The `Entropy`
/// field makes this observable: a well-designed room has low posterior entropy after running.
///
/// **Max mode economics (§11, 2026-07-04):**
/// Switch to max mode IFF `EIV_max − DeltaJ_max > EIV_normal − DeltaJ_normal`.
/// The `DeltaU` field is the per-computation realization of this decision. Aggregate `DeltaU`
/// over many runs to learn which task classes benefit from larger budgets.
///
/// **Landauer limit (§11.2):**
/// The theoretical minimum energy per bit erased is kT ln 2 ≈ 2.8 × 10⁻²¹ J at 300 K.
/// `LandauerRatio` = 1.0 means the computation spent exactly the minimum energy per nat of IV
/// purchased. In practice this is never achieved; the ratio is a benchmark for improvement.
///
/// Additive module — no edit to `SoftValue.fs`, `SoftValueInfo.fs`, or `SoftScheduler.fs`.
[<RequireQualifiedAccess>]
module ComputeReceipt =

    /// The Landauer limit: kT ln 2 in joules at 300 K (room temperature).
    /// Used as the normalization constant for `LandauerRatio`.
    /// Abstract: in the scheduler, "joules" are budget tokens (ticks × bytes/tick). The ratio
    /// is dimensionless and meaningful even when the absolute joule value is not.
    [<Literal>]
    let LandauerConstant = 2.805e-21 // kT ln 2 at 300 K in joules

    /// The abstract "joules" cost of a budget: ticks × bytesPerTick, normalized to a float.
    /// This is the cost side of the Landauer economics. In a real system, multiply by
    /// `LandauerConstant` to get physical joules; in the scheduler, treat as budget tokens.
    let deltaJ (timeTicks: int) (bytesPerTick: int64) : float =
        float timeTicks * float bytesPerTick

    /// A compute receipt: the five thermodynamic quantities for one computation.
    type Receipt =
        { /// Information Value purchased: KL(posterior ‖ prior) in nats. The revenue.
          IV: float
          /// Abstract joules spent: ticks × bytes/tick. The cost.
          DeltaJ: float
          /// Net useful work: IV − DeltaJ. Positive = profitable; negative = heat.
          DeltaU: float
          /// Wasted compute: DeltaJ where IV ≈ 0. Tracks thermodynamic inefficiency.
          Heat: float
          /// Remaining uncertainty: H(posterior) in nats. How much is still unknown.
          Entropy: float
          /// Efficiency vs. the Landauer limit: DeltaJ / max(IV, ε).
          /// 1.0 = operating at the theoretical minimum. Higher = less efficient.
          LandauerRatio: float }

    [<Literal>]
    let private EPS = 1e-12

    /// Compute a receipt given:
    ///   - `prior`    : the `SoftValue` before the computation ran
    ///   - `posterior`: the `SoftValue` after the computation ran
    ///   - `ticks`    : how many scheduler ticks were consumed
    ///   - `bytesPerTick`: the throughput budget (bytes/tick)
    ///
    /// Returns `None` if the prior or posterior is empty (degenerate case).
    let compute
        (prior: SoftValue.SoftValue)
        (posterior: SoftValue.SoftValue)
        (ticks: int)
        (bytesPerTick: int64)
        : Receipt option =
        // Guard: degenerate distributions
        if SoftValue.candidates prior = [] || SoftValue.candidates posterior = [] then
            None
        else
            let iv = SoftValueInfo.klDivergence posterior prior
            let dj = deltaJ ticks bytesPerTick
            let du = iv - dj
            let heat = if iv < EPS then dj else 0.0
            let entropy = SoftValue.entropy posterior
            let ratio = dj / (max iv EPS)
            Some
                { IV = iv
                  DeltaJ = dj
                  DeltaU = du
                  Heat = heat
                  Entropy = entropy
                  LandauerRatio = ratio }

    /// Aggregate multiple receipts into a summary (for Prometheus/Grafana export).
    type Summary =
        { TotalIV: float
          TotalDeltaJ: float
          TotalDeltaU: float
          TotalHeat: float
          MeanEntropy: float
          MeanLandauerRatio: float
          Count: int }

    /// Aggregate a list of receipts into a summary. Returns `None` if the list is empty.
    let summarize (receipts: Receipt list) : Summary option =
        match receipts with
        | [] -> None
        | rs ->
            let n = List.length rs
            Some
                { TotalIV = rs |> List.sumBy _.IV
                  TotalDeltaJ = rs |> List.sumBy _.DeltaJ
                  TotalDeltaU = rs |> List.sumBy _.DeltaU
                  TotalHeat = rs |> List.sumBy _.Heat
                  MeanEntropy = rs |> List.averageBy _.Entropy
                  MeanLandauerRatio = rs |> List.averageBy _.LandauerRatio
                  Count = n }
