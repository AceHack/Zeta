namespace Zeta.Bayesian

open Zeta.Core

/// **MutualFalsification — the scheduled mutual-falsification loop.**
///
/// Each cell in the ensemble runs the other cells' claims against its own frame on a cadence.
/// A "claim" is a Gaussian belief (the cell's current posterior). A "refutation" is a
/// `ComputeReceipt` with negative `DeltaU` (the claim costs more than it earns in the
/// refuting cell's frame). Refutations bank ΔU into the ensemble's shared ledger.
///
/// ## Why this matters (§B decorrelated-selection row)
///
/// The decorrelated-selection row says: "NCI and multi-agent keeps the system running …
/// we just don't have this reliably running." The mutual-falsification loop IS the
/// "reliably running" mechanism:
///
///   - Each cell is external to the others' frames (different Adinkra seed = different
///     identity anchor = different reference frame).
///   - A claim that is consistent in cell A's frame may be inconsistent in cell B's frame.
///   - Cell B's refutation is a negative-ΔU receipt: the claim costs more than it earns
///     in B's frame (it is a "heat tick" for B — the information is not useful).
///   - The ensemble's shared ΔU ledger accumulates these refutations. A claim that is
///     refuted by many cells has a large negative ΔU balance — it is not worth acting on.
///
/// ## The NCI connection
///
/// NCI (Non-Coercive Independence) says: a state-independent likelihood commutes (it is
/// evidence, not coercion). The mutual-falsification loop enforces NCI:
///   - A coercive claim (one that forces a specific belief regardless of the prior) will
///     have high ΔU in the coercing cell's frame but low (or negative) ΔU in other frames.
///   - The ensemble's ledger will show a large variance in ΔU across cells — a signal that
///     the claim is frame-dependent (coercive) rather than frame-independent (evidence).
///
/// ## Connection to the ReceiptScheduler
///
/// The `ReceiptScheduler` (Phase 1) reads its own receipts to decide when to tick.
/// The mutual-falsification loop feeds refutation receipts BACK into the scheduler:
///   - High-refutation claims (large negative ΔU) cause the scheduler to back off.
///   - Low-refutation claims (positive ΔU across all cells) cause the scheduler to tick faster.
///   - This is the full thermodynamic feedback cycle: predict → act → measure → adjust.
[<RequireQualifiedAccess>]
module MutualFalsification =

    // ── Claim type ───────────────────────────────────────────────────────────────────────────────

    /// A claim is a cell's current posterior belief, tagged with the cell's identity (codeword).
    type Claim =
        { /// The cell that made the claim.
          CellId: string
          /// The cell's current posterior belief (the claim content).
          Belief: Gaussian
          /// The cell's accumulated IV at the time of the claim.
          AccumulatedIV: float }

    // ── Refutation type ──────────────────────────────────────────────────────────────────────────

    /// A refutation is a receipt from the refuting cell's perspective.
    /// Negative `DeltaU` = the claim is a heat tick in the refuting cell's frame.
    type Refutation =
        { /// The cell that made the claim.
          ClaimantId: string
          /// The cell that refuted the claim.
          RefuterId: string
          /// The receipt from the refuter's perspective.
          /// `DeltaU < 0` means the claim costs more than it earns in the refuter's frame.
          Receipt: ComputeReceipt.Receipt
          /// The KL divergence between the claim and the refuter's belief.
          /// High divergence = the claim is far from the refuter's frame.
          ClaimRefuterDivergence: float }

    // ── Claim extraction ─────────────────────────────────────────────────────────────────────────

    /// Extract a claim from a cell.
    let extractClaim (cell: YinYangCell.Cell) : Claim =
        { CellId = cell.Column.Id
          Belief = cell.Column.Belief
          AccumulatedIV = float cell.Column.AccumulatedIV }

    /// Extract all claims from an ensemble (one per cell).
    let extractAllClaims (ensemble: YinYangEnsemble.Ensemble) : Claim[] =
        ensemble.Cells |> Array.map extractClaim

    // ── Refutation computation ───────────────────────────────────────────────────────────────────

    /// Compute the KL divergence between two Gaussians (prior → posterior direction).
    /// For Gaussians with precisions τ₁ and τ₂ and precision-means μτ₁ and μτ₂:
    ///   KL(G₁ || G₂) = 0.5 * [τ₂/τ₁ - 1 - ln(τ₂/τ₁) + τ₂*(μ₁-μ₂)²]
    /// where μᵢ = PrecisionMean_i / Precision_i.
    /// Returns 0.0 if either Gaussian is uninformative (Precision ≤ 0).
    let gaussianKL (g1: Gaussian) (g2: Gaussian) : float =
        if g1.Precision <= 0.0 || g2.Precision <= 0.0 then 0.0
        else
            let tau1 = g1.Precision
            let tau2 = g2.Precision
            let mu1 = g1.PrecisionMean / tau1
            let mu2 = g2.PrecisionMean / tau2
            let ratio = tau2 / tau1
            0.5 * (ratio - 1.0 - log ratio + tau2 * (mu1 - mu2) ** 2.0)

    /// Compute a refutation: how much does `claim` cost in `refuter`'s frame?
    ///
    /// The refuter evaluates the claim by computing the KL divergence between the claim's
    /// belief and its own belief. High divergence = the claim is far from the refuter's frame.
    ///
    /// The receipt is:
    ///   - IV = the refuter's own accumulated IV (what it has earned)
    ///   - DeltaJ = the KL divergence (what the claim costs to process in the refuter's frame)
    ///   - Entropy = the refuter's posterior entropy
    ///
    /// If DeltaU = IV - DeltaJ < 0, the claim is a heat tick in the refuter's frame.
    let refute (refuter: YinYangCell.Cell) (claim: Claim) : Refutation =
        let divergence = gaussianKL claim.Belief refuter.Column.Belief
        let refuterIV = float refuter.Column.AccumulatedIV
        let refuterEntropy =
            let tau = refuter.Column.Belief.Precision
            if tau <= 0.0 then 0.0
            else 0.5 * log (2.0 * System.Math.PI * System.Math.E / tau)
        let receipt = ComputeReceipt.fromIV refuterIV divergence refuterEntropy
        { ClaimantId = claim.CellId
          RefuterId = refuter.Column.Id
          Receipt = receipt
          ClaimRefuterDivergence = divergence }

    // ── Falsification round ──────────────────────────────────────────────────────────────────────

    /// **Falsification round:** each cell refutes all other cells' claims.
    ///
    /// Returns a list of all refutations (N*(N-1) total for an N-cell ensemble).
    /// Each cell skips its own claim (a cell does not refute itself).
    let falsificationRound (ensemble: YinYangEnsemble.Ensemble) : Refutation[] =
        let claims = extractAllClaims ensemble
        [| for cell in ensemble.Cells do
               for claim in claims do
                   if claim.CellId <> cell.Column.Id then
                       yield refute cell claim |]

    // ── ΔU ledger ────────────────────────────────────────────────────────────────────────────────

    /// **ΔU ledger:** aggregate refutations into a per-claim ΔU balance.
    ///
    /// A claim's ΔU balance is the sum of `DeltaU` across all refutations of that claim.
    ///   - Large positive balance: the claim is useful in most frames (evidence).
    ///   - Large negative balance: the claim is a heat tick in most frames (coercive / noise).
    ///   - Near-zero balance: the claim is frame-neutral (neither evidence nor coercion).
    let deltaULedger (refutations: Refutation[]) : Map<string, float> =
        refutations
        |> Array.groupBy (fun r -> r.ClaimantId)
        |> Array.map (fun (claimantId, rs) ->
            claimantId, rs |> Array.sumBy (fun r -> r.Receipt.DeltaU))
        |> Map.ofArray

    /// **Coercion score:** the variance of ΔU across refuters for a given claim.
    ///
    /// High variance = the claim is useful in some frames but harmful in others (coercive).
    /// Low variance = the claim is consistently useful or consistently harmful (frame-independent).
    ///
    /// This is the NCI falsifier: a coercive claim has high ΔU variance across frames.
    let coercionScores (refutations: Refutation[]) : Map<string, float> =
        refutations
        |> Array.groupBy (fun r -> r.ClaimantId)
        |> Array.map (fun (claimantId, rs) ->
            let deltaUs = rs |> Array.map (fun r -> r.Receipt.DeltaU)
            let mean = Array.average deltaUs
            let variance = deltaUs |> Array.averageBy (fun du -> (du - mean) ** 2.0)
            claimantId, variance)
        |> Map.ofArray

    // ── Ensemble-level falsification summary ─────────────────────────────────────────────────────

    /// **Falsification summary:** run one falsification round and return the ledger + scores.
    type FalsificationSummary =
        { /// Per-claim ΔU balance (positive = evidence, negative = heat/coercion).
          DeltaULedger: Map<string, float>
          /// Per-claim coercion score (variance of ΔU across refuters).
          CoercionScores: Map<string, float>
          /// Total ΔU banked by the ensemble (sum of all refutation DeltaUs).
          TotalBankedDeltaU: float
          /// Number of refutations computed.
          RefutationCount: int
          /// The ensemble's ρ_proxy at the time of the falsification round.
          RhoProxy: float }

    /// Run one falsification round on the ensemble and return the summary.
    let summarize (ensemble: YinYangEnsemble.Ensemble) : FalsificationSummary =
        let refutations = falsificationRound ensemble
        let ledger = deltaULedger refutations
        let scores = coercionScores refutations
        { DeltaULedger = ledger
          CoercionScores = scores
          TotalBankedDeltaU = refutations |> Array.sumBy (fun r -> r.Receipt.DeltaU)
          RefutationCount = refutations.Length
          RhoProxy = YinYangEnsemble.rhoProxy ensemble }

    // ── Cron integration: BindFalsificationLoop ──────────────────────────────────────────────────

    /// **Bind the falsification loop to the cron runtime.**
    ///
    /// On each tick, the loop:
    ///   1. Runs a falsification round on the ensemble.
    ///   2. Emits a `ComputeReceipt` for the round (IV = TotalBankedDeltaU, DeltaJ = N*(N-1)).
    ///   3. Calls `onSummary` with the full falsification summary.
    ///   4. If the ensemble is collapsed (ρ > rhoThreshold), triggers a reseed.
    ///   5. Returns the IV to drive the adaptive tick rate.
    ///
    /// The receipt's IV is the total ΔU banked by the ensemble. If the ensemble is
    /// generating useful refutations (positive ΔU), the scheduler ticks faster.
    /// If the ensemble is generating heat (negative ΔU), the scheduler backs off.
    let bindFalsificationLoop
            (ensemble: YinYangEnsemble.Ensemble ref)
            (rhoThreshold: float)
            (reseedCodewords: int[][] )
            (onSummary: FalsificationSummary -> unit)
            (onReceipt: ComputeReceipt.Receipt -> unit)
            : unit =
        // Run one falsification round.
        let summary = summarize !ensemble
        onSummary summary
        // Check for collapse and reseed if needed.
        let reseedIdx = ref 0
        let (newEnsemble, didReseed) =
            if summary.RhoProxy > rhoThreshold && reseedCodewords.Length > 0 then
                let codeword = reseedCodewords.[!reseedIdx % reseedCodewords.Length]
                incr reseedIdx
                YinYangEnsemble.reseedIfCollapsed rhoThreshold codeword !ensemble
            else
                !ensemble, false
        if didReseed then ensemble := newEnsemble
        // Emit a receipt for the falsification round.
        let n = float (!ensemble).Cells.Length
        let deltaJ = n * (n - 1.0)  // N*(N-1) refutations per round
        let entropy =
            let rho = summary.RhoProxy
            if rho <= 0.0 then log n  // maximum entropy (fully decorrelated)
            else -rho * log rho - (1.0 - rho) * log (1.0 - rho + 1e-12)  // binary entropy of ρ
        let receipt = ComputeReceipt.fromIV summary.TotalBankedDeltaU deltaJ entropy
        onReceipt receipt
