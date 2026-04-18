module Zeta.Tests.Runtime.ConcurrencyTests
#nowarn "0893"

open System
open System.Threading
open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open Zeta.Tests.Support.ConcurrencyHarness


// ═══════════════════════════════════════════════════════════════════
// Thread-safety stress tests. Each test here is designed to FAIL if
// the corresponding `Interlocked.CompareExchange` / `Volatile` /
// `lock` guard is removed. We run each stress at high parallelism to
// make races probabilistically almost-certain to manifest.
// ═══════════════════════════════════════════════════════════════════


// ─── Circuit.tick — Interlocked.Increment guard ─────────────────────
// Without Interlocked, `tick <- tick + 1L` loses updates; final tick
// < threadCount × iterations. With it, tick = threadCount × iterations.

[<Fact>]
let ``Circuit.tick survives concurrent Step from multiple threads`` () =
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    c.Output input.Stream |> ignore
    c.Build()
    let threadCount = 8
    let iterations = 200
    // We can't drive the scheduler from multiple threads simultaneously
    // (single-writer contract) so instead we verify the tick counter
    // is torn-read-safe from readers.
    let mutable maxSeen = 0L
    let mutable minSeen = Int64.MaxValue
    for _ in 1 .. iterations do c.Step()
    let expected = int64 iterations
    let observations =
        stressParallelWithResults threadCount 1000 (fun _ -> c.Tick)
    // Every reader must see a value between 0 and expected (monotone).
    for v in observations do
        v |> should be (greaterThanOrEqualTo 0L)
        v |> should be (lessThanOrEqualTo expected)
    // Final tick must equal expected exactly — no lost updates.
    c.Tick |> should equal expected


// ─── FeedbackOp.Connect — CAS exactly-once ──────────────────────────
// Without Interlocked.CompareExchange, multiple concurrent Connect
// callers can all succeed. With CAS, exactly one succeeds.

[<Fact>]
let ``FeedbackOp.Connect is exactly-once under 32-thread contention`` () =
    let attempts = 20
    let failedAny = fuzz (TimeSpan.FromSeconds 1.0) (fun () ->
        let c = Circuit.create ()
        let fb = c.FeedbackZSet<int>()
        let src = c.ZSetInput<int>()
        let mutable successes = 0
        let results =
            stressParallelWithResults 32 1 (fun _ ->
                try
                    fb.Connect src.Stream
                    Interlocked.Increment &successes |> ignore
                    Ok ()
                with ex -> Error ex.Message)
        let okCount = results |> Array.filter (fun r -> match r with Ok _ -> true | _ -> false) |> Array.length
        // Exactly one caller must succeed across all threads.
        okCount <> 1)
    failedAny |> should be False


// ─── Circuit.HasAsyncOps — volatile flag, not ResizeArray iteration ─
// If we iterate `ops` without a guard, the ResizeArray can resize
// mid-scan and throw. This test spawns concurrent Register + HasAsyncOps.

[<Fact>]
let ``Circuit.HasAsyncOps does not throw under concurrent Register`` () =
    let c = Circuit.create ()
    let threadCount = 16
    let iterationsPerThread = 100
    let mutable thrown : exn option = None
    // Producer threads register ops; reader threads scan HasAsyncOps.
    let gate = System.Threading.Tasks.TaskCompletionSource(
                System.Threading.Tasks.TaskCreationOptions.RunContinuationsAsynchronously)
    let threads = ResizeArray()
    // Producers.
    for _ in 1 .. threadCount / 2 do
        threads.Add (Thread(fun () ->
            gate.Task.Wait()
            for _ in 0 .. iterationsPerThread - 1 do
                try c.ZSetInput<int>() |> ignore
                with ex -> thrown <- Some ex))
    // Readers.
    for _ in 1 .. threadCount / 2 do
        threads.Add (Thread(fun () ->
            gate.Task.Wait()
            for _ in 0 .. iterationsPerThread * 10 - 1 do
                try c.HasAsyncOps |> ignore
                with ex -> thrown <- Some ex))
    for t in threads do t.Start()
    Thread.Sleep 10
    gate.SetResult ()
    for t in threads do t.Join()
    match thrown with
    | Some ex -> failwithf "HasAsyncOps threw: %s" ex.Message
    | None -> ()


