module Zeta.Tests.DarkHallRoomTranscriptTests

open System.Diagnostics
open global.Xunit
open Zeta.Core

module Runtime = DarkHallCabinetRuntime
module RoomLoop = DarkHallRoomLoop
module Scheduler = DarkHallScheduler
module Transcript = DarkHallRoomTranscript

let private setRegRom =
    [| 0x6Auy; 0x0Cuy; 0x12uy; 0x02uy |]

let private inputAfterOne =
    [| 0x60uy; 0x00uy; 0xE0uy; 0x9Euy; 0x60uy; 0x01uy |]

let private chooseById id (readout: Runtime.ControllerReadout) : RoomLoop.ControllerChoice =
    let cell =
        GridBinding.bound readout.Grid
        |> List.tryFind (fun (_, action) -> action.Id = id)
        |> Option.map fst
        |> Option.defaultValue -1

    { Cell = cell
      Tier = RoomLoop.ChoiceTier.Operator
      Confidence = 1.0
      Reason = "test-selected action id" }

let private wait (task: System.Threading.Tasks.Task<'T>) : 'T =
    task.GetAwaiter().GetResult()

let private mustOk =
    function
    | Ok value -> value
    | Error feedback -> failwithf "expected Ok, got %A" feedback

let private rejectSlots slots : ModuloGSetConfig =
    ModuloGSetConfig.rejectCollision slots

let private countPpm count =
    count
    |> max 0
    |> min 16
    |> fun value -> value * (TemperatureReadout.MaxPpm / 16)

let private emptyBoundary source room budget =
    ModuloGSet.empty<string> (rejectSlots 4)
    |> mustOk
    |> RoomBoundary.create source room budget

let private sampleVault () =
    let v =
        DoorGraph.empty
        |> DoorGraph.addRoom "darkhall"
        |> DoorGraph.addRoom "glass"

    DoorGraph.addDoor (DoorGraph.door "darkhall" "glass" "door-key") v |> mustOk

let private ctx () : IntrCtx =
    { Memetic = "room-transcript"
      Prompt = ""
      Trust = ""
      Log = ""
      Otel = ActivityContext() }

let private timer =
    function
    | TimerElapsed _ -> true
    | _ -> false

let private boundaryState boundary =
    Scheduler.initialWithBoundary Arcade.room Chip9Capabilities.chip8Default boundary

let private boundaryPlan sourceName boundaryFor choose : RoomRun.BoundaryTickPlan<string> =
    { HandlerName = "room-transcript-boundary"
      Matches = timer
      SourceName = sourceName
      RequestFor = fun _ -> None
      BoundaryFor = boundaryFor
      Choose = choose
      Interrupts = fun _ -> [ TimerElapsed 17 ]
      Context = ctx ()
      Seed = 42L }

let private softPlan sourceName rom width : RoomRun.SoftDrivePlan =
    { SourceName = sourceName
      Value = SoftDashboard.sumMemory
      CyclesPerFrame = 1
      Depth = 1
      Width = width
      Frames = 1
      Start = Chip8Cow.create 1UL |> Chip8Cow.loadRom rom }

let private hasTraveler traveler phase (frame: Transcript.TranscriptTravelerFrame) =
    frame.Coordinates
    |> List.exists (fun coord -> coord.Traveler = traveler && coord.Phase = phase)

[<Fact>]
let ``room transcript exports the source-owned contract consumed by the css UI`` () =
    let requestFor (action: Runtime.CabinetAction) =
        if action.Id = "darkhall.play.soft-chip8" then
            Some(Runtime.RunSoftChip8(1UL, setRegRom, 5))
        else
            None

    let run =
        RoomLoop.run
            "darkhall-room-transcript"
            (NullHeatSink() :> IHeatSink)
            requestFor
            (chooseById "darkhall.play.soft-chip8")
            1
            (RoomLoop.initial Arcade.room Chip9Capabilities.chip8Default)
        |> wait

    let transcript = Transcript.ofRunOutcome "0x1" "fsharp-room-loop" run

    Assert.Equal(Transcript.Schema, transcript.Schema)
    Assert.Equal("darkhall", transcript.RoomName)
    Assert.Equal(16, transcript.Controller.Length)
    Assert.Contains(transcript.Controller, fun cell -> cell.Selected && cell.ActionId = "darkhall.play.soft-chip8")
    Assert.Single(transcript.Ticks) |> ignore
    Assert.Single(transcript.HeatRows) |> ignore
    Assert.Equal(HeatReadout.Schema, Transcript.HeatReadoutSchema)
    Assert.Equal(HeatReadout.SignalTreaty, Transcript.HeatSignalTreaty)
    Assert.Equal(HeatReadout.QSharpSignalSource, Transcript.QSharpHeatSignalSource)
    Assert.Equal(HeatReadout.TemperatureSchema, Transcript.TemperatureReadoutSchema)
    Assert.Equal(HeatReadout.BlackBodySchema, Transcript.BlackBodyReadoutSchema)
    Assert.Equal(Transcript.HeatReadoutSchema, transcript.HeatReadout.Schema)
    Assert.Equal(Transcript.HeatSignalTreaty, transcript.HeatReadout.QSharpTreaty)
    Assert.Equal(Transcript.QSharpHeatSignalSource, transcript.HeatReadout.QSharpSource)
    Assert.Equal(transcript.HeatRows.Length, transcript.HeatReadout.Rows)
    Assert.Equal(Transcript.TemperatureReadoutSchema, transcript.TemperatureReadout.Schema)
    Assert.Equal(Transcript.BlackBodyReadoutSchema, transcript.BlackBodyReadout.Schema)
    Assert.Equal(transcript.TemperatureReadout.TemperaturePpm, transcript.BlackBodyReadout.TemperaturePpm)
    Assert.Equal(BlackBodyReadout.radiancePpm transcript.TemperatureReadout.TemperaturePpm, transcript.BlackBodyReadout.RadiancePpm)
    Assert.Equal(Transcript.TravelerFrameSchema, transcript.TravelerFrame.Schema)
    Assert.Equal("fsharp-room-loop", transcript.TravelerFrame.Source)
    Assert.Equal(1L, transcript.TravelerFrame.CommonPhase)
    Assert.True(transcript.TravelerFrame.CommonDominatesRoom)
    Assert.True(transcript.TravelerFrame.CommonDominatesHeat)
    Assert.True(hasTraveler "room:darkhall" 1L transcript.TravelerFrame)
    Assert.True(hasTraveler "heat:darkhall" 1L transcript.TravelerFrame)
    Assert.Equal(Transcript.PhaseClockSchema, transcript.PhaseClock.Schema)
    Assert.Equal("fsharp-room-loop", transcript.PhaseClock.Source)
    Assert.Equal("seed-phase", transcript.PhaseClock.Basis)
    Assert.Equal("0x1", transcript.PhaseClock.Seed)
    Assert.Equal(1L, transcript.PhaseClock.Phase)
    Assert.Equal(0L, transcript.PhaseClock.SkewBoundTicks)
    Assert.True(transcript.PhaseClock.AppendOnly)
    Assert.Equal(2, transcript.PhaseClock.Travelers)
    Assert.Equal(HeatReadout.Schema, transcript.TemperatureTreaty.HeatReadoutSchema)
    Assert.Equal(Transcript.TemperatureReadoutSchema, transcript.TemperatureTreaty.TemperatureReadoutSchema)
    Assert.Equal(Transcript.BlackBodyReadoutSchema, transcript.TemperatureTreaty.BlackBodyReadoutSchema)
    Assert.Equal(Transcript.HeatSignalTreaty, transcript.TemperatureTreaty.QSharpTreaty)
    Assert.Equal(Transcript.QSharpHeatSignalSource, transcript.TemperatureTreaty.QSharpSource)
    Assert.Equal(HeatReadout.FSharpSurface, transcript.TemperatureTreaty.FSharpSurface)
    Assert.Equal("fsharp-blackbody-reference", transcript.TemperatureTreaty.ReferenceOracle)
    Assert.Empty(transcript.TemperatureTreaty.ReferenceFeedback)
    Assert.Equal(transcript.TemperatureReadout, transcript.TemperatureTreaty.Temperature)
    Assert.Equal(transcript.BlackBodyReadout, transcript.TemperatureTreaty.BlackBody)
    Assert.Equal("execute", transcript.Ticks.Head.Phase)
    Assert.Equal("ok", transcript.Ticks.Head.Outcome)
    Assert.Equal(Transcript.CausalReadoutSchema, transcript.CausalReadout.Schema)
    Assert.Equal("forward-only", transcript.CausalReadout.ExecutionDirection)
    Assert.True(transcript.CausalReadout.AppendOnly)
    Assert.False(transcript.CausalReadout.RewritesHistory)
    Assert.Empty(transcript.CausalReadout.Corrections)

    let traceState: FourCornerTrace.Traced<unit, string, int> =
        { Interpretation = ()
          Emitted = [] }

    let correction: FourCornerTrace.CausalCorrection<unit, unit, string, int> =
        { Sequence = 9007199254740994I
          ReinterpretsThrough = 9007199254740993I
          Feedback = ()
          Before = traceState
          After = traceState
          Delta = [ "corrected", 1 ] }

    let corrected = Transcript.appendCausalCorrection correction transcript |> mustOk
    let correctionReadout = Assert.Single(corrected.CausalReadout.Corrections)

    Assert.Equal("9007199254740994", correctionReadout.Sequence)
    Assert.Equal("9007199254740993", correctionReadout.ReinterpretsThrough)
    Assert.Equal(1, correctionReadout.DeltaRows)

    let invalid = { correction with Sequence = correction.ReinterpretsThrough }

    match Transcript.appendCausalCorrection invalid transcript with
    | Error(FourCornerTrace.CausalOrderError.CorrectionDoesNotFollowHistory(throughSequence, correctionSequence)) ->
        Assert.Equal(invalid.ReinterpretsThrough, throughSequence)
        Assert.Equal(invalid.Sequence, correctionSequence)
    | other -> Assert.Fail(sprintf "expected causal-order feedback, got %A" other)

    let json = Transcript.toJson corrected

    Assert.Contains("\"schema\": \"zeta.darkhall.room-ui.v1\"", json)
    Assert.Contains("\"heatReadout\"", json)
    Assert.Contains("\"temperatureReadout\"", json)
    Assert.Contains("\"blackBodyReadout\"", json)
    Assert.Contains("\"temperatureTreaty\"", json)
    Assert.Contains("\"travelerFrame\"", json)
    Assert.Contains("\"schema\": \"zeta.darkhall.traveler-frame.v1\"", json)
    Assert.Contains("\"traveler\": \"room:darkhall\"", json)
    Assert.Contains("\"phaseClock\"", json)
    Assert.Contains("\"schema\": \"zeta.darkhall.phase-clock.v1\"", json)
    Assert.Contains("\"basis\": \"seed-phase\"", json)
    Assert.Contains("\"appendOnly\": true", json)
    Assert.Contains("\"continuationReadout\"", json)
    Assert.Contains("\"schema\": \"zeta.darkhall.continuation-readout.v1\"", json)
    Assert.Contains("\"causalReadout\"", json)
    Assert.Contains("\"schema\": \"zeta.darkhall.causal-readout.v1\"", json)
    Assert.Contains("\"executionDirection\": \"forward-only\"", json)
    Assert.Contains("\"rewritesHistory\": false", json)
    Assert.Contains("\"sequence\": \"9007199254740994\"", json)
    Assert.Contains("\"referenceOracle\": \"fsharp-blackbody-reference\"", json)
    Assert.Contains("\"qsharpTreaty\": \"src/Core.QSharp.ReferenceOracle/heat-signals-treaty.json\"", json)
    Assert.Contains("\"controller\"", json)
    Assert.Contains("\"heatRows\"", json)
    Assert.Contains("\"signals\"", json)
    Assert.DoesNotContain("UnionCase", json)

[<Fact>]
let ``unified room run transcript preserves boundary and soft heat rows`` () =
    let boundary = emptyBoundary "room-transcript-boundary" "darkhall" 5
    let vault = sampleVault ()

    let plan =
        boundaryPlan
            "room-transcript-boundary"
            (fun action ->
                if action.Id = "darkhall.edit-grammar" then
                    Some(RoomLoop.BoundaryCommand.Traverse(Set.empty, "glass", vault))
                else
                    None)
            (chooseById "darkhall.edit-grammar")

    let result =
        RoomRun.boundaryTickThenSoftDrive
            (NullHeatSink() :> IHeatSink)
            plan
            (softPlan "room-transcript-soft" inputAfterOne 1)
            (boundaryState boundary)
        |> wait

    match result with
    | Error feedback -> Assert.Fail(sprintf "expected unified room run to complete, got %A" feedback)
    | Ok run ->
        let transcript = Transcript.ofUnifiedHeatRun "0x2a" "fsharp-unified-room-run" run
        let heatKinds = transcript.HeatRows |> List.collect (fun row -> row.HeatKinds)
        let signals = transcript.HeatRows |> List.collect (fun row -> row.Signals) |> List.distinct
        let heatRejected = transcript.HeatRows |> List.sumBy (fun row -> row.HeatRejected)
        let backpressured = transcript.HeatRows |> List.sumBy (fun row -> row.Backpressured)

        Assert.Equal(16, transcript.Controller.Length)
        Assert.Contains(transcript.Controller, fun cell -> cell.Selected && cell.ActionId = "darkhall.edit-grammar")
        Assert.Equal(run.HeatRows.Length, transcript.HeatRows.Length)
        Assert.Equal(run.HeatRows.Length, transcript.HeatReadout.Rows)
        Assert.Equal(heatRejected, transcript.HeatReadout.HeatRejected)
        Assert.Equal(backpressured, transcript.HeatReadout.Backpressured)
        Assert.Equal(countPpm heatRejected, transcript.TemperatureReadout.HeatPpm)
        Assert.Equal(countPpm backpressured, transcript.TemperatureReadout.PressurePpm)
        Assert.Equal(transcript.TemperatureReadout.TemperaturePpm, transcript.BlackBodyReadout.TemperaturePpm)
        Assert.Equal(BlackBodyReadout.radiancePpm transcript.TemperatureReadout.TemperaturePpm, transcript.BlackBodyReadout.RadiancePpm)
        Assert.Equal(transcript.TemperatureReadout, transcript.TemperatureTreaty.Temperature)
        Assert.Equal(transcript.BlackBodyReadout, transcript.TemperatureTreaty.BlackBody)
        Assert.Equal("fsharp-blackbody-reference", transcript.TemperatureTreaty.ReferenceOracle)
        Assert.Empty(transcript.TemperatureTreaty.ReferenceFeedback)
        Assert.Equal(Transcript.TravelerFrameSchema, transcript.TravelerFrame.Schema)
        Assert.Equal("fsharp-unified-room-run", transcript.TravelerFrame.Source)
        Assert.Equal(1L, transcript.TravelerFrame.CommonPhase)
        Assert.True(transcript.TravelerFrame.CommonDominatesRoom)
        Assert.True(transcript.TravelerFrame.CommonDominatesHeat)
        Assert.True(hasTraveler "room:darkhall" 1L transcript.TravelerFrame)
        Assert.True(hasTraveler "heat:darkhall" 1L transcript.TravelerFrame)
        Assert.Equal(Transcript.PhaseClockSchema, transcript.PhaseClock.Schema)
        Assert.Equal("fsharp-unified-room-run", transcript.PhaseClock.Source)
        Assert.Equal("0x2a", transcript.PhaseClock.Seed)
        Assert.Equal(1L, transcript.PhaseClock.Phase)
        Assert.Equal(0L, transcript.PhaseClock.SkewBoundTicks)
        Assert.True(transcript.PhaseClock.AppendOnly)
        Assert.Equal(2, transcript.PhaseClock.Travelers)
        Assert.Equal<string list>([ "denied"; "forgotten" ], transcript.HeatReadout.Signals)
        Assert.Contains("room-boundary.door-denied", heatKinds)
        Assert.Contains("soft-emu.prune", heatKinds)
        Assert.Equal<string list>([ "denied"; "forgotten" ], signals)
        Assert.Contains(transcript.Ticks, fun tick -> tick.Phase = "measure" && tick.Outcome = "backpressure")

        let json = Transcript.toJson transcript

        Assert.Contains("\"generatedBy\": \"fsharp-unified-room-run\"", json)
        Assert.Contains("\"room-boundary.door-denied\"", json)
        Assert.Contains("\"soft-emu.prune\"", json)
        Assert.Contains("\"signals\"", json)
        Assert.Contains("\"denied\"", json)
        Assert.Contains("\"forgotten\"", json)
        Assert.Contains("\"temperatureTreaty\"", json)
        Assert.Contains("\"referenceFeedback\": []", json)
        Assert.Contains("\"travelerFrame\"", json)
        Assert.Contains("\"traveler\": \"heat:darkhall\"", json)
        Assert.Contains("\"phaseClock\"", json)
        Assert.Contains("\"schema\": \"zeta.darkhall.phase-clock.v1\"", json)
        Assert.Contains("\"continuationReadout\"", json)

[<Fact>]
let ``heat board transcript exports resumable continuation metadata`` () =
    task {
        let budget: SimLoop.Budget =
            { MaxLaps = 2
              MaxTicks = 16
              MaxMillis = 1_000L }

        let! outcome =
            Scheduler.heatBoardSimLoop
                "darkhall-heat-board"
                Arcade.room
                Chip9Capabilities.chip8Default
                timer
                "darkhall-simloop"
                (NullHeatSink() :> IHeatSink)
                (fun _ -> None)
                (chooseById "darkhall.edit-grammar")
                (fun _ -> [ TimerElapsed 17 ])
                int64
                budget
                (ctx ())
                42L
                1
                (fun _ _ -> true)

        let transcript =
            Transcript.ofHeatBoardOutcome "0x2a" "fsharp-heat-board-loop" "darkhall-heat-board" 1 outcome

        let expectedPointer = "saves/darkhall/darkhall-heat-board/lap-2-tick-2.heat-board"
        let expectedToken = sprintf "spawn:darkhall-heat-board:2:2:%s" expectedPointer

        Assert.Equal(SimLoop.Stopped.LapBudget, outcome.Stopped)
        Assert.Equal(2, outcome.Final.CompletedTicks)
        Assert.Equal(2, outcome.Final.CompletedLaps)
        Assert.Equal(Transcript.Schema, transcript.Schema)
        Assert.Equal(Transcript.ContinuationReadoutSchema, transcript.ContinuationReadout.Schema)
        Assert.Equal("fsharp-heat-board-loop", transcript.ContinuationReadout.Source)
        Assert.Equal("darkhall-heat-board", transcript.ContinuationReadout.LoopId)
        Assert.True(transcript.ContinuationReadout.Resumable)
        Assert.Equal(expectedToken, transcript.ContinuationReadout.Token)
        Assert.Equal(expectedPointer, transcript.ContinuationReadout.StatePointer)
        Assert.Equal(2, transcript.ContinuationReadout.NextLap)
        Assert.Equal(2, transcript.ContinuationReadout.TicksSpent)
        Assert.Equal(2, transcript.ContinuationReadout.ResumeBaseTick)
        Assert.Equal("lap-budget", transcript.ContinuationReadout.StopReason)
        Assert.Empty(transcript.ContinuationReadout.AdmissionFeedback)
        Assert.NotEmpty(transcript.Ticks)
        Assert.Equal(expectedToken, (transcript.Ticks |> List.last).Continuation)

        let json = Transcript.toJson transcript

        Assert.Contains("\"continuationReadout\"", json)
        Assert.Contains("\"resumable\": true", json)
        Assert.Contains("\"stopReason\": \"lap-budget\"", json)
        Assert.Contains("\"statePointer\": \"saves/darkhall/darkhall-heat-board/lap-2-tick-2.heat-board\"", json)
        Assert.Contains("\"continuation\": \"spawn:darkhall-heat-board:2:2:saves/darkhall/darkhall-heat-board/lap-2-tick-2.heat-board\"", json)
    }
