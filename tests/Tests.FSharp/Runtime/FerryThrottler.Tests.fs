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


[<Fact>]
let ``contextual throttler captures ambient context AT the enqueue boundary, not at process`` () : Task =
    // Capture-at-the-boundary (Itron pattern): the ambient is snapshotted on the
    // enqueuer's flow at EnqueueCapturedAsync time and threaded as data. Mutating
    // the ambient AFTER enqueue must NOT change what the boat sees — proving the
    // snapshot happened at the door, not at processing.
    task {
        let ambient = AsyncLocal<string>()
        let seen = ConcurrentQueue<struct (int * string)>()
        let processBatch (boat: ReadOnlyMemory<struct (int * string)>) (_ct: CancellationToken) : Task =
            for i in 0 .. boat.Length - 1 do seen.Enqueue(boat.Span.[i])
            Task.CompletedTask
        use throttler =
            new ContextualFerryThrottler<int, string>(
                FerryThrottlerConfig.deterministic,
                processBatch,
                manual = true,
                capture = (fun () -> ambient.Value))
        ambient.Value <- "at-enqueue"
        do! throttler.EnqueueCapturedAsync(1) // snapshots "at-enqueue"
        ambient.Value <- "changed-after" // mutate the ambient AFTER the door
        do! throttler.PumpToIdleAsync()
        do! throttler.CompleteAsync()
        // The boat sees the enqueue-time snapshot, not the later mutation.
        List.ofSeq seen |> should equal [ struct (1, "at-enqueue") ]
    }


[<Fact>]
let ``contextual result throttler threads context and fans aligned results back`` () : Task =
    // Result arity with explicit context: each item's context rides to the boat,
    // and the per-item Task<'TResult> still returns the aligned result.
    task {
        let processBatch (boat: ReadOnlyMemory<struct (int * string)>) (_ct: CancellationToken) : Task<string array> =
            task {
                return
                    [| for i in 0 .. boat.Length - 1 do
                           let struct (n, ctx) = boat.Span.[i]
                           sprintf "%d@%s" n ctx |]
            }
        use throttler =
            new ContextualResultFerryThrottler<int, string, string>(FerryThrottlerConfig.deterministic, processBatch)
        let t1 = throttler.ProcessAsync(1, "a")
        let t2 = throttler.ProcessAsync(2, "b")
        let! results = Task.WhenAll([| t1; t2 |])
        do! throttler.CompleteAsync()
        results |> should equal [| "1@a"; "2@b" |]
    }


// ═══════════════════════════════════════════════════════════════════
// Option-A increment 4 — background-ferry replay via an injected
// SynchronizationContext. Design:
// docs/research/2026-06-13-ferrythrottler-background-ferry-replay-injected-synchronizationcontext-increment-4.md
// ═══════════════════════════════════════════════════════════════════

// `DeterministicSyncContext` is the earned Core sim primitive (4b promoted it out
// of this test file): src/Core/DeterministicSyncContext.fs. Resolved via `open
// Zeta.Core`. A single-threaded, pumpable SynchronizationContext: Post captures
// continuations FIFO; PumpToIdle runs them in order; PostedCount proves the
// workload routed through THIS door, not the threadpool.


