module Zeta.Tests.MetaCartTests

open global.Xunit
open Zeta.Core

let private child = Cart.firstCart

let private loopCart = CartFixtures.cart CartFixtures.loop
let private inputCart = CartFixtures.cart CartFixtures.inputFork
let private chip9Green = CartFixtures.cart CartFixtures.chip9GreenDot
let private classicCaps =
    MetaCart.capabilityMap
        [ loopCart, CartFixtures.loop.Capabilities
          inputCart, CartFixtures.inputFork.Capabilities ]

let private chip9Caps = MetaCart.capabilityMap [ chip9Green, CartFixtures.chip9GreenDot.Capabilities ]

let private selectedParent (idx: int) =
    Chip8Cow.create 1UL |> Chip8Arcade.commitChoice idx

[<Fact>]
let ``slotOfCart uses the child ROM fingerprint as the meta-cart address`` () =
    let slot = MetaCart.slotOfCart child
    let fp = GameFingerprint.fingerprint child.Rom
    Assert.Equal(child.Meta.Title, slot.Name)
    Assert.Equal(fp.Sha256, slot.Fingerprint.Sha256)
    Assert.Equal(fp.Crc32, slot.Fingerprint.Crc32)
    Assert.Equal(fp.Size, slot.Fingerprint.Size)

[<Fact>]
let ``host-assisted meta-cart plays the carried child selected by the CHIP8 choice cell`` () =
    let sink = RecordingHeatSink()

    match MetaCart.playSelectedCarried "parent-cart" (sink :> IHeatSink) [ child ] (selectedParent 0) with
    | Ok result ->
        Assert.Equal(MetaCart.slotOfCart child, result.Slot)
        Assert.Equal<Chip8Cow.Frame>(Cart.playback child, result.FinalFrame)
        Assert.True(result.Rows |> List.exists (fun row -> row.Key = "cart.sha256" && row.Value = result.Slot.Fingerprint.Sha256))
        Assert.True(result.Rows |> List.exists (fun row -> row.Key = "display.lit"))
        Assert.Equal(0, sink.Signatures.Count)
    | Error feedback -> Assert.True(false, sprintf "expected child cart to play, got %A" feedback)

[<Fact>]
let ``referenced child missing from the injected host emits heat and returns typed feedback`` () =
    let slot = MetaCart.reference "missing-child" (GameFingerprint.fingerprint [| 0x00uy; 0xE0uy |])
    let sink = RecordingHeatSink()
    let host = MetaCart.LocalCartHost [] :> MetaCart.ICartHost

    match MetaCart.playSelected "parent-cart" (sink :> IHeatSink) [ slot ] host (selectedParent 0) with
    | Error(MetaCart.Feedback.MissingCart missing) ->
        Assert.Equal(slot, missing)
        Assert.Equal(1, sink.Signatures.Count)
        Assert.Equal("meta-cart.missing", sink.Signatures.[0].Kind)
        Assert.Equal("parent-cart", sink.Signatures.[0].Source)
        Assert.Contains(slot.Fingerprint.Sha256, sink.Signatures.[0].Detail)
    | other -> Assert.True(false, sprintf "expected MissingCart feedback, got %A" other)

type private DenyingHost(reason: string) =
    interface MetaCart.ICartHost with
        member _.Play request = Error(MetaCart.Feedback.HostDenied(request.Slot, reason))

type private SelectivelyDenyingHost(denied: MetaCart.CartSlot, reason: string, carried: Cart.Cart list) =
    let local = MetaCart.LocalCartHost carried :> MetaCart.ICartHost

    interface MetaCart.ICartHost with
        member _.Play request =
            if request.Slot.Fingerprint.Sha256 = denied.Fingerprint.Sha256 then
                Error(MetaCart.Feedback.HostDenied(request.Slot, reason))
            else
                local.Play request

