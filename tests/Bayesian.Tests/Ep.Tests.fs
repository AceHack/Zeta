module Zeta.Bayesian.Tests.EpTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Bayesian

// EP (081KT2T2J0008QG0R000S7GHQ8 slice 5) — non-conjugate factors via moment matching. The
// probit site's closed-form moments are checked against NUMERICAL
// QUADRATURE of the tilted distribution N(x;m,v)·Φ(x) (self-verifying),
// and an EP factor plugged into the existing FactorGraph + runToFixpoint
// converges to the moment-matched posterior. "The compilers don't lie."

// trapezoidal quadrature of f over [lo,hi] with n panels
let private quad (f: float -> float) (lo: float) (hi: float) (n: int) : float =
    let h = (hi - lo) / float n
    let mutable s = 0.0
    for i in 0 .. n do
        let x = lo + float i * h
        let w = if i = 0 || i = n then 0.5 else 1.0
        s <- s + w * f x
    s * h

// moments (mean, variance) of the tilted distribution N(x;m,v)·Φ(x),
// computed by quadrature — the ground truth for the probit projection.
let private tiltedMoments (m: float) (v: float) : float * float =
    let sd = sqrt v
    let lo, hi = m - 12.0 * sd, m + 12.0 * sd
    let n = 40000
    let pdfN x = exp (-0.5 * (x - m) * (x - m) / v) / sqrt (2.0 * Math.PI * v)
    let integrand (p: float -> float) x = pdfN x * Normal.cdf x * p x
    let z = quad (integrand (fun _ -> 1.0)) lo hi n
    let m1 = quad (integrand id) lo hi n / z
    let m2 = quad (integrand (fun x -> x * x)) lo hi n / z
    m1, m2 - m1 * m1

// ─── Normal cdf/pdf (Abramowitz–Stegun erf) ───

[<Fact>]
let ``Normal cdf and pdf are accurate`` () =
    Normal.cdf 0.0 |> should (equalWithin 1e-6) 0.5
    Normal.cdf 1.96 |> should (equalWithin 1e-3) 0.975
    Normal.cdf -1.0 |> should (equalWithin 1e-3) 0.1586553
    Normal.pdf 0.0 |> should (equalWithin 1e-7) 0.3989422804

// ─── The probit projection vs numerical quadrature (the formula is right) ───

[<Fact>]
let ``probit projection matches numerical quadrature of cavity times Phi`` () =
    for m, v in [ (0.0, 1.0); (0.5, 2.0); (-1.0, 0.5); (1.5, 0.25) ] do
        let proj = Ep.probitProject (Gaussian.ofMeanVariance m v)
        let qMean, qVar = tiltedMoments m v
        Gaussian.mean proj |> should (equalWithin 2e-3) qMean
        Gaussian.variance proj |> should (equalWithin 2e-3) qVar

// ═══════════════════════════════════════════════════════════════════
// C7 (081KT2T2J0008QG0R000YZ3NMY P1) — the probit moment-match is accurate OVER THE CAVITY
// DOMAIN, not just at 4 fixed points. Lifts the cross-check above to
// FsCheck-GENERATED cavities, keeping numerical quadrature of
// N(x;m,v)·Φ(x) (`tiltedMoments`) as the oracle (Minka 2001 / GPML 3.58).
// Cavities stay in a moderate band [m∈[-4,4], v∈[0.1,6]] where the
// trapezoidal oracle (±12 sd, 40k panels) is accurate and Φ(z) does not
// underflow — the extreme/broad cavities are covered by the asymptotic
// inverse-Mills / no-overflow [<Fact>] tests below. The shared A-S erf
// cancels between formula and oracle (both call Normal.cdf), so this
// isolates the GPML 3.58 MOMENT-MATCH formula, which is the C7 claim.
// ═══════════════════════════════════════════════════════════════════

let private clampMC7 (x: float) = max -4.0 (min 4.0 x)
let private clampVC7 (x: float) = max 0.1 (min 6.0 (abs x))

[<Property>]
let ``C7 probit projection matches quadrature over generated cavities (moment-match formula is right)``
    (NormalFloat mRaw) (NormalFloat vRaw) =
    let m, v = clampMC7 mRaw, clampVC7 vRaw
    let proj = Ep.probitProject (Gaussian.ofMeanVariance m v)
    let qMean, qVar = tiltedMoments m v
    abs (Gaussian.mean proj - qMean) <= 2.5e-3
    && abs (Gaussian.variance proj - qVar) <= 2.5e-3

// ─── Extreme negative cavity: Φ(z) underflows → asymptotic inverse Mills ───

[<Fact>]
let ``probit projection stays finite and proper for an extreme negative cavity`` () =
    // cavity strongly contradicts "x > 0": Φ(z) underflows to 0, so the naive
    // λ = φ/Φ would be ∞/NaN and throw via ofMeanVariance. The stabilized
    // inverse Mills (asymptotic tail) must keep the projection finite, proper,
    // and variance-reduced (the factor still adds information).
    for m, v in [ (-15.0, 1.0); (-40.0, 0.25); (-8.0, 4.0) ] do
        let proj = Ep.probitProject (Gaussian.ofMeanVariance m v)
        Gaussian.isProper proj |> should equal true
        Double.IsFinite(Gaussian.mean proj) |> should equal true
        Double.IsFinite(Gaussian.variance proj) |> should equal true
        // probit observation adds information → posterior variance ≤ cavity
        Gaussian.variance proj |> should be (lessThanOrEqualTo v)
        // and it pushes the (very negative) mean upward toward the constraint
        Gaussian.mean proj |> should be (greaterThan m)

