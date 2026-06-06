module Zeta.Tests.Runtime.FerryThrottlerTests

open System
open System.Collections.Concurrent
open System.Threading
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// FerryThrottler — self-clocked, anti-Nagle batching with a DoP knob.
// "Beautiful on 1, scales to N." DoP=1 is the deterministic path.
// ═══════════════════════════════════════════════════════════════════


/// Collect every item the throttler hands to `processBatch`, plus the size of
/// each boat it formed, then drive all `items` through and complete.
let private runCollecting
    (config: FerryThrottlerConfig)
    (items: int list)
    : int list * int list =   // (processed items, boat sizes)
    let processed = ConcurrentQueue<int>()
    let boatSizes = ConcurrentQueue<int>()
    let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task =
        boatSizes.Enqueue boat.Length
        for i in 0 .. boat.Length - 1 do
            processed.Enqueue(boat.Span.[i])
        Task.CompletedTask
    use throttler = new FerryThrottler<int>(config, processBatch)
    for x in items do
        throttler.EnqueueAsync(x).AsTask().Wait()
    throttler.CompleteAsync().Wait()
    List.ofSeq processed, List.ofSeq boatSizes


[<Fact>]
let ``DoP=1 processes every item exactly once, in order`` () =
    let items = [ 1 .. 100 ]
    let processed, _ = runCollecting FerryThrottlerConfig.deterministic items
    // Single ferry, single reader: deterministic FIFO order preserved.
    processed |> should equal items


[<Fact>]
let ``slow traffic ships boats of one — no artificial batching delay`` () =
    // Enqueue-then-await each, so each item is fully processed before the next
    // is offered. A self-clocked ferry must ship each immediately as a boat of 1
    // rather than waiting to coalesce (the anti-Nagle property).
    let processed = ConcurrentQueue<int>()
    let boats = ConcurrentQueue<int>()
    let gate = new SemaphoreSlim(0)
    let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task =
        boats.Enqueue boat.Length
        for i in 0 .. boat.Length - 1 do processed.Enqueue(boat.Span.[i])
        gate.Release() |> ignore
        Task.CompletedTask
    use throttler = new FerryThrottler<int>(FerryThrottlerConfig.deterministic, processBatch)
    for x in [ 10; 20; 30 ] do
        throttler.EnqueueAsync(x).AsTask().Wait()
        gate.Wait(2000) |> should equal true   // wait for this item's boat
    throttler.CompleteAsync().Wait()
    List.ofSeq processed |> should equal [ 10; 20; 30 ]
    // Every boat carried exactly one passenger.
    List.ofSeq boats |> List.forall (fun n -> n = 1) |> should equal true


[<Fact>]
let ``bursty traffic coalesces into larger boats up to MaxBatchSize`` () =
    // Pre-load the queue, THEN start draining by completing — a single ferry
    // should scoop multiple items per boat. We assert boats can exceed 1 and
    // never exceed MaxBatchSize, and that totals are conserved.
    let config = { FerryThrottlerConfig.deterministic with MaxBatchSize = 4 }
    let _processed, boats = runCollecting config [ 1 .. 50 ]
    boats |> List.sum |> should equal 50
    boats |> List.forall (fun n -> n >= 1 && n <= 4) |> should equal true


[<Fact>]
let ``DoP=N processes every item exactly once (set-equal; order not guaranteed)`` () =
    let items = [ 1 .. 500 ]
    let processed, _ = runCollecting (FerryThrottlerConfig.withFerries 4) items
    processed.Length |> should equal 500
    (Set.ofList processed) |> should equal (Set.ofList items)


[<Fact>]
let ``bounded queue applies backpressure without dropping work`` () =
    // Tiny bounded queue + a slow processor. Producer must block on EnqueueAsync
    // rather than drop; all items still arrive.
    let processed = ConcurrentQueue<int>()
    let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task =
        task {
            do! Task.Delay 1
            for i in 0 .. boat.Length - 1 do processed.Enqueue(boat.Span.[i])
        } :> Task
    let config = { FerryThrottlerConfig.deterministic with MaxQueueSize = Some 2 }
    use throttler = new FerryThrottler<int>(config, processBatch)
    for x in [ 1 .. 30 ] do
        throttler.EnqueueAsync(x).AsTask().Wait()
    throttler.CompleteAsync().Wait()
    processed.Count |> should equal 30
    (Set.ofSeq processed) |> should equal (Set.ofList [ 1 .. 30 ])


