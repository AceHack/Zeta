module Zeta.Tests.Algebra.RationalRingTests

open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// RationalRing — exact ℚ as a first-class IRing (081KWG9JQ9H payoff).
// The split let a new lawful ring join the tower; this proves ℚ weights
// ride ZSetW WITH retraction (the thing tropical cannot do).
// ═══════════════════════════════════════════════════════════════════

module PS = ProbabilitySemiring
let private ring : IRing<PS.Rational> = PS.RationalRing.Instance
let private r n d = PS.rat n d

[<Fact>]
let ``RationalRing satisfies the ring inverse law: a + (-a) = 0`` () =
    for a in [ r 3L 4L; r -2L 5L; r 7L 1L; PS.zero ] do
        Assert.Equal(ring.Zero, ring.Add(a, ring.Negate a))

[<Fact>]
let ``RationalRing add/mul are exact (no float drift): 1/3 + 1/6 = 1/2`` () =
    Assert.Equal(r 1L 2L, ring.Add(r 1L 3L, r 1L 6L))
    Assert.Equal(r 1L 6L, ring.Mul(r 1L 2L, r 1L 3L))

[<Fact>]
let ``ZSetW carries exact-rational weights and RETRACTS through RationalRing (the payoff)`` () =
    // a weighted set over ℚ; a − a = ∅, exactly (no float epsilon)
    let a = ZSetW.ofSeq ring [ "p", r 1L 3L; "q", r 2L 5L ]
    Assert.Equal(r 1L 3L, ZSetW.lookup ring "p" a)
    Assert.True(ZSetW.isEmpty (ZSetW.difference ring a a))

[<Fact>]
let ``ZSetW rational sum consolidates exactly: p:1/3 ⊕ p:1/6 = p:1/2`` () =
    let a = ZSetW.ofSeq ring [ "p", r 1L 3L ]
    let b = ZSetW.ofSeq ring [ "p", r 1L 6L ]
    Assert.Equal(r 1L 2L, ZSetW.lookup ring "p" (ZSetW.sum ring a b))

[<Fact>]
let ``struct-ring hot path (differenceBy) agrees with instance path on ℚ`` () =
    let a = ZSetW.ofSeq ring [ "x", r 3L 7L; "y", r 1L 2L ]
    let viaInstance = ZSetW.difference ring a a
    let viaStruct = ZSetW.differenceBy (PS.RationalRing()) a a
    Assert.True((viaInstance = viaStruct))
    Assert.True(ZSetW.isEmpty viaStruct)
