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

// ── Hard rungs: Octonion (non-associative Mul) and Sedenion (zero divisors) ──
// The floor promise is "EVERY Cayley–Dickson tower is an IStarRing, hence an ISemiring, so it
// drops into WeightedSet." Quaternion is covered above; here we pin the HARD levels on the
// ADD-SIDE — the retraction-native Z-set core — which is sound at every tower because Add is
// always a commutative group (the ℍ ceiling only bites Mul). The Mul-law DEGRADATION itself
// (octonion non-associativity; octonion alternativity; sedenion zero divisors) is proven at the
// algebra level in Algebra/Octonion.Laws.Tests.fs + Algebra/CayleyDickson.Tests.fs. Consequence,
// per the IStarRing law profile: WeightedSet.inner / scale-CHAINS are order-sensitive above ℍ —
// so these tests assert only the law-safe envelope (additive structure + One/Zero scaling).

let private qzero : Quaternion = quat 0.0 0.0 0.0 0.0
let private ozero : Octonion = { Real = qzero; Imag = qzero }

// Octonion = Doubled<Quaternion>
let private oalg = ImaginaryStack.octonion :> ISemiring<Octonion>
let private oOne : Octonion = { Real = one; Imag = qzero }
let private oI   : Octonion = { Real = i; Imag = qzero }    // an imaginary unit (lower half)
let private oE4  : Octonion = { Real = qzero; Imag = one }  // the doubling unit e4 (upper half)

[<Fact>]
let ``WeightedSet carries OCTONION weights; retraction holds despite non-associative Mul (add-side sound)`` () =
    let a = WS.ofSeq oalg [ "x", oI; "y", oE4 ]
    Assert.Equal<Octonion>(oI, WS.weight oalg "x" a)
    Assert.True(WS.isEmpty (WS.add oalg a (WS.negate oalg a)))

[<Fact>]
let ``octonion WeightedSet: add combines coordinates; scale by One identity, by Zero annihilates`` () =
    let a = WS.ofSeq oalg [ "x", oI ]
    let b = WS.ofSeq oalg [ "x", oE4 ]
    Assert.Equal<Octonion>({ Real = i; Imag = one }, WS.weight oalg "x" (WS.add oalg a b))
    let c = WS.ofSeq oalg [ "x", oI; "y", oOne ]
    Assert.Equal<WS.WeightedSet<string, Octonion>>(c, WS.scale oalg oOne c)
    Assert.True(WS.isEmpty (WS.scale oalg oalg.Zero c))

// Sedenion = Doubled<Octonion>
let private salg = ImaginaryStack.sedenion :> ISemiring<Sedenion>
let private sOne : Sedenion = { Real = oOne; Imag = ozero }
let private sI   : Sedenion = { Real = oI;   Imag = ozero }
let private sE8  : Sedenion = { Real = ozero; Imag = oOne }  // the doubling unit e8

[<Fact>]
let ``WeightedSet carries SEDENION weights; retraction + One/Zero scaling hold despite zero divisors`` () =
    let a = WS.ofSeq salg [ "x", sI; "y", sE8 ]
    Assert.Equal<Sedenion>(sI, WS.weight salg "x" a)
    // Add is a commutative group at every tower — retraction is sound even though Mul has zero divisors here
    Assert.True(WS.isEmpty (WS.add salg a (WS.negate salg a)))
    // One is never a zero divisor, so scale-by-One is identity even in 𝕊
    Assert.Equal<WS.WeightedSet<string, Sedenion>>(a, WS.scale salg sOne a)
    Assert.True(WS.isEmpty (WS.scale salg salg.Zero a))
