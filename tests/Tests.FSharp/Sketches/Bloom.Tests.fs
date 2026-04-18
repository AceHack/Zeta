module Zeta.Tests.Sketches.BloomTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


[<Fact>]
let ``BloomFilter optimalShape produces positive m and k`` () =
    let struct (m, k) = BloomFilter.optimalShape 10000 0.01
    m |> should greaterThan 0
    k |> should greaterThan 0


[<Fact>]
let ``Blocked Bloom is positive for inserted keys`` () =
    let bf = BloomFilter.createBlocked 1000 0.01
    for i in 0 .. 100 do bf.Add (int64 i)
    for i in 0 .. 100 do bf.MayContain (int64 i) |> should be True


[<Fact>]
let ``Counting Bloom supports Remove (retraction-native path)`` () =
    let bf = BloomFilter.createCounting 1000 0.01
    bf.Add "hello"
    bf.MayContain "hello" |> should be True
    bf.Remove "hello"
    // After remove, no probe cell remains > 0 for this key → expect false.
    bf.MayContain "hello" |> should be False


[<Fact>]
let ``Blocked Bloom FP rate stays below 10% at target p=1%, n=1000`` () =
    let bf = BloomFilter.createBlocked 1000 0.01
    let rng = Random 17
    for _ in 1..1000 do bf.Add (rng.Next())
    // 10 000 random unseen-key queries; target 1%, allow headroom
    // for blocked filter's tail distribution.
    let mutable fps = 0
    for _ in 1..10_000 do
        if bf.MayContain (rng.Next()) then fps <- fps + 1
    (float fps / 10_000.0) |> should lessThan 0.10


// ═══════════════════════════════════════════════════════════════════
// Zero-allocation hot-path discipline.
// `BloomHash.pairOf` claims "without heap allocation for every
// primitive and string key" (docstring, `BloomFilter.fs:~73`). The
// previous implementation allocated `Array.zeroCreate<byte>` plus
// boxed the typed `key` via `match box key with`. Both are heap
// allocations per call — the claim was false.
// The fix is an `inline`-dispatched primitive path that writes the
// key bytes into a stack-backed span; `box` is never used for known
// primitives.
// ═══════════════════════════════════════════════════════════════════


/// Measure allocations of an action. GC counter is thread-local and
/// precise to the byte. Warm up first so JIT is done.
let private measureAlloc (warmup: int) (action: unit -> unit) : int64 =
    for _ in 1 .. warmup do action ()
    GC.Collect()
    GC.WaitForPendingFinalizers()
    GC.Collect()
    let before = GC.GetAllocatedBytesForCurrentThread()
    action ()
    let after = GC.GetAllocatedBytesForCurrentThread()
    after - before


[<Fact>]
let ``BlockedBloomFilter Add is zero-alloc for int64 keys over 10k calls`` () =
    let bf = BloomFilter.createBlocked 20_000 0.01
    let bytes =
        measureAlloc 3 (fun () ->
            for i in 0 .. 9_999 do bf.Add (int64 i))
    Assert.True((bytes = 0L), sprintf "Expected 0 bytes allocated, got %d" bytes)


[<Fact>]
let ``BlockedBloomFilter MayContain is zero-alloc for int64 keys over 10k calls`` () =
    let bf = BloomFilter.createBlocked 20_000 0.01
    for i in 0 .. 9_999 do bf.Add (int64 i)
    let bytes =
        measureAlloc 3 (fun () ->
            for i in 0 .. 9_999 do bf.MayContain (int64 i) |> ignore)
    Assert.True((bytes = 0L), sprintf "Expected 0 bytes allocated, got %d" bytes)


[<Fact>]
let ``CountingBloomFilter Add is zero-alloc for int64 keys over 10k calls`` () =
    let bf = BloomFilter.createCounting 20_000 0.01
    let bytes =
        measureAlloc 3 (fun () ->
            for i in 0 .. 9_999 do bf.Add (int64 i))
    Assert.True((bytes = 0L), sprintf "Expected 0 bytes allocated, got %d" bytes)


[<Fact>]
let ``CountingBloomFilter MayContain is zero-alloc for int64 keys over 10k calls`` () =
    let bf = BloomFilter.createCounting 20_000 0.01
    for i in 0 .. 9_999 do bf.Add (int64 i)
    let bytes =
        measureAlloc 3 (fun () ->
            for i in 0 .. 9_999 do bf.MayContain (int64 i) |> ignore)
    Assert.True((bytes = 0L), sprintf "Expected 0 bytes allocated, got %d" bytes)