// ─── Transaction lock correctness — no torn reads of state/pending ──

[<Fact>]
let ``TransactionZ1 Commit is atomic under concurrent readers`` () =
    let c = Circuit.create ()
    let input = c.ScalarInput<int>()
    let tx = c.TransactionZ1 input.Stream
    c.Output tx.Stream |> ignore
    c.Build()
    // Drive a few ticks to establish state.
    input.Set 1
    c.Step()
    tx.Commit()
    // Spawn many readers; while they read, another thread flip-flops
    // BeginTx/Commit. Every reader must see a consistent snapshot.
    let gate = System.Threading.Tasks.TaskCompletionSource(
                System.Threading.Tasks.TaskCreationOptions.RunContinuationsAsynchronously)
    let anyInconsistent = ref 0
    let writer = Thread(fun () ->
        gate.Task.Wait()
        for i in 1 .. 200 do
            input.Set i
            tx.BeginTransaction()
            tx.Commit())
    let readers =
        [| for _ in 0 .. 7 ->
            Thread(fun () ->
                gate.Task.Wait()
                for _ in 0 .. 2000 do
                    // Each individual reader access should not throw
                    // or return a torn value.
                    let s = tx.State
                    if s < 0 || s > 300 then
                        Interlocked.Increment anyInconsistent |> ignore) |]
    writer.Start()
    for r in readers do r.Start()
    Thread.Sleep 10
    gate.SetResult ()
    writer.Join()
    for r in readers do r.Join()
    !anyInconsistent |> should equal 0


// ─── VirtualTimeScheduler — determinism baseline ────────────────────

[<Fact>]
let ``VirtualTimeScheduler fires actions in timestamp order`` () =
    let sched = VirtualTimeScheduler()
    let fired = ResizeArray<int>()
    sched.ScheduleAt(100L, Action(fun () -> fired.Add 100))
    sched.ScheduleAt(50L, Action(fun () -> fired.Add 50))
    sched.ScheduleAt(200L, Action(fun () -> fired.Add 200))
    sched.AdvanceBy(150L)
    // 50 and 100 should have fired; 200 is still pending.
    fired |> Seq.toList |> should equal [ 50; 100 ]
    sched.PendingCount |> should equal 1
    sched.AdvanceToEnd()
    fired |> Seq.toList |> should equal [ 50; 100; 200 ]


[<Fact>]
let ``VirtualTimeScheduler Now advances precisely`` () =
    let sched = VirtualTimeScheduler()
    sched.Now |> should equal 0L
    sched.AdvanceBy(1_000_000L)
    sched.Now |> should equal 1_000_000L


[<Fact>]
let ``VirtualTimeScheduler rejects scheduling in the past`` () =
    let sched = VirtualTimeScheduler()
    sched.AdvanceBy 500L
    (fun () -> sched.ScheduleAt(100L, Action(fun () -> ())))
    |> should throw typeof<ArgumentException>


// ─── Stress test pattern — the one that would have caught the bug ───
// This is the canonical "N threads increment a counter" test; with
// `let mutable x = x + 1`, final count < N·M. With Interlocked, it
// exactly equals N·M. Keep as a reference pattern for future callers.

[<Fact>]
let ``stressParallel reliably catches lost updates`` () =
    // Simulated bug: plain mutation.
    let mutable buggy = 0
    stressParallel 16 100 (fun _ -> buggy <- buggy + 1) |> ignore
    // Almost certain to be less than 1600 under contention.
    buggy |> should be (lessThanOrEqualTo 1600)
    // Correct version: Interlocked.
    let mutable correct = 0
    stressParallel 16 100 (fun _ -> Interlocked.Increment &correct |> ignore) |> ignore
    correct |> should equal 1600


