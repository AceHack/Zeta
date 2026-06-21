module Zeta.Tests.RoomHorizonTests

open global.Xunit
open Zeta.Core

module PS = ProbabilitySemiring
module RH = RoomHorizon
module PI = PredictionInference

let private mustOk =
    function
    | Ok value -> value
    | Error feedback -> failwithf "expected Ok, got %A" feedback

let private config capacity retention =
    { Capacity = capacity
      ForgetPolicy = retention }

let private cost bytes : Vision.BranchCost =
    { SpaceBytes = bytes
      TimeTicks = 0
      BytesPerTick = 0L
      UncertaintyResolutionBits = 0 }

let private candidate key label state attention gravity bytes : RH.Candidate<int, string> =
    { Key = key
      Branch =
        { Label = label
          State = state
          Cost = cost bytes }
      Priority =
        { Attention = PS.rat attention 1L
          Gravity = PS.rat gravity 1L } }

let private inferredCandidate label state prior likelihood bytes : PI.Candidate<string> =
    { Label = label
      State = state
      Prior = PS.rat prior 1L
      Likelihood = PS.rat likelihood 1L
      Cost = cost bytes }

[<Fact>]
let ``attention and gravity change boarding order while byte cost stays honest`` () =
    let report =
        [ candidate 1 "likely" "A" 1L 1L 6L
          candidate 2 "attended" "B" 10L 2L 6L ]
        |> RH.admit (config 2 BoundedGSetForgetPolicy.ForgetLowest) (SoftThrottle.tank 6.0 0.0)
        |> mustOk

    Assert.Equal<string list>([ "attended"; "likely" ], report.Ordered |> List.map _.Branch.Label)
    Assert.Equal<string list>([ "attended" ], report.Boarded |> List.map _.Branch.Label)
    Assert.Equal<string list>([ "likely" ], report.Deferred |> List.map _.Branch.Label)
    Assert.Equal(Vision.PartiallyAdmitted, report.Prediction.Outcome)
    Assert.Equal(12L, report.Prediction.RequestedBytes)
    Assert.Equal(6L, report.Prediction.BoardedBytes)
    Assert.Equal(6L, report.Prediction.DeferredBytes)
    Assert.Equal<int list>([ 2 ], report.RetainedKeys |> GSet.toList)
    Assert.Equal<int list>([ 2 ], report.HorizonAfter |> BoundedGSet.toList)

[<Fact>]
let ``rolling horizon reports finite-view evictions separately from byte admission`` () =
    let current =
        BoundedGSet.ofSeq<int> (config 2 BoundedGSetForgetPolicy.ForgetLowest) [ 1; 2 ]
        |> mustOk
        |> fun projection -> projection.State

    let report =
        [ candidate 3 "newer" "C" 1L 1L 1L ]
        |> RH.update current (SoftThrottle.tank 1.0 0.0)
        |> mustOk

    Assert.Equal(Vision.Admitted, report.Prediction.Outcome)
    Assert.Equal<string list>([ "newer" ], report.Boarded |> List.map _.Branch.Label)
    Assert.Equal<int list>([ 2; 3 ], report.HorizonAfter |> BoundedGSet.toList)
    Assert.Equal<int list>([ 3 ], report.RetainedKeys |> GSet.toList)
    Assert.Equal<int list>([ 1 ], report.HorizonHeat.Forgotten |> GSet.toList)
    Assert.Equal(1, report.HorizonHeat.Units)
    Assert.Empty(report.RejectedByHorizon |> GSet.toList)

[<Fact>]
let ``paid branch can still be rejected by the finite horizon projection`` () =
    let current =
        BoundedGSet.ofSeq<int> (config 2 BoundedGSetForgetPolicy.ForgetLowest) [ 2; 3 ]
        |> mustOk
        |> fun projection -> projection.State

    let report =
        [ candidate 1 "older" "A" 1L 1L 1L ]
        |> RH.update current (SoftThrottle.tank 1.0 0.0)
        |> mustOk

    Assert.Equal(Vision.Admitted, report.Prediction.Outcome)
    Assert.Equal<string list>([ "older" ], report.Boarded |> List.map _.Branch.Label)
    Assert.Equal<int list>([ 2; 3 ], report.HorizonAfter |> BoundedGSet.toList)
    Assert.Empty(report.RetainedKeys |> GSet.toList)
    Assert.Equal<int list>([ 1 ], report.RejectedByHorizon |> GSet.toList)
    Assert.Empty(report.HorizonHeat.Forgotten |> GSet.toList)
    Assert.Equal(0, report.HorizonHeat.Units)

