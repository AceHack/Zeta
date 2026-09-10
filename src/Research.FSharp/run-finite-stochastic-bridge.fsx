#r "../Core.Abstractions/bin/Release/net10.0/Zeta.Core.Abstractions.dll"
#r "../Core/bin/Release/net10.0/Zeta.Core.dll"
#load "FiniteStochasticBridge.fs"

open System
open System.Diagnostics
open System.IO
open System.Runtime.InteropServices
open System.Security.Cryptography
open System.Text.Json
open Zeta.Research

let root = Path.GetFullPath(Path.Combine(__SOURCE_DIRECTORY__, "../.."))
let archive = "refs/tags/archive/experiments/081M1WDDB6M087G0R002KN8DWQ"
let contractArchive = archive + "-contract"
let protocol = "docs/research/2026-09-06-finite-stochastic-cqm-bridge-protocol.md"
let files =
    [| protocol
       "src/Core/WSet.fs"
       "src/Core/ProbabilitySemiring.fs"
       "src/Core.Abstractions/ISemiring.cs"
       "src/Core.Abstractions/IRing.cs"
       "src/Research.FSharp/FiniteStochasticBridge.fs"
       "src/Research.FSharp/run-finite-stochastic-bridge.fsx"
       "src/Interp.Python/zeta_interp/finite_stochastic_bridge.py" |]
let digest (bytes: byte array) = SHA256.HashData bytes |> Convert.ToHexString
let git arguments =
    let start = ProcessStartInfo("git", WorkingDirectory = root, RedirectStandardOutput = true, RedirectStandardError = true)
    for argument in arguments do start.ArgumentList.Add argument
    use child = Process.Start start
    use output = new MemoryStream()
    let errors = child.StandardError.ReadToEndAsync()
    child.StandardOutput.BaseStream.CopyTo output
    child.WaitForExit()
    if child.ExitCode = 0 then Ok (output.ToArray()) else Error (errors.GetAwaiter().GetResult())
let require = function Ok value -> value | Error reason -> invalidOp reason
let resolved reference = git [ "rev-parse"; "--verify"; reference + "^{commit}" ] |> require |> Text.Encoding.UTF8.GetString |> _.Trim()
let output =
    match fsi.CommandLineArgs |> Array.skip 1 with
    | [| path |] -> path
    | _ -> eprintfn "usage: run-finite-stochastic-bridge.fsx OUTPUT.json (requires immutable implementation archive)"; exit 2
if File.Exists output || File.Exists(output + ".partial") then eprintfn "refusing existing output %s" output; exit 2
type SourceHash = { File: string; Sha256: string }
type Provenance = { SourceCommit: string; SourceArchive: string; ContractCommit: string; ProtocolSha256: string; SourceHashes: SourceHash array }
type Assembly = { Name: string; Mvid: string; Sha256: string }
type Failure = { Stage: string; Detail: string }
let mutable provenance = { SourceCommit = ""; SourceArchive = archive; ContractCommit = ""; ProtocolSha256 = ""; SourceHashes = [||] }
let mutable assemblies: Assembly array = [||]
let mutable report: FiniteStochasticBridge.Report option = None
let mutable failure = { Stage = ""; Detail = "" }
let mutable stage = "source-admission"
do
    // Reserve the partial name exclusively before attempting admission/execution.
    use destination = new FileStream(output + ".partial", FileMode.CreateNew, FileAccess.Write, FileShare.None)
    try
        let canonical = Path.Combine(root, "src/Research.FSharp/run-finite-stochastic-bridge.fsx")
        if not (String.Equals(Path.GetFullPath(Path.Combine(__SOURCE_DIRECTORY__, __SOURCE_FILE__)), canonical, StringComparison.Ordinal)) then
            invalidOp "executing runner is not the admitted canonical source file"
        let commit = resolved archive
        provenance <- { provenance with SourceCommit = commit }
        let contract = resolved contractArchive
        provenance <- { provenance with ContractCommit = contract }
        git [ "merge-base"; "--is-ancestor"; contract; commit ] |> require |> ignore
        for path in files do
            let actual = File.ReadAllBytes(Path.Combine(root, path))
            let hash = { File = path; Sha256 = digest actual }
            provenance <- { provenance with SourceHashes = Array.append provenance.SourceHashes [| hash |] }
            if path = protocol then provenance <- { provenance with ProtocolSha256 = hash.Sha256 }
            let admitted = git [ "show"; commit + ":" + path ] |> require
            if actual <> admitted then invalidOp ("unarchived source bytes: " + path)
        let originalProtocol = git [ "show"; contract + ":" + protocol ] |> require
        if originalProtocol <> File.ReadAllBytes(Path.Combine(root, protocol)) then invalidOp "contract differs from immutable registration"
        stage <- "loaded-assemblies"
        assemblies <-
            [| typeof<Zeta.Core.ProbabilitySemiring.Rational>.Assembly; typeof<Zeta.Core.ISemiring<int>>.Assembly |]
            |> Array.map (fun assembly ->
                { Name = assembly.GetName().Name; Mvid = assembly.ManifestModule.ModuleVersionId.ToString("D")
                  Sha256 = File.ReadAllBytes assembly.Location |> digest })
            |> Array.sortBy _.Name
        stage <- "finite-witnesses"
        let result = FiniteStochasticBridge.run ()
        report <- Some result
        if not result.Complete then failure <- { Stage = stage; Detail = result.Failure }
    with error -> failure <- { Stage = stage; Detail = error.Message }
    let receipt =
        {| Protocol = "finite-stochastic-cqm-bridge-v1"; Complete = failure.Detail = "" && report.IsSome; Failure = failure
           Provenance = provenance; Runtime = RuntimeInformation.FrameworkDescription; OperatingSystem = RuntimeInformation.OSDescription
           LoadedAssemblies = assemblies; Report = report |}
    JsonSerializer.Serialize(destination, receipt, JsonSerializerOptions(WriteIndented = true))
    destination.WriteByte 10uy
File.Move(output + ".partial", output, false)
if failure.Detail <> "" || report.IsNone then exit 1
