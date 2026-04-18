module Zeta.Benchmarks.BloomBench

open System
open BenchmarkDotNet.Attributes
open Zeta.Core


/// Micro-benchmarks for `Zeta.Core.BloomFilter`.
///
/// Covered surfaces:
///   * `BlockedBloomFilter.Add` / `.MayContain` throughput at
///     n = 10k, 100k, 1M, for int64 and string keys.
///   * `CountingBloomFilter.Add` / `.Remove` / `.MayContain`
///     throughput, insert-only and mixed 50/50 insert/remove.
///   * Empirical false-positive rate of `BlockedBloomFilter` at
///     target p = 0.01 for n = 10k and n = 100k — compares the
///     analytically predicted FPR against the measured rate on a
///     disjoint probe set.
///
/// All benchmarks pre-compute the key arrays in `[<GlobalSetup>]`
/// so hashing and set construction costs are isolated from I/O
/// or random-number overhead.
[<MemoryDiagnoser>]
type BlockedAddInt64() =

    [<Params(10_000, 100_000, 1_000_000)>]
    member val N = 0 with get, set

    [<DefaultValue(false)>] val mutable private filter: BlockedBloomFilter
    [<DefaultValue(false)>] val mutable private keys: int64 array

    [<GlobalSetup>]
    member this.Setup() =
        this.filter <- BloomFilter.createBlocked this.N 0.01
        let rng = Random 42
        this.keys <- Array.init this.N (fun _ -> int64 (rng.Next()) <<< 16 ||| int64 (rng.Next()))

    [<IterationSetup>]
    member this.IterationSetup() =
        // Fresh filter per iteration so Add cost isn't polluted by
        // already-set bits (which skew the OR-into-existing-word path).
        this.filter <- BloomFilter.createBlocked this.N 0.01

    [<Benchmark>]
    member this.Add() =
        let f = this.filter
        for k in this.keys do f.Add k


[<MemoryDiagnoser>]
type BlockedAddString() =

    [<Params(10_000, 100_000, 1_000_000)>]
    member val N = 0 with get, set

    [<DefaultValue(false)>] val mutable private filter: BlockedBloomFilter
    [<DefaultValue(false)>] val mutable private keys: string array

    [<GlobalSetup>]
    member this.Setup() =
        this.filter <- BloomFilter.createBlocked this.N 0.01
        let rng = Random 42
        this.keys <- Array.init this.N (fun i -> sprintf "key-%d-%d" i (rng.Next()))

    [<IterationSetup>]
    member this.IterationSetup() =
        this.filter <- BloomFilter.createBlocked this.N 0.01

    [<Benchmark>]
    member this.Add() =
        let f = this.filter
        for k in this.keys do f.Add k


[<MemoryDiagnoser>]
type BlockedMayContainInt64() =

    [<Params(10_000, 100_000, 1_000_000)>]
    member val N = 0 with get, set

    [<DefaultValue(false)>] val mutable private filter: BlockedBloomFilter
    [<DefaultValue(false)>] val mutable private keys: int64 array

    [<GlobalSetup>]
    member this.Setup() =
        this.filter <- BloomFilter.createBlocked this.N 0.01
        let rng = Random 42
        this.keys <- Array.init this.N (fun _ -> int64 (rng.Next()) <<< 16 ||| int64 (rng.Next()))
        for k in this.keys do this.filter.Add k

    [<Benchmark>]
    member this.MayContain() =
        let f = this.filter
        let mutable hits = 0
        for k in this.keys do
            if f.MayContain k then hits <- hits + 1
        hits


[<MemoryDiagnoser>]
type BlockedMayContainString() =

    [<Params(10_000, 100_000, 1_000_000)>]
    member val N = 0 with get, set

    [<DefaultValue(false)>] val mutable private filter: BlockedBloomFilter
    [<DefaultValue(false)>] val mutable private keys: string array

    [<GlobalSetup>]
    member this.Setup() =
        this.filter <- BloomFilter.createBlocked this.N 0.01
        let rng = Random 42
        this.keys <- Array.init this.N (fun i -> sprintf "key-%d-%d" i (rng.Next()))
        for k in this.keys do this.filter.Add k

    [<Benchmark>]
    member this.MayContain() =
        let f = this.filter
        let mutable hits = 0
        for k in this.keys do
            if f.MayContain k then hits <- hits + 1
        hits


/// Counting Bloom insert-only path (no retractions).
[<MemoryDiagnoser>]
type CountingAddInt64() =

    [<Params(10_000, 100_000, 1_000_000)>]
    member val N = 0 with get, set

    [<DefaultValue(false)>] val mutable private filter: CountingBloomFilter
    [<DefaultValue(false)>] val mutable private keys: int64 array

    [<GlobalSetup>]
    member this.Setup() =
        this.filter <- BloomFilter.createCounting this.N 0.01
        let rng = Random 42
        this.keys <- Array.init this.N (fun _ -> int64 (rng.Next()) <<< 16 ||| int64 (rng.Next()))

    [<IterationSetup>]
    member this.IterationSetup() =
        this.filter <- BloomFilter.createCounting this.N 0.01

    [<Benchmark>]
    member this.Add() =
        let f = this.filter
        for k in this.keys do f.Add k


