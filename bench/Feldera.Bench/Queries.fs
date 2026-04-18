module Zeta.Feldera.Bench.Queries

open System
open BenchmarkDotNet.Attributes
open Zeta.Core
open Zeta.Feldera.Bench.NexmarkGen


/// Nexmark Q1 — projection only. Simplest benchmark: pass-through
/// `bid.price` × currency conversion factor.
[<MemoryDiagnoser>]
type NexmarkQ1 () =
    let mutable events : Bid array = [||]

    [<Params(10_000, 100_000)>]
    member val EventCount : int = 0 with get, set

    [<GlobalSetup>]
    member this.Setup () =
        events <-
            generate 42 this.EventCount
            |> Seq.choose (function BidEv b -> Some b | _ -> None)
            |> Array.ofSeq

    [<Benchmark(Baseline = true)>]
    member _.Q1_DbspCore () =
        let c = Circuit.create ()
        let input = c.ZSetInput<int64>()
        let mapped = c.Map(input.Stream, Func<int64, int64>(fun p -> p * 100L))
        c.Output mapped |> ignore
        let batch = events |> Array.map (fun b -> b.Price)
        input.Send (ZSet.ofKeys batch)
        c.Step()


/// Nexmark Q2 — filter. Subset of bids above a threshold.
[<MemoryDiagnoser>]
type NexmarkQ2 () =
    let mutable events : Bid array = [||]

    [<Params(10_000, 100_000)>]
    member val EventCount : int = 0 with get, set

    [<GlobalSetup>]
    member this.Setup () =
        events <-
            generate 42 this.EventCount
            |> Seq.choose (function BidEv b -> Some b | _ -> None)
            |> Array.ofSeq

    [<Benchmark>]
    member _.Q2_DbspCore () =
        let c = Circuit.create ()
        let input = c.ZSetInput<int64>()
        let filtered =
            c.Filter(input.Stream, Func<int64, bool>(fun p -> p > 5000L))
        c.Output filtered |> ignore
        let batch = events |> Array.map (fun b -> b.Price)
        input.Send (ZSet.ofKeys batch)
        c.Step()
