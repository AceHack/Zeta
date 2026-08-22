[<Xunit.Collection(Zeta.Tests.Support.CwdChaos.CollectionName)>]
module Zeta.Tests.Infra.CwdChaosTests
#nowarn "0893"

open System
open System.Diagnostics
open System.IO
open FsUnit.Xunit
open global.Xunit
open Zeta.Tests.Support


// ═══════════════════════════════════════════════════════════════════
// The CWD-chaos channel, tested as a channel.
//
// ORIGIN. PR #10757 (a wasm byte-lock change, nothing to do with any of
// this) went red on `build-and-test (ubuntu-24.04)` with one failure:
//
//   Zeta.Tests.Formal.AlloyRunnerTests.Alloy spec Spine … exit 1
//     Error occurred during initialization of VM
//     java.lang.Error: Properties init: Could not determine current
//                     working directory.
//       at jdk.internal.util.SystemProps$Raw.platformProperties
//                     (java.base@26.0.2/Native Method)
//
// Mechanism, verified before anything was changed (four links, each
// checked rather than argued):
//   1. `Environment.CurrentDirectory` is process-global; the durability
//      churn test assigns it in a loop  (source).
//   2. `Process.Start` with `WorkingDirectory` unset hands the child
//      that CWD at fork time  (measured — `Subprocess` docstring).
//   3. the churn test's `finally` deletes the tree those directories
//      live in  (source).
//   4. a JVM whose cwd is an unlinked inode dies at exactly the frame
//      above  (reproduced 10/10 locally, message byte-identical on the
//      same JDK 26).
//
// TLC never hit this despite spawning a JVM the same way, and NOT
// because it is serialised — `Tlc.Runner.Tests.fs` sets
// `psi.WorkingDirectory <- specsPath`. Its `DisableParallelization` is
// for counterexample-trace files, a different reason entirely. Alloy
// left the working directory unset, so Alloy was the one in the blast
// radius.
//
// These tests keep the hazard visible rather than letting the fix make
// it forgettable.
// ═══════════════════════════════════════════════════════════════════


/// Locate a tool on PATH, honouring `Subprocess`' own discipline.
let private which (tool: string) : string option =
    try
        let psi = Subprocess.startInfo "/usr/bin/env" AppContext.BaseDirectory
        psi.ArgumentList.Add "which"
        psi.ArgumentList.Add tool
        use p = Process.Start psi
        let output = p.StandardOutput.ReadToEnd().Trim()
        p.WaitForExit()
        if p.ExitCode = 0 && File.Exists output then Some output else None
    with _ -> None


/// Build the churn targets under `root`. Three, so the seed is
/// load-bearing (with two, no-repeat forces alternation).
let private churnTargets (root: string) : string[] =
    [| "cwd-a"; "cwd-b"; "cwd-c" |]
    |> Array.map (fun name ->
        let dir = Path.Combine(root, name)
        Directory.CreateDirectory dir |> ignore
        dir)


// ───────────────────────────────────────────────────────────────────
// 1. The seeded half — replayable, and provably seed-sensitive.
// ───────────────────────────────────────────────────────────────────

[<Fact>]
let ``CWD churn schedule is a pure function of the seed`` () =
    // Replay: the same seed yields the same flip sequence, so a failing
    // run can be re-driven by quoting its seed.
    CwdChaos.schedule 20260814L 64 3
    |> should equal (CwdChaos.schedule 20260814L 64 3)


[<Fact>]
let ``CWD churn schedule differs across seeds and covers every target`` () =
    // Seed-sensitivity: without this, "seeded" could be satisfied by a
    // constant schedule, which would replay perfectly and inject nothing.
    // THREE targets, not two — see the degenerate case below: with two
    // targets the no-repeat rule forces strict alternation and the seed
    // has nothing left to decide, so a 2-target version of this
    // assertion would be asserting something false.
    let a = CwdChaos.schedule 20260814L 256 3
    let b = CwdChaos.schedule 20260815L 256 3
    a |> should not' (equal b)
    // And the schedule must actually move — a plan that never leaves
    // target 0 is a churner that never churns.
    a |> List.distinct |> List.sort |> should equal [ 0; 1; 2 ]
    a |> List.forall (fun i -> i >= 0 && i < 3) |> should be True


[<Fact>]
let ``CWD churn schedule never repeats a target back to back`` () =
    // A repeat is a no-op `chdir` — churn on paper, none in the process.
    for targetCount in 2 .. 5 do
        CwdChaos.schedule 20260814L 512 targetCount
        |> List.pairwise
        |> List.forall (fun (a, b) -> a <> b)
        |> should be True


[<Fact>]
let ``CWD churn over two targets is forced alternation, seed or no seed`` () =
    // Stated out loud rather than left as a surprise: with two targets
    // "not the previous one" fully determines the next one, so the seed
    // is inert. That is exactly the A/B alternation this channel
    // replaced, so nothing is lost — but a caller who wants the seed to
    // matter must supply three or more targets.
    CwdChaos.schedule 1L 32 2 |> should equal (CwdChaos.schedule 999L 32 2)


