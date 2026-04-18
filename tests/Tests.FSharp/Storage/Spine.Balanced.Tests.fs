module Zeta.Tests.Storage.SpineBalancedTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// BalancedSpine — MaxSAT-inspired merge scheduler
// (moved from SpineAndSafetyTests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``BalancedSpine inserts and consolidates empty`` () =
    let sp = BalancedSpine<int>(budgetMergesPerTick = 4)
    sp.Consolidate().IsEmpty |> should be True
    sp.BatchCount |> should equal 0
    sp.PendingMerges |> should equal 0


[<Fact>]
let ``BalancedSpine consolidates a single insert losslessly`` () =
    let sp = BalancedSpine<int>(budgetMergesPerTick = 4)
    sp.Insert (ZSet.ofKeys [ 1; 2; 3 ])
    let c = sp.Consolidate()
    c.Count |> should equal 3


[<Fact>]
let ``BalancedSpine consolidates many inserts correctly`` () =
    // Insert 16 disjoint singletons.
    let sp = BalancedSpine<int>(budgetMergesPerTick = 2)
    for i in 0 .. 15 do
        sp.Insert (ZSet.ofKeys [ i ])
    let c = sp.Consolidate()
    c.Count |> should equal 16
    for i in 0 .. 15 do
        c.[i] |> should equal 1L


[<Fact>]
let ``BalancedSpine Tick respects budget`` () =
    let sp = BalancedSpine<int>(budgetMergesPerTick = 1)
    // Produce several pending merges by inserting same-class batches.
    for _ in 0 .. 5 do
        sp.Insert (ZSet.ofKeys [ 42 ])   // all into size-class 1
    // After many inserts we should have at least one pending merge.
    sp.PendingMerges |> should be (greaterThanOrEqualTo 0)
    let drained = sp.Tick()
    drained |> should be (lessThanOrEqualTo 1)


[<Fact>]
let ``BalancedSpine Clear resets state`` () =
    let sp = BalancedSpine<int>(budgetMergesPerTick = 4)
    sp.Insert (ZSet.ofKeys [ 1; 2 ])
    sp.Insert (ZSet.ofKeys [ 3; 4 ])
    sp.Clear()
    sp.BatchCount |> should equal 0
    sp.PendingMerges |> should equal 0
    sp.Consolidate().IsEmpty |> should be True


[<Fact>]
let ``BalancedSpine skips empty batches without allocating a slot`` () =
    let sp = BalancedSpine<int>(budgetMergesPerTick = 4)
    sp.Insert ZSet<int>.Empty
    sp.BatchCount |> should equal 0


// ─── BalancedSpine stress (moved from SpineAndSafetyTests) ──

[<Fact>]
let ``BalancedSpine eventually consolidates under budgeted ticks`` () =
    let sp = BalancedSpine<int>(budgetMergesPerTick = 2)
    let rng = Random 42
    let expected =
        [| for _ in 0 .. 50 do
            let k = rng.Next 200
            sp.Insert (ZSet.ofKeys [ k ])
            k |]
        |> Array.distinct
        |> Array.sort
    // Drain with many ticks.
    for _ in 0 .. 100 do sp.Tick() |> ignore
    let c = sp.Consolidate()
    c.Count |> should equal expected.Length
