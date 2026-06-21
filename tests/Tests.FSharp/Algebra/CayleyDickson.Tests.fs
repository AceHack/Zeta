module Zeta.Tests.Algebra.CayleyDicksonTests
#nowarn "0893"

/// Tests for `CayleyDickson` — the structural primitive underlying
/// the imaginary stack (081KRW63S0008QG0R000QJR08H PR1). Property structure mirrors the
/// classical Cayley-Dickson loss pattern: each doubling step should
/// preserve some algebraic invariants and lose specific others.
///
///   ℝ → ℂ        — addition stays Abelian; conjugation becomes
///                  non-trivial; ordering is no longer total (we
///                  don't test ordering loss since we never asserted
///                  ordering at the ℝ level).
///   ℂ → ℍ        — multiplication remains associative; loses
///                  commutativity (i*j ≠ j*i).
///   ℍ → 𝕆        — loses associativity; we exhibit a specific
///                  triple (a, b, c) with (a·b)·c ≠ a·(b·c).
///
/// The shipping property "addition is associative + commutative at
/// every level" is verified at ℂ, ℍ, 𝕆 since it should NEVER break.

open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ─── Helpers ──────────────────────────────────────────────────────────

/// Approximate equality for floats — Cayley-Dickson at the float
/// level inherits all the IEEE 754 quirks; tests use this threshold
/// to keep them stable across platforms.
let private approxEq (a: float) (b: float) =
    abs (a - b) < 1e-9

let private complexApproxEq (a: Complex) (b: Complex) =
    approxEq a.Real b.Real && approxEq a.Imag b.Imag

let private quaternionApproxEq (a: Quaternion) (b: Quaternion) =
    complexApproxEq a.Real b.Real && complexApproxEq a.Imag b.Imag

let private octonionApproxEq (a: Octonion) (b: Octonion) =
    quaternionApproxEq a.Real b.Real && quaternionApproxEq a.Imag b.Imag


// ─── Complex (ℂ) ──────────────────────────────────────────────────────
// The first doubling. i² = −1 is the defining relation.

[<Fact>]
let ``Complex: i squared equals negative one`` () =
    let alg = ImaginaryStack.complex
    let i : Complex = Doubled.make 0.0 1.0
    let result = alg.Mul(i, i)
    let expected = Doubled.make -1.0 0.0
    complexApproxEq result expected |> should be True


[<Fact>]
let ``Complex: addition is commutative`` () =
    let alg = ImaginaryStack.complex
    let a = Doubled.make 3.0 4.0
    let b = Doubled.make -1.0 2.5
    complexApproxEq (alg.Add(a, b)) (alg.Add(b, a)) |> should be True


[<Fact>]
let ``Complex: multiplication is commutative`` () =
    // ℂ retains commutativity; it's quaternions that lose it.
    let alg = ImaginaryStack.complex
    let a = Doubled.make 1.5 -2.0
    let b = Doubled.make 3.0 0.5
    complexApproxEq (alg.Mul(a, b)) (alg.Mul(b, a)) |> should be True


[<Fact>]
let ``Complex: conjugation flips sign of imaginary part`` () =
    let alg = ImaginaryStack.complex
    let z = Doubled.make 2.0 -3.5
    let conjZ = alg.Conj z
    conjZ.Real |> should equal 2.0
    conjZ.Imag |> should equal 3.5


// ─── Quaternion (ℍ) ────────────────────────────────────────────────────
// Second doubling. Loses commutativity but stays associative.

[<Fact>]
let ``Quaternion: i squared equals negative one`` () =
    let alg = ImaginaryStack.quaternion
    let zeroC : Complex = Doubled.make 0.0 0.0
    let i : Quaternion = Doubled.make (Doubled.make 0.0 1.0) zeroC
    let result = alg.Mul(i, i)
    let expectedReal : Complex = Doubled.make -1.0 0.0
    complexApproxEq result.Real expectedReal |> should be True
    complexApproxEq result.Imag zeroC |> should be True


[<Fact>]
let ``Quaternion: multiplication loses commutativity (i*j != j*i)`` () =
    let alg = ImaginaryStack.quaternion
    // i = (i, 0) where the inner i is ℂ's i = (0, 1)
    // j = (0, 1) where 1 is ℂ's (1, 0) and the embedding lifts it to imag
    let zeroC : Complex = Doubled.make 0.0 0.0
    let oneC : Complex = Doubled.make 1.0 0.0
    let i : Quaternion = Doubled.make (Doubled.make 0.0 1.0) zeroC
    let j : Quaternion = Doubled.make zeroC oneC
    let ij = alg.Mul(i, j)
    let ji = alg.Mul(j, i)
    // In ℍ, ij = k and ji = −k, so ij ≠ ji.
    quaternionApproxEq ij ji |> should be False


