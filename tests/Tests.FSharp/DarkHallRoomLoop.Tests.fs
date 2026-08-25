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

let private emptyBoundary source room budget config =
    ModuloGSet.empty<string> config
    |> mustOk
    |> RoomBoundary.create (ledgerCrediting source budget) source source room

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
let ``boundary tick lets a controller choice frost the room boundary`` () =
    let sink = RecordingHeatSink()
    let boundary = emptyBoundary "darkhall-boundary-loop" "darkhall" 5 (rejectSlots 2)

    let boundaryFor (action: Runtime.CabinetAction) =
        if action.Id = "darkhall.edit-grammar" then
            Some(RoomLoop.BoundaryCommand.Frost 3)
        else
            None

    let outcome =
        RoomLoop.tickWithBoundary
            "darkhall-boundary-loop"
            (sink :> IHeatSink)
            (fun _ -> None)
            boundaryFor
            (chooseById "darkhall.edit-grammar")
            boundary
            (RoomLoop.initial Arcade.room Chip9Capabilities.chip8Default)
        |> wait

    match outcome.Result with
    | Ok(RoomLoop.BoundaryTickResult.BoundaryResult RoomLoop.BoundaryEffect.Frosted) ->
        Assert.Equal(2, outcome.Boundary.PrivacyBudget)
        Assert.False(GlassHalo.isVisible outcome.Boundary.Visibility)
        Assert.Empty(sink.Signatures)

        match RoomLoop.events outcome.State |> List.rev |> List.tryHead with
        | Some(RoomLoop.LoopEvent.BoundaryApplied(_, action, effect)) ->
            Assert.Equal("darkhall.edit-grammar", action.Id)
            Assert.Equal("frost", effect)
        | other -> Assert.Fail(sprintf "expected boundary-applied event, got %A" other)
    | other -> Assert.Fail(sprintf "expected boundary frost, got %A" other)

[<Fact>]
let ``boundary tick admission backpressure leaves occupant outside and exports heat`` () =
    let sink = RecordingHeatSink()
    let boundary = emptyBoundary "darkhall-boundary-loop" "darkhall" 5 (rejectSlots 1)

    let admit key (current: RoomBoundary.Boundary<string>) =
        RoomLoop.tickWithBoundary
            "darkhall-boundary-loop"
            (sink :> IHeatSink)
            (fun _ -> None)
            (fun action ->
                if action.Id = "darkhall.escape-hatch" then
                    Some(RoomLoop.BoundaryCommand.AdmitWithSlot(0L, key))
                else
                    None)
            (chooseById "darkhall.escape-hatch")
            current
            (RoomLoop.initial Arcade.room Chip9Capabilities.chip8Default)
        |> wait

    let first = admit "alpha" boundary
    let second = admit "beta" first.Boundary

    match first.Result, second.Result with
    | Ok(RoomLoop.BoundaryTickResult.BoundaryResult(RoomLoop.BoundaryEffect.Admitted firstReport)),
      Ok(RoomLoop.BoundaryTickResult.BoundaryResult(RoomLoop.BoundaryEffect.Admitted secondReport)) ->
        Assert.Equal(RoomAdmission.SlotOutcome.Admitted, firstReport.Outcome)
        Assert.Equal(RoomAdmission.SlotOutcome.Backpressured, secondReport.Outcome)
        Assert.Equal<string list>([ "alpha" ], second.Boundary.Occupants |> ModuloGSet.toList)
        Assert.Equal<string list>([ "room-admission.backpressure" ], second.Heat.HeatKinds)
        Assert.Equal(1, second.Heat.Backpressured)
        Assert.Equal(1, sink.Signatures.Count)
        Assert.Equal("room-admission.backpressure", sink.Signatures.[0].Kind)
    | other -> Assert.Fail(sprintf "expected admission reports, got %A" other)

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
let ``tick readout exposes heat backpressure when denied cabinet heat cannot cross boundary`` () =
    let sink =
        BoundedHeatSink(BoundedGSetConfig.noForgetBackpressure 1)

    let filler = HeatSignature.ofMass "test" "heat.fill" 1 1.0 "occupy bounded heat sink"

    match (sink :> IHeatSink).Emit filler with
    | Error feedback -> Assert.Fail(sprintf "expected heat sink prefill, got %A" feedback)
    | Ok() -> ()

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
    | Error(RoomLoop.TickFeedback.RuntimeFeedback(Runtime.Feedback.HeatRejected(address, HeatSinkFeedback.Backpressure(heat, capacity, count)))) ->
        Assert.Equal(mkAddress "play" "meta-cart-host", address)
        Assert.Equal("darkhall.machine.denied", heat.Kind)
        Assert.Equal(1, capacity)
        Assert.Equal(2, count)
    | other -> Assert.Fail(sprintf "expected heat backpressure, got %A" other)

    Assert.Equal(1, outcome.Heat.HeatRejected)
    Assert.Equal(1, outcome.Heat.Backpressured)
    Assert.Equal(0, outcome.Heat.StorageErrors)
    Assert.Equal<string list>([ "darkhall.machine.denied" ], outcome.Heat.HeatKinds)
    Assert.Contains("capacity=1", System.String.Join(";", outcome.Heat.Reasons))

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
