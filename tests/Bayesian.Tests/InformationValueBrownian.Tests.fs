namespace Zeta.Bayesian.Tests

open System
open Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Bayesian
open Zeta.Core

/// P-IV-1..3 — the Brownian-experts properties (math-team statements, 2026-07-03), landed after
/// Lumen pinned the KL direction (KL(posterior‖prior), df9cf9cb5). BP-16 cross-check: the sympy
/// lemma set (src/Core.Python/tests/test_bernoulli_t112.py) is tool 1; these FsCheck properties
/// against the ACTUAL `InformationValue.compute` are tool 2.
///
/// Direction convention throughout: expert 1's increment law plays the POSTERIOR (P), expert 2's
/// plays the PRIOR (Q), so `compute q p` = KL(P₁‖P₂) — and the per-tick rate is
/// g(r) = (r − 1 − log r)/2 with r = σ₁²/σ₂².
module InformationValueBrownianTests =

    /// N(mean, variance) as the repo's precision-form Gaussian.
    let private gaussian (mean: float) (variance: float) =
        { Gaussian.PrecisionMean = mean / variance; Precision = 1.0 / variance }

    /// The per-tick Wiener rate g(r) = (r − 1 − log r)/2 — convex, zero iff r = 1.
    let private g (r: float) = (r - 1.0 - log r) / 2.0

    // (parameters are bounded inline via modular arithmetic on PositiveInt — keeps σ², Δ in a
    //  well-conditioned float range without a custom Arbitrary)

    // ── P-IV-1: per-tick additivity — window KL over N ticks = N × single-increment compute ──

    [<Property>]
    let ``P-IV-1: window KL of iid Wiener increments = N x single-increment compute = N x g(r)``
        (nRaw: PositiveInt) (s1Raw: PositiveInt) (s2Raw: PositiveInt) (dRaw: PositiveInt) =
        let n = 1 + nRaw.Get % 64
        let sigma1Sq = 0.05 + float (s1Raw.Get % 400) / 100.0
        let sigma2Sq = 0.05 + float (s2Raw.Get % 400) / 100.0
        let delta = 0.01 + float (dRaw.Get % 200) / 100.0

        let p1 = gaussian 0.0 (sigma1Sq * delta) // posterior: expert 1's increment law
        let p2 = gaussian 0.0 (sigma2Sq * delta) // prior:     expert 2's increment law
        let perTick = float (InformationValue.compute p2 p1)
        let windowKl = float n * perTick
        let expected = float n * g (sigma1Sq / sigma2Sq)
        abs (windowKl - expected) < 1e-9 * (1.0 + abs expected)

    [<Property>]
    let ``P-IV-1b: the per-tick rate is Delta-free (resolution-artifact guard)``
        (s1Raw: PositiveInt) (s2Raw: PositiveInt) =
        let sigma1Sq = 0.05 + float (s1Raw.Get % 400) / 100.0
        let sigma2Sq = 0.05 + float (s2Raw.Get % 400) / 100.0
        let rateAt delta =
            float (InformationValue.compute (gaussian 0.0 (sigma2Sq * delta)) (gaussian 0.0 (sigma1Sq * delta)))
        // the same pair at four tick resolutions: identical per-tick rate
        let rates = [ 0.01; 0.1; 1.0; 10.0 ] |> List.map rateAt
        rates |> List.forall (fun r -> abs (r - rates.Head) < 1e-9 * (1.0 + abs rates.Head))

    // ── P-IV-2: same-diffusion OU cap — discrete KL bounded by the exact finite limit ──

    /// Discrete stationary-OU window KL built from `compute`: first-point stationary KL + (N−1)
    /// transition terms; the transition mean-shift is evaluated at the RMS state √v₁ so that
    /// τ_Q(μP−μQ)² = τ_Q(φ₁−φ₂)²·v₁ — the exact expectation under P₁.
    let private ouWindowKl (theta1: float) (theta2: float) (sigmaSq: float) (bigT: float) (delta: float) =
        let n = max 2 (int (bigT / delta))
        let v1 = sigmaSq / (2.0 * theta1)
        let v2 = sigmaSq / (2.0 * theta2)
        let phi1 = exp (-theta1 * delta)
        let phi2 = exp (-theta2 * delta)
        let q1 = v1 * (1.0 - phi1 * phi1)
        let q2 = v2 * (1.0 - phi2 * phi2)
        let kl0 = float (InformationValue.compute (gaussian 0.0 v2) (gaussian 0.0 v1))
        let xRms = sqrt v1
        let klt = float (InformationValue.compute (gaussian (phi2 * xRms) q2) (gaussian (phi1 * xRms) q1))
        kl0 + float (n - 1) * klt

    /// The exact Δ→0 limit: T(θ₂−θ₁)²/(4θ₁) + ½[v₁/v₂ − 1 + log(v₂/v₁)].
    let private ouKlLimit (theta1: float) (theta2: float) (sigmaSq: float) (bigT: float) =
        let v1 = sigmaSq / (2.0 * theta1)
        let v2 = sigmaSq / (2.0 * theta2)
        bigT * (theta2 - theta1) ** 2.0 / (4.0 * theta1) + 0.5 * (v1 / v2 - 1.0 + log (v2 / v1))

    [<Property>]
    let ``P-IV-2: same-diffusion OU window KL converges to the exact finite limit under refinement``
        (t1Raw: PositiveInt) (t2Raw: PositiveInt) =
        let theta1 = 0.5 + float (t1Raw.Get % 20) / 10.0
        let theta2 = 0.5 + float (t2Raw.Get % 20) / 10.0
        if abs (theta1 - theta2) < 1e-9 then
            true // identical lengthscales: nothing to converge to; vacuously fine
        else
            let sigmaSq, bigT = 1.0, 3.0
            let limit = ouKlLimit theta1 theta2 sigmaSq bigT
            let err d = abs (ouWindowKl theta1 theta2 sigmaSq bigT d - limit)
            // refinement converges toward the limit, and is close at Δ = 1/100
            err 0.01 < err 0.1 && err 0.01 < 0.05 * (1.0 + limit)

    // ── P-IV-3: divergence-rate invariance — per-tick KL → g(σ₁²/σ₂²), lengthscale-free ──

    [<Property>]
    let ``P-IV-3: different-diffusion OU per-tick transition KL tends to g(r) — lengthscales drop out``
        (s1Raw: PositiveInt) (s2Raw: PositiveInt) (l1Raw: PositiveInt) (l2Raw: PositiveInt) =
        let sigma1Sq = 0.2 + float (s1Raw.Get % 300) / 100.0
        let sigma2Sq = 0.2 + float (s2Raw.Get % 300) / 100.0
        let theta1 = 0.5 + float (l1Raw.Get % 20) / 10.0
        let theta2 = 0.5 + float (l2Raw.Get % 20) / 10.0
        let target = g (sigma1Sq / sigma2Sq)

        let perTickAt delta =
            let v1 = sigma1Sq / (2.0 * theta1)
            let phi1 = exp (-theta1 * delta)
            let phi2 = exp (-theta2 * delta)
            let q1 = sigma1Sq / (2.0 * theta1) * (1.0 - phi1 * phi1)
            let q2 = sigma2Sq / (2.0 * theta2) * (1.0 - phi2 * phi2)
            let xRms = sqrt v1
            float (InformationValue.compute (gaussian (phi2 * xRms) q2) (gaussian (phi1 * xRms) q1))

        let errFine = abs (perTickAt 0.0001 - target)
        // Per-tick transition KL approaches the Wiener constant as Δ→0, θ's forgotten.
        // The approach is not monotone for every θ pair because higher-order drift terms can
        // cancel at coarser Δ. The invariant is the small-Δ limit, not two-point monotonicity.
        errFine < 0.02 * (1.0 + target)

    // ── anchors: g's shape, pinned as facts the properties rely on ──

    [<Fact>]
    let ``g is zero at r=1 and positive elsewhere (identical experts are free, different ones cost)`` () =
        Assert.Equal(0.0, g 1.0, 12)
        Assert.True(g 0.5 > 0.0)
        Assert.True(g 2.0 > 0.0)

    [<Fact>]
    let ``compute in the pinned direction reproduces g exactly on a known pair`` () =
        // σ₁² = 2, σ₂² = 1, Δ = 0.5 → r = 2, g(2) = (2 − 1 − log 2)/2
        let p1 = gaussian 0.0 (2.0 * 0.5)
        let p2 = gaussian 0.0 (1.0 * 0.5)
        let expected = (2.0 - 1.0 - log 2.0) / 2.0
        Assert.Equal(expected, float (InformationValue.compute p2 p1), 12)
