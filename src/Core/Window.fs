namespace Zeta.Core

open System
open System.Collections.Generic
open System.Runtime.CompilerServices
open System.Threading
open System.Threading.Tasks


/// Time-series types use unit-of-measure to keep tick counts and wall-clock
/// times from getting swapped. `tick` is the outer-clock integer counter;
/// `ms` is a millisecond interval.
[<Measure>] type tick
[<Measure>] type ms


/// Tumbling window — partitions an integer timestamp field into non-overlapping
/// windows of width `windowSize` and emits per-window aggregates.
///
/// A row whose `time` falls in `[w * windowSize, (w+1) * windowSize)` is
/// assigned to window `w`. Once the global tick advances past a window's end,
/// that window is closed (no more deltas expected) and its aggregate is stable.
/// This is a simplified incremental tumbling window without watermarks;
/// see `SlidingWindow` for the hopping/sliding variant.
[<Sealed>]
type internal TumblingWindowOp<'K when 'K : comparison>
    (input: Op<ZSet<'K>>,
     timeOf: Func<'K, int64>,
     windowSize: int64) =
    inherit Op<ZSet<int64 * 'K>>()
    let inputs = [| input :> Op |]
    override _.Name = "tumblingWindow"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let span = input.Value.AsSpan()
        if span.IsEmpty then
            this.Value <- ZSet<int64 * 'K>.Empty
        else
            let rented = Pool.Rent<ZEntry<int64 * 'K>> span.Length
            try
                for i in 0 .. span.Length - 1 do
                    let w = timeOf.Invoke span.[i].Key / windowSize
                    rented.[i] <- ZEntry((w, span.[i].Key), span.[i].Weight)
                let live = ZSetBuilder.sortAndConsolidate (Span<_>(rented, 0, span.Length))
                this.Value <-
                    if live = 0 then ZSet<int64 * 'K>.Empty
                    else ZSet(Pool.FreezeSlice(rented, live))
            finally
                Pool.Return rented
        ValueTask.CompletedTask


[<Extension>]
type WindowExtensions =

    /// Tumbling window — labels each row with its window index `⌊time/size⌋`
    /// and emits `Z[window × row]`. Compose with `GroupByCount`/`GroupBySum`/
    /// `GroupByMax` keyed on window to produce `OVER TUMBLE(size)` aggregates.
    [<Extension>]
    static member TumblingWindow<'K when 'K : comparison>
        (this: Circuit, s: Stream<ZSet<'K>>, timeOf: Func<'K, int64>, windowSize: int64) : Stream<ZSet<int64 * 'K>> =
        if windowSize <= 0L then invalidArg (nameof windowSize) "must be positive"
        this.RegisterStream (TumblingWindowOp(s.Op, timeOf, windowSize))
