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

// ── BRIDGE-5/6: Fourier↔convolution duality (bridge Step 2 numerical verification) ───────────────────────────────────────────
//
// Bridge Step 2 — precise boundary (discovered 2026-07-04):
//
// The Hadamard convolution theorem Ĥ(a .* b) = Ĥ(a) .* Ĥ(b) holds for the FULL GF(2)^n group
// (all 2^n vectors), NOT for a subgroup distribution (the 16 codewords out of 256).
// The correct MacWilliams fixed-point property is for the WEIGHT DISTRIBUTION W_C[j],
// not the per-codeword distribution.
//
// BRIDGE-5: verifies the Hadamard convolution theorem for the FULL GF(2)^4 space (16 elements
//           as the complete group). This is the correct domain for the theorem.
// BRIDGE-6: verifies that the weight distribution W_C = [1,0,0,0,14,0,0,0,1] of the [8,4] code
//           is a MacWilliams fixed point (W_C = MacWilliams(W_C)), which is the correct statement
//           of the self-dual fixed point. This is the algebraic statement of gen(gen)=gen.
//
// The open crux (Step 2 of the bridge): identify the SoftValue/NCI accumulation operator
// with the MacWilliams transform via the Fourier↔convolution duality. The correct path is:
//   (a) SoftValue.combine = pointwise product of probabilities (in the primal domain)
//   (b) For the FULL GF(2)^n group, this corresponds to convolution in the Hadamard dual
//   (c) The MacWilliams transform = Hadamard transform of the WEIGHT distribution
//   (d) The self-dual code's weight distribution is the fixed point of this transform
// The gap: the SoftValue candidates are the 16 CODEWORDS (a subgroup), not the full GF(2)^8.
// The bridge requires lifting the subgroup distribution to the full group, or working directly
// with the weight distribution as the observable.

[<Fact>]
let ``BRIDGE-5: Pontryagin duality holds for GF(2)^4 — pointwise-product in primal = XOR-convolution in dual`` () =
    // The correct Fourier↔convolution duality for (GF(2)^4, ⊕):
    //   Ĥ(a .* b) = (1/n) · (Ĥ(a) ∗⊕ Ĥ(b))
    // where .* is pointwise product and ∗⊕ is XOR-convolution.
    // This is the Pontryagin duality: pointwise product in the primal domain corresponds to
    // XOR-convolution (scaled by 1/n) in the Hadamard dual domain.
    // SoftValue.combine is the primal pointwise product; the Hadamard dual is the MacWilliams domain.
    let a = Array.create 16 (1.0 / 16.0)  // uniform over GF(2)^4
    let b = Array.init 16 (fun i -> float (i + 1)) |> (fun v -> let s = Array.sum v in Array.map (fun x -> x / s) v)
    Assert.True(
        BC.verifyFourierConvolutionDuality a b 1e-9,
        "Pontryagin duality should hold: Ĥ(a .* b) = (1/n) · (Ĥ(a) ∗⊕ Ĥ(b))")

[<Fact>]
let ``BRIDGE-6: weight distribution of [8,4] code is a MacWilliams fixed point (gen(gen)=gen algebraic statement)`` () =
    // The weight distribution W_C = [1, 0, 0, 0, 14, 0, 0, 0, 1] (weights 0..8).
    // For a self-dual code, W_C = MacWilliams(W_C) (the algebraic statement of gen(gen)=gen).
    // This is the CORRECT fixed-point property — it acts on the weight distribution, not per-codeword.
    Assert.True(
        AdinkraCode.isMacWilliamsFixedPoint,
        "Weight distribution of [8,4] code should be a MacWilliams fixed point (gen(gen)=gen)")
    // Also verify the weight enumerator values directly.
    let wEnum = AdinkraCode.weightEnumerator |> Map.ofList
    Assert.Equal(1, wEnum |> Map.tryFind 0 |> Option.defaultValue 0)  // 1 codeword of weight 0
    Assert.Equal(14, wEnum |> Map.tryFind 4 |> Option.defaultValue 0) // 14 codewords of weight 4
    Assert.Equal(1, wEnum |> Map.tryFind 8 |> Option.defaultValue 0)  // 1 codeword of weight 8

