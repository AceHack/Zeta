namespace Zeta.Core

open System


/// **PhaseExtraction — event streams to phase series.**
///
/// Completes the input pipeline for `TemporalCoordination-
/// Detection.phaseLockingValue` (PR #298): PLV expects phase
/// arrays in radians but doesn't prescribe how events become
/// phases. Addresses Amara 17th-ferry correction #5.
///
/// Two methods shipped here — a caller picks the one matching
/// their event-stream semantics:
///
/// * **`epochPhase`** — periodic epoch phase. For a node with
///   known period `T` (e.g., slot duration, heartbeat
///   interval), phase is `φ(t) = 2π · (t mod T) / T`. Suited
///   to consensus-protocol events with a fixed cadence.
///
/// * **`interEventPhase`** — circular phase between consecutive
///   events. For a node whose events occur at irregular times
///   `t_1 < t_2 < …`, the phase at sample time `t` is
///   `φ(t) = 2π · (t − t_k) / (t_{k+1} − t_k)` where
///   `t_k ≤ t < t_{k+1}`. Suited to event-driven streams
///   without fixed periods.
///
/// Returns `double[]` with one phase per sample time (in
/// radians, `[0, 2π)` range). Downstream PLV calls don't care
/// about the wrapping convention — only phase differences matter.
///
/// Provenance: Amara 17th-ferry Part 2 correction #5 (event
/// streams must define phase construction before PLV becomes
/// meaningful). Otto 17th graduation.
[<AutoOpen>]
module PhaseExtraction =

    let private twoPi = 2.0 * Math.PI

    /// **Periodic-epoch phase.** For each sample time `t` in
    /// `sampleTimes`, compute `φ(t) = 2π · (t mod period) / period`.
    /// Returns a `double[]` of the same length as `sampleTimes`.
    ///
    /// Returns empty array when `period <= 0` or `sampleTimes`
    /// is empty — degenerate inputs produce degenerate output,
    /// not an exception.
    ///
    /// Useful when a node's events tie to a known cadence
    /// (validator slots, heartbeat intervals, epoch boundaries).
    let epochPhase (period: double) (sampleTimes: double[]) : double[] =
        if period <= 0.0 || sampleTimes.Length = 0 then [||]
        else
            let out = Array.zeroCreate sampleTimes.Length
            for i in 0 .. sampleTimes.Length - 1 do
                let t = sampleTimes.[i]
                let m = t - (floor (t / period)) * period
                out.[i] <- twoPi * m / period
            out

    /// **Inter-event circular phase.** For each sample time `t`
    /// in `sampleTimes`, find the bracketing events
    /// `t_k ≤ t < t_{k+1}` in `eventTimes` and compute
    /// `φ(t) = 2π · (t − t_k) / (t_{k+1} − t_k)`.
    ///
    /// `eventTimes` MUST be sorted ascending. Undefined
    /// behavior if it isn't — we don't sort internally to keep
    /// the function O(|sampleTimes| log |eventTimes|), and
    /// callers typically produce sorted event logs.
    ///
    /// Samples BEFORE the first event get phase `0.0`
    /// (we're "at the beginning" of the first implicit
    /// interval). Samples AFTER the last event also get `0.0`
    /// — there's no successor to extrapolate against. Callers
    /// that care about these edge cases filter `sampleTimes`
    /// to the interior range `[t_1, t_n)` first.
    ///
    /// Returns empty array when either input is empty or the
    /// event series has fewer than 2 points (no interval to
    /// measure phase within).
    let interEventPhase
            (eventTimes: double[])
            (sampleTimes: double[])
            : double[] =
        if eventTimes.Length < 2 || sampleTimes.Length = 0 then [||]
        else
            let n = eventTimes.Length
            let out = Array.zeroCreate sampleTimes.Length
            for i in 0 .. sampleTimes.Length - 1 do
                let t = sampleTimes.[i]
                if t < eventTimes.[0] || t >= eventTimes.[n - 1] then
                    out.[i] <- 0.0
                else
                    // Binary search for the bracketing interval
                    let mutable lo = 0
                    let mutable hi = n - 1
                    while hi - lo > 1 do
                        let mid = (lo + hi) / 2
                        if eventTimes.[mid] <= t then lo <- mid
                        else hi <- mid
                    let tk = eventTimes.[lo]
                    let tkNext = eventTimes.[lo + 1]
                    let interval = tkNext - tk
                    if interval <= 0.0 then out.[i] <- 0.0
                    else out.[i] <- twoPi * (t - tk) / interval
            out
