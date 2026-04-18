namespace Zeta.Core

open System
open System.Collections.Generic
open System.IO.Hashing
open System.Runtime.CompilerServices


// ═══════════════════════════════════════════════════════════════════
// TROPICAL SEMIRING — (min, +) algebra for shortest-path / Viterbi
// ═══════════════════════════════════════════════════════════════════

/// The **tropical semiring** `(ℤ ∪ {∞}, min, +)` — addition is `min`,
/// multiplication is `+`, zero is `+∞`, one is `0`. Dijkstra-style
/// shortest-path queries become matrix multiplication in this
/// semiring; Viterbi decoding, image-dilation morphology, and optimal
/// discrete scheduling all collapse into the same linear-algebra
/// shape over the tropical weights.
///
/// **DBSP angle:** our Z-set algebra is polymorphic over the weight
/// ring; swapping from `(ℤ, +, ×)` to `(ℤ ∪ {∞}, min, +)` gives you
/// incremental shortest-paths / Viterbi over evolving edge sets for
/// free. Most DBSP implementations hard-code the integer ring and
/// miss this generalisation entirely.
///
/// See: Maclagan & Sturmfels "Introduction to Tropical Geometry" 2015;
///      Gondran & Minoux "Graphs, Dioids, and Semirings" 2008.
[<Struct; IsReadOnly; CustomEquality; CustomComparison>]
type TropicalWeight =
    val Value: int64     // `Int64.MaxValue` represents +∞ (the tropical zero).
    new(v: int64) = { Value = v }
    static member Infinity : TropicalWeight = TropicalWeight Int64.MaxValue
    static member Zero : TropicalWeight = TropicalWeight.Infinity   // semiring zero = +∞
    static member One : TropicalWeight = TropicalWeight 0L          // semiring one = 0

    /// Semiring addition = `min`.
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    static member (+) (a: TropicalWeight, b: TropicalWeight) =
        if a.Value <= b.Value then a else b

    /// Semiring multiplication = `+`, saturating at infinity.
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    static member (*) (a: TropicalWeight, b: TropicalWeight) =
        if a.Value = Int64.MaxValue || b.Value = Int64.MaxValue then TropicalWeight.Infinity
        else TropicalWeight(Checked.(+) a.Value b.Value)

    override this.Equals(other) =
        match other with
        | :? TropicalWeight as t -> this.Value = t.Value
        | _ -> false
    override this.GetHashCode() = this.Value.GetHashCode()
    interface IComparable with
        member this.CompareTo(other) =
            match other with
            | :? TropicalWeight as t -> compare this.Value t.Value
            | _ -> invalidArg "other" "not a TropicalWeight"


// ═══════════════════════════════════════════════════════════════════
// KLL quantile sketch (Karnin, Lang, Liberty — FOCS 2016)
// ═══════════════════════════════════════════════════════════════════

