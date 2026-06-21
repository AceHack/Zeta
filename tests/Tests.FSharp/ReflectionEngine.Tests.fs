module Zeta.Tests.ReflectionEngineTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module PS = Zeta.Core.ProbabilitySemiring
module RE = Zeta.Core.ReflectionEngine

// ═══════════════════════════════════════════════════════════════════
// ReflectionEngine — the yin-yang engine's two modes (Aaron, 2026-06-05): self-reflection (boundary fed
// by a deterministic seed → update priors) vs moving-forward (same step, real I/O). On the proven 081KTAH8Q0008QG0R001YHSSA0
// ProbabilitySemiring cell. Proven: the transition is Markov; self-reflection IS the proven observe-fold;
// self-reflection over NON-COERCIVE evidence is order-independent (the NCI safety property at engine
// level); forward ≡ step (the modes share one transition).
// ═══════════════════════════════════════════════════════════════════

let private r (n: int64) (d: int64) = PS.rat n d

let private genVecN (n: int) : Gen<PS.Rational[]> =
    Gen.arrayOfLength n (
        gen {
            let! num = Gen.choose (1, 10) |> Gen.map int64
            let! den = Gen.choose (1, 5) |> Gen.map int64
            return PS.rat num den
        })

let private genRun : Gen<PS.Rational[] * PS.Rational[] list> =
    gen {
        let! n = Gen.choose (1, 4)
        let! belief = genVecN n
        let! k = Gen.choose (2, 5)
        let! seed = Gen.listOfLength k (genVecN n)
        return belief, seed
    }

type RunArb() =
    static member R() = Arb.fromGen genRun

// ── decide / step / the two modes ──

[<Fact>]
let ``decide is argmax with first-index-wins on ties`` () =
    Assert.Equal(0, RE.decide [| r 1L 2L; r 1L 4L; r 1L 2L |]) // tie at 1/2 -> first index
    Assert.Equal(1, RE.decide [| r 1L 4L; r 3L 4L |])

[<Fact>]
let ``self-reflection's final belief IS the proven observe-fold (engine = 081KTAH8Q0008QG0R001YHSSA0 cell)`` () =
    let b = [| r 1L 1L; r 1L 1L; r 1L 1L |]
    let seed = [ [| r 2L 1L; r 1L 1L; r 1L 1L |]; [| r 1L 1L; r 3L 1L; r 1L 1L |] ]
    let final, _ = RE.reflect b seed
    Assert.Equal<PS.Rational[]>(PS.observeAll seed b, final)

[<Property(Arbitrary = [| typeof<RunArb> |])>]
let ``moving-forward and self-reflection share the same transition (forward = step)``
    (run: PS.Rational[] * PS.Rational[] list) =
    let belief, seed = run
    match seed with
    | obs :: _ -> RE.forward belief obs = RE.step belief obs
    | [] -> true

[<Property(Arbitrary = [| typeof<RunArb> |])>]
let ``self-reflection is deterministic / replayable (DST)`` (run: PS.Rational[] * PS.Rational[] list) =
    let belief, seed = run
    RE.reflect belief seed = RE.reflect belief seed

// ── the NCI safety property at engine level ──

[<Property(Arbitrary = [| typeof<RunArb> |])>]
let ``self-reflection over non-coercive evidence converges order-independently (NCI safety)``
    (run: PS.Rational[] * PS.Rational[] list) =
    let belief, seed = run
    match seed with
    | [] | [ _ ] -> true
    | _ ->
        let finalBelief order = fst (RE.reflect belief order)
        let forward = finalBelief seed
        let reversed = finalBelief (List.rev seed)
        let rotated = finalBelief (List.tail seed @ [ List.head seed ])
        forward = reversed && forward = rotated
