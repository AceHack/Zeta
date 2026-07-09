module Zeta.Tests.Formal.UnivalenceRotorCrossVerifyTests

open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// BP-16 LEG 2 for the provided-view / univalence obligation.
//
// Leg 1 (cubical, machine-checked): `src/Core.Agda/ProvidedView/
// Univalence.agda` proves, on the concrete rotor instance,
//   • ua : (A ≃ B) → (A ≡ B)                     — equivalence IS a path
//   • pathToEquiv (ua rotor) ≡ rotor             — the path recovers the rotor
//   • transport (ua rotor) computes the rotor action
// i.e. "an equivalence is the univalent path, and transport computes it."
//
// Leg 2 (THIS FILE, FsCheck on the F# runtime): the runtime witness that
// the Clifford/Spin ROTOR deformation actually IS an equivalence of the
// provided view — a rotor-conjugation ROUNDTRIP (invertible both ways) that
// is CHART-COMPATIBLE (an isometry: `e₂ ∘ f = e₁`). Agda certifies
// "equivalence ⟹ path"; F# certifies "the rotor deformation ⟹ equivalence".
// Composed, the load-bearing claim for the Don Syme pitch holds on two
// independent legs, per Soraya's routing (`docs/letters/from-soraya-
// univalence-lane-routing.md`): single-lane cubical alone does NOT satisfy
// BP-16 for a claim this load-bearing.
//
// The rotor under test is `Cl3.rotor θ B` for B a UNIT bivector (B² = −1),
// so R is a unit versor (|R| = 1) and `Cl3.rotate R v = R v ~R` is a proper
// rotation — the concrete `Cl3.fs` instance item (2) descopes to. General
// Spin(n) stays the named residual (no Clifford/Spin in the cubical library).
//
// Anchors: W. K. Clifford (1878); Hestenes & Sobczyk (1984, the rotor
// sandwich / Spin action); Univalent Foundations Program (2013, HoTT Book,
// §2.10 ua); Cohen–Coquand–Huber–Mörtberg (2018, cubical — transport computes).

// ─── comparison metric (the *-ring is comparison-free; test-side opt-in) ──
// Rotors use trig, so products are not exactly representable — a looser
// tolerance than the quantized-halves algebra tests (1e-9) is honest here.
let private tol = 1e-7
let private approxEq (a: Cl3.Mv) (b: Cl3.Mv) : bool = Cl3.normSq (Cl3.sub a b) < tol

let private mk (cs: float[]) : Cl3.Mv =
    { Cl3.S = cs.[0]
      Cl3.E1 = cs.[1]
      Cl3.E2 = cs.[2]
      Cl3.E12 = cs.[3]
      Cl3.E3 = cs.[4]
      Cl3.E13 = cs.[5]
      Cl3.E23 = cs.[6]
      Cl3.E123 = cs.[7] }

/// The VIEW being deformed: a general multivector, coefficients in [-4, 4]
/// quantized to halves (matching CliffordStarRing.Laws.Tests.fs).
type MvGen =
    static member Mv() : Arbitrary<Cl3.Mv> =
        gen {
            let coeff = Gen.choose (-8, 8) |> Gen.map (fun i -> float i / 2.0)
            let! arr = Gen.arrayOfLength 8 coeff
            return mk arr
        }
        |> Arb.fromGen

/// A UNIT rotor `R = cos(θ/2) − sin(θ/2)·B`, B a unit bivector (B² = −1),
/// so |R| = 1 and `rotate R` is a proper rotation (the runtime equivalence).
type UnitRotor = UnitRotor of Cl3.Mv

type UnitRotorGen =
    static member UnitRotor() : Arbitrary<UnitRotor> =
        gen {
            // angle in quarter-radian steps over (−6, 6) — covers > a full turn
            let! ti = Gen.choose (-24, 24)
            let theta = float ti / 4.0
            // unit bivector B = (a·e₁₂ + b·e₂₃ + c·e₁₃)/‖·‖, never all-zero
            let! a = Gen.choose (-8, 8)
            let! b = Gen.choose (-8, 8)
            let! c = Gen.choose (-8, 8)
            let a, b, c = if a = 0 && b = 0 && c = 0 then 1, 0, 0 else a, b, c
            let n = sqrt (float (a * a + b * b + c * c))
            let bivec =
                Cl3.add
                    (Cl3.add (Cl3.smul (float a / n) Cl3.e12) (Cl3.smul (float b / n) Cl3.e23))
                    (Cl3.smul (float c / n) Cl3.e13)
            return UnitRotor(Cl3.rotor theta bivec)
        }
        |> Arb.fromGen

// ─── Properties ──────────────────────────────────────────────────────

/// The generator really produces UNIT versors (|R| = 1). This is what makes
/// `rotate R` an isometry — the runtime shape of "an equivalence".
[<Property(Arbitrary = [| typeof<UnitRotorGen> |])>]
let ``rotor is a unit versor (|R| = 1)`` (UnitRotor r) =
    abs (Cl3.normSq r - 1.0) < tol

/// LEFT roundtrip: `~R (R v ~R) R = v`. The deformation is invertible — the
/// F# witness of the cubical `pathToEquiv (ua rotor) ≡ rotor` (an equivalence).
[<Property(Arbitrary = [| typeof<MvGen>; typeof<UnitRotorGen> |])>]
let ``rotor-conjugation roundtrips (left inverse): ~R∘R = id`` (UnitRotor r) (v: Cl3.Mv) =
    approxEq (Cl3.rotate (Cl3.reverse r) (Cl3.rotate r v)) v

/// RIGHT roundtrip: `R (~R v R) ~R = v`. An equivalence has both inverses.
[<Property(Arbitrary = [| typeof<MvGen>; typeof<UnitRotorGen> |])>]
let ``rotor-conjugation roundtrips (right inverse): R∘~R = id`` (UnitRotor r) (v: Cl3.Mv) =
    approxEq (Cl3.rotate r (Cl3.rotate (Cl3.reverse r) v)) v

/// CHART-COMPATIBILITY: the rotor conjugation preserves the metric chart
/// (an isometry, |R v ~R| = |v|) — the `e₂ ∘ f = e₁` compatibility of the
/// provided-view obligation, witnessed at runtime.
[<Property(Arbitrary = [| typeof<MvGen>; typeof<UnitRotorGen> |])>]
let ``rotor conjugation is an isometry (chart-compatible): |R v ~R| = |v|`` (UnitRotor r) (v: Cl3.Mv) =
    abs (Cl3.normSq (Cl3.rotate r v) - Cl3.normSq v) < tol
