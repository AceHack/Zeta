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
let ``Blocked Bloom ReadOnlySpan<byte> overload round-trips a user-type key (full 128-bit path)`` () =
    // User types hash via the byte-span entry point (replaces the deleted 32-bit
    // GetHashCode generic). Serialise the key to bytes; presence holds, a different
    // key is (very likely) absent.
    let bf = BloomFilter.createBlocked 1000 0.01
    let key = Text.Encoding.UTF8.GetBytes "user:42"
    let other = Text.Encoding.UTF8.GetBytes "user:9999"
    bf.Add(ReadOnlySpan<byte>(key))
    bf.MayContain(ReadOnlySpan<byte>(key)) |> should be True
    bf.MayContain(ReadOnlySpan<byte>(other)) |> should be False


[<Fact>]
let ``Counting Bloom ReadOnlySpan<byte> overload supports Add then Remove (retraction)`` () =
    let bf = BloomFilter.createCounting 1000 0.01
    let key = Text.Encoding.UTF8.GetBytes "user:42"
    bf.Add(ReadOnlySpan<byte>(key))
    bf.MayContain(ReadOnlySpan<byte>(key)) |> should be True
    bf.Remove(ReadOnlySpan<byte>(key))
    bf.MayContain(ReadOnlySpan<byte>(key)) |> should be False


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


// ───────────────────────────────────────────────────────────────────
// Empirical-FPR regression gate. A bucket-selection bug in
// addPair/testPair (using the same low h1 bits that feed the inner
// bit-index sequence) caused measured FPR to exceed target by
// 4.6x-9.8x across N in {10k, 100k, 1M} under disjoint-probe sets.
// Fix in BloomFilter.fs: select bucket from the high 32 bits of h1
// so bucket index and first-probe bit position are decorrelated.
// This test uses the same disjoint-probe construction the
// failure-detecting harness used (/tmp/bloom_fpr_check.fsx) and
// asserts measured FPR <= 2 x target at every N, matching the
// acceptance threshold documented in
// docs/research/bloom-bench-2026-04.md.
// ───────────────────────────────────────────────────────────────────

let private measureBlockedFpr (n: int) : float =
    let bf = BloomFilter.createBlocked n 0.01
    for i in 0 .. n - 1 do bf.Add (int64 (2 * i))
    let mutable fps = 0
    for i in 0 .. n - 1 do
        if bf.MayContain (int64 (2 * i + 1)) then fps <- fps + 1
    float fps / float n

[<Theory>]
[<InlineData 10_000>]
[<InlineData 100_000>]
let ``Blocked Bloom measured FPR stays within 2x of target p=0.01`` (n: int) =
    let rate = measureBlockedFpr n
    Assert.True(
        rate <= 0.02,
        sprintf
            "measured FPR %.5f exceeds 2x target (0.02) at N=%d; bucket-selection correlation bug has regressed"
            rate n)


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