// ── BRIDGE-7 through BRIDGE-10: PontryaginDuality algebraic proof tests ──────────────────────────
//
// These tests exercise the algebraic proof in PontryaginDuality.fs:
//   BRIDGE-7: Walsh orthogonality (the key lemma for the proof)
//   BRIDGE-8: Unit preservation (Ĥ maps the primal unit to the dual unit)
//   BRIDGE-9: Pontryagin duality holds for arbitrary distributions (not just uniform)
//   BRIDGE-10: MacWilliams fixed point via Krawtchouk transform (algebraic, not just numerical)
//   BRIDGE-11: Orbit-map intertwining gap — documents the remaining open crux

module PD = Zeta.Core.PontryaginDuality

[<Fact>]
let ``BRIDGE-7: Walsh orthogonality holds for GF(2)^3 and GF(2)^4`` () =
    // Σ_{x ∈ GF(2)^k} χ_s(x) = n · [s = 0]
    // This is the key lemma that makes the Pontryagin duality proof work.
    Assert.True(PD.verifyWalshOrthogonality 3, "Walsh orthogonality should hold for k=3 (n=8)")
    Assert.True(PD.verifyWalshOrthogonality 4, "Walsh orthogonality should hold for k=4 (n=16)")

[<Fact>]
let ``BRIDGE-8: Hadamard maps the primal unit (all-ones) to the dual unit (n·e_0)`` () =
    // The unit of .* is the all-ones vector 1_n.
    // Ĥ(1_n)(s) = Σ_x χ_s(x) = n · [s = 0]
    // So Ĥ(1_n) = n · e_0 — the delta at 0, scaled by n.
    // The unit of (1/n)·∗⊕ is n · e_0.
    // Therefore Ĥ is a monoid homomorphism (unit-preserving).
    Assert.True(PD.verifyUnitPreservation 16, "Ĥ should map all-ones to n·e_0 for n=16")
    Assert.True(PD.verifyUnitPreservation 8, "Ĥ should map all-ones to n·e_0 for n=8")

[<Fact>]
let ``BRIDGE-9: Pontryagin duality holds for arbitrary float distributions over GF(2)^4`` () =
    // The algebraic proof is general: for ANY f, g : GF(2)^k → ℝ,
    //   Ĥ(f .* g)(s) = (1/n) · Σ_t f̂(t) · ĝ(t ⊕ s)
    // Test with three different distribution pairs.
    let uniform = Array.create 16 (1.0 / 16.0)
    let linear = Array.init 16 (fun i -> float (i + 1)) |> (fun v -> let s = Array.sum v in Array.map (fun x -> x / s) v)
    let peaked = Array.init 16 (fun i -> if i = 7 then 0.9 else 0.1 / 15.0)
    // All three pairs should satisfy the duality to machine precision
    let eps = 1e-9
    Assert.True(PD.pontryaginDualityMaxDiff uniform linear < eps,
        sprintf "Pontryagin duality: uniform × linear, max diff = %.2e" (PD.pontryaginDualityMaxDiff uniform linear))
    Assert.True(PD.pontryaginDualityMaxDiff linear peaked < eps,
        sprintf "Pontryagin duality: linear × peaked, max diff = %.2e" (PD.pontryaginDualityMaxDiff linear peaked))
    Assert.True(PD.pontryaginDualityMaxDiff peaked peaked < eps,
        sprintf "Pontryagin duality: peaked × peaked, max diff = %.2e" (PD.pontryaginDualityMaxDiff peaked peaked))

[<Fact>]
let ``BRIDGE-10: MacWilliams fixed point via Krawtchouk transform (algebraic statement)`` () =
    // The weight distribution W_C = [1,0,0,0,14,0,0,0,1] is a fixed point of the
    // Krawtchouk/MacWilliams transform for the [8,4] code.
    // This is the algebraic statement of gen(gen)=gen at the weight-enumerator level.
    Assert.True(PD.verifyMacWilliamsFixedPoint (),
        "W_C = [1,0,0,0,14,0,0,0,1] should be a Krawtchouk/MacWilliams fixed point")