[<Fact>]
let ``background ferry runs under the injected SynchronizationContext — pump-gated, no threadpool`` () : Task =
    // With a context injected, the WHOLE background ferry is gated on pumping that
    // context: it does not start, and processes nothing, until the context is
    // pumped — proving its scheduling routes through the injected door, never the
    // ambient threadpool. (A true, narrow 4a claim; full N-ferry seeded-replay is 4b.)
    task {
        let processed = ConcurrentQueue<int>()
        let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task =
            for i in 0 .. boat.Length - 1 do processed.Enqueue(boat.Span.[i])
            Task.CompletedTask
        let ctx = DeterministicSyncContext()
        // DoP=1 background ferry (manual NOT set) bound to the deterministic context.
        use throttler =
            new FerryThrottler<int>(FerryThrottlerConfig.deterministic, processBatch, syncContext = ctx)

        // Enqueue synchronously (unbounded channel). The ferry was launched as a
        // posted callback in the ctor — so it is queued on the door, not running.
        for x in [ 1; 2; 3; 4; 5 ] do
            do! throttler.EnqueueAsync(x)

        // BEFORE any pump: nothing processed (race-free — the ferry cannot run
        // until its launch callback is pumped), yet the door already holds it.
        List.ofSeq processed |> should equal ([]: int list)
        ctx.PostedCount |> should be (greaterThanOrEqualTo 1)

        // Pump: the ferry starts, drains every queued item into one boat, then
        // parks at WaitToReadAsync (queue empty, writer still open).
        ctx.PumpToIdle()
        List.ofSeq processed |> should equal [ 1; 2; 3; 4; 5 ]

        // Complete the writer, then pump again so the parked ferry observes
        // completion and exits — its termination is pump-driven too.
        let completion = throttler.CompleteAsync()
        ctx.PumpToIdle()
        do! completion
        completion.IsCompletedSuccessfully |> should equal true
    }


// ─── 4b: full background-ferry SEEDED REPLAY + result/contextual arities ───

/// Run a fixed interleaved (enqueue, pump) scenario through a background throttler
/// bound to a fresh `DeterministicSyncContext` at the given DoP, returning the exact
/// sequence of boats (which items rode which boat, in order). The schedule is a pure
/// function of (enqueue sequence, pump sequence) — so two runs MUST agree.
let private replayScenario (dop: int) : Task<int list list> =
    task {
        let boats = ResizeArray<int list>()
        let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task =
            boats.Add([ for i in 0 .. boat.Length - 1 -> boat.Span.[i] ])
            Task.CompletedTask
        let ctx = DeterministicSyncContext()
        let config = { FerryThrottlerConfig.withFerries dop with MaxBatchSize = 2 }
        use throttler = new FerryThrottler<int>(config, processBatch, syncContext = ctx)
        // Interleave enqueues with pumps so multiple ferries genuinely park and
        // resume (not one ferry monopolising a single synchronous sweep).
        for wave in [ [ 1; 2; 3 ]; [ 4; 5 ]; [ 6; 7; 8; 9 ]; [ 10 ] ] do
            for x in wave do
                do! throttler.EnqueueAsync(x)
            ctx.PumpToIdle()
        let completion = throttler.CompleteAsync()
        ctx.PumpToIdle()
        do! completion
        return List.ofSeq boats
    }


[<Fact>]
let ``background ferries replay byte-identically under the deterministic context (DoP=2)`` () : Task =
    // The 4b core claim: with the deterministic context injected, the background
    // schedule is reproducible — the same inputs yield the same boats every run.
    task {
        let! run1 = replayScenario 2
        let! run2 = replayScenario 2
        // Replay determinism: identical boat composition across independent runs.
        run1 |> should equal run2
        // Correctness: every item processed exactly once, none lost or duplicated.
        run1 |> List.concat |> List.sort |> should equal [ 1 .. 10 ]
    }


[<Fact>]
let ``background ferries replay byte-identically under the deterministic context (DoP=3)`` () : Task =
    // Same claim at a higher DoP — N ferries draining one channel still replay,
    // because all continuations serialise through the single pumpable context.
    task {
        let! run1 = replayScenario 3
        let! run2 = replayScenario 3
        run1 |> should equal run2
        run1 |> List.concat |> List.sort |> should equal [ 1 .. 10 ]
    }


[<Fact>]
let ``result-arity background ferry replays under the injected context`` () : Task =
    // 4b(c): the request/response arity now takes ?syncContext, so its background
    // ferries are pump-gated too — results fan back only when the context is pumped.
    task {
        let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task<string array> =
            task { return [| for i in 0 .. boat.Length - 1 -> sprintf "r%d" boat.Span.[i] |] }
        let ctx = DeterministicSyncContext()
        use throttler =
            new FerryThrottler<int, string>(FerryThrottlerConfig.deterministic, processBatch, syncContext = ctx)
        let t1 = throttler.ProcessAsync(1)
        let t2 = throttler.ProcessAsync(2)
        let t3 = throttler.ProcessAsync(3)
        // Before pumping, no result has resolved — the ferry is gated on the context.
        t1.IsCompleted |> should equal false
        ctx.PumpToIdle()
        let! results = Task.WhenAll [| t1; t2; t3 |]
        results |> should equal [| "r1"; "r2"; "r3" |]
        let completion = throttler.CompleteAsync()
        ctx.PumpToIdle()
        do! completion
    }


