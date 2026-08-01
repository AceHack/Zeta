namespace Zeta.Bayesian

open Zeta.Core

/// **BusDelayTick — bus delay as a natural tick source.**
///
/// ## The core insight
///
/// A tick source is something that naturally attracts attention with no outside force or action
/// needed. When observing a tick source, it looks like a constant stream of energy.
///
/// Bus delay in a Reticulum network IS a tick source in this sense:
///   - Each message arrival is a tick.
///   - The Poisson spread of arrival times is the natural decorrelation mechanism.
///   - No external force is needed — the network's latency generates temporal diversity
///     automatically.
///
/// The ensemble is informative WHILE the bus delay is active (rhoCount < 1.0). When the
/// bus delay collapses (all cells synchronized, rhoCount → 1.0), the tick source has
/// "fired" — the ensemble has consumed the available decorrelation energy and needs reseeding.
///
/// ## Connection to ReceiptScheduler
///
/// The `ReceiptScheduler` uses `DeltaU` (IV - DeltaJ) to drive adaptive backoff:
///   - `DeltaU < 0` → heat tick → slow down (wasted compute)
///   - `DeltaU > 0` → profit tick → speed up (useful compute)
///
/// `BusDelayTick` adds a second feedback signal: `rhoCount`.
///   - `rhoCount ≈ 1.0` → cells synchronized → ensemble adds nothing → slow down
///   - `rhoCount ≈ 0.0` → cells at different stages → ensemble is maximally informative → speed up
///
/// The combined signal is: `effectiveMultiplier = DeltaU-multiplier × rhoCount-multiplier`.
///
/// ## The rhoCount-driven interval multiplier
///
/// The rhoCount multiplier is:
///   - `1.0` when `rhoCount = tsirelsonThreshold` (Tsirelson operating point — optimal)
///   - `> 1.0` when `rhoCount > tsirelsonThreshold` (temporally collapsed — slow down)
///   - `< 1.0` when `rhoCount < tsirelsonThreshold` (temporally diverse — speed up)
///
/// The formula: `multiplier = rhoCount / tsirelsonThreshold`
///   - At ρ_T: multiplier = 1.0 (nominal)
///   - At ρ = 1.0: multiplier = 1.0/ρ_T ≈ 4.24 (slow down by 4×)
///   - At ρ = 0.0: multiplier = 0.0 (maximum speed — but clamped to minFactor)
///
/// This is clamped to `[minFactor, maxFactor]` to prevent runaway.
[<RequireQualifiedAccess>]
module BusDelayTick =

    // ── Tick source state ─────────────────────────────────────────────────────────────────────────

    /// The state of a bus-delay tick source.
    /// Wraps a `YinYangEnsemble.Ensemble` and tracks the rhoCount history.
    type TickSource =
        { /// The underlying ensemble.
          Ensemble: YinYangEnsemble.Ensemble
          /// The current rhoCount (temporal decorrelation metric).
          RhoCount: float
          /// The current rhoProxy (spatial decorrelation metric).
          RhoProxy: float
          /// The number of ticks fired so far.
          TickCount: int
          /// The number of reseeds triggered (rhoCount > tsirelsonThreshold).
          ReseedCount: int
          /// The last codeword used for reseeding (cycles through Adinkra codewords).
          LastReseedIdx: int }

    /// Create a fresh tick source from a full 16-cell ensemble.
    let create () : TickSource =
        let ensemble = YinYangEnsemble.createFull ()
        { Ensemble = ensemble
          RhoCount = YinYangEnsemble.rhoCount ensemble
          RhoProxy = YinYangEnsemble.rhoProxy ensemble
          TickCount = 0
          ReseedCount = 0
          LastReseedIdx = 0 }

    /// Create a tick source from a k-cell ensemble.
    let createN (k: int) : TickSource =
        let ensemble = YinYangEnsemble.createN k
        { Ensemble = ensemble
          RhoCount = YinYangEnsemble.rhoCount ensemble
          RhoProxy = YinYangEnsemble.rhoProxy ensemble
          TickCount = 0
          ReseedCount = 0
          LastReseedIdx = 0 }

    // ── Tick: process one message arrival ─────────────────────────────────────────────────────────

    /// **Fire one tick:** process a sensory input through the ensemble, update rhoCount,
    /// and auto-reseed if the ensemble has collapsed past the Tsirelson threshold.
    ///
    /// The `busDelayCell` parameter simulates bus delay: if `Some i`, only cell `i` receives
    /// this tick (simulating a message that arrived only at one cell due to network delay).
    /// If `None`, all cells receive the tick (synchronized broadcast).
    ///
    /// Returns the updated tick source and a flag indicating whether a reseed occurred.
    let tick
            (sensoryInput: Gaussian)
            (busDelayCell: int option)
            (src: TickSource)
            : TickSource * bool =
        // Update the ensemble: either broadcast or single-cell delivery
        let updatedEnsemble =
            match busDelayCell with
            | None ->
                // Synchronized broadcast: all cells observe the input
                YinYangEnsemble.observe sensoryInput src.Ensemble
            | Some cellIdx ->
                // Bus-delayed delivery: only one cell observes the input
                let cells = src.Ensemble.Cells
                if cellIdx < 0 || cellIdx >= cells.Length then
                    src.Ensemble  // out of range — no update
                else
                    // Observe only the target cell, then broadcast the updated cell array
                    // to recompute consensus via the ensemble's own observe-one helper.
                    // We do this by observing all cells but only updating the target one.
                    let updatedCells =
                        cells
                        |> Array.mapi (fun i cell ->
                            if i = cellIdx then YinYangCell.observe sensoryInput cell
                            else cell)
                    let votes = updatedCells |> Array.toList |> List.map YinYangCell.castVote
                    let consensus =
                        votes
                        |> List.fold (fun acc v ->
                            { Gaussian.PrecisionMean = acc.PrecisionMean + v.Weight * v.Belief.PrecisionMean
                              Precision = acc.Precision + v.Weight * v.Belief.Precision })
                            { Gaussian.PrecisionMean = 0.0; Precision = 0.0 }
                    { src.Ensemble with
                        Cells = updatedCells
                        Consensus = consensus
                        Round = src.Ensemble.Round + 1 }

        // Measure rhoCount and rhoProxy
        let rc = YinYangEnsemble.rhoCount updatedEnsemble
        let rp = YinYangEnsemble.rhoProxy updatedEnsemble

        // Auto-reseed if temporally collapsed past the Tsirelson threshold.
        // Guard: only reseed if the ensemble has SOME observations (totalIV > 0).
        // A fresh ensemble has rhoCount = 1.0 by the degenerate-case convention
        // (mean = 0 → CV undefined → rhoCount = 1.0), but that is NOT a collapse —
        // it is simply "no data yet". Reseeding a fresh ensemble would replace a cell
        // that was just observed, discarding its IV.
        let nextReseedIdx = (src.LastReseedIdx + 1) % (AdinkraCode.allCodewords |> List.length)
        let reseedCodeword = AdinkraCode.allCodewords |> List.item nextReseedIdx
        let hasObservations = YinYangEnsemble.totalIV updatedEnsemble > 0.0

        let (finalEnsemble, didReseed) =
            if not hasObservations then
                updatedEnsemble, false
            else
                YinYangEnsemble.reseedIfCollapsedTemporal
                    YinYangEnsemble.tsirelsonThreshold
                    reseedCodeword
                    updatedEnsemble

        { src with
            Ensemble = finalEnsemble
            RhoCount = rc
            RhoProxy = rp
            TickCount = src.TickCount + 1
            ReseedCount = if didReseed then src.ReseedCount + 1 else src.ReseedCount
            LastReseedIdx = if didReseed then nextReseedIdx else src.LastReseedIdx },
        didReseed

    // ── rhoCount-driven interval multiplier ───────────────────────────────────────────────────────

    /// **rhoCount-driven interval multiplier.**
    ///
    /// Returns a recommended interval multiplier based on the current rhoCount:
    ///   - `1.0` at the chosen operating point ρ_T ≈ 0.2357 (a design parameter, NOT the
    ///     Tsirelson bound — that is S ≤ 2√2 on the CHSH correlator; corrected 2026-08-01)
    ///   - `> 1.0` when rhoCount > ρ_T (temporally collapsed — slow down)
    ///   - `< 1.0` when rhoCount < ρ_T (temporally diverse — speed up)
    ///
    /// Formula: `rhoCount / tsirelsonThreshold`, clamped to [minFactor, maxFactor].
    let rhoCountMultiplier
            (minFactor: float)
            (maxFactor: float)
            (src: TickSource)
            : float =
        let raw = src.RhoCount / YinYangEnsemble.tsirelsonThreshold
        System.Math.Clamp(raw, minFactor, maxFactor)

    /// **Combined DeltaU + rhoCount interval multiplier.**
    ///
    /// Combines the `ReceiptScheduler.adaptiveIntervalMultiplier` (DeltaU-driven) with the
    /// `rhoCountMultiplier` (temporal decorrelation-driven) into a single feedback signal.
    ///
    /// The combined multiplier is the PRODUCT of the two:
    ///   - DeltaU < 0 AND rhoCount high → both say slow down → large multiplier
    ///   - DeltaU > 0 AND rhoCount low → both say speed up → small multiplier
    ///   - Mixed signals → intermediate multiplier
    ///
    /// The product is clamped to [minFactor, maxFactor].
    let combinedMultiplier
            (backoffBase: float)
            (speedupBase: float)
            (minFactor: float)
            (maxFactor: float)
            (receipted: ReceiptScheduler.Receipted<TickSource>)
            : float =
        let deltaUMult =
            ReceiptScheduler.adaptiveIntervalMultiplier
                backoffBase speedupBase minFactor maxFactor receipted
        let rhoMult =
            rhoCountMultiplier minFactor maxFactor receipted.Inner
        let combined = deltaUMult * rhoMult
        System.Math.Clamp(combined, minFactor, maxFactor)

    // ── Ensemble-level receipt ────────────────────────────────────────────────────────────────────

    /// Compute a `ComputeReceipt` from the current tick source state.
    /// The IV is the total accumulated IV across all cells; DeltaJ = N (one joule per cell).
    let toReceipt (src: TickSource) : ComputeReceipt.Receipt =
        YinYangEnsemble.reconcileToReceipt src.Ensemble

    // ── Diagnostics ───────────────────────────────────────────────────────────────────────────────

    /// The reseed rate: ReseedCount / max(TickCount, 1).
    /// High reseed rate = the ensemble is frequently collapsing (bus delay is low or signal is strong).
    let reseedRate (src: TickSource) : float =
        float src.ReseedCount / float (max src.TickCount 1)

    /// Is the tick source currently at the Tsirelson operating point?
    /// Returns true if rhoCount is within `epsilon` of the Tsirelson threshold.
    let isAtTsirelson (epsilon: float) (src: TickSource) : bool =
        abs (src.RhoCount - YinYangEnsemble.tsirelsonThreshold) < epsilon

    /// Is the tick source currently in the Bell S=2√2 regime?
    /// (rhoCount ≤ tsirelsonThreshold — fully decorrelated, maximum diversity)
    let isInQuantumRegime (src: TickSource) : bool =
        src.RhoCount <= YinYangEnsemble.tsirelsonThreshold

    /// Is the tick source currently in the superdeterministic regime?
    /// (rhoCount > 1/3 — groupthink, ensemble adds nothing)
    let isSuperdeterministic (src: TickSource) : bool =
        src.RhoCount > (1.0 / 3.0)
