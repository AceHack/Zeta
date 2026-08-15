// This module DRIVES process-global CWD chaos, so it joins the
// `cwd-chaos` collection: the blast radius of `chdir(2)` is the whole
// process, which is not a scope any narrower isolation can express.
// See `_Support/CwdChaos.fs` for the channel and why it is declared.
[<Xunit.Collection(Zeta.Tests.Support.CwdChaos.CollectionName)>]
module Zeta.Tests.Storage.DurabilityTests
#nowarn "0893"

open System
open System.IO
open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open Zeta.Tests.Support


// ═══════════════════════════════════════════════════════════════════
// WitnessDurableBackingStore constructor canonicalises its paths
// exactly once. Two `Path.GetFullPath` calls in the constructor would
// let a concurrent swap of `Environment.CurrentDirectory` (or a
// symlink flip) retarget the second resolution — so the
// `CreateDirectory` on the first call and the stored `rootWorkDir`
// from the second call would point at different places.
// ═══════════════════════════════════════════════════════════════════


/// Build a sibling directory tree and return its absolute path.
let private sibling (root: string) (name: string) : string =
    let dir = Path.Combine(root, name)
    Directory.CreateDirectory dir |> ignore
    dir


[<Fact>]
let ``WitnessDurableBackingStore WorkDir matches the directory actually created`` () =
    let root = DeterministicTestPath.nextDir "dbsp-wd"
    try
        let workDir = Path.Combine(root, "work")
        let witnessDir = Path.Combine(root, "witness")
        let store = WitnessDurableBackingStore<int>(workDir, witnessDir, 512)
        // The stored `rootWorkDir` must be the same canonical path as
        // the directory that was created in the constructor.
        Directory.Exists store.WorkDir |> should be True
        Directory.Exists store.WitnessDir |> should be True
        store.WorkDir |> should equal (Path.GetFullPath workDir)
        store.WitnessDir |> should equal (Path.GetFullPath witnessDir)
    finally
        try Directory.Delete(root, true) with _ -> ()


[<Fact>]
let ``WitnessDurableBackingStore canonicalises workDir under CWD churn`` () =
    // Under the bug, two `Path.GetFullPath` calls in the constructor
    // would resolve a *relative* workDir against two different
    // `Environment.CurrentDirectory` values if another thread swaps
    // the CWD between them. After the fix, `GetFullPath` runs exactly
    // once, so the stored path and the created directory always
    // agree — even if CWD is swapped every instant.
    //
    // The churn is DELIBERATE fault injection and is kept. What changed
    // on 2026-08-15 is its shape: it used to be a raw background thread
    // flipping at scheduler speed with `with _ -> ()` around every
    // assignment, and nothing declared that `Environment.CurrentDirectory`
    // is process-global. That hidden channel escaped this test and killed
    // an unrelated Alloy JVM on PR #10757. It now runs through
    // `CwdChaos`, which seeds the flip sequence, meters flips and
    // failures, and names its blast radius. See `_Support/CwdChaos.fs`.
    let seed = 20260814L
    let root = DeterministicTestPath.nextDir "dbsp-cwd"
    try
        // Three targets, not the original two: `CwdChaos.schedule` never
        // repeats a target back-to-back, and with only two that rule
        // fully determines the order — the seed would be inert. A third
        // makes the seed load-bearing while keeping every step a real
        // `chdir`, so this churns at least as hard as the A/B version.
        let targets =
            [| sibling root "cwd-a"; sibling root "cwd-b"; sibling root "cwd-c" |]
        let mismatches, report =
            CwdChaos.run seed targets (fun () ->
                let mutable mismatches = 0
                for i in 1 .. 50 do
                    let workRel = "work-" + string i
                    let witnessRel = "witness-" + string i
                    // The store should produce an absolute path resolved
                    // against the CWD at the *moment of construction*,
                    // and the created directory must match exactly —
                    // even if the CWD churner has just swapped the root.
                    let store =
                        try
                            Some (WitnessDurableBackingStore<int>(workRel, witnessRel, 512))
                        with _ -> None
                    match store with
                    | Some s ->
                        // The invariant: `WorkDir` is an existing directory
                        // and equals exactly one canonicalisation. If the
                        // constructor did `GetFullPath` twice with CWD
                        // churn, `s.WorkDir` would point at a directory
                        // that doesn't exist (because `CreateDirectory`
                        // ran against the other canonicalisation).
                        if not (Directory.Exists s.WorkDir) then
                            mismatches <- mismatches + 1
                        if not (Directory.Exists s.WitnessDir) then
                            mismatches <- mismatches + 1
                    | None -> ()
                mismatches)
        mismatches |> should equal 0
        // The chaos has to have HAPPENED. Previously this assertion did
        // not exist, so a churner thread that never got scheduled — or
        // whose every assignment threw into `with _ -> ()` — produced a
        // green run that had tested nothing under churn at all.
        report.Flips |> should be (greaterThan 0)
        report.Failures |> should equal 0
        report.Seed |> should equal seed
    finally
        // `CwdChaos.run` has already restored the original CWD, so no
        // churn target is any thread's cwd by the time this deletes them.
        try Directory.Delete(root, true) with _ -> ()
