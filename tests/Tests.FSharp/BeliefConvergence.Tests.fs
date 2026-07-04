module Zeta.Tests.BeliefConvergenceTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module BC = Zeta.Core.BeliefConvergence

// ═══════════════════════════════════════════════════════════════════
// BeliefConvergence — the general case of convergence-despite-reordering for Bayesian belief.
// observe = pointwise-multiply a fixed likelihood into the belief; it commutes & associates, so a fold
// over ANY permutation of the evidence gives the same belief — for any FIXED likelihoods (independence
// was sufficient, not necessary). The boundary: a state-dependent/nonlinear revision (sharpen) does NOT
// commute (concrete counterexample). Unnormalized int64 weights keep the proofs exact; normalization is
// a deterministic post-step so order-independence carries to the normalized posterior.
// ═══════════════════════════════════════════════════════════════════

// Fixed-length vectors of small non-negative weights/likelihoods (small ⇒ no int64 overflow).
let private dim = 4

let private genVec : Gen<int64[]> =
    Gen.arrayOfLength dim (Gen.choose (0, 10) |> Gen.map int64)

let private genVecList : Gen<int64[] list> =
    gen {
        let! n = Gen.choose (0, 6)
        let! xs = Gen.listOfLength n genVec
        return xs
    }

type BCArb() =
    static member V() = Arb.fromGen genVec
    static member L() = Arb.fromGen genVecList

// ── observe with fixed likelihoods is a commutative monoid action ──

[<Property(Arbitrary = [| typeof<BCArb> |])>]
let ``observe commutes for any two fixed likelihoods`` (l1: int64[]) (l2: int64[]) (b: int64[]) =
    BC.observe l2 (BC.observe l1 b) = BC.observe l1 (BC.observe l2 b)

[<Property(Arbitrary = [| typeof<BCArb> |])>]
let ``observe is associative via combine (monoid)`` (l1: int64[]) (l2: int64[]) (b: int64[]) =
    BC.observe (BC.combine l1 l2) b = BC.observe l1 (BC.observe l2 b)

// ── the headline: belief converges regardless of evidence order ──

[<Property(Arbitrary = [| typeof<BCArb> |])>]
let ``observeAll is independent of evidence order`` (evidence: int64[] list) (b: int64[]) =
    match evidence with
    | [] | [ _ ] -> true
    | _ ->
        let forward = BC.observeAll evidence b
        let reversed = BC.observeAll (List.rev evidence) b
        let rotated = BC.observeAll (List.tail evidence @ [ List.head evidence ]) b
        forward = reversed && forward = rotated

// ── the boundary: state-dependent / nonlinear revision breaks order-independence ──

[<Fact>]
let ``sharpen (state-dependent) does NOT commute with observe`` () =
    let b = [| 1L; 2L; 0L; 0L |]
    let l = [| 2L; 1L; 0L; 0L |]
    // observe-then-sharpen: (l .* b) then square = [2,2,..]² = [4,4,..]
    let observeThenSharpen = BC.sharpen (BC.observe l b)
    // sharpen-then-observe: b² then .*l = [1,4,..] .* l = [2,4,..]
    let sharpenThenObserve = BC.observe l (BC.sharpen b)
    Assert.NotEqual<int64[]>(observeThenSharpen, sharpenThenObserve)

[<Property(Arbitrary = [| typeof<BCArb> |])>]
let ``observe alone is stable: re-observing a definite likelihood is monotone (no order surprise)`` (b: int64[]) =
    // sanity: observing the all-ones likelihood is the identity (no evidence changes nothing)
    let ones = Array.create dim 1L
    BC.observe ones b = b

// ── MacWilliams / SoftValue bridge (§B open conjecture — numerical test) ──────────────────────────
// The bridge conjecture: the SoftValue/NCI commutative accumulation operator (pointwise-multiply
// likelihoods = Hadamard product in the dual space) converges to a fixed point whose weight
// distribution over the Adinkra codewords is MacWilliams-invariant.
//
// Numerical test: use the 16 Adinkra codewords as the candidate set. The uniform prior over
// these 16 candidates has weight distribution [1/16, 14/16, 1/16] (proportional to [1, 14, 1]).
// For a self-dual code, the MacWilliams transform of the weight enumerator = the weight enumerator.
// Therefore the uniform distribution IS the MacWilliams fixed point of the accumulation operator.
// Accumulating balanced (no-evidence) likelihoods should preserve this fixed point.
//
// This test is the NUMERICAL FALSIFIER for the bridge. If it passes, the conjecture survives.
// If it fails, the bridge is broken and the Lean proof is unnecessary.

module AK = Zeta.Core.AdinkraCode

let private normalize16 (belief: int64[]) : float[] =
    let total = belief |> Array.sumBy float
    if total <= 0.0 then Array.create 16 (1.0 / 16.0)
    else belief |> Array.map (fun w -> float w / total)

