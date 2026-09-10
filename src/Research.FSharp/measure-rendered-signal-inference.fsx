#r "../Core.Abstractions/bin/Release/net10.0/Zeta.Core.Abstractions.dll"
#r "../Core/bin/Release/net10.0/Zeta.Core.dll"
#load "ResearchRandom.fs"
#load "SmallRnn.fs"
#load "SmallRnnTraining.fs"
#load "RenderedSignalCarrier.fs"
#load "RenderedSignalPrediction.fs"
#load "RenderedSignalDetection.fs"
#load "RenderedSignalExperiment.fs"
#load "RenderedSignalRuntime.fsx"

open System
open System.IO
open System.Runtime.InteropServices
open System.Text.Json
open Zeta.Research

let require = function Ok value -> value | Error reason -> eprintfn "%s" reason; exit 1
let input, output = match fsi.CommandLineArgs |> Array.skip 1 with [| input; output |] -> input, output | _ -> eprintfn "usage: measure-rendered-signal-inference.fsx MODELS.json OUTPUT.json"; exit 2
if File.Exists output || File.Exists(output + ".partial") then eprintfn "refusing existing output %s" output; exit 2
let root = Path.GetFullPath(Path.Combine(__SOURCE_DIRECTORY__, "../.."))
let hashes = RenderedSignalExperiment.sourceHashes root
let commit = RenderedSignalExperiment.sourceCommit root |> require
let assemblies = RenderedSignalRuntime.loadedAssemblies () |> require
let raw = File.ReadAllBytes input
let document = JsonDocument.Parse raw
let receipt = document.RootElement
if not (receipt.GetProperty("Complete").GetBoolean()) || receipt.GetProperty("Protocol").GetString() <> "rendered-signal-predictor-v1" then
    eprintfn "requires complete registered predictor receipt"; exit 2
let models = JsonSerializer.Deserialize<RenderedSignalPrediction.ModelReceipt[]>(receipt.GetProperty("Models").GetRawText())
RenderedSignalExperiment.validateModels models |> require
let counts = JsonSerializer.Deserialize<RenderedSignalPrediction.Counts>(receipt.GetProperty("Counts").GetRawText())
let inputHashes = JsonSerializer.Deserialize<RenderedSignalExperiment.SourceHash[]>(receipt.GetProperty("SourceHashes").GetRawText())
if inputHashes <> hashes then eprintfn "input source fingerprints disagree with the measured source"; exit 2
let inputAssemblies = JsonSerializer.Deserialize<RenderedSignalRuntime.LoadedAssembly[]>(receipt.GetProperty("LoadedAssemblies").GetRawText())
if inputAssemblies <> assemblies then eprintfn "loaded assemblies changed since prediction measurement"; exit 2
let candidates = RenderedSignalPrediction.candidates counts models |> require |> RenderedSignalExperiment.benchmarkOrder
let panel = RenderedSignalCarrier.corpus RenderedSignalCarrier.TrainDot 256 64 3001UL 301 0.75 128 0 |> require
type Row =
    { Name: string; Seed: int; Path: string; Repetition: int; Calls: int; WarmupCalls: int; Checksum: float
      ParameterBytes: int; PredictorStateBytes: int; Resource: RenderedSignalCarrier.Resource }
let rows = ResizeArray<Row>()
let run (candidate: RenderedSignalPrediction.Candidate) path (context: int[]) =
    if path = "tokens" then RenderedSignalPrediction.predict candidate.Predictor context |> require
    else
        let rom = RenderedSignalCarrier.compile RenderedSignalCarrier.TrainDot context |> require
        let decoded, _ = RenderedSignalCarrier.renderRom RenderedSignalCarrier.TrainDot context.Length rom ignore |> require
        if decoded <> context then eprintfn "end-to-end extraction conformance failed"; exit 1
        RenderedSignalPrediction.predict candidate.Predictor decoded |> require
let save complete =
    let result =
        {| Protocol = "rendered-signal-inference-v1"; Complete = complete; SourceCommit = commit; SourceHashes = hashes; LoadedAssemblies = assemblies
           InputFile = Path.GetFileName input; InputSha256 = RenderedSignalCarrier.sha256 raw; Runtime = RuntimeInformation.FrameworkDescription
           OperatingSystem = RuntimeInformation.OSDescription; HostActivity = "ordinary host applications may remain; own builds/tests/training must be idle"
           Config = {| Seed = 3001; Domain = 301; Contexts = 256; ContextLength = 64; Renderer = "train-dot"; Repetitions = 5
                       TokenCalls = 4096; TokenWarmups = 256; EndToEndCalls = 256; EndToEndWarmups = 16; Rotation = "left-by-repetition" |}
           Corpus = {| Fingerprints = panel.Fingerprints; Diagnostics = panel.Diagnostics; Generation = panel.Generation; Extraction = panel.Extraction |}
           PipelinePayload = {| CurrentPreviousFrameCellBytes = 4096; EmulatorMemoryBytes = 4096; EmulatorDisplayLogicalBooleans = 2048
                                RomBytes = 517; Scope = "partial array ledger; excludes registers, stack, keys and metadata; managed heap and peak RSS not measured" |}
           Rows = rows.ToArray() |}
    File.WriteAllText(output + ".partial", JsonSerializer.Serialize(result, JsonSerializerOptions(WriteIndented = true)) + "\n")
    File.Move(output + ".partial", output, true)
for path, warmups, calls in ["tokens",256,4096; "end-to-end",16,256] do
    for repetition in 0 .. 4 do
        for index in 0 .. candidates.Length - 1 do
            let candidate = candidates.[(index + repetition) % candidates.Length]
            for call in 0 .. warmups - 1 do run candidate path panel.Tokens.[call % 256] |> ignore
            let checksum, resource = RenderedSignalCarrier.measure (fun () ->
                let mutable sum = 0.0
                for call in 0 .. calls - 1 do sum <- sum + run candidate path panel.Tokens.[call % 256]
                sum)
            let parameters, state = RenderedSignalPrediction.payload candidate
            rows.Add { Name = candidate.Name; Seed = candidate.Seed; Path = path; Repetition = repetition; Calls = calls; WarmupCalls = warmups
                       Checksum = checksum; ParameterBytes = parameters; PredictorStateBytes = state; Resource = resource }
        save false
save true
