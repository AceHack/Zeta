module Zeta.Tests.Formal.CliffordStarRingLawsTests

open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// Row 10 (math-team handoff 2026-06-19) — the IStarRing CLIFFORD LEG.
// `Cl3.algebra : IStarRing<Cl3.Mv>` presents the geometric algebra
// Cl(3,0) as a comparison-free *-ring — the buildable leg of the
// adinkra → Clifford → E8 unfold. (Face 3 `mix(mix,mix)=cogen` stays
// BLOCKED on freeze-IR and is NOT touched here.)
//
// This file PROVES the IStarRing laws hold for `Cl3.algebra`, in the
// FsCheck property style of Crdt.Laws.Tests.fs / CayleyDickson.Tests.fs:
//   • additive abelian group (assoc, comm, identity, inverse)
//   • multiplicative monoid (assoc, One identity left+right)
//   • distributivity (left + right; note: Mul is NON-commutative, so
//     both sides are independent obligations)
//   • star / involution laws: Conj∘Conj = id, Conj additive,
//     Conj(x·y) = Conj y · Conj x  (ANTI-homomorphism — order matters!),
//     Conj One = One
//   • basis sanity: eᵢ² = +1 (Euclidean signature) and eᵢeⱼ = −eⱼeᵢ (i≠j)
//
// The involution is REVERSION (`Cl3.reverse`). Reversion is the
// anti-automorphism `~(xy) = (~y)(~x)`; grade involution would FAIL the
// anti-homomorphism law (it is an automorphism). If `Conj(x·y) =
// Conj y · Conj x` failed, that would mean the wrong involution was
// chosen — it does not fail, confirming reversion is the *-ring map.
//
// Anchors: W. K. Clifford (1878); Hestenes & Sobczyk (1984, reversion as
// the principal anti-automorphism); Lounesto (2001, §3 involutions).

// ─── algebra under test + helpers ────────────────────────────────────
let private R : IStarRing<Cl3.Mv> = Cl3.algebra

/// Multivectors compare structurally only through this approximate metric
/// (the *-ring is comparison-FREE; equality here is an explicit test-side
/// opt-in via the squared-distance, matching the culture-invariant rule —
/// floats inherit IEEE quirks, so use a tolerance, never `=`).
let private approxEq (a: Cl3.Mv) (b: Cl3.Mv) : bool =
    Cl3.normSq (Cl3.sub a b) < 1e-9

/// Build an Mv from 8 bounded coefficients (one per blade, mask order
/// S, e₁, e₂, e₁₂, e₃, e₁₃, e₂₃, e₁₂₃). Bounded to keep float products
/// well inside the precision band the tolerance assumes.
let private mk (cs: float[]) : Cl3.Mv =
    { Cl3.S = cs.[0]
      Cl3.E1 = cs.[1]
      Cl3.E2 = cs.[2]
      Cl3.E12 = cs.[3]
      Cl3.E3 = cs.[4]
      Cl3.E13 = cs.[5]
      Cl3.E23 = cs.[6]
      Cl3.E123 = cs.[7] }

/// FsCheck generator: a multivector with each coefficient in [-4, 4],
/// quantized to halves so products stay exactly representable and the
/// 1e-9 tolerance is never the bottleneck.
type MvGen =
    static member Mv() : Arbitrary<Cl3.Mv> =
        gen {
            let coeff = Gen.choose (-8, 8) |> Gen.map (fun i -> float i / 2.0)
            let! arr = Gen.arrayOfLength 8 coeff
            return mk arr
        }
        |> Arb.fromGen

// The Mv generator is registered per-property (the established pattern in
// ActionGrid.Tests.fs / BeliefConvergence.Tests.fs) rather than via an
// assembly-level [<Properties>] attribute, to avoid leaking the generator
// into the other test files sharing this assembly.

// ═══════════════════════════════════════════════════════════════════
// 1. Additive abelian group.
// ═══════════════════════════════════════════════════════════════════

