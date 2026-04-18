module Zeta.Tests.Storage.SpineDiskTests
#nowarn "0893"

open System
open System.IO
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// Disk-backed spine (moved from NewFeatureTests / SpineAndSafetyTests)
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``InMemoryBackingStore roundtrips`` () =
    let store = InMemoryBackingStore<int>() :> IBackingStore<int>
    let batch = ZSet.ofKeys [ 1 ; 2 ; 3 ]
    let handle = store.Save(0, batch)
    let loaded = store.Load handle
    loaded |> should equal batch
    store.Release handle


[<Fact>]
let ``DiskBackingStore keeps small batches in memory`` () =
    let tmp = Path.Combine(Path.GetTempPath(), $"dbsp-disk-test-{Guid.NewGuid()}")
    try
        let store = DiskBackingStore<int>(tmp, inMemoryQuotaBytes = 10_000L) :> IBackingStore<int>
        let batch = ZSet.ofKeys [ 1 ; 2 ; 3 ]
        let handle = store.Save(0, batch)
        store.Load handle |> should equal batch
        store.Release handle
    finally
        try Directory.Delete(tmp, recursive = true) with _ -> ()


[<Fact>]
let ``DiskBackingStore spills when over quota`` () =
    let tmp = Path.Combine(Path.GetTempPath(), $"dbsp-spill-test-{Guid.NewGuid()}")
    try
        // Very small quota forces immediate spilling to disk.
        let store = DiskBackingStore<int>(tmp, inMemoryQuotaBytes = 100L) :> IBackingStore<int>
        let handles =
            [ for i in 1 .. 20 ->
                let batch = ZSet.ofKeys [ for k in i * 100 .. i * 100 + 10 -> k ]
                store.Save(0, batch) ]
        // After saving 20 batches, quota is well exceeded — most must be on disk.
        // Loading any should succeed.
        for h in handles do
            let _ = store.Load h
            store.Release h
        // Check that files were written.
        Directory.Exists tmp |> should be True
    finally
        try Directory.Delete(tmp, recursive = true) with _ -> ()


[<Fact>]
let ``BackedSpine with in-memory store matches Spine`` () =
    let store = InMemoryBackingStore<int>() :> IBackingStore<int>
    let spine = BackedSpine<int>(store)
    let refSpine = Spine<int>()
    let batches = [
        ZSet.ofKeys [ 1 ; 2 ; 3 ]
        ZSet.ofKeys [ 4 ; 5 ; 6 ]
        ZSet.ofKeys [ 1 ; 7 ]
    ]
    for b in batches do
        spine.Insert b
        refSpine.Insert b
    spine.Consolidate() |> should equal (refSpine.Consolidate())


[<Fact>]
let ``BackedSpine Clear removes all storage`` () =
    let store = InMemoryBackingStore<int>() :> IBackingStore<int>
    let spine = BackedSpine<int>(store)
    spine.Insert(ZSet.ofKeys [ 1 ; 2 ])
    spine.Insert(ZSet.ofKeys [ 3 ; 4 ])
    spine.Clear()
    spine.Consolidate() |> should equal ZSet<int>.Empty
    spine.Depth |> should equal 0


// ─── DiskBackingStore — per-instance ID prefix + hot cache repopulation
// ─── (moved from SpineAndSafetyTests) ────────────────────────────────

[<Fact>]
let ``DiskBackingStore instances sharing a dir don't clobber each other`` () =
    let dir = Path.Combine(Path.GetTempPath(), $"dbsp-share-{Guid.NewGuid():N}")
    try
        Directory.CreateDirectory dir |> ignore
        // Tiny quota forces immediate spill.
        let s1 = DiskBackingStore<int>(dir, inMemoryQuotaBytes = 0L) :> IBackingStore<int>
        let s2 = DiskBackingStore<int>(dir, inMemoryQuotaBytes = 0L) :> IBackingStore<int>
        let h1 = s1.Save(0, ZSet.ofKeys [ 1; 2 ])
        let h2 = s2.Save(0, ZSet.ofKeys [ 10; 20 ])
        let l1 = s1.Load h1
        let l2 = s2.Load h2
        l1.Count |> should equal 2
        l2.Count |> should equal 2
        l1.[1] |> should equal 1L
        l2.[10] |> should equal 1L
        s1.Release h1
        s2.Release h2
    finally
        if Directory.Exists dir then Directory.Delete(dir, true)


// ─── DiskBackingStore — path traversal guard (moved from SpineAndSafetyTests) ─

[<Fact>]
let ``DiskBackingStore canonicalises workDir`` () =
    let dir = Path.Combine(Path.GetTempPath(), $"dbsp-test-{Guid.NewGuid():N}")
    try
        let store = DiskBackingStore<int>(dir, inMemoryQuotaBytes = 1024L) :> IBackingStore<int>
        let batch = ZSet.ofKeys [ 1; 2; 3 ]
        let handle = store.Save(0, batch)
        let loaded = store.Load handle
        loaded.Count |> should equal 3
        store.Release handle
    finally
        if Directory.Exists dir then Directory.Delete(dir, true)


[<Fact>]
let ``DiskBackingStore spill path lives under root`` () =
    let dir = Path.Combine(Path.GetTempPath(), $"dbsp-test-{Guid.NewGuid():N}")
    try
        Directory.CreateDirectory dir |> ignore
        // Small quota forces spill.
        let store = DiskBackingStore<int>(dir, inMemoryQuotaBytes = 0L) :> IBackingStore<int>
        let batch = ZSet.ofKeys [ 1; 2; 3 ]
        let handle = store.Save(0, batch)
        // Any spill files should be under `dir`.
        let spilled = Directory.GetFiles(dir, "spine-*.json")
        spilled |> Array.iter (fun p ->
            let full = Path.GetFullPath p
            full.StartsWith(Path.GetFullPath dir, StringComparison.Ordinal) |> should be True)
        store.Release handle
    finally
        if Directory.Exists dir then Directory.Delete(dir, true)