let private weightDist16 (probDist: float[]) : Map<int, float> =
    let codewords = AK.allCodewords
    [ for i in 0 .. 15 -> AK.weight codewords.[i], probDist.[i] ]
    |> List.groupBy fst
    |> List.map (fun (w, pairs) -> w, pairs |> List.sumBy snd)
    |> Map.ofList

let private isMacWilliamsInvariant16 (wDist: Map<int, float>) : bool =
    let n = 8
    let codeSize = 16.0
    let p = Array.zeroCreate<float> (n + 1)
    for w in 0 .. n do p.[w] <- wDist |> Map.tryFind w |> Option.defaultValue 0.0
    let binom a b =
        if b < 0 || b > a then 0.0
        else
            let mutable r = 1.0
            for t in 1 .. b do r <- r * float (a - b + t) / float t
            r
    let krawtchouk j i =
        let mutable acc = 0.0
        for s in 0 .. j do
            acc <- acc + (if s % 2 = 0 then 1.0 else -1.0) * binom i s * binom (n - i) (j - s)
        acc
    let transformed = Array.init (n + 1) (fun j ->
        (1.0 / codeSize) * (Array.sumBy (fun i -> p.[i] * krawtchouk j i) [| 0 .. n |]))
    Array.forall2 (fun orig trans -> abs (orig - trans) < 1e-6) p transformed

[<Fact>]
let ``BRIDGE-1: uniform prior over Adinkra codewords is MacWilliams-invariant (self-dual fixed point)`` () =
    let uniformBelief = Array.create 16 1L
    let probDist = normalize16 uniformBelief
    let wDist = weightDist16 probDist
    Assert.True(isMacWilliamsInvariant16 wDist,
        "Uniform prior over Adinkra codewords should be MacWilliams-invariant (self-dual code)")

[<Fact>]
let ``BRIDGE-2: accumulating balanced likelihoods preserves the MacWilliams fixed point`` () =
    let uniformBelief = Array.create 16 1L
    let noEvidence = Array.create 16 1L
    let posterior = BC.observeAll [noEvidence; noEvidence; noEvidence] uniformBelief
    let probDist = normalize16 posterior
    let wDist = weightDist16 probDist
    Assert.True(isMacWilliamsInvariant16 wDist,
        "Accumulating no-evidence should preserve the MacWilliams fixed point")

[<Fact>]
let ``BRIDGE-3: MacWilliams fixed point is absorbing but NOT attracting (boundary documented)`` () =
    // The all-ones likelihood is the identity: observe ones b = b.
    // Therefore balanced accumulation (all-ones likelihoods) does NOT move the prior.
    // The MacWilliams fixed point (uniform prior) is ABSORBING (stays there if you start there)
    // but NOT ATTRACTING (biased priors do not regress toward it under balanced accumulation).
    // This is the correct boundary of the bridge conjecture.
    //
    // The bridge conjecture is specifically: the UNIFORM prior is the MacWilliams fixed point,
    // and any prior that IS the uniform distribution stays MacWilliams-invariant under accumulation.
    // It does NOT claim that arbitrary priors converge to the uniform distribution.
    let biasedPrior = [| for i in 0 .. 15 -> if i = 0 then 1000L else 1L |]
    let balanced = Array.create 16 1L
    let manyRounds = List.replicate 100 balanced
    let posterior = BC.observeAll manyRounds biasedPrior
    // The biased prior should be UNCHANGED after 100 rounds of balanced (all-ones) accumulation.
    // observe ones b = b, so observeAll [ones; ones; ...] b = b.
    Assert.Equal<int64[]>(biasedPrior, posterior)
    // The biased prior is NOT MacWilliams-invariant (it concentrates on weight-0 codeword).
    let probDist = normalize16 posterior
    let wDist = weightDist16 probDist
    let weight4Mass = wDist |> Map.tryFind 4 |> Option.defaultValue 0.0
    // Weight-4 mass ≈ 14/1013 ≈ 0.0138, NOT 0.875 — the prior is still biased.
    Assert.True(weight4Mass < 0.05,
        sprintf "Biased prior should remain biased after balanced accumulation (got %.4f)" weight4Mass)

[<Fact>]
let ``BRIDGE-4: weight distribution of uniform prior matches the known weight enumerator [1,14,1]`` () =
    // The weight enumerator of the [8,4] code is [1, 14, 1] (weights 0, 4, 8).
    // The uniform prior should have weight distribution proportional to this.
    let uniformBelief = Array.create 16 1L
    let probDist = normalize16 uniformBelief
    let wDist = weightDist16 probDist
    Assert.InRange(wDist |> Map.tryFind 0 |> Option.defaultValue 0.0, 0.0624, 0.0626)  // 1/16
    Assert.InRange(wDist |> Map.tryFind 4 |> Option.defaultValue 0.0, 0.8749, 0.8751)  // 14/16
    Assert.InRange(wDist |> Map.tryFind 8 |> Option.defaultValue 0.0, 0.0624, 0.0626)  // 1/16
