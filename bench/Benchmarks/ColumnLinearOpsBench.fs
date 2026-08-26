module Zeta.Benchmarks.ColumnLinearOpsBench

open System
open System.Buffers
open System.Numerics
open BenchmarkDotNet.Attributes
open Zeta.Core

/// Vectorised `Where` (predicate → mask → compact) and `Select` (elementwise
/// map) over `ColumnZSet` columns, scalar twin beside each.
///
/// ## Why this reports selectivity AND key order, and refuses one headline
///
/// The scalar twin's cost is dominated by its **branch predictor**, and the
/// vector twin's is not. So the ratio is not a property of the kernel — it is
/// a property of the *data*, and reporting a single number would be choosing
/// which data to flatter. Two axes are therefore crossed:
///
/// * **key order** — a `ColumnZSet` key column is sorted by construction (a
///   Z-set is a sorted run), which makes a range predicate almost perfectly
///   predictable. A *non-key* column, or a key column after an
///   order-destroying projection, is not.
/// * **selectivity** — 1%, 50%, 99%. Note these are **not** a proxy for
///   predictability: 1% is almost-always-false and 99% is almost-always-true,
///   so **both extremes are easy to predict** and the hard case is the middle.
///   The first version of `ColumnLinearOps.fs` predicted the opposite and the
///   measurement refuted it; the prediction and its refutation are both kept
///   in that file's header.
///
/// Measured on an Apple M2 Ultra (arm64/NEON, `Vector<int64>.Count = 2`),
/// best-of-9, scalar ÷ vector: **3.45x** at 50%/shuffled/n=1 048 576, and
/// **0.69x–1.12x** in every other cell. `MemoryDiagnoser` is on because the
/// second claim these kernels make is **zero allocation**, and a benchmark
/// that reports only time cannot see it.
///
/// The `ArrayPool` rentals live in `GlobalSetup`, not in the benchmark
/// bodies: renting inside the measured region would benchmark the pool.
[<MemoryDiagnoser>]
type ColumnLinearOps() =

    [<DefaultValue(false)>] val mutable private sortedKeys: int64 array
    [<DefaultValue(false)>] val mutable private sortedWeights: int64 array
    [<DefaultValue(false)>] val mutable private shuffledKeys: int64 array
    [<DefaultValue(false)>] val mutable private shuffledWeights: int64 array
    [<DefaultValue(false)>] val mutable private destKeys: int64 array
    [<DefaultValue(false)>] val mutable private destWeights: int64 array
    [<DefaultValue(false)>] val mutable private mapDest: int64 array
    [<DefaultValue(false)>] val mutable private lo: int64
    [<DefaultValue(false)>] val mutable private hi: int64

    /// 4 096 ≈ 32 KB/column (L1); 65 536 ≈ 512 KB (L2); 1 048 576 ≈ 8 MB
    /// (out of cache, where the loop starts waiting on memory instead of on
    /// the branch predictor).
    [<Params(4096, 65536, 1048576)>]
    member val Size = 0 with get, set

    /// Percent of rows the predicate admits. Crossed with key order because
    /// neither axis alone determines the ratio.
    [<Params(1, 50, 99)>]
    member val SelectivityPercent = 0 with get, set

    [<GlobalSetup>]
    member this.Setup() =
        // DISTINCT keys so the column length is exactly `Size`. Random keys
        // would let a Z-set dedup them and silently shrink the column, making
        // every "n =" label a lie.
        let rng = Random 20260825
        let keys = Array.init this.Size (fun i -> int64 i * 3L)
        let weights = Array.init this.Size (fun _ -> int64 (rng.Next(-1000, 1000)))
        this.sortedKeys <- keys
        this.sortedWeights <- weights

        let sk = Array.copy keys
        let sw = Array.copy weights
        for i in (sk.Length - 1) .. -1 .. 1 do
            let j = rng.Next(i + 1)
            let tk = sk.[i] in sk.[i] <- sk.[j]; sk.[j] <- tk
            let tw = sw.[i] in sw.[i] <- sw.[j]; sw.[j] <- tw
        this.shuffledKeys <- sk
        this.shuffledWeights <- sw

        // Worst-case destinations: a filter may admit every row, and sizing
        // for the expected selectivity would truncate rather than refuse.
        this.destKeys <- Array.zeroCreate<int64> this.Size
        this.destWeights <- Array.zeroCreate<int64> this.Size
        this.mapDest <- Array.zeroCreate<int64> this.Size

        // Keys run 0 .. 3*Size; centre the admitted window so 1% and 99% are
        // genuinely 1% and 99% of the generated range rather than of int64.
        let maxKey = int64 this.Size * 3L
        let span = maxKey * int64 this.SelectivityPercent / 100L
        this.lo <- (maxKey - span) / 2L
        this.hi <- this.lo + span

    // ── WHERE: sorted key column (what a real ColumnZSet key column is) ──

    [<Benchmark(Baseline = true)>]
    member this.WhereScalarSorted() =
        ColumnLinearKernel.FilterKeyInRangeScalar(
            ReadOnlySpan this.sortedKeys, ReadOnlySpan this.sortedWeights,
            this.lo, this.hi, Span<int64> this.destKeys, Span<int64> this.destWeights)

    [<Benchmark>]
    member this.WhereVectorSorted() =
        ColumnLinearKernel.FilterKeyInRangeVectorized(
            ReadOnlySpan this.sortedKeys, ReadOnlySpan this.sortedWeights,
            this.lo, this.hi, Span<int64> this.destKeys, Span<int64> this.destWeights)

    // ── WHERE: shuffled column (a non-key column, or a post-projection one) ──

    [<Benchmark>]
    member this.WhereScalarShuffled() =
        ColumnLinearKernel.FilterKeyInRangeScalar(
            ReadOnlySpan this.shuffledKeys, ReadOnlySpan this.shuffledWeights,
            this.lo, this.hi, Span<int64> this.destKeys, Span<int64> this.destWeights)

    [<Benchmark>]
    member this.WhereVectorShuffled() =
        ColumnLinearKernel.FilterKeyInRangeVectorized(
            ReadOnlySpan this.shuffledKeys, ReadOnlySpan this.shuffledWeights,
            this.lo, this.hi, Span<int64> this.destKeys, Span<int64> this.destWeights)

    // ── SELECT: elementwise map. Selectivity is irrelevant here (every ──
    // ── input produces an output), so these repeat across that Param.   ──

    [<Benchmark>]
    member this.SelectAddScalar() =
        ColumnLinearKernel.MapAddScalar(
            ReadOnlySpan this.sortedWeights, 7L, Span<int64> this.mapDest)

    [<Benchmark>]
    member this.SelectAddVector() =
        ColumnLinearKernel.MapAddVectorized(
            ReadOnlySpan this.sortedWeights, 7L, Span<int64> this.mapDest)

    [<Benchmark>]
    member this.SelectScaleScalar() =
        ColumnLinearKernel.MapScaleScalar(
            ReadOnlySpan this.sortedWeights, 3L, Span<int64> this.mapDest)

    [<Benchmark>]
    member this.SelectScaleVector() =
        ColumnLinearKernel.MapScaleVectorized(
            ReadOnlySpan this.sortedWeights, 3L, Span<int64> this.mapDest)

    /// The identity projection, and its **control**. `SelectCopyTo` is what
    /// `CopyColumn` does; `SelectCopyHandVectorized` is the hand-rolled
    /// `Vector<int64>` loop somebody would write believing it to be the
    /// optimisation. Benchmarking `CopyTo` against itself would report 1.00x
    /// and prove nothing, so the alternative is measured instead — and it
    /// loses to a plain scalar loop, let alone to `Buffer.Memmove`.
    [<Benchmark>]
    member this.SelectCopyTo() =
        ColumnLinearKernel.CopyColumn(
            ReadOnlySpan this.sortedWeights, Span<int64> this.mapDest)

    [<Benchmark>]
    member this.SelectCopyHandVectorized() =
        let src = ReadOnlySpan this.sortedWeights
        let dst = Span<int64> this.mapDest
        let w = Vector<int64>.Count
        let mutable i = 0
        while i <= src.Length - w do
            Vector<int64>(src.Slice(i, w)).CopyTo(dst.Slice(i, w))
            i <- i + w
        while i < src.Length do
            dst.[i] <- src.[i]
            i <- i + 1

    [<Benchmark>]
    member this.SelectCopyScalarLoop() =
        let src = ReadOnlySpan this.sortedWeights
        let dst = Span<int64> this.mapDest
        for i in 0 .. src.Length - 1 do
            dst.[i] <- src.[i]

    // ── the composition: Where → Select, the shape a plan actually runs ──

    /// A two-stage pipeline over caller-owned buffers. Reported separately
    /// from its stages because *composition* is where a zero-allocation
    /// design usually fails — two clean stages that allocate between them.
    /// `MemoryDiagnoser` on this row is the claim; the allocation unit test
    /// is its falsifier.
    [<Benchmark>]
    member this.WhereThenSelectPipeline() =
        let m =
            ColumnLinearKernel.FilterKeyInRange(
                ReadOnlySpan this.shuffledKeys, ReadOnlySpan this.shuffledWeights,
                this.lo, this.hi, Span<int64> this.destKeys, Span<int64> this.destWeights)
        ColumnLinearKernel.MapScale(
            ReadOnlySpan(this.destWeights, 0, m), 3L, Span<int64>(this.mapDest, 0, m))
        m

    /// Reported so a reader can tell whether a run came off a 2-lane (NEON),
    /// 4-lane (AVX2) or 8-lane (AVX-512) machine. None of these ratios is a
    /// portable constant.
    [<Benchmark>]
    member _.VectorWidth() = Vector<int64>.Count