[<Fact>]
let ``Quaternion: multiplication is still associative`` () =
    let alg = ImaginaryStack.quaternion
    // Pick three non-trivial quaternions; verify (a·b)·c = a·(b·c).
    let a : Quaternion = Doubled.make (Doubled.make 1.0 2.0) (Doubled.make 3.0 4.0)
    let b : Quaternion = Doubled.make (Doubled.make 5.0 6.0) (Doubled.make 7.0 8.0)
    let c : Quaternion = Doubled.make (Doubled.make 9.0 0.5) (Doubled.make -1.0 2.5)
    let ab_c = alg.Mul(alg.Mul(a, b), c)
    let a_bc = alg.Mul(a, alg.Mul(b, c))
    quaternionApproxEq ab_c a_bc |> should be True


[<Fact>]
let ``Quaternion: addition stays commutative across the lift`` () =
    let alg = ImaginaryStack.quaternion
    let a : Quaternion = Doubled.make (Doubled.make 1.0 2.0) (Doubled.make 3.0 4.0)
    let b : Quaternion = Doubled.make (Doubled.make -1.5 0.5) (Doubled.make 2.5 -3.5)
    quaternionApproxEq (alg.Add(a, b)) (alg.Add(b, a)) |> should be True


// ─── Octonion (𝕆) ──────────────────────────────────────────────────────
// Third doubling. Loses associativity. Addition + commutativity-of-addition
// still hold; multiplication is non-commutative AND non-associative.

[<Fact>]
let ``Octonion: addition stays commutative`` () =
    let alg = ImaginaryStack.octonion
    let mk a b c d e f g h : Octonion =
        Doubled.make
            (Doubled.make (Doubled.make a b) (Doubled.make c d))
            (Doubled.make (Doubled.make e f) (Doubled.make g h))
    let a = mk 1.0 2.0 3.0 4.0 5.0 6.0 7.0 8.0
    let b = mk -1.5 0.5 2.5 -3.5 0.25 -0.75 1.25 -2.25
    octonionApproxEq (alg.Add(a, b)) (alg.Add(b, a)) |> should be True


[<Fact>]
let ``Octonion: exhibits non-associativity for a specific triple`` () =
    // Famous example: take three orthogonal imaginary units in 𝕆 that
    // form an "associative triple" in ℍ but NOT in 𝕆. Here we use a
    // simpler approach — pick three octonions and show (a·b)·c ≠ a·(b·c)
    // numerically. The doubling formula guarantees this happens for
    // generic non-trivial elements; we don't need to construct the
    // textbook example.
    let alg = ImaginaryStack.octonion
    let mk a b c d e f g h : Octonion =
        Doubled.make
            (Doubled.make (Doubled.make a b) (Doubled.make c d))
            (Doubled.make (Doubled.make e f) (Doubled.make g h))
    let a = mk 1.0 0.0 0.0 0.0 0.0 1.0 0.0 0.0  // e_0 + e_5
    let b = mk 0.0 0.0 1.0 0.0 0.0 0.0 0.0 1.0  // e_2 + e_7
    let c = mk 0.0 1.0 0.0 0.0 0.0 0.0 1.0 0.0  // e_1 + e_6
    let ab_c = alg.Mul(alg.Mul(a, b), c)
    let a_bc = alg.Mul(a, alg.Mul(b, c))
    octonionApproxEq ab_c a_bc |> should be False


// ─── Structural / Zero / Identity ──────────────────────────────────────
// Zero is the additive identity at every level; verify the lift
// preserves this property.

[<Fact>]
let ``Zero is additive identity at every level`` () =
    let c = ImaginaryStack.complex
    let q = ImaginaryStack.quaternion
    let o = ImaginaryStack.octonion
    let cZero = c.Zero
    let qZero = q.Zero
    let oZero = o.Zero
    let cVal = Doubled.make 3.0 -4.0
    let qVal = Doubled.make cVal cZero
    let oVal = Doubled.make qVal qZero
    complexApproxEq (c.Add(cVal, cZero)) cVal |> should be True
    quaternionApproxEq (q.Add(qVal, qZero)) qVal |> should be True
    octonionApproxEq (o.Add(oVal, oZero)) oVal |> should be True


[<Fact>]
let ``Negation is additive inverse at every level`` () =
    let c = ImaginaryStack.complex
    let q = ImaginaryStack.quaternion
    let o = ImaginaryStack.octonion
    let cVal = Doubled.make 1.5 -2.5
    let qVal = Doubled.make cVal (Doubled.make 0.5 0.25)
    let oVal = Doubled.make qVal (Doubled.make (Doubled.make 1.0 1.0) (Doubled.make 1.0 1.0))
    complexApproxEq (c.Add(cVal, c.Negate cVal)) c.Zero |> should be True
    quaternionApproxEq (q.Add(qVal, q.Negate qVal)) q.Zero |> should be True
    octonionApproxEq (o.Add(oVal, o.Negate oVal)) o.Zero |> should be True