[<Fact>]
let ``rolling horizon exports forgetting as host heat`` () =
    let current =
        BoundedGSet.ofSeq<int> (config 2 BoundedGSetForgetPolicy.ForgetLowest) [ 1; 2 ]
        |> mustOk
        |> fun projection -> projection.State

    let report =
        [ candidate 3 "newer" "C" 1L 1L 1L ]
        |> RH.update current (SoftThrottle.tank 1.0 0.0)
        |> mustOk

    let signatures = RH.heatSignatures "vision-test" report

    Assert.Single(signatures) |> ignore
    Assert.Equal("vision-test", signatures.[0].Source)
    Assert.Equal("room-horizon.forgotten", signatures.[0].Kind)
    Assert.Equal(1, signatures.[0].Units)
    Assert.Equal(1_000_000L, signatures.[0].MassPpm)

    let sink = RecordingHeatSink()
    RH.emitHeat (sink :> IHeatSink) "vision-test" report |> mustOk

    Assert.Single(sink.Signatures) |> ignore
    Assert.Equal("room-horizon.forgotten", sink.Signatures.[0].Kind)

[<Fact>]
let ``updateWithHeat exports rolling horizon forgetting through injected host port`` () =
    let current =
        BoundedGSet.ofSeq<int> (config 2 BoundedGSetForgetPolicy.ForgetLowest) [ 1; 2 ]
        |> mustOk
        |> fun projection -> projection.State

    let sink = RecordingHeatSink()

    let report =
        [ candidate 3 "newer" "C" 1L 1L 1L ]
        |> RH.updateWithHeat (sink :> IHeatSink) "vision-test" current (SoftThrottle.tank 1.0 0.0)
        |> mustOk

    Assert.Equal<int list>([ 2; 3 ], report.HorizonAfter |> BoundedGSet.toList)
    Assert.Equal<int list>([ 1 ], report.HorizonHeat.Forgotten |> GSet.toList)
    Assert.Single(sink.Signatures) |> ignore
    Assert.Equal("room-horizon.forgotten", sink.Signatures.[0].Kind)

[<Fact>]
let ``rolling horizon preserves heat sink backpressure as typed feedback`` () =
    let current =
        BoundedGSet.ofSeq<int> (config 2 BoundedGSetForgetPolicy.ForgetLowest) [ 1; 2 ]
        |> mustOk
        |> fun projection -> projection.State

    let sink =
        BoundedHeatSink
            { Capacity = 1
              ForgetPolicy = BoundedGSetForgetPolicy.RejectNew }

    let filler = HeatSignature.ofMass "occupied" "heat.fill" 1 1.0 "pre-fill bounded heat sink"
    (sink :> IHeatSink).Emit filler |> mustOk

    match
        [ candidate 3 "newer" "C" 1L 1L 1L ]
        |> RH.updateWithHeat (sink :> IHeatSink) "vision-test" current (SoftThrottle.tank 1.0 0.0)
    with
    | Ok _ -> Assert.Fail("expected bounded heat sink backpressure")
    | Error(RH.HeatFeedback(HeatSinkFeedback.Backpressure(heat, capacity, count))) ->
        Assert.Equal("room-horizon.forgotten", heat.Kind)
        Assert.Equal(1, capacity)
        Assert.Equal(2, count)
    | Error feedback -> Assert.Fail(sprintf "unexpected heat sink feedback: %A" feedback)

[<Fact>]
let ``no-forget horizon exports paid finite-view rejection as backpressure heat`` () =
    let current =
        BoundedGSet.ofSeq<int> (config 1 BoundedGSetForgetPolicy.RejectNew) [ 1 ]
        |> mustOk
        |> fun projection -> projection.State

    let sink = RecordingHeatSink()

    let report =
        [ candidate 2 "second" "B" 1L 1L 1L ]
        |> RH.updateWithHeat (sink :> IHeatSink) "vision-test" current (SoftThrottle.tank 1.0 0.0)
        |> mustOk

    Assert.Equal<int list>([ 2 ], report.RejectedByHorizon |> GSet.toList)
    Assert.Equal(0, report.HorizonHeat.Units)

    let signatures = RH.heatSignatures "vision-test" report

    Assert.Single(signatures) |> ignore
    Assert.Equal("room-horizon.backpressure", signatures.[0].Kind)
    Assert.Equal(1, signatures.[0].Units)
    Assert.Single(sink.Signatures) |> ignore
    Assert.Equal("room-horizon.backpressure", sink.Signatures.[0].Kind)

