module Zeta.Bayesian.Tests.VisionAttentionBudgetTests

open global.Xunit
open Zeta.Bayesian
open Zeta.Core

let private mustOk =
    function
    | Ok value -> value
    | Error feedback -> failwithf "expected Ok, got %A" feedback

let private proposal label weight : VisionAttention.Proposal<string> =
    { Label = label
      State = label
      BaseSpaceBytes = 9L
      TimeTicks = 0
      BytesPerTick = 0L
      BaseUncertaintyResolutionBits = 0
      Attention =
        { Weight = weight
          ResolutionBits = 8 }
      Memory = None }

[<Fact>]
let ``Bayesian evidence weights Vision self-budget ordering`` () =
    let prior = Beta.create 1.0 1.0
    let posterior = Beta.product prior (Beta.likelihood 9.0 1.0)

    let priorBranch = proposal "prior-flat" (Beta.mean prior)
    let posteriorBranch = proposal "posterior-evidence" (Beta.mean posterior)

    let report =
        VisionAttention.predict [ priorBranch; posteriorBranch ] (SoftThrottle.tank 10.0 0.0)
        |> mustOk

    Assert.True(Beta.mean posterior > Beta.mean prior)
    Assert.Equal<string list>([ "posterior-evidence" ], report.Boarded |> List.map _.Label)
    Assert.Equal<string list>([ "prior-flat" ], report.Deferred |> List.map _.Label)
