module Zeta.Benchmarks.CircuitBench

open System
open System.Threading.Tasks
open BenchmarkDotNet.Attributes
open Zeta.Core

/// End-to-end circuit benchmarks.
[<MemoryDiagnoser>]
type IncrementalJoin() =

    [<DefaultValue(false)>] val mutable private direct: Circuit
    [<DefaultValue(false)>] val mutable private directL: ZSetInputHandle<int * string>
    [<DefaultValue(false)>] val mutable private directR: ZSetInputHandle<int * int>

    [<DefaultValue(false)>] val mutable private incremental: Circuit
    [<DefaultValue(false)>] val mutable private incL: ZSetInputHandle<int * string>
    [<DefaultValue(false)>] val mutable private incR: ZSetInputHandle<int * int>

    [<Params(100, 1000)>]
    member val Size = 0 with get, set

    [<GlobalSetup>]
    member this.Setup() =
        // Non-incremental: integrate each side, then join. Cost per tick is
        // O(|I(L)| · |I(R)|) which grows each tick.
        let c1 = Circuit()
        let l1 = c1.ZSetInput<int * string>()
        let r1 = c1.ZSetInput<int * int>()
        c1.Join(
            c1.IntegrateZSet l1.Stream,
            c1.IntegrateZSet r1.Stream,
            Func<int * string, int>(fst),
            Func<int * int, int>(fst),
            Func<int * string, int * int, int * string * int>(fun (k, s) (_, v) -> (k, s, v)))
        |> c1.Output |> ignore
        c1.Build()
        this.direct <- c1
        this.directL <- l1
        this.directR <- r1

        // Incremental: three-term bilinear join; cost per tick is O(|Δ|).
        let c2 = Circuit()
        let l2 = c2.ZSetInput<int * string>()
        let r2 = c2.ZSetInput<int * int>()
        c2.IncrementalJoin(
            l2.Stream, r2.Stream,
            Func<int * string, int>(fst),
            Func<int * int, int>(fst),
            Func<int * string, int * int, int * string * int>(fun (k, s) (_, v) -> (k, s, v)))
        |> c2.Output |> ignore
        c2.Build()
        this.incremental <- c2
        this.incL <- l2
        this.incR <- r2

    [<Benchmark(Baseline = true)>]
    member this.Direct_Rebuild() : Task =
        task {
            for i in 0 .. this.Size - 1 do
                this.directL.Send(ZSet.singleton (i, sprintf "n%d" i) 1L)
                this.directR.Send(ZSet.singleton (i, i * 10) 1L)
                do! this.direct.StepAsync()
        }

    [<Benchmark>]
    member this.Incremental_Join() : Task =
        task {
            for i in 0 .. this.Size - 1 do
                this.incL.Send(ZSet.singleton (i, sprintf "n%d" i) 1L)
                this.incR.Send(ZSet.singleton (i, i * 10) 1L)
                do! this.incremental.StepAsync()
        }
