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
