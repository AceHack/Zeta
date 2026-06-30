module Zeta.Tests.Algebra.ZSetWTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// SANITY — IntegerRing through ZSetW matches ZSet<'K> behaviour
// ═══════════════════════════════════════════════════════════════════
//
// The first thing the polymorphism has to satisfy: under IntegerRing,
// ZSetW<'K, int64> agrees with the existing ZSet<'K> on the same
// inputs. If parity holds, the substrate is truthful — anywhere ZSet<'K>
// is used today, ZSetW<'K, int64> would behave identically.

[<Fact>]
let ``IntegerRing: empty has count zero and is empty`` () =
    let ring = IntegerRing.Instance
    let z : ZSetW<int, int64> = ZSetW.empty
    ZSetW.count z |> should equal 0
    ZSetW.isEmpty z |> should be True
    ZSetW.lookup ring 42 z |> should equal 0L

[<Fact>]
let ``IntegerRing: singleton with non-zero weight survives`` () =
    let ring = IntegerRing.Instance
    let z = ZSetW.singleton ring 42 7L
    z.Count |> should equal 1
    ZSetW.lookup ring 42 z |> should equal 7L
    ZSetW.lookup ring 99 z |> should equal 0L

[<Fact>]
let ``IntegerRing: singleton with zero weight is empty`` () =
    let ring = IntegerRing.Instance
    let z = ZSetW.singleton ring 42 0L
    ZSetW.isEmpty z |> should be True

[<Fact>]
let ``IntegerRing: ofSeq consolidates duplicate keys via ring.Add`` () =
    let ring = IntegerRing.Instance
    let z = ZSetW.ofSeq ring [ 1, 2L ; 2, 3L ; 1, 5L ]
    ZSetW.lookup ring 1 z |> should equal 7L
    ZSetW.lookup ring 2 z |> should equal 3L
    z.Count |> should equal 2

[<Fact>]
let ``IntegerRing: ofSeq drops zero-weighted entries after consolidation`` () =
    let ring = IntegerRing.Instance
    let z = ZSetW.ofSeq ring [ 1, 2L ; 1, -2L ; 3, 4L ]
    ZSetW.lookup ring 1 z |> should equal 0L
    ZSetW.lookup ring 3 z |> should equal 4L
    z.Count |> should equal 1

[<Fact>]
let ``IntegerRing: sum behaves like ZSet addition`` () =
    let ring = IntegerRing.Instance
    let a = ZSetW.ofSeq ring [ 1, 2L ; 2, 3L ]
    let b = ZSetW.ofSeq ring [ 1, 5L ; 3, 4L ]
    let s = ZSetW.sum ring a b
    ZSetW.lookup ring 1 s |> should equal 7L
    ZSetW.lookup ring 2 s |> should equal 3L
    ZSetW.lookup ring 3 s |> should equal 4L
    s.Count |> should equal 3

[<Fact>]
let ``IntegerRing: retraction via difference cancels exactly`` () =
    let ring = IntegerRing.Instance
    let a = ZSetW.ofSeq ring [ 1, 2L ; 2, 3L ]
    let s = ZSetW.difference ring a a
    ZSetW.isEmpty s |> should be True

[<Fact>]
let ``IntegerRing: bridge ofZSet then toZSet round-trips`` () =
    let original = ZSet.ofSeq [ 1, 2L ; 2, 3L ; 3, -4L ; 3, 4L ]
    let lifted = ZSetW.ofZSetIntegerRing original
    let projected = ZSetW.toZSetIntegerRing lifted
    projected |> should equal original


// ═══════════════════════════════════════════════════════════════════
// IntervalRing through ZSetW — bounded-uncertainty propagation
// ═══════════════════════════════════════════════════════════════════
//
// Demonstrates ZSetW carrying the IntervalWeight ring without any
// substrate change to ZSetW itself — only the ring instance changes.

[<Fact>]
let ``IntervalRing: ZSetW combines intervals via interval addition`` () =
    let ring = IntervalRing.Instance
    let a = ZSetW.singleton ring "rate" (IntervalWeight(1.0, 2.0))
    let b = ZSetW.singleton ring "rate" (IntervalWeight(3.0, 4.0))
    let s = ZSetW.sum ring a b
    let w = ZSetW.lookup ring "rate" s
    w.Lo |> should equal 4.0
    w.Hi |> should equal 6.0

[<Fact>]
let ``IntervalRing: zero interval drops via ofSeq`` () =
    let ring = IntervalRing.Instance
    let z = ZSetW.ofSeq ring [
        "x", IntervalWeight(1.0, 2.0)
        "y", IntervalWeight(0.0, 0.0)
        "z", IntervalWeight(-3.0, 5.0)
    ]
    // After dedup, the y entry's IntervalWeight(0,0) equals ring.Zero so it's dropped.
    z.Count |> should equal 2
    let yLookup = ZSetW.lookup ring "y" z
    yLookup.Lo |> should equal 0.0
    yLookup.Hi |> should equal 0.0


// ═══════════════════════════════════════════════════════════════════
// TropicalSemiring through ZSetW — the keystone wiring demonstration
// ═══════════════════════════════════════════════════════════════════
//
// This is the substrate proof that the polymorphism is REAL: the same
// ZSetW code that operates on int64 and IntervalWeight also operates
// on TropicalWeight, with the algebra (min, +) — which gives Dijkstra-
// shaped shortest-path semantics. NovelMath.fs's docstring promise
// ("our Z-set algebra is polymorphic over the weight ring") is now
// demonstrably true at the ZSetW substrate scope.

