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

    // ── Live ρ-measurement ────────────────────────────────────────────────────────────────────────

    /// **Pairwise error-correlation ρ (live measurement).**
    ///
    /// Condorcet's theorem says the ensemble is only informative while ρ < 1.
    /// When ρ → 1, all cells share the same frame and the ensemble collapses to a single voter.
    ///
    /// We measure ρ as the mean pairwise Pearson correlation of the cell means over the last
    /// `windowSize` rounds. For a live system, the caller maintains the history buffer.
    ///
    /// For a single-snapshot estimate (no history), we use the variance proxy:
    ///   ρ_proxy = 1 - (decorrelationVariance / max_possible_variance)
    /// where max_possible_variance is the variance of the cell means if they were maximally spread.
    /// ρ_proxy ≈ 0 means fully decorrelated; ρ_proxy ≈ 1 means fully correlated (collapsed).
    let rhoProxy (ensemble: Ensemble) : float =
        let means =
            ensemble.Cells
            |> Array.choose (fun cell ->
                if cell.Column.Belief.Precision > 0.0 then
                    Some (cell.Column.Belief.PrecisionMean / cell.Column.Belief.Precision)
                else None)
        if means.Length < 2 then 0.0  // not enough cells to measure correlation
        else
            let avg = Array.average means
            let variance = means |> Array.averageBy (fun m -> (m - avg) ** 2.0)
            let maxMean = Array.max means
            let minMean = Array.min means
            let maxPossibleVariance = ((maxMean - minMean) / 2.0) ** 2.0
            if maxPossibleVariance <= 1e-12 then 1.0  // all means identical → fully correlated
            else 1.0 - (variance / maxPossibleVariance)

    // ── Tsirelson operating-point threshold ─────────────────────────────────────────────────────────────

    /// **Tsirelson reseed threshold: ρ_T = 1/(3√2) ≈ 0.2357.**
    ///
    /// A DESIGN CHOICE, not a first-principles derivation — the *homoiconic linear identification* of the
    /// Condorcet ρ-regimes with the Bell/CHSH S-regimes (proof of "chosen, not derived" + the homoiconicity
    /// reason: docs/research/2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md).
    /// The map ρ = S/12 pins ρ* = 1/3 ↔ S = 4 and is taken linear, making the two regime diagrams identical:
    ///   S = 4  (ρ > 1/3):       superdeterminism / common seed — groupthink, useless ensemble
    ///   S = 2√2 (ρ ≈ ρ_T):      Tsirelson bound — optimal operating point (maximum non-classical correlation)
    ///   S = 2  (ρ < ρ_T):      classical local realism — fully decorrelated, maximum diversity
    /// (ρ* = 1/3 ↔ S = 4 and linearity are the two modeling choices; given them, ρ_T = 1/(3√2) is forced.)
    ///
    /// Reseeding at ρ_T (not at the hard event horizon ρ* = 1/3) gives a safety margin:
    /// the ensemble is reseeded while it is still in the quantum-like regime, before it
    /// collapses into the superdeterministic (common-seed) regime.
    let tsirelsonThreshold : float = 1.0 / (3.0 * sqrt 2.0)  // ≈ 0.2357

    /// **Collapse detection:** returns `true` if the ensemble has collapsed (ρ_proxy > threshold).
    /// The default threshold is `tsirelsonThreshold` = 1/(3√2) ≈ 0.2357 (the Tsirelson operating
    /// point), which gives a safety margin before the event horizon at ρ* = 1/3.
    let isCollapsed (rhoThreshold: float) (ensemble: Ensemble) : bool =
        rhoProxy ensemble > rhoThreshold

    /// **Collapse detection at the Tsirelson threshold (default).**
    /// Equivalent to `isCollapsed tsirelsonThreshold ensemble`.
    let isCollapsedDefault (ensemble: Ensemble) : bool =
        isCollapsed tsirelsonThreshold ensemble

    // ── Auto-reseed on collapse ──────────────────────────────────────────────────────────────────

    /// **Auto-reseed:** replace a collapsed cell with a fresh cell seeded from a new codeword.
    ///
    /// When the ensemble collapses (ρ → 1), the scheduler should re-seed one or more cells
    /// from a different Adinkra codeword to restore decorrelation. This function replaces the
    /// cell with the LOWEST accumulated IV (the least experienced, most replaceable) with a
    /// fresh cell seeded from `newCodeword`.
    ///
    /// The new cell starts from the uninformative prior (fresh observer) — it will decorrelate
    /// naturally as it accumulates its own IV from a different starting frame.
    let reseedLeastExperienced (newCodeword: int[]) (ensemble: Ensemble) : Ensemble =
        if ensemble.Cells.Length = 0 then ensemble
        else
            let minIdx =
                ensemble.Cells
                |> Array.mapi (fun i cell -> i, float cell.Column.AccumulatedIV)
                |> Array.minBy snd
                |> fst
            let newCell = YinYangCell.seed newCodeword
            let newCells = Array.copy ensemble.Cells
            newCells.[minIdx] <- newCell
            { ensemble with Cells = newCells }

    /// **Reseed if collapsed:** check ρ_proxy and reseed the least-experienced cell if the
    /// ensemble has collapsed past the threshold. Returns the (possibly reseeded) ensemble
    /// and a flag indicating whether a reseed occurred.
    let reseedIfCollapsed
            (rhoThreshold: float)
            (newCodeword: int[])
            (ensemble: Ensemble)
            : Ensemble * bool =
        if isCollapsed rhoThreshold ensemble then
            reseedLeastExperienced newCodeword ensemble, true
        else
            ensemble, false

    /// **Reseed if collapsed (Tsirelson default):**
    /// Uses `tsirelsonThreshold` = 1/(3√2) ≈ 0.2357 as the reseed trigger.
    /// This is the recommended default: it reseeds at the Tsirelson operating point
    /// (maximum non-classical correlation) rather than waiting for the event horizon (ρ* = 1/3).
    let reseedIfCollapsedDefault (newCodeword: int[]) (ensemble: Ensemble) : Ensemble * bool =
        reseedIfCollapsed tsirelsonThreshold newCodeword ensemble

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
