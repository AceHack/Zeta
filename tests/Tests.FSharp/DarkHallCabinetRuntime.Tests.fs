module Zeta.Tests.DarkHallCabinetRuntimeTests

open global.Xunit
open Zeta.Core

module Runtime = DarkHallCabinetRuntime

let private setRegRom = [| 0x6Auy; 0x0Cuy; 0x12uy; 0x02uy |]

let private cellFor (id: string) =
    let readout = Runtime.observe Arcade.room

    GridBinding.bound readout.Grid
    |> List.tryFind (fun (_, action) -> action.Id = id)
    |> Option.map fst

let private requireCell id =
    match cellFor id with
    | Some cell -> cell
    | None -> failwithf "missing cabinet action %s" id

let private mkAddress cabinet machine : Runtime.MachineAddress =
    { CabinetName = cabinet
      MachineName = machine }

[<Fact>]
let ``observe binds DarkHall cabinet actions onto the 4x4 controller`` () =
    let readout = Runtime.observe Arcade.room
    let ids = readout.Actions |> List.map (fun action -> action.Id)

    Assert.Equal("darkhall", readout.RoomName)
    Assert.True(GridBinding.count readout.Grid <= GridBinding.Size)
    Assert.Contains("darkhall.play.soft-chip8", ids)
    Assert.Contains("darkhall.play.meta-cart-host", ids)
    Assert.Contains("darkhall.escape-hatch", ids)
    Assert.Contains("darkhall.edit-grammar", ids)
    Assert.Contains("gridbinding 4x4", readout.DeterministicRulesApplied)

[<Fact>]
let ``machine action declares workflow-style DU metadata`` () =
    let readout = Runtime.observe Arcade.room
    let action = readout.Actions |> List.find (fun action -> action.Id = "darkhall.play.meta-cart-host")

    Assert.Equal(Runtime.ActionClass.Transition, action.Class)
    Assert.Equal(Runtime.ActionGate.AppendOnly, action.Gate)
    Assert.Contains("capability-denied", action.FeedbackVariants)
    Assert.Contains("heat-rejected", action.FeedbackVariants)
    Assert.Equal(Some(mkAddress "play" "meta-cart-host"), action.Address)

[<Fact>]
let ``observeMetaCartLaunch exposes the child-cart selection readout`` () =
    let loopCart = CartFixtures.cart CartFixtures.loop
    let inputCart = CartFixtures.cart CartFixtures.inputFork

    let launch: Runtime.MetaCartLaunch =
        { Goal = 10
          Seed = 1UL
          ParentCapabilities = Chip9Capabilities.metaHost
          ChildCapabilitiesBySha =
            MetaCart.capabilityMap
                [ loopCart, CartFixtures.loop.Capabilities
                  inputCart, CartFixtures.inputFork.Capabilities ]
          Children = [ loopCart; inputCart ]
          Parent = Chip8Cow.create 1UL }

    let readout = Runtime.observeMetaCartLaunch launch

    Assert.Equal(2, readout.Candidates.Length)
    Assert.Contains("chip8arcade.choose", System.String.Join(" ", readout.DeterministicRulesApplied))

    match readout.Selected with
    | Some selected ->
        Assert.Equal(1, selected.Index)
        Assert.Equal(MetaCart.slotOfCart inputCart, selected.Slot)
    | None -> Assert.Fail("expected selected child cart")

[<Fact>]
let ``observeMetaCartLaunchWithPolicy exposes attention-reordered child selection`` () =
    let loopCart = CartFixtures.cart CartFixtures.loop
    let inputCart = CartFixtures.cart CartFixtures.inputFork

    let launch: Runtime.MetaCartLaunch =
        { Goal = 10
          Seed = 1UL
          ParentCapabilities = Chip9Capabilities.metaHost
          ChildCapabilitiesBySha =
            MetaCart.capabilityMap
                [ loopCart, CartFixtures.loop.Capabilities
                  inputCart, CartFixtures.inputFork.Capabilities ]
          Children = [ loopCart; inputCart ]
          Parent = Chip8Cow.create 1UL }

    let readout =
        Runtime.observeMetaCartLaunchWithPolicy
            "operator-attention"
            (MetaCart.attentionSelectionPolicy (fun slot -> if slot.Name = loopCart.Meta.Title then 100.0 else 0.0))
            launch

    Assert.Equal(2, readout.Candidates.Length)
    Assert.Contains("selection policy operator-attention", System.String.Join(" ", readout.DeterministicRulesApplied))

    match readout.Selected with
    | Some selected ->
        Assert.Equal(0, selected.Index)
        Assert.Equal(MetaCart.slotOfCart loopCart, selected.Slot)
    | None -> Assert.Fail("expected attention policy to select the loop cart")

