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
open Zeta.Core
open Zeta.Research

let arguments = fsi.CommandLineArgs |> Array.skip 1
let input, output, quiet, activity =
    match arguments with
    | [|input; output; quiet; activity|] when Array.forall (System.String.IsNullOrWhiteSpace >> not) arguments -> input, output, quiet, activity
    | _ -> eprintfn "usage: measure-hidden-switch-inference.fsx BEHAVIOR.json NEW-OUTPUT.json QUIET-DECLARATION HOST-ACTIVITY"; exit 2
if File.Exists output || Directory.Exists output || File.Exists(output + ".partial") || Directory.Exists(output + ".partial") then eprintfn "refusing existing output or partial attempt"; exit 2
let root = Path.GetFullPath(Path.Combine(__SOURCE_DIRECTORY__, "../.."))
let actual = Path.Combine(__SOURCE_DIRECTORY__, __SOURCE_FILE__)
let started = HiddenSwitchRuntime.utcNow()
let provenance, admissionFailure = HiddenSwitchRuntime.admit root actual "measure-hidden-switch-inference.fsx" arguments
let mutable inputHash = ""
let inputAdmission = result {
    let! raw = HiddenSwitchRuntime.readBytes "behavior-input" input
    inputHash <- HiddenSwitchObservation.sha256 raw
    if not (isNull admissionFailure) then return! Error admissionFailure
    let! behavior = HiddenSwitchRuntime.admitBehavior raw provenance
    do! HiddenSwitchRuntime.chronology behavior.FinishedAtUtc started
    return () }
let rows, failure = match inputAdmission with Ok() -> HiddenSwitchExperiment.costs() | Error reason -> [||], reason
let receipt: HiddenSwitchReceipt.Cost =
    { Protocol = HiddenSwitchReceipt.protocol; Kind = "cost"; Complete = isNull failure; Failure = failure
      ProtocolSha256 = HiddenSwitchRuntime.expectedProtocolHash; Config = HiddenSwitchReceipt.config(); Provenance = provenance
      StartedAtUtc = started; FinishedAtUtc = HiddenSwitchRuntime.utcNow(); InputBehaviorSha256 = inputHash
      QuietWindowDeclaration = quiet; HostActivity = activity; SourceDraws = (if isNull failure || rows.Length > 0 then 2448 else 0)
      Payload = (HiddenSwitchReceipt.config()).Arms |> Array.map HiddenSwitchPolicy.payload; Rows = rows }
match HiddenSwitchRuntime.writeNew output receipt with
| Error reason -> eprintfn "%s: %s" reason.Code reason.Detail; exit 1
| Ok hash -> eprintfn "receipt=%s sha256=%s complete=%b" output hash receipt.Complete
if not receipt.Complete then eprintfn "%s: %s" failure.Code failure.Detail; exit 1
