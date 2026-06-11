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
let ``gates are unitary: norm preserved by Pauli and rotation gates`` () =
    Assert.Equal(QubitIso.normSq g, QubitIso.normSq (QubitIso.pauliX g), 12)
    Assert.Equal(QubitIso.normSq g, QubitIso.normSq (QubitIso.pauliY g), 12)
    Assert.Equal(QubitIso.normSq g, QubitIso.normSq (QubitIso.pauliZ g), 12)
    Assert.Equal(QubitIso.normSq g, QubitIso.normSq (QubitIso.hadamard g), 12)
    Assert.Equal(QubitIso.normSq g, QubitIso.normSq (QubitIso.ry (System.Math.PI / 3.0) g), 12)
    Assert.Equal(QubitIso.normSq g, QubitIso.normSq (QubitIso.rz (System.Math.PI / 3.0) g), 12)

[<Fact>]
let ``Born + bit-flip: X swaps measurement probabilities`` () =
    Assert.Equal(1.0 - QubitIso.measureOne g, QubitIso.measureOne (QubitIso.pauliX g), 12)

[<Fact>]
let ``Hadamard is self-inverse and maps basis zero to a fair measurement`` () =
    let zero = QubitIso.ofQubit { Real = 1.0; Imag = 0.0 } { Real = 0.0; Imag = 0.0 }
    Assert.True(eq (QubitIso.hadamard (QubitIso.hadamard g)) g)
    Assert.Equal(0.5, QubitIso.measureOne (QubitIso.hadamard zero), 12)

[<Fact>]
let ``Ry pi over three has textbook cos squared and sin squared probabilities`` () =
    let zero = QubitIso.ofQubit { Real = 1.0; Imag = 0.0 } { Real = 0.0; Imag = 0.0 }
    let rotated = QubitIso.ry (System.Math.PI / 3.0) zero
    Assert.Equal(sin (System.Math.PI / 6.0) ** 2.0, QubitIso.measureOne rotated, 12)

[<Fact>]
let ``Raw kernels match the algebraic gate surface`` () =
    let raw = QubitIso.toRaw g
    let assertSame expected actual =
        Assert.True(eq expected (QubitIso.ofRaw actual))

    assertSame (QubitIso.pauliX g) (QubitIso.Raw.pauliX raw)
    assertSame (QubitIso.pauliY g) (QubitIso.Raw.pauliY raw)
    assertSame (QubitIso.pauliZ g) (QubitIso.Raw.pauliZ raw)
    assertSame (QubitIso.hadamard g) (QubitIso.Raw.hadamard raw)
    assertSame (QubitIso.ry (System.Math.PI / 3.0) g) (QubitIso.Raw.ry (System.Math.PI / 3.0) raw)
    assertSame (QubitIso.rz (System.Math.PI / 3.0) g) (QubitIso.Raw.rz (System.Math.PI / 3.0) raw)
    Assert.Equal(QubitIso.normSq g, QubitIso.normSqRaw raw, 12)
    Assert.Equal(QubitIso.measureOne g, QubitIso.measureOneRaw raw, 12)

[<Fact>]
let ``state bijection is the identity on ℂ² (round-trip)`` () =
    let a, b = QubitIso.toQubit g
    Assert.True(eq (QubitIso.ofQubit a b) g)

[<Fact>]
let ``qubit states form an IGroup (numeric-interface citizen): identity, inverse, assoc, commute`` () =
    let grp = QubitIso.group
    let a = st 0.6 0.1 0.3 -0.4
    let b = st -0.2 0.5 0.7 0.0
    let c = st 0.1 -0.1 -0.3 0.2
    // identity
    Assert.True(eq (grp.Combine(a, grp.Identity)) a)
    Assert.True(eq (grp.Combine(grp.Identity, a)) a)
    // inverse
    Assert.True(eq (grp.Combine(a, grp.Inverse a)) grp.Identity)
    // associativity
    Assert.True(eq (grp.Combine(grp.Combine(a, b), c)) (grp.Combine(a, grp.Combine(b, c))))
    // commutativity (additive group)
    Assert.True(eq (grp.Combine(a, b)) (grp.Combine(b, a)))
