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
//
// DST DISCIPLINE: these tests are async-all-the-way (Task signatures + do!/let!,
// NO .Wait/.Result) and, where DoP=1 makes it possible, drive the throttler in
// `manual = true` mode via PumpToIdleAsync — no background ferry, no Task.Delay
// timeout race, no wall-clock. The few tests that genuinely need background
// concurrency (DoP=N parallelism, bounded-queue backpressure, in-flight
// cancellation) keep background ferries but await real completion with no
// fixed-millisecond bound (a genuine hang surfaces via the runner timeout).
// ═══════════════════════════════════════════════════════════════════


/// Drive `items` through a MANUAL (DST) throttler — no background ferry, pumped
/// synchronously on this thread — collecting processed items + boat sizes. Fully
/// deterministic: enqueue-all-then-pump, so bursts coalesce exactly.
let private runCollectingManual
    (config: FerryThrottlerConfig)
    (items: int list)
    : Task<int list * int list> =
    task {
        let processed = ConcurrentQueue<int>()
        let boatSizes = ConcurrentQueue<int>()
        let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task =
            boatSizes.Enqueue boat.Length
            for i in 0 .. boat.Length - 1 do processed.Enqueue(boat.Span.[i])
            Task.CompletedTask
        use throttler = new FerryThrottler<int>(config, processBatch, manual = true)
        for x in items do
            do! throttler.EnqueueAsync(x)
        do! throttler.PumpToIdleAsync()
        do! throttler.CompleteAsync()
        return List.ofSeq processed, List.ofSeq boatSizes
    }


/// Drive `items` through a BACKGROUND throttler (for DoP=N / backpressure tests
/// where parallelism or producer-blocking is the point), async-all-the-way.
let private runCollecting
    (config: FerryThrottlerConfig)
    (items: int list)
    : Task<int list * int list> =
    task {
        let processed = ConcurrentQueue<int>()
        let boatSizes = ConcurrentQueue<int>()
        let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task =
            boatSizes.Enqueue boat.Length
            for i in 0 .. boat.Length - 1 do processed.Enqueue(boat.Span.[i])
            Task.CompletedTask
        use throttler = new FerryThrottler<int>(config, processBatch)
        for x in items do
            do! throttler.EnqueueAsync(x)
        do! throttler.CompleteAsync()
        return List.ofSeq processed, List.ofSeq boatSizes
    }


[<Fact>]
let ``DoP=1 processes every item exactly once, in order`` () : Task =
    task {
        let items = [ 1 .. 100 ]
        let! processed, _ = runCollectingManual FerryThrottlerConfig.deterministic items
        // Single ferry, deterministic FIFO order preserved.
        processed |> should equal items
    }


[<Fact>]
let ``slow traffic ships boats of one — no artificial batching delay`` () : Task =
    // Fully DETERMINISTIC and async-all-the-way: `manual = true` starts no ferry;
    // we drive each item's boat with PumpToIdleAsync, `do!`-awaited. "Slow traffic"
    // = enqueue ONE, then pump — so each ships as a boat of 1 (anti-Nagle).
    task {
        let processed = ConcurrentQueue<int>()
        let boats = ConcurrentQueue<int>()
        let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task =
            boats.Enqueue boat.Length
            for i in 0 .. boat.Length - 1 do processed.Enqueue(boat.Span.[i])
            Task.CompletedTask
        use throttler = new FerryThrottler<int>(FerryThrottlerConfig.deterministic, processBatch, manual = true)
        for x in [ 10; 20; 30 ] do
            do! throttler.EnqueueAsync(x)
            do! throttler.PumpToIdleAsync() // process exactly this item's boat, now
        do! throttler.CompleteAsync()
        List.ofSeq processed |> should equal [ 10; 20; 30 ]
        // Every boat carried exactly one passenger.
        List.ofSeq boats |> List.forall (fun n -> n = 1) |> should equal true
    }


[<Fact>]
let ``bursty traffic coalesces into larger boats up to MaxBatchSize`` () : Task =
    // Pre-load the queue (enqueue all), THEN pump — a single ferry should scoop
    // multiple items per boat. Boats can exceed 1, never exceed MaxBatchSize.
    task {
        let config = { FerryThrottlerConfig.deterministic with MaxBatchSize = 4 }
        let! _processed, boats = runCollectingManual config [ 1 .. 50 ]
        boats |> List.sum |> should equal 50
        boats |> List.forall (fun n -> n >= 1 && n <= 4) |> should equal true
        // Coalescing actually happened (at least one boat carried > 1).
        boats |> List.exists (fun n -> n > 1) |> should equal true
    }