[<Fact>]
let ``executeCell runs the selected soft CHIP8 scheduler machine`` () =
    task {
        let sink = RecordingHeatSink()
        let cell = requireCell "darkhall.play.soft-chip8"

        let! result =
            Runtime.executeCell
                "darkhall"
                (sink :> IHeatSink)
                Chip9Capabilities.chip8Default
                Arcade.room
                cell
                (Runtime.RunSoftChip8(1UL, setRegRom, 5))

        match result with
        | Ok(Runtime.SoftChip8Frame frame) ->
            Assert.Equal(0x0Cuy, frame.V.[0xA])
            Assert.Equal(0, sink.Signatures.Count)
        | other -> Assert.Fail(sprintf "expected soft CHIP8 frame, got %A" other)
    }

[<Fact>]
let ``executeCell rejects a capability-gated cabinet machine with heat`` () =
    task {
        let sink = RecordingHeatSink()
        let cell = requireCell "darkhall.play.meta-cart-host"
        let child = CartFixtures.cart CartFixtures.chip9GreenDot
        let caps = MetaCart.capabilityMap [ child, CartFixtures.chip9GreenDot.Capabilities ]

        let launch: Runtime.MetaCartLaunch =
            { Goal = 3
              Seed = 1UL
              ParentCapabilities = Chip9Capabilities.chip8Default
              ChildCapabilitiesBySha = caps
              Children = [ child ]
              Parent = Chip8Cow.create 1UL }

        let! result =
            Runtime.executeCell
                "darkhall"
                (sink :> IHeatSink)
                Chip9Capabilities.chip8Default
                Arcade.room
                cell
                (Runtime.RunMetaCart launch)

        match result with
        | Error(Runtime.Feedback.CapabilityDenied(address, capability)) ->
            Assert.Equal(mkAddress "play" "meta-cart-host", address)
            Assert.Equal(Chip9Capabilities.Capability.HostAssistedChildLaunch, capability)
            Assert.Equal(1, sink.Signatures.Count)
            Assert.Equal("darkhall.machine.denied", sink.Signatures.[0].Kind)
        | other -> Assert.Fail(sprintf "expected capability denial, got %A" other)
    }

[<Fact>]
let ``executeCell runs a granted meta-cart host machine`` () =
    task {
        let sink = RecordingHeatSink()
        let cell = requireCell "darkhall.play.meta-cart-host"
        let child = CartFixtures.cart CartFixtures.chip9GreenDot
        let caps = MetaCart.capabilityMap [ child, CartFixtures.chip9GreenDot.Capabilities ]

        let launch: Runtime.MetaCartLaunch =
            { Goal = 3
              Seed = 1UL
              ParentCapabilities = Chip9Capabilities.chip9MetaHost
              ChildCapabilitiesBySha = caps
              Children = [ child ]
              Parent = Chip8Cow.create 1UL }

        let! result =
            Runtime.executeCell
                "darkhall"
                (sink :> IHeatSink)
                Chip9Capabilities.chip9MetaHost
                Arcade.room
                cell
                (Runtime.RunMetaCart launch)

        match result with
        | Ok(Runtime.MetaCartResult result) ->
            Assert.Equal(MetaCart.slotOfCart child, result.Play.Slot)
            Assert.Equal(2uy, result.Play.FinalFrame.Plane)
            Assert.Equal(0, sink.Signatures.Count)
        | other -> Assert.Fail(sprintf "expected meta-cart result, got %A" other)
    }

[<Fact>]
let ``executeCell rejects mismatched request and selected machine`` () =
    task {
        let sink = RecordingHeatSink()
        let cell = requireCell "darkhall.host.darkhall-cpu"

        let! result =
            Runtime.executeCell
                "darkhall"
                (sink :> IHeatSink)
                Chip9Capabilities.chip8Default
                Arcade.room
                cell
                (Runtime.RunSoftChip8(1UL, setRegRom, 1))

        match result with
        | Error(Runtime.Feedback.RequestMismatch(address, core, request)) ->
            Assert.Equal(mkAddress "host" "darkhall-cpu", address)
            Assert.Equal(DarkHall.MachineCore.DarkHallCpu, core)
            Assert.Equal("run-soft-chip8", request)
            Assert.Equal(0, sink.Signatures.Count)
        | other -> Assert.Fail(sprintf "expected request mismatch, got %A" other)
    }
