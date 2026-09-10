namespace Zeta.Research

open System
open System.Diagnostics
open System.IO

[<RequireQualifiedAccess>]
module RenderedSignalExperiment =
    type PredictionPanel =
        { Name: string; Renderer: string; ContextLength: int; Domain: int; Examples: int
          Fingerprints: RenderedSignalCarrier.Fingerprints; Diagnostics: RenderedSignalCarrier.Diagnostics
          Generation: RenderedSignalCarrier.Resource; Extraction: RenderedSignalCarrier.Resource; Prediction: RenderedSignalCarrier.Resource
          Targets: int[]; Arms: RenderedSignalPrediction.Score[] }
    type DetectionPanel =
        { Name: string; Renderer: string; Domain: int; Examples: int; Length: int; ChangeProbability: float; ChangeStart: int; ChangeDuration: int
          Fingerprints: RenderedSignalCarrier.Fingerprints; Diagnostics: RenderedSignalCarrier.Diagnostics
          Generation: RenderedSignalCarrier.Resource; Extraction: RenderedSignalCarrier.Resource; Detection: RenderedSignalCarrier.Resource
          Arms: RenderedSignalDetection.Score[] }
    type SourceHash = { File: string; Sha256: string }
    type Fitting = { Seed: int; Resource: RenderedSignalCarrier.Resource }

    let modelSeeds = [|41; 53; 67|]
    let predictionRoster =
        [| "train-dot-16", RenderedSignalCarrier.TrainDot, 16, 103
           "train-dot-64", RenderedSignalCarrier.TrainDot, 64, 104
           "heldout-bar-16", RenderedSignalCarrier.HeldoutBar, 16, 105
           "heldout-bar-64", RenderedSignalCarrier.HeldoutBar, 64, 106
           "nuisance-16", RenderedSignalCarrier.Nuisance, 16, 107
           "nuisance-64", RenderedSignalCarrier.Nuisance, 64, 108 |]
    let detectionRoster =
        [| "unchanged", RenderedSignalCarrier.TrainDot, 201, 0.75, 0
           "nuisance-null", RenderedSignalCarrier.Nuisance, 202, 0.75, 0
           "permanent-half", RenderedSignalCarrier.TrainDot, 203, 0.5, 128
           "permanent-quarter", RenderedSignalCarrier.TrainDot, 204, 0.25, 128
           "transient-half", RenderedSignalCarrier.TrainDot, 205, 0.5, 16 |]
    let trainingConfig: SmallRnnTraining.Config = { Steps = 1024; Batch = 16; SequenceSteps = 32; LearningRate = 0.003 }

    let sourceHashes root =
        [| "src/Core/Chip8.fs"; "src/Core/FrameMotion.fs"; "src/Core/FrameSignals.fs"; "src/Core/GameEnvironment.fs"; "src/Core/SplitMix64.fs"
           "src/Research.FSharp/ResearchRandom.fs"; "src/Research.FSharp/SmallRnn.fs"; "src/Research.FSharp/SmallRnnTraining.fs"
           "src/Research.FSharp/RenderedSignalCarrier.fs"; "src/Research.FSharp/RenderedSignalPrediction.fs"
           "src/Research.FSharp/RenderedSignalDetection.fs"; "src/Research.FSharp/RenderedSignalExperiment.fs"
           "src/Research.FSharp/RenderedSignalRuntime.fsx"
           "src/Research.FSharp/run-rendered-signal-experiment.fsx"; "src/Research.FSharp/measure-rendered-signal-inference.fsx"
           "docs/research/2026-09-06-rendered-signal-predictor-protocol.md" |]
        |> Array.map (fun file -> { File = file; Sha256 = File.ReadAllBytes(Path.Combine(root, file)) |> RenderedSignalCarrier.sha256 })

    let sourceCommit root =
        let info = ProcessStartInfo("git")
        info.ArgumentList.Add "rev-parse"
        info.ArgumentList.Add "HEAD"
        info.WorkingDirectory <- root
        info.UseShellExecute <- false
        info.RedirectStandardOutput <- true
        use proc = Process.Start info
        let commit = proc.StandardOutput.ReadToEnd().Trim()
        proc.WaitForExit()
        if proc.ExitCode <> 0 || commit.Length <> 40 then Error "cannot identify source commit" else Ok commit

    let validateModels (models: RenderedSignalPrediction.ModelReceipt[]) =
        if isNull models || Array.map (fun (model: RenderedSignalPrediction.ModelReceipt) -> model.Seed) models <> modelSeeds || Array.exists (fun (model: RenderedSignalPrediction.ModelReceipt) -> model.Hidden <> 8 || model.Status <> "complete") models then
            Error "model receipt must contain complete width-8 seeds 41,53,67 in order"
        else Ok()

    let benchmarkOrder (candidates: RenderedSignalPrediction.Candidate[]) =
        let keys =
            [| for name in ["unigram";"bigram";"order-two";"known";"fair";"last"] do yield name, -1
               for name in ["untrained-rnn";"trained-rnn"] do for seed in modelSeeds do yield name, seed |]
        keys |> Array.map (fun (name, seed) -> candidates |> Array.find (fun candidate -> candidate.Name = name && candidate.Seed = seed))
