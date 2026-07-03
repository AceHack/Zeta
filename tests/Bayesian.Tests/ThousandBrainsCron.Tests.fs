namespace Zeta.Bayesian.Tests

open System
open System.Threading.Tasks
open Xunit
open FsUnit.Xunit
open Zeta.Core
open Zeta.Core.Abstractions
open Zeta.Bayesian


type MockCronRuntime() =
    let mutable ticks = 0
    let mutable lastIv = 0.0
    let mutable callback : Func<DateTime, Task<double>> = null

    member this.Ticks = ticks
    member this.LastIv = lastIv
    
    member this.SimulateTick() =
        async {
            if not (isNull callback) then
                let! iv = callback.Invoke(DateTime.UtcNow) |> Async.AwaitTask
                lastIv <- iv
                ticks <- ticks + 1
        } |> Async.StartAsTask

    interface IDistributedCronRuntime with
        member _.RegisterTickSource(id, config) = Task.CompletedTask
        member _.GetState(id) = Task.FromResult(CronState.Idle)
        member _.Suspend(id, reason) = Task.CompletedTask
        member _.ResumeCron(id) = Task.CompletedTask
        member _.OnTick(id, cb) = 
            callback <- cb
            Task.CompletedTask

module ThousandBrainsCronTests =

    [<Fact>]
    let ``TBC-1: Column tick observes reality and returns IV`` () =
        let runtime = MockCronRuntime()
        let cron = ThousandBrainsCron(runtime)
        
        let column = ThousandBrains.createColumn "col-1"
        
        // A continuous environment that always returns the same precise reading
        let reality () = { PrecisionMean = 10.0; Precision = 5.0 }
        
        cron.BindColumn(column, reality) |> ignore
        
        // First tick: column learns something new, should get positive IV
        runtime.SimulateTick().Wait()
        Assert.Equal(1, runtime.Ticks)
        Assert.True(runtime.LastIv > 0.0, "First observation should yield positive IV")
        
        let firstIv = runtime.LastIv
        
        // Second tick: same observation, should yield much less IV (diminishing returns)
        // In our Gaussian setup without forgetting, the exact same observation adds precision
        // but no mean shift. The IV should be strictly less than the initial shock.
        runtime.SimulateTick().Wait()
        Assert.Equal(2, runtime.Ticks)
        Assert.True(runtime.LastIv < firstIv, $"Repeated observation IV ({runtime.LastIv}) should be less than first IV ({firstIv})")