[<Fact>]
let ``host denial emits heat without pretending the child ran`` () =
    let slot = MetaCart.slotOfCart child
    let sink = RecordingHeatSink()
    let host = DenyingHost("capability-not-granted") :> MetaCart.ICartHost

    match MetaCart.playSelected "parent-cart" (sink :> IHeatSink) [ slot ] host (selectedParent 0) with
    | Error(MetaCart.Feedback.HostDenied(denied, reason)) ->
        Assert.Equal(slot, denied)
        Assert.Equal("capability-not-granted", reason)
        Assert.Equal(1, sink.Signatures.Count)
        Assert.Equal("meta-cart.denied", sink.Signatures.[0].Kind)
        Assert.Contains("capability-not-granted", sink.Signatures.[0].Detail)
    | other -> Assert.True(false, sprintf "expected HostDenied feedback, got %A" other)

[<Fact>]
let ``no selected child is a cold refusal and does not spend heat`` () =
    let sink = RecordingHeatSink()
    let host = MetaCart.LocalCartHost [ child ] :> MetaCart.ICartHost

    match MetaCart.playSelected "parent-cart" (sink :> IHeatSink) [ MetaCart.slotOfCart child ] host (Chip8Cow.create 1UL) with
    | Error(MetaCart.Feedback.NoSelection source) ->
        Assert.Equal("parent-cart", source)
        Assert.Equal(0, sink.Signatures.Count)
    | other -> Assert.True(false, sprintf "expected NoSelection feedback, got %A" other)

[<Fact>]
let ``chooseSlot reuses arcade reflection and picks the most knowable child`` () =
    let choice =
        MetaCart.chooseSlot
            10
            1.0
            (SoftThrottle.tank 5.0 1.0)
            1UL
            [ loopCart; inputCart ]

    match choice with
    | Some c ->
        let expected = MetaCart.slotOfCart inputCart
        Assert.Equal(1, c.Index)
        Assert.Equal(expected, c.Slot)
        Assert.True(c.Reflection.Report.HitBranch)
        Assert.Equal(1.0, c.Reflection.Report.Confidence, 12)
        Assert.Equal((GameFingerprint.fingerprint inputCart.Rom).Sha256, c.Slot.Fingerprint.Sha256)
    | None -> Assert.True(false, "expected a reflected child choice")

[<Fact>]
let ``selectionReadout exposes reflected candidates and the selected slot before launch`` () =
    let readout =
        MetaCart.selectionReadoutWithCapabilities
            10
            Chip9Capabilities.metaHost
            1UL
            [ loopCart; inputCart ]

    Assert.Equal(10, readout.Goal)
    Assert.Equal(10, readout.ReflectedGoal)
    Assert.Equal(2, readout.Candidates.Length)
    Assert.Contains("choice-cell 0x1FF", System.String.Join(" ", readout.DeterministicRulesApplied))

    match readout.Selected with
    | Some selected ->
        let expected = MetaCart.slotOfCart inputCart
        Assert.Equal(1, selected.Index)
        Assert.Equal(expected, selected.Slot)
        Assert.Equal(expected.Fingerprint.Sha256, selected.Slot.Fingerprint.Sha256)
    | None -> Assert.True(false, "expected a selected child in the readout")

[<Fact>]
let ``attention policy reorders candidates without crossing the host boundary`` () =
    let sink = RecordingHeatSink()

    let readout =
        MetaCart.selectionReadout
            10
            1.0
            (SoftThrottle.tank 5.0 1.0)
            1UL
            [ loopCart; inputCart ]

    let attended =
        readout
        |> MetaCart.applySelectionPolicy
            "test-attention"
            (MetaCart.attentionSelectionPolicy (fun slot -> if slot.Name = loopCart.Meta.Title then 10.0 else 0.0))

    Assert.Contains("selection policy test-attention", System.String.Join(" ", attended.DeterministicRulesApplied))

    match attended.Selected with
    | Some selected ->
        Assert.Equal(0, selected.Index)
        Assert.Equal(MetaCart.slotOfCart loopCart, selected.Slot)
    | None -> Assert.Fail("expected attention to select an existing child cart")

    match attended.PolicyTrace with
    | Some trace ->
        Assert.Equal("test-attention", trace.PolicyName)
        Assert.True(trace.ChangedSelection)
        Assert.Equal(Some(MetaCart.slotOfCart inputCart), trace.BaselineSelected |> Option.map (fun choice -> choice.Slot))
        Assert.Equal(Some(MetaCart.slotOfCart loopCart), trace.PolicySelected |> Option.map (fun choice -> choice.Slot))
    | None -> Assert.Fail("expected attention policy trace")

    let host = MetaCart.LocalCartHost [ loopCart; inputCart ] :> MetaCart.ICartHost

    match
        MetaCart.playChosenFromSelectionReadout
            "parent-cart"
            (sink :> IHeatSink)
            attended
            host
            (Chip8Cow.create 1UL)
    with
    | Ok result ->
        Assert.Equal(MetaCart.slotOfCart loopCart, result.Play.Slot)
        Assert.Equal(Some(MetaCart.slotOfCart loopCart), MetaCart.readSlot [ MetaCart.slotOfCart loopCart; MetaCart.slotOfCart inputCart ] result.ParentWithChoice)
        Assert.Equal(0, sink.Signatures.Count)
    | Error feedback -> Assert.Fail(sprintf "expected attended child launch, got %A" feedback)

