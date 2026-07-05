namespace Zeta.Bayesian

open Zeta.Core

/// **SequentialEnsemble — belief pipeline where each cell's posterior is the next cell's prior.**
///
/// ## The Task.ContinueWith antecedent pattern
///
/// In the standard `YinYangEnsemble`, all N cells observe the *same* sensory input independently
/// and vote on a consensus. This is a *parallel* ensemble: N independent observers, one shared
/// signal, one consensus vote.
///
/// The `SequentialEnsemble` is the *serial* dual: a pipeline of cells where each cell's final
/// posterior Gaussian becomes the *prior* of the next cell. This is exactly the
/// `Task.ContinueWith(antecedent)` pattern:
///
///   Cell₁ observes signal₁ → posterior₁
///   Cell₂ starts from posterior₁, observes signal₂ → posterior₂
///   Cell₃ starts from posterior₂, observes signal₃ → posterior₃
///   ...
///   CellN starts from posteriorN-1, observes signalN → posteriorN
///
/// Each cell is a "continuation" of the previous cell's belief state.
///
/// ## Why this is useful
///
/// 1. **Belief accumulation across heterogeneous signals**: each cell in the pipeline can
///    observe a *different* signal (from a different sensor, a different time step, or a
///    different modality). The pipeline accumulates belief across all of them.
///
/// 2. **Temporal belief chains**: in a Reticulum network, messages arrive at different times.
///    The sequential ensemble models the belief state of a single agent that processes
///    messages in arrival order, each message updating the prior for the next.
///
/// 3. **Conjugate EP/BP update chain**: because each step is a Gaussian × Gaussian product
///    (natural parameter addition), the full pipeline is a single Gaussian posterior with
///    precision = sum of all individual precisions. This is the EP fixed-point for a
///    product-of-Gaussians likelihood model.
///
/// ## Connection to the parallel ensemble
///
/// The parallel ensemble (YinYangEnsemble) and the sequential ensemble are dual in the
/// following sense:
///
/// - **Parallel**: N cells, 1 signal, N independent posteriors → 1 consensus (vote).
/// - **Sequential**: N cells, N signals, 1 accumulated posterior (chain).
///
/// The parallel ensemble is wide (decorrelation via seed diversity).
/// The sequential ensemble is deep (accumulation via temporal chaining).
///
/// Both are pure conjugate Bayesian EP/BP — no neural networks, no gradient descent.
[<RequireQualifiedAccess>]
module SequentialEnsemble =

    // ── Pipeline result ──────────────────────────────────────────────────────────────────────────

    /// The result of running a sequential ensemble pipeline.
    type PipelineResult =
        { /// The final accumulated posterior Gaussian (the belief after all cells have processed).
          FinalPosterior: Gaussian
          /// The intermediate posteriors at each step (for diagnostics and rhoCount measurement).
          Intermediates: Gaussian[]
          /// The total accumulated IV across all cells in the pipeline.
          TotalIV: float
          /// The number of cells (steps) in the pipeline.
          StepCount: int }

    // ── Core sequential update ────────────────────────────────────────────────────────────────────

    /// **Run a sequential pipeline of observations.**
    ///
    /// Each observation in `observations` is processed by a fresh cell seeded from the
    /// corresponding Adinkra codeword. The cell's posterior becomes the prior for the next cell.
    ///
    /// If `codewords` is shorter than `observations`, the codewords are cycled (modular index).
    /// If `observations` is empty, returns an uninformative prior with zero IV.
    ///
    /// This is the `Task.ContinueWith(antecedent)` pattern:
    ///   each cell is a continuation of the previous cell's belief state.
    let runWithCodewords
            (codewords: int[][] )
            (observations: Gaussian list)
            : PipelineResult =
        if observations.IsEmpty then
            { FinalPosterior = { Gaussian.PrecisionMean = 0.0; Precision = 0.0 }
              Intermediates = [||]
              TotalIV = 0.0
              StepCount = 0 }
        else
            let n = codewords.Length
            let intermediates = System.Collections.Generic.List<Gaussian>()
            let mutable prior = { Gaussian.PrecisionMean = 0.0; Precision = 0.0 }
            let mutable totalIV = 0.0

            for (stepIdx, obs) in observations |> List.indexed do
                // Seed a fresh cell from the codeword at this step (cycling if necessary).
                let codeword = codewords.[stepIdx % n]
                let cell = YinYangCell.seed codeword
                // The cell's "prior" is injected by observing the accumulated posterior
                // from the previous step (if non-trivial).
                let cellWithPrior =
                    if prior.Precision > 0.0 then
                        YinYangCell.observe prior cell
                    else
                        cell
                // Now observe the actual signal for this step.
                let cellAfterObs = YinYangCell.observe obs cellWithPrior
                // Extract the posterior Gaussian.
                let posterior = cellAfterObs.Column.Belief
                // Accumulate IV.
                totalIV <- totalIV + float cellAfterObs.Column.AccumulatedIV
                intermediates.Add(posterior)
                prior <- posterior

            { FinalPosterior = prior
              Intermediates = intermediates.ToArray()
              TotalIV = totalIV
              StepCount = observations.Length }

    /// **Run a sequential pipeline using the canonical Adinkra codewords.**
    ///
    /// Uses the 16 Adinkra codewords (cycling if there are more than 16 observations).
    /// This is the recommended default for sequential pipelines.
    let run (observations: Gaussian list) : PipelineResult =
        let codewords = AdinkraCode.allCodewords |> List.toArray
        runWithCodewords codewords observations

    // ── Belief accumulation properties ───────────────────────────────────────────────────────────

    /// The mean of the final posterior (the pipeline's best estimate after all observations).
    /// Returns 0.0 if the posterior is uninformative.
    let finalMean (result: PipelineResult) : float =
        if result.FinalPosterior.Precision <= 0.0 then 0.0
        else result.FinalPosterior.PrecisionMean / result.FinalPosterior.Precision

    /// The precision of the final posterior (the pipeline's confidence after all observations).
    let finalPrecision (result: PipelineResult) : float =
        result.FinalPosterior.Precision

    /// The total information value accumulated across all steps.
    let totalIV (result: PipelineResult) : float =
        result.TotalIV

    // ── Monotonicity check ────────────────────────────────────────────────────────────────────────

    /// **Precision is monotonically non-decreasing along the pipeline.**
    ///
    /// Because each step adds a non-negative precision (Gaussian × Gaussian = precision sum),
    /// the precision of the intermediate posteriors should be non-decreasing.
    ///
    /// Returns `true` if the intermediates are monotonically non-decreasing in precision.
    let isPrecisionMonotone (result: PipelineResult) : bool =
        if result.Intermediates.Length < 2 then true
        else
            result.Intermediates
            |> Array.pairwise
            |> Array.forall (fun (a, b) -> b.Precision >= a.Precision - 1e-9)

    // ── rhoCount for sequential pipeline ─────────────────────────────────────────────────────────

    /// **Temporal decorrelation of the pipeline steps.**
    ///
    /// In a sequential pipeline, each step processes a different number of cumulative observations
    /// (step 1 has processed 1, step 2 has processed 2, etc.). The "bus delay" in a sequential
    /// pipeline is the step index itself.
    ///
    /// This function measures the variance of the intermediate precision values as a proxy for
    /// how much the belief is evolving across the pipeline. A flat precision profile (all steps
    /// have the same precision) indicates the pipeline is not accumulating information.
    ///
    /// Returns the coefficient of variation of the intermediate precisions, clamped to [0, 1].
    let precisionCV (result: PipelineResult) : float =
        if result.Intermediates.Length < 2 then 0.0
        else
            let precisions = result.Intermediates |> Array.map (fun g -> g.Precision)
            let mean = Array.average precisions
            if mean <= 0.0 then 0.0
            else
                let variance = precisions |> Array.averageBy (fun p -> (p - mean) ** 2.0)
                let stddev = sqrt variance
                System.Math.Clamp(stddev / mean, 0.0, 1.0)

    // ── Reconcile to receipt ──────────────────────────────────────────────────────────────────────

    /// Reconcile the pipeline result into a `ComputeReceipt.Receipt`.
    ///   - IV = total accumulated IV across all steps
    ///   - DeltaJ = N (one abstract joule per step)
    ///   - Entropy = Shannon entropy of the normalized intermediate precisions
    let reconcileToReceipt (result: PipelineResult) : ComputeReceipt.Receipt =
        let n = float result.StepCount
        let totalWeight = result.Intermediates |> Array.sumBy (fun g -> g.Precision)
        let entropy =
            if totalWeight <= 0.0 then log (max 1.0 n)
            else
                result.Intermediates
                |> Array.sumBy (fun g ->
                    let p = g.Precision / totalWeight
                    if p <= 0.0 then 0.0 else -p * log p)
        ComputeReceipt.fromIV result.TotalIV n entropy
