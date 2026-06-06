namespace Zeta.Core

open System
open System.Runtime.CompilerServices
open System.Threading


/// Event-time watermark — a monotone lower-bound on "no event with
/// timestamp ≤ `eventTime` will arrive from this source again". Follows
/// Akidau et al. "The Dataflow Model" (VLDB 2015); the same primitive
/// Apache Beam / Flink use to drive event-time window firing and late-
/// data handling.
///
/// **Why this matters for DBSP:** our existing windows (`Window.fs`) and
/// time-series joins (`TimeSeries.fs`) use processing time — good enough
/// for strictly in-order streams, but wrong whenever events arrive out
/// of order (any distributed source, really). Watermarks are the
/// minimum-viable ingredient for correct event-time semantics.
///
/// DBSP's retraction model actually makes late-data handling *cleaner*
/// than Beam's: instead of Beam's ACCUMULATING vs DISCARDING vs
/// RETRACTING firing modes, we just emit a `-Δ` for any window that had
/// already closed + a `+Δ` with the corrected value. That's invariant
/// under the linearity of `D` and `I` — no special framework support
/// needed.
[<Struct; IsReadOnly>]
type Watermark =
    val EventTime: int64
    val Source: int   // source-id; lets us track per-source watermarks
    new(eventTime: int64, source: int) = { EventTime = eventTime; Source = source }

    static member MinValue = Watermark(Int64.MinValue, 0)
    static member MaxValue = Watermark(Int64.MaxValue, 0)


/// A value carrying an explicit event-time stamp. Operators that respect
/// event-time semantics take `Stream<ZSet<Timestamped<'T>>>` instead of
/// `Stream<ZSet<'T>>`.
[<Struct; IsReadOnly>]
type Timestamped<'T> =
    val Value: 'T
    val EventTime: int64
    new(value: 'T, eventTime: int64) = { Value = value; EventTime = eventTime }


/// Strategy for deriving a watermark from observed events. Three
/// common patterns — and these are the three Flink exposes as
/// `WatermarkStrategy.forBoundedOutOfOrderness` / `forMonotonousTimestamps`
/// / custom.
[<RequireQualifiedAccess>]
type WatermarkStrategy =
    /// Events arrive strictly in-order; watermark = latest timestamp.
    | Monotonic
    /// Events may arrive up to `maxOutOfOrderness` late; watermark =
    /// `max observed - maxOutOfOrderness`. The standard Flink default.
    | BoundedLateness of maxLateness: TimeSpan
    /// Periodic: emit watermark = `latest - lateness` every `interval`.
    | Periodic of interval: TimeSpan * lateness: TimeSpan


/// Tracks the current watermark for a single source by observing event
/// timestamps. Applies the chosen strategy to compute the output
/// watermark. Thread-safe for single-writer / multi-reader use via
/// `Interlocked` + volatile.
[<Sealed>]
type WatermarkTracker(strategy: WatermarkStrategy) =
    let mutable maxSeen = Int64.MinValue
    let mutable lastEmitted = Int64.MinValue

    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    let candidateFor (observedMax: int64) : int64 =
        match strategy with
        | WatermarkStrategy.Monotonic -> observedMax
        | WatermarkStrategy.BoundedLateness lateness ->
            let latenessMs = int64 lateness.TotalMilliseconds
            // Saturating subtraction: observedMax near Int64.MinValue would underflow + wrap to a
            // large positive, breaking watermark monotonicity (Lior audit 2026-06-06). latenessMs >= 0.
            if observedMax <= Int64.MinValue + latenessMs then Int64.MinValue
            else observedMax - latenessMs
        | WatermarkStrategy.Periodic (_interval, lateness) ->
            let latenessMs = int64 lateness.TotalMilliseconds
            // Saturating subtraction: observedMax near Int64.MinValue would underflow + wrap to a
            // large positive, breaking watermark monotonicity (Lior audit 2026-06-06). latenessMs >= 0.
            if observedMax <= Int64.MinValue + latenessMs then Int64.MinValue
            else observedMax - latenessMs

    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    let rec publishMax (cell: byref<int64>) (value: int64) : int64 =
        let current = Volatile.Read &cell
        if value <= current then
            current
        else
            let prior = Interlocked.CompareExchange(&cell, value, current)
            if prior = current then value else publishMax &cell value

    /// Observe a new event timestamp. Returns the new watermark (may be
    /// unchanged from the previous value).
    member _.Observe(eventTime: int64) : int64 =
        let observedMax = publishMax &maxSeen eventTime
        publishMax &lastEmitted (candidateFor observedMax)

    member _.Current = Volatile.Read &lastEmitted
    member _.MaxObserved = Volatile.Read &maxSeen


/// Predicate: is `eventTime` late according to the current watermark?
/// Downstream windows can use this to decide whether to emit a retraction
/// for an already-closed window.
[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module Watermark =

    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    let isLate (wm: int64) (eventTime: int64) : bool = eventTime <= wm

    /// Combine per-source watermarks into a single downstream watermark.
    /// Downstream = `min` of all upstream sources — the standard Akidau
    /// rule: an operator can't make progress past the slowest input.
    let combine (sources: int64 seq) : int64 =
        let mutable min = Int64.MaxValue
        let mutable any = false
        for s in sources do
            any <- true
            if s < min then min <- s
        if any then min else Int64.MinValue