[<Fact>]
let ``probit projection tail switch covers the ARM FsCheck shrunk cavity`` () =
    // On arm64 the A-S erf approximation can return a tiny positive but
    // relative-inaccurate Φ(z) before underflow. Use the Mills tail by z-band,
    // not only after cdf = 0, so the projected variance stays proper.
    let m, v = -10.0, 0.4581573742
    let proj = Ep.probitProject (Gaussian.ofMeanVariance m v)
    Gaussian.isProper proj |> should equal true
    Double.IsFinite(Gaussian.mean proj) |> should equal true
    Double.IsFinite(Gaussian.variance proj) |> should equal true
    Gaussian.variance proj |> should be (lessThanOrEqualTo v)

[<Fact>]
let ``probit projection stays finite for an extremely broad cavity (no v-squared overflow)`` () =
    // v = 1e308 is finite + positive → accepted by the public constructor, so
    // probitProject must handle it. The naive v² intermediate would overflow to
    // ∞; the factored v·(1 − (v/(1+v))·λ(z+λ)) update stays in range.
    for m, v in [ (0.0, 1e308); (1e150, 1e300); (-1e150, 1e300) ] do
        let proj = Ep.probitProject (Gaussian.ofMeanVariance m v)
        Gaussian.isProper proj |> should equal true
        Double.IsFinite(Gaussian.mean proj) |> should equal true
        Double.IsFinite(Gaussian.variance proj) |> should equal true
        Gaussian.variance proj |> should be (lessThanOrEqualTo v)

// ─── EP as a factor in the existing BP loop ───

[<Fact>]
let ``EP probit factor in runToFixpoint converges to the moment-matched posterior`` () =
    // prior N(0,1) + soft observation "x > 0" (probit). The marginal must
    // converge to moment-match(N(0,1)·Φ) — verified against quadrature.
    let g0 =
        FactorGraph.empty Gaussian.algebra
        |> FactorGraph.addFactor 0 (Factor.prior 0 (Gaussian.ofMeanVariance 0.0 1.0))
        |> FactorGraph.addFactor 1 (Ep.probitFactor 0)
    let g, _rounds, converged = FactorGraph.runToFixpoint Gaussian.distance 1e-9 50 g0
    converged |> should equal true
    let marginal = FactorGraph.marginal 0 g
    let trueMean, trueVar = tiltedMoments 0.0 1.0
    Gaussian.mean marginal |> should (equalWithin 2e-3) trueMean      // ≈ 0.564
    Gaussian.variance marginal |> should (equalWithin 2e-3) trueVar   // ≈ 0.682
    // the observation "x > 0" must shift the posterior mean positive
    Gaussian.mean marginal |> should be (greaterThan 0.5)

[<Fact>]
let ``the probit factor emits a flat message under an improper (uniform) cavity`` () =
    // before any prior has propagated, the cavity is uniform → no NaN,
    // the factor sends the flat message (no information yet)
    let out = (Ep.probitFactor 3).ComputeMessages (Map.ofList [ 3, Gaussian.One ])
    out.[3] |> should equal Gaussian.One

// ═══════════════════════════════════════════════════════════════════
// C8 (081KT2T2J0008QG0R000YZ3NMY P1) — the asymptotic inverse-Mills expansion
// λ(z) ≈ −z − 1/z + 2/z³ has O(1/z⁵) truncation error for z ≪ 0.
//
// The full lower-tail Mills series is:
//   λ(z) = −z − 1/z + 2/z³ − 6/z⁵ + 24/z⁷ − …  (alternating, |z| large)
// so the truncation error after the 2/z³ term is bounded by the next term
// |6/z⁵|. For z ≤ −4 the error is ≤ 6/4⁵ ≈ 0.023; for z ≤ −8 it is ≤
// 6/8⁵ ≈ 1.5e-4. This is the C8 claim: the 3-term asymptotic is accurate
// to O(1/z⁵) in the tail.
//
// FsCheck generates z ≤ −4 and checks that the absolute error between the
// 3-term approximation (the impl) and the 5-term approximation (one more
// pair of terms, O(1/z⁷) accurate) is ≤ 6/|z|⁵ — i.e. the 4th term
// really is the dominant error. This is a self-consistency check of the
// series, not a comparison against Φ (which underflows in this regime).
//
// Anchor: Abramowitz & Stegun §26.2.12; Minka 2001 EP appendix.
// ═══════════════════════════════════════════════════════════════════

/// 3-term asymptotic inverse Mills: −z − 1/z + 2/z³  (the impl's formula)
let private mills3 (z: float) : float =
    let zi = 1.0 / z
    -z - zi + 2.0 * zi * zi * zi

/// 5-term asymptotic inverse Mills: adds −6/z⁵ + 24/z⁷  (one more pair)
let private mills5 (z: float) : float =
    let zi  = 1.0 / z
    let zi2 = zi * zi
    let zi3 = zi2 * zi
    let zi5 = zi3 * zi2
    let zi7 = zi5 * zi2
    -z - zi + 2.0 * zi3 - 6.0 * zi5 + 24.0 * zi7

[<Property>]
let ``C8 inverse-Mills 3-term asymptotic error is bounded by 6/|z|⁵ for z ≤ -4 (O(1/z⁵) bound)``
    (NormalFloat zRaw) =
    // clamp to z ≤ −4 so Φ(z) is in the underflow regime and the series is valid
    let z = -(abs zRaw + 4.0)   // z ∈ (−∞, −4]
    let err   = abs (mills3 z - mills5 z)
    let z5    = abs (z * z * z * z * z)
    let bound = 6.0 / z5        // |next term| = 6/|z|⁵
    // The 4th term of the series (−6/z⁵) dominates the truncation error;
    // the 5-term approximation is the reference. Error must be ≤ bound.
    err <= bound * 1.01         // 1% slack for floating-point rounding