[<Property(Arbitrary = [| typeof<MvGen> |])>]
let ``Add is associative`` (a: Cl3.Mv) (b: Cl3.Mv) (c: Cl3.Mv) =
    approxEq (R.Add(R.Add(a, b), c)) (R.Add(a, R.Add(b, c)))

[<Property(Arbitrary = [| typeof<MvGen> |])>]
let ``Add is commutative`` (a: Cl3.Mv) (b: Cl3.Mv) =
    approxEq (R.Add(a, b)) (R.Add(b, a))

[<Property(Arbitrary = [| typeof<MvGen> |])>]
let ``Zero is the additive identity (both sides)`` (a: Cl3.Mv) =
    approxEq (R.Add(a, R.Zero)) a && approxEq (R.Add(R.Zero, a)) a

[<Property(Arbitrary = [| typeof<MvGen> |])>]
let ``Negate is the additive inverse`` (a: Cl3.Mv) =
    approxEq (R.Add(a, R.Negate a)) R.Zero
    && approxEq (R.Add(R.Negate a, a)) R.Zero

// ═══════════════════════════════════════════════════════════════════
// 2. Multiplicative monoid — Mul (the geometric product) is associative
//    and has One (scalar 1) as a two-sided identity. (Mul is NOT
//    commutative; that is asserted as a basis fact below, not as a law.)
// ═══════════════════════════════════════════════════════════════════

[<Property(Arbitrary = [| typeof<MvGen> |])>]
let ``Mul (geometric product) is associative`` (a: Cl3.Mv) (b: Cl3.Mv) (c: Cl3.Mv) =
    approxEq (R.Mul(R.Mul(a, b), c)) (R.Mul(a, R.Mul(b, c)))

[<Property(Arbitrary = [| typeof<MvGen> |])>]
let ``One is the multiplicative identity (both sides)`` (a: Cl3.Mv) =
    approxEq (R.Mul(a, R.One)) a && approxEq (R.Mul(R.One, a)) a

// ═══════════════════════════════════════════════════════════════════
// 3. Distributivity — both directions are independent obligations
//    because the geometric product is non-commutative.
// ═══════════════════════════════════════════════════════════════════

[<Property(Arbitrary = [| typeof<MvGen> |])>]
let ``Mul is left-distributive over Add`` (a: Cl3.Mv) (b: Cl3.Mv) (c: Cl3.Mv) =
    approxEq (R.Mul(a, R.Add(b, c))) (R.Add(R.Mul(a, b), R.Mul(a, c)))

[<Property(Arbitrary = [| typeof<MvGen> |])>]
let ``Mul is right-distributive over Add`` (a: Cl3.Mv) (b: Cl3.Mv) (c: Cl3.Mv) =
    approxEq (R.Mul(R.Add(a, b), c)) (R.Add(R.Mul(a, c), R.Mul(b, c)))

// ═══════════════════════════════════════════════════════════════════
// 4. Star / involution laws — Conj = reversion. The ANTI-homomorphism
//    law is the decisive one: it is what distinguishes reversion (the
//    correct *-ring involution) from grade involution (an automorphism).
// ═══════════════════════════════════════════════════════════════════

[<Property(Arbitrary = [| typeof<MvGen> |])>]
let ``Conj is involutive (Conj (Conj x) = x)`` (a: Cl3.Mv) =
    approxEq (R.Conj(R.Conj a)) a

[<Property(Arbitrary = [| typeof<MvGen> |])>]
let ``Conj is additive (Conj (x+y) = Conj x + Conj y)`` (a: Cl3.Mv) (b: Cl3.Mv) =
    approxEq (R.Conj(R.Add(a, b))) (R.Add(R.Conj a, R.Conj b))