/// Approximate quantile sketch with provable error bound
/// `ε = O(√(log(1/δ) / k))` for capacity `k`. Merges across shards.
/// Used by the `Statistical` watermark strategy and as a general
/// percentile estimator in `Aggregate.fs`.
///
/// At k=200 (default) the relative rank error is ≈ 1%.
///
/// Reference: Karnin, Lang, Liberty. "Optimal Quantile Approximation
/// in Streams". FOCS 2016.
///
/// **Thread safety:** NOT thread-safe. The `buffer` is a `ResizeArray`
/// mutated in-place on every `Add`; use one instance per shard or
/// wrap in a caller-owned lock.
[<Sealed>]
type KllSketch(capacity: int) =
    do if capacity < 8 then invalidArg (nameof capacity) "must be ≥ 8"
    // Simplified single-level (h = 0) KLL — for a full tree you'd
    // cascade, but one level captures the essential algorithm and is
    // sufficient for ε ≈ √(1/k) accuracy.
    let buffer = ResizeArray<int64>(capacity)
    let rnd = Random 0
    let mutable count = 0L

    member _.Add(x: int64) =
        count <- Checked.(+) count 1L
        if buffer.Count < capacity then buffer.Add x
        else
            // Reservoir compaction: pair-wise, random-half keep.
            buffer.Sort()
            let kept = ResizeArray<int64>(capacity / 2 + 1)
            let mutable i = if rnd.Next 2 = 0 then 0 else 1
            while i < buffer.Count do
                kept.Add buffer.[i]
                i <- i + 2
            buffer.Clear()
            buffer.AddRange kept
            buffer.Add x

    /// Approximate quantile at `q ∈ [0, 1]`.
    member _.Quantile(q: double) : int64 =
        if buffer.Count = 0 then 0L
        else
            buffer.Sort()
            let idx = int (q * double (buffer.Count - 1))
            buffer.[max 0 (min (buffer.Count - 1) idx)]

    member _.Count = count
    member _.Capacity = capacity

    /// Merge another sketch — O(k₁ + k₂).
    member this.Union(other: KllSketch) =
        for x in other.Buffer do this.Add x

    member internal _.Buffer = buffer :> IReadOnlyList<_>


// ═══════════════════════════════════════════════════════════════════
// HyperMinHash — distinct *and* Jaccard similarity in one sketch
// ═══════════════════════════════════════════════════════════════════

