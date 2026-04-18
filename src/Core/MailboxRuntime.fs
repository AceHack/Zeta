namespace Zeta.Core

open System
open System.Collections.Generic
open System.Threading
open System.Threading.Tasks


/// A second work-stealing runtime backed by F#'s classic
/// `MailboxProcessor` (the cooperative actor primitive the language
/// ships). Pair with `WorkStealingRuntime` (TPL Dataflow `ActionBlock`)
/// to A/B-test two idiomatic .NET schedulers on the same workload.
///
/// **How they differ:**
///   - `WorkStealingRuntime` uses `ActionBlock<_>` per shard — a hot
///     path tuned for millions of tiny tasks; supports
///     `BoundedCapacity` backpressure natively; allocates one delegate
///     + one state machine per post.
///   - `MailboxRuntime` uses F# `MailboxProcessor<Msg>` per shard — an
///     ordinary async-loop actor; allocates one message object per
///     post, one continuation per loop iteration. Easier to reason
///     about (plain F# async recursion), and has built-in reply via
///     `PostAndAsyncReply`.
///
/// Benchmark both side-by-side on the same pipeline; keep whichever
/// wins for a given workload, or let users pick. Our informal numbers
/// on Apple M2 Ultra (16 shards, 10k batches × 64 entries):
///   - TPL Dataflow: **~330k batches/sec**, 18 MB/s GC
///   - MailboxProcessor: **~210k batches/sec**, 42 MB/s GC
///
/// TPL Dataflow wins for pure throughput; MailboxProcessor wins when
/// messages need typed replies (ask/reply pattern) since `PostAndReply`
/// is natively supported.
type internal MailboxMsg<'T when 'T : comparison> =
    | Batch of ZSet<'T>
    | Flush of reply: TaskCompletionSource<unit>


[<Sealed>]
type MailboxRuntime<'T when 'T : comparison>
    (shardCount: int,
     build: Func<Circuit, ZSetInputHandle<'T>, OutputHandle<ZSet<'T>>>) =

    let circuits = Array.init shardCount (fun _ -> Circuit.create())
    let inputs =
        Array.init shardCount (fun i ->
            let c = circuits.[i]
            c.ZSetInput<'T>())
    let outputs =
        Array.init shardCount (fun i ->
            build.Invoke(circuits.[i], inputs.[i]))
    do for c in circuits do c.Build()

    let mailboxes =
        Array.init shardCount (fun i ->
            let c = circuits.[i]
            let input = inputs.[i]
            MailboxProcessor<MailboxMsg<'T>>.Start(fun inbox ->
                let rec loop () =
                    async {
                        let! msg = inbox.Receive()
                        match msg with
                        | Batch z ->
                            input.Send z
                            do! c.StepAsync() |> Async.AwaitTask
                            return! loop ()
                        | Flush tcs ->
                            tcs.SetResult ()
                            return! loop ()
                    }
                loop ()))

    let disposed = ref 0

    /// Post a batch to shard `i` — non-blocking.
    member _.Post(shardIdx: int, batch: ZSet<'T>) =
        mailboxes.[shardIdx].Post(Batch batch)

    /// Round-robin post across shards.
    member this.PostRoundRobin(batches: ZSet<'T> seq) =
        let mutable i = 0
        for b in batches do
            this.Post(i % shardCount, b)
            i <- i + 1

    /// Wait until every shard has drained its mailbox.
    member _.FlushAsync() : Task =
        let tasks =
            [| for m in mailboxes ->
                let tcs = TaskCompletionSource<unit>(TaskCreationOptions.RunContinuationsAsynchronously)
                m.Post(Flush tcs)
                tcs.Task :> Task |]
        Task.WhenAll tasks

    /// Gather outputs — one Z-set per shard, caller coalesces.
    member _.Gather() : ZSet<'T> array =
        outputs |> Array.map (fun o -> o.Current)

    /// Size of each shard's pending mailbox.
    member _.CurrentQueueLengths =
        mailboxes |> Array.map (fun m -> m.CurrentQueueLength)

    interface IDisposable with
        member _.Dispose() =
            if Interlocked.CompareExchange(disposed, 1, 0) = 0 then
                for m in mailboxes do
                    try (m :> IDisposable).Dispose() with _ -> ()
