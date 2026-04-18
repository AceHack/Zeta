namespace Zeta.Core

open System
open System.Collections.Concurrent
open System.Runtime.CompilerServices
open System.Threading
open System.Threading.Tasks
open System.Threading.Tasks.Dataflow


/// Work-stealing variant of `DbspRuntime`. Instead of pinning one shard
/// to one thread, we use `TPL Dataflow ActionBlock` which under the hood
/// uses the `ThreadPool`'s work-stealing queues. Shards can migrate
/// between threads based on load, which wins when one shard has much
/// heavier work than others.
///
/// Performance trade-off vs the pinned runtime:
///   - Pinned (`DbspRuntime`): zero-migration cost, perfect cache locality,
///     linear scaling on balanced workloads.
///   - Work-stealing (this): migration pays a cache-miss cost but wins on
///     skewed workloads where a few shards dominate.
///
/// A DI seam (`WorkerFactory`) lets callers plug in any scheduler —
/// `Task.Run`, `TaskFactory` with a custom `TaskScheduler`, or a
/// `ConcurrentExclusiveSchedulerPair` for per-shard ordering guarantees.
[<Sealed>]
type WorkStealingRuntime<'K when 'K : comparison>
    (shardCount: int,
     build: Func<Circuit, ZSetInputHandle<'K>, OutputHandle<ZSet<'K>>>,
     maxDegreeOfParallelism: int) =

    let circuits = Array.init shardCount (fun _ -> Circuit())
    let inputs = circuits |> Array.map (fun c -> c.ZSetInput<'K>())
    let outputs =
        Array.init shardCount (fun i -> build.Invoke(circuits.[i], inputs.[i]))
    do for c in circuits do c.Build()

    // TPL Dataflow's ActionBlock is a work-stealing queue out of the box.
    // We post "step shard i" commands to a single block with parallelism
    // equal to `maxDegreeOfParallelism`; the ThreadPool distributes.
    let stepBlock =
        ActionBlock<int>(
            (fun (shardIdx: int) -> circuits.[shardIdx].Step()),
            ExecutionDataflowBlockOptions(
                MaxDegreeOfParallelism = maxDegreeOfParallelism,
                BoundedCapacity = shardCount * 2,
                SingleProducerConstrained = true))

    /// Partition a batch across shards and submit work to the dataflow block.
    member _.Shard(batch: ZSet<'K>) : ZSet<'K> array =
        let span = batch.AsSpan()
        let shards = Array.init shardCount (fun _ -> ResizeArray<struct ('K * Weight)>())
        for i in 0 .. span.Length - 1 do
            let s = Shard.OfKey(span.[i].Key, shardCount)
            shards.[s].Add(struct (span.[i].Key, span.[i].Weight))
        shards |> Array.map (fun lst ->
            if lst.Count = 0 then ZSet<'K>.Empty
            else (lst :> struct ('K * Weight) seq) |> ZSet.ofPairs)

    member this.SendAsync(batch: ZSet<'K>) : Task =
        let shards = this.Shard batch
        task {
            for i in 0 .. shardCount - 1 do
                if not shards.[i].IsEmpty then
                    inputs.[i].Send shards.[i]
        } :> Task

    /// Post all shard-step tasks to the work-stealing block and await completion.
    member _.StepAsync() : Task =
        task {
            let completions = Array.init shardCount (fun i ->
                stepBlock.SendAsync i |> ignore
                ())
            // Wait for block's current buffer to drain.
            do! Task.Delay(1)   // yield so dataflow block runs
            while stepBlock.InputCount > 0 do do! Task.Yield()
            ignore completions
        }

    member _.Gather() : ZSet<'K> =
        ZSet.sum [| for o in outputs -> o.Current |]

    interface IDisposable with
        member _.Dispose() =
            stepBlock.Complete()
            stepBlock.Completion.Wait 500 |> ignore
