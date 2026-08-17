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
// Tests are serialized via the `TLC` xunit collection: TLC dumps
// counterexample traces into the specs directory and parallel runs
// race on cleanup.
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


/// Runs TLC on one pinned model. Returns `(exitCode, stdout)`.
let private runTlcUnlocked (model: PinnedModel) : int * string =
    if not (File.Exists tlaJarPath) then
        failwithf "TLC jar not found at %s — run tools/setup/install.sh" tlaJarPath
    let tempDir = Path.Combine(Path.GetTempPath(), $"tlc_run_{model.Id}_{Guid.NewGuid().ToString()}")
    let errorFilePath = Path.Combine(tempDir, "hs_err_pid%p.log")
    Directory.CreateDirectory(tempDir) |> ignore
    let psi = ProcessStartInfo()
    psi.FileName <- "java"
    psi.WorkingDirectory <- specsPath
    for argument in buildTlcArguments model (currentPlatformIsMacArm64 ()) errorFilePath tlaJarPath tempDir do
        psi.ArgumentList.Add argument
    psi.RedirectStandardOutput <- true
    psi.RedirectStandardError <- true
    psi.UseShellExecute <- false
    use p = Process.Start psi
    let stdoutTask = p.StandardOutput.ReadToEndAsync()
    let stderrTask = p.StandardError.ReadToEndAsync()
    p.WaitForExit()
    let stdout = stdoutTask.GetAwaiter().GetResult()
    let stderr = stderrTask.GetAwaiter().GetResult()
    try Directory.Delete(tempDir, true) with _ -> ()
    // Clean up TLC trace dumps so repeated runs do not litter the repo.
    // TLC emits both a `.tla` mini-spec and a `.bin` state dump whenever
    // it finds a counterexample — which the EXPECT-VIOLATION models do
    // every single run, by design.
    for f in Directory.GetFiles(specsPath, $"{model.Module}_TTrace_*.tla") do
        try File.Delete f with _ -> ()
    for f in Directory.GetFiles(specsPath, $"{model.Module}_TTrace_*.bin") do
        try File.Delete f with _ -> ()
    for f in Directory.GetFiles(specsPath, "MC*.tla") do
        try File.Delete f with _ -> ()
    p.ExitCode, stdout + stderr


let private runTlc (model: PinnedModel) : int * string =
    tlcProcessGate.Wait()
    try runTlcUnlocked model
    finally tlcProcessGate.Release() |> ignore


let private cleanMarker = "Model checking completed. No error has been found"


let private distinctStatesRegex =
    System.Text.RegularExpressions.Regex(@"([\d,]+) distinct states found")


/// The verdict rule. Five independent ways to fail, none of them a
/// matter of taste: the jar banner, the exit code, the completion
/// marker, the pinned error substring, and the pinned exhaustive state
/// count all have to agree with the registry.
let private judge (model: PinnedModel) (exitCode: int) (stdout: string) =
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
    let (exitCode, stdout) = runTlc model
    judge model exitCode stdout


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
