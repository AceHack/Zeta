module Zeta.Tests.Runtime.ConsistentHashTests
#nowarn "0893"

open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// Consistent hashing — Jump + Rendezvous (moved from Round7Tests /
// Round8Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``Jump consistent hash is stable for same bucket count`` () =
    let h = ConsistentHash.jump
    for k in 0UL .. 99UL do
        h.Pick(k, 16) |> should equal (h.Pick(k, 16))


[<Fact>]
let ``Jump keeps buckets in range`` () =
    let h = ConsistentHash.jump
    for k in 0UL .. 999UL do
        let b = h.Pick(k, 32)
        b |> should be (greaterThanOrEqualTo 0)
        b |> should be (lessThan 32)


[<Fact>]
let ``Jump rebalance churn is near-optimal 1/N`` () =
    let keys = [| 0UL .. 9_999UL |]
    // Going from 8 → 9 buckets should move ~1/9 = 11.1% of keys.
    let churn = ConsistentHash.rebalanceChurn ConsistentHash.jump keys 8 9
    churn |> should be (greaterThan 0.05)
    churn |> should be (lessThan 0.20)


[<Fact>]
let ``Rendezvous hashing picks valid bucket`` () =
    let h = ConsistentHash.rendezvous 8
    for k in 0UL .. 99UL do
        let b = h.Pick(k, 8)
        b |> should be (greaterThanOrEqualTo 0)
        b |> should be (lessThan 8)


[<Fact>]
let ``Rendezvous rebalance churn is near-optimal`` () =
    // Create a single hasher but vary bucket count via re-build.
    let keys = [| 0UL .. 999UL |]
    let h1 = ConsistentHash.rendezvous 8
    let h2 = ConsistentHash.rendezvous 9
    let mutable moved = 0
    for k in keys do
        if h1.Pick(k, 8) <> h2.Pick(k, 9) then moved <- moved + 1
    // Rendezvous theory: ~1/9 of keys move when N grows 8→9.
    let churn = float moved / float keys.Length
    churn |> should be (greaterThan 0.0)
    churn |> should be (lessThan 0.30)


// ═══════════════════════════════════════════════════════════════════
// MementoHash (moved from Round8Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``MementoHash Add grows bucket count`` () =
    let mh = MementoHash()
    mh.Add() |> should equal 0
    mh.Add() |> should equal 1
    mh.BucketCount |> should equal 2


[<Fact>]
let ``MementoHash Remove + Add reuses last slot`` () =
    let mh = MementoHash()
    for _ in 1 .. 4 do mh.Add() |> ignore
    mh.Remove 2
    // Next Add should reuse slot 2.
    let reused = mh.Add()
    reused |> should equal 2


[<Fact>]
let ``MementoHash Pick returns valid bucket for non-empty`` () =
    let mh = MementoHash()
    for _ in 1 .. 4 do mh.Add() |> ignore
    for k in 0UL .. 99UL do
        let b = mh.Pick k
        b |> should be (greaterThanOrEqualTo 0)
        b |> should be (lessThan 4)


[<Fact>]
let ``MementoHash Pick on empty returns -1`` () =
    let mh = MementoHash()
    mh.Pick 42UL |> should equal -1


// ─── ConsistentHash.rebalanceChurn (moved from Round8Tests) ──────

[<Fact>]
let ``ConsistentHash.rebalanceChurn on empty keys returns 0`` () =
    ConsistentHash.rebalanceChurn ConsistentHash.jump [] 4 5 |> should equal 0.0
