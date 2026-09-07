#r "../Core.Abstractions/bin/Release/net10.0/Zeta.Core.Abstractions.dll"
#r "../Core/bin/Release/net10.0/Zeta.Core.dll"
#load "ResearchRandom.fs"
#load "HiddenSwitchReceipt.fs"
#load "HiddenSwitchObservation.fs"
#load "HiddenSwitchCarrier.fs"
#load "HiddenSwitchPolicy.fs"
#load "HiddenSwitchExperiment.fs"
#load "HiddenSwitchRuntime.fsx"

open System.IO
open Zeta.Research

let arguments = fsi.CommandLineArgs |> Array.skip 1
let output = match arguments with [|output|] when not (System.String.IsNullOrWhiteSpace output) -> output | _ -> eprintfn "usage: run-hidden-switch-experiment.fsx NEW-OUTPUT.json"; exit 2
if File.Exists output || Directory.Exists output || File.Exists(output + ".partial") || Directory.Exists(output + ".partial") then eprintfn "refusing existing output or partial attempt"; exit 2
let root = Path.GetFullPath(Path.Combine(__SOURCE_DIRECTORY__, "../.."))
let actual = Path.Combine(__SOURCE_DIRECTORY__, __SOURCE_FILE__)
let started = HiddenSwitchRuntime.utcNow()
let provenance, admissionFailure = HiddenSwitchRuntime.admit root actual "run-hidden-switch-experiment.fsx" arguments
let panels, failure = if isNull admissionFailure then HiddenSwitchExperiment.behavior() else [||], admissionFailure
let receipt: HiddenSwitchReceipt.Native =
    { Protocol = HiddenSwitchReceipt.protocol; Kind = "behavior"; Complete = isNull failure; Failure = failure
      ProtocolSha256 = HiddenSwitchRuntime.expectedProtocolHash; Config = HiddenSwitchReceipt.config(); Provenance = provenance
      StartedAtUtc = started; FinishedAtUtc = HiddenSwitchRuntime.utcNow(); Panels = panels }
match HiddenSwitchRuntime.writeNew output receipt with
| Error reason -> eprintfn "%s: %s" reason.Code reason.Detail; exit 1
| Ok hash -> eprintfn "receipt=%s sha256=%s complete=%b" output hash receipt.Complete
if not receipt.Complete then eprintfn "%s: %s" failure.Code failure.Detail; exit 1