[<Fact>]
let ``DoP=N processes every item exactly once (set-equal; order not guaranteed)`` () : Task =
    task {
        let items = [ 1 .. 500 ]
        let! processed, _ = runCollecting (FerryThrottlerConfig.withFerries 4) items
        processed.Length |> should equal 500
        (Set.ofList processed) |> should equal (Set.ofList items)
    }


[<Fact>]
let ``bounded queue applies backpressure without dropping work`` () : Task =
    // Tiny bounded queue + a slow processor. Producer must block on EnqueueAsync
    // (awaited cooperatively) rather than drop; all items still arrive. This one
    // genuinely needs background ferries draining concurrently with the producer.
    task {
        let processed = ConcurrentQueue<int>()
        let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task =
            task {
                do! Task.Delay 1
                for i in 0 .. boat.Length - 1 do processed.Enqueue(boat.Span.[i])
            }
            :> Task
        let config = { FerryThrottlerConfig.deterministic with MaxQueueSize = Some 2 }
        use throttler = new FerryThrottler<int>(config, processBatch)
        for x in [ 1 .. 30 ] do
            do! throttler.EnqueueAsync(x)
        do! throttler.CompleteAsync()
        processed.Count |> should equal 30
        (Set.ofSeq processed) |> should equal (Set.ofList [ 1 .. 30 ])
    }


[<Fact>]
let ``byte budget closes boats to match serialization size`` () : Task =
    // Each item is 10 bytes; budget 25 ⇒ boats of at most 2 items (20 <= 25,
    // adding a 3rd would be 30 > 25). All items still ship, totals conserved.
    task {
        let boats = ConcurrentQueue<int>()
        let processed = ConcurrentQueue<int>()
        let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task =
            boats.Enqueue boat.Length
            for i in 0 .. boat.Length - 1 do processed.Enqueue(boat.Span.[i])
            Task.CompletedTask
        let config = { FerryThrottlerConfig.deterministic with MaxBatchSize = 100; MaxBatchBytes = Some 25 }
        use throttler = new FerryThrottler<int>(config, processBatch, itemSizeBytes = (fun _ -> 10), manual = true)
        for x in [ 1 .. 10 ] do
            do! throttler.EnqueueAsync(x)
        do! throttler.PumpToIdleAsync()
        do! throttler.CompleteAsync()
        (Set.ofSeq processed) |> should equal (Set.ofList [ 1 .. 10 ])
        // No boat exceeds the 2-item byte budget.
        List.ofSeq boats |> List.forall (fun n -> n >= 1 && n <= 2) |> should equal true
    }


[<Fact>]
let ``a single oversized item still ships alone`` () : Task =
    // Item is 100 bytes, budget is 25 — it exceeds the budget but must not stall.
    task {
        let processed = ConcurrentQueue<int>()
        let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task =
            for i in 0 .. boat.Length - 1 do processed.Enqueue(boat.Span.[i])
            Task.CompletedTask
        let config = { FerryThrottlerConfig.deterministic with MaxBatchBytes = Some 25 }
        use throttler = new FerryThrottler<int>(config, processBatch, itemSizeBytes = (fun _ -> 100), manual = true)
        do! throttler.EnqueueAsync(42)
        do! throttler.PumpToIdleAsync()
        do! throttler.CompleteAsync()
        List.ofSeq processed |> should equal [ 42 ]
    }


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
let ``result arity returns one aligned result per item`` () : Task =
    task {
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
        let! results = Task.WhenAll(tasks)
        do! throttler.CompleteAsync()
        results |> should equal [| for x in 1 .. 20 -> x * 10 |]
    }