[<Fact>]
let ``attention-selected denied branch emits policy backpressure heat`` () =
    let sink = RecordingHeatSink()

    let readout =
        MetaCart.selectionReadout
            10
            1.0
            (SoftThrottle.tank 5.0 1.0)
            1UL
            [ loopCart; inputCart ]

    let attended =
        readout
        |> MetaCart.applySelectionPolicy
            "operator-attention"
            (MetaCart.attentionSelectionPolicy (fun slot -> if slot.Name = loopCart.Meta.Title then 100.0 else 0.0))

    let denied = MetaCart.slotOfCart loopCart
    let host = SelectivelyDenyingHost(denied, "attention-target-over-budget", [ loopCart; inputCart ]) :> MetaCart.ICartHost

    match
        MetaCart.playChosenFromSelectionReadout
            "parent-cart"
            (sink :> IHeatSink)
            attended
            host
            (Chip8Cow.create 1UL)
    with
    | Error(MetaCart.Feedback.HostDenied(slot, reason)) ->
        Assert.Equal(denied, slot)
        Assert.Equal("attention-target-over-budget", reason)
        Assert.Equal(2, sink.Signatures.Count)
        Assert.Equal("meta-cart.denied", sink.Signatures.[0].Kind)
        Assert.Equal("meta-cart.policy-backpressure", sink.Signatures.[1].Kind)
        Assert.Contains("policy=operator-attention", sink.Signatures.[1].Detail)
        Assert.Contains((MetaCart.slotOfCart inputCart).Fingerprint.Sha256, sink.Signatures.[1].Detail)
        Assert.Contains(denied.Fingerprint.Sha256, sink.Signatures.[1].Detail)
        Assert.Contains("attention-target-over-budget", sink.Signatures.[1].Detail)
    | other -> Assert.Fail(sprintf "expected policy-selected HostDenied feedback, got %A" other)

[<Fact>]
let ``selection policy cannot invent a non-candidate slot`` () =
    let sink = RecordingHeatSink()

    let readout =
        MetaCart.selectionReadout
            10
            1.0
            (SoftThrottle.tank 5.0 1.0)
            1UL
            [ loopCart; inputCart ]

    let fakeSlot = MetaCart.reference "invented-child" (GameFingerprint.fingerprint [| 0x00uy; 0xE0uy |])

    let inventingPolicy (candidateReadout: MetaCart.SelectionReadout) =
        candidateReadout.Selected
        |> Option.map (fun selected -> { selected with Slot = fakeSlot })

    let attended = readout |> MetaCart.applySelectionPolicy "inventing" inventingPolicy

    match attended.Selected with
    | Some selected -> Assert.Fail(sprintf "expected invented policy choice to be rejected, got %A" selected)
    | None -> ()

    let host = MetaCart.LocalCartHost [ loopCart; inputCart ] :> MetaCart.ICartHost

    match
        MetaCart.playChosenFromSelectionReadout
            "parent-cart"
            (sink :> IHeatSink)
            attended
            host
            (Chip8Cow.create 1UL)
    with
    | Error(MetaCart.Feedback.NoSelection source) ->
        Assert.Equal("parent-cart", source)
        Assert.Equal(0, sink.Signatures.Count)
    | other -> Assert.Fail(sprintf "expected cold NoSelection after invented policy choice, got %A" other)

