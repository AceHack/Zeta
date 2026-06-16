module Zeta.Tests.DarkHallRoomLoopTests

open global.Xunit
open Zeta.Core

module Runtime = DarkHallCabinetRuntime
module RoomLoop = DarkHallRoomLoop

let private setRegRom = [| 0x6Auy; 0x0Cuy; 0x12uy; 0x02uy |]

let private mkAddress cabinet machine : Runtime.MachineAddress =
    { CabinetName = cabinet
      MachineName = machine }

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

[<Fact>]
let ``ControllerReadout names the controller projection while GridBinding stays the 4x4 placement`` () =
    let readout = Runtime.observe Arcade.room

    Assert.Equal("darkhall", readout.RoomName)
    Assert.Contains("actiongrid 4x4 geometry", readout.DeterministicRulesApplied)
    Assert.Contains("gridbinding labels controller cells", readout.DeterministicRulesApplied)
    Assert.True(GridBinding.count readout.Grid <= GridBinding.Size)

[<Fact>]
let ``tick observes chooses executes and appends the cabinet event ledger`` () =
    let sink = RecordingHeatSink()
    let state = RoomLoop.initial Arcade.room Chip9Capabilities.chip8Default

    let requestFor (action: Runtime.CabinetAction) =
        if action.Id = "darkhall.play.soft-chip8" then
            Some(Runtime.RunSoftChip8(1UL, setRegRom, 5))
        else
            None

    let outcome =
        RoomLoop.tick
            "darkhall-room-loop"
            (sink :> IHeatSink)
            requestFor
            (chooseById "darkhall.play.soft-chip8")
            state
        |> wait

    match outcome.Result with
    | Ok(Runtime.SoftChip8Frame frame) ->
        Assert.Equal(0x0Cuy, frame.V.[0xA])
        Assert.Equal(0, sink.Signatures.Count)
        Assert.Equal(Some "darkhall.play.soft-chip8", outcome.Action |> Option.map (fun action -> action.Id))

        match RoomLoop.events outcome.State with
        | [ RoomLoop.LoopEvent.Observed("darkhall", _)
            RoomLoop.LoopEvent.Chosen(_, chosen)
            RoomLoop.LoopEvent.Executed(_, executed, Runtime.SoftChip8Frame _) ] ->
            Assert.Equal("darkhall.play.soft-chip8", chosen.Id)
            Assert.Equal("darkhall.play.soft-chip8", executed.Id)
        | events -> Assert.Fail(sprintf "unexpected events: %A" events)
    | other -> Assert.Fail(sprintf "expected soft CHIP8 execution, got %A" other)

[<Fact>]
let ``tick records controller-only grammar action as a typed refusal without heat`` () =
    let sink = RecordingHeatSink()
    let state = RoomLoop.initial Arcade.room Chip9Capabilities.chip8Default

    let outcome =
        RoomLoop.tick
            "darkhall-room-loop"
            (sink :> IHeatSink)
            (fun _ -> None)
            (chooseById "darkhall.edit-grammar")
            state
        |> wait

    match outcome.Result with
    | Error(RoomLoop.TickFeedback.ControllerActionSelected(_, action)) ->
        Assert.Equal("darkhall.edit-grammar", action.Id)
        Assert.Equal(0, sink.Signatures.Count)

        match RoomLoop.events outcome.State |> List.rev |> List.tryHead with
        | Some(RoomLoop.LoopEvent.Refused(_, Some refused, RoomLoop.TickFeedback.ControllerActionSelected _)) ->
            Assert.Equal("darkhall.edit-grammar", refused.Id)
        | other -> Assert.Fail(sprintf "expected controller refusal event, got %A" other)
    | other -> Assert.Fail(sprintf "expected controller action refusal, got %A" other)

[<Fact>]
let ``tick appends runtime refusal and emits heat for denied cabinet capability`` () =
    let sink = RecordingHeatSink()
    let child = CartFixtures.cart CartFixtures.chip9GreenDot
    let caps = MetaCart.capabilityMap [ child, CartFixtures.chip9GreenDot.Capabilities ]

    let launch: Runtime.MetaCartLaunch =
        { Goal = 3
          Seed = 1UL
          ParentCapabilities = Chip9Capabilities.chip8Default
          ChildCapabilitiesBySha = caps
          Children = [ child ]
          Parent = Chip8Cow.create 1UL }

    let requestFor (action: Runtime.CabinetAction) =
        if action.Id = "darkhall.play.meta-cart-host" then
            Some(Runtime.RunMetaCart launch)
        else
            None

    let outcome =
        RoomLoop.tick
            "darkhall-room-loop"
            (sink :> IHeatSink)
            requestFor
            (chooseById "darkhall.play.meta-cart-host")
            (RoomLoop.initial Arcade.room Chip9Capabilities.chip8Default)
        |> wait

    match outcome.Result with
    | Error(RoomLoop.TickFeedback.RuntimeFeedback(Runtime.Feedback.CapabilityDenied(address, capability))) ->
        Assert.Equal(mkAddress "play" "meta-cart-host", address)
        Assert.Equal(Chip9Capabilities.Capability.HostAssistedChildLaunch, capability)
        Assert.Equal(1, sink.Signatures.Count)
        Assert.Equal("darkhall.machine.denied", sink.Signatures.[0].Kind)

        match RoomLoop.events outcome.State |> List.rev |> List.tryHead with
        | Some(RoomLoop.LoopEvent.Refused(_, Some refused, RoomLoop.TickFeedback.RuntimeFeedback _)) ->
            Assert.Equal("darkhall.play.meta-cart-host", refused.Id)
        | other -> Assert.Fail(sprintf "expected runtime refusal event, got %A" other)
    | other -> Assert.Fail(sprintf "expected denied capability, got %A" other)

[<Fact>]
let ``run is bounded and carries state through consecutive room ticks`` () =
    let sink = RecordingHeatSink()
    let state = RoomLoop.initial Arcade.room Chip9Capabilities.chip8Default

    let requestFor (action: Runtime.CabinetAction) =
        if action.Id = "darkhall.play.soft-chip8" then
            Some(Runtime.RunSoftChip8(1UL, setRegRom, 5))
        else
            None

    let run =
        RoomLoop.run
            "darkhall-room-loop"
            (sink :> IHeatSink)
            requestFor
            (chooseById "darkhall.play.soft-chip8")
            2
            state
        |> wait

    Assert.Equal(2, run.Ticks.Length)
    Assert.Equal(6, RoomLoop.events run.Final |> List.length)
    Assert.Equal(0, sink.Signatures.Count)
