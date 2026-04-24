namespace Zeta.Core

open System


/// **Temporal Coordination Detection — foundational primitives.**
///
/// This module hosts the single-node-shippable detection primitives
/// from Aaron's *differentiable firefly network + trivial cartel
/// detect* design, as formalized by Amara in the 11th courier
/// ferry (`docs/aurora/2026-04-24-amara-temporal-coordination-
/// detection-cartel-graph-influence-surface-11th-ferry.md`). Full
/// multi-node architecture awaits Zeta's multi-node foundation;
/// these pure-function primitives ship incrementally per the
/// Otto-105 graduation-cadence.
///
/// **Attribution.** The underlying concepts (temporal-coordination
/// detection as a primary defence surface, the firefly-synchronization
/// metaphor, trivial-cartel-detect as the first-order-signal tier)
/// are Aaron's design. Amara's contribution is the technical
/// vocabulary and specific formulations (phase-locking value, cross-
/// correlation, modularity spikes, eigenvector centrality drift, …).
/// This module implements Amara's formalizations; the design intent
/// behind them is Aaron's.
///
/// **Scope of this first graduation.** Only `crossCorrelation` and
/// `crossCorrelationProfile` ship here — the single most portable
/// primitive for detecting timing coordination between two event
/// streams. Downstream primitives (phase-locking value, burst-
/// alignment clusters, modularity-spike detectors, eigenvector-
/// centrality drift) are separate graduation candidates that
/// compose over this one.
///
/// **Why it matters for cartel detection.** Honest distributed
/// actors produce noisy, partially-independent event streams;
/// coordinated actors produce phase-aligned streams. Pearson cross-
/// correlation at lag τ quantifies how similarly two series move
/// at a time offset, yielding the core signal for the "obvious
/// coordinated timing" (trivial-cartel) case. Subtler coordination
/// requires the harder primitives added in later graduations.
[<AutoOpen>]
module TemporalCoordinationDetection =

    /// Pearson cross-correlation of two series at lag `tau`. The
    /// value is normalized to `[-1.0, 1.0]` when defined; returns
    /// `None` when either series has fewer than two elements that
    /// overlap at the given lag, or when either overlap window is
    /// constant (standard deviation = 0, undefined denominator).
    ///
    /// Lag semantics: positive `tau` aligns `ys[i + tau]` with
    /// `xs[i]`; negative `tau` aligns `ys[i]` with `xs[i - tau]`.
    /// A detector asking "does `ys` lead `xs` by `k` steps?" passes
    /// `tau = k`.
    let crossCorrelation (xs: double seq) (ys: double seq) (tau: int) : double option =
        let xArr = Seq.toArray xs
        let yArr = Seq.toArray ys
        let startX, startY =
            if tau >= 0 then 0, tau
            else -tau, 0
        let overlap = min (xArr.Length - startX) (yArr.Length - startY)
        if overlap < 2 then None
        else
            let mutable meanX = 0.0
            let mutable meanY = 0.0
            for i in 0 .. overlap - 1 do
                meanX <- meanX + xArr.[startX + i]
                meanY <- meanY + yArr.[startY + i]
            let n = double overlap
            meanX <- meanX / n
            meanY <- meanY / n
            let mutable cov = 0.0
            let mutable varX = 0.0
            let mutable varY = 0.0
            for i in 0 .. overlap - 1 do
                let dx = xArr.[startX + i] - meanX
                let dy = yArr.[startY + i] - meanY
                cov <- cov + dx * dy
                varX <- varX + dx * dx
                varY <- varY + dy * dy
            if varX = 0.0 || varY = 0.0 then None
            else Some (cov / sqrt (varX * varY))

    /// Cross-correlation across the full lag range `[-maxLag, maxLag]`.
    /// Returns one entry per lag; `None` entries indicate lags where
    /// the overlap window was too short or degenerate (flat input)
    /// to compute a correlation.
    ///
    /// Intended downstream use: feed to a burst-alignment / cluster
    /// detector that flags lags where `|corr|` is unusually high
    /// versus a baseline, the operational "firefly detection" case
    /// from the 11th ferry's signal model.
    let crossCorrelationProfile (xs: double seq) (ys: double seq) (maxLag: int) : (int * double option) array =
        if maxLag < 0 then [||]
        else
            [| for tau in -maxLag .. maxLag ->
                   tau, crossCorrelation xs ys tau |]
