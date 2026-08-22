module Zeta.Tests.CliffordPeriodicityTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module CP = Zeta.Core.CliffordPeriodicity

// ═══════════════════════════════════════════════════════════════════
// CliffordPeriodicity — the mod-8 clock (Atiyah–Bott–Shapiro).
//
// The falsifier that matters is `dim_R` reconstruction: rebuilding the real dimension from the
// classified Morita type must return 2^(p+q) for EVERY signature. That single property pins all
// eight rows of the table at once — permute any exponent, split any wrong row, or misclassify any
// ground field, and it goes red. A table checked only against the four textbook small cases would
// pass while wrong at large n; a table checked only by dimension would pass while wrong about R vs
// H. Both checks are here, and neither alone is sufficient.
// ═══════════════════════════════════════════════════════════════════

let private ok (p, q) =
    match CP.classify p q with
    | Ok t -> t
    | Error e -> failwithf "classify %d %d returned %A" p q e

// ── The four independently-known small cases. These are the anchors: each is a textbook
//    isomorphism, so they check the table against something outside itself. ──

[<Fact>]
let ``Cl(0,0) is R`` () =
    let t = ok (0, 0)
    Assert.Equal(CP.Real, t.Ground)
    Assert.Equal(1, t.MatrixDim)
    Assert.False t.IsSplit

[<Fact>]
let ``Cl(1,0) is R plus R -- the split real row`` () =
    let t = ok (1, 0)
    Assert.Equal(CP.Real, t.Ground)
    Assert.Equal(1, t.MatrixDim)
    Assert.True t.IsSplit

[<Fact>]
let ``Cl(0,1) is C`` () =
    let t = ok (0, 1)
    Assert.Equal(CP.Complex, t.Ground)
    Assert.Equal(1, t.MatrixDim)
    Assert.False t.IsSplit

[<Fact>]
let ``Cl(0,2) is the quaternions`` () =
    let t = ok (0, 2)
    Assert.Equal(CP.Quaternionic, t.Ground)
    Assert.Equal(1, t.MatrixDim)
    Assert.False t.IsSplit

[<Fact>]
let ``Cl(1,3) is M2(H) and Cl(3,1) is M4(R) -- the two Minkowski conventions are NOT isomorphic`` () =
    // The classic asymmetry: mostly-plus and mostly-minus give genuinely different algebras.
    // If a refactor ever makes these agree, the clock has been broken.
    let mostlyMinus = ok (1, 3)
    Assert.Equal(CP.Quaternionic, mostlyMinus.Ground)
    Assert.Equal(2, mostlyMinus.MatrixDim)
    let mostlyPlus = ok (3, 1)
    Assert.Equal(CP.Real, mostlyPlus.Ground)
    Assert.Equal(4, mostlyPlus.MatrixDim)
    Assert.NotEqual(mostlyMinus, mostlyPlus)

// ── The pinning invariant. ──

[<Property(MaxTest = 400)>]
let ``real dimension reconstructs to 2^(p+q) for every signature`` (a: int) (b: int) =
    // Bounded so 2^(p+q) stays inside int32: p+q <= 24.
    let p = (abs a) % 13
    let q = (abs b) % 12
    let t = ok (p, q)
    CP.dimensionOfType t = CP.realDimension p q

[<Property(MaxTest = 400)>]
let ``classification depends ONLY on p-q mod 8 -- the periodicity itself`` (a: int) (b: int) =
    // Two signatures in the same residue class and the same total dimension must classify
    // identically. This is the theorem stated as a test rather than asserted in a docstring.
    let p = (abs a) % 10
    let q = (abs b) % 10
    // (p+8, q+8) has the same p-q, and n differs by 16 = two full periods.
    let t1 = ok (p, q)
    let t2 = ok (p + 8, q + 8)
    t1.Ground = t2.Ground && t1.IsSplit = t2.IsSplit

[<Property(MaxTest = 200)>]
let ``signatureClass always lands in 0..7 -- including when q exceeds p`` (a: int) (b: int) =
    let p = (abs a) % 50
    let q = (abs b) % 50
    let s = CP.signatureClass p q
    s >= 0 && s <= 7

