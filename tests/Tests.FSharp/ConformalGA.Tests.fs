module Zeta.Tests.ConformalGATests

// The conformal-GA slice Cl3.fs flagged: points are null vectors, distance is ONE inner product, and
// the RBF over it is a PSD kernel — Sequoia soft memory distance joins the seed language.

open global.Xunit
open Zeta.Core

[<Fact>]
let ``embedded points are NULL vectors (P·P = 0 — the conformal cone)`` () =
    for x, y, z in [ 0.0, 0.0, 0.0; 1.0, 2.0, 3.0; -4.5, 0.25, 9.0 ] do
        Assert.True(ConformalGA.isNull 1e-9 (ConformalGA.embed x y z))

[<Fact>]
let ``distance IS one inner product: d² = −2(P·Q) matches direct Euclidean computation`` () =
    let p = ConformalGA.embed 1.0 2.0 3.0
    let q = ConformalGA.embed 4.0 6.0 3.0
    Assert.Equal(25.0, ConformalGA.distSq p q, 9) // (3,4,0) => 9+16
    Assert.Equal(0.0, ConformalGA.distSq p p, 9)

[<Fact>]
let ``cross-check against the existing Cl3 flat-space metric (the slice composes with its parent)`` () =
    let a = Cl3.vector 1.0 -2.0 0.5
    let b = Cl3.vector -3.0 4.0 2.5
    Assert.Equal(Cl3.distSq a b, ConformalGA.distSq (ConformalGA.embedMv a) (ConformalGA.embedMv b), 9)

[<Fact>]
let ``translation invariance: shifting both points leaves the conformal distance unchanged`` () =
    let d1 = ConformalGA.distSq (ConformalGA.embed 1.0 1.0 1.0) (ConformalGA.embed 4.0 5.0 1.0)
    let d2 = ConformalGA.distSq (ConformalGA.embed 11.0 21.0 31.0) (ConformalGA.embed 14.0 25.0 31.0)
    Assert.Equal(d1, d2, 9)

[<Fact>]
let ``the memory-RBF kernel is PSD (the Mercer witness) and composes into the seed (OCP)`` () =
    let xs =
        [| ConformalGA.embed 0.0 0.0 0.0
           ConformalGA.embed 1.0 0.0 0.0
           ConformalGA.embed 0.0 2.0 0.0
           ConformalGA.embed 5.0 5.0 5.0
           ConformalGA.embed -3.0 1.0 2.0 |]
    let vs =
        [| [| 1.0; 1.0; 1.0; 1.0; 1.0 |]
           [| 1.0; -1.0; 1.0; -1.0; 1.0 |]
           [| 2.0; -3.0; 0.5; 1.0; -2.0 |] |]
    let k = LinguisticSeed.composePacks [ ConformalGA.memoryPack 2.0 ]
    for v in vs do
        Assert.True(LinguisticSeed.quadForm k xs v >= -1e-9)
    Assert.Equal<string list>([ "conformal.memory-rbf" ], LinguisticSeed.packNames [ ConformalGA.memoryPack 2.0 ])

[<Fact>]
let ``locality scale behaves: near memories similar (~1), far memories dissimilar (~0)`` () =
    let k = ConformalGA.rbfKernel 1.0
    let origin = ConformalGA.embed 0.0 0.0 0.0
    Assert.Equal(1.0, k origin origin, 9)
    Assert.True(k origin (ConformalGA.embed 0.1 0.0 0.0) > 0.99)
    Assert.True(k origin (ConformalGA.embed 10.0 10.0 10.0) < 1e-10)

[<Fact>]
let ``Math Razor P0: rbfKernel is PSD even on NON-null (non-embedded) CPoints (Euclidean d², Schoenberg)`` () =
    // raw CPoints NOT produced by embed (wInf/w0 arbitrary) — the old exp(inner/σ²) could break PSD here
    let raw x y z wi w0 : ConformalGA.CPoint = { X = x; Y = y; Z = z; WInf = wi; W0 = w0 }
    let xs =
        [| raw 0.0 0.0 0.0 5.0 -2.0
           raw 1.0 0.0 0.0 0.0 0.0
           raw 0.0 2.0 0.0 9.0 9.0
           raw 5.0 5.0 5.0 -1.0 3.0
           raw -3.0 1.0 2.0 0.5 0.5 |]
    let vs = [| [| 1.0;1.0;1.0;1.0;1.0 |]; [| 1.0;-1.0;1.0;-1.0;1.0 |]; [| 2.0;-3.0;0.5;1.0;-2.0 |] |]
    let k = ConformalGA.rbfKernel 2.0
    for v in vs do
        Assert.True(LinguisticSeed.quadForm k xs v >= -1e-9)
    // still agrees with the conformal distance on EMBEDDED points
    Assert.Equal(ConformalGA.distSq (ConformalGA.embed 1.0 2.0 3.0) (ConformalGA.embed 4.0 6.0 3.0),
                 ConformalGA.euclidSq (ConformalGA.embed 1.0 2.0 3.0) (ConformalGA.embed 4.0 6.0 3.0), 9)
