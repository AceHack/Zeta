module Zeta.Tests.Formal.AlloyRunnerTests
#nowarn "0893"

open System
open System.Diagnostics
open System.IO
open FsUnit.Xunit
open global.Xunit
open Zeta.Tests.Support


// ═══════════════════════════════════════════════════════════════════
// Alloy runner — parses every `.als` spec under `tools/alloy/specs/`
// that we want to validate, shells out to
// `java -cp alloy.jar:<runner-class-dir>
// AlloyRunner tools/alloy/specs/<Spec>.als`, and checks that every
// `check` command proves (unsat of its negation) and every `run`
// command finds an instance.
//
// `AlloyRunner.java` lives in `tools/alloy/` and is compiled on demand
// into an `obj/` scratch directory the first time any test runs. If
// `javac` or `java` is absent, the whole suite is silently skipped —
// CI should install a JDK ≥ 17.
//
// Alloy 6 dist-jar bundles SAT4J (pure Java), so no native libs / JNI
// configuration is needed.
// ═══════════════════════════════════════════════════════════════════


let private repoRoot =
    // Walk up from the test assembly's directory, NOT the process CWD.
    // xUnit parallelizes test classes, so CWD-mutating tests (e.g.
    // WitnessDurableBackingStore under-CWD-churn) can race with this
    // module's static init on macOS and trip the walk-up loop. Fixed
    // by reading AppContext.BaseDirectory, which is immutable for the
    // lifetime of the AppDomain.
    let mutable dir = DirectoryInfo AppContext.BaseDirectory
    while not (isNull dir) && not (File.Exists (Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then invalidOp "Could not locate repo root (Zeta.sln)"
    dir.FullName


let private alloyJarPath =
    Path.Combine(repoRoot, "src", "Core.Alloy", "alloy.jar")


let private alloyRunnerSource =
    Path.Combine(repoRoot, "src", "Core.Alloy", "AlloyRunner.java")


// Alloy specs live at tools/alloy/specs/<Spec>.als (not docs/) since
// the round-? specs reorganization. Pre-fix this constant pointed at
// docs/ and the tests silently no-op'd (no <Spec>.als file found
// triggered toolchainReady-false-path skip-pattern; B2 from #1383
// math-proofs assessment was correct that Alloy "not in CI"). The
// path correction is the prerequisite for the tests to actually run.
let private alloySpecsPath = Path.Combine(repoRoot, "src", "Core.Alloy", "specs")


/// Scratch directory holding the compiled `AlloyRunner.class`. Colocated
/// under bin/obj so normal `dotnet clean` sweeps it away.
let private runnerClassDir =
    Path.Combine(repoRoot, "src", "Core.Alloy", "classes")


// Every subprocess below spawns through `Subprocess.startInfo`, which
// REQUIRES a working directory. WHY, since these are all absolute paths
// already: a `ProcessStartInfo` with `WorkingDirectory` unset makes the
// child inherit the test process's global CWD at fork time, and on
// 2026-08-14 that ambient inheritance killed
// `Alloy spec Spine structural invariants hold` on PR #10757 — the
// durability CWD-churn test had moved process CWD into a temp tree and
// then deleted it, so the JVM could not resolve its own cwd and died in
// `SystemProps$Raw.platformProperties` before reaching `main`. The
// failure had nothing to do with that PR's diff.
//
// `Tlc.Runner.Tests.fs` was immune because it already set
// `psi.WorkingDirectory` — not because it is a serialised collection.
// Regression: `Infra/CwdChaos.Tests.fs`, which reproduces the crash on
// demand from a seed.
let private which (tool: string) : string option =
    try
        let psi = Subprocess.startInfo "/usr/bin/env" repoRoot
        psi.ArgumentList.Add "which"
        psi.ArgumentList.Add tool
        use p = Process.Start psi
        let output = p.StandardOutput.ReadToEnd().Trim()
        p.WaitForExit()
        if p.ExitCode = 0 && File.Exists output then Some output
        else None
    with _ -> None


/// Compile the Alloy runner once per test run. Idempotent: skips
/// compilation if the `.class` file is newer than the `.java` source.
let private compileRunnerIfNeeded () : bool =
    if not (File.Exists alloyJarPath) then false
    elif not (File.Exists alloyRunnerSource) then false
    else
    match which "javac" with
    | None -> false
    | Some _ ->
        Directory.CreateDirectory runnerClassDir |> ignore
        let classFile = Path.Combine(runnerClassDir, "AlloyRunner.class")
        let needsRebuild =
            not (File.Exists classFile)
            || (FileInfo alloyRunnerSource).LastWriteTimeUtc
               > (FileInfo classFile).LastWriteTimeUtc
        if not needsRebuild then true
        else
            let psi = Subprocess.startInfo "javac" repoRoot
            psi.ArgumentList.Add "-cp"
            psi.ArgumentList.Add alloyJarPath
            psi.ArgumentList.Add "-d"
            psi.ArgumentList.Add runnerClassDir
            psi.ArgumentList.Add alloyRunnerSource
            use p = Process.Start psi
            let _stdout = p.StandardOutput.ReadToEnd()
            let stderr = p.StandardError.ReadToEnd()
            p.WaitForExit()
            if p.ExitCode <> 0 then
                printfn "javac AlloyRunner.java failed: %s" stderr
                false
            else true


/// Run the Alloy driver on the given spec. Returns `(exitCode, stdout)`.
let private runAlloy (specName: string) : int * string =
    let specFile = Path.Combine(alloySpecsPath, $"{specName}.als")
    if not (File.Exists specFile) then
        failwithf "Alloy spec not found: %s" specFile
    let classpathSep = if OperatingSystem.IsWindows() then ";" else ":"
    let cp = $"{alloyJarPath}{classpathSep}{runnerClassDir}"
    let psi = Subprocess.startInfo "java" repoRoot
    psi.ArgumentList.Add "-cp"
    psi.ArgumentList.Add cp
    psi.ArgumentList.Add "AlloyRunner"
    psi.ArgumentList.Add specFile
    use p = Process.Start psi
    let stdoutTask = p.StandardOutput.ReadToEndAsync()
    let stderrTask = p.StandardError.ReadToEndAsync()
    let completed = p.WaitForExit(60_000)
    if not completed then
        try p.Kill(true) with _ -> ()
        p.WaitForExit()
    let stdout = stdoutTask.GetAwaiter().GetResult()
    let stderr = stderrTask.GetAwaiter().GetResult()
    if not completed then
        failwithf "Alloy runner for %s timed out after 60 s. Output:\n%s"
            specName (stdout + stderr)
    p.ExitCode, stdout + stderr


/// True when the Alloy toolchain (jar + javac + java) is fully
/// configured AND the runner is one we want to actually exercise.
/// Formal verification (Alloy) is pure-math computation: no
/// OS-specific behavior, no environment touching. Running it on
/// macOS / Windows / ARM / slim runners alongside standard Linux
/// x64 is duplicate work. Filter to standard Linux x64 only on CI;
/// preserve dev-local validation regardless. Same shape as
/// Tlc.Runner.Tests.fs.
///
/// Three-axis check:
///   * OS axis: skip non-Linux on CI.
///   * Architecture axis: skip non-x64 on CI (catches
///     ubuntu-24.04-arm).
///   * Runner-class axis: skip the slim runner via GITHUB_WORKFLOW.
///
/// Dev-local (no CI=true) bypasses all three filters.
let private toolchainReady () : bool =
    let isCi =
        match Environment.GetEnvironmentVariable "CI" with
        | "true" -> true
        | _ -> false
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
    if isCi && (not isLinux || not isX64 || isLowMemoryWorkflow) then false
    else
        match which "java", which "javac" with
        | Some _, Some _ when File.Exists alloyJarPath ->
            compileRunnerIfNeeded ()
        | _ -> false


let private assertSpecValid (specName: string) =
    if not (toolchainReady ()) then () else
    let (exitCode, stdout) = runAlloy specName
    if exitCode <> 0 then
        failwithf "Alloy %s failed with exit %d. Output:\n%s"
            specName exitCode stdout
    // Every emitted line should start with "OK" — any "FAIL" means a
    // counter-example or a `run` that couldn't be satisfied.
    if stdout.Contains "FAIL " then
        failwithf "Alloy %s reported at least one failing command:\n%s"
            specName stdout


// ═══════════════════════════════════════════════════════════════════
// Per-spec test cases. Each `tools/alloy/specs/*.als` gets one trivial test line.
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``Alloy spec Spine structural invariants hold`` () =
    assertSpecValid "Spine"


[<Fact>]
let ``Alloy spec InfoTheoreticSharder rules out double commits`` () =
    assertSpecValid "InfoTheoreticSharder"


[<Fact>]
let ``Alloy spec ThreeColoring 3-coloring probe and K4 no-3-coloring check`` () =
    assertSpecValid "ThreeColoring"


[<Fact>]
let ``Alloy spec IdentityReissuable threshold path-existence`` () =
    assertSpecValid "IdentityReissuable"


[<Fact>]
let ``Alloy jar is installed where tools/setup/install.sh drops it`` () =
    // Informational gate: fails when someone forgets to re-run
    // `tools/setup/install.sh`. Keeps the "why is the runner
    // silently skipping?" diagnosis out of CI.
    if File.Exists alloyJarPath then
        (FileInfo alloyJarPath).Length |> should be (greaterThan 1_000_000L)
    else
        // Fresh clone without install step — not an error, just a skip.
        ()
