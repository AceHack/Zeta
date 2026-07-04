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

module YinYangCellCronTests =

    [<Fact>]
    let ``CRON-3: BindYinYangCell emits a ComputeReceipt per tick`` () =
        let runtime = MockCronRuntime()
        let cron = ThousandBrainsCron(runtime)
        let codeword = AdinkraCode.allCodewords.[1]
        let cell = YinYangCell.seed codeword
        let receipts = System.Collections.Generic.List<Zeta.Core.ComputeReceipt.Receipt>()
        let reality () = { PrecisionMean = 10.0; Precision = 5.0 }
        cron.RegisterYinYangCell(cell, System.TimeSpan.FromSeconds(1.0)) |> ignore
        cron.BindYinYangCell(cell, reality, receipts.Add) |> ignore
        runtime.SimulateTick().Wait()
        Assert.Equal(1, receipts.Count)
        let r = receipts.[0]
        Assert.True(r.IV > 0.0, "First tick should yield positive IV")
        Assert.Equal(1.0, r.DeltaJ)
        Assert.True(r.Entropy >= 0.0, "Entropy should be non-negative")

    [<Fact>]
    let ``CRON-4: BindYinYangCell yin (codeword) is invariant across ticks`` () =
        let runtime = MockCronRuntime()
        let cron = ThousandBrainsCron(runtime)
        let codeword = AdinkraCode.allCodewords.[3]
        let cell = YinYangCell.seed codeword
        let receipts = System.Collections.Generic.List<Zeta.Core.ComputeReceipt.Receipt>()
        let reality () = { PrecisionMean = 5.0; Precision = 2.0 }
        cron.RegisterYinYangCell(cell, System.TimeSpan.FromSeconds(1.0)) |> ignore
        cron.BindYinYangCell(cell, reality, receipts.Add) |> ignore
        for _ in 1 .. 5 do
            runtime.SimulateTick().Wait()
        Assert.Equal(5, receipts.Count)
        Assert.True(YinYangCell.isValidSeed cell, "Cell yin (codeword) must remain a valid Adinkra codeword")
        for r in receipts do
            Assert.Equal(1.0, r.DeltaJ)

    [<Fact>]
    let ``CRON-5: fromIV builds a receipt with correct DeltaU and LandauerRatio`` () =
        let r = Zeta.Core.ComputeReceipt.fromIV 2.0 1.0 0.5
        Assert.Equal(2.0, r.IV)
        Assert.Equal(1.0, r.DeltaJ)
        Assert.Equal(1.0, r.DeltaU)
        Assert.Equal(0.0, r.Heat)
        Assert.Equal(0.5, r.Entropy)
        Assert.Equal(0.5, r.LandauerRatio)

    [<Fact>]
    let ``CRON-6: fromIV marks waste as heat when IV is near zero`` () =
        let r = Zeta.Core.ComputeReceipt.fromIV 0.0 1.0 2.0
        Assert.Equal(0.0, r.IV)
        Assert.Equal(1.0, r.DeltaJ)
        Assert.Equal(-1.0, r.DeltaU)
        Assert.Equal(1.0, r.Heat)
        Assert.True(r.LandauerRatio > 1.0, "LandauerRatio > 1 means operating above the Landauer limit (wasteful)")
