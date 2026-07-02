module Zeta.Tests.CptSymmetryTests

// CPT symmetry as a DST property (shadow*) — the signable conjecture of
// docs/research/2026-07-02-name-of-name-equals-mix-of-mix-…, Addendum 3/3.1
// (Aaron's dictionary: conjugation ≈ uncertainty · parity ≈ adinkra mod 2 ·
// tick = tick/DST), made executable:
//
//   fold (CPT t) = CPT (fold t)   — the composite commutes with the DST fold —
//
// while each factor ALONE may fail; a lone factor's failure IS the record
// structure (the arrow of time, Addendum 2). Factor realizations tested here:
//   T — tick reversal (replay the transcript backward)
//   C — conjugation: weight negation, insert ↔ retract (a retraction is the
//       Feynman–Stückelberg antiparticle of its insertion)
//   P — parity: the mod-2 register (braid sign character; adinkra dash parity)
//
// Honoring who came before: the braid composite law — b · (rev ∘ neg) b = id —
// is ALREADY locked in Braid.Tests (`every braid word composed with its inverse
// is the identity`); it is cited here, not re-proven. This file adds the
// Z-plane composite/annihilation laws, the lone-factor failure witnesses on the
// non-abelian plane, the CPT-protected mod-2 register, and the adinkra global
// sign conjugation. Anchors: Schwinger 1951 · Lüders 1954 · Pauli 1955 ·
// J. S. Bell 1955 · Cronin & Fitch 1964 (asymmetry in one factor is paid in
// another, never in the composite).

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══ the Z-plane: transcripts of ZSet deltas (C and T live here) ═══════════

/// T — tick reversal.
let private tRev (t: ZSet<int> list) = List.rev t

/// C — conjugation: every delta becomes its antiparticle (insert ↔ retract).
let private cConj (t: ZSet<int> list) = List.map (fun (d: ZSet<int>) -> -d) t

/// The DST fold: replay the transcript over the zero state.
let private fold (t: ZSet<int> list) = List.fold (+) ZSet<int>.Empty t

/// CPT on the (ungraded) Z-plane: P acts trivially; the composite is T ∘ C.
let private cpt (t: ZSet<int> list) = t |> cConj |> tRev

let private zeq (a: ZSet<int>) (b: ZSet<int>) = (a - b).IsEmpty

type private CptArbs =
    static member Transcript() =
        let genEntry =
            gen {
                let! k = Gen.choose (0, 7)
                let! w = Gen.elements [ -3L; -2L; -1L; 1L; 2L; 3L ]
                return k, w
            }

        let genDelta =
            gen {
                let! n = Gen.choose (0, 4)
                let! es = Gen.listOfLength n genEntry
                return ZSet.ofSeq es
            }

        gen {
            let! n = Gen.choose (0, 12)
            let! ds = Gen.listOfLength n genDelta
            return ds
        }
        |> Arb.fromGen

    static member BraidWord() =
        Arb.fromGen (Gen.listOf (Gen.elements [ 1; -1; 2; -2; 3; -3; 4; -4 ]) |> Gen.map (List.truncate 8))

[<Property(Arbitrary = [| typeof<CptArbs> |])>]
let ``CPT COMMUTES WITH THE FOLD: fold (CPT t) = CPT (fold t) — the composite is a symmetry of replay`` (t: ZSet<int> list) =
    // CPT's action on a folded STATE is conjugation (T has no state action; P is trivial here).
    zeq (fold (cpt t)) (-(fold t))

[<Property(Arbitrary = [| typeof<CptArbs> |])>]
let ``ANNIHILATION: a transcript concatenated with its CPT image folds to zero — matter meets antimatter`` (t: ZSet<int> list) =
    (fold (t @ cpt t)).IsEmpty

[<Property(Arbitrary = [| typeof<CptArbs> |])>]
let ``T ALONE holds on the abelian plane: fold (rev t) = fold t — the Z-plane dynamics record no arrow`` (t: ZSet<int> list) =
    // Addendum 2 as a test: the substrate is time-symmetric; the arrow is not here.
    zeq (fold (tRev t)) (fold t)

[<Property(Arbitrary = [| typeof<CptArbs> |])>]
let ``C ALONE anti-commutes: folding the conjugate transcript yields the conjugate state`` (t: ZSet<int> list) =
    zeq (fold (cConj t)) (-(fold t))

// ═══ the braid plane: non-abelian, where lone factors FAIL (P and T) ═══════

let private N = 5 // strands, generators ±1..±4 (same plane as Braid.Tests)

[<Fact>]
let ``T ALONE FAILS on the braid: reversing a word does not invert it — the braid records an arrow`` () =
    // sigma_1 sigma_2 then its reverse: s1 s2 s2 s1 — history kept, not undone.
    Assert.False(Braid.isIdentity N ([ 1; 2 ] @ List.rev [ 1; 2 ]))

[<Fact>]
let ``P ALONE FAILS on the braid: mirroring a word does not invert it — order still owed`` () =
    // sigma_1 sigma_2 then s1^-1 s2^-1 (mirror without reversal): adjacent crossings don't commute.
    Assert.False(Braid.isIdentity N ([ 1; 2 ] @ List.map (~-) [ 1; 2 ]))

// The COMPOSITE on this plane — b · (rev ∘ neg) b = identity — is the already-locked
// Braid.Tests law `every braid word composed with its inverse is the identity`.

[<Property(Arbitrary = [| typeof<CptArbs> |])>]
let ``THE MOD-2 REGISTER IS CPT-PROTECTED: writhe flips sign under PT, its parity survives every factor`` (b: int list) =
    let ptImage = b |> List.map (~-) |> List.rev
    Braid.writhe ptImage = -(Braid.writhe b)
    && Braid.writheParity ptImage = Braid.writheParity b
    && Braid.writheParity (List.rev b) = Braid.writheParity b
    && Braid.writheParity (List.map (~-) b) = Braid.writheParity b

// ═══ the adinkra plane: parity ≈ adinkra mod 2 (C on the sign register) ════

/// Global sign conjugation: flip EVERY dash (the C map on the adinkra's sign register).
let private conjugate (d: AdinkraViz.Dashing) : AdinkraViz.Dashing =
    Set.difference (Set.ofList AdinkraViz.allEdges) d

[<Fact>]
let ``GLOBAL SIGN CONJUGATION PRESERVES THE GATES CONDITION: every face flips 4 dashes — parity mod 2 survives`` () =
    Assert.True(AdinkraViz.allFacesOdd AdinkraViz.standardDashing)
    Assert.True(AdinkraViz.allFacesOdd (conjugate AdinkraViz.standardDashing))

[<Property(Arbitrary = [| typeof<CptArbs> |])>]
let ``CONJUGATION COMMUTES WITH THE GAUGE ORBIT: random vertex flips then conjugation still satisfy Gates`` (vs: int list) =
    let gauged =
        vs
        |> List.map (fun v -> ((v % 16) + 16) % 16)
        |> List.fold (fun d v -> AdinkraViz.flipVertex v d) AdinkraViz.standardDashing

    AdinkraViz.allFacesOdd gauged && AdinkraViz.allFacesOdd (conjugate gauged)
