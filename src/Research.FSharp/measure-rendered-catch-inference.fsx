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

open System.Diagnostics

let arguments = fsi.CommandLineArgs |> Array.skip 1
let input, modelInput, output, quiet =
    match arguments with
    | [| input; modelInput; output; quiet |] when not (String.IsNullOrWhiteSpace quiet) -> input, modelInput, output, quiet
    | _ -> eprintfn "usage: measure-rendered-catch-inference.fsx NATIVE.json PASSIVE.json NEW-COST.json QUIET-WINDOW-DECLARATION"; exit 2
if File.Exists output || File.Exists(output + ".partial") then eprintfn "refusing existing output"; exit 2
let root = Path.GetFullPath(Path.Combine(__SOURCE_DIRECTORY__, "../.."))
let started = RenderedCatchRuntime.utcNow()
let measurements = ResizeArray<RenderedCatchReceipt.CostRow>()
let mutable provenance: RenderedCatchReceipt.Provenance = Unchecked.defaultof<_>
let mutable source: RenderedCatchReceipt.Source = Unchecked.defaultof<_>
let mutable inputHash, modelHash, beforeHash, afterHash = "", "", "", ""
let measure action =
    use proc = Process.GetCurrentProcess()
    let timer = Stopwatch()
    let cpu = proc.TotalProcessorTime
    let allocated = GC.GetAllocatedBytesForCurrentThread()
    timer.Start()
    let result = action ()
    timer.Stop()
    let allocationDelta = GC.GetAllocatedBytesForCurrentThread() - allocated
    let cpuDelta = (proc.TotalProcessorTime - cpu).TotalMilliseconds
    let resource: RenderedCatchReceipt.Resource =
        { ElapsedMilliseconds = timer.Elapsed.TotalMilliseconds; CpuMilliseconds = cpuDelta
          AllocatedBytes = allocationDelta }
    result, resource
let outcome =
    RenderedCatchRuntime.admit root arguments |> Result.bind (fun admitted ->
        provenance <- admitted
        try
            let nativeBytes, modelBytes = File.ReadAllBytes input, File.ReadAllBytes modelInput
            inputHash <- RenderedCatchCarrier.sha256 nativeBytes
            modelHash <- RenderedCatchCarrier.sha256 modelBytes
            RenderedCatchRuntime.admitBehavior nativeBytes admitted |> Result.bind (fun _ ->
                RenderedCatchPolicy.readCounts modelBytes |> Result.bind (fun counts ->
                    RenderedCatchPolicy.hashCounts counts |> Result.bind (fun fingerprint ->
                        beforeHash <- fingerprint
                        RenderedCatchExperiment.corpus RenderedCatchCarrier.Dot 72 7001 701 0.75 |> Result.bind (fun corpus ->
                            source <- corpus.Receipt
                            let warmupRows, timedRows = corpus.Rows.[..7], corpus.Rows.[8..]
                            let mutable failure = None
                            for repetition in 0 .. 4 do
                                for index in 0 .. 4 do
                                    if failure.IsNone then
                                        let name = RenderedCatchReceipt.config.Arms.[(index + repetition) % 5]
                                        let fair = if name = "fair-independent" then Some(RenderedCatchPolicy.FairStream(ResearchRandom.domain 8003UL 801)) else None
                                        let warmup = RenderedCatchExperiment.runBatch "cost-dot-three-quarter" name counts fair 0 warmupRows "fixed"
                                        if not warmup.Complete then failure <- Some warmup.Failure
                                        let timed, resource =
                                            measure (fun () ->
                                                if warmup.Complete then RenderedCatchExperiment.runBatch "cost-dot-three-quarter" name counts fair 8 timedRows "fixed"
                                                else RenderedCatchExperiment.runBatch "cost-dot-three-quarter" name counts fair 8 [||] "fixed")
                                        if not timed.Complete then failure <- Some timed.Failure
                                        measurements.Add
                                            { Repetition = repetition; Name = name; Payload = RenderedCatchPolicy.payload name; Warmup = warmup; Timed = timed; Resource = resource
                                              WarmupSourceDraws = 0L; TimedSourceDraws = 0L; WarmupActionDraws = warmup.ActionDraws; TimedActionDraws = timed.ActionDraws
                                              SourceSymbolsSha256 = source.SourceSymbolsSha256; SourceRomSha256 = source.SourceRomSha256 }
                            match RenderedCatchPolicy.hashCounts counts with
                            | Error reason -> Error reason
                            | Ok fingerprint ->
                                afterHash <- fingerprint
                                if fingerprint <> beforeHash then Error(RenderedCatchReceipt.failure "model" "changed" "count fingerprint changed during costs")
                                else match failure with Some reason -> Error reason | None -> Ok()))))
        with :? IOException as error -> Error(RenderedCatchReceipt.failure "input" "read" error.Message))
let failure = match outcome with Ok() -> null | Error reason -> reason
let receipt: RenderedCatchReceipt.Cost =
    { Protocol = RenderedCatchReceipt.protocol; Kind = "cost"; Complete = Result.isOk outcome; Failure = failure
      ProtocolSha256 = if obj.ReferenceEquals(provenance, null) then "" else RenderedCatchRuntime.protocolHash provenance
      InputSha256 = inputHash; ModelInputSha256 = modelHash; CountsSha256Before = beforeHash; CountsSha256After = afterHash
      Config = RenderedCatchReceipt.config; Provenance = provenance; StartedAtUtc = started; FinishedAtUtc = RenderedCatchRuntime.utcNow()
      QuietWindowDeclaration = quiet; HostActivity = "ordinary host applications remain uncontrolled; the named team quiet window excludes own builds/tests/lints/training/experiments"
      Source = source; Measurements = measurements.ToArray() }
match RenderedCatchRuntime.writeNew output receipt with
| Error reason -> eprintfn "%s: %s" reason.Code reason.Detail; exit 1
| Ok hash -> eprintfn "receipt=%s sha256=%s complete=%b" output hash receipt.Complete
if not receipt.Complete then eprintfn "%s: %s" failure.Code failure.Detail; exit 1
