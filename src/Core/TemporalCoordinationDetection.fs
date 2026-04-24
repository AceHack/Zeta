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

    /// **Phase-locking value (PLV)** — the magnitude of the mean
    /// complex phase-difference vector between two phase series.
    /// Returns a value in `[0.0, 1.0]`:
    ///
    /// * `1.0` — perfect phase locking (the phase difference
    ///   `φ_a[k] - φ_b[k]` is constant across the series; two
    ///   actors whose events always arrive at the same phase
    ///   offset look like this, which is the classical firefly-
    ///   synchronization signature)
    /// * `0.0` — phase differences uniformly spread around the
    ///   unit circle (the null hypothesis of independent timing)
    /// * in between — partial coordination
    ///
    /// Returns `None` when the input sequences are empty or of
    /// unequal length; PLV is undefined for mismatched pairs
    /// and silently truncating would invite a subtle detection
    /// bug downstream.
    ///
    /// Input phases `phasesA` and `phasesB` are expected in
    /// radians; the computation uses the Euler identity
    /// `e^{iθ} = cos θ + i sin θ` and only depends on the
    /// phase *difference*, so any consistent wrapping convention
    /// (`[-π, π]` or `[0, 2π]`) works — callers do not need to
    /// pre-unwrap.
    ///
    /// Complementary to `crossCorrelation`: cross-correlation
    /// answers "do amplitudes move together?"; PLV answers "do
    /// the events fire at matching phases?". Cartels that flatten
    /// amplitude cross-correlation by adding noise may still
    /// reveal themselves through preserved phase structure, and
    /// vice versa. Detectors compose both.
    ///
    /// Provenance: primitive from Aaron's differentiable firefly
    /// network design, formalized in Amara's 11th courier ferry
    /// (`docs/aurora/2026-04-24-amara-temporal-coordination-
    /// detection-cartel-graph-influence-surface-11th-ferry.md`,
    /// §1 Signal model). Third graduation under the Otto-105
    /// cadence.
    let phaseLockingValue (phasesA: double seq) (phasesB: double seq) : double option =
        let aArr = Seq.toArray phasesA
        let bArr = Seq.toArray phasesB
        if aArr.Length = 0 || aArr.Length <> bArr.Length then None
        else
            let mutable sumCos = 0.0
            let mutable sumSin = 0.0
            for i in 0 .. aArr.Length - 1 do
                let d = aArr.[i] - bArr.[i]
                sumCos <- sumCos + cos d
                sumSin <- sumSin + sin d
            let n = double aArr.Length
            let meanCos = sumCos / n
            let meanSin = sumSin / n
            Some (sqrt (meanCos * meanCos + meanSin * meanSin))

    /// **Significant lags from a correlation profile.** Returns the
    /// subset of lags from a `crossCorrelationProfile` where the
    /// absolute correlation meets or exceeds `threshold`. `None`
    /// entries (undefined-variance lags) are never counted as
    /// significant — a missing measurement is not a coordination
    /// signal.
    ///
    /// Threshold semantics: caller-supplied. Typical values for
    /// trivial-cartel-detect use cases: `0.7`-`0.8` for "strong
    /// coordination", `0.9` for "unusually strong". For null-
    /// hypothesis testing against a baseline, compute the
    /// baseline's profile for independent streams and derive the
    /// threshold from its percentile rather than hard-coding.
    ///
    /// This is the input to downstream cluster / burst detectors;
    /// alone it answers "which lags look coordinated?" and leaves
    /// "are they bursty / clustered / sustained?" to the next
    /// primitive.
    let significantLags (profile: (int * double option) array) (threshold: double) : int array =
        profile
        |> Array.choose (fun (lag, corrOpt) ->
            match corrOpt with
            | Some c when System.Double.IsFinite c && abs c >= threshold -> Some lag
            | _ -> None)

    /// **Burst alignment — contiguous significant-lag ranges.**
    /// Groups significant lags (from `significantLags`) into
    /// contiguous runs. Each run is reported as `(startLag,
    /// endLag)` inclusive. Two consecutive lags count as
    /// contiguous if they differ by exactly `1`.
    ///
    /// Output encodes "bursts" of coordinated timing — a run of
    /// lags `[-2 .. 3]` suggests actors that coordinate across a
    /// 5-step window, not a single-point coincidence. A single
    /// isolated significant lag reports as `(n, n)`.
    ///
    /// Returns an empty array when the profile has no significant
    /// lags. Non-finite correlations are filtered by the underlying
    /// `significantLags` pass.
    ///
    /// The 11th-ferry signal-model definition (Amara, §1):
    /// > *"Firefly detection = identify clusters where ∃ S ⊂ N
    /// > such that ∀ i,j ∈ S, corr(E_i, E_j) ≫ baseline"*
    ///
    /// This function operationalises the pair-wise case (two
    /// streams) — `S` is represented as the set of lags at which
    /// two streams clear the threshold, clustered into contiguous
    /// runs. The node-set generalisation (clustering across many
    /// stream pairs into coordinated subsets of N) is a separate
    /// graduation candidate that composes over this primitive.
    let burstAlignment (profile: (int * double option) array) (threshold: double) : (int * int) array =
        let significant = significantLags profile threshold
        if significant.Length = 0 then [||]
        else
            let runs = ResizeArray<int * int>()
            let mutable runStart = significant.[0]
            let mutable runEnd = significant.[0]
            for i in 1 .. significant.Length - 1 do
                let lag = significant.[i]
                if lag = runEnd + 1 then
                    runEnd <- lag
                else
                    runs.Add(runStart, runEnd)
                    runStart <- lag
                    runEnd <- lag
            runs.Add(runStart, runEnd)
            runs.ToArray()
