module Zeta.Tests.QubitIsoTests

open global.Xunit
open Zeta.Core

let private st a ai b bi : QubitIso.JoinState = { A = { Real = a; Imag = ai }; B = { Real = b; Imag = bi } }
let private g = st 0.6 0.1 0.3 -0.4
let private negOne : Complex = { Real = -1.0; Imag = 0.0 }
let private eq = QubitIso.equalish 1e-10

[<Fact>]
let ``Pauli involutions: X²=Y²=Z²=I`` () =
    Assert.True(eq (QubitIso.pauliX (QubitIso.pauliX g)) g)
    Assert.True(eq (QubitIso.pauliY (QubitIso.pauliY g)) g)
    Assert.True(eq (QubitIso.pauliZ (QubitIso.pauliZ g)) g)

[<Fact>]
let ``Pauli products close SU(2): XY=iZ, YZ=iX, ZX=iY`` () =
    Assert.True(eq (QubitIso.pauliX (QubitIso.pauliY g)) (QubitIso.scale QubitIso.imagUnit (QubitIso.pauliZ g)))
    Assert.True(eq (QubitIso.pauliY (QubitIso.pauliZ g)) (QubitIso.scale QubitIso.imagUnit (QubitIso.pauliX g)))
    Assert.True(eq (QubitIso.pauliZ (QubitIso.pauliX g)) (QubitIso.scale QubitIso.imagUnit (QubitIso.pauliY g)))

[<Fact>]
let ``Pauli anticommute: XZ = -ZX`` () =
    Assert.True(eq (QubitIso.pauliX (QubitIso.pauliZ g)) (QubitIso.scale negOne (QubitIso.pauliZ (QubitIso.pauliX g))))

[<Fact>]
let ``gates are unitary: norm preserved by X, Y, Z`` () =
    Assert.Equal(QubitIso.normSq g, QubitIso.normSq (QubitIso.pauliX g), 12)
    Assert.Equal(QubitIso.normSq g, QubitIso.normSq (QubitIso.pauliY g), 12)
    Assert.Equal(QubitIso.normSq g, QubitIso.normSq (QubitIso.pauliZ g), 12)

[<Fact>]
let ``Born + bit-flip: X swaps measurement probabilities`` () =
    Assert.Equal(1.0 - QubitIso.measureOne g, QubitIso.measureOne (QubitIso.pauliX g), 12)

[<Fact>]
let ``state bijection is the identity on ℂ² (round-trip)`` () =
    let a, b = QubitIso.toQubit g
    Assert.True(eq (QubitIso.ofQubit a b) g)
