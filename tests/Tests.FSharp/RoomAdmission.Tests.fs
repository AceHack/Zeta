module Zeta.Tests.RoomAdmissionTests

open global.Xunit
open Zeta.Core

module RA = RoomAdmission

let private mustOk =
    function
    | Ok value -> value
    | Error feedback -> failwithf "expected Ok, got %A" feedback

let private rejectSlots slots : ModuloGSetConfig =
    { Slots = slots
      CollisionPolicy = ModuloGSetCollisionPolicy.RejectCollision }

let private replaceSlots slots : ModuloGSetConfig =
    { Slots = slots
      CollisionPolicy = ModuloGSetCollisionPolicy.ReplaceExisting }

let private emptyModulo config =
    ModuloGSet.empty<string> config |> mustOk

[<Fact>]
let ``no-forget modulo collision becomes room backpressure without forgetting`` () =
    let start = emptyModulo (rejectSlots 2)
    let first = RA.admitWithSlot 1L "alpha" start |> mustOk
    let second = RA.admitWithSlot 3L "beta" first.After |> mustOk

    Assert.Equal(RA.SlotOutcome.Admitted, first.Outcome)
    Assert.Equal(RA.SlotOutcome.Backpressured, second.Outcome)
    Assert.Equal(1, second.Slot)
    Assert.Equal<string list>([ "alpha" ], second.After |> ModuloGSet.toList)
    Assert.Equal<string list>([ "beta" ], second.Backpressured |> GSet.toList)
    Assert.Empty(second.Heat.Forgotten |> GSet.toList)
    Assert.Equal(0, second.Heat.Units)

    let signatures = RA.heatSignatures "chip9-room" second

    Assert.Single(signatures) |> ignore
    Assert.Equal("room-admission.backpressure", signatures.[0].Kind)
    Assert.Equal(1, signatures.[0].Units)

[<Fact>]
let ``replacement emits forgotten occupant as room heat`` () =
    let start = emptyModulo (replaceSlots 2)
    let first = RA.admitWithSlot 1L "old" start |> mustOk
    let second = RA.admitWithSlot 3L "new" first.After |> mustOk

    Assert.Equal(RA.SlotOutcome.Replaced, second.Outcome)
    Assert.Equal<string list>([ "new" ], second.After |> ModuloGSet.toList)
    Assert.Empty(second.Backpressured |> GSet.toList)
    Assert.Equal<string list>([ "old" ], second.Heat.Forgotten |> GSet.toList)
    Assert.Equal(1, second.Heat.Units)

    let signatures = RA.heatSignatures "chip9-room" second

    Assert.Single(signatures) |> ignore
    Assert.Equal("room-admission.forgotten", signatures.[0].Kind)
    Assert.Equal(1, signatures.[0].Units)

[<Fact>]
let ``admitWithHeat exports room backpressure through the injected sink`` () =
    let sink = RecordingHeatSink()
    let start = emptyModulo (rejectSlots 1)
    let first = RA.admitWithHeat (sink :> IHeatSink) "chip8-room" 0L "one" start |> mustOk
    let second = RA.admitWithHeat (sink :> IHeatSink) "chip8-room" 1L "two" first.After |> mustOk

    Assert.Equal(RA.SlotOutcome.Backpressured, second.Outcome)
    Assert.Equal(1, sink.Signatures.Count)
    Assert.Equal("room-admission.backpressure", sink.Signatures.[0].Kind)
    Assert.Equal(1, sink.Signatures.[0].Units)

[<Fact>]
let ``admitWithHeat preserves heat sink backpressure as typed feedback`` () =
    let sink =
        BoundedHeatSink
            { Capacity = 1
              ForgetPolicy = BoundedGSetForgetPolicy.RejectNew }

    let filler = HeatSignature.ofMass "test" "heat.fill" 1 1.0 "occupy bounded heat sink"
    (sink :> IHeatSink).Emit filler |> mustOk

    let start = emptyModulo (replaceSlots 1)
    let first = RA.admitWithSlot 0L "old" start |> mustOk

    match RA.admitWithHeat (sink :> IHeatSink) "chip8-room" 1L "new" first.After with
    | Error(RA.Feedback.HeatFeedback(HeatSinkFeedback.Backpressure(heat, capacity, count))) ->
        Assert.Equal("room-admission.forgotten", heat.Kind)
        Assert.Equal(1, capacity)
        Assert.Equal(2, count)
    | other -> Assert.Fail(sprintf "expected heat sink backpressure, got %A" other)
