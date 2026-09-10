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

let output = match fsi.CommandLineArgs |> Array.skip 1 with [| path |] -> path | _ -> eprintfn "usage: run-rendered-signal-experiment.fsx OUTPUT.json"; exit 2
if File.Exists output || File.Exists(output + ".partial") then eprintfn "refusing existing output %s" output; exit 2
let root = Path.GetFullPath(Path.Combine(__SOURCE_DIRECTORY__, "../.."))
let hashes = RenderedSignalExperiment.sourceHashes root
let commit = RenderedSignalExperiment.sourceCommit root |> Result.defaultWith (fun reason -> eprintfn "%s" reason; exit 1)
let assemblies = RenderedSignalRuntime.loadedAssemblies () |> Result.defaultWith (fun reason -> eprintfn "%s" reason; exit 1)
let models = ResizeArray<RenderedSignalPrediction.ModelReceipt>()
let fitting = ResizeArray<RenderedSignalExperiment.Fitting>()
let predictions = ResizeArray<RenderedSignalExperiment.PredictionPanel>()
let detections = ResizeArray<RenderedSignalExperiment.DetectionPanel>()
let mutable corpus: RenderedSignalCarrier.Corpus option = None
let mutable counts: RenderedSignalPrediction.Counts option = None
let config =
    {| Training = RenderedSignalExperiment.trainingConfig; CorpusSequences = 4096; CorpusLength = 33; CorpusSeed = 1009; CorpusDomain = 101; Passes = 4
       Alphabet = 2; Hidden = 8; ModelSeeds = RenderedSignalExperiment.modelSeeds; InitializationDomain = 1; AdamBeta1 = 0.9; AdamBeta2 = 0.999
       AdamEpsilon = 1e-8; GradientNormCap = 1.0; CountPseudocount = 1; PredictionExamples = 2048; PredictionSeed = 1009
       PredictionDomains = [|103;104;105;106;107;108|]; PredictionLengths = [|16;64;16;64;16;64|]; DetectionExamples = 2048
       DetectionLength = 256; DetectionSeed = 2003; DetectionDomains = [|201;202;203;204;205|]; ChangeStart = 128
       AlternativePositions = [|32;64;96;128|]; AlternativeProbabilities = [|0.5;0.25|]; DetectionThreshold = 20.0
       Renderers = [|"train-dot";"heldout-bar";"nuisance"|]; CalibrationBins = 10; ScoreTolerance = 1e-10; ParameterTolerance = 1e-8 |}
let save complete failure =
    let corpusReceipt = corpus |> Option.map (fun c -> {| Fingerprints = c.Fingerprints; Diagnostics = c.Diagnostics; Generation = c.Generation; Extraction = c.Extraction |})
    let result =
        {| Protocol = "rendered-signal-predictor-v1"; Complete = complete; Failure = failure; Config = config
           SourceCommit = commit; SourceHashes = hashes; LoadedAssemblies = assemblies; Runtime = RuntimeInformation.FrameworkDescription; OperatingSystem = RuntimeInformation.OSDescription
           ActionReturn = "not-measured-passive-carrier"; Corpus = corpusReceipt; Counts = counts; Models = models.ToArray()
           PredictionPanels = predictions.ToArray(); DetectionPanels = detections.ToArray(); Fitting = fitting.ToArray() |}
    File.WriteAllText(output + ".partial", JsonSerializer.Serialize(result, JsonSerializerOptions(WriteIndented = true)) + "\n")
    File.Move(output + ".partial", output, true)
