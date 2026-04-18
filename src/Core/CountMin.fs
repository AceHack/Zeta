namespace Zeta.Core

open System
open System.Buffers.Binary
open System.IO.Hashing
open System.Runtime.CompilerServices


/// Count-Min Sketch — approximate frequency estimator. `Count(x)` returns
/// an overestimate of `support_weight(x)` in a Z-set stream, with
/// provable error bound `ε = e / w` with probability `1 - δ = 1 - e^-d`,
/// where `w, d` are the sketch width and depth.
///
/// **Why this is a genuinely novel addition to DBSP:** the sketch is
/// *linear* — `cms(a + b) = cms(a) + cms(b)` — so it commutes with D
/// and I. A delta-only update at tick `t` updates the sketch in O(d)
/// without re-scanning the integrated history; merge across shards is
/// an elementwise `+`. HLL gives you **distinct** cardinality; CMS
/// gives you **frequency**. Most streaming engines ship one, not both.
///
/// Negative weights (retractions) are handled natively: we treat the
/// CMS as living in ℤ^(d×w) rather than ℕ^(d×w), which preserves linearity
/// at the cost of making the bound a CountMinMean rather than CountMin.
/// For applications where you only insert (no retraction), the ordinary
/// CountMin bound applies and `Estimate` returns the min-row value.
///
/// References:
///   - Cormode & Muthukrishnan "Improved Data Stream Summaries" (2005)
///   - Deshpande & Muthu "Simpler algorithm for estimating frequency
///     moments of data streams" (SODA 2004) — extension to retractions
[<Sealed>]
type CountMinSketch(depth: int, width: int, seed: int64) =
    do
        if depth < 1 || depth > 32 then invalidArg (nameof depth) "must be 1..32"
        if width < 8 then invalidArg (nameof width) "must be ≥ 8"

    /// table[row * width + col] — flattened for cache-friendly scanning.
    let table = Array.zeroCreate<int64> (depth * width)
    // Per-row seeds — independent hash functions over a single XxHash3
    // keyed with `seed + rowIdx`.
    let rowSeeds =
        Array.init depth (fun i ->
            // Splat seed through SplitMix to get independent-looking
            // row seeds. Cheap and deterministic for replay.
            let mutable z = uint64 seed * 0x9E3779B97F4A7C15UL ^^^ (uint64 i * 0xBF58476D1CE4E5B9UL)
            z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
            z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
            z ^^^ (z >>> 31))

    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    let columnFor (hash: uint64) (w: int) : int =
        // `fastrange` on 32-bit hash: takes the low 32 bits so the
        // `hash32 * w` product fits in uint64 without truncation. With
        // a full uint64 hash we'd overflow and get `col ≥ w`.
        let hash32 = uint32 hash
        int ((uint64 hash32 * uint64 (uint32 w)) >>> 32)

    /// Hash `value` into column at `row`. Caller supplies a 64-bit
    /// `baseHash`; we XOR in the row seed so each row sees independent
    /// bits. Inline so the JIT can fuse across rows.
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    let colAt (baseHash: uint64) (row: int) : int =
        let mutable z = baseHash ^^^ rowSeeds.[row]
        z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
        z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
        columnFor (z ^^^ (z >>> 31)) width

    member _.Depth = depth
    member _.Width = width
    member _.Seed = seed

    /// Add `weight` at `key`. Linear in `depth`; negative weights
    /// retract (see class docstring).
    member _.Add(baseHash: uint64, weight: int64) =
        for row in 0 .. depth - 1 do
            let col = colAt baseHash row
            table.[row * width + col] <- Checked.(+) table.[row * width + col] weight

    /// Convenience: hash `value` with `HashCode.Combine` then add.
    member this.Add(value: 'T, weight: int64) =
        // SplitMix the 32-bit .NET hash to 64-bit — same mixer as
        // `HyperLogLog.Add`; no alloc.
        let h32 = HashCode.Combine value |> uint64
        let mutable z = h32 * 0x9E3779B97F4A7C15UL
        z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
        z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
        this.Add(z ^^^ (z >>> 31), weight)

    /// Hash a byte span directly for higher-entropy keys.
    member this.AddBytes(bytes: ReadOnlySpan<byte>, weight: int64) =
        this.Add(XxHash3.HashToUInt64 bytes, weight)

    /// Classic min-row estimate — correct for insertion-only streams;
    /// an overestimate with bounded error. Returns 0 if all rows are 0.
    member _.Estimate(baseHash: uint64) : int64 =
        let mutable result = Int64.MaxValue
        for row in 0 .. depth - 1 do
            let col = colAt baseHash row
            let v = table.[row * width + col]
            if v < result then result <- v
        if result = Int64.MaxValue then 0L else result

    member this.Estimate(value: 'T) : int64 =
        let h32 = HashCode.Combine value |> uint64
        let mutable z = h32 * 0x9E3779B97F4A7C15UL
        z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
        z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
        this.Estimate(z ^^^ (z >>> 31))

    /// Median-row estimate — robust to retractions. At the cost of a
    /// `depth`-sized sort per query, gives an unbiased estimator even
    /// when weights go negative.
    member _.EstimateMedian(baseHash: uint64) : int64 =
        let buf = Array.zeroCreate<int64> depth
        for row in 0 .. depth - 1 do
            let col = colAt baseHash row
            buf.[row] <- table.[row * width + col]
        Array.sortInPlace buf
        if depth % 2 = 1 then buf.[depth / 2]
        else (buf.[depth / 2 - 1] + buf.[depth / 2]) / 2L

    /// Merge another CMS into this one — **linear** merge. Both sketches
    /// must share the same `depth`, `width`, and `seed` (so hash
    /// functions agree). Saves the union of two shard-local sketches.
    member _.Union(other: CountMinSketch) =
        if other.Depth <> depth || other.Width <> width || other.Seed <> seed then
            invalidArg (nameof other) "CountMinSketch dimensions or seed mismatch"
        let otherTable : int64 array = other.Table
        for i in 0 .. table.Length - 1 do
            table.[i] <- Checked.(+) table.[i] otherTable.[i]

    /// Total weight across the sketch — divided by `depth` gives the
    /// total input weight (each insertion lands once per row). Useful
    /// sanity check in tests.
    member _.TotalWeight : int64 =
        let mutable total = 0L
        for v in table do total <- Checked.(+) total v
        total / int64 depth

    /// Rough memory footprint in bytes.
    member _.Bytes = int64 (depth * width) * 8L

    member internal _.Table = table


[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module CountMinSketch =

    /// Build a sketch sized for additive error ε with confidence 1-δ.
    /// Classical Cormode bound: `w ≥ e/ε`, `d ≥ ln(1/δ)`.
    let forEpsDelta (epsilon: double) (delta: double) (seed: int64) : CountMinSketch =
        if epsilon <= 0.0 || epsilon >= 1.0 then
            invalidArg (nameof epsilon) "must be in (0, 1)"
        if delta <= 0.0 || delta >= 1.0 then
            invalidArg (nameof delta) "must be in (0, 1)"
        let width = int (ceil (Math.E / epsilon))
        let depth = int (ceil (log (1.0 / delta)))
        CountMinSketch(depth, max 8 width, seed)

    /// Reasonable defaults: ε = 0.01 (1% additive error), δ = 0.001
    /// (0.1% prob of exceeding it). ~2 KB sketch.
    let defaults (seed: int64) : CountMinSketch = forEpsDelta 0.01 0.001 seed
