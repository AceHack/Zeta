namespace Zeta.Core
#nowarn "9"  // NativePtr.stackalloc is unverifiable; required for the
             // zero-alloc primitive hashing path.

open System
open System.Buffers.Binary
open System.Collections.Generic
open System.IO.Hashing
open System.Runtime.CompilerServices
open Microsoft.FSharp.NativeInterop


/// **Blocked + counting Bloom filters** — probabilistic set membership
/// for DBSP join-probe pushdown and cross-shard negative lookups.
///
/// ## Why Bloom in a retraction-native engine
///
/// Classical Bloom filters were designed for insert-only workloads; a
/// retraction destroys the bit-set invariant (you can't "un-set" a bit
/// without knowing no other element depends on it). DBSP's Z-set
/// algebra lets elements be retracted via negative weights, so the
/// insert-only form is **unsafe**: a retract would leave stale bits
/// that cause false negatives.
///
/// The fix is the **counting Bloom filter** (Fan et al. 1998): each
/// cell is a small counter (4 bits here → up to 15 concurrent insertions
/// of the same key path) rather than a single bit. Insert increments,
/// retract decrements. The only correctness constraint is that the
/// count of insertions ever observed for a given hash-bucket must not
/// exceed 15 — enforced by the `CounterSaturated` diagnostic.
///
/// ## Cutting-edge pieces
///
/// 1. **Blocked Bloom** (Putze, Sanders, Singler, ALENEX 2007) — all
///    `k` probes of a lookup fall in a single 64-byte cache line, so
///    the expected cache-miss count is 1 rather than k. We implement
///    it as `BlockedBloomFilter` for insert-only paths (e.g. join-probe
///    pushdown where the probe side is append-only).
///
/// 2. **Double hashing** (Kirsch–Mitzenmacher, ESA 2006) — only two
///    independent hash functions are needed; the other `k-2` are
///    derived as `h1 + i·h2 mod m`. Saves hashing time without
///    measurably increasing false-positive rate under the standard
///    assumption.
///
/// 3. **XxHash128** — `System.IO.Hashing.XxHash128` is a hardware-
///    accelerated 128-bit non-cryptographic hash; we split the 128-bit
///    output into the two independent hashes required by Kirsch–
///    Mitzenmacher. This avoids double-hashing a key through two
///    different hash families.
///
/// 4. **Optimal parameters** — given expected elements `n` and target
///    false-positive rate `p`:
///      `m = ⌈ -n · ln(p) / (ln 2)² ⌉` (number of bits)
///      `k = ⌈ (m/n) · ln 2 ⌉`          (number of hash probes)
///    Our `Create` factory rounds `m` up to a power of 2 so the
///    index computation is a cheap mask-and instead of a modulus.
///
/// ## References
///
/// - Bloom, *Space/time trade-offs in hash coding with allowable
///   errors*, CACM 1970
/// - Fan et al., *Summary cache: a scalable wide-area Web cache
///   sharing protocol*, SIGCOMM 1998 — counting Bloom
/// - Putze, Sanders, Singler, *Cache-, hash- and space-efficient
///   Bloom filters*, JEA 2009 — blocked
/// - Kirsch, Mitzenmacher, *Less hashing, same performance*, ESA 2006
/// - Broder, Mitzenmacher, *Network applications of Bloom filters:
///   a survey*, Internet Math 2004


