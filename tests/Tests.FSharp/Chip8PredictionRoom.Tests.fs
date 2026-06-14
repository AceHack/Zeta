module Zeta.Tests.Chip8PredictionRoomTests

open global.Xunit
open Zeta.Core

module PI = PredictionInference
module PS = ProbabilitySemiring

let private r n d = PS.rat n d

/// V0=0, then EX9E (skip-if-key-V0). After one step the frame is parked at
/// the input fork so the next timer tick has something real to predict.
let private inputForkFrame () =
    Chip8Cow.create 1UL
    |> Chip8Cow.loadRom [| 0x60uy; 0x00uy; 0xE0uy; 0x9Euy; 0x12uy; 0x00uy |]
    |> Chip8Cow.step

let private branchCost (_: Chip8Cow.Frame) : Vision.BranchCost =
    { SpaceBytes = 10L
      TimeTicks = 1
      BytesPerTick = 0L
      UncertaintyResolutionBits = 1 }

let private belief _ frame =
    if SoftChip8.branchesOnInput frame then
        [| r 2L 3L; r 1L 3L |]
    else
        [| PS.one |]

[<Fact>]
let ``CHIP8 prediction room runs under SimFramework and records budgeted self sight`` () =
    task {
        let atFork = inputForkFrame ()

        let priority (scored: PI.Scored<Chip8Cow.Frame>) =
            if scored.Candidate.Label = "key-up" then
                { PI.neutralPriority with Attention = r 3L 1L }
            else
                PI.neutralPriority

        let source _ tick =
            if tick = 0 then
                [ OperatorMessageArrived(SoftChip8Flux.encodeKey 0 true)
                  TimerElapsed 17 ]
            else
                []

        let room: SimFramework.RoomK<Chip8PredictionRoom.State> =
            { Name = "chip8-prediction-room"
              Initial = fun _ -> Chip8PredictionRoom.state atFork (SoftThrottle.tank 11.0 0.0)
              HandlersK = Chip8PredictionRoom.handlersWithPriority 1 belief branchCost priority
              Source = source
              Budget = 1
              Resolved = fun state -> state.LastPrediction.IsSome }

        let! report = SimFramework.runK room 1L

        Assert.True(report.SignedOff)
        match report.Final with
        | Error feedback -> Assert.Fail(sprintf "expected Ok, got %A" feedback)
        | Ok final ->
            Assert.Equal(1, final.Tick)
            Assert.Equal(11L, final.PredictedBytes)
            Assert.Equal(11L, final.DeferredBytes)

            let expected = Chip8Cow.step (SoftChip8Flux.applyKey 0 true atFork)
            Assert.Equal(expected.PC, final.Inner.PC)

            match final.LastPrediction with
            | None -> Assert.Fail "CHIP-8 room should record the budgeted prediction"
            | Some prediction ->
                Assert.Equal("key-down", prediction.Inference.Best.Candidate.Label)
                Assert.Equal<string list>([ "key-up" ], prediction.Budget.Boarded |> List.map _.Label)
                Assert.Equal<string list>([ "key-down" ], prediction.Budget.Deferred |> List.map _.Label)
    }
