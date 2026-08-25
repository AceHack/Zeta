namespace Zeta.Core

open System
open System.Collections.Immutable
open System.Numerics
open System.Runtime.CompilerServices


/// **Column-oriented (struct-of-arrays) sibling of `ZSet<int64>`.**
///
/// `ZSet<'K>` is a *row store*: one immutable ascending run of
/// `ZEntry<'K> = [Key][Weight]` structs — array-of-structs (AoS).
/// `ColumnZSet` holds the same Z-set as two parallel `int64` columns —
/// struct-of-arrays (SoA). Same keys, same weights, same sort order, same
/// no-zero-weight invariant; only the physical layout differs.
///
/// **This is a sibling representation, not a replacement.** Nothing in the
/// repository is migrated onto it and `ZSet` is unchanged. Which of the two
/// should be primary — or whether both stay — is an open decision, not one
/// this file makes.
///
/// ## Why SoA is the same change as vectorisation
///
/// `ZSet.weightedCount` documents wanting `MemoryMarshal.Cast` +
/// `TensorPrimitives.Sum` and then concedes it cannot have them: in AoS the
/// weights are every *other* 8-byte lane, so a vector load picks up keys it
/// must then discard, and for a general `'K` the stride is not even known.
/// SoA removes that: each column is a contiguous `ReadOnlySpan<int64>`, which
/// is precisely what `Vector<int64>` wants. So the column store and the
/// vectorised kernel are one change, not two.
///
/// ## What was measured
///
/// Source: `bench/Benchmarks/ColumnZSetBench.fs` (BenchmarkDotNet, ShortRun),
/// Apple M2 Ultra, arm64/NEON, `Vector<int64>.Count = 2`, .NET 10. Ratios are
/// vector-vs-its-own-scalar-twin at n = 1 048 576 unless stated. **None of
/// these is a portable constant** — a 4-lane AVX2 or 8-lane AVX-512 host will
/// differ, and the sorted/shuffled split below matters more than lane count.
///
/// | operation | scalar | vector | ratio |
/// |---|---|---|---|
/// | range count, **shuffled** keys | 3 399 µs | 331 µs | **10.3x** |
/// | range count, **sorted** keys | 421 µs | 321 µs | **1.31x** |
/// | ranged weight sum, **shuffled** | 3 728 µs | 530 µs | **7.03x** |
/// | ranged weight sum, **sorted** | 582 µs | 584 µs | **1.00x — no win** |
/// | weight sum (unpredicated) | 563 µs | 396 µs | **1.42x** |
///
/// **The dominant variable is branch predictability, not vector width.** A
/// scalar predicate scan costs whatever its branch predictor costs; the
/// branchless vector kernel costs the same regardless of key order (331 µs
/// shuffled vs 321 µs sorted). So the ratio moves because the *scalar* side
/// moves by ~8x, not because the vector side gets faster.
///
/// Which regime applies is a property of the column, so it is stated rather
/// than averaged away:
///
/// - A `ColumnZSet` **key** column is **sorted by construction** (a Z-set is a
///   sorted run). Range predicates on it are highly predictable, so the
///   realistic win is ~1.3x for count and **nothing at all** for the ranged
///   sum. And on a sorted column you would not linear-scan — you would binary
///   search the two boundaries. **The vectorised scan earns its keep on
///   columns that are not the sort key**: weight predicates, and key columns
///   after an order-destroying projection.
/// - **Layout and execution pay in different regimes, and both are real.**
///   AoS→SoA on the *sorted* scan: 538 µs → 421 µs (**1.28x**, from touching 8
///   bytes per element instead of 16 — a bandwidth win). On the *shuffled*
///   scan the layout change is worth nothing, because branch misprediction
///   dominates and no amount of locality helps. Vectorising then buys 10.3x
///   there and 1.31x on the sorted column. This is Abadi et al. 2013's claim
///   with the nuance intact: column storage without column *execution* buys
///   little **where the loop is branch-bound**, though it still buys the
///   bandwidth where the loop is not.
///
/// **Honest cost of exactness.** `ZSet.weightedCount` (AoS, `Checked`, 4-way
/// unrolled) measures 351 µs against this type's 563 µs scalar / 396 µs vector
/// — because it is doing a *different, weaker* job: its overflow behaviour
/// depends on element position, while these kernels are exact. The columnar
/// sum is not "1.6x slower than the row store"; it is exact, and exactness
/// costs a test per element that the vector path amortises.
///
/// Register: `metered` for the three kernels below. Correctness has a real
/// falsifier — each kernel's scalar twin must agree with it on every input,
/// including the overflow class, checked by a 5 000-trial extreme-magnitude
/// differential test. The *speed* claim has one too: the 1.5x gate in
/// `ColumnZSet.Tests.fs`, which was mutation-checked (replacing the vector body
/// with the scalar loop drops it to 0.94x and fails) — while all correctness
/// tests still pass, which is precisely why the timing gate has to exist.
/// `ColumnZSetBench` reports both data regimes.
///
/// The cache/branch *explanations* above are `unmetered`: the timings are
/// measured, the causal account of them is inference from standard computer
/// architecture, not from performance counters.
///
/// Anchors (Beacon): Abadi, Boncz & Harizopoulos, *The Design and
/// Implementation of Modern Column-Oriented Database Systems* (FnT Databases
/// 5(3), 2013) — column storage without column *execution* buys little, which
/// is exactly the AoS-vs-SoA scalar rows above (3 175 µs vs 3 329 µs: the
/// layout alone changed nothing; vectorising it changed everything).
/// Boncz, Zukowski & Nes, *MonetDB/X100: Hyper-Pipelining Query Execution*
/// (CIDR 2005) — vectorised execution over column batches. Stonebraker et al.,
/// *C-Store* (VLDB 2005) — the column-store lineage.
[<Struct; IsReadOnly; NoComparison; NoEquality>]
type ColumnZSet =
    val internal keyCol: ImmutableArray<int64>
    val internal weightCol: ImmutableArray<int64>

    /// Construct from two already-parallel columns. **Caller owns the
    /// invariant**: `keys` strictly ascending, `weights` all non-zero, equal
    /// lengths. Use `ColumnZSet.ofZSet` / `ColumnZSet.ofSeq` for arbitrary
    /// input.
    new(keys: ImmutableArray<int64>, weights: ImmutableArray<int64>) =
        // Length agreement is checked because a mismatch does not fail here —
        // it fails much later as an ArgumentOutOfRangeException from a Slice
        // inside a kernel, or worse, truncates silently.
        let kn = if keys.IsDefault then 0 else keys.Length
        let wn = if weights.IsDefault then 0 else weights.Length
        if kn <> wn then
            invalidArg "weights" $"ColumnZSet columns must be parallel: {kn} keys but {wn} weights"
        { keyCol = keys; weightCol = weights }

    static member Empty: ColumnZSet =
        ColumnZSet(ImmutableArray<int64>.Empty, ImmutableArray<int64>.Empty)

    member this.Count = if this.keyCol.IsDefault then 0 else this.keyCol.Length

    member this.IsEmpty = this.keyCol.IsDefaultOrEmpty

    /// The key column — contiguous, vector-loadable. This span is the whole
    /// point of the representation.
    member this.KeySpan() : ReadOnlySpan<int64> =
        if this.keyCol.IsDefault then ReadOnlySpan.Empty else this.keyCol.AsSpan()

    /// The weight column — contiguous, vector-loadable.
    member this.WeightSpan() : ReadOnlySpan<int64> =
        if this.weightCol.IsDefault then ReadOnlySpan.Empty else this.weightCol.AsSpan()


