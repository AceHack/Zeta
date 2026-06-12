module Zeta.Tests.VisionTests

open System.Numerics
open System.Threading.Tasks
open global.Xunit
open Zeta.Core

let private ok value =
    match value with
    | Ok x -> x
    | Error e -> failwithf "expected Ok, got %A" e

let private ctx () : IntrCtx =
    { Memetic = "vision"
      Prompt = ""
      Trust = ""
      Log = ""
      Otel = System.Diagnostics.ActivityContext() }

let private growth label value targetBits : Vision.GrowthRequest<BigInteger> =
    { Label = label
      Value = value
      TargetBits = targetBits }

let private branch<'S>
    label
    (state: 'S)
    spaceBytes
    timeTicks
    bytesPerTick
    uncertaintyResolutionBits
    : Vision.FutureBranch<'S> =
    { Label = label
      State = state
      Cost =
        { SpaceBytes = spaceBytes
          TimeTicks = timeTicks
          BytesPerTick = bytesPerTick
          UncertaintyResolutionBits = uncertaintyResolutionBits } }

[<Fact>]
let ``cache identity integrates a delta stream`` () =
    task {
        let build =
            vision {
                let! input = Dsl.zsetInput<int>
                let! cache = Vision.cache input.Stream
                let! output = Vision.output cache
                return input, output
            }
        let c = Circuit.create ()
        let input, output = build.Invoke c

        input.Send(ZSet.ofKeys [ 1 ])
        do! c.StepAsync()
        Assert.Equal(1L, output.Current.[1])

        input.Send(ZSet.ofKeys [ 2 ])
        do! c.StepAsync()
        Assert.Equal(1L, output.Current.[1])
        Assert.Equal(1L, output.Current.[2])
    }

[<Fact>]
let ``vision identity is I after D over snapshots`` () =
    task {
        let build =
            vision {
                let! snapshots = Dsl.zsetInput<int>
                let! seen = Vision.vision snapshots.Stream
                let! output = Vision.output seen
                return snapshots, output
            }
        let c = Circuit.create ()
        let input, output = build.Invoke c
        input.Send(ZSet.ofKeys [ 1 ])
        c.Step()
        Assert.Equal(1L, output.Current.[1])

        input.Send(ZSet.ofKeys [ 1; 2 ])
        c.Step()
        Assert.Equal(1L, output.Current.[1])
        Assert.Equal(1L, output.Current.[2])
    }

[<Fact>]
let ``uncertainty growth limiter uses BitsUsed instead of a fixed float count`` () =
    let n = UniversalNumber.bigInt
    let requests =
        [ growth "self" (BigInteger.Pow(BigInteger 2, 5)) 10 // current 6, cost 4
          growth "peer" BigInteger.One 12 ] // current 1, cost 11
    let boarded, deferred, tank = Vision.boatUncertainty n requests (SoftThrottle.tank 10.0 0.0)

    Assert.Equal(1, boarded.Length)
    Assert.Equal("self", boarded.Head.Label)
    Assert.Equal(1, deferred.Length)
    Assert.Equal("peer", deferred.Head.Label)
    Assert.Equal(6.0, SoftThrottle.available tank, 12)

[<Fact>]
let ``prediction branches spend space time and uncertainty in bytes`` () =
    let branches =
        [ branch "near" 1 10L 4 5L 16 // 32
          branch "far" 2 20L 5 5L 24 ] // 48
    let report = Vision.predictBranches branches (SoftThrottle.tank 40.0 0.0) |> ok

    Assert.Equal(80L, report.RequestedBytes)
    Assert.Equal(32L, report.BoardedBytes)
    Assert.Equal(48L, report.DeferredBytes)
    Assert.Equal(Vision.PartiallyAdmitted, report.Outcome)
    Assert.True(report.Starved)
    Assert.Equal(0.4, report.Confidence, 12)
    Assert.Equal<string list>([ "near" ], report.Boarded |> List.map _.Label)

[<Fact>]
let ``vision wraps the soft scheduler with a self-prediction budget policy`` () =
    task {
        let handler =
            SoftScheduler.handlerK
                "inc"
                (function TimerElapsed _ -> true | _ -> false)
                (fun _ _ n -> Task.FromResult(Ok(n + 1)))

        let estimate _ current =
            [ branch (sprintf "self-now-%d" current) current 5L 0 0L 8
              branch (sprintf "self-far-%d" current) (current + 10) 20L 0 0L 16 ]

        let initial = Vision.budgeted 0 (SoftThrottle.tank 10.0 0.0)
        let source _ = [ TimerElapsed 17 ]
        let! result = (SoftScheduler.driveK [ Vision.wrapHandlerK estimate handler ] source).Run(ctx ()) 7L initial 1
        let final = result |> ok

        Assert.Equal(1, final.Inner)
        Assert.Equal(6L, final.PredictedBytes)
        Assert.Equal(22L, final.DeferredBytes)
        Assert.Equal(1, final.Tick)
        match final.LastPrediction with
        | Some report ->
            Assert.Equal(Vision.PartiallyAdmitted, report.Outcome)
            Assert.True(report.Starved)
            Assert.Equal<string list>([ "self-now-0" ], report.Boarded |> List.map _.Label)
        | None -> Assert.Fail "vision should record the self-prediction report"
    }
