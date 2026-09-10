module RenderedCatchRuntime

open System
open System.Diagnostics
open System.IO
open System.Runtime.InteropServices
open System.Text
open System.Text.Json
open Zeta.Research

let protocolFile = "docs/research/2026-09-06-rendered-catch-actions-protocol.md"
let archive = "refs/tags/archive/experiments/081M1W8T690087G0R002DJ91MJ"
let sourceFiles =
    [| "src/Core/Chip8.fs"; "src/Core/Chip8Cow.fs"; "src/Core/ControlScheme.fs"; "src/Core/FrameMotion.fs"; "src/Core/FrameSignals.fs"
       "src/Core/GameEnvironment.fs"; "src/Core/SplitMix64.fs"; "src/Research.FSharp/ResearchRandom.fs"
       "src/Research.FSharp/RenderedSignalCarrier.fs"; "src/Research.FSharp/RenderedCatchReceipt.fs"
       "src/Research.FSharp/RenderedCatchCarrier.fs"; "src/Research.FSharp/RenderedCatchPolicy.fs"; "src/Research.FSharp/RenderedCatchExperiment.fs"
       "src/Research.FSharp/RenderedCatchRuntime.fsx"; "src/Research.FSharp/run-rendered-catch-experiment.fsx"
       "src/Research.FSharp/measure-rendered-catch-inference.fsx"; "src/Research.FSharp/check-rendered-catch-kernel.fsx"
       "src/Interp.Python/zeta_interp/mess3_replay.py"; "src/Interp.Python/zeta_interp/rendered_catch_carrier.py"
       "src/Interp.Python/zeta_interp/rendered_catch_replay.py"; "src/Interp.Python/zeta_interp/rendered_catch_verdict.py"
       "src/Research.FSharp/rendered-signal-results.json"; protocolFile |]
let private fail code detail = Error(RenderedCatchReceipt.failure "admission" code detail)
let private git root arguments =
    try
        let info = ProcessStartInfo("git")
        info.WorkingDirectory <- root
        info.UseShellExecute <- false
        info.RedirectStandardOutput <- true
        info.RedirectStandardError <- true
        for argument in arguments do info.ArgumentList.Add argument
        use proc = Process.Start info
        use data = new MemoryStream()
        proc.StandardOutput.BaseStream.CopyTo data
        let error = proc.StandardError.ReadToEnd()
        proc.WaitForExit()
        if proc.ExitCode = 0 then Ok(data.ToArray()) else fail "archive-git" (error.Trim())
    with :? IOException as error -> fail "archive-git" error.Message
let private gitText root args = git root args |> Result.map (Encoding.UTF8.GetString >> _.Trim())
let admit root arguments : Result<RenderedCatchReceipt.Provenance, RenderedCatchReceipt.Failure> =
    gitText root ["rev-parse"; "--verify"; archive + "^{commit}"] |> Result.bind (fun implementation ->
        gitText root ["rev-parse"; "HEAD"] |> Result.bind (fun commit ->
            let hashes = ResizeArray<RenderedCatchReceipt.SourceHash>()
            let mutable failure = None
            for file in sourceFiles do
                if failure.IsNone then
                    try
                        let current = File.ReadAllBytes(Path.Combine(root, file))
                        match git root ["show"; implementation + ":" + file] with
                        | Error reason -> failure <- Some reason
                        | Ok admitted when admitted <> current -> failure <- Some(RenderedCatchReceipt.failure "admission" "source-bytes" ("current bytes differ from immutable implementation archive: " + file))
                        | Ok _ ->
                            match git root ["show"; commit + ":" + file] with
                            | Error reason -> failure <- Some reason
                            | Ok committed when committed <> current -> failure <- Some(RenderedCatchReceipt.failure "admission" "head-bytes" ("working bytes differ from declared SourceCommit: " + file))
                            | Ok _ -> hashes.Add { File = file; Sha256 = RenderedCatchCarrier.sha256 current }
                    with :? IOException as error -> failure <- Some(RenderedCatchReceipt.failure "admission" "source-read" error.Message)
            match failure with
            | Some reason -> Error reason
            | None ->
                let assemblies: RenderedCatchReceipt.LoadedAssembly[] =
                    [| typeof<Zeta.Core.GameEnvironment.Frame>.Assembly; typeof<Zeta.Core.IBilinearMarker>.Assembly |]
                    |> Array.map (fun assembly ->
                        ({ Name = assembly.GetName().Name; Mvid = assembly.ManifestModule.ModuleVersionId.ToString("D")
                           Sha256 = File.ReadAllBytes assembly.Location |> RenderedCatchCarrier.sha256 } : RenderedCatchReceipt.LoadedAssembly))
                    |> Array.sortBy (fun (item: RenderedCatchReceipt.LoadedAssembly) -> item.Name)
                if Array.map (fun (item: RenderedCatchReceipt.LoadedAssembly) -> item.Name) assemblies <> [|"Zeta.Core";"Zeta.Core.Abstractions"|] then fail "assemblies" "unexpected loaded native assemblies"
                else
                    Ok { SourceCommit = commit; ImplementationArchive = archive; ImplementationCommit = implementation
                         SourceHashes = hashes.ToArray(); LoadedAssemblies = assemblies; Runtime = RuntimeInformation.FrameworkDescription
                         OperatingSystem = RuntimeInformation.OSDescription; Arguments = arguments }))
