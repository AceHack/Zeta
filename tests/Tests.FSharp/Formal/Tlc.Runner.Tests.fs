[<Xunit.Collection("TLC")>]
module Zeta.Tests.Formal.TlcRunnerTests
#nowarn "0893"

open System
open System.Diagnostics
open System.IO
open FsUnit.Xunit
open global.Xunit


// ═══════════════════════════════════════════════════════════════════
// TLC model-checker runner — shells out to `java -cp tla2tools.jar
// tlc2.TLC <SpecName>` for each `tools/tla/specs/*.tla` we want to
// validate. Treats spec-check output as a test assertion: parse
// error or invariant violation → fail.
//
// Gracefully no-ops when the toolchain isn't configured (no `java`
// on PATH, no `tools/tla/tla2tools.jar`) so local dev machines and
// CI-runners that haven't invoked `tools/setup/install.sh` still
// get a green `dotnet test`. Matches the AlloyRunnerTests shape.
//
// Tests in this module are serialized via the `TLC` xunit
// collection. TLC dumps counterexample trace files as
// `<SpecName>_TTrace_YYYY-MM-DD_HH-MM-SS.tla` and matching `.bin`
// into the specs directory; when xunit runs multiple TLC tests in
// parallel they race on those trace files — a test cleans up
// `SpineBalanced_TTrace_*.tla` while its sibling is still writing
// one, producing first-run flakes. Serializing the module removes
// the race. Flagged as a known flake in the round-33 carry-over;
// fixed round 34.
// ═══════════════════════════════════════════════════════════════════


/// xunit collection name — any test type decorated with
/// `[<Collection("TLC")>]` runs serially with every other member
/// of the collection. Use this for every TLC test type that reads
/// or writes files under `tools/tla/specs/`.
[<CollectionDefinition("TLC", DisableParallelization = true)>]
type TlcTestCollection () = class end


let private repoRoot =
    // Walk up from the test assembly's directory, NOT the process CWD.
    // xUnit parallelizes test classes, so CWD-mutating tests can race
    // with this module's static init (observed as
    // TypeInitializationException on macOS-14 in the Alloy sibling
    // module). AppContext.BaseDirectory is immutable for the lifetime
    // of the AppDomain and always points at
    // `<repo>/tests/Tests.FSharp/bin/Release/net10.0/` under
    // `dotnet test`, so walking up reliably finds Zeta.sln.
    let mutable dir = DirectoryInfo AppContext.BaseDirectory
    while not (isNull dir) && not (File.Exists (Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then invalidOp "Could not locate repo root (Zeta.sln)"
    dir.FullName


let private tlaJarPath =
    Path.Combine(repoRoot, "tools", "tla", "tla2tools.jar")


let private specsPath = Path.Combine(repoRoot, "tools", "tla", "specs")


let private which (exe: string) : string option =
    let pathSep =
        if Environment.OSVersion.Platform = PlatformID.Unix
           || Environment.OSVersion.Platform = PlatformID.MacOSX
        then ':' else ';'
    let extensions =
        if pathSep = ';' then [| ".exe"; ".cmd"; ".bat"; "" |] else [| "" |]
    let pathEnv = Environment.GetEnvironmentVariable "PATH"
    if isNull pathEnv then None
    else
        pathEnv.Split pathSep
        |> Seq.collect (fun d -> extensions |> Seq.map (fun e -> Path.Combine(d, exe + e)))
        |> Seq.tryFind File.Exists


/// True when the TLC toolchain (jar + java) is fully configured.
/// Tests gracefully no-op when any piece is missing so local dev
/// machines without a JDK still get a green `dotnet test`.
let private toolchainReady () : bool =
    match which "java" with
    | Some _ when File.Exists tlaJarPath -> true
    | _ -> false


/// Runs TLC on a single spec. Returns `(exitCode, stdout)`.
let private runTlc (specName: string) : int * string =
    // Assume java is on PATH. If it's not, the user sees a clear
    // ProcessStartInfo error.
    if not (File.Exists tlaJarPath) then
        failwithf "TLC jar not found at %s — run tools/setup/install.sh" tlaJarPath
    let psi = ProcessStartInfo()
    psi.FileName <- "java"
    psi.WorkingDirectory <- specsPath
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
    for f in Directory.GetFiles(specsPath,$"{specName}_TTrace_*.tla") do
        try File.Delete f with _ -> ()
    for f in Directory.GetFiles(specsPath,$"{specName}_TTrace_*.bin") do
        try File.Delete f with _ -> ()
    for f in Directory.GetFiles(specsPath,"MC*.tla") do
        try File.Delete f with _ -> ()
    p.ExitCode, stdout


/// The smoke test — proves Java + tla2tools.jar + `.tla`/`.cfg`
/// resolution all work end-to-end on this box. Skips silently when
/// the toolchain isn't configured (CI-runner without install.sh).
[<Fact>]
let ``TLC can check the SmokeCheck spec`` () =
    if not (toolchainReady ()) then () else
    let (exitCode, stdout) = runTlc "SmokeCheck"
    // TLC returns 0 on success with no violations.
    if exitCode <> 0 then
        failwithf "TLC SmokeCheck failed with exit %d. stdout:\n%s" exitCode stdout
    // Confirm TLC actually found + validated the invariant.
    stdout |> should haveSubstring "No error has been found"


/// Run TLC on a spec and assert success. Skips silently when the
/// toolchain isn't configured (matches Alloy pattern).
let private assertSpecValid (specName: string) =
    if not (toolchainReady ()) then () else
    let (exitCode, stdout) = runTlc specName
    if exitCode <> 0 then
        failwithf "TLC %s failed with exit %d. stdout:\n%s" specName exitCode stdout


// ═══════════════════════════════════════════════════════════════════
// One test per real spec. When TLC can't check a spec (no .cfg yet,
// unbounded state space, etc.) we gate on the presence of a .cfg
// and skip rather than fail — each spec gets a .cfg over time.
// ═══════════════════════════════════════════════════════════════════


let private specExists (name: string) =
    File.Exists(Path.Combine(specsPath, $"{name}.tla"))
    && File.Exists(Path.Combine(specsPath, $"{name}.cfg"))


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
        File.Exists(Path.Combine(specsPath, $"{s}.tla"))
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
