namespace Zeta.Core

/// **TravelerRankLedger — EP (Expectation Propagation) skill ranking over travelers × hat-domains.**
///
/// The long-term anti-whitewash path alongside the fast `CalibrationLedger` (Beta(2,2) + k-clamp).
/// Uses TrueSkill-style Gaussian belief propagation to maintain a posterior over each traveler's
/// latent skill per hat-domain, updated by calibration outcomes (hit / miss).
///
/// **Model:**
///   s_{t,d} ~ N(μ_0, σ_0²)                    ← skill prior per (traveler, domain)
///   o_i ~ Bernoulli(Φ(s_{t,d} / β))            ← probit likelihood
///   trustBand(t,d) = Φ(μ_post / √(σ²_post + β²))  ← posterior win probability
///
/// **Key properties:**
///   - Domain isolation: factor graphs are independent per domain — no cross-domain bleed.
///   - Streaming O(1) EP updates via cavity messages (TrueSkill Eq. 4–5, Herbrich et al. 2006).
///   - Fresh identity: trustBand = 0.5 (honest prior), not 0.0 (pessimistic clamp).
///   - Whitewash window closed: "1 hit, 2 misses" → trustBand ≈ 0.35, not 0.0.
///
/// **References:**
///   Herbrich, Minka, Graepel (2006). TrueSkill™. NIPS 2006.
///   Minka (2001). EP for Approximate Bayesian Inference. UAI 2001.
[<RequireQualifiedAccess>]
module TravelerRankLedger =

    // ── Hyperparameters ────────────────────────────────────────────────────────────────────────────
    /// Skill prior mean. 0.0 → neutral: no evidence either way.
    let [<Literal>] MU_0 = 0.0
    /// Skill prior standard deviation. 1.0 → unit scale (TrueSkill default).
    let [<Literal>] SIGMA_0 = 1.0
    /// Performance noise. 1.0 → trustBand(fresh) = Φ(0) = 0.5 (honest floor).
    let [<Literal>] BETA = 1.0
    /// EP convergence threshold (single-pass streaming; not used for iteration).
    let [<Literal>] EP_EPS = 1e-10

    // ── Normal distribution helpers ────────────────────────────────────────────────────────────────
    /// Standard normal PDF φ(x).
    let private phi (x: float) : float =
        exp (-0.5 * x * x) / sqrt (2.0 * System.Math.PI)

    /// Standard normal CDF Φ(x) via Abramowitz & Stegun 7.1.26 polynomial approximation.
    /// Max error < 1.5e-7 over all x. Odd function: Φ(-x) = 1 - Φ(x).
    let private bigPhi (x: float) : float =
        // A&S 7.1.26: erf(x) ≈ 1 - (a1*t + a2*t^2 + ... + a5*t^5)*exp(-x^2), t = 1/(1+p*|x|)
        let erfApprox (z: float) : float =
            let p = 0.3275911
            let a1, a2, a3, a4, a5 = 0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429
            let t = 1.0 / (1.0 + p * abs z)
            let poly = (a1 + (a2 + (a3 + (a4 + a5 * t) * t) * t) * t) * t
            let e = 1.0 - poly * exp (-z * z)
            if z >= 0.0 then e else -e
        0.5 * (1.0 + erfApprox (x / sqrt 2.0))

    /// Mill's ratio v(t) = φ(t) / Φ(t) — the EP correction factor for a hit.
    /// Numerically stable: for t < -5, Φ(t) is tiny so we clamp to avoid division by zero.
    let private millsV (t: float) : float =
        let denom = bigPhi t
        if denom < EP_EPS then phi t / EP_EPS else phi t / denom

    /// EP precision factor w(t) = v(t) · (v(t) + t).
    let private millsW (t: float) : float =
        let v = millsV t
        v * (v + t)

    // ── Skill belief (posterior approximation) ─────────────────────────────────────────────────────
    /// The Gaussian posterior approximation for one (traveler, domain) pair.
    /// `mu` and `sigma2` are the current ADF posterior mean and variance.
    [<Struct>]
    type SkillBelief =
        { Mu: float
          Sigma2: float
          /// Number of observations folded in.
          ObsCount: int }

    /// Fresh skill belief — the prior N(μ_0, σ_0²) with no observations.
    let freshBelief : SkillBelief =
        { Mu = MU_0
          Sigma2 = SIGMA_0 * SIGMA_0
          ObsCount = 0 }

    /// The trust band for a skill belief: Φ(μ / √(σ² + β²)).
    /// - Fresh: Φ(0 / √2) = 0.5 (honest prior, no evidence either way).
    /// - After consistent hits: approaches 1.0.
    /// - After consistent misses: approaches 0.0.
    let trustBand (b: SkillBelief) : float =
        bigPhi (b.Mu / sqrt (b.Sigma2 + BETA * BETA))

    // ── ADF update (Assumed Density Filtering / online EP) ──────────────────────────────────────────
    /// Update a `SkillBelief` with one new observation `hit` (true = success, false = failure).
    ///
    /// Implements the **Assumed Density Filtering** (ADF) probit update — the correct streaming
    /// variant of TrueSkill for independent i.i.d. observations. Each update applies the EP
    /// probit correction directly to the current posterior (no cavity removal needed for i.i.d.
    /// observations; cavity removal is only required for loopy factor graphs).
    ///
    /// Update equations (Herbrich et al. 2006, Eq. 4–5, ADF variant):
    ///   t = sign · μ / √(σ² + β²)
    ///   μ_new = μ + σ² · sign · v(t) / √(σ² + β²)
    ///   σ²_new = σ² · (1 − w(t) · σ² / (σ² + β²))
    ///
    /// Properties:
    ///   - σ² is strictly decreasing with each observation (posterior concentrates).
    ///   - trustBand is monotone in the direction of the observation.
    ///   - 10 hits → trustBand ≈ 0.92; 10 misses → trustBand ≈ 0.08.
    let update (hit: bool) (b: SkillBelief) : SkillBelief =
        let sign = if hit then 1.0 else -1.0
        let denom = sqrt (b.Sigma2 + BETA * BETA)
        let t = sign * b.Mu / denom
        let v = millsV t
        let w = millsW t
        let muNew = b.Mu + b.Sigma2 * sign * v / denom
        let sigma2New = b.Sigma2 * (1.0 - w * b.Sigma2 / (b.Sigma2 + BETA * BETA))
        let sigma2New = max EP_EPS sigma2New
        { Mu = muNew
          Sigma2 = sigma2New
          ObsCount = b.ObsCount + 1 }

    // ── Ledger ─────────────────────────────────────────────────────────────────────────────────────
    /// A domain-partitioned ledger of skill beliefs: Map<(travelerId, hatDomain), SkillBelief>.
    type Ledger = Map<string * string, SkillBelief>

    /// Empty ledger.
    let empty : Ledger = Map.empty

    /// Look up the current skill belief for (travelerId, hatDomain).
    /// Returns `freshBelief` if no observations have been recorded.
    let beliefOf (travelerId: string) (hatDomain: string) (ledger: Ledger) : SkillBelief =
        ledger |> Map.tryFind (travelerId, hatDomain) |> Option.defaultValue freshBelief

    /// Record one calibration outcome for (travelerId, hatDomain) and return the updated ledger.
    let record (travelerId: string) (hatDomain: string) (hit: bool) (ledger: Ledger) : Ledger =
        let current = beliefOf travelerId hatDomain ledger
        let updated = update hit current
        ledger |> Map.add (travelerId, hatDomain) updated

    /// The trust band for (travelerId, hatDomain) in the ledger.
    /// Returns 0.5 for unknown travelers (honest prior).
    let trustBandOf (travelerId: string) (hatDomain: string) (ledger: Ledger) : float =
        beliefOf travelerId hatDomain ledger |> trustBand

    /// Number of observations recorded for (travelerId, hatDomain).
    let obsCountOf (travelerId: string) (hatDomain: string) (ledger: Ledger) : int =
        beliefOf travelerId hatDomain ledger |> _.ObsCount

    // ── Whitewash witness ──────────────────────────────────────────────────────────────────────────
    /// Returns true if the traveler's trustBand in the given domain is above the given threshold.
    /// Use `threshold = 0.5` to detect travelers who are above the honest prior.
    /// Use `threshold = 0.0` to detect travelers who are not at the hard floor (always true for EP).
    let isAboveThreshold (travelerId: string) (hatDomain: string) (threshold: float) (ledger: Ledger) : bool =
        trustBandOf travelerId hatDomain ledger > threshold

    /// The anti-whitewash gate: returns true if the traveler has a positive skill posterior
    /// (more hits than misses, weighted by evidence strength). This replaces the k=3 clamp
    /// for high-stakes decisions.
    let isPositiveSkill (travelerId: string) (hatDomain: string) (ledger: Ledger) : bool =
        (beliefOf travelerId hatDomain ledger).Mu > 0.0