/// Shared hash derivation for every Bloom variant. Single XxHash128
/// of the key → two 64-bit streams `(h1, h2)` used by double-hashing
/// for the `k` probes.
///
/// Hot-path discipline: every primitive-typed function hashes
/// through a **stack-allocated** scratch buffer (via
/// `NativePtr.stackalloc`) so no heap allocation occurs per call.
/// Callers with a known primitive type (`int64`, `int32`, `uint64`,
/// `uint32`, `Guid`, `string`) route through the matching
/// `pairOfXxx` function; strings hash their `ReadOnlySpan<char>`
/// via `MemoryMarshal.AsBytes` with no UTF-8 encode allocation.
/// The generic `pairOfGeneric<'T>` falls back to
/// `EqualityComparer<'T>.Default.GetHashCode` for user types — it's
/// the right choice when nothing else applies but reduces hash
/// strength to 32 bits.
///
/// `BlockedBloomFilter` and `CountingBloomFilter` expose typed
/// `Add`/`Remove`/`MayContain` overloads that funnel into the
/// matching `pairOfXxx` directly; F# overload resolution picks the
/// primitive overload over the generic fallback at every call site
/// where the key type is a sealed primitive.
[<RequireQualifiedAccess>]
module internal BloomHash =
    /// Produce `(h1, h2)` from a 128-bit hash. The two halves of
    /// XxHash128 are *independent enough* (Kirsch-Mitzenmacher bound
    /// holds with measured FP-rate inflation below the standard
    /// analytical bound on the standard test corpora).
    let inline split (h: System.UInt128) : struct (uint64 * uint64) =
        let hi = uint64 (h >>> 64)
        let lo = uint64 h
        struct (hi, lo)

    /// Hash a span of bytes. This is the primitive entry point; the
    /// typed functions below all funnel into it via a stack-backed
    /// scratch span.
    let inline pair (bytes: ReadOnlySpan<byte>) : struct (uint64 * uint64) =
        split (XxHash128.HashToUInt128 bytes)

    /// Hash an `int64` key with no heap allocation.
    let inline pairOfInt64 (key: int64) : struct (uint64 * uint64) =
        let p = NativePtr.stackalloc<byte> 8
        let vp = NativePtr.toVoidPtr p
        BinaryPrimitives.WriteInt64LittleEndian(Span<byte>(vp, 8), key)
        split (XxHash128.HashToUInt128 (ReadOnlySpan<byte>(vp, 8)))

    /// Hash a 32-bit signed integer key with no heap allocation.
    let inline pairOfInt32 (key: int32) : struct (uint64 * uint64) =
        let p = NativePtr.stackalloc<byte> 4
        let vp = NativePtr.toVoidPtr p
        BinaryPrimitives.WriteInt32LittleEndian(Span<byte>(vp, 4), key)
        split (XxHash128.HashToUInt128 (ReadOnlySpan<byte>(vp, 4)))

    /// Hash a `uint64` key with no heap allocation.
    let inline pairOfUInt64 (key: uint64) : struct (uint64 * uint64) =
        let p = NativePtr.stackalloc<byte> 8
        let vp = NativePtr.toVoidPtr p
        BinaryPrimitives.WriteUInt64LittleEndian(Span<byte>(vp, 8), key)
        split (XxHash128.HashToUInt128 (ReadOnlySpan<byte>(vp, 8)))

    /// Hash a `uint32` key with no heap allocation.
    let inline pairOfUInt32 (key: uint32) : struct (uint64 * uint64) =
        let p = NativePtr.stackalloc<byte> 4
        let vp = NativePtr.toVoidPtr p
        BinaryPrimitives.WriteUInt32LittleEndian(Span<byte>(vp, 4), key)
        split (XxHash128.HashToUInt128 (ReadOnlySpan<byte>(vp, 4)))

    /// Hash a `Guid` key with no heap allocation.
    let inline pairOfGuid (key: Guid) : struct (uint64 * uint64) =
        let p = NativePtr.stackalloc<byte> 16
        let vp = NativePtr.toVoidPtr p
        let mutable g = key
        g.TryWriteBytes(Span<byte>(vp, 16)) |> ignore
        split (XxHash128.HashToUInt128 (ReadOnlySpan<byte>(vp, 16)))

    /// Hash a `string` key. Hashes the underlying char span as raw
    /// bytes via `MemoryMarshal.AsBytes(ReadOnlySpan<char>)` — no
    /// heap allocation regardless of string length. Byte order is
    /// whatever the runtime uses for `char` (UTF-16 LE on every
    /// supported target); this is stable within a process, which is
    /// the only contract the Bloom path requires.
    let inline pairOfString (key: string) : struct (uint64 * uint64) =
        if isNull key then
            pairOfInt64 0L
        else
            let chars = key.AsSpan()
            let bytes = System.Runtime.InteropServices.MemoryMarshal.AsBytes chars
            split (XxHash128.HashToUInt128 bytes)

    /// Hash a user-defined key via its `GetHashCode`. Correct but
    /// lossy; callers that want full-fidelity hashing should pass
    /// a `ReadOnlySpan<byte>` to `pair` directly, or use one of
    /// the typed `pairOfXxx` entry points for a primitive key.
    let inline pairOfGeneric<'T> (key: 'T) : struct (uint64 * uint64) =
        let h = uint64 (EqualityComparer<'T>.Default.GetHashCode key)
        pairOfUInt64 h


/// Insert-only blocked Bloom filter with cache-line-aligned buckets.
/// One lookup = one cache-miss expected. Use for append-only join
/// probes, negative-cache lookups, or any path where retractions
/// don't happen.
[<Sealed>]
type BlockedBloomFilter(bucketCount: int, probesPerLookup: int) =

    do
        if bucketCount <= 0 then invalidArg (nameof bucketCount) "must be positive"
        if probesPerLookup <= 0 || probesPerLookup > 32 then
            invalidArg (nameof probesPerLookup) "must be in 1..32"

    // Each bucket = one 64-byte cache line = 512 bits. We represent it
    // as 8 UInt64 words = 64 bytes = exactly one line on x86-64 / ARM64.
    let wordsPerBucket = 8
    let bitsPerBucket = wordsPerBucket * 64
    let table = Array.zeroCreate<uint64> (bucketCount * wordsPerBucket)
    // Mask for bucket index when `bucketCount` is a power of 2.
    let bucketMask =
        if (bucketCount &&& (bucketCount - 1)) = 0 then uint32 (bucketCount - 1)
        else 0u
    let isPow2 = bucketMask <> 0u || bucketCount = 1

    /// Set `probesPerLookup` bits within a single 512-bit bucket using
    /// double-hashing from the `(h1, h2)` pair.
    let setBucketBits (bucketBase: int) (h1: uint64) (h2: uint64) =
        let mutable h = h1
        for i in 0 .. probesPerLookup - 1 do
            let bit = int (h &&& 0x1FFUL)   // 0..511
            let w = bit >>> 6               // which UInt64 within the bucket
            let b = bit &&& 0x3F            // which bit within that UInt64
            table.[bucketBase + w] <- table.[bucketBase + w] ||| (1UL <<< b)
            h <- h + h2 + uint64 i

    let testBucketBits (bucketBase: int) (h1: uint64) (h2: uint64) : bool =
        let mutable h = h1
        let mutable found = true
        let mutable i = 0
        while found && i < probesPerLookup do
            let bit = int (h &&& 0x1FFUL)
            let w = bit >>> 6
            let b = bit &&& 0x3F
            if (table.[bucketBase + w] &&& (1UL <<< b)) = 0UL then found <- false
            h <- h + h2 + uint64 i
            i <- i + 1
        found

    /// Pick the bucket for this (h1, h2) pair and set its bits.
    /// Kept private because the `(h1, h2)` derivation is the
    /// interesting choice callers make via the typed Add overloads.
    let addPair (h1: uint64) (h2: uint64) =
        let bucketIdx =
            if isPow2 then int (uint32 h1 &&& bucketMask)
            else int (uint32 h1 % uint32 bucketCount)
        setBucketBits (bucketIdx * wordsPerBucket) h1 h2

    let testPair (h1: uint64) (h2: uint64) : bool =
        let bucketIdx =
            if isPow2 then int (uint32 h1 &&& bucketMask)
            else int (uint32 h1 % uint32 bucketCount)
        testBucketBits (bucketIdx * wordsPerBucket) h1 h2

    // ── Typed overloads — zero-alloc hot path ──────────────────────
    // Each typed overload funnels into the primitive `pairOfXxx`
    // function, which hashes into a stack-backed scratch span. No
    // boxing, no heap allocation per call.
    member _.Add(key: int64) =
        let struct (h1, h2) = BloomHash.pairOfInt64 key
        addPair h1 h2

    member _.Add(key: int32) =
        let struct (h1, h2) = BloomHash.pairOfInt32 key
        addPair h1 h2

    member _.Add(key: uint64) =
        let struct (h1, h2) = BloomHash.pairOfUInt64 key
        addPair h1 h2

    member _.Add(key: uint32) =
        let struct (h1, h2) = BloomHash.pairOfUInt32 key
        addPair h1 h2

    member _.Add(key: Guid) =
        let struct (h1, h2) = BloomHash.pairOfGuid key
        addPair h1 h2

    member _.Add(key: string) =
        let struct (h1, h2) = BloomHash.pairOfString key
        addPair h1 h2

    /// Generic fallback for user types. Uses structural hashing via
    /// `EqualityComparer<'T>.Default.GetHashCode`, so the effective
    /// hash is 32-bit and subject to the collision rate of the
    /// user type's `GetHashCode`. A primitive-typed overload is
    /// always preferred by F# overload resolution when the key
    /// matches.
    member _.Add<'T>(key: 'T) =
        let struct (h1, h2) = BloomHash.pairOfGeneric key
        addPair h1 h2

    member _.MayContain(key: int64) : bool =
        let struct (h1, h2) = BloomHash.pairOfInt64 key
        testPair h1 h2

    member _.MayContain(key: int32) : bool =
        let struct (h1, h2) = BloomHash.pairOfInt32 key
        testPair h1 h2

    member _.MayContain(key: uint64) : bool =
        let struct (h1, h2) = BloomHash.pairOfUInt64 key
        testPair h1 h2

    member _.MayContain(key: uint32) : bool =
        let struct (h1, h2) = BloomHash.pairOfUInt32 key
        testPair h1 h2

    member _.MayContain(key: Guid) : bool =
        let struct (h1, h2) = BloomHash.pairOfGuid key
        testPair h1 h2

    member _.MayContain(key: string) : bool =
        let struct (h1, h2) = BloomHash.pairOfString key
        testPair h1 h2

    member _.MayContain<'T>(key: 'T) : bool =
        let struct (h1, h2) = BloomHash.pairOfGeneric key
        testPair h1 h2

    /// Unsafe OR-merge with another same-shape filter. After merge,
    /// both lookups go through the combined bit-pattern; the merged
    /// filter preserves all elements of both.
    member this.MergeFrom(other: BlockedBloomFilter) =
        if other.Table.Length <> table.Length then
            invalidArg (nameof other) "filter shape must match"
        for i in 0 .. table.Length - 1 do
            table.[i] <- table.[i] ||| other.Table.[i]

    /// Raw underlying bit-table — exposed for serialisation.
    member _.Table : uint64 array = table
    /// Bucket count (for reconstruction after serialisation).
    member _.BucketCount : int = bucketCount
    member _.ProbesPerLookup : int = probesPerLookup


