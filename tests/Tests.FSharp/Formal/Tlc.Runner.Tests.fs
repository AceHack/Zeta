[<Xunit.Collection("TLC")>]
module Zeta.Tests.Formal.TlcRunnerTests
// FS57 suppressed knowingly: references the experimental combinator in formal-harness wiring.
#nowarn "57"
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
    Path.Combine(repoRoot, "src", "Core.TLA", "tla2tools.jar")


let private specsPath = Path.Combine(repoRoot, "src", "Core.TLA", "specs")


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


/// True when the TLC toolchain (jar + java) is fully configured
/// AND the runner is one we want to actually exercise. Formal
/// verification (TLC) is pure-math computation: no OS-specific
/// behavior, no environment touching. Running it on macOS /
/// Windows / ARM / slim runners alongside standard Linux x64 is
/// duplicate work. Filter to standard Linux x64 only on CI;
/// preserve dev-local validation regardless.
///
/// Three-axis check:
///   * OS axis: skip non-Linux on CI (catches macos-26, windows-*).
///   * Architecture axis: skip non-x64 on CI (catches
///     ubuntu-24.04-arm, windows-11-arm — both are still
///     Linux/Windows so OS check alone wouldn't catch ARM Linux).
///   * Runner-class axis: skip the slim runner via the workflow-name
///     env var GITHUB_WORKFLOW. ubuntu-slim is Linux x64 so the
///     OS+arch check alone wouldn't catch it.
///
/// Dev-local (no CI=true) bypasses all three filters so devs can
/// validate specs in their normal `dotnet test` runs.
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
    // TLC recommends ParallelGC for model-checker throughput. On local
    // macOS/aarch64 with OpenJDK 26, the default G1 collector has also
    // crashed in G1 remset rebuild during tiny specs; pin the collector so a
    // JVM GC crash does not masquerade as a failed formal model.
    psi.ArgumentList.Add "-XX:+UseParallelGC"
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
          "BpExactOnTree"
          "NciSafety"
          "NciLiveness"
          "NciNonUrgency"
          "NciUnbounded"
          "BftConsensus"
          "BftSybilConsensus"
          "Bifurcation"
          "EngagementLiveness"
          "PermanentHarmHorizon"
          "RecoveryHomeostat"
          "RecursiveSignedSemiNaive"
          "RefuseBinding"
          "NonRegisterCollapse"
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


[<Fact>]
let ``TLC validates DbspSpec`` () =
    // DBSP per-tick semantics — verifies the 9 algebra invariants
    // (InvAssoc / InvCommute / InvIdentity / InvInverse /
    // InvDoubleNeg / InvNegDistributes / InvSubIsAddNeg /
    // InvDistinctIdempotent / InvHCorrectness) over the cfg's
    // configured state space.
    //
    // Coverage scope (from DbspSpec.cfg):
    //   - Keys K = {"k1", "k2"} (2-key universe)
    //   - Weights W = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9} — POSITIVE
    //     ONLY. Retraction (negative-weight) cases are NOT
    //     exercised by this model-check; they are covered separately
    //     by the FsCheck property-tests over Z-set algebra in
    //     tests/Tests.FSharp/Algebra/ZSetTests.fs and by the Lean
    //     proof of Prop 3.2 (tools/lean4/Lean4/DbspChainRule.lean)
    //     which is general over abelian-group weights.
    //
    // Adding negative-weight coverage would require enlarging W
    // (linear blow-up in state space) or refining the spec model —
    // future work tied to the chain_rule_poly (3-group) follow-on.
    assertSpecValid "DbspSpec"


[<Fact>]
let ``TLC validates CircuitRegistration`` () =
    // Circuit's Register/Build interleaving — verifies the
    // composite safety invariant `Safety == TypeOK /\
    // NoRegisterAfterBuild` (matching the spec's stated THEOREM
    // `Spec => [](TypeOK /\ NoRegisterAfterBuild)`).
    assertSpecValid "CircuitRegistration"


[<Fact>]
let ``TLC validates ChaosEnvDeterminism`` () =
    // ChaosEnvironment seeded-determinism contract — verifies the
    // composite safety invariant `Safety == TypeOK /\ Atomic` over a
    // bounded 2-thread / Seed=0 / HistoryBound=16 run. The Atomic
    // invariant says: for every "rng" entry in history, the
    // immediately following entry is a "clock" entry from the same
    // thread. Modeling the splitMix + AdvanceTime critical section
    // as a SINGLE atomic step (DelayCritical) mirrors
    // ChaosEnvironment.fs holding the lock across both ops; without
    // atomicity, the model would expose an intermediate
    // "rng-recorded-but-no-clock-yet" state where Atomic fails. The
    // cfg declares CHECK_DEADLOCK FALSE because every thread reaching
    // "done" then "idle" is intentional cycle completion. Bounded by
    // HistoryBound = 16 entries to keep TLC's BFS tractable.
    assertSpecValid "ChaosEnvDeterminism"


