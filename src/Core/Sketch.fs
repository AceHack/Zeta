namespace Zeta.Core

open System
open System.Buffers.Binary
open System.IO.Hashing
open System.Runtime.CompilerServices


/// HyperLogLog — an approximate distinct-count sketch. Estimates cardinality
/// `|supp(Z-set)|` in O(1) memory regardless of input size, with standard
/// error `≈ 1.04 / √m` where `m = 2^logBuckets`. At `logBuckets = 12` (4 KB
/// sketch) the typical error is ~1.6% — often good enough for planning,
/// top-N heavy-hitter filters, and dashboards that would otherwise need a
/// `distinct ⨾ count` traversal.
///
/// Two sketches built from the same seed are *mergeable* via `Union`, so
/// HLL works across a sharded streaming engine. Feldera has no sketch
/// layer; this is a novel addition.
[<Sealed>]
type HyperLogLog(logBuckets: int) =
    do
        if logBuckets < 4 || logBuckets > 16 then
            invalidArg (nameof logBuckets) "must be between 4 and 16"

    let m = 1 <<< logBuckets
    let buckets = Array.zeroCreate<byte> m
    let alpha =
        match m with
        | 16 -> 0.673
        | 32 -> 0.697
        | 64 -> 0.709
        | _ -> 0.7213 / (1.0 + 1.079 / float m)

    /// Absorb a 64-bit hash (caller is responsible for a good mixer).
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    member _.AddHash(hash: uint64) =
        let bucket = int (hash >>> (64 - logBuckets))
        let rest = (hash <<< logBuckets) ||| (1UL <<< (logBuckets - 1))
        let rank = byte (System.Numerics.BitOperations.LeadingZeroCount rest + 1)
        if rank > buckets.[bucket] then buckets.[bucket] <- rank

    /// Add an arbitrary value. Hashes through an inline 64-bit fmix64
    /// mixer (SplitMix / Murmur3 final-mix constants) for avalanche —
    /// the same mixer the rest of the lib uses — **without allocating**.
    /// An earlier revision called `XxHash3.HashToUInt64` on a 4-byte
    /// heap array per Add; for a 1 M-element stream that's 1 M Gen-0
    /// allocations purely for HLL.
    ///
    /// Note the entropy ceiling: `HashCode.Combine` narrows any `'T` to
    /// int32 first, so two keys colliding under .NET's `GetHashCode`
    /// *also* collide in HLL. The mixer spreads those 32 bits uniformly
    /// across 64, which is what HLL's `alpha` constant demands, but
    /// can't add entropy that wasn't already there. For cardinalities
    /// ≥ ~65 k the 32-bit floor begins to dominate; use `AddHash`
    /// directly with a proper `XxHash3`/`XxHash64` on bytes if you need
    /// billions-scale accuracy.
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    member this.Add(value: 'T) =
        let h32 = HashCode.Combine value |> uint64
        // SplitMix64 finaliser — public-domain constants, 5 ops, no alloc.
        let mutable z = h32 * 0x9E3779B97F4A7C15UL
        z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
        z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
        this.AddHash (z ^^^ (z >>> 31))

    /// Add a byte span directly — lets callers with a canonical byte
    /// representation (serialised key, UTF-8 string) bypass the 32-bit
    /// `HashCode` ceiling entirely and get true 64-bit avalanche.
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    member this.AddBytes(bytes: ReadOnlySpan<byte>) =
        this.AddHash (XxHash3.HashToUInt64 bytes)

    /// Merge another HLL sketch (same bucket count). Used for shard union.
    member _.Union(other: HyperLogLog) =
        if other.LogBuckets <> logBuckets then
            invalidArg (nameof other) "bucket count mismatch"
        let o : byte array = other.Buckets
        for i in 0 .. m - 1 do
            if o.[i] > buckets.[i] then buckets.[i] <- o.[i]

    /// Current cardinality estimate.
    member _.Estimate() : int64 =
        let mutable sum = 0.0
        let mutable zeros = 0
        for i in 0 .. m - 1 do
            let b = buckets.[i]
            sum <- sum + 1.0 / (float (1UL <<< int b))
            if b = 0uy then zeros <- zeros + 1
        let raw = alpha * float (m * m) / sum
        // Small-range correction: linear counting when many buckets empty.
        let est =
            if raw <= 2.5 * float m && zeros > 0 then
                float m * log (float m / float zeros)
            else raw
        int64 (round est)

    member internal _.Buckets = buckets
    member _.LogBuckets = logBuckets
    member _.BucketCount = m