[<Fact>]
let ``contextual throttler forwards syncContext so background ferries replay`` () : Task =
    // 4b(c): ContextualFerryThrottler forwards ?syncContext to the composed core
    // throttler — the threaded context value rides to the boat AND the background
    // ferry is pump-gated under the injected SynchronizationContext.
    task {
        let seen = ConcurrentQueue<struct (int * string)>()
        let processBatch (boat: ReadOnlyMemory<struct (int * string)>) (_ct: CancellationToken) : Task =
            for i in 0 .. boat.Length - 1 do seen.Enqueue(boat.Span.[i])
            Task.CompletedTask
        let ctx = DeterministicSyncContext()
        use throttler =
            new ContextualFerryThrottler<int, string>(
                FerryThrottlerConfig.deterministic, processBatch, syncContext = ctx)
        do! throttler.EnqueueAsync(1, "a")
        do! throttler.EnqueueAsync(2, "b")
        // Pump-gated: nothing seen until the injected context runs.
        List.ofSeq seen |> should equal ([]: struct (int * string) list)
        ctx.PumpToIdle()
        List.ofSeq seen |> should equal [ struct (1, "a"); struct (2, "b") ]
        let completion = throttler.CompleteAsync()
        ctx.PumpToIdle()
        do! completion
    }


// ═══════════════════════════════════════════════════════════════════
// 4c — SEEDED DST replay (FoundationDB "same seed ⇒ same interleaving").
// The 4b tests above prove a FIXED scenario replays. These strengthen that
// to the canonical DST claim: the enqueue/pump SCHEDULE is itself driven by
// a PRNG seed, so the run is a pure function of the seed — same seed ⇒
// byte-identical boats (replay), different seeds ⇒ a different schedule
// (the seed genuinely drives it, not a constant). Within-process replay is
// guaranteed regardless of Random's cross-version stability: both runs draw
// from the same seeded sequence in the same process.
// Anchors: Zhou et al. (FoundationDB SIGMOD 2021); Will Wilson (deterministic
// simulation, Strange Loop 2014).
// ═══════════════════════════════════════════════════════════════════


/// Manual (Option B, DoP=1) — the strongest determinism: no background ferry,
/// no injected context, pumped synchronously on this thread. The seed drives a
/// sequence of waves; each wave enqueues a seed-chosen count of contiguous ints
/// then pumps, so the boat composition is a pure function of the seed.
let private seededManualBoats (seed: int) : Task<int list list> =
    task {
        let boats = ResizeArray<int list>()
        let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task =
            boats.Add([ for i in 0 .. boat.Length - 1 -> boat.Span.[i] ])
            Task.CompletedTask
        let config = { FerryThrottlerConfig.deterministic with MaxBatchSize = 4 }
        use throttler = new FerryThrottler<int>(config, processBatch, manual = true)
        let rng = Random(seed)
        let mutable next = 1
        for _wave in 1 .. 8 do
            let count = rng.Next(0, 6) // 0..5 items this wave
            for _ in 1 .. count do
                do! throttler.EnqueueAsync(next)
                next <- next + 1
            do! throttler.PumpToIdleAsync() // drain whatever this wave queued, now
        do! throttler.CompleteAsync()
        return List.ofSeq boats
    }