let protocolHash (provenance: RenderedCatchReceipt.Provenance) =
    provenance.SourceHashes |> Array.find (fun item -> item.File = protocolFile) |> _.Sha256
let utcNow () = DateTimeOffset.UtcNow.ToString("O", Globalization.CultureInfo.InvariantCulture)
let writeNew output receipt =
    try
        if File.Exists output || File.Exists(output + ".partial") then fail "output-exists" "refusing to overwrite an existing receipt or partial attempt"
        else
            let bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(receipt, JsonSerializerOptions(WriteIndented = true)) + "\n")
            use stream = new FileStream(output + ".partial", FileMode.CreateNew, FileAccess.Write, FileShare.None)
            stream.Write bytes
            stream.Flush true
            stream.Dispose()
            File.Move(output + ".partial", output, false)
            Ok(RenderedCatchCarrier.sha256 bytes)
    with :? IOException as error -> fail "output-write" error.Message
let sameSource (left: RenderedCatchReceipt.Provenance) (right: RenderedCatchReceipt.Provenance) =
    left.SourceHashes = right.SourceHashes && left.ImplementationArchive = right.ImplementationArchive
    && left.ImplementationCommit = right.ImplementationCommit && left.LoadedAssemblies = right.LoadedAssemblies
    && left.Runtime = right.Runtime && left.OperatingSystem = right.OperatingSystem
let admitBehavior raw current =
    try
        let receipt = JsonSerializer.Deserialize<RenderedCatchReceipt.Native>(raw: byte[])
        if obj.ReferenceEquals(receipt, null) || not receipt.Complete || not (isNull receipt.Failure)
           || receipt.Protocol <> RenderedCatchReceipt.protocol || receipt.Kind <> "behavior"
           || receipt.Config <> RenderedCatchReceipt.config || receipt.ProtocolSha256 <> protocolHash current
           || receipt.InputSha256 <> RenderedCatchPolicy.inputSha256 || receipt.CountsSha256Before <> RenderedCatchPolicy.countsSha256
           || receipt.CountsSha256After <> RenderedCatchPolicy.countsSha256 || not (sameSource receipt.Provenance current)
           || isNull receipt.Panels || receipt.Panels.Length <> 4 then fail "behavior-input" "requires complete matching admitted behavior receipt"
        else
            let valid =
                Array.forall2 (fun (panel: RenderedCatchReceipt.Panel) config ->
                    panel.Config = config && not (isNull panel.Arms) && Array.map (fun (arm: RenderedCatchReceipt.Arm) -> arm.Name) panel.Arms = RenderedCatchReceipt.config.Arms
                    && Array.forall (fun (arm: RenderedCatchReceipt.Arm) -> arm.Batch.Complete && isNull arm.Batch.Failure && arm.Batch.Episodes.Length = 1024
                                                                          && Array.mapi (fun index (episode: RenderedCatchReceipt.Episode) -> episode.Index = index && episode.Complete && isNull episode.Failure) arm.Batch.Episodes |> Array.forall id) panel.Arms)
                    receipt.Panels RenderedCatchReceipt.config.Panels
            if valid then Ok receipt else fail "behavior-roster" "behavior receipt has incomplete or different panel/arm/episode roster"
    with
    | :? JsonException as error -> fail "behavior-json" error.Message
    | :? NullReferenceException as error -> fail "behavior-json" error.Message