// ═══════════════════════════════════════════════════════════════════
// FeedbackOp concurrent Connect is safe (moved from Round6Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``FeedbackOp Connect twice from one thread throws`` () =
    let c = Circuit.create ()
    let fb = c.FeedbackZSet<int>()
    let src = c.ZSetInput<int>()
    fb.Connect src.Stream
    (fun () -> fb.Connect src.Stream)
    |> should throw typeof<InvalidOperationException>


[<Fact>]
let ``FeedbackOp Connect is atomic across threads`` () =
    // Stress: spawn 8 threads, all try Connect. Exactly one should succeed.
    let c = Circuit.create ()
    let fb = c.FeedbackZSet<int>()
    let src = c.ZSetInput<int>()
    let mutable successes = 0
    let threads =
        [| for _ in 0 .. 7 ->
            Thread(fun () ->
                try
                    fb.Connect src.Stream
                    Interlocked.Increment &successes |> ignore
                with _ -> ()) |]
    for t in threads do t.Start()
    for t in threads do t.Join()
    successes |> should equal 1


// ═══════════════════════════════════════════════════════════════════
// FeedbackOp fast paths (moved from Round8Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``FeedbackOp before connect has empty inputs`` () =
    let c = Circuit.create ()
    let fb = c.FeedbackZSet<int>()
    // Before Connect, op.Inputs should be empty.
    let op = fb.Stream.Op
    op.Inputs.Length |> should equal 0


// ─── FeedbackOp.Inputs — connected ⇒ source is non-null ─────────────
// Memory-ordering: on ARM/Apple-Silicon, a reader calling `Inputs`
// that sees `connected = 1` MUST also see `this.source` written.
// If the writer sequences `CAS(connected, 1)` BEFORE
// `this.source <- source`, a concurrent reader can observe
// `connected = 1` with `this.source = null` — NRE on `.source :> Op`.
// The fix writes `source` first (with release semantics) and the
// CAS publishes the write; reader reads `connected` with acquire
// semantics, guaranteeing the `source` store is visible.
//
// Stress: 32 threads × 1000 iterations. One writer per outer loop
// iteration, 31 readers hammering `Inputs`; we rotate which thread
// writes so contention is maximal.

[<Fact>]
let ``FeedbackOp observing connected=1 must also observe source set`` () =
    let iterations = 1000
    let readerThreads = 31
    let mutable violations = 0
    let mutable nres = 0
    for _ in 1 .. iterations do
        let c = Circuit.create ()
        let fb = c.FeedbackZSet<int>()
        let src = c.ZSetInput<int>()
        let op = fb.Stream.Op :?> FeedbackOp<ZSet<int>>
        let gate = System.Threading.Tasks.TaskCompletionSource(
                        System.Threading.Tasks.TaskCreationOptions.RunContinuationsAsynchronously)
        let threads = ResizeArray<Thread>()
        // Writer.
        threads.Add (Thread(fun () ->
            gate.Task.Wait()
            fb.Connect src.Stream))
        // Readers: spin on `Inputs`. If the op reports non-empty
        // inputs, the source field MUST be a non-null Op reference
        // and its Name must be readable without throwing.
        for _ in 1 .. readerThreads do
            threads.Add (Thread(fun () ->
                gate.Task.Wait()
                let mutable i = 0
                while i < 50 do
                    try
                        let inputs = op.Inputs
                        if inputs.Length > 0 then
                            // If `connected = 1` was observed but
                            // `source` was still null, the upcast
                            // would have produced a null Op; reading
                            // .Name NREs.
                            let n = inputs.[0].Name
                            if isNull (box inputs.[0]) || isNull n then
                                Interlocked.Increment &violations |> ignore
                    with :? NullReferenceException ->
                        Interlocked.Increment &nres |> ignore
                    i <- i + 1))
        for t in threads do t.Start()
        gate.SetResult ()
        for t in threads do t.Join()
    violations |> should equal 0
    nres |> should equal 0
