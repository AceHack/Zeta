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
let ``executeCell surfaces policy backpressure heat for attention-selected meta-cart denial`` () =
    task {
        let sink = RecordingHeatSink()
        let cell = requireCell "darkhall.play.meta-cart-host"
        let chip9Cart = CartFixtures.cart CartFixtures.chip9GreenDot
        let inputCart = CartFixtures.cart CartFixtures.inputFork

        let launch: Runtime.MetaCartLaunch =
            { Goal = 10
              Seed = 1UL
              ParentCapabilities = Chip9Capabilities.metaHost
              ChildCapabilitiesBySha =
                MetaCart.capabilityMap
                    [ chip9Cart, Chip9Capabilities.chip8Default
                      inputCart, CartFixtures.inputFork.Capabilities ]
              Children = [ chip9Cart; inputCart ]
              Parent = Chip8Cow.create 1UL }

        let policy: Runtime.MetaCartPolicy =
            { Name = "operator-attention"
              Policy = MetaCart.attentionSelectionPolicy (fun slot -> if slot.Name = chip9Cart.Meta.Title then 100.0 else 0.0) }

        let! result =
            Runtime.executeCell
                "darkhall"
                (sink :> IHeatSink)
                Chip9Capabilities.metaHost
                Arcade.room
                cell
                (Runtime.RunMetaCartWithPolicy(policy, launch))

        match result with
        | Error(Runtime.Feedback.MetaCartFeedback(MetaCart.Feedback.HostDenied(slot, reason))) ->
            Assert.Equal(MetaCart.slotOfCart chip9Cart, slot)
            Assert.Contains("chip9.color-planes", reason)
            Assert.Equal(2, sink.Signatures.Count)
            Assert.Equal("meta-cart.denied", sink.Signatures.[0].Kind)
            Assert.Equal("meta-cart.policy-backpressure", sink.Signatures.[1].Kind)
            Assert.Contains("policy=operator-attention", sink.Signatures.[1].Detail)
            Assert.Contains(slot.Fingerprint.Sha256, sink.Signatures.[1].Detail)
        | other -> Assert.Fail(sprintf "expected policy-selected meta-cart denial, got %A" other)
    }

[<Fact>]
let ``attention ledger compares denied high-attention future with executed lower-attention future`` () =
    task {
        let address = mkAddress "play" "meta-cart-host"
        let chip9Cart = CartFixtures.cart CartFixtures.chip9GreenDot
        let inputCart = CartFixtures.cart CartFixtures.inputFork

        let launch: Runtime.MetaCartLaunch =
            { Goal = 10
              Seed = 1UL
              ParentCapabilities = Chip9Capabilities.metaHost
              ChildCapabilitiesBySha =
                MetaCart.capabilityMap
                    [ chip9Cart, Chip9Capabilities.chip8Default
                      inputCart, CartFixtures.inputFork.Capabilities ]
              Children = [ chip9Cart; inputCart ]
              Parent = Chip8Cow.create 1UL }

        let highAttention: Runtime.MetaCartPolicy =
            { Name = "operator-attention"
              Policy = MetaCart.attentionSelectionPolicy (fun slot -> if slot.Name = chip9Cart.Meta.Title then 100.0 else 0.0) }

        let highSink = RecordingHeatSink()

        let! deniedReport =
            Runtime.executeAddressWithAttentionLedger
                "darkhall"
                (highSink :> IHeatSink)
                Chip9Capabilities.metaHost
                Arcade.room
                address
                (Runtime.RunMetaCartWithPolicy(highAttention, launch))

        match deniedReport.Result with
        | Error(Runtime.Feedback.MetaCartFeedback(MetaCart.Feedback.HostDenied(slot, reason))) ->
            Assert.Equal(MetaCart.slotOfCart chip9Cart, slot)
            Assert.Contains("chip9.color-planes", reason)
        | other -> Assert.Fail(sprintf "expected high-attention denial, got %A" other)

        let deniedRow = Assert.Single(deniedReport.AttentionLedger)

        Assert.Equal("darkhall", deniedRow.Source)
        Assert.Equal(address, deniedRow.Address)
        Assert.Equal("operator-attention", deniedRow.PolicyName)
        Assert.True(deniedRow.ChangedSelection)
        Assert.Equal<MetaCart.CartSlot option>(Some(MetaCart.slotOfCart inputCart), deniedRow.Baseline)
        Assert.Equal<MetaCart.CartSlot option>(Some(MetaCart.slotOfCart chip9Cart), deniedRow.Selected)
        Assert.Equal(Runtime.AttentionOutcome.Denied, deniedRow.Outcome)
        Assert.Equal<string option>(Some "meta-cart.policy-backpressure", deniedRow.HeatKind)
        Assert.Contains("chip9.color-planes", deniedRow.Reason)

        let lowerAttention: Runtime.MetaCartPolicy =
            { Name = "operator-attention"
              Policy = MetaCart.attentionSelectionPolicy (fun slot -> if slot.Name = inputCart.Meta.Title then 1.0 else 0.0) }

        let lowerSink = RecordingHeatSink()

        let! executedReport =
            Runtime.executeAddressWithAttentionLedger
                "darkhall"
                (lowerSink :> IHeatSink)
                Chip9Capabilities.metaHost
                Arcade.room
                address
                (Runtime.RunMetaCartWithPolicy(lowerAttention, launch))

        match executedReport.Result with
        | Ok(Runtime.MetaCartResult result) -> Assert.Equal(MetaCart.slotOfCart inputCart, result.Play.Slot)
        | other -> Assert.Fail(sprintf "expected lower-attention execution, got %A" other)

        let executedRow = Assert.Single(executedReport.AttentionLedger)

        Assert.False(executedRow.ChangedSelection)
        Assert.Equal<MetaCart.CartSlot option>(Some(MetaCart.slotOfCart inputCart), executedRow.Baseline)
        Assert.Equal<MetaCart.CartSlot option>(Some(MetaCart.slotOfCart inputCart), executedRow.Selected)
        Assert.Equal(Runtime.AttentionOutcome.Executed, executedRow.Outcome)
        Assert.Equal<string option>(None, executedRow.HeatKind)

        let summary = Runtime.summarizeAttentionLedger [ deniedRow; executedRow ]

        Assert.Equal(1, summary.Denied)
        Assert.Equal(1, summary.Executed)
        Assert.Equal(1, summary.Backpressured)
    }

