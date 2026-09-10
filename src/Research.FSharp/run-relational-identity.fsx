#r "../Core/bin/Release/net10.0/Zeta.Core.dll"
#load "RelationalIdentity.fs"
#load "RelationalIdentityExperiment.fs"

open System
open System.IO
open System.Diagnostics
open System.Runtime.InteropServices
open System.Security.Cryptography
open System.Text.Json
open Zeta.Research

let output = match fsi.CommandLineArgs |> Array.skip 1 with [|path|] -> path | _ -> eprintfn "usage: run-relational-identity.fsx OUTPUT"; exit 2
if File.Exists output then eprintfn "refusing to overwrite %s" output; exit 2
let root = Path.GetFullPath(Path.Combine(__SOURCE_DIRECTORY__, "..", ".."))
let paths =
    [| "docs/research/relational-identity/2026-09-06-protocol.md"
       "docs/research/relational-identity/2026-09-06-clarification.md"
       "docs/research/relational-identity/2026-09-06-source-repairs.md"
       "src/Research.FSharp/RelationalIdentity.fs"
       "src/Research.FSharp/RelationalIdentityExperiment.fs"
       "src/Research.FSharp/run-relational-identity.fsx"
       "src/Interp.Python/zeta_interp/relational_identity.py"
       "src/Core/AntiSybil.fs"
       "src/Core/CoordinationSpectrum.fs" |]
let archive = "archive/relational-identity-20260906-source-v4"
let gitBytes arguments =
    let start = ProcessStartInfo("git")
    start.WorkingDirectory <- root
    start.UseShellExecute <- false
    start.RedirectStandardOutput <- true
    start.RedirectStandardError <- true
    for argument in arguments do start.ArgumentList.Add argument
    use child = Process.Start start
    use buffer = new MemoryStream()
    child.StandardOutput.BaseStream.CopyTo buffer
    let error = child.StandardError.ReadToEnd()
    child.WaitForExit()
    if child.ExitCode <> 0 then eprintfn "archive verification failed: %s" error; exit 2
    buffer.ToArray()
let sourceCommit = gitBytes ["rev-parse"; "refs/tags/" + archive + "^{commit}"] |> System.Text.Encoding.UTF8.GetString |> fun value -> value.Trim()
let sourceHashes = paths |> Array.map (fun path ->
    let current = File.ReadAllBytes(Path.Combine(root, path)) |> SHA256.HashData |> Convert.ToHexString
    let archived = gitBytes ["show"; sourceCommit + ":" + path] |> SHA256.HashData |> Convert.ToHexString
    if current <> archived then eprintfn "source differs from immutable archive: %s" path; exit 2
    {| Path = path; Sha256 = current |})
let coreAssembly = typeof<Zeta.Core.AntiSybil.DistinctnessReadout>.Assembly
let loadedCore =
    {| Sha256 = File.ReadAllBytes(coreAssembly.Location) |> SHA256.HashData |> Convert.ToHexString
       ModuleVersionId = coreAssembly.ManifestModule.ModuleVersionId.ToString("D")
       Scope = "Identifies the loaded Core binary; fresh build is recorded separately, not a reproducible-build proof." |}
let runningProcess = Process.GetCurrentProcess()
let cpu = runningProcess.TotalProcessorTime
let allocated = GC.GetAllocatedBytesForCurrentThread()
let clock = Stopwatch.StartNew()
let semantic =
    {| Transport = RelationalIdentityExperiment.transportPanel ()
       Mutations = RelationalIdentityExperiment.mutationPanel ()
       Entropy = RelationalIdentityExperiment.entropyPanel ()
       Scaling = RelationalIdentityExperiment.scalingPanel ()
       Baselines = RelationalIdentityExperiment.baselinePanel () |}
clock.Stop()
let result =
    {| Protocol = "relational-identity-v1"
       SourceArchive = archive
       SourceCommit = sourceCommit
       LoadedCoreAssembly = loadedCore
       ProtocolCommit = "4f470f40e"
       SourceHashes = sourceHashes
       Semantic = semantic
       Measurement = {| ElapsedMilliseconds = clock.Elapsed.TotalMilliseconds
                        ProcessCpuMilliseconds = (runningProcess.TotalProcessorTime - cpu).TotalMilliseconds
                        ThreadAllocatedBytes = GC.GetAllocatedBytesForCurrentThread() - allocated
                        Runtime = RuntimeInformation.FrameworkDescription; Platform = RuntimeInformation.OSDescription
                        Scope = "One cold deterministic panel; current-thread managed allocation, not retained heap, energy or stipulated work costs." |} |}
File.WriteAllText(output, JsonSerializer.Serialize(result, JsonSerializerOptions(WriteIndented = true)) + Environment.NewLine)
