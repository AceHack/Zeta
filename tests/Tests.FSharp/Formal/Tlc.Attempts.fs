module Zeta.Tests.Formal.TlcAttempts

open System
open System.Diagnostics
open System.IO
open System.Security.Cryptography
open System.Text.Json
open System.Text.RegularExpressions
open System.Threading
open System.Threading.Tasks

type FileIdentity = { File: string; Bytes: int64; Sha256: string }
type InputIdentity = { Source: FileIdentity; Copied: FileIdentity }
type Attempt =
    { Directory: string; Workspace: string; Metadir: string
      Stdout: string; Stderr: string; ErrorFile: string; Inputs: InputIdentity[] }
type PreparationFailure = { Directory: string; Error: string }
type ProcessCapture = { ExitCode: int; TimedOut: bool }

/// File ownership survives failed launch or second-stream opening. The optional
/// deadline is for metadata probes; the F# model checker retains its existing no-timeout policy.
let captureProcess executable (argv: string seq) cwd stdout stderr (timeout: int option) =
    let info = ProcessStartInfo(executable)
    info.WorkingDirectory <- cwd
    info.UseShellExecute <- false
    info.RedirectStandardOutput <- true
    info.RedirectStandardError <- true
    for argument in argv do info.ArgumentList.Add argument
    use stdoutFile = new FileStream(stdout, FileMode.CreateNew, FileAccess.Write, FileShare.Read)
    use stderrFile = new FileStream(stderr, FileMode.CreateNew, FileAccess.Write, FileShare.Read)
    use deadline = new CancellationTokenSource()
    match timeout with
    | Some milliseconds -> deadline.CancelAfter milliseconds
    | None -> ()
    use proc = Process.Start info
    let copyOut = proc.StandardOutput.BaseStream.CopyToAsync(stdoutFile, deadline.Token)
    let copyErr = proc.StandardError.BaseStream.CopyToAsync(stderrFile, deadline.Token)
    let exit = proc.WaitForExitAsync deadline.Token
    let mutable timedOut = false
    try Task.WhenAll([|exit; copyOut; copyErr|]).GetAwaiter().GetResult()
    with :? OperationCanceledException when deadline.IsCancellationRequested ->
        // One deadline covers both the direct child and inherited-pipe EOF.
        // Awaiting WhenAll also observes both cancelled copy tasks before disposing files.
        timedOut <- true
        if not proc.HasExited then
            try proc.Kill true
            with :? InvalidOperationException when proc.HasExited -> ()
        proc.WaitForExit()
    stdoutFile.Flush true
    stderrFile.Flush true
    { ExitCode = proc.ExitCode; TimedOut = timedOut }

let identifyFile name path =
    use stream = File.OpenRead path
    { File = name; Bytes = stream.Length; Sha256 = Convert.ToHexString(SHA256.HashData stream) }

let private generatedInput (name: string) =
    name.Contains("_TTrace_", StringComparison.Ordinal)
    || (name.StartsWith("MC", StringComparison.Ordinal) && name.EndsWith(".tla", StringComparison.Ordinal))

/// Include unstaged/new sources; refuse ignored local helpers rather than omit them.
let sourceInputs root specsPath (required: string[]) =
    let info = ProcessStartInfo("git")
    info.WorkingDirectory <- root
    info.UseShellExecute <- false
    info.RedirectStandardOutput <- true
    info.RedirectStandardError <- true
    for argument in ["ls-files"; "--cached"; "--others"; "--exclude-standard"; "--"; "src/Core.TLA/specs/*.tla"; "src/Core.TLA/specs/*.cfg"] do
        info.ArgumentList.Add argument
    use proc = Process.Start info
    let stdout = proc.StandardOutput.ReadToEnd()
    let stderr = proc.StandardError.ReadToEnd()
    proc.WaitForExit()
    if proc.ExitCode <> 0 then invalidOp ("git source inventory refused: " + stderr)
    let paths = stdout.Split([|'\n'; '\r'|], StringSplitOptions.RemoveEmptyEntries)
    if paths |> Array.exists (fun path -> path <> "src/Core.TLA/specs/" + Path.GetFileName path) then
        invalidOp "nested or quoted source path is unsupported"
    let names = paths |> Array.map Path.GetFileName |> Array.filter (generatedInput >> not)
    for name in required do
        if not (Array.contains name names) then invalidOp ("selected input absent from git-visible source closure: " + name)
    for file in Directory.EnumerateFiles specsPath do
        let name = Path.GetFileName file
        if (name.EndsWith(".tla", StringComparison.Ordinal) || name.EndsWith(".cfg", StringComparison.Ordinal))
           && not (generatedInput name) && not (Array.contains name names) then
            invalidOp ("ignored local source input would be omitted: " + name)
    names

