module Zeta.Tests.CayleyWeightedSetTests

open global.Xunit
open Zeta.Core

module WS = Zeta.Core.WeightedSet

// Quaternion = Doubled<Complex> = Doubled<Doubled<float>>
let private cplx a b : Complex = { Real = a; Imag = b }
let private quat a b c d : Quaternion = { Real = cplx a b; Imag = cplx c d }

// the unified floor: a tower is an IStarRing, hence an ISemiring — drops straight into WeightedSet
let private q = ImaginaryStack.quaternion :> ISemiring<Quaternion>

let private one = quat 1.0 0.0 0.0 0.0
let private i = quat 0.0 1.0 0.0 0.0

[<Fact>]
let ``WeightedSet carries quaternion weights through the unified floor (ISemiring)`` () =
    let a = WS.ofSeq q [ "x", i; "y", one ]
    Assert.Equal<Quaternion>(i, WS.weight q "x" a)
    Assert.Equal<Quaternion>(one, WS.weight q "y" a)

[<Fact>]
let ``quaternion-weighted WeightedSet is retraction-native: a + (-a) = empty`` () =
    let a = WS.ofSeq q [ "x", i; "y", one ]
    // Add is commutative + associative for every tower, so retraction holds
    Assert.True(WS.isEmpty (WS.add q a (WS.negate q a)))

[<Fact>]
let ``add combines shared coordinates via quaternion addition (i + 1 = 1 + i)`` () =
    let a = WS.ofSeq q [ "x", i ]
    let b = WS.ofSeq q [ "x", one ]
    Assert.Equal<Quaternion>(quat 1.0 1.0 0.0 0.0, WS.weight q "x" (WS.add q a b))

[<Fact>]
let ``scale by One is identity (proves the tower carries a multiplicative identity)`` () =
    let a = WS.ofSeq q [ "x", i; "y", one ]
    Assert.Equal<WS.WeightedSet<string, Quaternion>>(a, WS.scale q one a)

[<Fact>]
let ``scale by Zero annihilates (proves Zero + Mul on the tower)`` () =
    let a = WS.ofSeq q [ "x", i; "y", one ]
    Assert.True(WS.isEmpty (WS.scale q (q.Zero) a))