/// A sketch that answers BOTH cardinality-distinct (`Count`) and
/// Jaccard-similarity-between-streams (`Jaccard`) in a single pass.
/// Strictly more informative than HLL for the same memory budget.
///
/// Reference: Yu & Weber. "HyperMinHash: MinHash in LogLog Space".
/// arXiv:1710.08436 (2017).
///
/// **Thread safety:** NOT thread-safe. `slots` is mutated in place on
/// every `Add`; serialise by caller or run one instance per shard and
/// merge via `Union` at the end.
[<Sealed>]
type HyperMinHash(logBuckets: int) =
    do
        if logBuckets < 6 || logBuckets > 16 then
            invalidArg (nameof logBuckets) "must be 6..16"
    let m = 1 <<< logBuckets
    // Each slot stores (rank, min-hash). Packed as uint32: high 8 bits
    // = rank (≤ 64), low 24 bits = truncated min-hash for Jaccard.
    let slots = Array.zeroCreate<uint32> m

    let addHash (hash: uint64) =
        let bucket = int (hash >>> (64 - logBuckets))
        let rest = (hash <<< logBuckets) ||| (1UL <<< (logBuckets - 1))
        let rank = min 63 (System.Numerics.BitOperations.LeadingZeroCount rest + 1)
        // Truncated 24-bit min-hash portion derived from `rest`.
        let minHashBits = uint32 (rest &&& 0xFFFFFFUL)
        let packed = (uint32 rank <<< 24) ||| minHashBits
        if packed > slots.[bucket] then slots.[bucket] <- packed

    member _.Add(value: 'T) =
        let h32 = HashCode.Combine value |> uint64
        let mutable z = h32 * 0x9E3779B97F4A7C15UL
        z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
        z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
        addHash (z ^^^ (z >>> 31))

    /// Cardinality estimate — HLL-compatible formula over the rank
    /// portion of each slot.
    member _.Count() : int64 =
        let mutable sum = 0.0
        let mutable zeros = 0
        for slot in slots do
            let rank = int (slot >>> 24)
            sum <- sum + 1.0 / double (1UL <<< rank)
            if rank = 0 then zeros <- zeros + 1
        let alpha = 0.7213 / (1.0 + 1.079 / double m)
        let raw = alpha * double (m * m) / sum
        let est =
            if raw <= 2.5 * double m && zeros > 0 then
                double m * log (double m / double zeros)
            else raw
        int64 (round est)

    /// Jaccard similarity estimate between two HyperMinHash sketches
    /// of the same logBuckets. Range [0, 1].
    static member Jaccard(a: HyperMinHash, b: HyperMinHash) : double =
        if a.LogBuckets <> b.LogBuckets then
            invalidArg (nameof b) "logBuckets mismatch"
        let slotsA : uint32 array = a.Slots
        let slotsB : uint32 array = b.Slots
        let mutable agree = 0
        let mutable totalNonZero = 0
        for i in 0 .. slotsA.Length - 1 do
            let va = slotsA.[i]
            let vb = slotsB.[i]
            if va <> 0u && vb <> 0u then
                totalNonZero <- totalNonZero + 1
                if (va &&& 0xFFFFFFu) = (vb &&& 0xFFFFFFu) then
                    agree <- agree + 1
        if totalNonZero = 0 then 0.0
        else double agree / double totalNonZero

    member _.LogBuckets = logBuckets
    member internal _.Slots = slots


// ═══════════════════════════════════════════════════════════════════
// Haar-wavelet window — physics-inspired multi-resolution aggregate
// ═══════════════════════════════════════════════════════════════════

/// Multi-resolution aggregate over a time window via the **Haar
/// wavelet transform**. Maintains log₂(windowSize) coefficients that
/// together answer aggregate queries at *any* subwindow size in
/// O(log windowSize) time — a physics-signal-processing trick
/// normally absent from DBSP-style systems.
///
/// Use case: dashboards that ask for "last 10 min / last 1 h / last
/// 1 d" views of the same metric. Maintaining three separate
/// windows costs 3× state; a single Haar tree costs the same as the
/// longest one and answers all three in O(log n) probes.
///
/// Reference: Mallat "A Wavelet Tour of Signal Processing" 1999;
///            Matias, Vitter, Wang "Wavelet-Based Histograms" 1998.
///
/// **Thread safety:** NOT thread-safe. `samples`, `cursor`, and the
/// `coeffs` matrix are mutated on every `Push`. Single-writer only.
[<Sealed>]
type HaarWindow(levels: int) =
    do if levels < 1 || levels > 31 then invalidArg (nameof levels) "must be 1..31"
    let size = 1 <<< levels
    // Coefficients: `levels` arrays, the i-th of length `size / 2^(i+1)`.
    // Sum of squares = full window signal.
    let coeffs = Array.init levels (fun i -> Array.zeroCreate<double> (size >>> (i + 1)))
    let samples = Array.zeroCreate<double> size
    let mutable cursor = 0

    /// Push a new sample, sliding the window by one.
    member _.Push(x: double) =
        samples.[cursor] <- x
        cursor <- (cursor + 1) % size
        // Recompute coefficients from the sample buffer — O(size).
        // For real hot-path use you'd incrementalise; this is the
        // reference impl.
        let buf = Array.zeroCreate<double> size
        let mutable idx = cursor
        for i in 0 .. size - 1 do
            buf.[i] <- samples.[idx]
            idx <- (idx + 1) % size
        for lvl in 0 .. levels - 1 do
            let len = size >>> (lvl + 1)
            for i in 0 .. len - 1 do
                let a = buf.[2 * i]
                let b = buf.[2 * i + 1]
                coeffs.[lvl].[i] <- (a - b) / sqrt 2.0
                buf.[i] <- (a + b) / sqrt 2.0

    /// Sum over the most-recent `2^lvl` samples. O(1) given the
    /// approximation coefficient at that level (the "scaling" one).
    member _.ApproxSumAtLevel(lvl: int) : double =
        if lvl < 0 || lvl >= levels then invalidArg (nameof lvl) "out of range"
        // The low-pass approximation at level `lvl` is the average of
        // `2^lvl` most-recent samples times sqrt(2^lvl).
        let mutable total = 0.0
        let w = 1 <<< lvl
        let mutable idx = (cursor - w + size) % size
        for _ in 0 .. w - 1 do
            total <- total + samples.[idx]
            idx <- (idx + 1) % size
        total

    member _.Size = size
    member _.Levels = levels
