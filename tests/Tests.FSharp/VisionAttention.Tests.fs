module Zeta.Tests.VisionAttentionTests

open global.Xunit
open Zeta.Core

let private mustOk =
    function
    | Ok value -> value
    | Error feedback -> failwithf "expected Ok, got %A" feedback

let private attention weight bits : VisionAttention.Attention =
    { Weight = weight
      ResolutionBits = bits }

let private memory strands word bytes pureBytes : VisionAttention.MemoryBraid =
    { Strands = strands
      Word = word
      BytesPerCrossing = bytes
      PureKernelBytes = pureBytes }

let private proposal label state baseBytes attention memory : VisionAttention.Proposal<int> =
    { Label = label
      State = state
      BaseSpaceBytes = baseBytes
      TimeTicks = 0
      BytesPerTick = 0L
      BaseUncertaintyResolutionBits = 0
      Attention = attention
      Memory = memory }

[<Fact>]
let ``memory braid gravity prices dense pure-kernel memory`` () =
    let densePure = memory 2 [ 1; 1 ] 3L 11L
    let sparseVisible = memory 5 [ 1; 3 ] 3L 11L

    let denseBytes = VisionAttention.memoryGravityBytes densePure |> mustOk
    let sparseBytes = VisionAttention.memoryGravityBytes sparseVisible |> mustOk

    Assert.Equal(23L, denseBytes)
    Assert.Equal(6L, sparseBytes)
    Assert.True(denseBytes > sparseBytes)

[<Fact>]
let ``attention rank decides which self-future boards first while byte cost stays honest`` () =
    let highGravity = Some(memory 2 [ 1; 1 ] 2L 4L)
    let highAttention = proposal "high-attention-memory" 1 4L (attention 10.0 8) highGravity
    let lowAttention = proposal "low-attention-flat" 2 5L (attention 1.0 8) None

    let report =
        VisionAttention.predict [ lowAttention; highAttention ] (SoftThrottle.tank 18.0 0.0)
        |> mustOk

    Assert.Equal(Vision.PartiallyAdmitted, report.Outcome)
    Assert.Equal<string list>([ "high-attention-memory" ], report.Boarded |> List.map _.Label)
    Assert.Equal<string list>([ "low-attention-flat" ], report.Deferred |> List.map _.Label)
    Assert.Equal(17L, report.BoardedBytes)
    Assert.Equal(6L, report.DeferredBytes)