[<Fact>]
let ``signatureClass normalises negative remainders -- the .NET percent trap`` () =
    // (1-3) % 8 = -2 in .NET. Unnormalised, this indexes the wrong row or throws.
    Assert.Equal(6, CP.signatureClass 1 3)
    Assert.Equal(0, CP.signatureClass 7 7)
    Assert.Equal(4, CP.signatureClass 0 4)

// ── Errors are values. ──

[<Fact>]
let ``a negative signature is refused as a value, not thrown`` () =
    match CP.classify -1 2 with
    | Error (CP.NegativeSignature (p, q)) ->
        Assert.Equal(-1, p)
        Assert.Equal(2, q)
    | Ok t -> failwithf "expected refusal, got %A" t

// ── The three eights. ──

// SCOPE, stated because this test is easy to over-read: both predicates reduce to `n % 8 = 0`,
// so this CANNOT FAIL unless someone edits one and not the other. It is a consistency check on
// two functions, NOT a verification of Construction A. Construction A itself is verified
// elsewhere and far better: `CliffordE8Bridge.fs` / `CliffordE8Roots.fs` build the lattice from
// the in-tree [8,4] code and check its Gram matrix against the E8 Cartan matrix. Reading a green
// tick here as "the E8 path is formally verified" would be the vacuity class.
[<Fact>]
let ``the code and lattice residues agree -- a consistency check, NOT a proof of Construction A`` () =
    for n in 1 .. 200 do
        Assert.Equal(CP.admitsDoublyEvenSelfDualCode n, CP.admitsEvenUnimodularLattice n)

[<Fact>]
let ``length 8 is the first admissible one -- which is the in-tree Hamming code and E8`` () =
    let firstAdmissible = [ 1 .. 64 ] |> List.find CP.admitsDoublyEvenSelfDualCode
    Assert.Equal(8, firstAdmissible)
    // AdinkraCode.fs holds a length-8 code; the clock says that is the earliest it could have.
    Assert.True(CP.admitsDoublyEvenSelfDualCode 8)
    Assert.False(CP.admitsDoublyEvenSelfDualCode 4)

[<Fact>]
let ``zero is not admissible -- the empty code is not the witness we mean`` () =
    // Guarding the vacuity case: 0 % 8 = 0, so a naive predicate would accept it and the
    // "first admissible length" test above would silently find 0 instead of 8.
    Assert.False(CP.admitsDoublyEvenSelfDualCode 0)
    Assert.False(CP.admitsEvenUnimodularLattice 0)

// ── The GU datum. ──

[<Fact>]
let ``the (7,7) signature sits on the split-real row -- s = 0, real spinor module of dim 128`` () =
    let (p, q) = CP.geometricUnitySignature
    Assert.Equal(0, CP.signatureClass p q)
    let t = ok (p, q)
    Assert.Equal(CP.Real, t.Ground)
    Assert.False t.IsSplit
    // Cl(7,7) = M(128, R): real dimension 2^14 = 16384 = 128^2.
    Assert.Equal(128, t.MatrixDim)
    Assert.Equal(16384, CP.dimensionOfType t)
    Assert.Equal(16384, CP.realDimension p q)

// ── The two halves: does the clock separate them? ──
// It does, but ONE TICK OVER — via the even subalgebra, not the algebra itself. These tests pin
// that, because the tempting wrong answer (read `IsSplit` of Cl(p,q) directly) agrees with the
// right one often enough to look correct until you check (7,7).

[<Fact>]
let ``the even subalgebra sits one tick forward on the clock`` () =
    for p in 0 .. 12 do
        for q in 1 .. 12 do
            match CP.evenSubalgebraClass p q with
            | Ok s' -> Assert.Equal((CP.signatureClass p q + 1) % 8, s')
            | Error e -> failwithf "evenSubalgebraClass %d %d -> %A" p q e

