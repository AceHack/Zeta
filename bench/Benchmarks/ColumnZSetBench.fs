module Zeta.Benchmarks.ColumnZSetBench

open System
open System.Numerics
open BenchmarkDotNet.Attributes
open Zeta.Core

/// Row store (AoS `ZSet`) versus column store (SoA `ColumnZSet`), and within
/// the column store, scalar versus vectorised.
///
/// ## The variable that dominates, and why both cases are benchmarked
///
/// A scalar predicate scan costs whatever its **branch predictor** costs, so
/// the same kernel on the same number of elements measures ~6x apart
/// depending only on whether the column is sorted:
///
/// * a **sorted** column makes `key >= lo && key < hi` almost perfectly
///   predictable — two transitions in the whole scan. This is what a
///   `ColumnZSet` *key* column always looks like, because a Z-set is a sorted
///   run by construction.
/// * a **shuffled** column mispredicts on roughly half the elements at 50%
///   selectivity. This is what any *non-key* column looks like, and what a
///   key column looks like after a projection that does not preserve order.
///
/// The vectorised kernel is branchless, so its cost is identical in both —
/// which is the actual claim being made here. Benchmarking only the sorted
/// case understates the win; benchmarking only the shuffled case overstates
/// what a key-column scan would see. Both are therefore reported, and neither
/// is the headline on its own.
///
/// Worth stating plainly: on a *sorted* key column you would not linear-scan
/// at all — you would binary-search the two range boundaries. The vectorised
/// scan earns its keep on columns that are **not** the sort key.
///
/// ## What the pairs isolate
///
/// `Aos*` vs `SoaScalar*` isolates the **layout** change; `SoaScalar*` vs
/// `SoaVector*` isolates the **execution** change. Abadi et al. 2013's central
/// claim predicts the first pair is worth ~nothing and only the second pays.
[<MemoryDiagnoser>]
type ColumnZSetOps() =

    [<DefaultValue(false)>] val mutable private row: ZSet<int64>
    [<DefaultValue(false)>] val mutable private sortedCol: ColumnZSet
    [<DefaultValue(false)>] val mutable private shuffledKeys: int64 array
    [<DefaultValue(false)>] val mutable private shuffledWeights: int64 array
    [<DefaultValue(false)>] val mutable private lo: int64
    [<DefaultValue(false)>] val mutable private hi: int64

    /// 4 096 ≈ 32 KB/column (L1-resident); 65 536 ≈ 512 KB (L2);
    /// 1 048 576 ≈ 8 MB (out of cache, bandwidth-bound).
    [<Params(4096, 65536, 1048576)>]
    member val Size = 0 with get, set

    [<GlobalSetup>]
    member this.Setup() =
        // DISTINCT keys, so the column length is exactly `Size`. Drawing keys
        // at random would let `ZSet.ofSeq` dedup them and silently shrink the
        // column — at Size = 1 048 576 that loses ~37% of the rows and makes
        // every "n =" label in the results a lie.
        let rng = Random 20260825
        let keys = Array.init this.Size (fun i -> int64 i * 3L)
        let weights = Array.init this.Size (fun _ -> int64 (rng.Next(-1000, 1000)))
        this.row <- ZSet.ofSeq (Array.zip keys weights |> Array.toList)
        this.sortedCol <- ColumnZSet.ofZSet this.row

        // Same values, order destroyed (Fisher-Yates) — models a non-key column.
        let sk = Array.copy keys
        let sw = Array.copy weights
        for i in (sk.Length - 1) .. -1 .. 1 do
            let j = rng.Next(i + 1)
            let tk = sk.[i] in sk.[i] <- sk.[j]; sk.[j] <- tk
            let tw = sw.[i] in sw.[i] <- sw.[j]; sw.[j] <- tw
        this.shuffledKeys <- sk
        this.shuffledWeights <- sw

        // ~50% selectivity on the key range actually generated (0 .. 3*Size).
        this.lo <- int64 this.Size * 3L / 4L
        this.hi <- int64 this.Size * 9L / 4L

    // ── unpredicated aggregate: bandwidth, not branches ───────────────

    [<Benchmark(Baseline = true)>]
    member this.AosWeightSum() = ZSet.weightedCount this.row

    [<Benchmark>]
    member this.SoaScalarWeightSum() = ColumnKernel.SumWeightsScalar(this.sortedCol.WeightSpan())

    [<Benchmark>]
    member this.SoaVectorWeightSum() = ColumnKernel.SumWeightsVectorized(this.sortedCol.WeightSpan())

    // ── predicated scan, SORTED column (a real ColumnZSet key column) ──

    [<Benchmark>]
    member this.AosRangeCountSorted() =
        let span = this.row.AsSpan()
        let mutable c = 0
        for i in 0 .. span.Length - 1 do
            let k = span.[i].Key
            if k >= this.lo && k < this.hi then c <- c + 1
        c

    [<Benchmark>]
    member this.SoaScalarRangeCountSorted() =
        ColumnKernel.CountWhereKeyInRangeScalar(this.sortedCol.KeySpan(), this.lo, this.hi)

    [<Benchmark>]
    member this.SoaVectorRangeCountSorted() =
        ColumnKernel.CountWhereKeyInRangeVectorized(this.sortedCol.KeySpan(), this.lo, this.hi)

    // ── predicated scan, SHUFFLED column (a non-key column) ────────────

    [<Benchmark>]
    member this.SoaScalarRangeCountShuffled() =
        ColumnKernel.CountWhereKeyInRangeScalar(ReadOnlySpan this.shuffledKeys, this.lo, this.hi)

    [<Benchmark>]
    member this.SoaVectorRangeCountShuffled() =
        ColumnKernel.CountWhereKeyInRangeVectorized(ReadOnlySpan this.shuffledKeys, this.lo, this.hi)

    // ── fused select + aggregate, both orders ──────────────────────────

    [<Benchmark>]
    member this.SoaScalarRangeSumSorted() =
        ColumnKernel.SumWeightsWhereKeyInRangeScalar(
            this.sortedCol.KeySpan(), this.sortedCol.WeightSpan(), this.lo, this.hi)

    [<Benchmark>]
    member this.SoaVectorRangeSumSorted() =
        ColumnKernel.SumWeightsWhereKeyInRangeVectorized(
            this.sortedCol.KeySpan(), this.sortedCol.WeightSpan(), this.lo, this.hi)

    [<Benchmark>]
    member this.SoaScalarRangeSumShuffled() =
        ColumnKernel.SumWeightsWhereKeyInRangeScalar(
            ReadOnlySpan this.shuffledKeys, ReadOnlySpan this.shuffledWeights, this.lo, this.hi)

    [<Benchmark>]
    member this.SoaVectorRangeSumShuffled() =
        ColumnKernel.SumWeightsWhereKeyInRangeVectorized(
            ReadOnlySpan this.shuffledKeys, ReadOnlySpan this.shuffledWeights, this.lo, this.hi)

    // ── shredding cost: what the column store charges up front ────────

    [<Benchmark>]
    member this.ShredRowToColumn() = ColumnZSet.ofZSet this.row

    [<Benchmark>]
    member this.StitchColumnToRow() = ColumnZSet.toZSet this.sortedCol

    /// Reported so a reader can tell whether a run came off a 2-lane (NEON),
    /// 4-lane (AVX2) or 8-lane (AVX-512) machine — none of these ratios is a
    /// portable constant.
    [<Benchmark>]
    member _.VectorWidth() = Vector<int64>.Count
