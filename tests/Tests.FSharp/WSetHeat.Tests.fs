module Zeta.Tests.WSetHeatTests

open System
open Xunit
open Zeta.Core
open Zeta.Core.Abstractions

let private intStar: IStarRing<int64> =
    { new IStarRing<int64> with
        member _.Zero = 0L
        member _.One = 1L
        member _.Add(a, b) = a + b
        member _.Mul(a, b) = a * b
        member _.Negate a = -a
        member _.Conj a = a }

let private isZero (value: int64) = value = 0L

let private assertForgotten expectedMassPpm (result: WSetHeat.Metered<'T>) =
    match result.Heat with
    | None -> Assert.Fail "erasing operation must carry a heat signature"
    | Some heat ->
        Assert.Equal(expectedMassPpm, heat.MassPpm)
        Assert.Equal(1, heat.Units)
        Assert.Equal("forgotten", HeatSignal.tokenOfSignature heat)
        Assert.Contains("finite-reference-domain", heat.Detail, StringComparison.Ordinal)
        Assert.Contains("not-per-input-physical-cost", heat.Detail, StringComparison.Ordinal)

[<Fact>]
let ``reversible WSet adapters preserve values and stay cold`` () =
    let input = [ 0, 1L; 1, -1L ]
    let recorder = RecordingHeatSink()

    let negate = WSetHeat.negate "wset-room" intStar input
    let copy = WSetHeat.copy "wset-room" input
    let mapped = WSetHeat.mapKeysInjective "wset-room" ((+) 10) input
    let applied = WSetHeat.applyInjective "wset-room" intStar (fun key -> [ key + 10, 1L ]) input

    Assert.Equal<(int * int64) list>([ 0, -1L; 1, 1L ], negate.Value)
    Assert.Equal<((int * int) * int64) list>([ (0, 0), 1L; (1, 1), -1L ], copy.Value)
    Assert.Equal<(int * int64) list>([ 10, 1L; 11, -1L ], mapped.Value)
    Assert.Equal<(int * int64) list>(mapped.Value, applied.Value)

    for heat in [ negate.Heat; copy.Heat; mapped.Heat; applied.Heat ] do
        Assert.True(Option.isNone heat)

    match WSetHeat.emit (recorder :> IHeatSink) negate with
    | Error feedback -> Assert.Fail($"unexpected heat feedback: {feedback}")
    | Ok _ -> Assert.Empty recorder.Signatures

[<Fact>]
let ``erasing WSet adapters carry the measured finite-domain maxima`` () =
    let annihilating = [ 0, 1L; 0, -1L ]
    let singleton = [ 1, 1L ]

    WSetHeat.consolidate "wset-room" intStar isZero annihilating
    |> assertForgotten 3_459_432L

    WSetHeat.discard "wset-room" intStar annihilating
    |> assertForgotten 3_906_891L

    WSetHeat.bornProb "wset-room" (fun (weight: int64) -> float weight * float weight) annihilating
    |> assertForgotten 2_807_355L

    WSetHeat.plus "wset-room" annihilating singleton
    |> assertForgotten 1_584_963L

    WSetHeat.tensor "wset-room" intStar annihilating singleton
    |> assertForgotten 6_409_391L

[<Fact>]
let ``WSet heat emission uses the injected sink and preserves typed backpressure`` () =
    let sink = BoundedHeatSink(BoundedGSetConfig.noForgetBackpressure 1)
    let port = sink :> IHeatSink

    let first = WSetHeat.consolidate "room-a" intStar isZero [ 0, 1L; 0, -1L ]
    let second = WSetHeat.discard "room-b" intStar [ 1, 1L ]

    match WSetHeat.emit port first with
    | Error feedback -> Assert.Fail($"unexpected first heat feedback: {feedback}")
    | Ok result -> Assert.Equal(first, result)

    match WSetHeat.emit port second with
    | Ok _ -> Assert.Fail "the bounded sink must backpressure rather than erase heat"
    | Error(HeatSinkFeedback.Backpressure(heat, capacity, count)) ->
        Assert.Equal("room-b", heat.Source)
        Assert.Equal(1, capacity)
        Assert.Equal(2, count)
    | Error feedback -> Assert.Fail($"unexpected heat feedback: {feedback}")