[<Fact>]
let ``playChosenFromSelectionReadout launches through the injected host boundary`` () =
    let sink = RecordingHeatSink()
    let readout =
        MetaCart.selectionReadout
            10
            1.0
            (SoftThrottle.tank 5.0 1.0)
            1UL
            [ loopCart; inputCart ]

    let host = MetaCart.LocalCartHost [ loopCart; inputCart ] :> MetaCart.ICartHost

    match
        MetaCart.playChosenFromSelectionReadout
            "parent-cart"
            (sink :> IHeatSink)
            readout
            host
            (Chip8Cow.create 1UL)
    with
    | Ok result ->
        let expected = MetaCart.slotOfCart inputCart
        Assert.Equal(expected, result.Choice.Slot)
        Assert.Equal(expected, result.Play.Slot)
        Assert.Equal(Some expected, MetaCart.readSlot [ MetaCart.slotOfCart loopCart; expected ] result.ParentWithChoice)
        Assert.Equal(0, sink.Signatures.Count)
    | Error feedback -> Assert.True(false, sprintf "expected reflected child launch, got %A" feedback)

[<Fact>]
let ``playChosenCarried commits the reflected choice into the parent cell and launches the child`` () =
    let sink = RecordingHeatSink()

    match
        MetaCart.playChosenCarried
            "parent-cart"
            (sink :> IHeatSink)
            10
            1.0
            (SoftThrottle.tank 5.0 1.0)
            1UL
            [ loopCart; inputCart ]
            (Chip8Cow.create 1UL)
    with
    | Ok result ->
        let expected = MetaCart.slotOfCart inputCart
        Assert.Equal(expected, result.Choice.Slot)
        Assert.Equal(Some expected, MetaCart.readSlot [ MetaCart.slotOfCart loopCart; expected ] result.ParentWithChoice)
        Assert.Equal<Chip8Cow.Frame>(Cart.playback inputCart, result.Play.FinalFrame)
        Assert.True(result.Play.Rows |> List.exists (fun row -> row.Key = "cart.sha256" && row.Value = expected.Fingerprint.Sha256))
        Assert.Equal(0, sink.Signatures.Count)
    | Error feedback -> Assert.True(false, sprintf "expected reflected child launch, got %A" feedback)

[<Fact>]
let ``host-assisted meta-cart can launch a source-owned CHIP9 child cart`` () =
    let sink = RecordingHeatSink()

    match MetaCart.playSelectedCarried "parent-cart" (sink :> IHeatSink) [ chip9Green ] (selectedParent 0) with
    | Ok result ->
        Assert.Equal(MetaCart.slotOfCart chip9Green, result.Slot)
        Assert.Equal(2uy, result.FinalFrame.Plane)
        Assert.False(Chip8Cow.pixel 0 0 result.FinalFrame)
        Assert.Equal(2uy, Chip8Cow.colorAt 0 0 result.FinalFrame)
        Assert.Equal(0, sink.Signatures.Count)
    | Error feedback -> Assert.True(false, sprintf "expected CHIP9 child cart to play, got %A" feedback)

[<Fact>]
let ``empty reflected child library is a cold no-selection refusal`` () =
    let sink = RecordingHeatSink()
    let host = MetaCart.LocalCartHost [] :> MetaCart.ICartHost

    match
        MetaCart.playChosenByReflection
            "parent-cart"
            (sink :> IHeatSink)
            10
            1.0
            (SoftThrottle.tank 5.0 1.0)
            1UL
            []
            host
            (Chip8Cow.create 1UL)
    with
    | Error(MetaCart.Feedback.NoSelection source) ->
        Assert.Equal("parent-cart", source)
        Assert.Equal(0, sink.Signatures.Count)
    | other -> Assert.True(false, sprintf "expected reflected NoSelection feedback, got %A" other)

