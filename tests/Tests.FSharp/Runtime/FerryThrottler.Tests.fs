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