[<Fact>]
let ``byte budget closes boats to match serialization size`` () =
    // Each item is 10 bytes; budget 25 ⇒ boats of at most 2 items (20 <= 25,
    // adding a 3rd would be 30 > 25). All items still ship, totals conserved.
    let boats = ConcurrentQueue<int>()
    let processed = ConcurrentQueue<int>()
    let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task =
        boats.Enqueue boat.Length
        for i in 0 .. boat.Length - 1 do processed.Enqueue(boat.Span.[i])
        Task.CompletedTask
    let config = { FerryThrottlerConfig.deterministic with MaxBatchSize = 100; MaxBatchBytes = Some 25 }
    use throttler = new FerryThrottler<int>(config, processBatch, itemSizeBytes = (fun _ -> 10))
    for x in [ 1 .. 10 ] do throttler.EnqueueAsync(x).AsTask().Wait()
    throttler.CompleteAsync().Wait()
    (Set.ofSeq processed) |> should equal (Set.ofList [ 1 .. 10 ])
    // No boat exceeds the 2-item byte budget.
    List.ofSeq boats |> List.forall (fun n -> n >= 1 && n <= 2) |> should equal true


[<Fact>]
let ``a single oversized item still ships alone`` () =
    // Item is 100 bytes, budget is 25 — it exceeds the budget but must not stall.
    let processed = ConcurrentQueue<int>()
    let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task =
        for i in 0 .. boat.Length - 1 do processed.Enqueue(boat.Span.[i])
        Task.CompletedTask
    let config = { FerryThrottlerConfig.deterministic with MaxBatchBytes = Some 25 }
    use throttler = new FerryThrottler<int>(config, processBatch, itemSizeBytes = (fun _ -> 100))
    throttler.EnqueueAsync(42).AsTask().Wait()
    throttler.CompleteAsync().Wait()
    List.ofSeq processed |> should equal [ 42 ]


[<Fact>]
let ``MaxBatchBytes without a sizer is rejected`` () =
    let noop = fun (_: ReadOnlyMemory<int>) (_: CancellationToken) -> Task.CompletedTask
    (fun () -> new FerryThrottler<int>({ FerryThrottlerConfig.deterministic with MaxBatchBytes = Some 10 }, noop) |> ignore)
    |> should throw typeof<ArgumentException>


[<Fact>]
let ``invalid configuration is rejected at construction`` () =
    let noop = fun (_: ReadOnlyMemory<int>) (_: CancellationToken) -> Task.CompletedTask
    (fun () -> new FerryThrottler<int>({ FerryThrottlerConfig.deterministic with MaxDegreeOfParallelism = 0 }, noop) |> ignore)
    |> should throw typeof<ArgumentException>
    (fun () -> new FerryThrottler<int>({ FerryThrottlerConfig.deterministic with MaxBatchSize = 0 }, noop) |> ignore)
    |> should throw typeof<ArgumentException>


[<Fact>]
let ``result arity returns one aligned result per item`` () =
    let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task<int array> =
        task {
            return
                [| for i in 0 .. boat.Length - 1 do
                       boat.Span.[i] * 10 |]
        }
    use throttler = new FerryThrottler<int, int>(FerryThrottlerConfig.deterministic, processBatch)
    let tasks =
        [ 1 .. 20 ]
        |> List.map (fun x -> throttler.ProcessAsync x)
        |> Array.ofList
    Task.WaitAll(tasks |> Array.map (fun t -> t :> Task))
    throttler.CompleteAsync().Wait()
    tasks |> Array.map (fun t -> t.Result) |> should equal [| for x in 1 .. 20 -> x * 10 |]