/// Startup evidence is vetoed by any checker execution or fatal/in-run JVM marker.
let jvmNeverStarted (output: string) =
    let startedOrFatal = @"TLC2|TLC Version|Starting\.\.\.|Computing initial|Finished computing|Progress\(|distinct states|Model checking|Invariant .*violated|TLC bug|SIG[A-Z]+|fatal error|hs_err|OutOfMemoryError"
    let startup = @"Error occurred during initialization of VM|Could not reserve enough space for (?:\S+ )?object heap|Unable to access jarfile|Could not create the Java Virtual Machine"
    not (Regex.IsMatch(output, startedOrFatal, RegexOptions.IgnoreCase ||| RegexOptions.CultureInvariant))
    && Regex.IsMatch(output, startup, RegexOptions.IgnoreCase ||| RegexOptions.CultureInvariant)

let private writeNew path value =
    use stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.Read)
    JsonSerializer.Serialize(stream, value, JsonSerializerOptions(WriteIndented = true))
    stream.Flush true

/// Copy the whole admitted local .tla/.cfg closure into an attempt-owned workspace.
/// A copy refusal leaves its directory and explicit preparation failure intact.
let prepare diagnosticsRoot model attempt specsPath (sourceInventory: unit -> string[]) =
    let mutable directory = ""
    let copiedInputs = ResizeArray<InputIdentity>()
    try
        Directory.CreateDirectory diagnosticsRoot |> ignore
        let safeModel = Regex.Replace(model, "[^a-zA-Z0-9_-]", "_")
        directory <- Path.Combine(diagnosticsRoot, safeModel + "-" + Guid.NewGuid().ToString("N"))
        Directory.CreateDirectory directory |> ignore
        writeNew (Path.Combine(directory, "attempt.json")) {| Stage = "preparation"; Model = model; Attempt = attempt |}
        let workspace = Path.Combine(directory, "workspace")
        let metadir = Path.Combine(directory, "states")
        Directory.CreateDirectory workspace |> ignore
        Directory.CreateDirectory metadir |> ignore
        let sources = sourceInventory()
        if sources.Length = 0 || (Array.distinct sources |> Array.length) <> sources.Length then
            invalidArg (nameof sources) "source inventory must be nonempty and unique"
        let inputs =
            sources |> Array.sort |> Array.map (fun name ->
                if Path.GetFileName name <> name
                   || not (name.EndsWith(".tla", StringComparison.Ordinal) || name.EndsWith(".cfg", StringComparison.Ordinal))
                   || name.Contains("_TTrace_", StringComparison.Ordinal)
                   || (name.StartsWith("MC", StringComparison.Ordinal) && name.EndsWith(".tla", StringComparison.Ordinal)) then
                    invalidArg (nameof sources) ("refusing non-source input: " + name)
                let original = Path.Combine(specsPath, name)
                if File.GetAttributes original &&& FileAttributes.ReparsePoint <> enum 0 then
                    invalidArg (nameof sources) ("refusing linked source input: " + name)
                let copied = Path.Combine(workspace, name)
                File.Copy(original, copied, false)
                let sourceIdentity = identifyFile name original
                let copiedIdentity = identifyFile name copied
                if sourceIdentity <> copiedIdentity then invalidOp ("source changed while copied: " + name)
                let input = { Source = sourceIdentity; Copied = copiedIdentity }
                copiedInputs.Add input
                input)
        Ok { Directory = directory; Workspace = workspace; Metadir = metadir; Inputs = inputs
             Stdout = Path.Combine(directory, "stdout.log"); Stderr = Path.Combine(directory, "stderr.log")
             ErrorFile = Path.Combine(directory, "hs_err_pid%p.log") }
    with error ->
        if directory <> "" then
            try writeNew (Path.Combine(directory, "preparation-failure.json")) {| Stage = "preparation"; Error = error.Message; CopiedInputs = copiedInputs.ToArray() |}
            with _ -> () // Report the original path even when the failure receipt cannot be written.
        Error { Directory = directory; Error = error.Message }

/// Unexpected state directories stay intact. This counts bytes, not a retention quota.
let inventory directory =
    Directory.EnumerateFiles(directory, "*", SearchOption.AllDirectories)
    |> Seq.fold (fun (files, bytes) path -> files + 1, bytes + FileInfo(path).Length) (0, 0L)

let writeDiagnostic (attempt: Attempt) (name: string) value =
    if not (Regex.IsMatch(name, "^[a-z-]+\\.json$", RegexOptions.CultureInvariant)) then
        invalidArg (nameof name) "diagnostic filename must be an owned JSON basename"
    writeNew (Path.Combine(attempt.Directory, name)) value

/// Invoke only after the entire semantic judgement, including expected violations.
let finish (attempt: Attempt) expected =
    if expected then Directory.Delete(attempt.Directory, true)
