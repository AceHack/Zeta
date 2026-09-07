[<Xunit.Collection("TLC")>]
module Zeta.Tests.Formal.TlcRunnerTests
// FS57 suppressed knowingly: references the experimental combinator in formal-harness wiring.
#nowarn "57"
#nowarn "0893"

open System
open System.Diagnostics
open System.IO
open System.Text.Json
open System.Threading
open FsUnit.Xunit
open global.Xunit


// ═══════════════════════════════════════════════════════════════════
// TLC model-checker runner. Every flag TLC sees comes from
// registry/tlc-models.json — the SAME file the hand-run CLI
// (src/Core.TypeScript/formal-verification/run-tlc.ts) builds from.
//
// WHY. On 2026-08-13 this runner went red on CI with exit 11,
// Deadlock reached. The property was fine and the config was the
// right one: the recorded runs had been driven by a script passing
// -deadlock, which DISABLES deadlock checking, while this file passed
// no such flag. The flags a spec was MEASURED under and the flags CI
// CHECKED it under were silently different, so a hand-run green and a
// gated green were not the same result and nothing said so.
//
// Adding -config was necessary and not sufficient — the next mismatch
// would have been a different flag — so the whole invocation is pinned
// in the registry and this file may not add one of its own. A verdict
// quoted anywhere in the repo names a registry id, and that id fixes
// the command that produced it.
//
// Consequences visible here:
//   * every .cfg executes, not just the ones whose name matches a .tla
//     (12 of 15 collateral configs never ran before this change),
//   * EXPECT-VIOLATION models fail the build when TLC finds no error —
//     a witness that stops firing is a model that has stopped
//     modelling anything, not a passing check,
//   * the exhaustive distinct-state count is asserted, so a spec whose
//     state space moves cannot land quietly,
//   * the jar banner is asserted, so a swapped TLC is loud.
//
// Gracefully no-ops when the toolchain is not configured — but see
// `the TLA+ gate leg actually carries the gate on CI`, which turns the
// no-op into a failure on the one CI leg that is supposed to run it.
//
// Tests remain serialized via the `TLC` xunit collection to bound JVM
// concurrency. Each attempt now owns its copied source workspace and
// traces; cleanup never scans the shared specs directory.
// ═══════════════════════════════════════════════════════════════════


/// xunit collection name — any test type decorated with
/// `[<Collection("TLC")>]` runs serially with every other member
/// of the collection. Use this for every TLC test type that reads
/// or writes files under `src/Core.TLA/specs/`.
[<CollectionDefinition("TLC", DisableParallelization = true)>]
type TlcTestCollection () = class end


