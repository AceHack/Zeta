module Zeta.Tests.Storage.DurabilityTests
#nowarn "0893"

open System
open System.IO
open System.Threading
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


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
    let root = Path.Combine(Path.GetTempPath(), "dbsp-wd-" + Guid.NewGuid().ToString("N"))
    Directory.CreateDirectory root |> ignore
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
    let root = Path.Combine(Path.GetTempPath(), "dbsp-cwd-" + Guid.NewGuid().ToString("N"))
    Directory.CreateDirectory root |> ignore
    let originalCwd = Environment.CurrentDirectory
    try
        let cwdA = sibling root "cwd-a"
        let cwdB = sibling root "cwd-b"
        let stop = ref 0
        let churner =
            Thread(fun () ->
                let mutable flip = false
                while Volatile.Read(&stop.contents) = 0 do
                    try
                        Environment.CurrentDirectory <-
                            if flip then cwdA else cwdB
                    with _ -> ()
                    flip <- not flip)
        churner.IsBackground <- true
        churner.Start()
        try
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
                        Interlocked.Increment &mismatches |> ignore
                    if not (Directory.Exists s.WitnessDir) then
                        Interlocked.Increment &mismatches |> ignore
                | None -> ()
            mismatches |> should equal 0
        finally
            stop := 1
            churner.Join()
    finally
        try Environment.CurrentDirectory <- originalCwd with _ -> ()
        try Directory.Delete(root, true) with _ -> ()
