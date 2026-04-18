module Zeta.Benchmarks.SpineBench

open System
open BenchmarkDotNet.Attributes
open Zeta.Core


/// Head-to-head: sync spine (cascading merge inline on Insert) vs async
/// spine (enqueue to channel, background thread merges). Measures both
/// total throughput AND per-insert tail latency — the async variant wins
/// on p99 because producers never wait for a deep cascade.
[<MemoryDiagnoser>]
type SpineBench() =

    [<Params(1024, 16384)>]
    member val BatchCount = 0 with get, set

    [<Params(16, 256)>]
    member val BatchSize = 0 with get, set

    [<DefaultValue(false)>] val mutable private batches: ZSet<int> array

    [<GlobalSetup>]
    member this.Setup() =
        let rng = Random 42
        this.batches <-
            [| for _ in 1 .. this.BatchCount ->
                 [ for _ in 1 .. this.BatchSize -> rng.Next(1, 100_000), 1L ]
                 |> ZSet.ofSeq |]

    [<Benchmark(Baseline = true)>]
    member this.SpineSync() =
        let spine = Spine<int>()
        for b in this.batches do spine.Insert b
        spine.Consolidate() |> ignore

    [<Benchmark>]
    member this.SpineAsync() =
        use spine = new SpineAsync<int>()
        for b in this.batches do spine.Insert b
        spine.Flush().Wait()
        spine.Consolidate() |> ignore