[<Fact>]
let ``byte-deferred futures stay cold until they enter the room`` () =
    let report =
        [ candidate 1 "too-expensive" "A" 1L 1L 2L ]
        |> RH.admit (config 1 BoundedGSetForgetPolicy.RejectNew) (SoftThrottle.tank 1.0 0.0)
        |> mustOk

    Assert.Equal(Vision.RejectedWithBackpressure, report.Prediction.Outcome)
    Assert.Empty(report.Boarded)
    Assert.Empty(report.RejectedByHorizon |> GSet.toList)
    Assert.Empty(RH.heatSignatures "vision-test" report)

[<Fact>]
let ``negative attention is feedback not an ordering trick`` () =
    let bad =
        { candidate 1 "bad" "A" 1L 1L 1L with
            Priority =
                { Attention = PS.rat -1L 1L
                  Gravity = PS.one } }

    match RH.admit (config 2 BoundedGSetForgetPolicy.ForgetLowest) (SoftThrottle.tank 1.0 0.0) [ bad ] with
    | Error(RH.NegativeAttention("bad", value)) ->
        Assert.Equal(0, PS.compare value (PS.rat -1L 1L))
    | other -> Assert.Fail(sprintf "expected NegativeAttention feedback, got %A" other)

[<Fact>]
let ``inference projection keeps posterior truth separate from attended boarding`` () =
    let inference =
        [ inferredCandidate "likely" "A" 3L 1L 6L
          inferredCandidate "attended" "B" 1L 1L 6L ]
        |> PI.infer
        |> mustOk

    let keyOf (scored: PI.Scored<string>) =
        if scored.Candidate.Label = "attended" then 2 else 1

    let priorityOf (scored: PI.Scored<string>) =
        if scored.Candidate.Label = "attended" then
            { PI.neutralPriority with Attention = PS.rat 10L 1L }
        else
            PI.neutralPriority

    let report =
        inference
        |> RH.admitInference (config 2 BoundedGSetForgetPolicy.ForgetLowest) (SoftThrottle.tank 6.0 0.0) keyOf priorityOf
        |> mustOk

    Assert.Equal("likely", report.Inference.Best.Candidate.Label)
    Assert.Equal<string list>([ "attended"; "likely" ], report.Horizon.Ordered |> List.map _.Branch.Label)
    Assert.Equal<string list>([ "attended" ], report.Horizon.Boarded |> List.map _.Branch.Label)
    Assert.Equal<string list>([ "likely" ], report.Horizon.Deferred |> List.map _.Branch.Label)
    Assert.Equal<int list>([ 2 ], report.Horizon.RetainedKeys |> GSet.toList)
    Assert.Equal(Vision.PartiallyAdmitted, report.Horizon.Prediction.Outcome)

[<Fact>]
let ``inference projection reports finite horizon rejection after byte admission`` () =
    let current =
        BoundedGSet.ofSeq<int> (config 2 BoundedGSetForgetPolicy.ForgetLowest) [ 2; 3 ]
        |> mustOk
        |> fun projection -> projection.State

    let inference =
        [ inferredCandidate "older" "A" 1L 1L 1L ]
        |> PI.infer
        |> mustOk

    let report =
        inference
        |> RH.updateInference current (SoftThrottle.tank 1.0 0.0) (fun _ -> 1) (fun _ -> PI.neutralPriority)
        |> mustOk

    Assert.Equal(Vision.Admitted, report.Horizon.Prediction.Outcome)
    Assert.Equal<string list>([ "older" ], report.Horizon.Boarded |> List.map _.Branch.Label)
    Assert.Equal<int list>([ 2; 3 ], report.Horizon.HorizonAfter |> BoundedGSet.toList)
    Assert.Empty(report.Horizon.RetainedKeys |> GSet.toList)
    Assert.Equal<int list>([ 1 ], report.Horizon.RejectedByHorizon |> GSet.toList)

[<Fact>]
let ``admitInferenceWithHeat exports finite horizon pressure after exact inference`` () =
    let inference =
        [ inferredCandidate "first" "A" 1L 1L 1L
          inferredCandidate "second" "B" 1L 1L 1L ]
        |> PI.infer
        |> mustOk

    let keyOf (scored: PI.Scored<string>) =
        if scored.Candidate.Label = "first" then 1 else 2

    let sink = RecordingHeatSink()

    let report =
        RH.admitInferenceWithHeat
            (sink :> IHeatSink)
            "vision-test"
            (config 1 BoundedGSetForgetPolicy.RejectNew)
            (SoftThrottle.tank 2.0 0.0)
            keyOf
            (fun _ -> PI.neutralPriority)
            inference
        |> mustOk

    Assert.Equal<int list>([ 2 ], report.Horizon.RejectedByHorizon |> GSet.toList)
    Assert.Single(sink.Signatures) |> ignore
    Assert.Equal("room-horizon.backpressure", sink.Signatures.[0].Kind)