[<Fact>]
let ``missing reflected child emits heat after the soft selector chooses it`` () =
    let sink = RecordingHeatSink()
    let host = MetaCart.LocalCartHost [ loopCart ] :> MetaCart.ICartHost

    match
        MetaCart.playChosenByReflection
            "parent-cart"
            (sink :> IHeatSink)
            10
            1.0
            (SoftThrottle.tank 5.0 1.0)
            1UL
            [ loopCart; inputCart ]
            host
            (Chip8Cow.create 1UL)
    with
    | Error(MetaCart.Feedback.MissingCart missing) ->
        let expected = MetaCart.slotOfCart inputCart
        Assert.Equal(expected, missing)
        Assert.Equal(1, sink.Signatures.Count)
        Assert.Equal("meta-cart.missing", sink.Signatures.[0].Kind)
        Assert.Contains(expected.Fingerprint.Sha256, sink.Signatures.[0].Detail)
    | other -> Assert.True(false, sprintf "expected reflected MissingCart feedback, got %A" other)

[<Fact>]
let ``capability-aware reflected launch emits heat when parent lacks host launch`` () =
    let sink = RecordingHeatSink()

    match
        MetaCart.playChosenCarriedWithCapabilities
            "parent-cart"
            (sink :> IHeatSink)
            10
            1UL
            Chip9Capabilities.chip8Default
            classicCaps
            [ loopCart; inputCart ]
            (Chip8Cow.create 1UL)
    with
    | Error(MetaCart.Feedback.HostDenied(denied, reason)) ->
        let expected = MetaCart.slotOfCart inputCart
        Assert.Equal(expected, denied)
        Assert.Contains("meta-cart.host-child-launch", reason)
        Assert.Equal(1, sink.Signatures.Count)
        Assert.Equal("meta-cart.denied", sink.Signatures.[0].Kind)
        Assert.Contains(expected.Fingerprint.Sha256, sink.Signatures.[0].Detail)
        Assert.Contains(reason, sink.Signatures.[0].Detail)
    | other -> Assert.True(false, sprintf "expected reflected host-child-launch denial, got %A" other)

[<Fact>]
let ``capability-aware reflected launch emits heat when child lacks CHIP9 color grant`` () =
    let sink = RecordingHeatSink()
    let childCaps = MetaCart.capabilityMap [ chip9Green, Chip9Capabilities.chip8Default ]

    match
        MetaCart.playChosenCarriedWithCapabilities
            "parent-cart"
            (sink :> IHeatSink)
            3
            1UL
            Chip9Capabilities.metaHost
            childCaps
            [ chip9Green ]
            (Chip8Cow.create 1UL)
    with
    | Error(MetaCart.Feedback.HostDenied(denied, reason)) ->
        Assert.Equal(MetaCart.slotOfCart chip9Green, denied)
        Assert.Contains("chip9.color-planes", reason)
        Assert.Equal(1, sink.Signatures.Count)
        Assert.Equal("meta-cart.denied", sink.Signatures.[0].Kind)
        Assert.Contains(reason, sink.Signatures.[0].Detail)
    | other -> Assert.True(false, sprintf "expected reflected child color denial, got %A" other)

[<Fact>]
let ``capability-aware reflected launch runs granted CHIP9 child`` () =
    let sink = RecordingHeatSink()

    match
        MetaCart.playChosenCarriedWithCapabilities
            "parent-cart"
            (sink :> IHeatSink)
            3
            1UL
            Chip9Capabilities.chip9MetaHost
            chip9Caps
            [ chip9Green ]
            (Chip8Cow.create 1UL)
    with
    | Ok result ->
        Assert.Equal(MetaCart.slotOfCart chip9Green, result.Choice.Slot)
        Assert.Equal(MetaCart.slotOfCart chip9Green, result.Play.Slot)
        Assert.Equal(Some(MetaCart.slotOfCart chip9Green), MetaCart.readSlot [ MetaCart.slotOfCart chip9Green ] result.ParentWithChoice)
        Assert.Equal(2uy, result.Play.FinalFrame.Plane)
        Assert.Equal(2uy, Chip8Cow.colorAt 0 0 result.Play.FinalFrame)
        Assert.Equal(0, sink.Signatures.Count)
    | Error feedback -> Assert.True(false, sprintf "expected granted reflected CHIP9 launch, got %A" feedback)