/// Vectorised kernels over `ColumnZSet` columns. Every kernel ships as a
/// matched pair — `*Scalar` and `*Vectorized` — that agree on **every** input,
/// including the overflow class. The pairing is the correctness falsifier.
///
/// ## Overflow: exact, and identical on every host
///
/// `ZSet.weightedCount` sums with `Checked.(+)` into **four** unrolled
/// accumulators, so whether it raises depends on where an element sits modulo
/// 4. A vector kernel partitions into `Vector<int64>.Count` lanes instead — 2
/// on NEON, 4 on AVX2, 8 on AVX-512. Those are *different partitions*, so a
/// naive "checked per lane" vector kernel raises on inputs its scalar twin
/// sums fine, and vice versa, **and the answer changes with the host ISA**:
///
/// ```
/// [MaxValue; MaxValue; -MaxValue; -MaxValue]  NEON: throws   AVX2: returns 0
/// [MaxValue; -MaxValue; MaxValue; -MaxValue]  NEON: returns 0  AVX2: throws
/// ```
///
/// Same bytes, same code, different behaviour per machine. That is a DST
/// replay violation (§7) and a four-oracle byte-lock violation, so it is not
/// documented — it is removed.
///
/// **The contract instead:** these kernels compute the **exact mathematical
/// sum** and raise `OverflowException` **iff that true sum does not fit in
/// `int64`**. No partial-sum artefact, no lane-width dependence, no silent
/// wraparound. Accumulation runs in `int64` at full speed and folds into an
/// `Int128` running total only at the moments it would actually have wrapped
/// (detected branchlessly with `((a XOR s) AND (b XOR s)) < 0`, which is exact
/// for two's-complement addition including `Int64.MinValue`).
///
/// This is strictly better-defined than `ZSet.weightedCount`, which remains
/// position-dependent; `ColumnZSet.weightedCount` therefore succeeds on a few
/// inputs where `ZSet.weightedCount` raises. Both refuse to wrap silently.
[<AbstractClass; Sealed>]
type ColumnKernel =

    /// True when `Vector<int64>` is hardware-backed on this machine. The
    /// vectorised kernels are correct either way; without acceleration they
    /// are merely pointless.
    static member IsAccelerated: bool = Vector.IsHardwareAccelerated

    /// Lanes per `Vector<int64>` — 2 on ARM NEON, 4 on AVX2, 8 on AVX-512.
    /// Affects speed only; never the result, and never whether one is raised.
    static member VectorWidth: int = Vector<int64>.Count

    /// Sign-extend `int64` into `Int128`.
    static member inline private Widen(x: int64) : Int128 =
        Int128((if x < 0L then UInt64.MaxValue else 0UL), uint64 x)

    /// Narrow an exact wide total back to `int64`, raising iff it does not fit.
    static member private Narrow(total: Int128, what: string) : int64 =
        if total > ColumnKernel.Widen Int64.MaxValue
           || total < ColumnKernel.Widen Int64.MinValue then
            raise (OverflowException $"ColumnZSet {what} overflowed int64")
        else
            int64 total

    /// Exact scalar sum of a span, folding into `Int128` only on real wrap.
    static member private WideSum(values: ReadOnlySpan<int64>) : Int128 =
        let mutable total = Int128.Zero
        let mutable acc = 0L
        for i in 0 .. values.Length - 1 do
            let v = values.[i]
            let s = acc + v
            if ((acc ^^^ s) &&& (v ^^^ s)) < 0L then
                // Would have wrapped: bank the accumulator, restart at `v`.
                total <- total + ColumnKernel.Widen acc
                acc <- v
            else
                acc <- s
        total + ColumnKernel.Widen acc

    // ─────────────────────────── sum of a column ───────────────────────────

    /// Sum a weight column. Exact; raises iff the true sum exceeds `int64`.
    static member SumWeightsScalar(weights: ReadOnlySpan<int64>) : int64 =
        ColumnKernel.Narrow(ColumnKernel.WideSum weights, "weight sum")

    /// Sum a weight column with `Vector<int64>` lanes, chunked so a lane that
    /// would wrap is recomputed exactly rather than reported as an overflow.
    /// Result and raise-behaviour are identical to `SumWeightsScalar` on every
    /// input and every vector width.
    ///
    /// Measured **faster than the scalar twin at every size** once overflow was
    /// made exact (1.36x-1.42x); `SumWeights` dispatches here. Before that fix
    /// it was a loss out of cache — the reversal is recorded on `SumWeights`.
    static member SumWeightsVectorized(weights: ReadOnlySpan<int64>) : int64 =
        let width = Vector<int64>.Count
        let mutable total = Int128.Zero
        let mutable i = 0
        while i < weights.Length do
            let take = min 4096 (weights.Length - i)
            let chunk = weights.Slice(i, take)
            let mutable acc = Vector<int64>.Zero
            let mutable ovf = Vector<int64>.Zero
            let mutable j = 0
            // `j <= take - width`, never `j + width <= take`: the latter can
            // overflow int on a near-Int32.MaxValue span and pass the guard.
            while j <= take - width do
                let v = Vector<int64>(chunk.Slice(j, width))
                let s = acc + v
                ovf <- Vector.BitwiseOr(ovf, Vector.BitwiseAnd(Vector.Xor(acc, s), Vector.Xor(v, s)))
                acc <- s
                j <- j + width
            let mutable wrapped = false
            for lane in 0 .. width - 1 do
                if ovf.[lane] < 0L then wrapped <- true
            if wrapped then
                // A lane wrapped: redo this chunk's vector span exactly. Rare,
                // and it is what keeps the answer host-independent.
                total <- total + ColumnKernel.WideSum(chunk.Slice(0, j))
            else
                for lane in 0 .. width - 1 do
                    total <- total + ColumnKernel.Widen acc.[lane]
            total <- total + ColumnKernel.WideSum(chunk.Slice j)
            i <- i + take
        ColumnKernel.Narrow(total, "weight sum")

    /// Sum of all weights — the columnar twin of `ZSet.weightedCount`.
    ///
    /// **Vectorised, and this reverses an earlier decision in this file.**
    /// Before overflow was made exact, the vector path lost out of cache
    /// (0.67x) and this dispatched to scalar. Exactness changed the balance:
    /// detecting a real wrap costs the *scalar* loop an extra test per
    /// element, while the vector loop amortises the same work across lanes and
    /// pays it once per chunk. Measured after the fix, the vector path is
    /// faster at **every** size — 1.36x / 1.36x / 1.42x at n = 4 096 / 65 536 /
    /// 1 048 576 — so there is no cache-size threshold to invent.
    static member SumWeights(weights: ReadOnlySpan<int64>) : int64 =
        if Vector.IsHardwareAccelerated && weights.Length >= Vector<int64>.Count then
            ColumnKernel.SumWeightsVectorized weights
        else
            ColumnKernel.SumWeightsScalar weights

    // ──────────────────── predicated scan: count in range ────────────────────

    /// Count keys in the half-open range `[lo, hi)`. Scalar, one
    /// data-dependent branch per element.
    static member CountWhereKeyInRangeScalar
        (keys: ReadOnlySpan<int64>, lo: int64, hi: int64) : int =
        let mutable count = 0
        for i in 0 .. keys.Length - 1 do
            let k = keys.[i]
            if k >= lo && k < hi then count <- count + 1
        count

    /// Count keys in `[lo, hi)`, branchlessly: compare both bounds into masks,
    /// AND them, AND with one, accumulate. No branch depends on the data, so
    /// the cost is independent of selectivity and of key order — which is the
    /// entire claim, since the scalar twin's cost is not.
    ///
    /// Cannot overflow: the accumulator counts at most `keys.Length` (an
    /// `int`) spread across lanes of `int64`.
    static member CountWhereKeyInRangeVectorized
        (keys: ReadOnlySpan<int64>, lo: int64, hi: int64) : int =
        let width = Vector<int64>.Count
        let vlo = Vector<int64>(lo)
        let vhi = Vector<int64>(hi)
        let ones = Vector<int64>.One
        let mutable acc = Vector<int64>.Zero
        let mutable i = 0
        while i <= keys.Length - width do
            let v = Vector<int64>(keys.Slice(i, width))
            let mask =
                Vector.BitwiseAnd(Vector.GreaterThanOrEqual(v, vlo), Vector.LessThan(v, vhi))
            acc <- acc + Vector.BitwiseAnd(mask, ones)
            i <- i + width
        let mutable count = 0L
        for lane in 0 .. width - 1 do
            count <- count + acc.[lane]
        while i < keys.Length do
            let k = keys.[i]
            if k >= lo && k < hi then count <- count + 1L
            i <- i + 1
        int count

    /// Count keys in `[lo, hi)`. Vectorised whenever `Vector<int64>` is
    /// hardware-backed — unlike `SumWeights` this path did not lose at any
    /// measured size, because its win comes from deleting a mispredicted
    /// branch rather than from lane width.
    static member CountWhereKeyInRange
        (keys: ReadOnlySpan<int64>, lo: int64, hi: int64) : int =
        if Vector.IsHardwareAccelerated && keys.Length >= Vector<int64>.Count then
            ColumnKernel.CountWhereKeyInRangeVectorized(keys, lo, hi)
        else
            ColumnKernel.CountWhereKeyInRangeScalar(keys, lo, hi)

    // ──────────── fused select + aggregate: sum weights over a range ────────────

    /// `SELECT sum(weight) WHERE key >= lo AND key < hi`, scalar. Exact;
    /// raises iff the true sum exceeds `int64`.
    static member private WideSumWhereKeyInRange
        (keys: ReadOnlySpan<int64>, weights: ReadOnlySpan<int64>, lo: int64, hi: int64) : Int128 =
        let mutable total = Int128.Zero
        let mutable acc = 0L
        for i in 0 .. keys.Length - 1 do
            let k = keys.[i]
            if k >= lo && k < hi then
                let v = weights.[i]
                let s = acc + v
                if ((acc ^^^ s) &&& (v ^^^ s)) < 0L then
                    total <- total + ColumnKernel.Widen acc
                    acc <- v
                else
                    acc <- s
        total + ColumnKernel.Widen acc

    static member SumWeightsWhereKeyInRangeScalar
        (keys: ReadOnlySpan<int64>, weights: ReadOnlySpan<int64>, lo: int64, hi: int64) : int64 =
        ColumnKernel.Narrow(
            ColumnKernel.WideSumWhereKeyInRange(keys, weights, lo, hi), "ranged weight sum")

    /// `SELECT sum(weight) WHERE key >= lo AND key < hi`, fused and
    /// branchless: the range mask selects the weight lane or zero via
    /// `ConditionalSelect`, and the selected lanes accumulate directly — the
    /// filter never materialises a selection vector. Chunked so a wrapping
    /// lane is recomputed exactly, giving identical results and identical
    /// raise-behaviour to the scalar twin on every host.
    static member SumWeightsWhereKeyInRangeVectorized
        (keys: ReadOnlySpan<int64>, weights: ReadOnlySpan<int64>, lo: int64, hi: int64) : int64 =
        let width = Vector<int64>.Count
        let vlo = Vector<int64>(lo)
        let vhi = Vector<int64>(hi)
        let mutable total = Int128.Zero
        let mutable i = 0
        while i < keys.Length do
            let take = min 4096 (keys.Length - i)
            let mutable acc = Vector<int64>.Zero
            let mutable ovf = Vector<int64>.Zero
            let mutable j = 0
            while j <= take - width do
                let vk = Vector<int64>(keys.Slice(i + j, width))
                let vw = Vector<int64>(weights.Slice(i + j, width))
                let mask =
                    Vector.BitwiseAnd(Vector.GreaterThanOrEqual(vk, vlo), Vector.LessThan(vk, vhi))
                let selected = Vector.ConditionalSelect(mask, vw, Vector<int64>.Zero)
                let s = acc + selected
                ovf <- Vector.BitwiseOr(ovf, Vector.BitwiseAnd(Vector.Xor(acc, s), Vector.Xor(selected, s)))
                acc <- s
                j <- j + width
            let mutable wrapped = false
            for lane in 0 .. width - 1 do
                if ovf.[lane] < 0L then wrapped <- true
            if wrapped then
                // WIDE, never `SumWeightsWhereKeyInRangeScalar`: narrowing here
                // would raise whenever a single 4096-element chunk exceeds
                // int64, even when the whole sum fits comfortably. That was a
                // real divergence, invisible to any test whose n fits in one
                // chunk.
                total <-
                    total
                    + ColumnKernel.WideSumWhereKeyInRange(
                        keys.Slice(i, j), weights.Slice(i, j), lo, hi)
            else
                for lane in 0 .. width - 1 do
                    total <- total + ColumnKernel.Widen acc.[lane]
            // Chunk tail (< width elements).
            for k in j .. take - 1 do
                let key = keys.[i + k]
                if key >= lo && key < hi then
                    total <- total + ColumnKernel.Widen weights.[i + k]
            i <- i + take
        ColumnKernel.Narrow(total, "ranged weight sum")

    /// `SELECT sum(weight) WHERE key >= lo AND key < hi`. Vectorised when
    /// hardware-backed, for the same branch-elimination reason as
    /// `CountWhereKeyInRange`.
    static member SumWeightsWhereKeyInRange
        (keys: ReadOnlySpan<int64>, weights: ReadOnlySpan<int64>, lo: int64, hi: int64) : int64 =
        if Vector.IsHardwareAccelerated && keys.Length >= Vector<int64>.Count then
            ColumnKernel.SumWeightsWhereKeyInRangeVectorized(keys, weights, lo, hi)
        else
            ColumnKernel.SumWeightsWhereKeyInRangeScalar(keys, weights, lo, hi)