[<Fact>]
let ``TLC validates SpineMergeInvariants`` () =
    // BalancedSpine's level-cap merge protocol — verifies two safety
    // invariants over a bounded MaxLevel=2 / MaxBatchSize=1 run with
    // totalInserted <= 30 and Len(pendingIn) <= 4:
    //   * InvMass: sum(levels) + sum(pendingIn) = totalInserted at
    //     every reachable state (mass conservation across merges)
    //   * InvCap: levels[i] <= 2 * Cap(i) at every reachable state
    //     (one self-merge overshoot tolerated, no further accumulation)
    // The cfg declares CHECK_DEADLOCK FALSE because the bounded model
    // can reach a saturated terminal state (all caps full, pendingIn
    // saturated) where no Next-step is enabled — modeling the
    // physical-substrate limit of the LSM, not a bug-deadlock. The
    // spec models the LSM cascade chain: Cascade(i) requires downstream
    // room (levels[i+1] + levels[i] <= 2*Cap(i+1)) so the protocol
    // can't dump from level i while level i+1 is at the cap-overshoot
    // boundary, mirroring the synchronous cascade in BalancedSpine.fs.
    assertSpecValid "SpineMergeInvariants"


[<Fact>]
let ``TLC validates BpExactOnTree`` () =
    // 081KT2T2J0008QG0R000YZ3NMY C5 — sum-product BP runToFixpoint is EXACT ON TREES and
    // TERMINATES under the bounded round cap. Models the synchronous
    // passOnce schedule (FactorGraph.fs:124-191) on the 3-variable tree
    // (path 0—1—2: equality factors {0,1}+{1,2}, prior on each). Tracks
    // marginal[v] as the SET of evidence ids folded in (the
    // RecursiveCountingLFP ghost-set idiom; product is order-independent
    // by C1/C2/C3). Proves two state invariants over every reachable
    // state:
    //   * ExactOnTree        — converged ⇒ every marginal = {0,1,2}
    //                          (the whole tree; KFL 2001 exactness)
    //   * ConvergesBeforeCap — rounds ≥ Diameter+1 (=3) ⇒ converged
    //                          (the cap never blocks a tree)
    // The numeric float marginal is cross-checked by the FsCheck companion
    // (Bp.Tests.fs, random trees) per BP-16 (TLA+ schedule ∧ FsCheck float).
    assertSpecValid "BpExactOnTree"


[<Fact>]
let ``TLC validates SpineAsyncProtocol`` () =
    // SpineAsync producer/worker protocol — verifies three STATE
    // invariants over a bounded NumBatches=4 run:
    //   * InvMonotonic: processed <= sent at every reachable state
    //   * InvEventuallyDrains: when channel is empty, processed
    //     accounts for everything sent at that instant (not a
    //     temporal liveness claim — the name is historical from
    //     the spec author's intent comment; the actual predicate
    //     is state-conditional)
    //   * InvFlushTerminates: at any state where a flush target
    //     <= sent, processed accounts for the in-flight + drained
    //     work (also state-conditional, not temporal)
    // The cfg declares CHECK_DEADLOCK FALSE because reaching the
    // all-done state (processed=NumBatches, channel empty, both
    // PCs idle) is intended termination for this bounded protocol,
    // not bug-deadlock. Real liveness (eventual completion) is not
    // checked by this spec; it would require LTL properties + WF/SF
    // fairness assumptions.
    assertSpecValid "SpineAsyncProtocol"


[<Fact>]
let ``TLC validates BftConsensus`` () =
    assertSpecValid "BftConsensus"


[<Fact>]
let ``TLC validates BftSybilConsensus`` () =
    // Proves quorum soundness over proven-distinct identities under a Sybil ring.
    assertSpecValid "BftSybilConsensus"


[<Fact>]
let ``TLC validates Bifurcation`` () =
    assertSpecValid "Bifurcation"


[<Fact>]
let ``TLC validates EngagementLiveness`` () =
    assertSpecValid "EngagementLiveness"


[<Fact>]
let ``TLC validates PermanentHarmHorizon`` () =
    // Proves State-Corruption Horizon safety properties: committed state => harm has decayed.
    assertSpecValid "PermanentHarmHorizon"


[<Fact>]
let ``TLC validates RecoveryHomeostat`` () =
    assertSpecValid "RecoveryHomeostat"


[<Fact>]
let ``TLC validates RecursiveSignedSemiNaive`` () =
    assertSpecValid "RecursiveSignedSemiNaive"


[<Fact>]
let ``TLC validates RefuseBinding`` () =
    assertSpecValid "RefuseBinding"


[<Fact>]
let ``TLC validates NonRegisterCollapse`` () =
    assertSpecValid "NonRegisterCollapse"


[<Fact>]
let ``TLC validates NciSafety`` () =
    assertSpecValid "NciSafety"


[<Fact>]
let ``TLC validates NciLiveness`` () =
    assertSpecValid "NciLiveness"


[<Fact>]
let ``TLC validates NciNonUrgency`` () =
    assertSpecValid "NciNonUrgency"


[<Fact>]
let ``TLC validates NciUnbounded`` () =
    assertSpecValid "NciUnbounded"
