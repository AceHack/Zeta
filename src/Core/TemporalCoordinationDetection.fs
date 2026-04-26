namespace Zeta.Core

open System


/// **Temporal Coordination Detection — foundational primitives.**
///
/// Pure-function detection primitives over pairs of numeric event
/// streams. Honest distributed actors produce noisy, partially-
/// independent streams; coordinated actors produce phase-aligned
/// ones. These primitives quantify that difference in two
/// complementary registers — amplitude (cross-correlation at a
/// lag) and phase (phase-locking value + mean phase offset) — so
/// downstream detectors can compose both and catch cartels that
/// flatten one register while preserving the other.
///
/// Two return-shape families live here:
///
/// * Single-value primitives — `crossCorrelation`,
///   `phaseLockingValue`, `meanPhaseOffset`,
///   `phaseLockingWithOffset` — return `Option`-wrapped values.
///   `None` means the input could not satisfy the math (details
///   per function; covers empty, length-mismatched where the
///   function requires equal length, degenerate-variance, and
///   zero-magnitude mean vector). Silent nan-propagation would
///   invite subtle detection bugs downstream, so these primitives
///   refuse rather than fabricate.
/// * Profile / array primitives — `crossCorrelationProfile`,
///   `significantLags`, `burstAlignment` — return plain arrays.
///   Per-element defined-ness is carried inside each element
///   (the `double option` slot in a profile entry; absence from
///   the significant-lags list).
///
/// Note on length semantics: `crossCorrelation` tolerates
/// mismatched lengths — it computes over the overlap window at
/// the given lag and returns `None` only when that window is
/// too short or has zero variance. The phase-pair primitives
/// (`phaseLockingValue`, `meanPhaseOffset`,
/// `phaseLockingWithOffset`) require equal lengths and return
/// `None` otherwise.
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
    /// to compute a correlation. Intended input to a burst-alignment
    /// or cluster detector that flags lags where `|corr|` is
    /// unusually high versus a baseline.
    let crossCorrelationProfile (xs: double seq) (ys: double seq) (maxLag: int) : (int * double option) array =
        if maxLag < 0 then [||]
        else
            [| for tau in -maxLag .. maxLag ->
                   tau, crossCorrelation xs ys tau |]

    /// Epsilon floor for the magnitude of the phase-difference
    /// mean-vector. Used by `meanPhaseOffset` and
    /// `phaseLockingWithOffset` to treat the offset as undefined
    /// when the mean vector is effectively zero-length. The floor
    /// is applied to the offset decision only; `phaseLockingValue`
    /// reports magnitude arbitrarily close to zero as normal
    /// output. `1e-12` sits well below any physically-meaningful
    /// PLV magnitude.
    let private phasePairEpsilon : double = 1e-12

    /// Single-pass accumulation of `(cos d, sin d)` over the
    /// element-wise phase differences `d[i] = phasesA[i] -
    /// phasesB[i]`. Returns `None` on empty or length-mismatched
    /// input, otherwise `Some (meanCos, meanSin, n)`. All three
    /// phase-pair primitives route through this helper so the
    /// magnitude-returned-by-PLV and the offset-returned-by-atan2
    /// cannot drift out of sync.
    let private meanPhaseDiffVector
            (phasesA: double seq)
            (phasesB: double seq)
            : struct (double * double * int) option =
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
            Some (struct (sumCos / n, sumSin / n, aArr.Length))

    /// **Phase-locking value (PLV)** — the magnitude of the mean
    /// complex phase-difference vector between two phase series.
    /// Returns a value in `[0.0, 1.0]`:
    ///
    /// * `1.0` — perfect phase locking: the phase difference
    ///   `phasesA[k] - phasesB[k]` is constant across the series.
    /// * `0.0` — phase differences uniformly spread around the
    ///   unit circle (the null hypothesis of independent timing).
    /// * in between — partial coordination.
    ///
    /// Returns `None` when input sequences are empty or of
    /// unequal length; PLV is undefined for mismatched pairs
    /// and silently truncating would invite a subtle detection
    /// bug downstream.
    ///
    /// Phases are expected in radians. The computation uses the
    /// Euler identity `e^{i*theta} = cos theta + i sin theta` and
    /// depends only on the phase *difference*, so any consistent
    /// wrapping convention (`[-pi, pi]` or `[0, 2*pi]`) works and
    /// callers do not need to pre-unwrap.
    ///
    /// Complementary to `crossCorrelation`: cross-correlation
    /// answers "do amplitudes move together?"; PLV answers "do
    /// events fire at matching phases?". A coordinator that
    /// flattens amplitude correlation by adding noise may still
    /// reveal itself through preserved phase structure, and vice
    /// versa. Detectors should compose both.
    let phaseLockingValue (phasesA: double seq) (phasesB: double seq) : double option =
        match meanPhaseDiffVector phasesA phasesB with
        | None -> None
        | Some (struct (meanCos, meanSin, _)) ->
            Some (sqrt (meanCos * meanCos + meanSin * meanSin))

    /// **Mean phase offset between two phase series** — the
    /// argument (angle) of the same mean complex phase-difference
    /// vector whose magnitude is the PLV (i.e. the value returned
    /// by `phaseLockingValue` on the same inputs). Returns a
    /// value in `[-pi, pi]` (the full `System.Math.Atan2` range,
    /// which includes both endpoints under IEEE-754 signed-zero
    /// semantics) when defined, or `None` when input sequences are
    /// empty, of unequal length, or when the mean vector has
    /// effectively zero magnitude (direction undefined). The
    /// `phasePairEpsilon` floor applies to this offset decision
    /// only.
    ///
    /// Why this matters alongside `phaseLockingValue`: magnitude
    /// alone cannot distinguish same-phase locking (offset near
    /// 0), anti-phase locking (offset near `+/- pi`), or lead-lag
    /// locking (offset between). All three cases can return PLV
    /// = 1.0. A detector that reads "PLV = 1 means synchronized
    /// action" misreads anti-phase coordinators as same-time
    /// coordinators. Consume magnitude and offset together;
    /// callers that need both on a single pass should use
    /// `phaseLockingWithOffset`.
    let meanPhaseOffset (phasesA: double seq) (phasesB: double seq) : double option =
        match meanPhaseDiffVector phasesA phasesB with
        | None -> None
        | Some (struct (meanCos, meanSin, _)) ->
            let magnitude = sqrt (meanCos * meanCos + meanSin * meanSin)
            if magnitude < phasePairEpsilon then None
            else Some (atan2 meanSin meanCos)

    /// **Phase locking + offset together** — returns the PLV
    /// magnitude and the mean phase offset as a single option-
    /// tuple, sharing the cos/sin accumulation pass for callers
    /// that want both. Returns `None` under the same input
    /// conditions as `phaseLockingValue` (empty or length-
    /// mismatched series).
    ///
    /// When the mean vector has effectively zero magnitude the
    /// offset field is set to `nan` rather than `None`; the
    /// magnitude will itself be `< 1e-12`, which is the caller's
    /// reliable "offset is undefined" signal. Keeping the return
    /// type flat (non-nested option) preserves clean composition
    /// at downstream call sites.
    ///
    /// Prefer this over separate `phaseLockingValue` +
    /// `meanPhaseOffset` calls when you need both, to avoid
    /// traversing the sequences twice. Use the individual
    /// primitives when you only need one quantity, to keep call
    /// sites honest about what they consume.
    let phaseLockingWithOffset
            (phasesA: double seq)
            (phasesB: double seq)
            : struct (double * double) option =
        match meanPhaseDiffVector phasesA phasesB with
        | None -> None
        | Some (struct (meanCos, meanSin, _)) ->
            let magnitude = sqrt (meanCos * meanCos + meanSin * meanSin)
            let offset =
                if magnitude < phasePairEpsilon then nan
                else atan2 meanSin meanCos
            Some (struct (magnitude, offset))

    /// **Significant lags from a correlation profile.** Returns the
    /// subset of lags from a `crossCorrelationProfile` where the
    /// absolute correlation meets or exceeds `threshold`. `None`
    /// entries (undefined-variance lags) are never counted as
    /// significant — a missing measurement is not a coordination
    /// signal.
    ///
    /// Threshold semantics: caller-supplied. Typical values for
    /// obvious-coordination use cases are `0.7`-`0.8` for "strong"
    /// and `0.9` for "unusually strong". For null-hypothesis
    /// testing, compute the profile for independent baseline
    /// streams and derive the threshold from its percentile rather
    /// than hard-coding.
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
    /// lags. Non-finite correlations are filtered by the
    /// underlying `significantLags` pass.
    ///
    /// Operationalises the pair-wise firefly-detection case: two
    /// streams, clustered into contiguous runs of lags that clear
    /// the threshold. The node-set generalisation — clustering
    /// across many stream pairs into coordinated subsets of `N`
    /// nodes — composes over this primitive and belongs in a
    /// separate module alongside the graph-level detectors.
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