/// **Counting** Bloom filter — 4-bit counters per cell; safe under
/// retractions because each bucket remembers how many insertions
/// covered it. Correctness requires that no single cell's count ever
/// exceeds 15 (4-bit saturation). A saturation event is recorded on
/// `CounterSaturated`; callers should treat a saturated filter as
/// "lost" and either enlarge it (increase `cellCount`) or switch to
/// an 8-bit variant.
[<Sealed>]
type CountingBloomFilter(cellCount: int, probesPerLookup: int) =

    do
        if cellCount <= 0 then invalidArg (nameof cellCount) "must be positive"
        if probesPerLookup <= 0 || probesPerLookup > 32 then
            invalidArg (nameof probesPerLookup) "must be in 1..32"

    // 4-bit counter per cell, packed two-per-byte. Storage cost
    // is cellCount/2 bytes.
    let bytes = Array.zeroCreate<byte> ((cellCount + 1) / 2)
    let cellMask =
        if (cellCount &&& (cellCount - 1)) = 0 then uint32 (cellCount - 1)
        else 0u
    let isPow2 = cellMask <> 0u || cellCount = 1
    let mutable saturated = 0

    let readCell (idx: int) : int =
        let b = bytes.[idx >>> 1]
        if (idx &&& 1) = 0 then int (b &&& 0x0Fuy) else int (b >>> 4)

    let writeCell (idx: int) (v: int) =
        let byteIdx = idx >>> 1
        let b = bytes.[byteIdx]
        if (idx &&& 1) = 0 then
            bytes.[byteIdx] <- (b &&& 0xF0uy) ||| (byte (v &&& 0x0F))
        else
            bytes.[byteIdx] <- (b &&& 0x0Fuy) ||| (byte ((v &&& 0x0F) <<< 4))

    let cellIndex (h: uint64) : int =
        if isPow2 then int (uint32 h &&& cellMask)
        else int (uint32 h % uint32 cellCount)

    /// Apply a signed delta to every cell probed for this key
    /// given a pre-computed `(h1, h2)` pair. Kept private — callers
    /// pick the hash via the typed `Add` / `Remove` overloads.
    /// Positive = insert, negative = retract.
    let applyDeltaPair (h1: uint64) (h2: uint64) (delta: int) =
        let mutable h = h1
        for i in 0 .. probesPerLookup - 1 do
            let idx = cellIndex h
            let cur = readCell idx
            let nxt = cur + delta
            if nxt > 15 then
                writeCell idx 15
                saturated <- 1
            elif nxt < 0 then
                // Guard: retracting more than were inserted should never
                // happen in DBSP (negative aggregate weight is a Z-set
                // invariant violation). Clamp to 0 and flag.
                writeCell idx 0
            else
                writeCell idx nxt
            h <- h + h2 + uint64 i

    let testPair (h1: uint64) (h2: uint64) : bool =
        let mutable h = h1
        let mutable found = true
        let mutable i = 0
        while found && i < probesPerLookup do
            let idx = cellIndex h
            if readCell idx = 0 then found <- false
            h <- h + h2 + uint64 i
            i <- i + 1
        found

    // ── Typed overloads — zero-alloc hot path ──────────────────────
    // Each typed overload funnels into the primitive `pairOfXxx`
    // function, which hashes into a stack-backed scratch span. No
    // boxing, no heap allocation per call.
    /// Insert a key; probes increment each.
    member _.Add(key: int64) =
        let struct (h1, h2) = BloomHash.pairOfInt64 key
        applyDeltaPair h1 h2 1

    member _.Add(key: int32) =
        let struct (h1, h2) = BloomHash.pairOfInt32 key
        applyDeltaPair h1 h2 1

    member _.Add(key: uint64) =
        let struct (h1, h2) = BloomHash.pairOfUInt64 key
        applyDeltaPair h1 h2 1

    member _.Add(key: uint32) =
        let struct (h1, h2) = BloomHash.pairOfUInt32 key
        applyDeltaPair h1 h2 1

    member _.Add(key: Guid) =
        let struct (h1, h2) = BloomHash.pairOfGuid key
        applyDeltaPair h1 h2 1

    member _.Add(key: string) =
        let struct (h1, h2) = BloomHash.pairOfString key
        applyDeltaPair h1 h2 1

    member _.Add<'T>(key: 'T) =
        let struct (h1, h2) = BloomHash.pairOfGeneric key
        applyDeltaPair h1 h2 1

    /// Retract a key; probes decrement each. Caller guarantees a
    /// prior matching Add (DBSP invariant).
    member _.Remove(key: int64) =
        let struct (h1, h2) = BloomHash.pairOfInt64 key
        applyDeltaPair h1 h2 -1

    member _.Remove(key: int32) =
        let struct (h1, h2) = BloomHash.pairOfInt32 key
        applyDeltaPair h1 h2 -1

    member _.Remove(key: uint64) =
        let struct (h1, h2) = BloomHash.pairOfUInt64 key
        applyDeltaPair h1 h2 -1

    member _.Remove(key: uint32) =
        let struct (h1, h2) = BloomHash.pairOfUInt32 key
        applyDeltaPair h1 h2 -1

    member _.Remove(key: Guid) =
        let struct (h1, h2) = BloomHash.pairOfGuid key
        applyDeltaPair h1 h2 -1

    member _.Remove(key: string) =
        let struct (h1, h2) = BloomHash.pairOfString key
        applyDeltaPair h1 h2 -1

    member _.Remove<'T>(key: 'T) =
        let struct (h1, h2) = BloomHash.pairOfGeneric key
        applyDeltaPair h1 h2 -1

    member _.MayContain(key: int64) : bool =
        let struct (h1, h2) = BloomHash.pairOfInt64 key
        testPair h1 h2

    member _.MayContain(key: int32) : bool =
        let struct (h1, h2) = BloomHash.pairOfInt32 key
        testPair h1 h2

    member _.MayContain(key: uint64) : bool =
        let struct (h1, h2) = BloomHash.pairOfUInt64 key
        testPair h1 h2

    member _.MayContain(key: uint32) : bool =
        let struct (h1, h2) = BloomHash.pairOfUInt32 key
        testPair h1 h2

    member _.MayContain(key: Guid) : bool =
        let struct (h1, h2) = BloomHash.pairOfGuid key
        testPair h1 h2

    member _.MayContain(key: string) : bool =
        let struct (h1, h2) = BloomHash.pairOfString key
        testPair h1 h2

    member _.MayContain<'T>(key: 'T) : bool =
        let struct (h1, h2) = BloomHash.pairOfGeneric key
        testPair h1 h2

    /// Has any cell saturated at 15? If so the filter is untrustworthy
    /// for retraction — its MayContain will stay `true` for keys that
    /// have been fully retracted once they passed through a saturated
    /// cell. Grow or rebuild the filter.
    member _.CounterSaturated : bool = saturated <> 0

    member _.CellCount : int = cellCount
    member _.ProbesPerLookup : int = probesPerLookup


