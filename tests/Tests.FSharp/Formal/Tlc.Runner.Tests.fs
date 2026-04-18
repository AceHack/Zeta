module Zeta.Tests.Formal.TlcRunnerTests
#nowarn "0893"

open System.Diagnostics
open System.IO
open FsUnit.Xunit
open global.Xunit


// ═══════════════════════════════════════════════════════════════════
// TLC model-checker runner — shells out to `java -cp tla2tools.jar
// tlc2.TLC <SpecName>` for each `docs/*.tla` we want to validate.
// Treats spec-check output as a test assertion: parse error or
// invariant violation → fail.
//
// Assumes `java` is on PATH and `tools/tla/tla2tools.jar` exists
// (dowloaded from https://github.com/tlaplus/tlaplus/releases).
//
// This is the CI hook that keeps specs from drifting away from the
// real F# code — if a spec becomes inconsistent, the test breaks.
// ═══════════════════════════════════════════════════════════════════


let private repoRoot =
    // Walk up from bin/Release/net10.0 to the repo root.
    let cwd = Directory.GetCurrentDirectory()
    let mutable dir = DirectoryInfo cwd
    while not (isNull dir) && not (File.Exists (Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then invalidOp "Could not locate repo root (Zeta.sln)"
    dir.FullName


let private tlaJarPath =
    Path.Combine(repoRoot, "tools", "tla", "tla2tools.jar")


let private docsPath = Path.Combine(repoRoot, "docs")


/// Runs TLC on a single spec. Returns `(exitCode, stdout)`.
let private runTlc (specName: string) : int * string =
    // Assume java is on PATH. If it's not, the user sees a clear
    // ProcessStartInfo error.
    if not (File.Exists tlaJarPath) then
        failwithf "TLC jar not found at %s — run tools/install-verifiers.sh" tlaJarPath
    let psi = ProcessStartInfo()
    psi.FileName <- "java"
    psi.WorkingDirectory <- docsPath
    psi.ArgumentList.Add "-cp"
    psi.ArgumentList.Add tlaJarPath
    psi.ArgumentList.Add "tlc2.TLC"
    psi.ArgumentList.Add specName
    psi.RedirectStandardOutput <- true
    psi.RedirectStandardError <- true
    psi.UseShellExecute <- false
    use p = Process.Start psi
    let stdout = p.StandardOutput.ReadToEnd()
    let _stderr = p.StandardError.ReadToEnd()
    p.WaitForExit()
    // Clean up TLC's trace-dump files so repeated runs don't litter the
    // repo. TLC emits both a `.tla` mini-spec and a `.bin` state-dump
    // whenever it finds a counterexample; we drop both so subsequent
    // passes don't pick up stale failures.
    for f in Directory.GetFiles(docsPath, $"{specName}_TTrace_*.tla") do
        try File.Delete f with _ -> ()
    for f in Directory.GetFiles(docsPath, $"{specName}_TTrace_*.bin") do
        try File.Delete f with _ -> ()
    for f in Directory.GetFiles(docsPath, "MC*.tla") do
        try File.Delete f with _ -> ()
    p.ExitCode, stdout


/// The smoke test — proves Java + tla2tools.jar + `.tla`/`.cfg`
/// resolution all work end-to-end on this box. Runs every CI pass;
/// if it breaks, Java/TLC is misconfigured and none of the other
/// TLC tests can be trusted.
[<Fact>]
let ``TLC can check the SmokeCheck spec`` () =
    let (exitCode, stdout) = runTlc "SmokeCheck"
    // TLC returns 0 on success with no violations.
    if exitCode <> 0 then
        failwithf "TLC SmokeCheck failed with exit %d. stdout:\n%s" exitCode stdout
    // Confirm TLC actually found + validated the invariant.
    stdout |> should haveSubstring "No error has been found"


/// Run TLC on a spec and assert success. Generic helper so each
/// `docs/*.tla` gets one trivial test line each.
let private assertSpecValid (specName: string) =
    let (exitCode, stdout) = runTlc specName
    if exitCode <> 0 then
        failwithf "TLC %s failed with exit %d. stdout:\n%s" specName exitCode stdout


// ═══════════════════════════════════════════════════════════════════
// One test per real spec. When TLC can't check a spec (no .cfg yet,
// unbounded state space, etc.) we gate on the presence of a .cfg
// and skip rather than fail — each spec gets a .cfg over time.
// ═══════════════════════════════════════════════════════════════════


let private specExists (name: string) =
    File.Exists(Path.Combine(docsPath, $"{name}.tla"))
    && File.Exists(Path.Combine(docsPath, $"{name}.cfg"))


[<Fact>]
let ``All documented TLA specs have their .tla file on disk`` () =
    let specs =
        [ "DbspSpec"; "SpineAsyncProtocol"; "CircuitRegistration"
          "TwoPCSink"; "SpineMergeInvariants"; "TransactionInterleaving"
          "ChaosEnvDeterminism"; "ConsistentHashRebalance"
          "OperatorLifecycleRace"; "TickMonotonicity"
          "DictionaryStripedCAS"; "AsyncStreamEnumerator"
          "InfoTheoreticSharder"
          "RecursiveCountingLFP"; "FeatureFlagsResolution"
          "SmokeCheck" ]
    for s in specs do
        File.Exists(Path.Combine(docsPath, $"{s}.tla"))
        |> should be True


// ═══════════════════════════════════════════════════════════════════
// Per-spec TLC checks. Each spec that has a `.cfg` gets a real TLC
// run. Specs without a `.cfg` are intentionally unchecked-for-now
// (state space may be too large, or we're still refining the
// predicate shape). We add `.cfg` files as the specs stabilise.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``TLC validates TickMonotonicity``  () =
    assertSpecValid "TickMonotonicity"


[<Fact>]
let ``TLC validates OperatorLifecycleRace`` () =
    assertSpecValid "OperatorLifecycleRace"

[<Fact>]
let ``TLC validates TransactionInterleaving`` () =
    assertSpecValid "TransactionInterleaving"

[<Fact>]
let ``TLC validates TwoPCSink`` () =
    assertSpecValid "TwoPCSink"


[<Fact>]
let ``TLC validates InfoTheoreticSharder`` () =
    // Proves the four correctness invariants from BUGS.md P0:
    //   * Observe is side-effect-free on shardLoads
    //   * Pick commits exactly once per call
    //   * Cold-start tie-break distributes by hash index
    //   * No torn reads on the argmin path
    // Spec bounds state via MaxPicks / MaxObserves so TLC terminates.
    assertSpecValid "InfoTheoreticSharder"


[<Fact>]
let ``TLC validates RecursiveCountingLFP`` () =
    // Proves the Gupta-Mumick-Subrahmanian counting claim at every
    // tick of the LFP unfolding: closure[k] = paths[k] for every key.
    // Uses the successor-chain body model from tools/tla/specs/RecursiveCountingLFP.tla.
    assertSpecValid "RecursiveCountingLFP"


[<Fact>]
let ``TLC validates FeatureFlagsResolution`` () =
    // Exhaustively enumerates every (override, env, meta-flag, stage)
    // combination for a 2-flag universe and proves that
    // FeatureFlags.isEnabled matches the documented resolution order
    // on every environment.
    assertSpecValid "FeatureFlagsResolution"
