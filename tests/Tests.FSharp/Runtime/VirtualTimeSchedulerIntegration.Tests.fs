module Zeta.Tests.Runtime.VirtualTimeSchedulerIntegrationTests

open System
open System.Threading.Tasks
open Xunit
open Zeta.Core

[<Fact>]
let ``CooperativeVirtualEnvironment enables deterministic asynchronous task interleaving`` () =
    let env = CooperativeVirtualEnvironment(DateTimeOffset.UnixEpoch, 42L)
    let simEnv = env :> ISimulationEnvironment
    let trace = ResizeArray<string>()

    // Spawn concurrent tasks that schedule delays
    let task1 () = task {
        trace.Add "T1 start"
        do! simEnv.Delay(TimeSpan.FromMilliseconds 10.0, Threading.CancellationToken.None)
        trace.Add "T1 step 1"
        do! simEnv.Delay(TimeSpan.FromMilliseconds 20.0, Threading.CancellationToken.None)
        trace.Add "T1 end"
    }

    let task2 () = task {
        trace.Add "T2 start"
        do! simEnv.Delay(TimeSpan.FromMilliseconds 15.0, Threading.CancellationToken.None)
        trace.Add "T2 step 1"
        do! simEnv.Delay(TimeSpan.FromMilliseconds 5.0, Threading.CancellationToken.None)
        trace.Add "T2 end"
    }

    // Run tasks concurrently
    let t1 = task1()
    let t2 = task2()

    // Assert that they haven't completed because scheduler has not advanced
    Assert.False(t1.IsCompleted)
    Assert.False(t2.IsCompleted)

    // At t=0, both started
    Assert.Equal<string list>(["T1 start"; "T2 start"], Seq.toList trace)

    // Advance by 10ms -> T1 wakes up and schedules next delay at 10 + 20 = 30ms
    env.Scheduler.AdvanceBy(10L)
    Assert.Equal<string list>(["T1 start"; "T2 start"; "T1 step 1"], Seq.toList trace)
    Assert.False(t1.IsCompleted)
    Assert.False(t2.IsCompleted)

    // Advance by 5ms (total 15ms) -> T2 wakes up and schedules next delay at 15 + 5 = 20ms
    env.Scheduler.AdvanceBy(5L)
    Assert.Equal<string list>(["T1 start"; "T2 start"; "T1 step 1"; "T2 step 1"], Seq.toList trace)
    Assert.False(t1.IsCompleted)
    Assert.False(t2.IsCompleted)

    // Advance by 5ms (total 20ms) -> T2 wakes up and finishes (T2 step 2 at 20ms)
    env.Scheduler.AdvanceBy(5L)
    Assert.Equal<string list>(["T1 start"; "T2 start"; "T1 step 1"; "T2 step 1"; "T2 end"], Seq.toList trace)
    Assert.True(t2.IsCompleted)
    Assert.False(t1.IsCompleted)

    // Advance by 10ms (total 30ms) -> T1 wakes up and finishes
    env.Scheduler.AdvanceBy(10L)
    Assert.Equal<string list>(["T1 start"; "T2 start"; "T1 step 1"; "T2 step 1"; "T2 end"; "T1 end"], Seq.toList trace)
    Assert.True(t1.IsCompleted)