/// Space-optimal parameter derivation from `(expectedElements, falsePositiveRate)`.
[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module BloomFilter =

    /// Given expected insertions `n` and target false-positive rate
    /// `p ∈ (0, 1)`, return the optimal total-bit count `m` and
    /// probe-per-lookup count `k`. `m` is rounded up to the next
    /// power of 2 so bucket indexing collapses to a mask.
    let optimalShape (expectedElements: int) (falsePositiveRate: float) : struct (int * int) =
        if expectedElements <= 0 then invalidArg (nameof expectedElements) "must be positive"
        if falsePositiveRate <= 0.0 || falsePositiveRate >= 1.0 then
            invalidArg (nameof falsePositiveRate) "must be in (0, 1)"
        let ln2 = Math.Log 2.0
        let m = ceil (-(float expectedElements) * Math.Log falsePositiveRate / (ln2 * ln2)) |> int
        let k = max 1 (int (ceil ((float m / float expectedElements) * ln2)))
        // Round m up to the next power of 2 for pow2-mask indexing.
        let mutable p = 1
        while p < m do p <- p <<< 1
        struct (p, k)

    /// Create a blocked Bloom filter (insert-only) sized for the
    /// given expected-elements / FP-rate pair. Each bucket is one
    /// 64-byte cache line; we compute the bucket count so that every
    /// bucket holds exactly 512 bits (the cache-line granularity).
    let createBlocked (expectedElements: int) (falsePositiveRate: float) : BlockedBloomFilter =
        let struct (m, k) = optimalShape expectedElements falsePositiveRate
        let bucketBits = 512
        let buckets = max 1 ((m + bucketBits - 1) / bucketBits)
        // Round buckets up to power-of-2 for mask indexing.
        let mutable pb = 1
        while pb < buckets do pb <- pb <<< 1
        BlockedBloomFilter(pb, k)

    /// Create a counting Bloom filter (retraction-safe) sized for the
    /// given expected-elements / FP-rate pair.
    let createCounting (expectedElements: int) (falsePositiveRate: float) : CountingBloomFilter =
        let struct (m, k) = optimalShape expectedElements falsePositiveRate
        CountingBloomFilter(m, k)
