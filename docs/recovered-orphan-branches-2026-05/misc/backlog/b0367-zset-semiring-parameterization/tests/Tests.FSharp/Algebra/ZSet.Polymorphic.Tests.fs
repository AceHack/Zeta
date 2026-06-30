module Zeta.Tests.Algebra.ZSetPolymorphicTests
#nowarn "0893"

open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open Zeta.Core.Generic

// ─── Tropical ZSet Tests ──────────────────────────────────────────────

[<Fact>]
let ``Tropical ZSet — singleton creation and lookup`` () =
    let z = ZSet.singleton "a" (TropicalWeight 5L)
    z.["a"] |> should equal (TropicalWeight 5L)
    z.["b"] |> should equal TropicalWeight.Infinity

[<Fact>]
let ``Tropical ZSet — empty lookup`` () =
    let z = ZSet<string, TropicalWeight>.Empty
    z.["a"] |> should equal TropicalWeight.Infinity

[<Fact>]
let ``Tropical ZSet — addition is min consolidation`` () =
    // Add combines weights by taking the minimum:
    // { "a" -> 5 } + { "a" -> 3 } = { "a" -> 3 }
    let z1 = ZSet.singleton "a" (TropicalWeight 5L)
    let z2 = ZSet.singleton "a" (TropicalWeight 3L)
    let z3 = ZSet.add z1 z2
    z3.["a"] |> should equal (TropicalWeight 3L)

[<Fact>]
let ``Tropical ZSet — ofSeq filters Infinity (Zero)`` () =
    let z = ZSet.ofSeq [ "a", TropicalWeight 5L; "b", TropicalWeight.Infinity ]
    z.["a"] |> should equal (TropicalWeight 5L)
    z.["b"] |> should equal TropicalWeight.Infinity
    z.Count |> should equal 1

[<Fact>]
let ``Tropical ZSet — multiplication sums values (Join/Cartesian)`` () =
    // Multiplication in tropical semiring is addition:
    // cartesian of { "a" -> 2 } and { "b" -> 3 } is { ("a","b") -> 5 }
    let z1 = ZSet.singleton "a" (TropicalWeight 2L)
    let z2 = ZSet.singleton "b" (TropicalWeight 3L)
    let z3 = ZSet.cartesian z1 z2
    z3.[("a", "b")] |> should equal (TropicalWeight 5L)


// ─── Interval ZSet Tests ──────────────────────────────────────────────

[<Fact>]
let ``Interval ZSet — singleton creation and lookup`` () =
    let z = ZSet.singleton "a" (IntervalWeight(1.0, 3.0))
    z.["a"] |> should equal (IntervalWeight(1.0, 3.0))
    z.["b"] |> should equal IntervalWeight.Zero

[<Fact>]
let ``Interval ZSet — addition widens intervals`` () =
    // { "a" -> [1, 2] } + { "a" -> [3, 4] } = { "a" -> [4, 6] }
    let z1 = ZSet.singleton "a" (IntervalWeight(1.0, 2.0))
    let z2 = ZSet.singleton "a" (IntervalWeight(3.0, 4.0))
    let z3 = ZSet.add z1 z2
    z3.["a"] |> should equal (IntervalWeight(4.0, 6.0))

[<Fact>]
let ``Interval ZSet — negation does not cancel out uncertainty`` () =
    // { "a" -> [1, 2] } - { "a" -> [1, 2] } = { "a" -> [-1, 1] } (doubled uncertainty)
    let z1 = ZSet.singleton "a" (IntervalWeight(1.0, 2.0))
    let z2 = ZSet.neg z1
    z2.["a"] |> should equal (IntervalWeight(-2.0, -1.0))
    let z3 = ZSet.add z1 z2
    z3.["a"] |> should equal (IntervalWeight(-1.0, 1.0))

[<Fact>]
let ``Interval ZSet — certain points cancel out perfectly`` () =
    // Point intervals behave like real numbers:
    // { "a" -> [3, 3] } - { "a" -> [3, 3] } = empty
    let z1 = ZSet.singleton "a" (IntervalWeight.Point 3.0)
    let z2 = ZSet.neg z1
    let z3 = ZSet.add z1 z2
    z3.["a"] |> should equal IntervalWeight.Zero
    z3.IsEmpty |> should be True
