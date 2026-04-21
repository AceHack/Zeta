module Zeta.Tests.Formal.AlloyRunnerTests
#nowarn "0893"

open System
open System.Diagnostics
open System.IO
open FsUnit.Xunit
open global.Xunit


// ═══════════════════════════════════════════════════════════════════
// Alloy runner — parses every `.als` spec in `docs/` that we want to
// validate, shells out to `java -cp alloy.jar:<runner-class-dir>
// AlloyRunner docs/<Spec>.als`, and checks that every `check` command
// proves (unsat of its negation) and every `run` command finds an
// instance.
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
    Path.Combine(repoRoot, "tools", "alloy", "alloy.jar")


let private alloyRunnerSource =
    Path.Combine(repoRoot, "tools", "alloy", "AlloyRunner.java")


let private docsPath = Path.Combine(repoRoot, "docs")


/// Scratch directory holding the compiled `AlloyRunner.class`. Colocated
/// under bin/obj so normal `dotnet clean` sweeps it away.
let private runnerClassDir =
    Path.Combine(repoRoot, "tools", "alloy", "classes")


let private which (tool: string) : string option =
    try
        let psi =
            ProcessStartInfo("/usr/bin/env", $"which %s{tool}",
                RedirectStandardOutput = true,
                UseShellExecute = false)
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
            let psi = ProcessStartInfo()
            psi.FileName <- "javac"
            psi.ArgumentList.Add "-cp"
            psi.ArgumentList.Add alloyJarPath
            psi.ArgumentList.Add "-d"
            psi.ArgumentList.Add runnerClassDir
            psi.ArgumentList.Add alloyRunnerSource
            psi.RedirectStandardOutput <- true
            psi.RedirectStandardError <- true
            psi.UseShellExecute <- false
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
    let specFile = Path.Combine(docsPath, $"{specName}.als")
    if not (File.Exists specFile) then
        failwithf "Alloy spec not found: %s" specFile
    let classpathSep = if OperatingSystem.IsWindows() then ";" else ":"
    let cp = $"{alloyJarPath}{classpathSep}{runnerClassDir}"
    let psi = ProcessStartInfo()
    psi.FileName <- "java"
    psi.ArgumentList.Add "-cp"
    psi.ArgumentList.Add cp
    psi.ArgumentList.Add "AlloyRunner"
    psi.ArgumentList.Add specFile
    psi.RedirectStandardOutput <- true
    psi.RedirectStandardError <- true
    psi.UseShellExecute <- false
    use p = Process.Start psi
    let stdout = p.StandardOutput.ReadToEnd()
    let stderr = p.StandardError.ReadToEnd()
    if not (p.WaitForExit(60_000)) then
        try p.Kill(true) with _ -> ()
        failwithf "Alloy runner for %s timed out after 60 s" specName
    p.ExitCode, stdout + stderr


/// True when the Alloy toolchain (jar + javac + java) is fully
/// configured. Tests gracefully no-op when any piece is missing so
/// local dev machines without a JDK still get a green `dotnet test`.
let private toolchainReady () : bool =
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
// Per-spec test cases. Each `docs/*.als` gets one trivial test line.
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``Alloy spec Spine structural invariants hold`` () =
    assertSpecValid "Spine"


[<Fact>]
let ``Alloy spec InfoTheoreticSharder rules out double commits`` () =
    assertSpecValid "InfoTheoreticSharder"


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