[<Property(Arbitrary = [| typeof<MvGen> |])>]
let ``Conj is an ANTI-homomorphism on Mul (Conj (x*y) = Conj y * Conj x)`` (a: Cl3.Mv) (b: Cl3.Mv) =
    // THE decisive *-ring law. Reversion satisfies it (anti-automorphism);
    // grade involution would NOT (it is an automorphism `(xy)^ = x̂ŷ`).
    approxEq (R.Conj(R.Mul(a, b))) (R.Mul(R.Conj b, R.Conj a))

[<Property(Arbitrary = [| typeof<MvGen> |])>]
let ``Conj of One is One`` () =
    approxEq (R.Conj R.One) R.One

/// Negative control for the anti-homomorphism: the WRONG order
/// `Conj x * Conj y` must NOT generally equal `Conj(x*y)` (else the test
/// above would be vacuous because Mul happened to be commutative). There
/// exist multivectors where the two orders differ — exhibit one.
[<Fact>]
let ``the anti-homomorphism order is load-bearing (Conj x * Conj y differs from Conj(x*y) for some pair)`` () =
    let x = Cl3.vector 1.0 0.0 0.0 // e₁
    let y = Cl3.vector 0.0 1.0 0.0 // e₂
    let correct = R.Conj(R.Mul(x, y)) // = Conj y * Conj x
    let wrongOrder = R.Mul(R.Conj x, R.Conj y) // Conj x * Conj y
    approxEq correct wrongOrder |> should be False

// ═══════════════════════════════════════════════════════════════════
// 5. Basis-relation sanity — the geometric product reproduces the
//    defining Cl(3,0) relations: eᵢ² = +1 (Euclidean signature) and
//    eᵢeⱼ = −eⱼeᵢ for i ≠ j (anticommutation of distinct generators).
// ═══════════════════════════════════════════════════════════════════

let private e1 = Cl3.vector 1.0 0.0 0.0
let private e2 = Cl3.vector 0.0 1.0 0.0
let private e3 = Cl3.vector 0.0 0.0 1.0

[<Fact>]
let ``basis vectors square to +1 (Euclidean signature Cl(3,0))`` () =
    approxEq (R.Mul(e1, e1)) R.One |> should be True
    approxEq (R.Mul(e2, e2)) R.One |> should be True
    approxEq (R.Mul(e3, e3)) R.One |> should be True

[<Fact>]
let ``distinct basis vectors anticommute (eᵢeⱼ = −eⱼeᵢ)`` () =
    let anti (a: Cl3.Mv) (b: Cl3.Mv) =
        approxEq (R.Mul(a, b)) (R.Negate(R.Mul(b, a)))
    anti e1 e2 |> should be True
    anti e1 e3 |> should be True
    anti e2 e3 |> should be True

[<Fact>]
let ``the even subalgebra agrees with quaternions: bivectors square to -1`` () =
    // {scalar + bivectors} ≅ ℍ — each unit bivector squares to −1, matching
    // CayleyDickson's quaternion imaginary units (the two algebras overlap).
    approxEq (R.Mul(Cl3.e12, Cl3.e12)) (R.Negate R.One) |> should be True
    approxEq (R.Mul(Cl3.e23, Cl3.e23)) (R.Negate R.One) |> should be True
    approxEq (R.Mul(Cl3.e13, Cl3.e13)) (R.Negate R.One) |> should be True

[<Fact>]
let ``reversion fixes scalars and vectors, flips bivectors and the pseudoscalar`` () =
    // Direct check of the reversion sign pattern `(-1)^(g(g-1)/2)`:
    // grades 0,1 fixed; grades 2,3 flipped — the basis of the *-ring involution.
    approxEq (R.Conj R.One) R.One |> should be True
    approxEq (R.Conj e1) e1 |> should be True
    approxEq (R.Conj Cl3.e12) (R.Negate Cl3.e12) |> should be True
    let pseudoscalar = mk [| 0.0; 0.0; 0.0; 0.0; 0.0; 0.0; 0.0; 1.0 |] // e₁₂₃
    approxEq (R.Conj pseudoscalar) (R.Negate pseudoscalar) |> should be True