[<Fact>]
let ``halves separate exactly when s is 0 or 4 -- not when the algebra itself is split`` () =
    for p in 0 .. 16 do
        for q in 1 .. 16 do
            let s = CP.signatureClass p q
            match CP.halvesSeparateCleanly p q, CP.classify p q with
            | Ok sep, Ok t ->
                Assert.Equal((s = 0 || s = 4), sep)
                // The trap, pinned: algebra-split and halves-separate are DIFFERENT predicates.
                // They disagree somewhere in this range, so this is not a vacuous check.
                if s = 0 then Assert.False t.IsSplit
            | a, b -> failwithf "unexpected %A %A" a b

[<Fact>]
let ``algebra-split and halves-separate genuinely disagree -- the check above is not vacuous`` () =
    let disagreements =
        [ for p in 0 .. 16 do
            for q in 1 .. 16 do
                match CP.halvesSeparateCleanly p q, CP.classify p q with
                | Ok sep, Ok t when sep <> t.IsSplit -> yield (p, q)
                | _ -> () ]
    Assert.NotEmpty disagreements

[<Fact>]
let ``the N=8 adinkra separates into two 8x8 blocks -- 8 bosons and 8 fermions`` () =
    let (p, q) = CP.adinkraN8Signature
    Assert.Equal(0, CP.signatureClass p q)
    match CP.halvesSeparateCleanly p q with
    | Ok sep -> Assert.True sep
    | Error e -> failwithf "%A" e
    // Cl⁰(0,8) ≅ Cl(0,7): the split real row, two copies of M(8,R).
    let even = ok (0, 7)
    Assert.Equal(CP.Real, even.Ground)
    Assert.True even.IsSplit
    Assert.Equal(8, even.MatrixDim)
    // The 16-node adinkra of AdinkraCode.fs is bipartite 8 + 8; the block size is not chosen.
    Assert.Equal(2 * 8 * 8, CP.dimensionOfType even)

[<Fact>]
let ``GU's (7,7) halves separate into two 64-blocks -- the chirality split IS the even subalgebra`` () =
    let (p, q) = CP.geometricUnitySignature
    match CP.halvesSeparateCleanly p q with
    | Ok sep -> Assert.True sep
    | Error e -> failwithf "%A" e
    // Cl(7,7) itself is NOT split — this is exactly where reading IsSplit would mislead.
    Assert.False (ok (7, 7)).IsSplit
    // But Cl⁰(7,7) ≅ Cl(7,6) is: M(64,R) ⊕ M(64,R), the two 64-dim Weyl pieces.
    let even = ok (7, 6)
    Assert.True even.IsSplit
    Assert.Equal(64, even.MatrixDim)

[<Fact>]
let ``q = 0 is refused rather than wrapped -- there is no even subalgebra to name`` () =
    match CP.evenSubalgebraClass 3 0 with
    | Error (CP.NegativeSignature (3, 0)) -> ()
    | other -> failwithf "expected refusal, got %A" other


[<Fact>]
let ``the Lorentz generators live in the even half, and spacetime does NOT chirally separate`` () =
    let (p, q) = CP.spacetimeSignature
    // Cl(1,3): s = 6, the quaternionic row -- M2(H).
    Assert.Equal(6, CP.signatureClass p q)
    let full = ok (p, q)
    Assert.Equal(CP.Quaternionic, full.Ground)
    Assert.Equal(2, full.MatrixDim)
    // Cl^0(1,3) = Cl(1,2) = M2(C), which is where SL(2,C) = Spin(1,3) lives. The 6 bivectors
    // (3 rotations + 3 boosts) are grade 2, hence even, hence "what remains".
    match CP.evenSubalgebraClass p q with
    | Ok s' -> Assert.Equal(7, s')
    | Error e -> failwithf "%A" e
    let even = ok (1, 2)
    Assert.Equal(CP.Complex, even.Ground)
    Assert.Equal(2, even.MatrixDim)
    Assert.Equal(8, CP.dimensionOfType even)
    // The discriminator: spacetime does NOT separate, while the adinkra and GU signatures do.
    match CP.halvesSeparateCleanly 1 3, CP.halvesSeparateCleanly 0 8, CP.halvesSeparateCleanly 7 7 with
    | Ok false, Ok true, Ok true -> ()
    | a, b, c -> failwithf "expected (false, true, true), got %A %A %A" a b c


