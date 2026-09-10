#r "../Core.Abstractions/bin/Release/net10.0/Zeta.Core.Abstractions.dll"
#r "../Core/bin/Release/net10.0/Zeta.Core.dll"
#load "ResearchRandom.fs"
#load "SmallRnn.fs"
#load "SmallRnnTraining.fs"
#load "RenderedSignalCarrier.fs"
#load "RenderedSignalPrediction.fs"
#load "RenderedSignalDetection.fs"
#load "RenderedSignalRuntime.fsx"

open System
open System.Security.Cryptography
open System.Text.Json
open Zeta.Research

let require = function Ok value -> value | Error reason -> eprintfn "%s" reason; exit 1
let tokens = [|0;0;1;0;1|]
let carrier renderer =
    let rom = RenderedSignalCarrier.compile renderer tokens |> require
    use frames = IncrementalHash.CreateHash HashAlgorithmName.SHA256
    let decoded, diagnostics = RenderedSignalCarrier.renderRom renderer tokens.Length rom (fun frame -> frames.AppendData frame.Cells) |> require
    {| Renderer = RenderedSignalCarrier.name renderer; RomSha256 = RenderedSignalCarrier.sha256 rom
       FrameSha256 = frames.GetHashAndReset() |> Convert.ToHexString; Tokens = decoded; Diagnostics = diagnostics |}
let rows = [|[|0;0;1;0|];[|0;1;0;1|];[|1;1;0;0|];[|1;0;1;1|]|]
let renderedRows = rows |> Array.map (fun row ->
    let rom = RenderedSignalCarrier.compile RenderedSignalCarrier.TrainDot row |> require
    RenderedSignalCarrier.renderRom RenderedSignalCarrier.TrainDot row.Length rom ignore |> require |> fst)
let counts = RenderedSignalPrediction.fitCounts renderedRows |> require
let network = SmallRnn.create 2 8 (ResearchRandom.domain 41UL 1) |> require
let predictors =
    [| "known", RenderedSignalPrediction.Known; "order-two", RenderedSignalPrediction.OrderTwo counts
       "fair", RenderedSignalPrediction.Fair; "untrained-rnn", RenderedSignalPrediction.Network network |]
let predictions =
    [|[|0;0;1|];[|0;1;0|]|] |> Array.map (fun context ->
        {| Context = context; Arms = predictors |> Array.map (fun (name, predictor) -> {| Name = name; P1 = RenderedSignalPrediction.predict predictor context |> require |}) |})
let detection =
    [|Array.zeroCreate<int> 16; Array.init 16 (fun index -> index % 2)|] |> Array.map (fun sequence ->
        {| Tokens = sequence; Arms = predictors |> Array.map (fun (name, predictor) ->
               let trace = RenderedSignalDetection.trace predictor sequence |> require
               {| Name = name; FirstCrossing = trace.FirstCrossing; FinalLogRatio = trace.FinalLogRatio; LogRatios = trace.LogRatios |}) |})
let result =
    {| Protocol = "rendered-signal-kernel-v1"; LoadedAssemblies = RenderedSignalRuntime.loadedAssemblies () |> require
       Tokens = tokens; TrainingRows = rows; Counts = counts
       Parameters = SmallRnn.parameters network; InitialSha256 = SmallRnn.parameters network |> RenderedSignalPrediction.parametersHash
       Carriers = [|RenderedSignalCarrier.TrainDot;RenderedSignalCarrier.HeldoutBar;RenderedSignalCarrier.Nuisance|] |> Array.map carrier
       Predictions = predictions; Detection = detection |}
printfn "%s" (JsonSerializer.Serialize(result, JsonSerializerOptions(WriteIndented = true)))