[<Fact>]
let ``result arity faults entire boat on result-length mismatch`` () : Task =
    task {
        let processBatch (_boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task<int array> =
            Task.FromResult [||]
        let config = { FerryThrottlerConfig.deterministic with MaxBatchSize = 4 }
        use throttler = new FerryThrottler<int, int>(config, processBatch)
        let tasks =
            [ 1 .. 4 ]
            |> List.map (fun x -> throttler.ProcessAsync x)
            |> Array.ofList
        // Await to completion; the boat faults, so swallow the await-throw — the
        // real assertion is the per-task fault state below.
        try
            let! _ = Task.WhenAll(tasks)
            ()
        with _ -> ()
        do! throttler.CompleteAsync()
        tasks
        |> Array.forall (fun t -> t.IsFaulted && t.Exception.InnerExceptions |> Seq.exists (fun ex -> ex :? InvalidOperationException))
        |> should equal true
    }


[<Fact>]
let ``result arity faults every item when processor throws`` () : Task =
    task {
        let boom = InvalidOperationException "boom"
        let processBatch (_boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task<int array> =
            Task.FromException<int array> boom
        use throttler = new FerryThrottler<int, int>(FerryThrottlerConfig.deterministic, processBatch)
        let tasks =
            [ 1 .. 3 ]
            |> List.map (fun x -> throttler.ProcessAsync x)
            |> Array.ofList
        try
            let! _ = Task.WhenAll(tasks)
            ()
        with _ -> ()
        do! throttler.CompleteAsync()
        tasks |> Array.forall (fun t -> t.IsFaulted) |> should equal true
    }


[<Fact>]
let ``result arity cancels queued item before shipping`` () : Task =
    // Genuinely concurrent: the first boat is held in-flight (gate) while a second
    // is queued and cancelled. Coordinated by TCS handshakes (entered/gate), not a
    // wall-clock — bare awaits, no fixed-ms bound.
    task {
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
        do! entered.Task // first boat is now in-flight
        use cts = new CancellationTokenSource()
        let second = throttler.ProcessAsync(2, cts.Token)
        cts.Cancel()
        gate.SetResult()
        let! _ = first
        // second was cancelled while queued — awaiting it throws; swallow, assert state.
        try
            let! _ = second
            ()
        with _ -> ()
        do! throttler.CompleteAsync()
        second.IsCanceled |> should equal true
        List.ofSeq processed |> should equal [ 1 ]
    }


[<Fact>]
let ``result arity dispose cancels queued caller tasks`` () : Task =
    task {
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
        do! entered.Task
        let second = throttler.ProcessAsync 2
        (throttler :> IDisposable).Dispose()
        // Dispose cancels both the queued and the in-flight caller — bare awaits
        // (no Task.Delay race); they complete via cancel/fault, then assert state.
        try
            let! _ = second
            ()
        with _ -> ()
        second.IsCanceled |> should equal true
        try
            let! _ = first
            ()
        with _ -> ()
        (first.IsCanceled || first.IsFaulted) |> should equal true
    }


[<Fact>]
let ``result arity honors byte budget while preserving aligned results`` () : Task =
    task {
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
        let! results = Task.WhenAll(tasks)
        do! throttler.CompleteAsync()
        results |> should equal [| for x in 1 .. 10 -> x + 1 |]
        List.ofSeq boats |> List.forall (fun n -> n >= 1 && n <= 2) |> should equal true
    }


[<Fact>]
let ``result arity faults request when byte sizer throws`` () : Task =
    task {
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
        let! oks = Task.WhenAll([| ok1; ok3 |])
        // `bad` faults when the sizer throws — swallow the await-throw, assert state.
        try
            let! _ = bad
            ()
        with _ -> ()
        bad.IsFaulted |> should equal true
        bad.Exception.InnerExceptions |> Seq.exists (fun ex -> ex.Message = "size failed") |> should equal true
        do! throttler.CompleteAsync()
        oks |> should equal [| 1; 3 |]
        List.ofSeq processed |> should equal [ 1; 3 ]
    }


[<Fact>]
let ``contextual throttler threads each item's context to its boat (explicit Arrow)`` () : Task =
    // Explicit context-as-data (the Kleisli-Arrow shape): each item's context is
    // supplied at enqueue and arrives WITH the item at the boat — no AsyncLocal.
    // Deterministic via manual-pump.
    task {
        let seen = ConcurrentQueue<struct (int * string)>()
        let processBatch (boat: ReadOnlyMemory<struct (int * string)>) (_ct: CancellationToken) : Task =
            for i in 0 .. boat.Length - 1 do seen.Enqueue(boat.Span.[i])
            Task.CompletedTask
        use throttler =
            new ContextualFerryThrottler<int, string>(FerryThrottlerConfig.deterministic, processBatch, manual = true)
        do! throttler.EnqueueAsync(1, "ctx-a")
        do! throttler.EnqueueAsync(2, "ctx-b")
        do! throttler.PumpToIdleAsync()
        do! throttler.CompleteAsync()
        List.ofSeq seen |> should equal [ struct (1, "ctx-a"); struct (2, "ctx-b") ]
    }
