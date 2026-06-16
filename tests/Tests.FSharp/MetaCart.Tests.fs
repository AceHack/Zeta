module Zeta.Tests.MetaCartTests

open global.Xunit
open Zeta.Core

let private child = Cart.firstCart

let private loopCart = CartFixtures.cart CartFixtures.loop
let private inputCart = CartFixtures.cart CartFixtures.inputFork
let private chip9Green = CartFixtures.cart CartFixtures.chip9GreenDot

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