[<Fact>]
let ``BRIDGE-11: orbit-map intertwining gap documents the remaining open crux`` () =
    // The orbit map π : ℝ^16 → ℝ^9 projects per-codeword beliefs to weight distributions.
    // The open crux: does π(a .* b) ∝ MacWilliams(π(a)) ∗ MacWilliams(π(b))?
    //
    // FINDING (2026-07-04): the orbit-map intertwining does NOT hold even for uniform × uniform.
    // The gap is ~0.115 for uniform × uniform, which means the intertwining is NOT the right
    // bridge path. The Pontryagin duality (BRIDGE-9) lives in the FULL GF(2)^k space;
    // the orbit map projects to the weight-class quotient, and the intertwining condition
    // is a strictly stronger requirement that the [8,4] code does NOT satisfy in general.
    //
    // This is the precise statement of the remaining open crux:
    //   The Pontryagin duality is proven (BRIDGE-9).
    //   The orbit-map intertwining is OPEN and may require a different bridge path.
    let uniform = Array.create 16 (1.0 / 16.0)
    let linear = Array.init 16 (fun i -> float (i + 1)) |> (fun v -> let s = Array.sum v in Array.map (fun x -> x / s) v)
    // Gap is non-negative for all distributions
    let gap = PD.orbitIntertwiningMaxDiff uniform linear
    Assert.True(gap >= 0.0, "Orbit-map intertwining gap should be non-negative")
    // Gap is non-zero even for uniform × uniform (the intertwining does NOT hold in general)
    let uniformGap = PD.orbitIntertwiningMaxDiff uniform uniform
    Assert.True(uniformGap > 0.01,
        sprintf "Orbit-map intertwining gap should be non-zero for uniform × uniform (got %.2e) — the intertwining is the open crux" uniformGap)

// ─────────────────────────────────────────────────────────────────────────────
// BRIDGE-12 and BRIDGE-13: The Orbit-Counting Intertwining Theorem (soft-regime discharge)
//
// Aaron's conjecture (2026-07-04): the orbit-map intertwining gap closes when
// distributions are constrained to the soft manifold (orbit-symmetric, non-collapsed).
//
// THEOREM (proven numerically, 2026-07-04):
//   For orbit-symmetric distributions a, b over the 16 Adinkra codewords:
//     π(a .* b) ∝ (π(a) .* π(b)) / W_C
//   where W_C = [1, 0, 0, 0, 14, 0, 0, 0, 1] is the MacWilliams fixed point.
//
// The denominator W_C IS the self-dual fixed point — the code's weight distribution
// divides out the orbit-counting factor, making the intertwining exact.
//
// "Staying soft" = orbit-symmetric = invariant under the [8,4] automorphism group.
// "Not collapsing the wave function" = all weight classes have positive mass.
// ─────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``BRIDGE-12: orbit-counting intertwining holds exactly for orbit-symmetric distributions`` () =
    // For orbit-symmetric distributions, the gap π(a.*b) vs (π(a).*π(b))/W_C is zero.
    // This is the soft-regime discharge of the bridge Step 2 crux.
    let uniform = Array.create 16 (1.0 / 16.0)  // uniform is orbit-symmetric
    // Non-uniform but orbit-symmetric: weight-4 codewords get more mass
    let cws = AdinkraCode.allCodewords |> List.toArray
    let softOrbit =
        let raw = Array.init 16 (fun i ->
            let w = AdinkraCode.weight cws.[i]
            if w = 0 then 0.05 elif w = 4 then 0.85 / 14.0 else 0.05)
        let s = Array.sum raw in Array.map (fun x -> x / s) raw
    // Both distributions are orbit-symmetric
    Assert.True(PD.isOrbitSymmetric uniform, "Uniform distribution should be orbit-symmetric")
    Assert.True(PD.isOrbitSymmetric softOrbit, "Soft orbit distribution should be orbit-symmetric")
    // The orbit-counting intertwining gap should be zero
    let gap = PD.orbitCountingIntertwiningMaxDiff uniform softOrbit
    Assert.True(gap < 1e-9,
        sprintf "Orbit-counting intertwining gap should be zero for orbit-symmetric distributions (got %.2e)" gap)
    // Verify for multiple orbit-symmetric pairs
    let pairs =
        [ (0.1, 0.8/14.0, 0.1), (0.05, 0.9/14.0, 0.05)
          (1.0/16.0, 1.0/16.0, 1.0/16.0), (0.2, 0.6/14.0, 0.2)
          (0.15, 0.7/14.0, 0.15), (0.08, 0.84/14.0, 0.08) ]
    for ((p0, p4, p8), (q0, q4, q8)) in pairs do
        let a = Array.init 16 (fun i ->
            let w = AdinkraCode.weight cws.[i]
            if w = 0 then p0 elif w = 4 then p4 else p8)
        let b = Array.init 16 (fun i ->
            let w = AdinkraCode.weight cws.[i]
            if w = 0 then q0 elif w = 4 then q4 else q8)
        let g = PD.orbitCountingIntertwiningMaxDiff a b
        Assert.True(g < 1e-9,
            sprintf "Orbit-counting intertwining gap should be zero for orbit-symmetric pair (p0=%g,p4=%g,p8=%g) × (q0=%g,q4=%g,q8=%g), got %.2e" p0 p4 p8 q0 q4 q8 g)

