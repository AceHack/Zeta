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
            Assert.Equal(expected.PC, final.Inner.Frame.PC)

            match final.LastPrediction with
            | None -> Assert.Fail "CHIP-8 room should record the budgeted prediction"
            | Some prediction ->
                Assert.Equal("key-down", prediction.Inference.Best.Candidate.Label)
                Assert.Equal<string list>([ "key-up" ], prediction.Budget.Boarded |> List.map _.Label)
                Assert.Equal<string list>([ "key-down" ], prediction.Budget.Deferred |> List.map _.Label)
    }

let private loopRom =
    [| 0x70uy; 0x01uy // V0 += 1
       0x12uy; 0x00uy |] // jump to start; closes after 512 transitions

let private futureInputRom =
    [| 0x60uy; 0x00uy // V0 = 0
       0xE0uy; 0x9Euy // future input boundary
       0x70uy; 0x01uy
       0x12uy; 0x02uy |]

let private crossRunCost: RoomConsultation.CostPolicy =
    { LookupBytesPerAttempt = 2L
      ComputeBytesPerUnit = 10L
      Attribution = "Chip8PredictionRoom.Tests: exact fixture projection" }

let private artifactFor (seed: uint64) (rom: byte[]) =
    let key = Chip8CrossRunStore.runKey rom seed Chip8.ProgramStart "chip8"
    match
        Chip8CrossRunStore.precompute
            { MaxSteps = 2048
              Attribution = "Chip8PredictionRoom.Tests: bound exceeds the 512-step fixture orbit" }
            1
            key
            rom
    with
    | Ok artifact -> artifact
    | Error feedback -> failwithf "expected orbit artifact, got %A" feedback

let private timerSource _ tick =
    if tick = 0 then [ TimerElapsed 17 ] else []

let private runOnce
    (initial: Chip8PredictionRoom.State)
    (handlers: SoftScheduler.HandlerK<Chip8PredictionRoom.State> list)
    =
    let room: SimFramework.RoomK<Chip8PredictionRoom.State> =
        { Name = "chip8-cross-run-consultation"
          Initial = fun _ -> initial
          HandlersK = handlers
          Source = timerSource
          Budget = 1
          Resolved = fun state -> state.Tick = 1 }

    SimFramework.runK room 1L

let private finalOf (report: SimFramework.RoomReport<Chip8PredictionRoom.State>) =
    match report.Final with
    | Ok final -> final
    | Error feedback -> failwithf "expected room success, got %A" feedback

[<Fact>]
let ``cross-run hit reuses transitions and leaves the prediction tank unchanged`` () =
    task {
        let seed = 7UL
        let tank = SoftThrottle.tank 100.0 0.0
        let initial = Chip8PredictionRoom.load seed loopRom tank
        let stored = artifactFor seed loopRom
        let configured =
            Chip8PredictionRoom.consultation (Chip8CrossRunStore.readerOf [ stored ]) crossRunCost

        let! directReport = runOnce initial (Chip8PredictionRoom.handlers 4 belief branchCost)
        let! reusedReport = runOnce initial (Chip8PredictionRoom.handlersConsulting 4 configured belief branchCost)
        let direct = finalOf directReport
        let reused = finalOf reusedReport

        Assert.Equal(
            Chip8CrossRunStore.encodeFrame direct.Inner.Frame,
            Chip8CrossRunStore.encodeFrame reused.Inner.Frame
        )
        Assert.Equal(direct.Tank, reused.Tank)
        Assert.Equal(4L, reused.Inner.ReusedUnits)
        Assert.Equal(0L, reused.Inner.ComputedUnits)
        Assert.Equal(4L, reused.Inner.LookupAttempts)

        match reused.Inner.LastConsultation with
        | None -> Assert.Fail "expected a consultation receipt"
        | Some receipt ->
            Assert.Equal(4, receipt.ReusedUnits)
            Assert.Equal(0, receipt.ComputedUnits)
            Assert.Equal(8I, receipt.ProjectedLookupBytes)
            Assert.Equal(40I, receipt.ProjectedAvoidedComputeBytes)
            Assert.Equal(32I, receipt.ProjectedNetSavedBytes)
    }

[<Fact>]
let ``cross-run miss computes the same frame and records the lookup cost`` () =
    task {
        let seed = 11UL
        let tank = SoftThrottle.tank 100.0 0.0
        let initial = Chip8PredictionRoom.load seed loopRom tank
        let configured =
            Chip8PredictionRoom.consultation Chip8CrossRunStore.emptyReader crossRunCost

        let! directReport = runOnce initial (Chip8PredictionRoom.handlers 4 belief branchCost)
        let! missedReport = runOnce initial (Chip8PredictionRoom.handlersConsulting 4 configured belief branchCost)
        let direct = finalOf directReport
        let missed = finalOf missedReport

        Assert.Equal(
            Chip8CrossRunStore.encodeFrame direct.Inner.Frame,
            Chip8CrossRunStore.encodeFrame missed.Inner.Frame
        )
        Assert.Equal(direct.Tank, missed.Tank)
        Assert.Equal(0L, missed.Inner.ReusedUnits)
        Assert.Equal(4L, missed.Inner.ComputedUnits)
        Assert.Equal(4L, missed.Inner.LookupAttempts)

        match missed.Inner.LastConsultation with
        | None -> Assert.Fail "expected a consultation receipt"
        | Some receipt ->
            Assert.Equal(8I, receipt.ProjectedLookupBytes)
            Assert.Equal(40I, receipt.ProjectedComputeBytes)
            Assert.Equal(-8I, receipt.ProjectedNetSavedBytes)
    }

[<Fact>]
let ``cross-run consultation stops before a future input boundary`` () =
    task {
        let seed = 13UL
        let initial = Chip8PredictionRoom.load seed futureInputRom (SoftThrottle.tank 100.0 0.0)
        let stored = artifactFor seed futureInputRom
        let configured =
            Chip8PredictionRoom.consultation (Chip8CrossRunStore.readerOf [ stored ]) crossRunCost

        let! report = runOnce initial (Chip8PredictionRoom.handlersConsulting 4 configured belief branchCost)
        let final = finalOf report

        Assert.Equal(0x202us, final.Inner.Frame.PC)
        Assert.True(SoftChip8.branchesOnInput final.Inner.Frame)
        match final.Inner.LastConsultation with
        | None -> Assert.Fail "expected a consultation receipt"
        | Some receipt ->
            Assert.Equal(4, receipt.RequestedUnits)
            Assert.Equal(1, receipt.ReusedUnits)
            Assert.Equal(0, receipt.ComputedUnits)
            Assert.Equal(1, receipt.LookupAttempts)
            Assert.Equal(RoomConsultation.Boundary, receipt.StopReason)
    }
