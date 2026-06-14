module Zeta.Tests.PredictionInferenceTests

open global.Xunit
open Zeta.Core

module PI = PredictionInference
module PS = ProbabilitySemiring

let private mustOk =
    function
    | Ok value -> value
    | Error feedback -> failwithf "expected Ok, got %A" feedback

let private cost bytes : Vision.BranchCost =
    { SpaceBytes = bytes
      TimeTicks = 0
      BytesPerTick = 0L
      UncertaintyResolutionBits = 0 }

let private candidate label state prior likelihood bytes : PI.Candidate<string> =
    { Label = label
      State = state
      Prior = prior
      Likelihood = likelihood
      Cost = cost bytes }

[<Fact>]
let ``exact prediction inference ranks candidates before Vision budgets the branch list`` () =
    let a = candidate "low" "A" (PS.rat 1L 2L) (PS.rat 1L 3L) 6L
    let b = candidate "high" "B" (PS.rat 1L 2L) (PS.rat 2L 3L) 7L

    let prediction =
        [ a; b ]
        |> PI.inferAndPredict (SoftThrottle.tank 7.0 0.0)
        |> mustOk

    Assert.Equal("high", prediction.Inference.Best.Candidate.Label)
    Assert.Equal(Vision.PartiallyAdmitted, prediction.Budget.Outcome)
    Assert.Equal<string list>([ "high" ], prediction.Budget.Boarded |> List.map _.Label)
    Assert.Equal<string list>([ "low" ], prediction.Budget.Deferred |> List.map _.Label)

[<Fact>]
let ``budget backpressure does not rewrite posterior truth`` () =
    let a = candidate "low" "A" (PS.rat 1L 2L) (PS.rat 1L 3L) 6L
    let b = candidate "high" "B" (PS.rat 1L 2L) (PS.rat 2L 3L) 7L

    let prediction =
        [ a; b ]
        |> PI.inferAndPredict (SoftThrottle.tank 0.0 0.0)
        |> mustOk

    Assert.Equal("high", prediction.Inference.Best.Candidate.Label)
    Assert.Equal(Vision.RejectedWithBackpressure, prediction.Budget.Outcome)
    Assert.Empty prediction.Budget.Boarded
    Assert.Equal<string list>([ "high"; "low" ], prediction.Budget.Deferred |> List.map _.Label)

[<Fact>]
let ``exact prediction inference can project to a soft DynamicValue distribution`` () =
    let a = candidate "low" "A" (PS.rat 1L 2L) (PS.rat 1L 3L) 1L
    let b = candidate "high" "B" (PS.rat 1L 2L) (PS.rat 2L 3L) 1L

    let inference = PI.infer [ a; b ] |> mustOk
    let soft =
        inference
        |> PI.toSoftValue (fun s -> DynamicValue.String s)
        |> mustOk

    Assert.Equal(2, SoftValue.candidates soft |> List.length)
    Assert.Equal(Some(DynamicValue.String "B"), SoftValue.resolve 0.6 soft)

[<Fact>]
let ``all-refuted candidates return feedback instead of fabricating certainty`` () =
    let a = candidate "a" "A" PS.one PS.zero 1L
    let b = candidate "b" "B" PS.one PS.zero 1L

    match PI.infer [ a; b ] with
    | Error PI.AllCandidatesRefuted -> ()
    | other -> Assert.Fail(sprintf "expected AllCandidatesRefuted, got %A" other)
