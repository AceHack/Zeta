namespace Zeta.Core

open System
open System.Collections.Concurrent
open System.Collections.Generic
open System.Runtime.CompilerServices
open System.Threading
open System.Threading.Channels
open System.Threading.Tasks


/// Multi-worker runtime — partitions a Z-set workload across N worker
/// threads, each running an isolated sub-circuit on its own shard of the
/// input. Outputs are gathered in the main thread. Build-once, run-many.
///
/// This is the simplest useful sharded runtime: consistent-hash shard
/// assignment, back-pressured channels for shard inputs, a barrier per
/// tick. Feldera's `Runtime` is richer (dynamic scheduling, replicated
/// circuit builds), but this is enough to prove linear scaling on
/// embarrassingly-parallel workloads.
[<Sealed>]
type DbspRuntime<'K when 'K : comparison>
    (shardCount: int,
     build: Func<Circuit, ZSetInputHandle<'K>, OutputHandle<ZSet<'K>>>) =

    // One circuit + input + output per worker.
    let circuits = Array.init shardCount (fun _ -> Circuit())
    let inputs =
        circuits |> Array.map (fun c -> c.ZSetInput<'K>())
    let outputs =
        Array.init shardCount (fun i -> build.Invoke(circuits.[i], inputs.[i]))
    do for c in circuits do c.Build()

    // Per-worker input channels — producers push shard-local Z-sets;
    // worker threads drain and feed to their circuit.
    let channels =
        Array.init shardCount (fun _ ->
            Channel.CreateBounded<ZSet<'K>>(
                BoundedChannelOptions(1024,
                    SingleReader = true,
                    SingleWriter = false,
                    AllowSynchronousContinuations = false,
                    FullMode = BoundedChannelFullMode.Wait)))

    let cts = new CancellationTokenSource()

    /// Shard a batch by hashing each entry's key and split into N per-shard
    /// batches. Applied once by the producer before pushing to workers.
    member _.Shard(batch: ZSet<'K>) : ZSet<'K> array =
        let span = batch.AsSpan()
        let shards = Array.init shardCount (fun _ -> ResizeArray<struct ('K * Weight)>())
        for i in 0 .. span.Length - 1 do
            let s = Shard.OfKey(span.[i].Key, shardCount)
            shards.[s].Add(struct (span.[i].Key, span.[i].Weight))
        shards |> Array.map (fun lst ->
            if lst.Count = 0 then ZSet<'K>.Empty
            else (lst :> struct ('K * Weight) seq) |> ZSet.ofPairs)

    /// Submit a batch for parallel processing. Per-shard inputs are
    /// enqueued; each shard's worker will pick up before the next tick.
    member this.SendAsync(batch: ZSet<'K>) : ValueTask =
        let shards = this.Shard batch
        let pending = ResizeArray<ValueTask>()
        for i in 0 .. shardCount - 1 do
            if not shards.[i].IsEmpty then
                pending.Add(channels.[i].Writer.WriteAsync(shards.[i], cts.Token))
        task {
            for p in pending do
                if not p.IsCompletedSuccessfully then do! p.AsTask()
        } |> ValueTask

    /// Advance all shard circuits by one tick in parallel. Each worker
    /// drains its input channel, applies to its circuit, then publishes.
    member _.StepAsync() : Task =
        let tasks =
            Array.init shardCount (fun i ->
                Task.Run(fun () ->
                    let mutable acc = ZSet<'K>.Empty
                    let mutable item = Unchecked.defaultof<ZSet<'K>>
                    while channels.[i].Reader.TryRead &item do
                        acc <- if acc.IsEmpty then item else ZSet.add acc item
                    inputs.[i].Send acc
                    circuits.[i].Step()))
        Task.WhenAll tasks

    /// Gather per-shard outputs into a single Z-set.
    member _.Gather() : ZSet<'K> =
        let mutable acc = ZSet<'K>.Empty
        for o in outputs do
            if not o.Current.IsEmpty then
                acc <- if acc.IsEmpty then o.Current else ZSet.add acc o.Current
        acc

    /// Dispose worker channels and cancel any in-flight sends.
    interface IDisposable with
        member _.Dispose() =
            cts.Cancel()
            for ch in channels do ch.Writer.TryComplete() |> ignore
            cts.Dispose()
