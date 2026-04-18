namespace Zeta.Core

open System
open System.Threading
open System.Threading.Channels
open System.Threading.Tasks


/// Async-merging LSM spine. Producers enqueue batches into an unbounded
/// channel; a single background worker drains the channel and performs the
/// cascading merge under a lock. The producer's hot path is just a channel
/// write (~20-50 ns); the merge cost is deferred to the worker.
///
/// Steady-state throughput matches the sync spine (same O(log n) amortised)
/// but **tick-time variance drops sharply**: producers never pay for a deep
/// cascade. This is Feldera's `spine_async` pattern.
///
/// `Flush()` synchronises with the worker via interlocked counters — the
/// producer's `sent` monotonically increases; the worker's `processed`
/// catches up after each item. Flush returns when they equal.
[<Sealed>]
type SpineAsync<'K when 'K : comparison>() =
    let spine = Spine<'K>()
    let spineLock = obj ()
    let mutable sent = 0L
    let mutable processed = 0L
    let inbox =
        Channel.CreateUnbounded<ZSet<'K>>(
            UnboundedChannelOptions(SingleReader = true, SingleWriter = false))
    let cts = new CancellationTokenSource()

    let worker : Task =
        Task.Run(fun () ->
            let reader = inbox.Reader
            try
                let mutable item = Unchecked.defaultof<ZSet<'K>>
                while not cts.IsCancellationRequested do
                    // Block synchronously on the channel reader using
                    // `WaitToReadAsync` awaited via `.GetAwaiter().GetResult()`.
                    // Acceptable because the worker task has no other work.
                    let ready =
                        try reader.WaitToReadAsync(cts.Token).AsTask().Result
                        with :? AggregateException -> false
                    if ready then
                        while reader.TryRead &item do
                            lock spineLock (fun () -> spine.Insert item)
                            Interlocked.Increment &processed |> ignore
            with :? OperationCanceledException -> ())

    /// Enqueue a batch for background merging. TryWrite MUST precede the
    /// `sent` increment — otherwise `Flush()` can observe `sent = N+1`
    /// before item N+1 is actually in the channel, and if the worker has
    /// already processed N, `processed ≥ sent` falsely returns.
    member _.Insert(batch: ZSet<'K>) =
        if not batch.IsEmpty then
            if inbox.Writer.TryWrite batch then
                Interlocked.Increment &sent |> ignore

    /// Wait until the worker has absorbed every batch enqueued BEFORE this
    /// call. Uses `SpinWait`+`Thread.Yield` — cheap and race-free because
    /// `target` is captured at entry and `processed` only grows monotonically.
    member _.Flush() : Task =
        let target = Volatile.Read &sent
        task {
            let mutable sw = SpinWait()
            while Volatile.Read &processed < target do
                if sw.NextSpinWillYield then do! Task.Yield()
                sw.SpinOnce()
        }

    member _.Depth = lock spineLock (fun () -> spine.Depth)
    member _.Count = lock spineLock (fun () -> spine.Count)

    member _.Consolidate() : ZSet<'K> =
        lock spineLock (fun () -> spine.Consolidate())

    member _.Levels : ZSet<'K> array =
        lock spineLock (fun () -> spine.Levels)

    interface IDisposable with
        member _.Dispose() =
            inbox.Writer.TryComplete() |> ignore
            cts.Cancel()
            try worker.Wait 500 |> ignore with _ -> ()
            cts.Dispose()