let require = function Ok value -> value | Error reason -> save false reason; eprintfn "%s" reason; exit 1
eprintfn "rendering registered training corpus"
let training = RenderedSignalCarrier.corpus RenderedSignalCarrier.TrainDot 4096 33 1009UL 101 0.75 128 0 |> require
corpus <- Some training
let fittedCounts = RenderedSignalPrediction.fitCounts training.Tokens |> require
counts <- Some fittedCounts
save false ""
for seed in RenderedSignalExperiment.modelSeeds do
    let initial = SmallRnn.create 2 8 (ResearchRandom.domain (uint64 seed) 1) |> require
    let initialParameters = SmallRnn.parameters initial
    let mutable nextRow = 0
    let next () =
        let row = training.Tokens.[nextRow % training.Tokens.Length]
        nextRow <- nextRow + 1
        Ok row
    let emittedProgress = ResizeArray<SmallRnnTraining.Progress>()
    let progress (row: SmallRnnTraining.Progress) =
        emittedProgress.Add row
        eprintfn "seed=%d step=%d loss-nats=%.9f" seed row.Step row.LossNats
    let outcome, resource = RenderedSignalCarrier.measure (fun () -> SmallRnnTraining.train RenderedSignalExperiment.trainingConfig next progress initial)
    fitting.Add { Seed = seed; Resource = resource }
    let model: RenderedSignalPrediction.ModelReceipt =
        match outcome with
        | Error reason ->
            { Seed = seed; Hidden = 8; Status = "failed"; Failure = reason; InitialParameters = initialParameters; Parameters = [||]
              InitialSha256 = RenderedSignalPrediction.parametersHash initialParameters; TrainedSha256 = ""; TrainingTrace = emittedProgress.ToArray(); TrainedTokens = int64 nextRow * 32L }
        | Ok trained ->
            let parameters = SmallRnn.parameters trained.Model
            { Seed = seed; Hidden = 8; Status = "complete"; Failure = ""; InitialParameters = initialParameters; Parameters = parameters
              InitialSha256 = RenderedSignalPrediction.parametersHash initialParameters; TrainedSha256 = RenderedSignalPrediction.parametersHash parameters
              TrainingTrace = trained.Trace; TrainedTokens = trained.TrainedTokens }
    models.Add model
    save false ""
RenderedSignalExperiment.validateModels (models.ToArray()) |> require
let candidates = RenderedSignalPrediction.candidates fittedCounts (models.ToArray()) |> require
for name, renderer, length, domain in RenderedSignalExperiment.predictionRoster do
    eprintfn "rendering/scoring prediction panel %s" name
    let panel = RenderedSignalCarrier.corpus renderer 2048 (length + 1) 1009UL domain 0.75 128 0 |> require
    let scores, resource = RenderedSignalCarrier.measure (fun () -> candidates |> Array.map (fun candidate -> RenderedSignalPrediction.score candidate fittedCounts panel.Tokens |> require))
    predictions.Add { Name = name; Renderer = RenderedSignalCarrier.name renderer; ContextLength = length; Domain = domain; Examples = 2048
                      Fingerprints = panel.Fingerprints; Diagnostics = panel.Diagnostics; Generation = panel.Generation; Extraction = panel.Extraction; Prediction = resource
                      Targets = Array.map Array.last panel.Tokens; Arms = scores }
    save false ""
let detectorCandidates = candidates |> Array.filter (fun candidate -> List.contains candidate.Name ["known";"order-two";"fair";"trained-rnn"])
for name, renderer, domain, probability, duration in RenderedSignalExperiment.detectionRoster do
    eprintfn "rendering/scoring detection panel %s" name
    let panel = RenderedSignalCarrier.corpus renderer 2048 256 2003UL domain probability 128 duration |> require
    let scores, resource = RenderedSignalCarrier.measure (fun () -> detectorCandidates |> Array.map (fun candidate -> RenderedSignalDetection.score candidate panel.Tokens |> require))
    detections.Add { Name = name; Renderer = RenderedSignalCarrier.name renderer; Domain = domain; Examples = 2048; Length = 256
                     ChangeProbability = probability; ChangeStart = 128; ChangeDuration = duration; Fingerprints = panel.Fingerprints; Diagnostics = panel.Diagnostics
                     Generation = panel.Generation; Extraction = panel.Extraction; Detection = resource; Arms = scores }
    save false ""
save true ""
