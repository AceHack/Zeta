module Zeta.Tests.RenderedSignalTests

open System
open Xunit
open Zeta.Core
open Zeta.Research

let private require = function Ok value -> value | Error reason -> failwith reason
let private frame coordinates : GameEnvironment.Frame =
    let cells = Array.zeroCreate<byte> 2048
    for x, y in coordinates do cells.[y * 64 + x] <- 1uy
    { W = 64; H = 32; Palette = 2; Cells = cells }
let private render renderer tokens =
    let rom = RenderedSignalCarrier.compile renderer tokens |> require
    RenderedSignalCarrier.renderRom renderer tokens.Length rom ignore |> require

[<Theory>]
[<InlineData("train-dot")>]
[<InlineData("heldout-bar")>]
[<InlineData("nuisance")>]
let ``RenderedSignal source-owned emulator and rendered extraction agree on a hand fixture`` name =
    let renderer = RenderedSignalCarrier.renderer name |> require
    let tokens = [|0;0;1;0;1;1|]
    let decoded, diagnostics = render renderer tokens
    Assert.Equal<int>(tokens, decoded)
    Assert.Equal(tokens.Length - 1, diagnostics.Comparisons)
    Assert.Equal((if name = "nuisance" then 5 else 0), diagnostics.StructureChanges)
    Assert.Equal((if name = "nuisance" then 5 else 0), diagnostics.PaletteChanges)

[<Fact>]
let ``RenderedSignal maximum nuisance ROM stays inside memory and parks correctly`` () =
    let tokens = Array.init 256 (fun i -> i % 2)
    let rom = RenderedSignalCarrier.compile RenderedSignalCarrier.Nuisance tokens |> require
    Assert.Equal(3078, rom.Length)
    let jumpIndex = 4 + 256 * 12 - 2
    let jump = (int rom.[jumpIndex] <<< 8) ||| int rom.[jumpIndex + 1]
    Assert.Equal(0x1000 ||| (0x200 + jumpIndex), jump)
    Assert.Equal<int>(tokens, render RenderedSignalCarrier.Nuisance tokens |> fst)

[<Fact>]
let ``RenderedSignal refuses ROM opcode sprite shape and budget mutations`` () =
    let tokens = [|0;1;0|]
    let rom = RenderedSignalCarrier.compile RenderedSignalCarrier.TrainDot tokens |> require
    for index in [0;2;4;6;8;10;rom.Length - 1] do
        let changed = Array.copy rom
        changed.[index] <- changed.[index] ^^^ 1uy
        Assert.True(RenderedSignalCarrier.renderRom RenderedSignalCarrier.TrainDot tokens.Length changed ignore |> Result.isError)
    Assert.True(RenderedSignalCarrier.compile RenderedSignalCarrier.Nuisance (Array.zeroCreate 257) |> Result.isError)
    Assert.True(RenderedSignalCarrier.validateRom RenderedSignalCarrier.TrainDot 3 (Array.zeroCreate 4096) |> Result.isError)
    Assert.True(RenderedSignalCarrier.compile RenderedSignalCarrier.TrainDot [|0;2|] |> Result.isError)

[<Fact>]
let ``RenderedSignal refuses absent multiple and cross-midline beacons and malformed frames`` () =
    for input in [frame [];frame [1,1;4,4];frame [31,1;32,1];{frame [1,1] with Cells = [|1uy|]};{frame [1,1] with Palette = 3};{frame [1,1] with W = 32}] do
        Assert.True(RenderedSignalCarrier.decode input |> Result.isError)
    let invalid = frame [1,1]
    invalid.Cells.[0] <- 2uy
    Assert.True(RenderedSignalCarrier.decode invalid |> Result.isError)

[<Fact>]
let ``RenderedSignal palette complementation preserves observation`` () =
    let original = frame [47,20;48,20;49,20]
    let inverse = {original with Cells = original.Cells |> Array.map (fun cell -> 1uy - cell)}
    Assert.Equal(Ok 1, RenderedSignalCarrier.decode original)
    Assert.Equal(RenderedSignalCarrier.decode original, RenderedSignalCarrier.decode inverse)

