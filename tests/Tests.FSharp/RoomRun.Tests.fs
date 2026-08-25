module Zeta.Tests.RoomRunTests

open System.Diagnostics
open global.Xunit
open Zeta.Core

module RoomLoop = DarkHallRoomLoop
module Runtime = DarkHallCabinetRuntime
module Scheduler = DarkHallScheduler
module RH = RoomHorizon
module PS = ProbabilitySemiring

let private inputAfterOne =
    [| 0x60uy; 0x00uy; 0xE0uy; 0x9Euy; 0x60uy; 0x01uy |]

let private noInput =
    [| 0x6Auy; 0x05uy; 0x7Auy; 0x03uy; 0x60uy; 0x02uy; 0x8Auy; 0x04uy |]

let private ctx () : IntrCtx =
    { Memetic = "room-run"
      Prompt = ""
      Trust = ""
      Log = ""
      Otel = ActivityContext() }

let private timer =
    function
    | TimerElapsed _ -> true
    | _ -> false

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

let private mustOk =
    function
    | Ok value -> value
    | Error feedback -> failwithf "expected Ok, got %A" feedback

let private rejectSlots slots : ModuloGSetConfig =
    ModuloGSetConfig.rejectCollision slots

/// Budget is EARNED, not passed in: a peer attests value to `owner`, and the boundary reads the
/// resulting balance out of the book. `RoomBoundary.create` no longer accepts a bare int, so this
/// fixture is what "give this test some budget" now honestly costs.
let private ledgerCrediting (owner: string) (budget: int) : PrivacyLedger.Ledger =
    if budget <= 0 then
        PrivacyLedger.empty
    else
        match
            PrivacyLedger.attest
                ("attestation:" + owner)
                owner
                ("peer-of-" + owner)
                budget
                "test fixture: a peer attests that the owner added value"
                PrivacyLedger.empty
        with
        | Ok ledger -> ledger
        | Error refusal -> failwith (PrivacyLedger.describeRefusal refusal)

let private emptyBoundary source room budget =
    ModuloGSet.empty<string> (rejectSlots 4)
    |> mustOk
    |> RoomBoundary.create (ledgerCrediting source budget) source source room

let private sampleVault () =
    let v =
        DoorGraph.empty
        |> DoorGraph.addRoom "darkhall"
        |> DoorGraph.addRoom "glass"

    DoorGraph.addDoor (DoorGraph.door "darkhall" "glass" "door-key") v |> mustOk

let private boundaryState boundary =
    Scheduler.initialWithBoundary Arcade.room Chip9Capabilities.chip8Default boundary

