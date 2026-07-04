namespace Zeta.Bayesian

/// # Expectation Propagation (081KT2T2J0008QG0R000S7GHQ8 slice 5)
///
/// EP handles **non-conjugate** factors — where the true factor `f(x)`
/// isn't in the exponential family, so the exact message isn't either.
/// EP approximates it by **moment matching**: for a factor,
///
///   1. **cavity** — `q_cav = marginal / f_message` (the belief *without*
///      this factor). In the factor graph the incoming variable→factor
///      message **is** the cavity (it's the product of every *other*
///      factor — the sum-product variable rule, slice 3).
///   2. **tilt** — `q_tilt ∝ q_cav · f(x)` (cavity × the true factor;
///      generally not exp-family).
///   3. **project** — `q_new = moment-match(q_tilt)` back to the exp-family
///      (match mean + variance, for Gaussian).
///   4. **divide** — the new factor→var message = `q_new / q_cav`.
///
/// The key structural fact: **EP is not a new engine — it is a new FACTOR
/// TYPE.** An EP factor's `ComputeMessages` does cavity→tilt→project→divide;
/// the existing `FactorGraph.runToFixpoint` (slice 4) drives it. On a tree
/// with conjugate factors EP = exact BP; with a non-conjugate factor it is
/// the moment-matched approximation.
///
/// Spec (clean-room, papers with proofs): Minka 2001 (EP); Rasmussen &
/// Williams *GPML* §3.6 eq 3.58 (the probit site). The probit moment-match
/// is cross-checked against numerical quadrature in the tests.

/// Standard normal pdf/cdf (the probit site needs Φ; .NET has no built-in
/// erf, so erf is the Abramowitz–Stegun 7.1.26 rational approximation,
/// max abs error ≈ 1.5e-7).
[<RequireQualifiedAccess>]
module Normal =

    /// Gauss error function via Abramowitz–Stegun 7.1.26.
    let erf (x: float) : float =
        let sign = if x < 0.0 then -1.0 else 1.0
        let ax = abs x
        let t = 1.0 / (1.0 + 0.3275911 * ax)
        let y =
            1.0
            - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592)
              * t
              * exp (-ax * ax)
        sign * y

    /// Standard normal pdf φ(x).
    let pdf (x: float) : float = exp (-0.5 * x * x) / sqrt (2.0 * System.Math.PI)

    /// Standard normal cdf Φ(x) = ½(1 + erf(x/√2)).
    let cdf (x: float) : float = 0.5 * (1.0 + erf (x / sqrt 2.0))

