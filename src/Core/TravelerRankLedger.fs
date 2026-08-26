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

    // ── Dynamics factor (staleness) ────────────────────────────────────────────────────────────────
    //
    // WHAT WAS MISSING, AND WHY IT MATTERS BEYOND THIS MODULE.
    //
    // `update` above concentrates: its own docstring states that "σ² is strictly decreasing with
    // each observation", and a falsifier pins that. Nothing widened it again. So a belief built
    // from observations that stopped arriving became **permanently confident**: a traveler who
    // performed well and then went silent stayed maximally trusted forever, and no amount of
    // elapsed time could move them. That is a real defect in a ledger meant to be long-lived,
    // and it is the reason TrueSkill carries a dynamics factor at all (Herbrich et al. 2006 §2,
    // the τ term) — a rating is a belief about a moving quantity, and beliefs about moving
    // quantities must lose confidence when unobserved.
    //
    // THE GENERAL POINT, which is why this lives here rather than at one call site:
    //
    //     Decay multiplies the ESTIMATE toward the prior.   value <- value * k
    //     Dynamics widens the UNCERTAINTY.                  σ²    <- σ² + τ²·Δt
    //
    // They are not two spellings of the same idea. Decay says the world reverted; dynamics says
    // *I stopped watching*. Only the second is true of an unobserved quantity, and only the
    // second preserves the DIRECTION of old evidence — μ is untouched, so a fresh observation
    // still lands against what was learned before rather than against a value that has been
    // quietly dragged toward neutral. Under decay, enough silence erases a bad record; under
    // dynamics, silence makes it uncertain, and one confirming observation brings it straight
    // back.
    //
    // ON THE FREE PARAMETER, honestly. This does NOT eliminate the constant — τ is still chosen.
    // What it does is move the constant somewhere it can be argued about: τ carries units
    // (skill-σ per unit time) and answers a question about the world ("how fast can this
    // quantity actually change?"), whereas a bare multiplier answers nothing and can only be
    // tuned until the output looks right. `ticksUntilUninformative` below exists so a chosen τ
    // can be CHECKED against what it implies, rather than asserted.

    /// Inflate a belief's uncertainty for `elapsed` units of time with no observation.
    ///
    ///     σ² ← σ² + τ²·Δt        (μ unchanged — this is the whole distinction from decay)
    ///
    /// `tau` is the per-unit-time drift of the latent quantity. It is an explicit argument
    /// rather than a module constant on purpose: a hidden default here would be exactly the
    /// unjustifiable magic number this function exists to replace.
    ///
    /// Returns the belief unchanged for `elapsed = 0`. Refuses negative `elapsed` or `tau`
    /// (`Error`) rather than silently sharpening the belief, which is what a negative value
    /// would do — uncertainty running backwards is not a staleness model.
    let age (tau: float) (elapsed: float) (b: SkillBelief) : Result<SkillBelief, string> =
        if System.Double.IsNaN tau || System.Double.IsNaN elapsed then
            Error "age: tau and elapsed must be numbers"
        elif tau < 0.0 then Error $"age: tau must be non-negative, got {tau}"
        elif elapsed < 0.0 then Error $"age: elapsed must be non-negative, got {elapsed}"
        else Ok { b with Sigma2 = b.Sigma2 + tau * tau * elapsed }

    /// How long until this belief carries essentially no opinion — `trustBand` within `epsilon`
    /// of 0.5 — given a drift of `tau`.
    ///
    /// This is the READOUT that makes `tau` auditable. Choosing τ directly is guessing; choosing
    /// it and then asking "so how many ticks until a confident belief goes neutral?" is a claim
    /// somebody can disagree with. Solves the same algebra `trustBand` uses:
    ///
    ///     Φ(μ / √(σ² + τ²·Δt + β²)) = 0.5 + ε   ⇒   Δt = ((μ/z)² − σ² − β²) / τ²
    ///
    /// where `z = Φ⁻¹(0.5 + ε)`. Returns `Ok 0.0` when the belief is already that uninformative,
    /// and `Error` when it never gets there (`tau = 0`), because "never" is a fact the caller
    /// must handle rather than a large number it might treat as a duration.
    let ticksUntilUninformative
        (tau: float)
        (epsilon: float)
        (b: SkillBelief)
        : Result<float, string> =
        if epsilon <= 0.0 || epsilon >= 0.5 then
            Error $"ticksUntilUninformative: epsilon must be in (0, 0.5), got {epsilon}"
        elif tau < 0.0 then Error $"ticksUntilUninformative: tau must be non-negative, got {tau}"
        else
            let current = abs (trustBand b - 0.5)
            if current <= epsilon then Ok 0.0
            elif tau = 0.0 then
                Error "ticksUntilUninformative: tau = 0 — this belief never becomes uninformative"
            else
                // Invert Φ by bisection on the monotone map Δt ↦ |trustBand(aged) − 0.5|.
                // Bisection rather than a Φ⁻¹ approximation so the answer is consistent with
                // THIS module's `bigPhi` rather than with a second, differently-approximated one.
                let bandAfter (dt: float) =
                    abs (trustBand { b with Sigma2 = b.Sigma2 + tau * tau * dt } - 0.5)
                let mutable hi = 1.0
                let mutable guard = 0
                while bandAfter hi > epsilon && guard < 200 do
                    hi <- hi * 2.0
                    guard <- guard + 1
                if guard >= 200 then
                    Error "ticksUntilUninformative: no finite horizon found (numerical limit)"
                else
                    let mutable lo = 0.0
                    for _ in 1..80 do
                        let mid = 0.5 * (lo + hi)
                        if bandAfter mid > epsilon then lo <- mid else hi <- mid
                    Ok hi

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
