module Zeta.Tests.Chip9CapabilitiesTests

open global.Xunit
open Zeta.Core

let private selectedParent (idx: int) =
    Chip8Cow.create 1UL |> Chip8Arcade.commitChoice idx

let private capabilityMap (fixture: CartFixtures.Fixture) =
    MetaCart.capabilityMap [ CartFixtures.cart fixture, fixture.Capabilities ]

[<Fact>]
let ``classic CHIP8 manifest rejects CHIP9 color-plane opcodes`` () =
    let cart = CartFixtures.cart CartFixtures.chip9GreenDot

    Assert.True(Chip9Capabilities.requiresColorPlanes cart.Rom)

    match Chip9Capabilities.playback Chip9Capabilities.chip8Default cart with
    | Error reason -> Assert.Equal("capability-not-granted:chip9.color-planes", reason)
    | Ok _ -> Assert.True(false, "classic CHIP8 manifest should not run a color-plane cart")

[<Fact>]
let ``CHIP9 color manifest runs the emulator-native plane extension`` () =
    let manifest = CartFixtures.chip9GreenDot.Capabilities
    let cart = CartFixtures.cart CartFixtures.chip9GreenDot

    Assert.True(Chip9Capabilities.grants Chip9Capabilities.Capability.ColorPlanes manifest)
    Assert.True(Chip9Capabilities.grants Chip9Capabilities.Capability.UnthrottledExecution manifest)

    match Chip9Capabilities.playback manifest cart with
    | Ok final ->
        Assert.Equal(2uy, final.Plane)
        Assert.False(Chip8Cow.pixel 0 0 final)
        Assert.Equal(2uy, Chip8Cow.colorAt 0 0 final)
    | Error reason -> Assert.True(false, sprintf "expected CHIP9 cart to run, got %s" reason)

[<Fact>]
let ``unthrottled manifest makes self-reflection cost zero flux`` () =
    let goal = 10
    let start = Chip8Arcade.boot 1UL CartFixtures.loopRom
    let _, metered, _ = SoftChip8Flux.speculateToward goal 1.0 (SoftThrottle.tank 2.0 0.0) start
    let reflectedGoal, costPerStep, tank = Chip9Capabilities.reflectionBudget goal CartFixtures.chip9GreenDot.Capabilities
    let _, unthrottled, _ = SoftChip8Flux.speculateToward reflectedGoal costPerStep tank start

    Assert.True(metered.Starved)
    Assert.True(metered.Achieved < goal)
    Assert.Equal(0.0, costPerStep)
    Assert.False(unthrottled.Starved)
    Assert.Equal(goal, unthrottled.Achieved)

[<Fact>]
let ``parent manifest gates host-assisted child launch`` () =
    let child = CartFixtures.cart CartFixtures.chip9GreenDot
    let sink = RecordingHeatSink()

    match
        MetaCart.playSelectedCarriedWithCapabilities
            "parent-cart"
            (sink :> IHeatSink)
            Chip9Capabilities.chip8Default
            (capabilityMap CartFixtures.chip9GreenDot)
            [ child ]
            (selectedParent 0)
    with
    | Error(MetaCart.Feedback.HostDenied(slot, reason)) ->
        Assert.Equal(MetaCart.slotOfCart child, slot)
        Assert.Contains("meta-cart.host-child-launch", reason)
        Assert.Equal(1, sink.Signatures.Count)
        Assert.Equal("meta-cart.denied", sink.Signatures.[0].Kind)
        Assert.Contains(reason, sink.Signatures.[0].Detail)
    | other -> Assert.True(false, sprintf "expected host-child-launch denial, got %A" other)

[<Fact>]
let ``parent and child manifests launch a CHIP9 color child`` () =
    let child = CartFixtures.cart CartFixtures.chip9GreenDot
    let sink = RecordingHeatSink()

    match
        MetaCart.playSelectedCarriedWithCapabilities
            "parent-cart"
            (sink :> IHeatSink)
            Chip9Capabilities.metaHost
            (capabilityMap CartFixtures.chip9GreenDot)
            [ child ]
            (selectedParent 0)
    with
    | Ok result ->
        Assert.Equal(MetaCart.slotOfCart child, result.Slot)
        Assert.Equal(2uy, result.FinalFrame.Plane)
        Assert.Equal(2uy, Chip8Cow.colorAt 0 0 result.FinalFrame)
        Assert.Equal(0, sink.Signatures.Count)
    | Error feedback -> Assert.True(false, sprintf "expected capability-granted launch, got %A" feedback)

[<Fact>]
let ``child manifest gates CHIP9 color execution after parent launch is granted`` () =
    let child = CartFixtures.cart CartFixtures.chip9GreenDot
    let sink = RecordingHeatSink()
    let childCaps = MetaCart.capabilityMap [ child, Chip9Capabilities.chip8Default ]

    match
        MetaCart.playSelectedCarriedWithCapabilities
            "parent-cart"
            (sink :> IHeatSink)
            Chip9Capabilities.metaHost
            childCaps
            [ child ]
            (selectedParent 0)
    with
    | Error(MetaCart.Feedback.HostDenied(slot, reason)) ->
        Assert.Equal(MetaCart.slotOfCart child, slot)
        Assert.Contains("chip9.color-planes", reason)
        Assert.Equal(1, sink.Signatures.Count)
        Assert.Equal("meta-cart.denied", sink.Signatures.[0].Kind)
        Assert.Contains(reason, sink.Signatures.[0].Detail)
    | other -> Assert.True(false, sprintf "expected child color capability denial, got %A" other)
