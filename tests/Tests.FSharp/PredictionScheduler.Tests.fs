module Zeta.Tests.PredictionSchedulerTests

open System.Diagnostics
open System.Threading.Tasks
open global.Xunit
open Zeta.Core

module PI = PredictionInference
module PS = ProbabilitySemiring

let private ctx () : IntrCtx =
    { Memetic = "prediction-scheduler"
      Prompt = ""
      Trust = ""
      Log = ""
      Otel = ActivityContext() }

let private r n d = PS.rat n d

let private cost bytes : Vision.BranchCost =
    { SpaceBytes = bytes
      TimeTicks = 0
      BytesPerTick = 0L
      UncertaintyResolutionBits = 0 }

let private candidate label state prior bytes : PI.Candidate<string> =
    { Label = label
      State = state
      Prior = prior
      Likelihood = PS.one
      Cost = cost bytes }

let private timer =
    function
    | TimerElapsed _ -> true
    | _ -> false

[<Fact>]
let ``prediction scheduler wraps a soft handler with budgeted self sight`` () =
    task {
        let estimate _ current =
            Ok
                [ candidate "likely" (sprintf "likely-%d" current) (r 3L 4L) 6L
                  candidate "attended" (sprintf "attended-%d" current) (r 1L 4L) 6L ]

        let priority (scored: PI.Scored<string>) =
            if scored.Candidate.Label = "attended" then
                { PI.neutralPriority with Attention = r 10L 1L }
            else
                PI.neutralPriority

        let inc =
            SoftScheduler.handlerK
                "inc"
                timer
                (fun _ _ current -> Task.FromResult(Ok(current + 1)))

        let initial: PredictionScheduler.Planned<int, string> =
            PredictionScheduler.planned 0 (SoftThrottle.tank 6.0 0.0)

        let source _ = [ TimerElapsed 17 ]

        let! result =
            (SoftScheduler.driveK [ PredictionScheduler.wrapHandlerKWithPriority estimate priority inc ] source)
                .Run(ctx ()) 7L initial 1

        match result with
        | Error feedback -> Assert.Fail(sprintf "expected Ok, got %A" feedback)
        | Ok final ->
            Assert.Equal(1, final.Inner)
            Assert.Equal(1, final.Tick)
            Assert.Equal(6L, final.PredictedBytes)
            Assert.Equal(6L, final.DeferredBytes)

            match final.LastPrediction with
            | None -> Assert.Fail "prediction scheduler should record a prediction"
            | Some prediction ->
                Assert.Equal("likely", prediction.Inference.Best.Candidate.Label)
                Assert.Equal<string list>([ "attended" ], prediction.Budget.Boarded |> List.map _.Label)
                Assert.Equal<string list>([ "likely" ], prediction.Budget.Deferred |> List.map _.Label)
    }

[<Fact>]
let ``prediction scheduler surfaces inference feedback through the scheduler channel`` () =
    task {
        let estimate _ _ = Ok [ candidate "bad" "state" (r -1L 1L) 1L ]
        let initial: PredictionScheduler.Planned<int, string> =
            PredictionScheduler.planned 0 (SoftThrottle.tank 1.0 0.0)

        let source _ = [ TimerElapsed 17 ]
        let handler = PredictionScheduler.policyHandler "predict" estimate
        let! result = (SoftScheduler.driveK [ handler ] source).Run(ctx ()) 7L initial 1

        match result with
        | Error(Failed message) -> Assert.Contains("negative prior", message)
        | other -> Assert.Fail(sprintf "expected Failed feedback, got %A" other)
    }
