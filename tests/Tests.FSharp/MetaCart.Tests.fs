module Zeta.Tests.MetaCartTests

open global.Xunit
open Zeta.Core

let private child = Cart.firstCart

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