[<RequireQualifiedAccess>]
module ColumnZSet =

    let empty: ColumnZSet = ColumnZSet.Empty

    let inline count (c: ColumnZSet) = c.Count
    let inline isEmpty (c: ColumnZSet) = c.IsEmpty

    /// Shred a row-store `ZSet<int64>` into two columns. O(n), one pass, two
    /// allocations (one per column). The Z-set invariants carry over
    /// unchanged: `ZSet` is already sorted with no zero weights.
    let ofZSet (z: ZSet<int64>) : ColumnZSet =
        let span = z.AsSpan()
        if span.IsEmpty then ColumnZSet.Empty
        else
            let keys = Pool.AllocateExact<int64> span.Length
            let weights = Pool.AllocateExact<int64> span.Length
            for i in 0 .. span.Length - 1 do
                keys.[i] <- span.[i].Key
                weights.[i] <- span.[i].Weight
            ColumnZSet(Pool.Freeze keys, Pool.Freeze weights)

    /// Stitch two columns back into a row-store `ZSet<int64>`. Inverse of
    /// `ofZSet` — `toZSet (ofZSet z) = z` for every `z`.
    let toZSet (c: ColumnZSet) : ZSet<int64> =
        let keys = c.KeySpan()
        let weights = c.WeightSpan()
        if keys.IsEmpty then ZSet<int64>.Empty
        else
            let entries = Pool.AllocateExact<ZEntry<int64>> keys.Length
            for i in 0 .. keys.Length - 1 do
                entries.[i] <- ZEntry(keys.[i], weights.[i])
            ZSet(Pool.Freeze entries)

    /// Build from unordered pairs, via `ZSet.ofSeq` so sorting, duplicate
    /// summing and zero-dropping are the row store's — one definition of the
    /// invariant, not two.
    let ofSeq (pairs: (int64 * Weight) seq) : ColumnZSet =
        ofZSet (ZSet.ofSeq pairs)

    /// Sum of all weights. Columnar twin of `ZSet.weightedCount`.
    let weightedCount (c: ColumnZSet) : Weight =
        ColumnKernel.SumWeights(c.WeightSpan())

    /// Number of keys in the half-open range `[lo, hi)`.
    let countKeysInRange (lo: int64) (hi: int64) (c: ColumnZSet) : int =
        ColumnKernel.CountWhereKeyInRange(c.KeySpan(), lo, hi)

    /// `SELECT sum(weight) WHERE key >= lo AND key < hi`.
    let weightedCountInRange (lo: int64) (hi: int64) (c: ColumnZSet) : Weight =
        ColumnKernel.SumWeightsWhereKeyInRange(c.KeySpan(), c.WeightSpan(), lo, hi)
