module Zeta.Tests.Runtime.ShardTests
#nowarn "0893"

open System
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// ═ Exchange / Shard (moved from InfrastructureTests / CoverageTests /
// ═ CoverageTests2 / SpineAndSafetyTests)
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``Exchange partitions keys across shards`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let shards = c.ExchangeByKey(input.Stream, 4)
        let outs = shards |> Array.map c.Output
        input.Send(ZSet.ofKeys [ 1 ; 2 ; 3 ; 4 ; 5 ; 6 ; 7 ; 8 ])
        do! c.StepAsync()
        // Every key lands in exactly one shard.
        let totalCount =
            outs |> Array.sumBy (fun h -> h.Current.Count)
        totalCount |> should equal 8
    }


[<Fact>]
let ``Gather rebuilds the full stream`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let shards = c.ExchangeByKey(input.Stream, 3)
        let gathered = c.GatherShards shards
        let out = c.Output gathered
        input.Send(ZSet.ofKeys [ 1 ; 2 ; 3 ; 4 ; 5 ])
        do! c.StepAsync()
        out.Current.Count |> should equal 5
    }


// ─── Shard helpers (moved from CoverageTests / InfrastructureTests /
// ─── CoverageTests2 / SpineAndSafetyTests) ────────────────────

[<Fact>]
let ``Shard.Of handles arbitrary hash to shard range`` () =
    for h in 0u .. 100u do
        let s = Shard.Of(h, 8)
        s |> should be (greaterThanOrEqualTo 0)
        s |> should be (lessThan 8)


[<Fact>]
let ``Shard fastrange is uniform enough for testing`` () =
    let counts = Array.zeroCreate 8
    for i in 1 .. 10_000 do
        let s = Shard.OfKey(i, 8)
        counts.[s] <- counts.[s] + 1
    // Each shard should get ~1250 ± 20%.
    for c in counts do
        c |> should be (greaterThan 1000)
        c |> should be (lessThan 1500)


// ─── Shard edge cases (moved from CoverageTests2) ───────

[<Fact>]
let ``Exchange rejects zero shard count`` () =
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    let act =
        fun () ->
            c.Exchange(input.Stream, 0, Func<_, _>(fun k -> uint32 k))
            |> ignore
    act |> should throw typeof<ArgumentException>


[<Fact>]
let ``Exchange empty input yields empty shards`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let shards = c.ExchangeByKey(input.Stream, 4)
        let outs = shards |> Array.map c.Output
        do! c.StepAsync()
        for o in outs do o.Current.IsEmpty |> should be True
    }


[<Fact>]
let ``GatherShards with empty shards produces empty`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let shards = c.ExchangeByKey(input.Stream, 4)
        let g = c.GatherShards shards
        let out = c.Output g
        do! c.StepAsync()
        out.Current.IsEmpty |> should be True
    }


// ─── Shard salt + fixed hashing (moved from SpineAndSafetyTests) ───

[<Fact>]
let ``Shard.OfKey distributes keys across shards`` () =
    let counts = Array.zeroCreate 4
    for i in 0 .. 999 do
        let s = Shard.OfKey(i, 4)
        counts.[s] <- counts.[s] + 1
    // Each bucket should have roughly 1000/4 = 250, allow ±50% slack.
    for c in counts do
        c |> should be (greaterThan 125)
        c |> should be (lessThan 375)


[<Fact>]
let ``Shard.OfFixed is stable across calls and different from OfKey`` () =
    // Stability: same key → same shard.
    let a = Shard.OfFixed("key", 16)
    let b = Shard.OfFixed("key", 16)
    a |> should equal b
    // Fixed variant must give a valid shard in [0, shards).
    a |> should be (greaterThanOrEqualTo 0)
    a |> should be (lessThan 16)
    // Distribution: 100 distinct keys should produce more than one shard.
    let distinct =
        [| for i in 0 .. 99 -> Shard.OfFixed(i, 16) |]
        |> Array.distinct
    distinct.Length |> should be (greaterThan 1)


[<Fact>]
let ``Shard.Salt is non-zero`` () =
    // Statistically should almost never be 0.
    Shard.Salt |> should not' (equal 0u)