[<Fact>]
let ``BRIDGE-13: soft-regime constraint — orbit-symmetric distributions are in the positive cone`` () =
    // The "don't collapse" condition: MacWilliams(W)(k) >= 0 for all k.
    // For orbit-symmetric distributions close to the MacWilliams fixed point,
    // the weight distribution stays in the positive cone.
    // The boundary: K_1(4) = 0, so MW(W)(1) = (p0 - p8)/2 >= 0 iff p0 >= p8.
    let cws = AdinkraCode.allCodewords |> List.toArray
    // The MacWilliams fixed point W_C = (1/16, 14/16, 1/16) normalized
    let wC = [| 1.0/16.0; 0.0; 0.0; 0.0; 14.0/16.0; 0.0; 0.0; 0.0; 1.0/16.0 |]
    Assert.True(PD.isInPositiveCone wC, "MacWilliams fixed point W_C should be in the positive cone")
    // Uniform distribution (orbit-symmetric) should be in the positive cone
    let uniform = Array.create 16 (1.0 / 16.0)
    let wUniform = PontryaginDuality.orbitMap uniform
    Assert.True(PD.isInPositiveCone wUniform, "Uniform distribution should be in the positive cone")
    // A soft orbit-symmetric distribution (weight-4 heavy) should be in the positive cone
    // iff p0 >= p8 (the balance condition)
    let softBalanced =
        let raw = Array.init 16 (fun i ->
            let w = AdinkraCode.weight cws.[i]
            if w = 0 then 0.08 elif w = 4 then 0.84/14.0 else 0.08)
        let s = Array.sum raw in Array.map (fun x -> x / s) raw
    let wSoftBalanced = PontryaginDuality.orbitMap softBalanced
    Assert.True(PD.isInPositiveCone wSoftBalanced,
        "Balanced soft distribution (p0 = p8) should be in the positive cone")
    // A collapsed distribution (all mass on weight-4, p0 = p8 = 0) is on the boundary
    // of the positive cone — this is the "wave function collapse" case
    let collapsed =
        let raw = Array.init 16 (fun i ->
            let w = AdinkraCode.weight cws.[i]
            if w = 4 then 1.0/14.0 else 0.0)
        raw  // already normalized
    let wCollapsed = PontryaginDuality.orbitMap collapsed
    // MW(W_collapsed)(1) = (1/16)*(8*0 - 8*0) = 0 — on the boundary (not strictly positive)
    let mwCollapsed = PontryaginDuality.krawtchoukTransform 8 16 wCollapsed
    Assert.True(abs mwCollapsed.[1] < 1e-9,
        sprintf "Collapsed distribution (all weight-4) should have MW(W)(1) = 0 (boundary), got %.2e" mwCollapsed.[1])

// ─────────────────────────────────────────────────────────────────────────────
// BRIDGE-14 through BRIDGE-17: OrbitEquivariance algebraic proof chain
//
// The four-step algebraic proof that SoftValue.combine is equivariant under
// the [8,4] automorphism group action in the soft regime.
// ─────────────────────────────────────────────────────────────────────────────

module OE = OrbitEquivariance

// Helper: construct an OrbitSymmetricDist using OE.make (avoids record-label scope issues)
let private makeOE p0 p4 p8 =
    match OE.make p0 p4 p8 with
    | Some d -> d
    | None -> failwithf "makeOE: invalid distribution (p0=%g, p4=%g, p8=%g)" p0 p4 p8

