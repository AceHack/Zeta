module Zeta.Tests.Storage.SpineDiskAsyncTests
#nowarn "0893"

open System
open System.IO
open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open Zeta.Tests.Support


// ═══════════════════════════════════════════════════════════════════
// Async backing store + async-backed spine (additive; mirrors the sync
// Spine.Disk tests). Genuine File.*Async I/O — no Task.Run fakery.
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``InMemoryAsyncBackingStore roundtrips`` () =
    let store = InMemoryAsyncBackingStore<int>() :> IAsyncBackingStore<int>
    let batch = ZSet.ofKeys [ 1 ; 2 ; 3 ]
    let handle = store.SaveAsync(0, batch, Threading.CancellationToken.None).AsTask().Result
    let loaded = store.LoadAsync(handle, Threading.CancellationToken.None).AsTask().Result
    loaded |> should equal batch
    store.ReleaseAsync(handle, Threading.CancellationToken.None).AsTask().Wait()


[<Fact>]
let ``DiskAsyncBackingStore keeps small batches in memory`` () =
    let tmp = DeterministicTestPath.nextDir "dbsp-disk-async"
    try
        let store = DiskAsyncBackingStore<int>(tmp, inMemoryQuotaBytes = 10_000L) :> IAsyncBackingStore<int>
        let batch = ZSet.ofKeys [ 1 ; 2 ; 3 ]
        let handle = store.SaveAsync(0, batch, Threading.CancellationToken.None).AsTask().Result
        store.LoadAsync(handle, Threading.CancellationToken.None).AsTask().Result |> should equal batch
        store.ReleaseAsync(handle, Threading.CancellationToken.None).AsTask().Wait()
    finally
        try Directory.Delete(tmp, recursive = true) with _ -> ()


[<Fact>]
let ``DiskAsyncBackingStore spills when over quota and reloads from disk`` () =
    let tmp = DeterministicTestPath.nextDir "dbsp-spill-async"
    try
        let store = DiskAsyncBackingStore<int>(tmp, inMemoryQuotaBytes = 100L) :> IAsyncBackingStore<int>
        let handles =
            [ for i in 1 .. 20 ->
                let batch = ZSet.ofKeys [ for k in i * 100 .. i * 100 + 10 -> k ]
                store.SaveAsync(0, batch, Threading.CancellationToken.None).AsTask().Result ]
        for h in handles do
            let z = store.LoadAsync(h, Threading.CancellationToken.None).AsTask().Result
            z.Count |> should be (greaterThan 0)
            store.ReleaseAsync(h, Threading.CancellationToken.None).AsTask().Wait()
        Directory.Exists tmp |> should be True
    finally
        try Directory.Delete(tmp, recursive = true) with _ -> ()


[<Fact>]
let ``BackedSpineAsync with in-memory store matches Spine`` () =
    let store = InMemoryAsyncBackingStore<int>() :> IAsyncBackingStore<int>
    let spine = BackedSpineAsync<int>(store)
    let refSpine = Spine<int>()
    let batches = [
        ZSet.ofKeys [ 1 ; 2 ; 3 ]
        ZSet.ofKeys [ 4 ; 5 ; 6 ]
        ZSet.ofKeys [ 1 ; 7 ]
    ]
    for b in batches do
        spine.InsertAsync(b).Wait()
        refSpine.Insert b
    spine.ConsolidateAsync().Result |> should equal (refSpine.Consolidate())


[<Fact>]
let ``BackedSpineAsync over disk store matches Spine`` () =
    let tmp = DeterministicTestPath.nextDir "dbsp-spine-async"
    try
        // Tiny quota forces spill/reload through the async disk path.
        let store = DiskAsyncBackingStore<int>(tmp, inMemoryQuotaBytes = 0L) :> IAsyncBackingStore<int>
        let spine = BackedSpineAsync<int>(store)
        let refSpine = Spine<int>()
        for i in 1 .. 16 do
            let b = ZSet.ofKeys [ i ; i + 100 ]
            spine.InsertAsync(b).Wait()
            refSpine.Insert b
        spine.ConsolidateAsync().Result |> should equal (refSpine.Consolidate())
    finally
        try Directory.Delete(tmp, recursive = true) with _ -> ()


[<Fact>]
let ``BackedSpineAsync ClearAsync removes all storage`` () =
    let store = InMemoryAsyncBackingStore<int>() :> IAsyncBackingStore<int>
    let spine = BackedSpineAsync<int>(store)
    spine.InsertAsync(ZSet.ofKeys [ 1 ; 2 ]).Wait()
    spine.InsertAsync(ZSet.ofKeys [ 3 ; 4 ]).Wait()
    spine.ClearAsync().Wait()
    spine.ConsolidateAsync().Result |> should equal ZSet<int>.Empty
    spine.Depth |> should equal 0


[<Fact>]
let ``DiskAsyncBackingStore instances sharing a dir don't clobber each other`` () =
    let dir = DeterministicTestPath.nextDir "dbsp-share-async"
    try
        Directory.CreateDirectory dir |> ignore
        let s1 = DiskAsyncBackingStore<int>(dir, inMemoryQuotaBytes = 0L) :> IAsyncBackingStore<int>
        let s2 = DiskAsyncBackingStore<int>(dir, inMemoryQuotaBytes = 0L) :> IAsyncBackingStore<int>
        let h1 = s1.SaveAsync(0, ZSet.ofKeys [ 1; 2 ], Threading.CancellationToken.None).AsTask().Result
        let h2 = s2.SaveAsync(0, ZSet.ofKeys [ 10; 20 ], Threading.CancellationToken.None).AsTask().Result
        let l1 = s1.LoadAsync(h1, Threading.CancellationToken.None).AsTask().Result
        let l2 = s2.LoadAsync(h2, Threading.CancellationToken.None).AsTask().Result
        l1.Count |> should equal 2
        l2.Count |> should equal 2
        l1.[1] |> should equal 1L
        l2.[10] |> should equal 1L
    finally
        if Directory.Exists dir then Directory.Delete(dir, true)
