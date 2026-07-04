namespace Zeta.Core.Adapters

open System
open System.Threading.Tasks
open System.Collections.Concurrent
open Zeta.Core.Abstractions

/// <summary>
/// A lightweight in-memory adapter that implements IDistributedCronRuntime.
/// In a real deployment, this would be backed by Orleans IGrain timers.
/// Here, we use System.Threading.Timer to simulate the distributed actor,
/// but time is drawn from the injected ISimulationEnvironment (the logical
/// scheduler / braided monoidal time), not the ambient wall clock.
/// </summary>
type OrleansCronAdapter(env: Zeta.Core.ISimulationEnvironment) =
    let actors = ConcurrentDictionary<string, CronState>()
    let configs = ConcurrentDictionary<string, CronConfig>()
    let callbacks = ConcurrentDictionary<string, Func<DateTime, Task<double>>>()
    let timers = ConcurrentDictionary<string, Threading.Timer>()

    let invokeCallback (id: string) =
        async {
            match callbacks.TryGetValue(id) with
            | true, cb ->
                try
                    // Four-corner closure: execute and get IV back
                    // Time is drawn from the injected ISimulationEnvironment (logical time),
                    // not the ambient wall clock, honouring the relativistic structure.
                    let! iv = cb.Invoke(env.UtcNow().UtcDateTime) |> Async.AwaitTask
                    
                    // Adaptive tick mechanism
                    match configs.TryGetValue(id) with
                    | true, config when config.AdaptiveTick ->
                        if iv <= 0.0 then
                            // Exponential backoff if no IV gained (Sybil/clone)
                            let newInterval = TimeSpan.FromTicks(config.Interval.Ticks * 2L)
                            let mutable mutConfig = config
                            mutConfig.Interval <- newInterval
                            let newConfig = mutConfig
                            configs.[id] <- newConfig
                            match timers.TryGetValue(id) with
                            | true, timer -> timer.Change(newInterval, newInterval) |> ignore
                            | _ -> ()
                        else
                            // Reset to base interval if IV is positive
                            // (In a real system, we'd store the base interval separately)
                            ()
                    | _ -> ()
                with _ -> ()
            | _ -> ()
        } |> Async.StartAsTask

    interface IDistributedCronRuntime with
        member _.RegisterTickSource(id: string, config: CronConfig) =
            configs.[id] <- config
            actors.[id] <- if config.AutoStart then CronState.Ticking else CronState.Idle
            
            if config.AutoStart then
                let timer = new Threading.Timer(
                    (fun _ -> invokeCallback id |> ignore),
                    null,
                    config.Interval,
                    config.Interval
                )
                timers.[id] <- timer

            Task.CompletedTask

        member _.GetState(id: string) =
            match actors.TryGetValue(id) with
            | true, state -> Task.FromResult(state)
            | _ -> Task.FromResult(CronState.Idle)

        member _.Suspend(id: string, _reason: string) =
            actors.[id] <- CronState.Suspended
            match timers.TryGetValue(id) with
            | true, timer -> timer.Change(Threading.Timeout.Infinite, Threading.Timeout.Infinite) |> ignore
            | _ -> ()
            Task.CompletedTask

        member _.ResumeCron(id: string) =
            actors.[id] <- CronState.Ticking
            match configs.TryGetValue(id), timers.TryGetValue(id) with
            | (true, config), (true, timer) -> 
                timer.Change(config.Interval, config.Interval) |> ignore
            | _ -> ()
            Task.CompletedTask

        member _.OnTick(id: string, callback: Func<DateTime, Task<double>>) =
            callbacks.[id] <- callback
            Task.CompletedTask
