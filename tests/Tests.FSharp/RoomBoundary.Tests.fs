module Zeta.Tests.RoomBoundaryTests

open global.Xunit
open Zeta.Core

module RB = RoomBoundary
module RA = RoomAdmission

let private mustOk =
    function
    | Ok value -> value
    | Error feedback -> failwithf "expected Ok, got %A" feedback

let private rejectSlots slots : ModuloGSetConfig =
    ModuloGSetConfig.rejectCollision slots

let private replaceSlots slots : ModuloGSetConfig =
    ModuloGSetConfig.replaceExisting slots

/// Budget is EARNED, not passed in: a peer attests value to `source` (who also OWNS the
/// boundary here), and `RB.create` reads the resulting balance out of the book.
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
    |> RB.create (ledgerCrediting source budget) source source room

let private sampleVault () =
    let v =
        DoorGraph.empty
        |> DoorGraph.addRoom "arcade"
        |> DoorGraph.addRoom "glass"

    DoorGraph.addDoor (DoorGraph.door "arcade" "glass" "door-key") v |> mustOk

[<Fact>]
let ``admission collision stays no-forget and emits room backpressure heat`` () =
    let sink = RecordingHeatSink()
    let start = emptyBoundary "experience-room" "arcade" 10 (rejectSlots 1)

    let first, firstReport =
        RB.admitWithSlot (sink :> IHeatSink) 0L "alpha" start |> mustOk

    let second, secondReport =
        RB.admitWithSlot (sink :> IHeatSink) 1L "beta" first |> mustOk

    Assert.Equal(RA.SlotOutcome.Admitted, firstReport.Outcome)
    Assert.Equal(RA.SlotOutcome.Backpressured, secondReport.Outcome)
    Assert.Equal<string list>([ "alpha" ], second.Occupants |> ModuloGSet.toList)
    Assert.Equal<string list>([ "beta" ], secondReport.Backpressured |> GSet.toList)
    Assert.Equal(1, sink.Signatures.Count)
    Assert.Equal("room-admission.backpressure", sink.Signatures.[0].Kind)

[<Fact>]
let ``admission replacement exports forgotten occupant heat`` () =
    let sink = RecordingHeatSink()
    let start = emptyBoundary "experience-room" "arcade" 10 (replaceSlots 1)

    let first, _ =
        RB.admitWithSlot (sink :> IHeatSink) 0L "old" start |> mustOk

    let second, report =
        RB.admitWithSlot (sink :> IHeatSink) 1L "new" first |> mustOk

    Assert.Equal(RA.SlotOutcome.Replaced, report.Outcome)
    Assert.Equal<string list>([ "new" ], second.Occupants |> ModuloGSet.toList)
    Assert.Equal<string list>([ "old" ], report.Heat.Forgotten |> GSet.toList)
    Assert.Equal(1, sink.Signatures.Count)
    Assert.Equal("room-admission.forgotten", sink.Signatures.[0].Kind)

[<Fact>]
let ``frost spends privacy budget and observe hides content`` () =
    let sink = RecordingHeatSink()
    let start = emptyBoundary "experience-room" "arcade" 7 (rejectSlots 2)

    let frosted = RB.frost (sink :> IHeatSink) 5 start |> mustOk

    Assert.Equal(2, frosted.PrivacyBudget)
    Assert.False(GlassHalo.isVisible frosted.Visibility)
    Assert.Equal("private", RB.observe "private" "payload" frosted)
    // The OWNER may defrost; `RB.clear` is now owner-gated and returns a Result.
    Assert.Equal(
        "payload",
        RB.clear (sink :> IHeatSink) "experience-room" frosted
        |> mustOk
        |> RB.observe "private" "payload"
    )
    Assert.Empty(sink.Signatures)

[<Fact>]
let ``insufficient privacy budget is typed and emits refusal heat`` () =
    let sink = RecordingHeatSink()
    let start = emptyBoundary "experience-room" "arcade" 2 (rejectSlots 2)

    match RB.frost (sink :> IHeatSink) 5 start with
    | Error(RB.Feedback.PrivacyDenied reason) ->
        Assert.Contains("insufficient privacy budget", reason)
        Assert.Equal(1, sink.Signatures.Count)
        Assert.Equal("room-boundary.privacy-backpressure", sink.Signatures.[0].Kind)
    | other -> Assert.Fail(sprintf "expected privacy denial, got %A" other)

[<Fact>]
let ``door traversal denial is typed and emits refusal heat`` () =
    let sink = RecordingHeatSink()
    let boundary = emptyBoundary "experience-room" "arcade" 10 (rejectSlots 2)
    let vault = sampleVault ()

    match RB.traverse (sink :> IHeatSink) Set.empty "glass" vault boundary with
    | Error(RB.Feedback.DoorDenied(fromRoom, toRoom, reason)) ->
        Assert.Equal("arcade", fromRoom)
        Assert.Equal("glass", toRoom)
        Assert.Contains("permission denied", reason)
        Assert.Equal(1, sink.Signatures.Count)
        Assert.Equal("room-boundary.door-denied", sink.Signatures.[0].Kind)
    | other -> Assert.Fail(sprintf "expected door denial, got %A" other)

[<Fact>]
let ``door traversal with key moves the boundary room without heat`` () =
    let sink = RecordingHeatSink()
    let boundary = emptyBoundary "experience-room" "arcade" 10 (rejectSlots 2)
    let vault = sampleVault ()

    let next =
        RB.traverse (sink :> IHeatSink) (Set.ofList [ "door-key" ]) "glass" vault boundary
        |> mustOk

    Assert.Equal("glass", next.CurrentRoom)
    Assert.Empty(sink.Signatures)

[<Fact>]
let ``refusal heat sink backpressure is typed`` () =
    let sink =
        BoundedHeatSink(BoundedGSetConfig.noForgetBackpressure 1)

    let filler = HeatSignature.ofMass "test" "heat.fill" 1 1.0 "occupy bounded heat sink"
    (sink :> IHeatSink).Emit filler |> mustOk

    let start = emptyBoundary "experience-room" "arcade" 2 (rejectSlots 2)

    match RB.frost (sink :> IHeatSink) 5 start with
    | Error(RB.Feedback.HeatFeedback(HeatSinkFeedback.Backpressure(heat, capacity, count))) ->
        Assert.Equal("room-boundary.privacy-backpressure", heat.Kind)
        Assert.Equal(1, capacity)
        Assert.Equal(2, count)
    | other -> Assert.Fail(sprintf "expected heat feedback, got %A" other)
