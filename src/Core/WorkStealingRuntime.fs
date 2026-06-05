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
    //
    // Each command carries a TaskCompletionSource that is signalled AFTER the
    // shard's Step() has fully run (or faulted). StepAsync awaits all of them,
    // so the observable result is DETERMINISTIC regardless of thread-scheduling
    // timing — the work-stealing parallelism is an internal detail, not an
    // externally-visible race. (The old code polled `InputCount`, which only
    // reports the *input queue* draining — the last item can be dequeued and
    // still mid-Step() — so `Gather()` could read partial output: a real,
    // non-deterministic flake. This replaces that with true completion.)
    let stepBlock =
        ActionBlock<int * TaskCompletionSource<bool>>(
            (fun (shardIdx: int, tcs: TaskCompletionSource<bool>) ->
                try
                    circuits.[shardIdx].Step()
                    tcs.SetResult true
                with ex ->
                    tcs.SetException ex),
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

    /// Post all shard-step tasks to the work-stealing block and await the ACTUAL
    /// completion of every shard's Step() — deterministic result, no timing race.
    member _.StepAsync() : Task =
        task {
            let tcss =
                Array.init shardCount (fun _ ->
                    TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously))
            // Await each send (respects BoundedCapacity back-pressure — no dropped work).
            for i in 0 .. shardCount - 1 do
                let! _ = stepBlock.SendAsync((i, tcss.[i]))
                ()
            // Await every shard's Step() to fully complete before returning.
            do! (Task.WhenAll(tcss |> Array.map (fun t -> t.Task)) :> Task)
        }

    member _.Gather() : ZSet<'K> =
        ZSet.sum [| for o in outputs -> o.Current |]

    interface IDisposable with
        member _.Dispose() =
            stepBlock.Complete()
            stepBlock.Completion.Wait 500 |> ignore