let private boundaryPlan sourceName boundaryFor choose : RoomRun.BoundaryTickPlan<string> =
    { HandlerName = "room-run-boundary"
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

let private assertBoundaryAndSoftHeat (sink: RecordingHeatSink) (run: RoomRun.UnifiedHeatRun<string>) =
    Assert.Equal(1, run.Room.CompletedTicks)
    Assert.True(Scheduler.boundaryBackpressured run.Room)
    Assert.Equal<string list>(
        [ "room-boundary.door-denied" ],
        run.BoundaryHeatRows |> List.collect _.HeatKinds
    )
    Assert.NotEmpty(run.SoftHeatReport.HeatSignatures)
    Assert.Equal(run.SoftHeatReport.PruneEvents, run.SoftHeatReport.HeatSignatures.Length)
    Assert.Equal(2, run.HeatTranscript.Rows)
    Assert.True(run.HeatTranscript.HeatRejected > 1)
    Assert.Equal(1, run.HeatTranscript.Backpressured)
    Assert.Equal<string list>(
        [ "room-boundary.door-denied"; "soft-emu.prune" ],
        run.HeatTranscript.HeatKinds
    )
    Assert.Equal<string list>([ "denied"; "forgotten" ], run.HeatTranscript.Signals)
    Assert.True(Scheduler.transcriptHasHeat run.HeatTranscript)
    Assert.Equal<string list>(
        [ "room-boundary.door-denied"; "soft-emu.prune" ],
        run.HeatRows |> List.collect _.HeatKinds |> List.distinct
    )

    let kinds = sink.Signatures |> Seq.map _.Kind |> Seq.toList

    Assert.Contains("room-boundary.door-denied", kinds)
    Assert.Contains("soft-emu.prune", kinds)
    Assert.True(kinds |> List.exists ((=) "room-boundary.door-denied"))
    Assert.True(kinds |> List.exists ((=) "soft-emu.prune"))

    let hostSink = RecordingHeatSink()

    RoomRun.emitUnifiedHeat (hostSink :> IHeatSink) "room-run-host" run |> mustOk

    Assert.Equal<string list>(
        [ "room-boundary.door-denied"; "soft-emu.prune" ],
        hostSink.Signatures |> Seq.map _.Kind |> Seq.toList
    )
    Assert.All(hostSink.Signatures, fun signature -> Assert.Equal("room-run-host", signature.Source))

let private horizonConfig capacity policy : BoundedGSetConfig =
    { Capacity = capacity
      ForgetPolicy = policy }

let private horizonCost bytes : Vision.BranchCost =
    { SpaceBytes = bytes
      TimeTicks = 0
      BytesPerTick = 0L
      UncertaintyResolutionBits = 0 }

let private horizonCandidate key label state bytes : RH.Candidate<string, string> =
    { Key = key
      Branch =
        { Label = label
          State = state
          Cost = horizonCost bytes }
      Priority =
        { Attention = PS.one
          Gravity = PS.one } }

let private assertHorizonHeatRun (sink: RecordingHeatSink) (run: RoomRun.UnifiedHorizonRun<string, string>) =
    Assert.Equal(1, run.Room.CompletedTicks)
    Assert.Equal<string list>([ "old-b"; "zz-new" ], run.HorizonReport.HorizonAfter |> BoundedGSet.toList)
    Assert.Equal<string list>([ "room-horizon.forgotten" ], run.HeatRows |> List.collect _.HeatKinds)
    Assert.Empty(run.SoftHeatReport.HeatSignatures)
    Assert.Equal(2, run.HeatTranscript.Rows)
    Assert.Equal(1, run.HeatTranscript.HeatRejected)
    Assert.Equal<string list>([ "room-horizon.forgotten" ], run.HeatTranscript.HeatKinds)
    Assert.Equal<string list>([ "forgotten" ], run.HeatTranscript.Signals)
    Assert.Equal<string list>([ "room-horizon.forgotten" ], sink.Signatures |> Seq.map _.Kind |> Seq.toList)

    let hostSink = RecordingHeatSink()

    RoomRun.emitUnifiedHorizonHeat (hostSink :> IHeatSink) "room-run-host" run |> mustOk

    Assert.Equal<string list>(
        [ "room-horizon.forgotten" ],
        hostSink.Signatures |> Seq.map _.Kind |> Seq.toList
    )

    let frame = Scheduler.heatBoardFrame 99UL run.HeatRows

    Assert.Equal(0uy, Chip8Cow.colorAt 0 0 frame)
    Assert.Equal(1uy, Chip8Cow.colorAt 0 1 frame)
    Assert.Equal(4uy, Chip8Cow.colorAt 48 1 frame)

[<Fact>]
let ``room run exports boundary denial and soft prune heat through one sink`` () =
    task {
        let sink = RecordingHeatSink()
        let boundary = emptyBoundary "room-run-boundary" "darkhall" 5
        let vault = sampleVault ()

        let plan =
            boundaryPlan
                "room-run-boundary"
                (fun action ->
                    if action.Id = "darkhall.edit-grammar" then
                        Some(RoomLoop.BoundaryCommand.Traverse(Set.empty, "glass", vault))
                    else
                        None)
                (chooseById "darkhall.edit-grammar")

        let! result =
            RoomRun.boundaryTickThenSoftDrive
                (sink :> IHeatSink)
                plan
                (softPlan "room-run-soft" inputAfterOne 1)
                (boundaryState boundary)

        match result with
        | Error feedback -> Assert.Fail(sprintf "expected unified room run to complete, got %A" feedback)
        | Ok run -> assertBoundaryAndSoftHeat sink run
    }

[<Fact>]
let ``room run stops on soft heat backpressure with typed feedback and keeps room state`` () =
    task {
        let sink =
            BoundedHeatSink(BoundedGSetConfig.noForgetBackpressure 1)

        let filler = HeatSignature.ofMass "test" "heat.fill" 1 1.0 "occupy bounded heat sink"

        match (sink :> IHeatSink).Emit filler with
        | Error feedback -> Assert.Fail(sprintf "expected heat sink prefill, got %A" feedback)
        | Ok() -> ()

        let boundary = emptyBoundary "room-run-boundary" "darkhall" 5

        let plan =
            boundaryPlan
                "room-run-boundary"
                (fun action ->
                    if action.Id = "darkhall.edit-grammar" then
                        Some(RoomLoop.BoundaryCommand.Frost 1)
                    else
                        None)
                (chooseById "darkhall.edit-grammar")

        let! result =
            RoomRun.boundaryTickThenSoftDrive
                (sink :> IHeatSink)
                plan
                (softPlan "room-run-soft" inputAfterOne 1)
                (boundaryState boundary)

        match result with
        | Ok _ -> Assert.Fail "soft heat backpressure should stop the run with typed feedback"
        | Error(RoomRun.UnifiedHeatFeedback.SoftDriveFeedback(room, HeatSinkFeedback.Backpressure(heat, capacity, count))) ->
            Assert.Equal(1, room.CompletedTicks)
            Assert.False(Scheduler.boundaryBackpressured room)
            Assert.Equal("soft-emu.prune", heat.Kind)
            Assert.Equal("room-run-soft", heat.Source)
            Assert.Equal(1, capacity)
            Assert.Equal(2, count)
            Assert.Equal<HeatSignature list>([ filler ], sink.Stored)
        | Error feedback -> Assert.Fail(sprintf "unexpected room-run feedback: %A" feedback)
    }

[<Fact>]
let ``room run with null heat sink keeps the cold happy path cheap`` () =
    task {
        let boundary = emptyBoundary "room-run-boundary" "darkhall" 5

        let plan =
            boundaryPlan
                "room-run-boundary"
                (fun action ->
                    if action.Id = "darkhall.edit-grammar" then
                        Some(RoomLoop.BoundaryCommand.Clear "room-run-boundary")
                    else
                        None)
                (chooseById "darkhall.edit-grammar")

        let! result =
            RoomRun.boundaryTickThenSoftDrive
                (NullHeatSink() :> IHeatSink)
                plan
                (softPlan "room-run-soft" noInput 64)
                (boundaryState boundary)

        match result with
        | Error feedback -> Assert.Fail(sprintf "cold happy path should not need a heat channel, got %A" feedback)
        | Ok run ->
            Assert.Equal(1, run.Room.CompletedTicks)
            Assert.Empty(run.BoundaryHeatRows |> List.collect _.HeatKinds)
            Assert.Empty(run.SoftHeatReport.HeatSignatures)
            Assert.Equal<Scheduler.HeatBoundaryRow list>(run.BoundaryHeatRows, run.HeatRows)
            Assert.Equal(0us, run.SoftFrame.PC % 2us)
    }

[<Fact>]
let ``room run appends finite horizon heat to the host visible transcript`` () =
    task {
        let sink = RecordingHeatSink()
        let boundary = emptyBoundary "room-run-boundary" "darkhall" 5

        let plan =
            boundaryPlan
                "room-run-boundary"
                (fun action ->
                    if action.Id = "darkhall.edit-grammar" then
                        Some(RoomLoop.BoundaryCommand.Clear "room-run-boundary")
                    else
                        None)
                (chooseById "darkhall.edit-grammar")

        let horizon =
            BoundedGSet.ofSeq<string> (horizonConfig 2 BoundedGSetForgetPolicy.ForgetLowest) [ "old-a"; "old-b" ]
            |> mustOk
            |> fun projection -> projection.State

        let horizonPlan: RoomRun.HorizonDrivePlan<string, string> =
            { SourceName = "room-run-horizon"
              Horizon = horizon
              Tank = SoftThrottle.tank 1.0 0.0
              Candidates = [ horizonCandidate "zz-new" "newer" "C" 1L ] }

        let! result =
            RoomRun.boundaryTickThenSoftDriveThenHorizon
                (sink :> IHeatSink)
                plan
                (softPlan "room-run-soft" noInput 64)
                horizonPlan
                (boundaryState boundary)

        match result with
        | Error feedback -> Assert.Fail(sprintf "expected horizon room run to complete, got %A" feedback)
        | Ok run -> assertHorizonHeatRun sink run
    }

[<Fact>]
let ``room run keeps horizon row when external heat sink backpressures`` () =
    task {
        let sink =
            BoundedHeatSink(BoundedGSetConfig.noForgetBackpressure 1)

        let filler = HeatSignature.ofMass "test" "heat.fill" 1 1.0 "occupy bounded heat sink"

        match (sink :> IHeatSink).Emit filler with
        | Error feedback -> Assert.Fail(sprintf "expected heat sink prefill, got %A" feedback)
        | Ok() -> ()

        let boundary = emptyBoundary "room-run-boundary" "darkhall" 5

        let plan =
            boundaryPlan
                "room-run-boundary"
                (fun action ->
                    if action.Id = "darkhall.edit-grammar" then
                        Some(RoomLoop.BoundaryCommand.Clear "room-run-boundary")
                    else
                        None)
                (chooseById "darkhall.edit-grammar")

        let horizon =
            BoundedGSet.ofSeq<string> (horizonConfig 2 BoundedGSetForgetPolicy.ForgetLowest) [ "old-a"; "old-b" ]
            |> mustOk
            |> fun projection -> projection.State

        let horizonPlan: RoomRun.HorizonDrivePlan<string, string> =
            { SourceName = "room-run-horizon"
              Horizon = horizon
              Tank = SoftThrottle.tank 1.0 0.0
              Candidates = [ horizonCandidate "zz-new" "newer" "C" 1L ] }

        let! result =
            RoomRun.boundaryTickThenSoftDriveThenHorizon
                (sink :> IHeatSink)
                plan
                (softPlan "room-run-soft" noInput 64)
                horizonPlan
                (boundaryState boundary)

        match result with
        | Ok _ -> Assert.Fail "full heat sink should backpressure horizon heat"
        | Error(RoomRun.UnifiedHorizonFeedback.HorizonHeatFeedback(run, RH.HeatFeedback(HeatSinkFeedback.Backpressure(heat, capacity, count)))) ->
            Assert.Equal(1, run.Room.CompletedTicks)
            Assert.Equal("room-horizon.forgotten", heat.Kind)
            Assert.Equal(1, capacity)
            Assert.Equal(2, count)
            Assert.Equal<string list>([ "room-horizon.forgotten" ], run.HeatRows |> List.collect _.HeatKinds)
            Assert.Equal<HeatSignature list>([ filler ], sink.Stored)
        | Error feedback -> Assert.Fail(sprintf "unexpected horizon feedback: %A" feedback)
    }
