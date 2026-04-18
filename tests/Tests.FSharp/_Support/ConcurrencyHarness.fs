module Zeta.Tests.Support.ConcurrencyHarness

open System
open System.Diagnostics
open System.Threading
open System.Threading.Tasks


/// Stress-test harness for concurrent code. Each helper here spawns
/// many threads, synchronises their start via a `TaskCompletionSource`
/// gate, hammers shared state, and then checks invariants.
///
/// ## How this catches missing `Interlocked.CompareExchange`
///
/// A plain `state <- state + 1` on a multi-threaded path produces
/// **lost updates** (two threads read the same value, both write
/// `read + 1`, one update is gone). If the harness runs N threads
/// each calling the operation M times and the resulting counter is
/// less than N × M, we caught the bug. Specifically:
///   - `Circuit.tick` — if N tick callers race and we just do
///     `tick <- tick + 1L`, final tick < N · M.
///   - `FeedbackOp.Connect` — two threads both see `connected = 0`,
///     both write `source`, exactly-one-caller invariant broken.
///   - `HasAsyncOps` iterating `ops` unguarded — invalid-index reads
///     surface as exceptions.
///
/// ## Why we don't just rely on TLA+
///
/// TLA+ proves the invariant at the *model* level; this harness
/// exercises the **real compiled code** under the real CLR memory
/// model. When the two agree, you're covered at both levels — if
/// they disagree, the harness flags the regression at CI time.
///
/// See also `VirtualTimeScheduler` for deterministic async tests
/// inspired by Rx's `TestScheduler` — that harness replaces wall-
/// clock with a manual clock you step, so a "5-second delay + async
/// publish" becomes a single `scheduler.AdvanceBy(5_000)` call.


/// Run `action` on `threadCount` threads, each invoking `iterations`
/// times, with a barrier that releases all threads simultaneously.
/// Returns the total elapsed milliseconds.
let stressParallel (threadCount: int) (iterations: int) (action: int -> unit) : int64 =
    let gate = TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously)
    let sw = Stopwatch.StartNew()
    let threads =
        [| for tid in 0 .. threadCount - 1 ->
            Thread(fun () ->
                // Wait for all peers to be ready before firing.
                gate.Task.Wait()
                for iter in 0 .. iterations - 1 do
                    action (tid * iterations + iter)) |]
    for t in threads do t.Start()
    // Give threads a moment to block on the gate.
    Thread.Sleep 10
    gate.SetResult ()
    for t in threads do t.Join()
    sw.ElapsedMilliseconds


/// Like `stressParallel` but lets the action return a value; the
/// values are collected thread-local and concatenated. Useful for
/// "did any thread see an invalid state?" assertions.
let stressParallelWithResults<'R> (threadCount: int) (iterations: int) (action: int -> 'R) : 'R array =
    let gate = TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously)
    let results = Array.zeroCreate<'R> (threadCount * iterations)
    let threads =
        [| for tid in 0 .. threadCount - 1 ->
            Thread(fun () ->
                gate.Task.Wait()
                for iter in 0 .. iterations - 1 do
                    let idx = tid * iterations + iter
                    results.[idx] <- action idx) |]
    for t in threads do t.Start()
    Thread.Sleep 10
    gate.SetResult ()
    for t in threads do t.Join()
    results


/// Repeat `attempt` until it observes **any** inconsistency or the
/// budget is exhausted. Returns `Some inconsistency` if detected,
/// `None` if the code survived all iterations. Use for non-
/// deterministic bugs where failure is statistical.
let fuzz (budget: TimeSpan) (attempt: unit -> bool) : bool =
    let sw = Stopwatch.StartNew()
    let mutable found = false
    while not found && sw.Elapsed < budget do
        if attempt () then found <- true
    found


/// Rx-inspired **virtual-time scheduler** — wall clock is replaced
/// by a manual counter you advance explicitly. Lets tests that depend
/// on timing (windowed joins, watermarks, delays) run **deterministic
/// and fast** because no real sleeps happen.
///
/// The Rx `TestScheduler` is the inspiration; Bart De Smet's
/// "Marble diagrams" turn these into diagrammatic assertions. This
/// is the minimum-viable subset: schedule an action at virtual
/// timestamp `t`; advance to `t'`; fire every action in between.
[<Sealed>]
type VirtualTimeScheduler() =
    let queue = System.Collections.Generic.PriorityQueue<Action, int64>()
    let mutable now = 0L

    /// Current virtual timestamp (ticks, arbitrary unit).
    member _.Now = now

    /// Schedule `action` to run at virtual time `at`.
    member _.ScheduleAt(at: int64, action: Action) =
        if at < now then invalidArg (nameof at) "cannot schedule in the past"
        queue.Enqueue(action, at)

    /// Schedule `action` to run after `delay` ticks.
    member this.ScheduleAfter(delay: int64, action: Action) =
        this.ScheduleAt(now + delay, action)

    /// Advance virtual time by `ticks`, firing every scheduled action
    /// whose timestamp ≤ the new `now`.
    member _.AdvanceBy(ticks: int64) =
        let target = now + ticks
        let mutable run = true
        while run do
            if queue.Count = 0 then run <- false
            else
                let mutable nextAt = 0L
                let mutable nextAction = Unchecked.defaultof<Action>
                if queue.TryPeek(&nextAction, &nextAt) && nextAt <= target then
                    let action = queue.Dequeue()
                    now <- nextAt
                    action.Invoke ()
                else run <- false
        now <- target

    /// Drain every remaining action regardless of timestamp.
    member this.AdvanceToEnd() =
        while queue.Count > 0 do
            let mutable nextAt = 0L
            let mutable nextAction = Unchecked.defaultof<Action>
            queue.TryPeek(&nextAction, &nextAt) |> ignore
            this.AdvanceBy(nextAt - now)

    member _.PendingCount = queue.Count