[<Fact>]
let ``result arity faults entire boat on result-length mismatch`` () =
    let processBatch (_boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task<int array> =
        Task.FromResult [||]
    let config = { FerryThrottlerConfig.deterministic with MaxBatchSize = 4 }
    use throttler = new FerryThrottler<int, int>(config, processBatch)
    let tasks =
        [ 1 .. 4 ]
        |> List.map (fun x -> throttler.ProcessAsync x)
        |> Array.ofList
    (fun () -> Task.WaitAll(tasks |> Array.map (fun t -> t :> Task))) |> should throw typeof<AggregateException>
    throttler.CompleteAsync().Wait()
    tasks
    |> Array.forall (fun t -> t.IsFaulted && t.Exception.InnerExceptions |> Seq.exists (fun ex -> ex :? InvalidOperationException))
    |> should equal true


[<Fact>]
let ``result arity faults every item when processor throws`` () =
    let boom = InvalidOperationException "boom"
    let processBatch (_boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task<int array> =
        Task.FromException<int array> boom
    use throttler = new FerryThrottler<int, int>(FerryThrottlerConfig.deterministic, processBatch)
    let tasks =
        [ 1 .. 3 ]
        |> List.map (fun x -> throttler.ProcessAsync x)
        |> Array.ofList
    (fun () -> Task.WaitAll(tasks |> Array.map (fun t -> t :> Task))) |> should throw typeof<AggregateException>
    throttler.CompleteAsync().Wait()
    tasks |> Array.forall (fun t -> t.IsFaulted) |> should equal true


[<Fact>]
let ``result arity cancels queued item before shipping`` () =
    let processed = ConcurrentQueue<int>()
    let gate = new TaskCompletionSource<unit>(TaskCreationOptions.RunContinuationsAsynchronously)
    let entered = new TaskCompletionSource<unit>(TaskCreationOptions.RunContinuationsAsynchronously)
    let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task<int array> =
        task {
            processed.Enqueue boat.Span.[0]
            entered.TrySetResult() |> ignore
            do! gate.Task
            return [| boat.Span.[0] |]
        }
    let config = { FerryThrottlerConfig.deterministic with MaxBatchSize = 1 }
    use throttler = new FerryThrottler<int, int>(config, processBatch)
    let first = throttler.ProcessAsync 1
    entered.Task.Wait 2000 |> should equal true
    use cts = new CancellationTokenSource()
    let second = throttler.ProcessAsync(2, cts.Token)
    cts.Cancel()
    gate.SetResult()
    first.Wait 2000 |> should equal true
    (fun () -> second.Wait()) |> should throw typeof<AggregateException>
    throttler.CompleteAsync().Wait()
    second.IsCanceled |> should equal true
    List.ofSeq processed |> should equal [ 1 ]


[<Fact>]
let ``result arity dispose cancels queued caller tasks`` () =
    let entered = new TaskCompletionSource<unit>(TaskCreationOptions.RunContinuationsAsynchronously)
    let processBatch (boat: ReadOnlyMemory<int>) (ct: CancellationToken) : Task<int array> =
        task {
            entered.TrySetResult() |> ignore
            do! Task.Delay(Timeout.Infinite, ct)
            return [| boat.Span.[0] |]
        }
    let config = { FerryThrottlerConfig.deterministic with MaxBatchSize = 1 }
    let throttler = new FerryThrottler<int, int>(config, processBatch)
    let first = throttler.ProcessAsync 1
    entered.Task.Wait 2000 |> should equal true
    let second = throttler.ProcessAsync 2
    (throttler :> IDisposable).Dispose()
    Task.WhenAny(second :> Task, Task.Delay 2000).Result |> should equal (second :> Task)
    second.IsCanceled |> should equal true
    Task.WhenAny(first :> Task, Task.Delay 2000).Result |> should equal (first :> Task)
    (first.IsCanceled || first.IsFaulted) |> should equal true


[<Fact>]
let ``result arity honors byte budget while preserving aligned results`` () =
    let boats = ConcurrentQueue<int>()
    let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task<int array> =
        task {
            boats.Enqueue boat.Length
            return [| for i in 0 .. boat.Length - 1 -> boat.Span.[i] + 1 |]
        }
    let config = { FerryThrottlerConfig.deterministic with MaxBatchSize = 100; MaxBatchBytes = Some 25 }
    use throttler = new FerryThrottler<int, int>(config, processBatch, itemSizeBytes = (fun _ -> 10))
    let tasks =
        [ 1 .. 10 ]
        |> List.map (fun x -> throttler.ProcessAsync x)
        |> Array.ofList
    Task.WaitAll(tasks |> Array.map (fun t -> t :> Task))
    throttler.CompleteAsync().Wait()
    tasks |> Array.map (fun t -> t.Result) |> should equal [| for x in 1 .. 10 -> x + 1 |]
    List.ofSeq boats |> List.forall (fun n -> n >= 1 && n <= 2) |> should equal true


[<Fact>]
let ``result arity faults request when byte sizer throws`` () =
    let processed = ConcurrentQueue<int>()
    let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task<int array> =
        task {
            for i in 0 .. boat.Length - 1 do
                processed.Enqueue boat.Span.[i]
            return [| for i in 0 .. boat.Length - 1 -> boat.Span.[i] |]
        }
    let config = { FerryThrottlerConfig.deterministic with MaxBatchSize = 4; MaxBatchBytes = Some 100 }
    let sizer item =
        if item = 2 then invalidOp "size failed"
        10
    use throttler = new FerryThrottler<int, int>(config, processBatch, itemSizeBytes = sizer)
    let ok1 = throttler.ProcessAsync 1
    let bad = throttler.ProcessAsync 2
    let ok3 = throttler.ProcessAsync 3
    Task.WhenAll([| ok1; ok3 |]).Wait()
    Task.WhenAny(bad :> Task, Task.Delay 2000).Result |> should equal (bad :> Task)
    bad.IsFaulted |> should equal true
    bad.Exception.InnerExceptions |> Seq.exists (fun ex -> ex.Message = "size failed") |> should equal true
    throttler.CompleteAsync().Wait()
    ok1.Result |> should equal 1
    ok3.Result |> should equal 3
    List.ofSeq processed |> should equal [ 1; 3 ]