[<Fact>]
let ``attention ledger does not label rejected denial heat as policy backpressure`` () =
    task {
        let address = mkAddress "play" "meta-cart-host"
        let chip9Cart = CartFixtures.cart CartFixtures.chip9GreenDot
        let inputCart = CartFixtures.cart CartFixtures.inputFork

        let launch: Runtime.MetaCartLaunch =
            { Goal = 10
              Seed = 1UL
              ParentCapabilities = Chip9Capabilities.metaHost
              ChildCapabilitiesBySha =
                MetaCart.capabilityMap
                    [ chip9Cart, Chip9Capabilities.chip8Default
                      inputCart, CartFixtures.inputFork.Capabilities ]
              Children = [ chip9Cart; inputCart ]
              Parent = Chip8Cow.create 1UL }

        let highAttention: Runtime.MetaCartPolicy =
            { Name = "operator-attention"
              Policy = MetaCart.attentionSelectionPolicy (fun slot -> if slot.Name = chip9Cart.Meta.Title then 100.0 else 0.0) }

        let sink =
            BoundedHeatSink(BoundedGSetConfig.noForgetBackpressure 1)

        let filler = HeatSignature.ofMass "test" "heat.fill" 1 1.0 "occupy bounded heat sink"

        match (sink :> IHeatSink).Emit filler with
        | Ok() -> ()
        | Error feedback -> Assert.Fail(sprintf "expected heat sink prefill, got %A" feedback)

        let! report =
            Runtime.executeAddressWithAttentionLedger
                "darkhall"
                (sink :> IHeatSink)
                Chip9Capabilities.metaHost
                Arcade.room
                address
                (Runtime.RunMetaCartWithPolicy(highAttention, launch))

        match report.Result with
        | Error(Runtime.Feedback.MetaCartFeedback(MetaCart.Feedback.HeatRejected(slot, HeatSinkFeedback.Backpressure(heat, _, _)))) ->
            Assert.Equal(MetaCart.slotOfCart chip9Cart, slot)
            Assert.Equal("meta-cart.denied", heat.Kind)
        | other -> Assert.Fail(sprintf "expected rejected denial heat, got %A" other)

        let row = Assert.Single(report.AttentionLedger)

        Assert.Equal(Runtime.AttentionOutcome.HeatRejected, row.Outcome)
        Assert.Equal<string option>(None, row.HeatKind)

        let summary = Runtime.summarizeAttentionLedger [ row ]

        Assert.Equal(1, summary.HeatRejected)
        Assert.Equal(0, summary.Backpressured)
    }

[<Fact>]
let ``attention ledger does not infer policy backpressure after heat storage errors`` () =
    task {
        let address = mkAddress "play" "meta-cart-host"
        let chip9Cart = CartFixtures.cart CartFixtures.chip9GreenDot
        let inputCart = CartFixtures.cart CartFixtures.inputFork

        let launch: Runtime.MetaCartLaunch =
            { Goal = 10
              Seed = 1UL
              ParentCapabilities = Chip9Capabilities.metaHost
              ChildCapabilitiesBySha =
                MetaCart.capabilityMap
                    [ chip9Cart, Chip9Capabilities.chip8Default
                      inputCart, CartFixtures.inputFork.Capabilities ]
              Children = [ chip9Cart; inputCart ]
              Parent = Chip8Cow.create 1UL }

        let highAttention: Runtime.MetaCartPolicy =
            { Name = "operator-attention"
              Policy = MetaCart.attentionSelectionPolicy (fun slot -> if slot.Name = chip9Cart.Meta.Title then 100.0 else 0.0) }

        let sink =
            BoundedHeatSink(BoundedGSetConfig.noForgetBackpressure 0)

        let! report =
            Runtime.executeAddressWithAttentionLedger
                "darkhall"
                (sink :> IHeatSink)
                Chip9Capabilities.metaHost
                Arcade.room
                address
                (Runtime.RunMetaCartWithPolicy(highAttention, launch))

        match report.Result with
        | Error(Runtime.Feedback.MetaCartFeedback(MetaCart.Feedback.HeatRejected(slot, HeatSinkFeedback.StorageError(BoundedGSetError.NonPositiveCapacity capacity)))) ->
            Assert.Equal(MetaCart.slotOfCart chip9Cart, slot)
            Assert.Equal(0, capacity)
        | other -> Assert.Fail(sprintf "expected heat storage error, got %A" other)

        let row = Assert.Single(report.AttentionLedger)

        Assert.Equal(Runtime.AttentionOutcome.HeatRejected, row.Outcome)
        Assert.Equal<string option>(None, row.HeatKind)

        let summary = Runtime.summarizeAttentionLedger [ row ]

        Assert.Equal(1, summary.HeatRejected)
        Assert.Equal(0, summary.Backpressured)
    }

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