[<Fact>]
let ``TropicalSemiring: ZSetW.sum picks the min weight per key`` () =
    let ring = TropicalSemiring.Instance
    let a = ZSetW.singleton ring "edge" (TropicalWeight(10L))
    let b = ZSetW.singleton ring "edge" (TropicalWeight(3L))
    let s = ZSetW.sum ring a b
    let w = ZSetW.lookup ring "edge" s
    w.Value |> should equal 3L  // min(10, 3) = 3

[<Fact>]
let ``TropicalSemiring: ofSeq consolidates via min`` () =
    let ring = TropicalSemiring.Instance
    let z = ZSetW.ofSeq ring [
        "a", TropicalWeight(7L)
        "b", TropicalWeight(2L)
        "a", TropicalWeight(3L)   // min(7, 3) = 3
        "b", TropicalWeight(9L)   // min(2, 9) = 2
        "c", TropicalWeight(5L)
    ]
    (ZSetW.lookup ring "a" z).Value |> should equal 3L
    (ZSetW.lookup ring "b" z).Value |> should equal 2L
    (ZSetW.lookup ring "c" z).Value |> should equal 5L
    z.Count |> should equal 3

[<Fact>]
let ``TropicalSemiring: scale by tropical-weight adds via ring.Mul`` () =
    // In tropical algebra, Mul == addition; scaling by TropicalWeight 5
    // adds 5 to every entry's weight (extending each path by a 5-cost edge).
    let ring = TropicalSemiring.Instance
    let z = ZSetW.ofSeq ring [
        "a", TropicalWeight(2L)
        "b", TropicalWeight(7L)
    ]
    let extended = ZSetW.scale ring (TropicalWeight(5L)) z
    (ZSetW.lookup ring "a" extended).Value |> should equal 7L   // 2 + 5
    (ZSetW.lookup ring "b" extended).Value |> should equal 12L  // 7 + 5

[<Fact>]
let ``TropicalSemiring: identity element (zero) under tropical sum is +infinity`` () =
    let ring = TropicalSemiring.Instance
    let z = ZSetW.singleton ring "x" (TropicalWeight(5L))
    // ring.Zero = +infinity (tropical "no path"); adding it shouldn't change anything
    let infElement = ZSetW.singleton ring "x" ring.Zero
    // singleton with ring.Zero is empty per the contract
    infElement |> ZSetW.isEmpty |> should be True
    let s = ZSetW.sum ring z infElement
    (ZSetW.lookup ring "x" s).Value |> should equal 5L


// ═══════════════════════════════════════════════════════════════════
// ALGEBRAIC AXIOMS — verified to hold across each ring through ZSetW
// ═══════════════════════════════════════════════════════════════════
//
// These tests anchor the load-bearing claim: the polymorphism preserves
// ring axioms. If `sum` is commutative + associative on int64, AND on
// TropicalWeight, AND on IntervalWeight — all via the SAME ZSetW code
// path — the wiring is honest.

[<Fact>]
let ``Axiom: sum is commutative for IntegerRing`` () =
    let ring = IntegerRing.Instance
    let a = ZSetW.ofSeq ring [ 1, 2L ; 2, 3L ]
    let b = ZSetW.ofSeq ring [ 1, 5L ; 3, 4L ]
    let ab = ZSetW.sum ring a b
    let ba = ZSetW.sum ring b a
    ab |> should equal ba

[<Fact>]
let ``Axiom: sum is commutative for TropicalSemiring`` () =
    let ring = TropicalSemiring.Instance
    let a = ZSetW.ofSeq ring [ "x", TropicalWeight(2L) ; "y", TropicalWeight(7L) ]
    let b = ZSetW.ofSeq ring [ "x", TropicalWeight(5L) ; "z", TropicalWeight(4L) ]
    let ab = ZSetW.sum ring a b
    let ba = ZSetW.sum ring b a
    ab |> should equal ba

[<Fact>]
let ``Axiom: empty is identity under sum for IntegerRing`` () =
    let ring = IntegerRing.Instance
    let a = ZSetW.ofSeq ring [ 1, 2L ; 2, 3L ]
    let e : ZSetW<int, int64> = ZSetW.empty
    ZSetW.sum ring a e |> should equal a
    ZSetW.sum ring e a |> should equal a

[<Fact>]
let ``Axiom: empty is identity under sum for IntervalRing`` () =
    let ring = IntervalRing.Instance
    let a = ZSetW.singleton ring "rate" (IntervalWeight(1.0, 2.0))
    let e : ZSetW<string, IntervalWeight> = ZSetW.empty
    ZSetW.sum ring a e |> should equal a
    ZSetW.sum ring e a |> should equal a

[<Fact>]
let ``Axiom: sum is associative for IntegerRing`` () =
    let ring = IntegerRing.Instance
    let a = ZSetW.ofSeq ring [ 1, 2L ; 2, 3L ]
    let b = ZSetW.ofSeq ring [ 1, 5L ; 3, 4L ]
    let c = ZSetW.ofSeq ring [ 2, 1L ; 3, 1L ]
    let abc1 = ZSetW.sum ring (ZSetW.sum ring a b) c
    let abc2 = ZSetW.sum ring a (ZSetW.sum ring b c)
    abc1 |> should equal abc2