[<MemoryDiagnoser>]
type CountingRemoveInt64() =

    [<Params(10_000, 100_000, 1_000_000)>]
    member val N = 0 with get, set

    [<DefaultValue(false)>] val mutable private filter: CountingBloomFilter
    [<DefaultValue(false)>] val mutable private keys: int64 array

    [<GlobalSetup>]
    member this.Setup() =
        this.keys <- Array.empty
        let rng = Random 42
        this.keys <- Array.init this.N (fun _ -> int64 (rng.Next()) <<< 16 ||| int64 (rng.Next()))

    [<IterationSetup>]
    member this.IterationSetup() =
        // Build a full filter, then benchmark draining it via Remove.
        this.filter <- BloomFilter.createCounting this.N 0.01
        for k in this.keys do this.filter.Add k

    [<Benchmark>]
    member this.Remove() =
        let f = this.filter
        for k in this.keys do f.Remove k


[<MemoryDiagnoser>]
type CountingMayContainInt64() =

    [<Params(10_000, 100_000, 1_000_000)>]
    member val N = 0 with get, set

    [<DefaultValue(false)>] val mutable private filter: CountingBloomFilter
    [<DefaultValue(false)>] val mutable private keys: int64 array

    [<GlobalSetup>]
    member this.Setup() =
        this.filter <- BloomFilter.createCounting this.N 0.01
        let rng = Random 42
        this.keys <- Array.init this.N (fun _ -> int64 (rng.Next()) <<< 16 ||| int64 (rng.Next()))
        for k in this.keys do this.filter.Add k

    [<Benchmark>]
    member this.MayContain() =
        let f = this.filter
        let mutable hits = 0
        for k in this.keys do
            if f.MayContain k then hits <- hits + 1
        hits


/// Mixed 50/50 insert/remove workload. Exercises the `Add` + `Remove`
/// counter-bump path together; this is the workload DBSP's Z-set
/// stream produces when keys churn in and out.
[<MemoryDiagnoser>]
type CountingMixed50() =

    [<Params(10_000, 100_000, 1_000_000)>]
    member val N = 0 with get, set

    [<DefaultValue(false)>] val mutable private filter: CountingBloomFilter
    [<DefaultValue(false)>] val mutable private ops: struct (int64 * bool) array

    [<GlobalSetup>]
    member this.Setup() =
        let rng = Random 42
        // Build N/2 distinct keys; each key contributes one Add and one
        // Remove. Order is shuffled so the counter hits every intermediate
        // state rather than running all Adds then all Removes.
        let distinct = this.N / 2
        let keys = Array.init distinct (fun _ -> int64 (rng.Next()) <<< 16 ||| int64 (rng.Next()))
        let ops = Array.zeroCreate<struct (int64 * bool)> (distinct * 2)
        for i in 0 .. distinct - 1 do
            ops.[i * 2] <- struct (keys.[i], true)
            ops.[i * 2 + 1] <- struct (keys.[i], false)
        // Fisher-Yates shuffle so Add / Remove interleave.
        for i in ops.Length - 1 .. -1 .. 1 do
            let j = rng.Next(i + 1)
            let tmp = ops.[i]
            ops.[i] <- ops.[j]
            ops.[j] <- tmp
        this.ops <- ops

    [<IterationSetup>]
    member this.IterationSetup() =
        this.filter <- BloomFilter.createCounting this.N 0.01

    [<Benchmark>]
    member this.Mixed() =
        let f = this.filter
        for struct (k, isAdd) in this.ops do
            if isAdd then f.Add k else f.Remove k


/// Empirical false-positive rate at target p = 0.01. We insert `N`
/// keys into a fresh `BlockedBloomFilter` sized for `(N, 0.01)`,
/// then probe a disjoint set of `N` keys and count how many return
/// `true`. The reported rate should be ≤ 0.01 within statistical
/// noise; a measurement above ~0.02 suggests hash-family degeneracy
/// or a parameter-derivation bug.
[<MemoryDiagnoser>]
type BlockedFpr() =

    [<Params(10_000, 100_000)>]
    member val N = 0 with get, set

    [<DefaultValue(false)>] val mutable private filter: BlockedBloomFilter
    [<DefaultValue(false)>] val mutable private probes: int64 array

    [<GlobalSetup>]
    member this.Setup() =
        this.filter <- BloomFilter.createBlocked this.N 0.01
        let rng = Random 42
        // Inserted keys: even indices. Probes: odd indices. Distinct
        // ranges guarantee the probe set is disjoint from the insert
        // set, so every `true` is a genuine false positive.
        let inserted = Array.init this.N (fun i -> int64 (2 * i))
        this.probes <- Array.init this.N (fun i -> int64 (2 * i + 1))
        for k in inserted do this.filter.Add k

    /// Returns the observed FPR as a percentage-of-probes count. The
    /// caller divides by `N` to get the rate. Exposed as `int` because
    /// BenchmarkDotNet reports integer returns without allocation.
    [<Benchmark>]
    member this.MeasureFpr() =
        let f = this.filter
        let mutable fp = 0
        for k in this.probes do
            if f.MayContain k then fp <- fp + 1
        fp