// ── The second tower: E8 without a code. ──
// Construction A over the [8,4] code costs homoiconicity (the vertex module drops below
// dim Cl(0,N)). The bivector-plus-half-spinor route quotients nothing, so it stays on the uncoded
// tower -- a different construction reaching a different face of the same object.

[<Fact>]
let ``bivectors of Cl(0,n) have dimension so(n)`` () =
    Assert.Equal(28, CP.bivectorDim 8)    // so(8) = D4, the triality case
    Assert.Equal(120, CP.bivectorDim 16)  // so(16) = D8, the maximal subalgebra of E8
    Assert.Equal(36, CP.bivectorDim 9)    // so(9)
    Assert.Equal(6, CP.bivectorDim 4)     // so(4) -- and the 6 Lorentz generators of Cl(1,3)

[<Fact>]
let ``e8 = so(16) + half-spinor: 120 + 128 = 248`` () =
    let (n, total) = CP.e8FromSpinors
    Assert.Equal(16, n)
    Assert.Equal(120, CP.bivectorDim n)
    Assert.Equal(128, CP.halfSpinorDim n)
    Assert.Equal(total, CP.bivectorDim n + CP.halfSpinorDim n)
    Assert.Equal(248, total)

[<Fact>]
let ``f4 = so(9) + spinor: 36 + 16 = 52 -- the recipe at a second point`` () =
    let (n, total) = CP.f4FromSpinors
    Assert.Equal(36, CP.bivectorDim n)
    Assert.Equal(16, CP.halfSpinorDim n)   // n odd: no chirality split, the whole 16
    Assert.Equal(total, CP.bivectorDim n + CP.halfSpinorDim n)
    Assert.Equal(52, total)

[<Fact>]
let ``the 128 exists BECAUSE of the clock -- Cl(0,16) at s=0 splits its even half`` () =
    Assert.Equal(0, CP.signatureClass 0 16)
    match CP.halvesSeparateCleanly 0 16 with
    | Ok sep -> Assert.True sep
    | Error e -> failwithf "%A" e
    let even = ok (0, 15)
    Assert.True even.IsSplit
    Assert.Equal(CP.Real, even.Ground)
    Assert.Equal(128, even.MatrixDim)
    // the half-spinor dimension agrees with the block size the clock produced
    Assert.Equal(CP.halfSpinorDim 16, even.MatrixDim)

[<Fact>]
let ``three rungs agree: (0,8) -> 8-blocks, (7,7) -> 64-blocks, (0,16) -> 128-blocks`` () =
    for (p, q, expectedBlock) in [ (0, 8, 8); (7, 7, 64); (0, 16, 128) ] do
        Assert.Equal(0, CP.signatureClass p q)
        match CP.halvesSeparateCleanly p q with
        | Ok true ->
            let even = ok (p, q - 1)
            Assert.True even.IsSplit
            Assert.Equal(expectedBlock, even.MatrixDim)
        | other -> failwithf "signature (%d,%d) did not separate: %A" p q other


[<Fact>]
let ``the two E8 routes meet at 248 -- Cartan+roots and so(16)+half-spin are one algebra`` () =
    let (cartan, roots) = CP.e8RootDecomposition
    let (n, total) = CP.e8FromSpinors
    Assert.Equal(8, cartan)      // rank of E8
    Assert.Equal(240, roots)     // minimal vectors of the E8 lattice = roots of e8
    Assert.Equal(248, cartan + roots)
    // and the spinor route reaches the same 248 by a different split
    Assert.Equal(cartan + roots, CP.bivectorDim n + CP.halfSpinorDim n)
    // the two decompositions are genuinely different -- not the same numbers rearranged
    Assert.NotEqual(cartan, CP.bivectorDim n)
    Assert.NotEqual(roots, CP.halfSpinorDim n)