[<Fact>]
let ``RenderedSignal future ROM frame cannot affect earlier rendered predictions`` () =
    let initial = SmallRnn.create 2 8 911UL |> require
    let read tokens =
        let history = ResizeArray<int>()
        let probabilities = ResizeArray<float>()
        let rom = RenderedSignalCarrier.compile RenderedSignalCarrier.Nuisance tokens |> require
        RenderedSignalCarrier.renderRom RenderedSignalCarrier.Nuisance tokens.Length rom (fun input ->
            history.Add(RenderedSignalCarrier.decode input |> require)
            probabilities.Add(RenderedSignalPrediction.predict (RenderedSignalPrediction.Network initial) (history.ToArray()) |> require)) |> require |> ignore
        probabilities.ToArray()
    let first = read [|0;1;0;0;1;0|]
    let changed = read [|0;1;0;0;1;1|]
    Assert.Equal<float>(first.[..4], changed.[..4])

[<Fact>]
let ``RenderedSignal chronological lag-two witness cannot be replaced by a symbol bag`` () =
    let a = [|0;0;1|]
    let b = [|0;1;0|]
    Assert.Equal<int>(Array.sort a, Array.sort b)
    Assert.Equal(Ok 0.25, RenderedSignalPrediction.predict RenderedSignalPrediction.Known a)
    Assert.Equal(Ok 0.75, RenderedSignalPrediction.predict RenderedSignalPrediction.Known b)

[<Fact>]
let ``RenderedSignal count fitting uses targets once and declares order-two backoff`` () =
    let counts = RenderedSignalPrediction.fitCounts [|[|0;1;0;1|]|] |> require
    Assert.Equal<float>([|2.0/5.0;3.0/5.0|], counts.Unigram)
    Assert.Equal<float>([|1.0/4.0;3.0/4.0|], counts.Bigram.[0])
    Assert.Equal<float>([|2.0/3.0;1.0/3.0|], counts.OrderTwo.[0].[1])
    Assert.Equal(Ok(3.0/5.0), RenderedSignalPrediction.predict (RenderedSignalPrediction.OrderTwo counts) [||])
    Assert.Equal(Ok(3.0/4.0), RenderedSignalPrediction.predict (RenderedSignalPrediction.OrderTwo counts) [|0|])

[<Fact>]
let ``RenderedSignal invalid probability mass is refused without clipping`` () =
    for values in [[|0.0;1.0|];[|Double.NaN;0.5|];[|0.3;0.3|];[|-0.1;1.1|];[|0.5|];null] do
        Assert.True(RenderedSignalPrediction.validateDistribution values |> Result.isError)
    Assert.True(RenderedSignalPrediction.predict (RenderedSignalPrediction.Unigram [|0.2;0.2|]) [|0|] |> Result.isError)
    Assert.True(RenderedSignalPrediction.predict RenderedSignalPrediction.Known [|2|] |> Result.isError)

[<Fact>]
let ``RenderedSignal full sequence detector retains pre-change denominator evidence`` () =
    let tokens = Array.zeroCreate<int> 20
    let known = RenderedSignalDetection.trace RenderedSignalPrediction.Known tokens |> require
    Assert.All(known.LogRatios, fun ratio -> Assert.InRange(abs ratio, 0.0, 1e-12))
    let iid = RenderedSignalDetection.trace RenderedSignalPrediction.Fair tokens |> require
    Assert.InRange(abs (iid.FinalLogRatio - 18.0 * log 1.5), 0.0, 1e-12)
    let parameters = Array.zeroCreate<float> 106
    parameters.[105] <- 1.0
    let network = SmallRnn.fromParameters 2 8 parameters |> require
    let learned = RenderedSignalDetection.trace (RenderedSignalPrediction.Network network) tokens |> require
    let p0 = 1.0 / (1.0 + exp 1.0)
    let expected = 2.0 * log 0.5 + 18.0 * log 0.75 - (log 0.5 + 19.0 * log p0)
    Assert.InRange(abs (learned.FinalLogRatio - expected), 0.0, 1e-12)

[<Fact>]
let ``RenderedSignal model roster refuses missing and unknown seeds`` () =
    Assert.True(RenderedSignalExperiment.validateModels [||] |> Result.isError)
    let model: RenderedSignalPrediction.ModelReceipt =
        { Seed = 999; Hidden = 8; Status = "complete"; Failure = ""; InitialParameters = [||]; Parameters = [||]
          InitialSha256 = ""; TrainedSha256 = ""; TrainingTrace = [||]; TrainedTokens = 524288L }
    Assert.True(RenderedSignalExperiment.validateModels [|model;model;model|] |> Result.isError)
    let counts = RenderedSignalPrediction.fitCounts [|[|0;1;0|]|] |> require
    Assert.True(RenderedSignalPrediction.candidates counts [|model|] |> Result.isError)
