#r "../Core.Abstractions/bin/Release/net10.0/Zeta.Core.Abstractions.dll"
#r "../Core/bin/Release/net10.0/Zeta.Core.dll"
#load "ResearchRandom.fs"
#load "RenderedSignalCarrier.fs"
#load "RenderedCatchReceipt.fs"
#load "RenderedCatchCarrier.fs"
#load "RenderedCatchPolicy.fs"
#load "RenderedCatchExperiment.fs"
#load "RenderedCatchRuntime.fsx"

open System
open System.IO
open Zeta.Research

let arguments = fsi.CommandLineArgs |> Array.skip 1
let input, output =
    match arguments with
    | [| input; output |] -> input, output
    | _ -> eprintfn "usage: run-rendered-catch-experiment.fsx PASSIVE.json NEW-OUTPUT.json"; exit 2
if File.Exists output || File.Exists(output + ".partial") then eprintfn "refusing existing output"; exit 2
let root = Path.GetFullPath(Path.Combine(__SOURCE_DIRECTORY__, "../.."))
let started = RenderedCatchRuntime.utcNow()
let panels = ResizeArray<RenderedCatchReceipt.Panel>()
let mutable provenance: RenderedCatchReceipt.Provenance = Unchecked.defaultof<_>
let mutable inputHash, beforeHash, afterHash = "", "", ""
let outcome =
    RenderedCatchRuntime.admit root arguments |> Result.bind (fun admitted ->
        provenance <- admitted
        try
            let raw = File.ReadAllBytes input
            inputHash <- RenderedCatchCarrier.sha256 raw
            RenderedCatchPolicy.readCounts raw |> Result.bind (fun counts ->
                RenderedCatchPolicy.hashCounts counts |> Result.bind (fun fingerprint ->
                    beforeHash <- fingerprint
                    let mutable failure = None
                    for config in RenderedCatchReceipt.config.Panels do
                        if failure.IsNone then
                            match RenderedCatchExperiment.runPanel counts config (fun panel arm -> eprintfn "acting panel=%s arm=%s" panel arm) with
                            | Error reason -> failure <- Some reason
                            | Ok panel ->
                                panels.Add panel
                                panel.Arms |> Array.tryFind (fun arm -> not arm.Batch.Complete) |> Option.iter (fun arm -> failure <- Some arm.Batch.Failure)
                    match RenderedCatchPolicy.hashCounts counts with
                    | Error reason -> Error reason
                    | Ok fingerprint ->
                        afterHash <- fingerprint
                        if fingerprint <> beforeHash then Error(RenderedCatchReceipt.failure "model" "changed" "count fingerprint changed during behavior")
                        else match failure with Some reason -> Error reason | None -> Ok()))
        with :? IOException as error -> Error(RenderedCatchReceipt.failure "input" "read" error.Message))
let failure = match outcome with Ok() -> null | Error reason -> reason
let receipt: RenderedCatchReceipt.Native =
    { Protocol = RenderedCatchReceipt.protocol; Kind = "behavior"; Complete = Result.isOk outcome; Failure = failure
      ProtocolSha256 = if obj.ReferenceEquals(provenance, null) then "" else RenderedCatchRuntime.protocolHash provenance
      InputSha256 = inputHash; CountsSha256Before = beforeHash; CountsSha256After = afterHash; Config = RenderedCatchReceipt.config
      Provenance = provenance; StartedAtUtc = started; FinishedAtUtc = RenderedCatchRuntime.utcNow(); Panels = panels.ToArray() }
match RenderedCatchRuntime.writeNew output receipt with
| Error reason -> eprintfn "%s: %s" reason.Code reason.Detail; exit 1
| Ok hash -> eprintfn "receipt=%s sha256=%s complete=%b" output hash receipt.Complete
if not receipt.Complete then eprintfn "%s: %s" failure.Code failure.Detail; exit 1
