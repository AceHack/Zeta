module Zeta.Tests.Formal.CliffordReflectionLawsTests

// BP-16 SECOND, INDEPENDENT TOOL for the Lean certificate `CliffordReflectionE8.lean` (#9811,
// work-item 081KYXCM1WK08QG0R003B9KVP4). The Lean cert proves L-B *deductively* over an abstract
// QuadraticForm: -(ι a · ι b · ⅟(ι a)) = ι (reflect a b). This is the *random-generation* cross-check
// on the concrete F# `Cl3` (= Cl(3,0)) side — a genuinely independent method (property-based random
// vs. proof-assistant deduction), so the reflection identity clears the two-independent-tools bar.

open global.Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Core

/// reflect_a(b) = b − (2⟨a,b⟩/⟨a,a⟩)·a — the classical reflection in the hyperplane ⊥ a.
let private reflect (a: Cl3.Mv) (b: Cl3.Mv) : Cl3.Mv =
    Cl3.sub b (Cl3.smul (2.0 * Cl3.dot a b / Cl3.normSq a) a)

/// The inverse of a grade-1 vector: a⁻¹ = a / ⟨a,a⟩ (since a·a = |a|²·1 in Cl(3,0)).
let private invVec (a: Cl3.Mv) : Cl3.Mv = Cl3.smul (1.0 / Cl3.normSq a) a

/// The versor sandwich −(a·b·a⁻¹) — the reflection realized by conjugation (the F# image of the Lean L-B).
let private sandwich (a: Cl3.Mv) (b: Cl3.Mv) : Cl3.Mv =
    Cl3.smul -1.0 (Cl3.gp (Cl3.gp a b) (invVec a))

// small-magnitude float coords (ints in (−20,20)) keep float error well under the 1e-6 tolerance.
let private coord (n: int) : float = float (n % 20)

[<Property>]
let ``L-B cross-check: -(a·b·a⁻¹) = reflect_a(b) for grade-1 vectors of Cl(3,0)`` (a1: int) (a2: int) (a3: int) (b1: int) (b2: int) (b3: int) =
    let a = Cl3.vector (coord a1) (coord a2) (coord a3)
    let b = Cl3.vector (coord b1) (coord b2) (coord b3)
    // skip the degenerate null-vector case (no inverse); otherwise the identity must hold exactly
    Cl3.normSq a <= 1e-9 || Cl3.normSq (Cl3.sub (sandwich a b) (reflect a b)) < 1e-6

[<Property>]
let ``the sandwich stays a pure grade-1 vector (no even/pseudoscalar leak)`` (a1: int) (a2: int) (a3: int) (b1: int) (b2: int) (b3: int) =
    let a = Cl3.vector (coord a1) (coord a2) (coord a3)
    let b = Cl3.vector (coord b1) (coord b2) (coord b3)
    Cl3.normSq a <= 1e-9
    || (let s = sandwich a b
        abs s.S < 1e-6 && abs s.E12 < 1e-6 && abs s.E13 < 1e-6 && abs s.E23 < 1e-6 && abs s.E123 < 1e-6)

[<Fact>]
let ``reflect_a(a) = -a (the mirror negates its own normal)`` () =
    let a = Cl3.vector 1.0 2.0 -1.0
    Assert.True(Cl3.normSq (Cl3.sub (sandwich a a) (Cl3.smul -1.0 a)) < 1e-9)

[<Fact>]
let ``a vector orthogonal to the mirror normal is fixed`` () =
    let a = Cl3.vector 1.0 0.0 0.0
    let b = Cl3.vector 0.0 3.0 -2.0 // ⟨a,b⟩ = 0
    Assert.True(Cl3.normSq (Cl3.sub (sandwich a b) b) < 1e-9)
