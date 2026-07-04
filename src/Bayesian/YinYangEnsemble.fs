namespace Zeta.Bayesian

open Zeta.Core

/// **YinYangEnsemble — N-cell ensemble convergence vote.**
///
/// An ensemble is an array of N `YinYangCell.Cell`s, each seeded from a distinct Adinkra codeword.
/// Each cell is an independent observer (a 1000-brains column): it observes the same sensory stream
/// but maintains its own Gaussian belief, accumulates its own IV, and casts its own vote.
///
/// **The Condorcet consensus:**
/// The ensemble votes by IV-weighted log-linear pooling (`ThousandBrains.computeConsensus`).
/// Condorcet's theorem says: if each voter is independently more likely to be correct than wrong,
/// the majority vote is more reliable than any individual voter. The IV-weighting respects this:
/// columns with more accumulated IV (more experience) have more weight, but the weight is
/// logarithmic (sub-linear) to prevent any single column from dominating.
///
/// **Decorrelation discipline:**
/// The ensemble is only informative while the cells are decorrelated (different seeds → different
/// reference frames → different beliefs). Identical voters add nothing. The Adinkra codeword seeds
/// guarantee structural decorrelation: each of the 16 codewords is a distinct E8 root, so the
/// 16 cells start from 16 distinct identity anchors.
///
/// **Connection to §B (1000-brains ensemble row):**
/// This is the "ensemble convergence vote" open leg of the §B 1000-brains row.
/// The `reconcile` function is the `Reconcile.fs` analogue at the Bayesian layer:
/// it folds N votes into a single consensus Gaussian.
[<RequireQualifiedAccess>]
module YinYangEnsemble =

    // ── Ensemble type ────────────────────────────────────────────────────────────────────────────

    /// An ensemble of N YinYangCells, each seeded from a distinct Adinkra codeword.
    type Ensemble =
        { /// The cells in the ensemble (one per distinct codeword seed).
          Cells: YinYangCell.Cell[]
          /// The current consensus Gaussian (the IV-weighted joint posterior).
          Consensus: Gaussian
          /// The number of observation rounds completed.
          Round: int }

    // ── Construction ─────────────────────────────────────────────────────────────────────────────

    /// Create an ensemble from a list of Adinkra codewords (int[8] each).
    /// Each codeword seeds one cell. The consensus starts as the uninformative prior.
    let create (codewords: int[][] ) : Ensemble =
        { Cells = codewords |> Array.map YinYangCell.seed
          Consensus = { Gaussian.PrecisionMean = 0.0; Precision = 0.0 }
          Round = 0 }

    /// Create the canonical 16-cell ensemble from all 16 Adinkra codewords.
    /// This is the maximal decorrelated ensemble: 16 distinct E8 roots as seeds.
    let createFull () : Ensemble =
        create (AdinkraCode.allCodewords |> List.toArray)

    /// Create a k-cell ensemble from the first k Adinkra codewords (k ≤ 16).
    let createN (k: int) : Ensemble =
        let codewords = AdinkraCode.allCodewords |> List.truncate k |> List.toArray
        create codewords

    // ── Observation round ────────────────────────────────────────────────────────────────────────

    /// Broadcast a sensory input to all cells in the ensemble, then recompute consensus.
    /// Each cell independently observes the input and updates its belief.
    /// The consensus is the IV-weighted log-linear pool of all cell votes.
    let observe (sensoryInput: Gaussian) (ensemble: Ensemble) : Ensemble =
        let updatedCells = ensemble.Cells |> Array.map (YinYangCell.observe sensoryInput)
        let votes = updatedCells |> Array.toList |> List.map YinYangCell.castVote
        let consensus = ThousandBrains.computeConsensus votes
        { ensemble with
            Cells = updatedCells
            Consensus = consensus
            Round = ensemble.Round + 1 }

    // ── Consensus evaluation ─────────────────────────────────────────────────────────────────────

    /// Evaluate the ensemble's consensus state against a precision threshold.
    /// Returns `ResolvedYes`, `ResolvedNo`, or `Undecided`.
    let evaluate (threshold: float) (ensemble: Ensemble) : LocalConsensus.ConsensusState =
        let votes = ensemble.Cells |> Array.toList |> List.map YinYangCell.castVote
        ThousandBrains.evaluateLattice votes threshold

    /// The mean of the consensus Gaussian (the ensemble's best estimate).
    /// Returns 0.0 if the consensus is uninformative (Precision = 0).
    let consensusMean (ensemble: Ensemble) : float =
        if ensemble.Consensus.Precision <= 0.0 then 0.0
        else ensemble.Consensus.PrecisionMean / ensemble.Consensus.Precision

    /// The precision of the consensus Gaussian (the ensemble's confidence).
    let consensusPrecision (ensemble: Ensemble) : float =
        ensemble.Consensus.Precision

    // ── Decorrelation metric ─────────────────────────────────────────────────────────────────────

    /// Compute the pairwise mean-difference variance across all cells.
    /// This is a proxy for decorrelation: high variance = cells are decorrelated (good);
    /// low variance = cells have converged to the same belief (the vote adds nothing).
    ///
    /// Returns the variance of the cell means (0.0 if all cells are uninformative).
    let decorrelationVariance (ensemble: Ensemble) : float =
        let means =
            ensemble.Cells
            |> Array.choose (fun cell ->
                if cell.Column.Belief.Precision > 0.0 then
                    Some (cell.Column.Belief.PrecisionMean / cell.Column.Belief.Precision)
                else None)
        if means.Length < 2 then 0.0
        else
            let avg = Array.average means
            let variance = means |> Array.averageBy (fun m -> (m - avg) ** 2.0)
            variance

    // ── IV summary ───────────────────────────────────────────────────────────────────────────────

    /// Total accumulated IV across all cells in the ensemble.
    let totalIV (ensemble: Ensemble) : float =
        ensemble.Cells |> Array.sumBy (fun cell -> float cell.Column.AccumulatedIV)

    /// The cell with the highest accumulated IV (the most experienced column).
    let leadCell (ensemble: Ensemble) : YinYangCell.Cell option =
        if ensemble.Cells.Length = 0 then None
        else Some (ensemble.Cells |> Array.maxBy (fun cell -> float cell.Column.AccumulatedIV))

    // ── Reconcile: fold N votes into a consensus receipt ─────────────────────────────────────────

    /// Reconcile the ensemble's votes into a `ComputeReceipt.Receipt`.
    /// The receipt measures the information gain of the consensus step:
    ///   - IV = total accumulated IV across all cells (the ensemble's total information gain)
    ///   - DeltaJ = N (one abstract joule per cell per round)
    ///   - Entropy = the Shannon entropy of the normalized vote weights
    ///
    /// This is the Bayesian-layer analogue of `ComputeReceipt.fromIV`.
    let reconcileToReceipt (ensemble: Ensemble) : ComputeReceipt.Receipt =
        let n = float ensemble.Cells.Length
        let votes = ensemble.Cells |> Array.toList |> List.map YinYangCell.castVote
        let totalWeight = votes |> List.sumBy (fun v -> v.Weight)
        let entropy =
            if totalWeight <= 0.0 then log n  // maximum entropy (all weights equal)
            else
                votes
                |> List.sumBy (fun v ->
                    let p = v.Weight / totalWeight
                    if p <= 0.0 then 0.0 else -p * log p)
        let iv = totalIV ensemble
        let deltaJ = n  // one joule per cell per round
        ComputeReceipt.fromIV iv deltaJ entropy
