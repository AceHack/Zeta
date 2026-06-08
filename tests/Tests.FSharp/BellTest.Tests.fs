module Zeta.Tests.BellTestTests

open global.Xunit
open Zeta.Core

let private pi = System.Math.PI

[<Fact>]
let ``staged correlator is the quantum singlet correlator E = cos(a-b)`` () =
    Assert.Equal(cos (0.0 - 0.5), BellTest.correlation 0.0 0.5, 10)
    Assert.Equal(cos (0.3 - 1.9), BellTest.correlation 0.3 1.9, 10)

[<Fact>]
let ``CHSH at canonical angles = 2√2 (Tsirelson) — a Bell violation staged in simulation`` () =
    let a, a', b, b' = BellTest.canonicalAngles
    let s = BellTest.chsh a a' b b'
    Assert.Equal(BellTest.TsirelsonBound, s, 10) // = 2√2 ≈ 2.828
    Assert.True(BellTest.violatesClassical s) // > 2
    Assert.False(BellTest.exceedsTsirelson s) // the cos-correlator hits exactly Tsirelson, not beyond

[<Fact>]
let ``full seed control reaches the algebraic max S=4 (beyond Tsirelson) — the superdeterminism tell`` () =
    // Directly staging each correlator to ±1 (full control of the shared seed) breaks even Tsirelson —
    // which real QM cannot; the tell that this is superdeterminism, not physical entanglement.
    let s = BellTest.chshOf 1.0 -1.0 1.0 1.0
    Assert.Equal(BellTest.AlgebraicMax, s, 12)
    Assert.True(BellTest.exceedsTsirelson s)

[<Fact>]
let ``deterministic / replayable (DST)`` () =
    let a, a', b, b' = BellTest.canonicalAngles
    Assert.Equal(BellTest.chsh a a' b b', BellTest.chsh a a' b b', 12)