/// Injected context (Option A, DoP=N) — background ferries gated on a single
/// pumpable `DeterministicSyncContext`; the seed drives the enqueue/pump waves.
let private seededContextBoats (seed: int) (dop: int) : Task<int list list> =
    task {
        let boats = ResizeArray<int list>()
        let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task =
            boats.Add([ for i in 0 .. boat.Length - 1 -> boat.Span.[i] ])
            Task.CompletedTask
        let ctx = DeterministicSyncContext()
        let config = { FerryThrottlerConfig.withFerries dop with MaxBatchSize = 2 }
        use throttler = new FerryThrottler<int>(config, processBatch, syncContext = ctx)
        let rng = Random(seed)
        let mutable next = 1
        for _wave in 1 .. 8 do
            let count = rng.Next(1, 5) // 1..4 items this wave
            for _ in 1 .. count do
                do! throttler.EnqueueAsync(next)
                next <- next + 1
            ctx.PumpToIdle()
        let completion = throttler.CompleteAsync()
        ctx.PumpToIdle()
        do! completion
        return List.ofSeq boats
    }


[<Fact>]
let ``manual DoP=1 seeded schedule replays byte-identically (same seed)`` () : Task =
    task {
        let! a = seededManualBoats 1234
        let! b = seededManualBoats 1234
        // Replay: the seed fully determines the boat composition.
        a |> should equal b
        // Correctness: DoP=1 is FIFO, so the flattened boats are exactly the
        // contiguous items enqueued, in order, each exactly once.
        let total = a |> List.concat |> List.length
        a |> List.concat |> should equal [ 1 .. total ]
    }


[<Fact>]
let ``manual seeded schedule differs by seed (the seed drives the interleaving)`` () : Task =
    // Proves the schedule is a function OF the seed, not a constant: two
    // different seeds produce different boat compositions (same items, though).
    task {
        let! a = seededManualBoats 1
        let! b = seededManualBoats 7
        a |> should not' (equal b)
        // Both are still internally valid (no item lost or duplicated).
        a |> List.concat |> should equal [ 1 .. (a |> List.concat |> List.length) ]
        b |> List.concat |> should equal [ 1 .. (b |> List.concat |> List.length) ]
    }


[<Fact>]
let ``injected-context background ferries replay a seeded schedule byte-identically (DoP=2)`` () : Task =
    task {
        let! a = seededContextBoats 777 2
        let! b = seededContextBoats 777 2
        // Replay: identical boats across independent runs of the same seed.
        a |> should equal b
        // Correctness: every item processed exactly once (order across N ferries
        // is not guaranteed, so compare as a sorted set).
        let total = a |> List.concat |> List.length
        a |> List.concat |> List.sort |> should equal [ 1 .. total ]
    }


[<Fact>]
let ``injected-context background ferries replay a seeded schedule byte-identically (DoP=3)`` () : Task =
    task {
        let! a = seededContextBoats 90909 3
        let! b = seededContextBoats 90909 3
        a |> should equal b
        let total = a |> List.concat |> List.length
        a |> List.concat |> List.sort |> should equal [ 1 .. total ]
    }


// ═══════════════════════════════════════════════════════════════════
// Whole-boat fault contract + FourCorner-per-row GAP
// (workitem 081M125DNKK087G0R00292E3ET).
//
// Pin CURRENT behavior so a later PerRow FourCorner change cannot land
// silently wrong. These tests MUST be rewritten when PerRow independence
// ships — wrapping each row in a fresh exception that still couples
// siblings is NOT independence.
//
// One-boat witness: DeterministicSyncContext + enqueue-all-then-pump, so
// two ProcessAsync items ride the SAME boat (MaxBatchSize >= 2).
// ═══════════════════════════════════════════════════════════════════


