module Zeta.Tests.Algebra.ProbabilitySemiringBoundaryTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module PS = Zeta.Core.ProbabilitySemiring

// ═══════════════════════════════════════════════════════════════════
// The NCI boundary on the exact-rational cell (081KTAH8Q0008QG0R001YHSSA0) — the rational sibling of BeliefConvergence.
// NON-COERCIVE observe (fixed/state-independent likelihood = pointwise multiply) COMMUTES, so a SET of
// evidence converges order-independently (the de Finetti / non-coercion boundary). COERCIVE revision
// (`sharpen`, which reads the belief it updates) does NOT commute — that counterexample IS the boundary.
// Exact ℚ throughout (no floats).
// ═══════════════════════════════════════════════════════════════════

// Aligned-length belief / likelihood vectors of small positive rationals.
let private genVecN (n: int) : Gen<PS.Rational[]> =
    Gen.arrayOfLength n (
        gen {
            let! num = Gen.choose (1, 10) |> Gen.map int64
            let! den = Gen.choose (1, 5) |> Gen.map int64
            return PS.rat num den
        })

let private genCase : Gen<PS.Rational[] * PS.Rational[] * PS.Rational[]> =
    gen {
        let! n = Gen.choose (1, 4)
        let! b = genVecN n
        let! l1 = genVecN n
        let! l2 = genVecN n
        return b, l1, l2
    }

type CaseArb() =
    static member C() = Arb.fromGen genCase

let private genEvidence : Gen<PS.Rational[] * PS.Rational[] list> =
    gen {
        let! n = Gen.choose (1, 4)
        let! b = genVecN n
        let! k = Gen.choose (2, 5)
        let! ev = Gen.listOfLength k (genVecN n)
        return b, ev
    }

type EvidenceArb() =
    static member E() = Arb.fromGen genEvidence

// ── non-coercive observe is order-independent (the NCI boundary, holding side) ──

[<Property(Arbitrary = [| typeof<CaseArb> |])>]
let ``non-coercive observe commutes`` (c: PS.Rational[] * PS.Rational[] * PS.Rational[]) =
    let b, l1, l2 = c
    PS.observe l1 (PS.observe l2 b) = PS.observe l2 (PS.observe l1 b)

[<Property(Arbitrary = [| typeof<EvidenceArb> |])>]
let ``observing a SET of fixed evidence is order-independent (de Finetti / NCI)``
    (e: PS.Rational[] * PS.Rational[] list) =
    let b, ev = e
    match ev with
    | [] | [ _ ] -> true
    | _ ->
        let forward = PS.observeAll ev b
        let reversed = PS.observeAll (List.rev ev) b
        let rotated = PS.observeAll (List.tail ev @ [ List.head ev ]) b
        forward = reversed && forward = rotated

// ── coercive revision crosses the boundary (the failing side) ──

[<Fact>]
let ``coercive sharpen does NOT commute with observe (the boundary counterexample)`` () =
    let b = [| PS.rat 2L 1L; PS.rat 3L 1L |]
    let l = [| PS.rat 1L 1L; PS.rat 2L 1L |]
    // observe ∘ sharpen : sharpen b = [4;9], then observe = [1*4; 2*9] = [4;18]
    let observeThenOnSharpen = PS.observe l (PS.sharpen b)
    // sharpen ∘ observe : observe = [2;6], then sharpen = [4;36]
    let sharpenAfterObserve = PS.sharpen (PS.observe l b)
    Assert.Equal<PS.Rational[]>([| PS.rat 4L 1L; PS.rat 18L 1L |], observeThenOnSharpen)
    Assert.Equal<PS.Rational[]>([| PS.rat 4L 1L; PS.rat 36L 1L |], sharpenAfterObserve)
    Assert.NotEqual<PS.Rational[]>(observeThenOnSharpen, sharpenAfterObserve)
