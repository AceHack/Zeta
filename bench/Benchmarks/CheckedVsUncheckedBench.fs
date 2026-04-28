module Zeta.Benchmarks.CheckedVsUncheckedBench

open BenchmarkDotNet.Attributes

/// Measurement harness for the `checked-vs-unchecked` production-tier
/// Craft module (`docs/craft/subjects/production-dotnet/checked-vs-
/// unchecked/module.md`). Demonstrates the ≥ 5 % throughput delta gate
/// the audit BACKLOG row requires per demotion candidate.
///
/// Three scenarios cover the two demotion archetypes and the canonical
/// "keep Checked" exemplar:
///   - `SumScalar{Checked,Unchecked}`    — scalar-loop cumulative sum;
///                                         models NovelMath counter +
///                                         CountMin cell increment
///                                         classes (bounded-by-workload)
///   - `SumUnrolled{Checked,Unchecked}`  — 4× loop-unrolled partial sums;
///                                         models ZSet.fs:289-295
///                                         SIMD-candidate class
///   - `MergeLike{Checked,Unchecked}`    — predicated add matching the
///                                         ZSet.fs:227-230 merge-inner
///                                         shape (canonical "keep
///                                         Checked" site — we measure
///                                         the delta we are choosing to
///                                         leave on the table)
[<MemoryDiagnoser>]
type CheckedVsUncheckedOps() =

    [<DefaultValue(false)>] val mutable private data: int64 array

    /// 100M element default matches the module's anchor scenario.
    /// Smaller sizes included so the harness finishes quickly during
    /// iteration; final audit runs at 100M.
    [<Params(1_000_000, 10_000_000, 100_000_000)>]
    member val Size = 0 with get, set

    [<GlobalSetup>]
    member this.Setup() =
        this.data <- Array.init this.Size int64

    [<Benchmark(Baseline = true)>]
    member this.SumScalarChecked () =
        let mutable total = 0L
        let d = this.data
        for i in 0 .. d.Length - 1 do
            total <- Checked.(+) total d.[i]
        total

    [<Benchmark>]
    member this.SumScalarUnchecked () =
        let mutable total = 0L
        let d = this.data
        for i in 0 .. d.Length - 1 do
            total <- total + d.[i]
        total

    [<Benchmark>]
    member this.SumUnrolledChecked () =
        let d = this.data
        let mutable a0 = 0L
        let mutable a1 = 0L
        let mutable a2 = 0L
        let mutable a3 = 0L
        let mutable i = 0
        let n = d.Length
        while i + 4 <= n do
            a0 <- Checked.(+) a0 d.[i]
            a1 <- Checked.(+) a1 d.[i + 1]
            a2 <- Checked.(+) a2 d.[i + 2]
            a3 <- Checked.(+) a3 d.[i + 3]
            i <- i + 4
        let mutable total =
            Checked.(+) (Checked.(+) a0 a1) (Checked.(+) a2 a3)
        while i < n do
            total <- Checked.(+) total d.[i]
            i <- i + 1
        total

    [<Benchmark>]
    member this.SumUnrolledUnchecked () =
        let d = this.data
        let mutable a0 = 0L
        let mutable a1 = 0L
        let mutable a2 = 0L
        let mutable a3 = 0L
        let mutable i = 0
        let n = d.Length
        while i + 4 <= n do
            a0 <- a0 + d.[i]
            a1 <- a1 + d.[i + 1]
            a2 <- a2 + d.[i + 2]
            a3 <- a3 + d.[i + 3]
            i <- i + 4
        let mutable total = a0 + a1 + a2 + a3
        while i < n do
            total <- total + d.[i]
            i <- i + 1
        total

    /// Models the ZSet merge-inner predicated add:
    /// "if entry weights sum to zero, drop; else keep sum".
    /// Per-op branch prevents autovectorisation; baseline for the
    /// canonical keep-Checked site.
    [<Benchmark>]
    member this.MergeLikeChecked () =
        let d = this.data
        let mutable kept = 0
        let mutable acc = 0L
        for i in 0 .. d.Length - 1 do
            let s = Checked.(+) acc d.[i]
            if s <> 0L then
                kept <- kept + 1
                acc <- s
        struct (kept, acc)

    [<Benchmark>]
    member this.MergeLikeUnchecked () =
        let d = this.data
        let mutable kept = 0
        let mutable acc = 0L
        for i in 0 .. d.Length - 1 do
            let s = acc + d.[i]
            if s <> 0L then
                kept <- kept + 1
                acc <- s
        struct (kept, acc)