let private repoRoot =
    // Walk up from the test assembly directory, NOT the process CWD.
    // xUnit parallelizes test classes, so CWD-mutating tests can race
    // with this module static init (observed as
    // TypeInitializationException on macOS-14 in the Alloy sibling
    // module). AppContext.BaseDirectory is immutable for the lifetime
    // of the AppDomain.
    let mutable dir = DirectoryInfo AppContext.BaseDirectory
    while not (isNull dir) && not (File.Exists (Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then invalidOp "Could not locate repo root (Zeta.sln)"
    dir.FullName


let private tlaJarPath =
    Path.Combine(repoRoot, "src", "Core.TLA", "tla2tools.jar")


let private specsPath = Path.Combine(repoRoot, "src", "Core.TLA", "specs")


let private registryPath = Path.Combine(repoRoot, "registry", "tlc-models.json")


// F# module-level xUnit facts can still be scheduled concurrently despite the
// collection annotation above. Keep the external JVM boundary serialized too.
let private tlcProcessGate = new SemaphoreSlim(1, 1)


// ─── The pinned registry ────────────────────────────────────────────

/// One pinned model run: a module checked under one config, with the
/// verdict the gate demands. Mirrors the TypeScript `TlcModel`.
type PinnedModel =
    { Id: string
      Module: string
      Config: string
      /// "valid" or "violation".
      Expect: string
      /// Substring of the TLC `Error:` line. Required when Expect is
      /// "violation" so a witness that starts violating a DIFFERENT
      /// property fails instead of passing.
      ExpectDetail: string
      ExitCode: int
      /// "gate" or "extended". Only "gate" runs in the PR lane.
      Tier: string
      /// "off-cfg" | "on-vacuous" | "on" — what the deadlock check is
      /// actually worth. "on-vacuous" means Next carries an
      /// unconditional stutter disjunct, so the check CANNOT fail and
      /// the model makes no deadlock-freedom claim.
      Deadlock: string
      /// Asserted. Present only for EXHAUSTIVE runs, which are
      /// worker-independent. Halt-on-violation counts are recorded in
      /// the registry but never asserted.
      DistinctStates: int option }


let private registryRoot =
    JsonDocument.Parse(File.ReadAllText registryPath).RootElement


let private stringProp (element: JsonElement) (name: string) (fallback: string) =
    match element.TryGetProperty name with
    | true, value -> value.GetString()
    | _ -> fallback


let private intProp (element: JsonElement) (name: string) =
    match element.TryGetProperty name with
    | true, value -> Some (value.GetInt32())
    | _ -> None


let private invocationElement = registryRoot.GetProperty "invocation"
let private toolchainElement = registryRoot.GetProperty "toolchain"


/// The pinned JVM arguments, from the registry. Nothing is added here.
let private jvmBase =
    invocationElement.GetProperty("jvm").EnumerateArray()
    |> Seq.map (fun e -> e.GetString())
    |> List.ofSeq


let private jvmDarwinArm64Extra =
    invocationElement.GetProperty("jvmDarwinArm64Extra").EnumerateArray()
    |> Seq.map (fun e -> e.GetString())
    |> List.ofSeq


let private pinnedWorkers = invocationElement.GetProperty("workers").GetInt32()


/// The jar banner the gate demands. A swapped tla2tools.jar changes it,
/// which is the TLC analogue of a solver-version floor — and cheaper,
/// because the jar is committed to the repo rather than resolved from
/// the runner package manager the way z3 and cvc5 are.
let private pinnedBanner = toolchainElement.GetProperty("versionBanner").GetString()


let private allModels =
    registryRoot.GetProperty("models").EnumerateArray()
    |> Seq.map (fun m ->
        { Id = stringProp m "id" ""
          Module = stringProp m "module" ""
          Config = stringProp m "config" ""
          Expect = stringProp m "expect" ""
          ExpectDetail = stringProp m "expectDetail" ""
          ExitCode = defaultArg (intProp m "exitCode") 0
          Tier = stringProp m "tier" ""
          Deadlock = stringProp m "deadlock" ""
          DistinctStates = intProp m "distinctStates" })
    |> List.ofSeq


let private modelById (id: string) =
    allModels |> List.find (fun m -> String.Equals(m.Id, id, StringComparison.Ordinal))


// ─── Invocation ─────────────────────────────────────────────────────

let private currentPlatformIsMacArm64 () =
    System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(
        System.Runtime.InteropServices.OSPlatform.OSX)
    && System.Runtime.InteropServices.RuntimeInformation.OSArchitecture =
       System.Runtime.InteropServices.Architecture.Arm64


/// JVM policy from the registry pin. OpenJDK 26 on macOS/aarch64 has
/// crashed in G1, ParallelGC, and C2 type-speculation cleanup while
/// running this suite, so that one platform keeps C2 and disables only
/// the observed failing optimization; C1-only is materially slower on
/// the largest model.
let tlcJvmArguments (isMacArm64: bool) (errorFilePath: string) =
    [ yield! jvmBase
      if isMacArm64 then yield! jvmDarwinArm64Extra
      yield $"-XX:ErrorFile={errorFilePath}" ]


/// The complete argv after `java`. This is the only place the gate
/// builds a TLC command line, and it may not add a flag the registry
/// does not carry — a flag that is not in the registry is not next to
/// the recorded result.
let buildTlcArguments (model: PinnedModel) (isMacArm64: bool) (errorFilePath: string) (jarPath: string) (metadir: string) =
    [ yield! tlcJvmArguments isMacArm64 errorFilePath
      yield "-cp"
      yield jarPath
      yield "tlc2.TLC"
      yield "-metadir"
      yield metadir
      yield "-workers"
      yield string pinnedWorkers
      yield "-config"
      yield model.Config
      yield model.Module ]


let private which (exe: string) : string option =
    let pathSep =
        if Environment.OSVersion.Platform = PlatformID.Unix
           || Environment.OSVersion.Platform = PlatformID.MacOSX
        then Char.Parse ":" else Char.Parse ";"
    let extensions =
        if pathSep = Char.Parse ";" then [| ".exe"; ".cmd"; ".bat"; "" |] else [| "" |]
    let pathEnv = Environment.GetEnvironmentVariable "PATH"
    if isNull pathEnv then None
    else
        pathEnv.Split pathSep
        |> Seq.collect (fun d -> extensions |> Seq.map (fun e -> Path.Combine(d, exe + e)))
        |> Seq.tryFind File.Exists


let private isCi =
    match Environment.GetEnvironmentVariable "CI" with
    | "true" -> true
    | _ -> false


let private isLinuxX64NonSlim () =
    let isLinux =
        System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(
            System.Runtime.InteropServices.OSPlatform.Linux)
    let isX64 =
        System.Runtime.InteropServices.RuntimeInformation.OSArchitecture =
            System.Runtime.InteropServices.Architecture.X64
    let isLowMemoryWorkflow =
        match Environment.GetEnvironmentVariable "GITHUB_WORKFLOW" with
        | "low-memory" -> true
        | _ -> false
    isLinux && isX64 && not isLowMemoryWorkflow


/// True when the TLC toolchain is configured AND this runner is one we
/// want to exercise. TLC is pure-math computation, so running it on
/// every leg of the matrix is duplicate work; CI filters to standard
/// Linux x64. Dev-local bypasses the filter.
///
/// That filter means the entire TLA+ gate rests on ONE leg. The test
/// `the TLA+ gate leg actually carries the gate on CI` below asserts
/// that leg really ran, so dropping or renaming it fails loudly
/// instead of turning every TLC check into a silent no-op.
let private toolchainReady () : bool =
    if isCi && not (isLinuxX64NonSlim ()) then false
    else
        match which "java" with
        | Some _ when File.Exists tlaJarPath -> true
        | _ -> false


/// Only explicit pre-TLC initialization failures are retryable. Fatal signals,
/// in-run OOM, checker errors and model answers remain failures on attempt one.
let private jvmNeverStarted = TlcAttempts.jvmNeverStarted

[<Literal>]
let private JvmStartAttempts = 3

let internal shouldRetryJvmStart (attempt: int) (exitCode: int) (stdout: string) =
    attempt < JvmStartAttempts && exitCode = 1 && jvmNeverStarted stdout


let private cleanMarker = "Model checking completed. No error has been found"


let private distinctStatesRegex =
    System.Text.RegularExpressions.Regex(@"([\d,]+) distinct states found")


/// The verdict rule. Five independent ways to fail, none of them a
/// matter of taste: the jar banner, the exit code, the completion
/// marker, the pinned error substring, and the pinned exhaustive state
/// count all have to agree with the registry.
let private judge (model: PinnedModel) (exitCode: int) (stdout: string) =
    // Asked BEFORE the banner check, because a JVM that never started cannot print a banner and the
    // absence would otherwise be read as evidence about the jar's version.
    if jvmNeverStarted stdout then
        failwithf
            "TLC DID NOT RUN on %s — the JVM failed to start, so this says NOTHING about the model or the jar's version. NOT toolchain drift: retry, and if it persists give the runner more memory or lower TLC's heap.\nstdout head:\n%s"
            model.Id (stdout.Substring(0, min 400 stdout.Length))

    if not (stdout.Contains(pinnedBanner, StringComparison.Ordinal)) then
        failwithf
            "TOOLCHAIN DRIFT on %s: the registry pins %s and this jar reports something else. A different TLC is a different experiment.\nstdout head:\n%s"
            model.Id pinnedBanner (stdout.Substring(0, min 400 stdout.Length))
    let clean = stdout.Contains(cleanMarker, StringComparison.Ordinal)
    if String.Equals(model.Expect, "violation", StringComparison.Ordinal) then
        // Checked ahead of the exit code because it is the diagnostic
        // that matters: a negative config coming back clean means the
        // model has stopped modelling anything.
        if clean then
            failwithf
                "%s expected the violation %s and TLC found none — the witness has stopped firing, so this config is no longer evidence of anything.\nstdout tail:\n%s"
                model.Id model.ExpectDetail (stdout.Substring(max 0 (stdout.Length - 1200)))
        if not (stdout.Contains(model.ExpectDetail, StringComparison.Ordinal)) then
            failwithf
                "%s expected the violation %s and TLC reported a different one.\nstdout tail:\n%s"
                model.Id model.ExpectDetail (stdout.Substring(max 0 (stdout.Length - 1200)))
    else
        if not clean then
            failwithf "%s expected a clean run; TLC did not report the completion marker (exit %d).\nstdout tail:\n%s"
                model.Id exitCode (stdout.Substring(max 0 (stdout.Length - 1200)))
    if exitCode <> model.ExitCode then
        failwithf "%s exited %d; the registry pins %d. TLC uses 11 for deadlock, 12 for an invariant, 13 for a temporal or action property — the code is part of the claim.\nstdout tail:\n%s"
            model.Id exitCode model.ExitCode (stdout.Substring(max 0 (stdout.Length - 1200)))
    match model.DistinctStates with
    | None -> ()
    | Some expected ->
        // The LAST match, not the first. TLC prints a progress line every
        // minute carrying the same "N distinct states found" shape, so
        // matching the first occurrence reads a partial count off a
        // long-running model and calls it the state space. Caught by this
        // very assertion on BftConsensus (122647 read against a pinned
        // 4665495) the first time it ran.
        let allMatches = distinctStatesRegex.Matches stdout
        let m = if allMatches.Count = 0 then null else allMatches.[allMatches.Count - 1]
        if isNull m then
            failwithf "%s pins %d distinct states but TLC printed no state count." model.Id expected
        let actual = Int32.Parse(m.Groups.[1].Value.Replace(",", "", StringComparison.Ordinal), Globalization.CultureInfo.InvariantCulture)
        if actual <> expected then
            failwithf
                "%s explored %d distinct states; the registry pins %d. An exhaustive count is worker-independent, so this is a real change in the state space — re-measure and update registry/tlc-models.json rather than relaxing the pin."
                model.Id actual expected


// ── Attempt-owned execution and diagnostic retention ──────────────────────

let private gitText arguments =
    let info = ProcessStartInfo("git")
    info.WorkingDirectory <- repoRoot
    info.UseShellExecute <- false
    info.RedirectStandardOutput <- true
    info.RedirectStandardError <- true
    for argument in arguments do info.ArgumentList.Add argument
    use proc = Process.Start info
    let stdout = proc.StandardOutput.ReadToEnd()
    let stderr = proc.StandardError.ReadToEnd()
    proc.WaitForExit()
    if proc.ExitCode <> 0 then invalidOp ("git source identity refused: " + stderr)
    stdout.Trim()

let private runTlcUnlocked (model: PinnedModel) attemptNumber =
    let started = DateTimeOffset.UtcNow
    let diagnosticRoot = Path.Combine(repoRoot, "TestResults", "tlc-diagnostics")
    match TlcAttempts.prepare diagnosticRoot model.Id attemptNumber specsPath (fun () -> TlcAttempts.sourceInputs repoRoot specsPath [|model.Module + ".tla"; model.Config|]) with
    | Error failure ->
        failwithf "TLC input preparation failed: %s; retained diagnostics: %s" failure.Error failure.Directory
    | Ok attempt ->
        let mutable stage = "source-identity"
        try
            let java = which "java" |> Option.defaultWith (fun () -> invalidOp "java is unavailable")
            let argv = buildTlcArguments model (currentPlatformIsMacArm64 ()) attempt.ErrorFile tlaJarPath attempt.Metadir
            let runnerAssembly = typeof<PinnedModel>.Assembly
            TlcAttempts.writeDiagnostic attempt "invocation.json"
                {| Schema = 1; Stage = stage; Runner = "fsharp"; Model = model; Attempt = attemptNumber
                   StartedAtUtc = started; Java = java; Argv = argv; WorkingDirectory = attempt.Workspace
                   TimeoutMilliseconds = Nullable<int>(); Inputs = attempt.Inputs
                   SourceSnapshotMeaning = "working-tree input hashes; SourceCommit is checkout HEAD, not a clean-source assertion"
                   SourceCommit = gitText ["rev-parse"; "HEAD"]
                   RunnerRuntime = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription
                   RunnerAssembly = TlcAttempts.identifyFile runnerAssembly.Location runnerAssembly.Location
                   RunnerAssemblyMvid = runnerAssembly.ManifestModule.ModuleVersionId.ToString("D")
                   Jar = TlcAttempts.identifyFile tlaJarPath tlaJarPath
                   Registry = TlcAttempts.identifyFile registryPath registryPath
                   RunnerSource =
                     [| for name in ["Tlc.Attempts.fs"; "Tlc.Runner.Tests.fs"] do
                            let file = Path.Combine(repoRoot, "tests", "Tests.FSharp", "Formal", name)
                            yield TlcAttempts.identifyFile file file |] |}
            // Initial attempt metadata exists before the identity subprocess can fail.
            stage <- "runtime-identity"
            let versionArgv = [|"-XX:ErrorFile=" + Path.Combine(attempt.Directory, "version_hs_err_pid%p.log"); "-version"|]
            TlcAttempts.writeDiagnostic attempt "runtime-invocation.json"
                {| Stage = stage; Java = java; Argv = versionArgv; WorkingDirectory = attempt.Workspace
                   TimeoutMilliseconds = 30000; TimeoutAction = "kill process tree and retain failure" |}
            let versionOut = Path.Combine(attempt.Directory, "version-stdout.log")
            let versionErr = Path.Combine(attempt.Directory, "version-stderr.log")
            let version = TlcAttempts.captureProcess java versionArgv attempt.Workspace versionOut versionErr (Some 30000)
            TlcAttempts.writeDiagnostic attempt "runtime.json"
                {| Stage = stage; Executable = TlcAttempts.identifyFile java java
                   Platform = System.Runtime.InteropServices.RuntimeInformation.OSDescription
                   Architecture = string System.Runtime.InteropServices.RuntimeInformation.OSArchitecture
                   VersionArgv = versionArgv; ExitCode = version.ExitCode; TimedOut = version.TimedOut
                   TimeoutMilliseconds = 30000
                   Stdout = TlcAttempts.identifyFile versionOut versionOut; Stderr = TlcAttempts.identifyFile versionErr versionErr |}
            if version.ExitCode <> 0 || version.TimedOut then invalidOp "runtime identity subprocess failed or timed out"
            stage <- "tlc-process"
            let captured = TlcAttempts.captureProcess java argv attempt.Workspace attempt.Stdout attempt.Stderr None
            let stdout = File.ReadAllText attempt.Stdout
            let stderr = File.ReadAllText attempt.Stderr
            let output = stdout + stderr
            stage <- "judgement"
            let verdict =
                try judge model captured.ExitCode output; Ok()
                with error -> Error error.Message
            let files, bytes = TlcAttempts.inventory attempt.Metadir
            let workspaceFiles, workspaceBytes = TlcAttempts.inventory attempt.Workspace
            TlcAttempts.writeDiagnostic attempt "completion.json"
                {| Stage = "completed"; FinishedAtUtc = DateTimeOffset.UtcNow; ExitCode = captured.ExitCode
                   Expected = Result.isOk verdict; Reason = (match verdict with Ok() -> "" | Error error -> error)
                   Stdout = TlcAttempts.identifyFile attempt.Stdout attempt.Stdout
                   Stderr = TlcAttempts.identifyFile attempt.Stderr attempt.Stderr
                   StateInventory = {| Files = files; Bytes = bytes |}
                   WorkspaceInventory = {| Files = workspaceFiles; Bytes = workspaceBytes |}
                   StateRetention = (if Result.isOk verdict then "delete this expected attempt only" else "retain complete attempt; no automatic size cap or purge") |}
            TlcAttempts.finish attempt (Result.isOk verdict)
            match verdict with
            | Ok() -> ()
            | Error _ -> Console.Error.WriteLine("TLC attempt retained at " + attempt.Directory)
            captured.ExitCode, output, attempt.Directory, verdict
        with error ->
            try TlcAttempts.writeDiagnostic attempt "runner-failure.json" {| Stage = stage; FinishedAtUtc = DateTimeOffset.UtcNow; Error = error.Message |}
            with _ -> ()
            failwithf "TLC runner failed: %s; retained diagnostics: %s" error.Message attempt.Directory

let private runTlc (model: PinnedModel) =
    tlcProcessGate.Wait()
    try
        let mutable attempt = 1
        let mutable outcome = runTlcUnlocked model attempt
        let retry () =
            let exitCode, output, _, verdict = outcome
            Result.isError verdict && shouldRetryJvmStart attempt exitCode output
        while retry () do
            Console.Error.WriteLine(sprintf "TLC %s: explicit startup failure retained before retry %d/3" model.Id attempt)
            Thread.Sleep 2000
            attempt <- attempt + 1
            outcome <- runTlcUnlocked model attempt
        outcome
    finally
        tlcProcessGate.Release() |> ignore


// ═══════════════════════════════════════════════════════════════════
// The gate. One theory case per pinned model — no hand-maintained
// list, so a config cannot be added to the specs directory and quietly
// not run.
// ═══════════════════════════════════════════════════════════════════

/// xUnit MemberData source: every gate-tier model id. `extended` models
/// are excluded HERE and only here, and each one carries a written
/// tierReason in the registry — a declared gap rather than a silent one.
let gateModelIds : obj array seq =
    allModels
    |> Seq.filter (fun m -> String.Equals(m.Tier, "gate", StringComparison.Ordinal))
    |> Seq.map (fun m -> [| box m.Id |])
    |> List.ofSeq
    :> obj array seq


[<Theory>]
[<MemberData(nameof gateModelIds)>]
let ``TLC checks the pinned model`` (id: string) =
    if not (toolchainReady ()) then () else
    let model = modelById id
    let _, _, directory, verdict = runTlc model
    match verdict with
    | Ok() -> ()
    | Error reason -> failwithf "%s\nFull retained diagnostics: %s" reason directory


[<Fact>]
let ``TLC JVM policy excludes C2 type speculation only on macOS arm64`` () =
    tlcJvmArguments true "error.log"
    |> should equal (jvmBase @ jvmDarwinArm64Extra @ [ "-XX:ErrorFile=error.log" ])
    tlcJvmArguments false "error.log"
    |> should equal (jvmBase @ [ "-XX:ErrorFile=error.log" ])


[<Fact>]
let ``every TLC invocation carries -config and never -deadlock`` () =
    // The defect this file exists to close, asserted rather than
    // promised. -config missing is how twelve collateral configs never
    // executed; -deadlock present is how a hand run disagreed with the
    // gate. Deadlock policy belongs in the .cfg, where it is recorded
    // next to the model, never on a command line nobody wrote down.
    for model in allModels do
        let argv = buildTlcArguments model false "error.log" "jar" "meta"
        argv |> should contain "-config"
        argv |> should contain model.Config
        argv |> should not' (contain "-deadlock")
        argv |> should contain "-workers"


[<Fact>]
let ``every .cfg on disk is claimed by exactly one pinned model`` () =
    // The F# half of the drift guard (the TypeScript half is
    // src/Core.TypeScript/hygiene/lint-tlc-model-registry.ts). A config
    // that no model claims is a check that does not run, and a check
    // that did not run must never look like a check that passed.
    let onDisk =
        Directory.GetFiles(specsPath, "*.cfg")
        |> Array.map Path.GetFileName
        |> Array.sort
    let claimed =
        allModels
        |> List.map (fun m -> m.Config)
        |> Set.ofList
    let unclaimed = onDisk |> Array.filter (fun c -> not (claimed.Contains c))
    unclaimed |> should be Empty
    for model in allModels do
        File.Exists(Path.Combine(specsPath, model.Config)) |> should be True
        File.Exists(Path.Combine(specsPath, model.Module + ".tla")) |> should be True


[<Fact>]
let ``the registry pins a violation string for every EXPECT-VIOLATION model`` () =
    // Without this, a negative config could pass by violating some
    // other property — the witness would still fire and would no longer
    // be witnessing the thing it was written for.
    for model in allModels do
        if String.Equals(model.Expect, "violation", StringComparison.Ordinal) then
            model.ExpectDetail |> should not' (be EmptyString)
            model.ExitCode |> should not' (equal 0)


[<Fact>]
let ``the TLA+ gate leg actually carries the gate on CI`` () =
    // toolchainReady() filters TLC to one leg of the CI matrix. That is
    // reasonable de-duplication and it is also a single point of silent
    // failure: if that leg is dropped or renamed, every TLC check stops
    // running and every test still passes. On the leg that is supposed
    // to carry the gate, a missing toolchain is a FAILURE, not a skip.
    if not isCi then () else
    if not (isLinuxX64NonSlim ()) then () else
    File.Exists tlaJarPath |> should be True
    (which "java").IsSome |> should be True


[<Fact>]
let ``models that cannot deadlock say so in the registry`` () =
    // QuorumCollateral and WagerSolvency carry an unconditional stutter
    // disjunct in Next, so a deadlock is unreachable by construction and
    // their deadlock check CANNOT fail. Neither makes a
    // deadlock-freedom claim and neither should be read as making one.
    // Recording that as `on-vacuous` puts the caveat in the artefact
    // instead of only in the prose of a research document.
    let vacuous =
        allModels
        |> List.filter (fun m -> String.Equals(m.Deadlock, "on-vacuous", StringComparison.Ordinal))
        |> List.map (fun m -> m.Id)
    vacuous |> should contain "QuorumCollateral"
    vacuous |> should contain "WagerSolvency"
    for model in allModels do
        [ "off-cfg"; "on-vacuous"; "on" ] |> should contain model.Deadlock


// ── "TLC did not run" is not "TLC is the wrong version" ──────────────────────
//
// `judge`'s first question used to be the banner, and a missing banner was reported as TOOLCHAIN
// DRIFT. But a JVM that never started cannot print a banner either, so one verdict covered two
// causes that call for opposite responses: drift is an operator's job, a failed JVM is a retry.
//
// Observed once in three full-suite runs on 2026-09-03 — under the memory pressure of the whole F#
// suite the JVM reported `Could not reserve enough space for object heap`, and the test announced
// that the jar was a different TLC. A reader would have gone looking for a version mismatch that did
// not exist. Same class as `forge-diagnosis`: a failure whose KIND is misreported costs more than
// the failure.

let private aModel =
    { Id = "FixtureModel"
      Module = "Fixture"
      Config = "Fixture.cfg"
      Expect = "valid"
      ExpectDetail = ""
      ExitCode = 0
      Tier = "gate"
      Deadlock = "on"
      DistinctStates = None }

[<Fact>]
let ``a JVM that never started is reported as such, not as toolchain drift`` () =
    let jvmDied =
        "Error occurred during initialization of VM\nCould not reserve enough space for object heap\n"

    let ex = Assert.Throws<Exception>(fun () -> judge aModel 1 jvmDied)

    // The verdict must name what happened…
    Assert.Contains("TLC DID NOT RUN", ex.Message)
    // …and must NOT send the reader after a jar mismatch that does not exist.
    Assert.DoesNotContain("TOOLCHAIN DRIFT", ex.Message)
    // A run that did not happen says nothing about the model either way — the message says so, so
    // the failure cannot be read as evidence about the specification.
    Assert.Contains("NOTHING about the model", ex.Message)

[<Fact>]
let ``a jar reporting a different version IS toolchain drift`` () =
    // The other half. A guard that called everything an environment fault would be as wrong as the
    // one that called everything drift, and it would silently accept an unpinned checker.
    let wrongJar = "TLC2 Version 1900.01.01.000000 (rev: deadbee)\nModel checking completed.\n"

    let ex = Assert.Throws<Exception>(fun () -> judge aModel 0 wrongJar)

    Assert.Contains("TOOLCHAIN DRIFT", ex.Message)
    Assert.DoesNotContain("TLC DID NOT RUN", ex.Message)


// ── The retry POLICY, tested without launching a JVM ─────────────────────────

[<Fact>]
let ``a JVM that never started is retried`` () =
    // The observed case: -Xmx4g cannot be reserved while the whole suite runs.
    Assert.True(shouldRetryJvmStart 1 1 "Could not reserve enough space for object heap")

[<Fact>]
let ``the retry is BOUNDED — a persistent shortage still fails`` () =
    // Without this the run would spin on a box that simply does not have the memory, and a hang is
    // a worse failure than a red test because nothing reports it.
    Assert.False(shouldRetryJvmStart JvmStartAttempts 1 "Could not reserve enough space for object heap")

[<Fact>]
let ``an ANSWER is never retried`` () =
    // The half that matters most. TLC reporting a violation, a wrong banner, or a missing completion
    // marker has ANSWERED; re-asking is how a real, reproducible failure becomes intermittent — and
    // an intermittent failure is one people learn to re-run rather than read.
    Assert.False(shouldRetryJvmStart 1 1 "Error: Invariant Solvency is violated.")
    Assert.False(shouldRetryJvmStart 1 1 "TLC2 Version 1900.01.01.000000 (rev: deadbee)")
    Assert.False(shouldRetryJvmStart 1 1 "Model checking completed. No error has been found")


[<Fact>]
let ``startup retry policy agrees with the cross-runner refusal roster`` () =
    use fixture = JsonDocument.Parse(File.ReadAllText(Path.Combine(repoRoot, "registry", "tlc-retry-fixtures.json")))
    for row in fixture.RootElement.GetProperty("Cases").EnumerateArray() do
        let output = row.GetProperty("Stdout").GetString() + "\n" + row.GetProperty("Stderr").GetString()
        let expected = row.GetProperty("Retryable").GetBoolean()
        let signalFree = row.GetProperty("Signal").ValueKind = JsonValueKind.Null
        let processError = row.GetProperty("ProcessError").GetBoolean()
        let exitCode = row.GetProperty("ExitCode").GetInt32()
        Assert.Equal(expected, signalFree && not processError && shouldRetryJvmStart 1 exitCode output)
        Assert.False(shouldRetryJvmStart 3 1 output)


[<Fact>]
let ``a valid completion followed by fatal nonzero exit remains a failed answer`` () =
    let output = pinnedBanner + "\n" + cleanMarker + "\nSIGBUS\nhs_err_pid42.log"
    Assert.Throws<Exception>(fun () -> judge aModel 134 output) |> ignore
    Assert.False(shouldRetryJvmStart 1 1 output)


[<Fact>]
let ``failed attempt streams states and helper inputs survive later expected cleanup`` () =
    let scratch = Path.Combine(Path.GetTempPath(), "tlc-retention-fixture-" + Guid.NewGuid().ToString("N"))
    Directory.CreateDirectory scratch |> ignore
    try
        File.WriteAllText(Path.Combine(scratch, "Fixture.tla"), "---- MODULE Fixture ----\nEXTENDS Helper\n====\n")
        File.WriteAllText(Path.Combine(scratch, "Helper.tla"), "---- MODULE Helper ----\nVALUE == 1\n====\n")
        File.WriteAllText(Path.Combine(scratch, "Fixture.cfg"), "SPECIFICATION Spec\n")
        let foreign = Path.Combine(scratch, "Fixture_TTrace_foreign.tla")
        File.WriteAllText(foreign, "preexisting trace")
        let sources () = [|"Fixture.tla"; "Helper.tla"; "Fixture.cfg"|]
        let prepare number =
            match TlcAttempts.prepare (Path.Combine(scratch, "diagnostics")) "Fixture" number scratch sources with
            | Ok value -> value
            | Error failure -> failwith failure.Error
        let first, second = prepare 1, prepare 2
        Assert.NotEqual<string>(first.Directory, second.Directory)
        Assert.NotEqual<string>(first.ErrorFile, second.ErrorFile)
        Assert.Equal(3, first.Inputs.Length)
        Assert.True(first.Inputs |> Array.forall (fun input -> input.Source = input.Copied))
        Assert.Contains("VALUE == 1", File.ReadAllText(Path.Combine(first.Workspace, "Helper.tla")))
        Assert.False(File.Exists(Path.Combine(first.Workspace, "Fixture_TTrace_foreign.tla")))
        let fullLog = "first sentinel\n" + String('x', 65536) + "\nlast sentinel"
        File.WriteAllText(first.Stdout, fullLog)
        File.WriteAllText(first.Stderr, "fatal stderr")
        File.WriteAllText(Path.Combine(first.Directory, "hs_err_pid42.log"), "crash identity")
        File.WriteAllBytes(Path.Combine(first.Metadir, "state.bin"), [|1uy;2uy;3uy;4uy|])
        TlcAttempts.writeDiagnostic first "completion.json" {| Expected = false |}
        Assert.Throws<IOException>(fun () -> TlcAttempts.writeDiagnostic first "completion.json" {| Expected = true |}) |> ignore
        TlcAttempts.finish first false
        TlcAttempts.finish second true
        Assert.Equal(fullLog, File.ReadAllText first.Stdout)
        Assert.Equal("crash identity", File.ReadAllText(Path.Combine(first.Directory, "hs_err_pid42.log")))
        Assert.Equal((1,4L), TlcAttempts.inventory first.Metadir)
        Assert.False(Directory.Exists second.Directory)
        Assert.Equal("preexisting trace", File.ReadAllText foreign)
    finally Directory.Delete(scratch, true)


[<Fact>]
let ``source inventory and copy refusals retain explicit attempt metadata`` () =
    let scratch = Path.Combine(Path.GetTempPath(), "tlc-copy-fixture-" + Guid.NewGuid().ToString("N"))
    Directory.CreateDirectory scratch |> ignore
    try
        let inventories =
            [ (fun () -> [|"missing.tla"|]); (fun () -> [|"../escape.tla"|])
              (fun () -> [|"Fixture_TTrace_old.tla"|]); (fun () -> failwith "source identity unavailable") ]
        for sources in inventories do
            match TlcAttempts.prepare (Path.Combine(scratch, "diagnostics")) "Fixture" 1 scratch sources with
            | Ok _ -> failwith "expected explicit source-copy refusal"
            | Error failure ->
                Assert.True(File.Exists(Path.Combine(failure.Directory, "attempt.json")))
                Assert.True(File.Exists(Path.Combine(failure.Directory, "preparation-failure.json")))
    finally Directory.Delete(scratch, true)


[<Fact>]
let ``actual source collection admits unstaged and new helpers but refuses ignored helpers`` () =
    let scratch = Path.Combine(Path.GetTempPath(), "tlc-source-fixture-" + Guid.NewGuid().ToString("N"))
    let specs = Path.Combine(scratch, "src", "Core.TLA", "specs")
    Directory.CreateDirectory specs |> ignore
    let git arguments =
        let info = ProcessStartInfo("git")
        info.WorkingDirectory <- scratch
        info.UseShellExecute <- false
        info.RedirectStandardOutput <- true
        info.RedirectStandardError <- true
        for argument in arguments do info.ArgumentList.Add argument
        use proc = Process.Start info
        let stdout = proc.StandardOutput.ReadToEnd()
        let stderr = proc.StandardError.ReadToEnd()
        proc.WaitForExit()
        Assert.True(proc.ExitCode = 0, stdout + stderr)
    try
        git ["init"; "--quiet"]
        File.WriteAllText(Path.Combine(specs, "Fixture.tla"), "tracked original")
        File.WriteAllText(Path.Combine(specs, "Fixture.cfg"), "tracked config")
        git ["add"; "src"]
        File.WriteAllText(Path.Combine(specs, "Fixture.tla"), "unstaged changed bytes")
        File.WriteAllText(Path.Combine(specs, "New.tla"), "---- MODULE New ----\nEXTENDS Helper\n====")
        File.WriteAllText(Path.Combine(specs, "Helper.tla"), "new untracked helper")
        File.WriteAllText(Path.Combine(specs, "New.cfg"), "new untracked selected config")
        File.WriteAllText(Path.Combine(specs, "Fixture_TTrace_old.tla"), "foreign generated trace")
        let sources () = TlcAttempts.sourceInputs scratch specs [|"New.tla"; "New.cfg"|]
        Assert.True((sources() |> Array.sort) = [|"Fixture.cfg"; "Fixture.tla"; "Helper.tla"; "New.cfg"; "New.tla"|])
        let attempt =
            match TlcAttempts.prepare (Path.Combine(scratch, "diagnostics")) "New" 1 specs sources with
            | Ok value -> value
            | Error failure -> failwith failure.Error
        Assert.Equal("unstaged changed bytes", File.ReadAllText(Path.Combine(attempt.Workspace, "Fixture.tla")))
        Assert.Equal("new untracked helper", File.ReadAllText(Path.Combine(attempt.Workspace, "Helper.tla")))
        File.WriteAllText(Path.Combine(scratch, ".gitignore"), "Ignored.tla\n")
        File.WriteAllText(Path.Combine(specs, "Ignored.tla"), "must not silently omit this helper")
        let error = Assert.Throws<InvalidOperationException>(fun () -> sources() |> ignore)
        Assert.Contains("ignored local source input would be omitted: Ignored.tla", error.Message)
    finally Directory.Delete(scratch, true)


[<Fact>]
let ``owned process capture retains probe streams and bounds timeout without Java`` () =
    let scratch = Path.Combine(Path.GetTempPath(), "tlc-process-fixture-" + Guid.NewGuid().ToString("N"))
    Directory.CreateDirectory scratch |> ignore
    try
        let bun = which "bun" |> Option.defaultWith (fun () -> failwith "synthetic process fixture requires the configured Bun runtime")
        let stdout = Path.Combine(scratch, "stdout.log")
        let stderr = Path.Combine(scratch, "stderr.log")
        let result = TlcAttempts.captureProcess bun ["-e"; "console.log('output sentinel');console.error('error sentinel')"] scratch stdout stderr (Some 3000)
        Assert.Equal(0, result.ExitCode)
        Assert.False result.TimedOut
        Assert.Contains("output sentinel", File.ReadAllText stdout)
        Assert.Contains("error sentinel", File.ReadAllText stderr)
        Assert.ThrowsAny<System.ComponentModel.Win32Exception>(fun () ->
            TlcAttempts.captureProcess (Path.Combine(scratch, "missing-executable")) [] scratch (Path.Combine(scratch, "missing-out")) (Path.Combine(scratch, "missing-err")) (Some 100) |> ignore) |> ignore
        let timed = TlcAttempts.captureProcess bun ["-e"; "setTimeout(()=>{},10000)"] scratch (Path.Combine(scratch, "timed-out")) (Path.Combine(scratch, "timed-err")) (Some 40)
        Assert.True timed.TimedOut
        Assert.False(not timed.TimedOut && shouldRetryJvmStart 1 timed.ExitCode "Error occurred during initialization of VM")
        let partial = Path.Combine(scratch, "partial-open")
        Assert.Throws<IOException>(fun () -> TlcAttempts.captureProcess bun [] scratch partial stderr (Some 100) |> ignore) |> ignore
        // If opening stderr failed, stdout's earlier descriptor must already be disposed.
        use exclusive = new FileStream(partial, FileMode.Open, FileAccess.ReadWrite, FileShare.None)
        Assert.Equal(0L, exclusive.Length)
        Assert.Contains("error sentinel", File.ReadAllText stderr)
    finally Directory.Delete(scratch, true)