let private innerEx (t: Task<'a>) : exn =
    t.Exception.InnerException


/// Witness: this binding type-checks today. If result-arity `processBatch`
/// is later constrained so `'TItem` must be `FourCornerOwnership`, this
/// helper (and `ferry_boat_row_is_not_four_corner`) will not compile.
let private intResultFerry
    (processBatch: ReadOnlyMemory<int> -> CancellationToken -> Task<int array>)
    (syncContext: SynchronizationContext)
    : FerryThrottler<int, int> =
    let config = { FerryThrottlerConfig.deterministic with MaxBatchSize = 8 }
    new FerryThrottler<int, int>(config, processBatch, syncContext = syncContext)


[<Fact>]
let ``processBatch throw: every boat row observes the SAME exception (WholeBoat, not PerRow)`` () : Task =
    task {
        let boom = InvalidOperationException "whole-boat boom"
        let boats = ConcurrentQueue<int>()
        let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task<int array> =
            boats.Enqueue boat.Length
            Task.FromException<int array> boom
        let ctx = DeterministicSyncContext()
        use throttler = intResultFerry processBatch ctx
        let t0 = throttler.ProcessAsync 10
        let t1 = throttler.ProcessAsync 20
        t0.IsCompleted |> should equal false
        ctx.PumpToIdle()
        try
            let! _ = Task.WhenAll([| t0; t1 |])
            ()
        with _ -> ()
        List.ofSeq boats |> should equal [ 2 ]
        t0.IsFaulted |> should equal true
        t1.IsFaulted |> should equal true
        Object.ReferenceEquals(innerEx t0, innerEx t1) |> should equal true
        Object.ReferenceEquals(innerEx t0, boom) |> should equal true
        let completion = throttler.CompleteAsync()
        ctx.PumpToIdle()
        do! completion
    }


[<Fact>]
let ``processBatch length mismatch: whole boat faults with the SAME InvalidOperationException (WholeBoat)`` () : Task =
    task {
        let boats = ConcurrentQueue<int>()
        let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task<int array> =
            boats.Enqueue boat.Length
            Task.FromResult [||]
        let ctx = DeterministicSyncContext()
        use throttler = intResultFerry processBatch ctx
        let t0 = throttler.ProcessAsync 1
        let t1 = throttler.ProcessAsync 2
        ctx.PumpToIdle()
        try
            let! _ = Task.WhenAll([| t0; t1 |])
            ()
        with _ -> ()
        List.ofSeq boats |> should equal [ 2 ]
        t0.IsFaulted |> should equal true
        t1.IsFaulted |> should equal true
        Object.ReferenceEquals(innerEx t0, innerEx t1) |> should equal true
        (innerEx t0 :? InvalidOperationException) |> should equal true
        (innerEx t0).Message.Contains("result count mismatch", StringComparison.Ordinal)
        |> should equal true
        let completion = throttler.CompleteAsync()
        ctx.PumpToIdle()
        do! completion
    }


[<Fact>]
let ``processBatch success: each boat row gets its own index-aligned result`` () : Task =
    task {
        let boats = ConcurrentQueue<int>()
        let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task<int array> =
            boats.Enqueue boat.Length
            Task.FromResult [| for i in 0 .. boat.Length - 1 -> boat.Span.[i] * 10 |]
        let ctx = DeterministicSyncContext()
        use throttler = intResultFerry processBatch ctx
        let t0 = throttler.ProcessAsync 1
        let t1 = throttler.ProcessAsync 2
        ctx.PumpToIdle()
        let! r0 = t0
        let! r1 = t1
        List.ofSeq boats |> should equal [ 2 ]
        r0 |> should equal 10
        r1 |> should equal 20
        (r0 = r1) |> should equal false
        let completion = throttler.CompleteAsync()
        ctx.PumpToIdle()
        do! completion
    }


[<Fact>]
let ``ferry_boat_row_is_not_four_corner: a boat of plain ints still works (FourCorner is not a row requirement today)``
    ()
    : Task =
    // Gap (081M125DNKK087G0R00292E3ET): processBatch is
    // `ReadOnlyMemory<'TItem> -> CancellationToken -> Task<'TResult array>`.
    // `'TItem` is NOT required to be FourCornerOwnership — a boat of plain ints
    // compiles and fans index-aligned results. Closing the gap means this test
    // (and the type) change together; do not require FourCorner silently.
    task {
        let processBatch (boat: ReadOnlyMemory<int>) (_ct: CancellationToken) : Task<int array> =
            Task.FromResult [| for i in 0 .. boat.Length - 1 -> boat.Span.[i] |]
        let ctx = DeterministicSyncContext()
        use throttler = intResultFerry processBatch ctx
        let t0 = throttler.ProcessAsync 7
        let t1 = throttler.ProcessAsync 8
        ctx.PumpToIdle()
        let! results = Task.WhenAll([| t0; t1 |])
        results |> should equal [| 7; 8 |]
        let completion = throttler.CompleteAsync()
        ctx.PumpToIdle()
        do! completion
    }
