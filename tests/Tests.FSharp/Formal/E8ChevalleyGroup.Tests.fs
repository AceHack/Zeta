module Zeta.Tests.Formal.E8ChevalleyGroupTests

open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// Split Chevalley group of type E8 — root groups U_α with multiply.
//
// Not the compact Lie group manifold. Compactness stays the Killing
// substitute. This is E8(ℤ) as an algebraic group: x_α(t) = exp(t ad e_α).
// Anchors: Chevalley 1955; Carter 1972 ch. 4.
// ═══════════════════════════════════════════════════════════════════

module G = E8ChevalleyGroup
module L = E8LieAlgebra

[<Fact>]
let ``ad³ = 0 on every simple-root vector — exp is a polynomial`` () =
    for a in L.chevalleyE do
        Assert.True(G.adCubeIsZero a)
        Assert.True(G.adSquareIsEven a)

[<Fact>]
let ``ad³ = 0 is not vacuous — Cartan ad(h_i) is not nilpotent`` () =
    // Falsifier: the check CAN fail. ad(h) is diagonal on root spaces.
    Assert.False(G.adCubeIsZero (L.cartanBasisIndex 0))

[<Fact>]
let ``x_α(0) = I and x_α(1) is not I`` () =
    let a = L.chevalleyE.[0]
    Assert.True(G.isIdentity (G.xOfRoot a 0))
    Assert.False(G.isIdentity (G.xOfRoot a 1))

[<Fact>]
let ``root group law x(s) x(t) = x(s+t) on all 8 simple roots`` () =
    for s, t in [ 0, 1; 1, 1; 1, -1; 2, -1; -2, 2 ] do
        Assert.True(G.simpleRootOneParameterHolds s t)

[<Fact>]
let ``x(t) x(−t) = I — the inverse is the other parameter`` () =
    let a = L.chevalleyE.[0]
    Assert.True(G.equal (G.mul (G.xOfRoot a 2) (G.xOfRoot a -2)) G.identity)

[<Fact>]
let ``every root (not just simple) has ad³ = 0 and even ad²`` () =
    Assert.True(G.everyRootAdCubeIsZero ())
    Assert.True(G.everyRootAdSquareIsEven ())

[<Fact>]
let ``this is the algebraic group, not the compact manifold — dim 248 does not identify them`` () =
    Assert.Equal(L.dimension, G.dim)
    Assert.True L.compactFormIsNegativeDefinite
    // compact form is still a substitute; root groups have a multiply
    Assert.True(G.oneParameterHolds L.chevalleyE.[0] 1 1)
    Assert.Equal(1, L.centreOrder)
