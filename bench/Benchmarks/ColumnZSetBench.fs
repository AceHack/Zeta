module Zeta.Benchmarks.ColumnZSetBench

open System
open System.Numerics
open BenchmarkDotNet.Attributes
open Zeta.Core

/// Row store (AoS `ZSet`) versus column store (SoA `ColumnZSet`), and within
/// the column store, scalar versus vectorised.
///
/// Three operations, chosen because they separate the two effects that get
/// conflated when people say "columns are faster":
///
///   * `*WeightSum`    — unpredicated aggregate. Bandwidth-bound at large N.
///   * `*RangeCount`   — predicated scan. Branch-bound in scalar form.
///   * `*RangeSum`     — fused select + aggregate. Branch-bound in scalar form.
///
/// The `Aos*` and `SoaScalar*` pairs isolate the **layout** change; the
/// `SoaScalar*` and `SoaVector*` pairs isolate the **execution** change. The
/// expected finding, and Abadi et al. 2013's central claim, is that the layout
/// change alone is worth almost nothing and only the second pair pays — which
/// is why the column store and the vectorised kernel are one piece of work.
///
/// Keys are drawn at random rather than sequentially on purpose: sequential
/// keys let the branch predictor learn the predicate, which flatters the
/// scalar path and would understate the vector win by roughly 5x.
[<MemoryDiagnoser>]
type ColumnZSetOps() =

    [<DefaultValue(false)>] val mutable private row: ZSet<int64>
    [<DefaultValue(false)>] val mutable private col: ColumnZSet
    [<DefaultValue(false)>] val mutable private lo: int64
    [<DefaultValue(false)>] val mutable private hi: int64

    /// 4 096 ≈ 64 KB/column (L1/L2 resident); 1 048 576 ≈ 8 MB/column (out of
    /// cache). The sum result inverts between the two — that is the point.
    [<Params(4096, 65536, 1048576)>]
    member val Size = 0 with get, set

    [<GlobalSetup>]
    member this.Setup() =
        let rng = Random 20260825
        let pairs =
            [ for _ in 1 .. this.Size ->
                int64 (rng.Next(0, 1_000_000)), int64 (rng.Next(-1000, 1000)) ]
            |> List.filter (fun (_, w) -> w <> 0L)
        this.row <- ZSet.ofSeq pairs
        this.col <- ColumnZSet.ofZSet this.row
        this.lo <- 250_000L
        this.hi <- 750_000L

    // ── unpredicated aggregate ────────────────────────────────────────

    [<Benchmark(Baseline = true); BenchmarkCategory("WeightSum")>]
    member this.AosWeightSum() = ZSet.weightedCount this.row

    [<Benchmark; BenchmarkCategory("WeightSum")>]
    member this.SoaScalarWeightSum() = ColumnKernel.SumWeightsScalar(this.col.WeightSpan())

    [<Benchmark; BenchmarkCategory("WeightSum")>]
    member this.SoaVectorWeightSum() = ColumnKernel.SumWeightsVectorized(this.col.WeightSpan())

    // ── predicated scan ───────────────────────────────────────────────

    [<Benchmark; BenchmarkCategory("RangeCount")>]
    member this.AosRangeCount() =
        let span = this.row.AsSpan()
        let mutable c = 0
        for i in 0 .. span.Length - 1 do
            let k = span.[i].Key
            if k >= this.lo && k < this.hi then c <- c + 1
        c

    [<Benchmark; BenchmarkCategory("RangeCount")>]
    member this.SoaScalarRangeCount() =
        ColumnKernel.CountWhereKeyInRangeScalar(this.col.KeySpan(), this.lo, this.hi)

    [<Benchmark; BenchmarkCategory("RangeCount")>]
    member this.SoaVectorRangeCount() =
        ColumnKernel.CountWhereKeyInRangeVectorized(this.col.KeySpan(), this.lo, this.hi)

    // ── fused select + aggregate ──────────────────────────────────────

    [<Benchmark; BenchmarkCategory("RangeSum")>]
    member this.AosRangeSum() =
        let span = this.row.AsSpan()
        let mutable total = 0L
        for i in 0 .. span.Length - 1 do
            let k = span.[i].Key
            if k >= this.lo && k < this.hi then total <- Checked.(+) total span.[i].Weight
        total

    [<Benchmark; BenchmarkCategory("RangeSum")>]
    member this.SoaScalarRangeSum() =
        ColumnKernel.SumWeightsWhereKeyInRangeScalar(
            this.col.KeySpan(), this.col.WeightSpan(), this.lo, this.hi)

    [<Benchmark; BenchmarkCategory("RangeSum")>]
    member this.SoaVectorRangeSum() =
        ColumnKernel.SumWeightsWhereKeyInRangeVectorized(
            this.col.KeySpan(), this.col.WeightSpan(), this.lo, this.hi)

    // ── shredding cost: what the column store charges up front ────────

    [<Benchmark; BenchmarkCategory("Convert")>]
    member this.ShredRowToColumn() = ColumnZSet.ofZSet this.row

    [<Benchmark; BenchmarkCategory("Convert")>]
    member this.StitchColumnToRow() = ColumnZSet.toZSet this.col

    /// Reported so a reader can tell whether a run's numbers came off a
    /// 2-lane (NEON), 4-lane (AVX2) or 8-lane (AVX-512) machine — the
    /// speedups in `ColumnZSet.fs` are not portable constants.
    [<Benchmark; BenchmarkCategory("Info")>]
    member _.VectorWidth() = Vector<int64>.Count