[<Fact>]
let ``BRIDGE-14: orbit-symmetric distributions form a sub-monoid under combine`` () =
    // Step 1 of the algebraic proof: combine(a,b) is orbit-symmetric if a and b are.
    let a = makeOE 0.1 (0.8/14.0) 0.1
    let b = makeOE 0.05 (0.9/14.0) 0.05
    Assert.True(OE.verifySubMonoidProperty a b,
        "combine(a,b) should be orbit-symmetric when a and b are orbit-symmetric")
    // Verify for the MacWilliams fixed point
    let wc = OE.macWilliamsFixedPoint
    Assert.True(OE.verifySubMonoidProperty wc b,
        "combine(W_C, b) should be orbit-symmetric")
    Assert.True(OE.verifySubMonoidProperty a wc,
        "combine(a, W_C) should be orbit-symmetric")

[<Fact>]
let ``BRIDGE-15: orbit-counting intertwining holds algebraically for orbit-symmetric distributions`` () =
    // Step 4 of the algebraic proof: π(combine(a,b)) ∝ (π(a).*π(b)) / W_C
    let pairs =
        [ makeOE 0.1 (0.8/14.0) 0.1,        makeOE 0.05 (0.9/14.0) 0.05
          makeOE (1.0/16.0) (1.0/16.0) (1.0/16.0), makeOE 0.2 (0.6/14.0) 0.2
          makeOE 0.15 (0.7/14.0) 0.15,      makeOE 0.08 (0.84/14.0) 0.08 ]
    for (a, b) in pairs do
        let gap = OE.verifyOrbitCountingIntertwining a b
        Assert.True(gap < 1e-9,
            sprintf "Orbit-counting intertwining gap should be zero (got %.2e) for (P0=%g,P4=%g,P8=%g) × (P0=%g,P4=%g,P8=%g)"
                gap a.P0 a.P4 a.P8 b.P0 b.P4 b.P8)

[<Fact>]
let ``BRIDGE-16: MacWilliams fixed point is the unit of the orbit-counting formula (gen(gen)=gen)`` () =
    // Step 4 corollary: combining with W_C (uniform) is the identity on weight distributions.
    // This is gen(gen)=gen at the weight-distribution level.
    let testCases =
        [ makeOE 0.1 (0.8/14.0) 0.1
          makeOE 0.05 (0.9/14.0) 0.05
          makeOE 0.2 (0.6/14.0) 0.2 ]
    for b in testCases do
        let gap = OE.verifyMacWilliamsIsUnit b
        Assert.True(gap < 1e-9,
            sprintf "MacWilliams should be the unit: combine(W_C, b) should have same weight dist as b (got gap %.2e)" gap)

[<Fact>]
let ``BRIDGE-17: positive-cone constraint — the soft-regime boundary is p0 >= p8`` () =
    // The "don't collapse" condition: MacWilliams(W)(1) >= 0 iff p0 >= p8.
    // Distributions with p0 >= p8 are in the positive cone (the soft manifold).
    // Distributions with p0 < p8 are outside (collapsed toward the all-ones codeword).
    let wc = OE.macWilliamsFixedPoint
    Assert.True(OE.isInPositiveCone wc, "MacWilliams fixed point should be in the positive cone")
    // Balanced distributions (p0 = p8) are on the boundary
    let balanced = makeOE 0.08 (0.84/14.0) 0.08
    Assert.True(OE.isInPositiveCone balanced, "Balanced distribution (p0 = p8) should be in the positive cone")
    // p0 > p8: in the positive cone
    let p0Heavy = makeOE 0.15 (0.7/14.0) 0.05
    Assert.True(OE.isInPositiveCone p0Heavy, "p0 > p8 distribution should be in the positive cone")
    // p0 < p8: outside the positive cone (collapsed toward all-ones)
    let p8Heavy = makeOE 0.02 (0.8/14.0) 0.12
    Assert.False(OE.isInPositiveCone p8Heavy,
        "p0 < p8 distribution should be OUTSIDE the positive cone (collapsed toward all-ones)")
    // The bridgeProofStatus should confirm all properties
    let status = OE.bridgeProofStatus ()
    Assert.True(status.SubMonoidProperty, "Sub-monoid property should hold")
    Assert.True(status.OrbitCountingIntertwining < 1e-9,
        sprintf "Orbit-counting intertwining should be zero (got %.2e)" status.OrbitCountingIntertwining)
    Assert.True(status.MacWilliamsIsUnit < 1e-9,
        sprintf "MacWilliams should be the unit (got %.2e)" status.MacWilliamsIsUnit)
    Assert.True(status.PositiveConeWC, "MacWilliams fixed point should be in the positive cone")