[<RequireQualifiedAccess>]
module Ep =

    /// Inverse Mills ratio λ(z) = φ(z)/Φ(z) — the normal hazard rate — computed
    /// stably. For z ≪ 0, Φ(z) underflows to 0 or becomes relative-inaccurate
    /// before underflow, so the naive `φ/Φ` is ∞/NaN or overlarge; there the
    /// asymptotic expansion λ(z) ≈ −z − 1/z + 2/z³ (from the lower-tail
    /// Mills series Φ(z) = φ(z)·[1/w − 1/w³ + 3/w⁵ − …], w = −z) is finite and
    /// accurate. This keeps the probit projection well-defined for arbitrarily
    /// extreme cavities (which the fixpoint loop can drift into) instead of
    /// throwing via `Gaussian.ofMeanVariance` on a non-finite moment.
    let private inverseMillsAsymptotic (z: float) : float =
        let zi = 1.0 / z
        -z - zi + 2.0 * zi * zi * zi

    let private inverseMills (z: float) : float =
        if z <= -4.0 then
            inverseMillsAsymptotic z
        else
            let phi = Normal.pdf z
            let cdf = Normal.cdf z
            let naive = phi / cdf
            if cdf > 0.0 && System.Double.IsFinite naive then naive
            else
                // z ≪ 0: Φ(z) underflowed; asymptotic hazard rate (leading 3 terms)
                inverseMillsAsymptotic z

    /// The probit site projection: given a cavity Gaussian, return the
    /// Gaussian that moment-matches `cavity · Φ(x)` (the tilted
    /// distribution). GPML eq 3.58: with cavity `N(m, v)`,
    ///   z = m / √(1+v),  λ = φ(z)/Φ(z)  (inverse Mills ratio),
    ///   m̂ = m + vλ/√(1+v),  v̂ = v − v²λ(z+λ)/(1+v).
    let probitProject (cavity: Gaussian) : Gaussian =
        let m = Gaussian.mean cavity
        let v = Gaussian.variance cavity
        let s = sqrt (1.0 + v)
        let z = m / s
        let lambda = inverseMills z
        let mHat = m + v * lambda / s
        // v̂ = v − v²λ(z+λ)/(1+v) factored as v·(1 − (v/(1+v))·λ(z+λ)): the
        // v/(1+v) factor stays ≤ 1, so a very broad but valid cavity (e.g.
        // v = 1e308, accepted by the public constructor) doesn't overflow the
        // v² intermediate to ∞ before the divide. Algebraically identical.
        let vHat = v * (1.0 - (v / (1.0 + v)) * lambda * (z + lambda))
        Gaussian.ofMeanVariance mHat vHat

    /// The HARD-truncation site projection: moment-match `cavity · 1[x > 0]` (the truncated
    /// Gaussian — the step-function likelihood, NOT the soft probit Φ(x) above). Same Mills-ratio
    /// machinery with z = m/√v (no +1 in the denominator: there is no probit noise unit).
    /// For cavity N(0,1): mean = √(2/π) ≈ 0.7979, variance = 1 − 2/π ≈ 0.3634 — the half-normal.
    /// (Found BY the hexagonal port's theirs-tests-ours: Infer.NET's ConstrainPositive is THIS
    /// semantic; our adapter had bound the soft probit to the port's hard-truncation name and the
    /// senior oracle caught the mismatch — both formulas correct, wrong binding. 2026-06-13.)
    let truncatePositiveProject (cavity: Gaussian) : Gaussian =
        let m = Gaussian.mean cavity
        let v = Gaussian.variance cavity
        let s = sqrt v
        let z = m / s
        let lambda = inverseMills z
        let mHat = m + s * lambda
        let vHat = v * (1.0 - lambda * (z + lambda))
        Gaussian.ofMeanVariance mHat vHat

    /// A **hard positivity EP factor** — the observation "x > 0" as a step function (the
    /// truncated-Gaussian semantic; `universal/port`'s PositivityConstraint binds HERE).
    let positivityFactor (variable: int) : Factor<Gaussian> =
        { Neighbors = [ variable ]
          ComputeMessages =
            fun incoming ->
                match Map.tryFind variable incoming with
                | Some cavity when Gaussian.isProper cavity ->
                    let projected = truncatePositiveProject cavity
                    Map.ofList [ variable, Gaussian.divide projected cavity ]
                | _ -> Map.ofList [ variable, Gaussian.One ] }

    /// A **probit EP factor** on a single Gaussian variable — the soft
    /// observation "x > 0" (likelihood Φ(x)). Plugs into `FactorGraph`;
    /// drive with `FactorGraph.runToFixpoint`. Its outgoing message is
    /// `project(cavity · Φ) / cavity`; when the cavity is improper/uniform
    /// (e.g. before the prior has propagated) it sends `uniform` (no
    /// information yet) rather than NaN.
    let probitFactor (variable: int) : Factor<Gaussian> =
        { Neighbors = [ variable ]
          ComputeMessages =
            fun incoming ->
                match Map.tryFind variable incoming with
                | Some cavity when Gaussian.isProper cavity ->
                    let projected = probitProject cavity
                    Map.ofList [ variable, Gaussian.divide projected cavity ]
                | _ ->
                    // no proper cavity yet → emit the flat message
                    Map.ofList [ variable, Gaussian.One ] }