// ───────────────────────────────────────────────────────────────────
// 2. The hazard witness — why `Subprocess.startInfo` demands a dir.
// ───────────────────────────────────────────────────────────────────

[<Fact>]
let ``a subprocess inheriting an unlinked ambient CWD fails to start`` () =
    // EXPECT-VIOLATION witness, same shape as the TLC runner's: this
    // asserts the HAZARD is real. If a future runtime stops failing
    // here, this test goes red and the guard elsewhere can be
    // re-examined on purpose instead of quietly becoming decoration.
    match which "java" with
    | None -> Assert.Skip "java not on PATH — the JVM hazard witness needs it"
    | Some _ ->

    let mutable observedFailures = 0
    let attempts = 5
    for i in 1 .. attempts do
        let root = DeterministicTestPath.nextDir (sprintf "cwd-hazard-%d" i)
        let doomed = Path.Combine(root, "doomed")
        Directory.CreateDirectory doomed |> ignore
        let originalCwd = Environment.CurrentDirectory
        let proc =
            try
                Environment.CurrentDirectory <- doomed
                // Deliberately NOT `Subprocess.startInfo`: the whole
                // point is a spawn that leaves WorkingDirectory unset.
                let psi = ProcessStartInfo()
                psi.FileName <- "java"
                psi.ArgumentList.Add "-version"
                psi.RedirectStandardOutput <- true
                psi.RedirectStandardError <- true
                psi.UseShellExecute <- false
                Process.Start psi
            finally
                Environment.CurrentDirectory <- originalCwd
        // Unlink the inherited cwd while the JVM is still initialising.
        try Directory.Delete(root, true) with _ -> ()
        // BOTH streams. The JVM launcher writes its VM-initialisation
        // failure to STDOUT, not stderr (measured 2026-08-15 — this
        // check read stderr only at first, observed zero failures, and
        // would have shipped as a silently vacuous witness). `runAlloy`
        // concatenates the two, which is why the CI log carried it.
        let out = proc.StandardOutput.ReadToEnd()
        let err = proc.StandardError.ReadToEnd()
        proc.WaitForExit()
        if proc.ExitCode <> 0
           && (out + err).Contains("initialization of VM", StringComparison.Ordinal) then
            observedFailures <- observedFailures + 1
        proc.Dispose()

    // At least one of five must show the hazard. Locally this
    // reproduces 10/10; requiring one keeps the witness from becoming
    // a flake of its own while still failing loudly if the hazard is
    // gone entirely.
    observedFailures |> should be (greaterThanOrEqualTo 1)


// ───────────────────────────────────────────────────────────────────
// 3. The regression property — the thing PR #10757 needed to be true.
// ───────────────────────────────────────────────────────────────────

[<Fact>]
let ``subprocess spawned under seeded CWD churn survives its targets being deleted`` () =
    // This is the Alloy failure, made deliberate and repeatable: spawn
    // JVMs while process-global CWD is churning, then delete every
    // churn target while they are still initialising. With a declared
    // WorkingDirectory the children never touched those directories, so
    // they must all start cleanly.
    //
    // FALSIFIER CHECK (run by hand, 2026-08-15): deleting the
    // `psi.WorkingDirectory <- workingDirectory` line in
    // `Subprocess.startInfo` makes this test fail. It is not a passing
    // assertion; it discriminates.
    match which "java" with
    | None -> Assert.Skip "java not on PATH — this regression needs a JVM to spawn"
    | Some _ ->

    let seed = 20260814L
    let churnRoot = DeterministicTestPath.nextDir "cwd-chaos-churn"
    // The declared working directory lives OUTSIDE the churn root, so
    // deleting the churn targets cannot reach it.
    let stableDir = DeterministicTestPath.nextDir "cwd-chaos-stable"
    try
        let targets = churnTargets churnRoot
        let procs, report =
            CwdChaos.run seed targets (fun () ->
                [ for _ in 1 .. 4 ->
                    let psi = Subprocess.startInfo "java" stableDir
                    psi.ArgumentList.Add "-version"
                    Process.Start psi ])

        // The chaos must have actually happened. Without this the test
        // would pass just as happily against a churner thread that
        // never got scheduled — the vacuity the old inline churner had.
        report.Flips |> should be (greaterThan 0)
        report.Failures |> should equal 0
        report.FirstFailure |> should equal None
        report.Seed |> should equal seed

        // Unlink the churn targets mid-startup — the exact ordering
        // that killed the Alloy JVM.
        Directory.Delete(churnRoot, true)

        for p in procs do
            // stdout first: the JVM launcher reports VM-init failure there.
            let out = p.StandardOutput.ReadToEnd()
            let err = p.StandardError.ReadToEnd()
            p.WaitForExit()
            if p.ExitCode <> 0 then
                failwithf
                    "subprocess with a declared WorkingDirectory died under CWD churn \
                     (seed %d, exit %d):\n%s%s" seed p.ExitCode out err
            p.Dispose()
    finally
        try Directory.Delete(churnRoot, true) with _ -> ()
        try Directory.Delete(stableDir, true) with _ -> ()
