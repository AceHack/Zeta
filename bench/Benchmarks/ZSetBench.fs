module Zeta.Benchmarks.ZSetBench

open BenchmarkDotNet.Attributes
open Zeta.Core

/// Micro-benchmarks for the core Z-set algebra. `MemoryDiagnoser` reports
/// per-operation allocations so we can verify `Span` loops vectorize and
/// `ArrayPool` rents elide correctly.
[<MemoryDiagnoser>]
type ZSetOps() =

    [<DefaultValue(false)>] val mutable private a: ZSet<int>
    [<DefaultValue(false)>] val mutable private b: ZSet<int>

    [<Params(16, 256, 4096)>]
    member val Size = 0 with get, set

    [<GlobalSetup>]
    member this.Setup() =
        this.a <- ZSet.ofSeq [ for i in 0 .. this.Size - 1 -> i, 1L ]
        this.b <- ZSet.ofSeq [ for i in 0 .. this.Size - 1 -> i + this.Size / 2, 1L ]

    [<Benchmark>]
    member this.Add() = ZSet.add this.a this.b

    [<Benchmark>]
    member this.Neg() = ZSet.neg this.a

    [<Benchmark>]
    member this.Scale() = ZSet.scale 3L this.a

    [<Benchmark>]
    member this.WeightedCount() = ZSet.weightedCount this.a

    [<Benchmark>]
    member this.Filter() = ZSet.filter (fun x -> x % 2 = 0) this.a

    [<Benchmark>]
    member this.Map() = ZSet.map (fun x -> x * 2) this.a

    [<Benchmark>]
    member this.Distinct() = ZSet.distinct this.a

    [<Benchmark>]
    member this.Lookup() = this.a.[this.Size / 2]

    [<Benchmark>]
    member this.Join() =
        ZSet.join id id (fun x y -> x + y) this.a this.b
