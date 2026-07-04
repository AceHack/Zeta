namespace Zeta.Core

open System
open System.Threading
open System.Threading.Tasks

/// Rx-inspired virtual-time scheduler — wall clock is replaced
/// by a manual counter you advance explicitly. Lets tests that depend
/// on timing (windowed joins, watermarks, delays) run deterministic
/// and fast because no real sleeps happen.
[<Sealed>]
type VirtualTimeScheduler() =
    let queue = System.Collections.Generic.PriorityQueue<Action, int64>()
    let mutable now = 0L
    let lockObj = obj ()

    /// Current virtual timestamp (ticks, arbitrary unit).
    member _.Now = lock lockObj (fun () -> now)

    /// Schedule `action` to run at virtual time `at`.
    member _.ScheduleAt(at: int64, action: Action) =
        lock lockObj (fun () ->
            if at < now then invalidArg (nameof at) "cannot schedule in the past"
            queue.Enqueue(action, at))

    /// Schedule an F# function wrapper to run at virtual time `at`.
    member this.ScheduleAt(at: int64, action: unit -> unit) =
        this.ScheduleAt(at, Action(action))

    /// Schedule `action` to run after `delay` ticks.
    member this.ScheduleAfter(delay: int64, action: Action) =
        lock lockObj (fun () -> this.ScheduleAt(now + delay, action))

    /// Schedule an F# function wrapper after `delay` ticks.
    member this.ScheduleAfter(delay: int64, action: unit -> unit) =
        this.ScheduleAfter(delay, Action(action))

    /// Advance virtual time by `ticks`, firing every scheduled action
    /// whose timestamp ≤ the new `now`.
    member _.AdvanceBy(ticks: int64) =
        let target = lock lockObj (fun () -> now + ticks)
        let mutable run = true
        while run do
            let toRun =
                lock lockObj (fun () ->
                    if queue.Count = 0 then None
                    else
                        let mutable nextAt = 0L
                        let mutable nextAction = Unchecked.defaultof<Action>
                        if queue.TryPeek(&nextAction, &nextAt) && nextAt <= target then
                            let action = queue.Dequeue()
                            now <- nextAt
                            Some action
                        else
                            None)
            match toRun with
            | Some action -> action.Invoke()
            | None -> run <- false
        lock lockObj (fun () -> now <- target)

    /// Drain every remaining action regardless of timestamp.
    member this.AdvanceToEnd() =
        let mutable hasMore = true
        while hasMore do
            let nextTicks =
                lock lockObj (fun () ->
                    if queue.Count > 0 then
                        let mutable nextAt = 0L
                        let mutable nextAction = Unchecked.defaultof<Action>
                        queue.TryPeek(&nextAction, &nextAt) |> ignore
                        Some(nextAt - now)
                    else
                        None)
            match nextTicks with
            | Some ticks ->
                this.AdvanceBy(ticks)
            | None ->
                hasMore <- false

    member _.PendingCount = lock lockObj (fun () -> queue.Count)


/// A cooperative simulation environment where `Delay` scheduling is driven by a `VirtualTimeScheduler`.
/// This implements `ISimulationEnvironment`, replacing asynchronous delay with deterministic scheduling queueing.
[<Sealed>]
type CooperativeVirtualEnvironment(initialTime: DateTimeOffset, seed: int64) =
    let mutable rngState = seed
    let mutable guidCounter = 0UL
    let scheduler = VirtualTimeScheduler()
    let lockObj = obj ()

    member _.Scheduler = scheduler

    interface ISimulationEnvironment with
        member _.UtcNow() =
            // Unify datetime offset with the virtual ticks (1 tick = 1 millisecond).
            initialTime.AddMilliseconds(float scheduler.Now)

        member _.Ticks() = scheduler.Now

        member _.NextInt64() =
            // splitmix64 RNG
            lock lockObj (fun () ->
                rngState <- rngState + 0x9E3779B97F4A7C15L
                let mutable z = rngState
                z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9L
                z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBL
                z ^^^ (z >>> 31))

        member _.NewGuid() =
            lock lockObj (fun () ->
                guidCounter <- guidCounter + 1UL
                let bytes = Array.zeroCreate<byte> 16
                BitConverter.TryWriteBytes(Span<byte>(bytes, 0, 8), guidCounter) |> ignore
                BitConverter.TryWriteBytes(Span<byte>(bytes, 8, 8), seed) |> ignore
                Guid bytes)

        member _.Delay(timeout, _ct) =
            let tcs = TaskCompletionSource<unit>()
            let at = scheduler.Now + int64 timeout.TotalMilliseconds
            scheduler.ScheduleAt(at, Action(fun () -> tcs.TrySetResult(()) |> ignore))
            tcs.Task
