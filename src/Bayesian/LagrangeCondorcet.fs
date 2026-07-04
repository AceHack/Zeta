namespace Zeta.Bayesian

/// **LagrangeCondorcet — Cross-domain identification of the Lagrange stability threshold
/// with the Condorcet effective jury size.**
///
/// ## The Key Result
///
/// The Lagrange L4/L5 stability threshold μ_crit ≈ 0.03852 (the mass ratio below which
/// the restricted 3-body problem is stable) defines a natural jury size in the
/// information-theoretic Condorcet domain:
///
///   N_eff(ρ = μ_crit) → 1/μ_crit ≈ 25.96 ≈ 26 as N → ∞
///
/// where N_eff = N / (1 + (N-1)*ρ) is the effective jury size under correlation ρ.
///
/// ## What This Means
///
/// The Lagrange threshold μ_crit is NOT the same number as the Condorcet threshold ρ*.
/// (ρ* → 1/3 as N → ∞, while μ_crit ≈ 0.0385 ≈ 1/26.)
///
/// But they are related by the effective-N formula:
///   - At ρ = μ_crit, the effective jury size is N_eff → 1/μ_crit ≈ 26
///   - The Lagrange stability condition "μ < 1/26" translates to:
///     "the effective jury size must be > 26 for the 3-body equilibrium to be stable"
///   - This is the information-theoretic analog of the Lagrange mass-ratio threshold:
///     the "mass" of the lighter body corresponds to the correlation ρ,
///     and the stability condition is ρ < 1/N_eff_min where N_eff_min ≈ 26.
///
/// ## The Formal Statement
///
/// **Theorem (Lagrange-Condorcet correspondence):**
/// Let μ_crit = (1 - √(23/27)) / 2 ≈ 0.03852 be the Lagrange L4/L5 stability threshold.
/// Let N_eff(N, ρ) = N / (1 + (N-1)*ρ) be the Condorcet effective jury size.
/// Then:
///   lim_{N→∞} N_eff(N, μ_crit) = 1/μ_crit ≈ 25.96
///
/// The Lagrange threshold defines the effective jury size at which the 3-body equilibrium
/// transitions from stable (N_eff > 1/μ_crit) to unstable (N_eff < 1/μ_crit).
///
/// ## Caveats (for the formal analysis team)
///
/// 1. This is a NUMERICAL observation, not a formal proof of equivalence.
/// 2. The two domains (gravitational 3-body vs information-theoretic Condorcet) have
///    different stability mechanisms. The correspondence may be coincidental.
/// 3. The "effective jury size" interpretation of μ_crit requires justification:
///    why should the gravitational mass ratio correspond to the information-theoretic
///    correlation coefficient?
/// 4. The ρ* → 1/3 limit (Condorcet) and μ_crit ≈ 1/26 (Lagrange) are different numbers.
///    The correspondence is via the effective-N formula, not a direct equality.
///
/// ## CLOSURE (Soraya audit, 2026-07-04): coincidental — and provably so
///
/// No quantity the Condorcet effective-N machinery produces can EVER equal μ_crit exactly:
/// `N_eff(N, ρ) = N / (1 + (N−1)ρ)` is a Möbius (rational) map, so every threshold generated from
/// rational inputs (N ∈ ℕ, N_eff ≥ 3, rational competence bounds) is RATIONAL — while Routh's
/// `μ_crit = (1 − √(23/27)) / 2` is IRRATIONAL (621 = 3³·23 is not a perfect square). Cross-checks:
/// 23 ∤ 1344 and 27 ∤ 1344 (the [8,4] Aut order is 2⁶·3·7 — no shared structure); ρ*(N) = μ_crit
/// solves to N ≈ 3.26 (non-integer); Routh's 27 comes from the quartic Jacobi-linearization
/// discriminant, and nothing in the Condorcet machinery is quartic. Analogy confirmed, theorem denied.
[<RequireQualifiedAccess>]
module LagrangeCondorcet =

    // ── Constants ────────────────────────────────────────────────────────────────────────────────

    /// The Lagrange L4/L5 stability threshold: μ_crit = (1 - √(23/27)) / 2 ≈ 0.03852.
    /// The restricted 3-body problem is stable iff the mass ratio μ = m2/(m1+m2) < μ_crit.
    let lagrangeMuCrit : float = (1.0 - sqrt(23.0 / 27.0)) / 2.0

    /// The reciprocal of the Lagrange threshold: 1/μ_crit ≈ 25.96.
    /// This is the "Lagrange jury size" — the effective jury size at the stability boundary.
    let lagrangeJurySize : float = 1.0 / lagrangeMuCrit

    /// The Condorcet ρ* limit as N → ∞: ρ* → 1/3.
    /// This is the correlation threshold above which the ensemble cannot beat the best individual,
    /// regardless of individual competence.
    let condorcetRhoStarLimit : float = 1.0 / 3.0

    // ── Effective jury size ───────────────────────────────────────────────────────────────────────

    /// The effective jury size under correlation ρ:
    /// N_eff(N, ρ) = N / (1 + (N-1)*ρ).
    /// This is the number of independent voters equivalent to N correlated voters.
    let effectiveJurySize (n: int) (rho: float) : float =
        float n / (1.0 + float (n - 1) * rho)

    /// The effective jury size at the Lagrange threshold as N → ∞:
    /// lim_{N→∞} N_eff(N, μ_crit) = 1/μ_crit ≈ 25.96.
    let effectiveJurySizeAtLagrange (n: int) : float =
        effectiveJurySize n lagrangeMuCrit

    // ── The correspondence ────────────────────────────────────────────────────────────────────────

    /// The Lagrange-Condorcet correspondence:
    /// The Lagrange threshold μ_crit defines the effective jury size at the stability boundary.
    /// An ensemble with N voters and correlation ρ is in the "Lagrange stable zone" iff
    /// its effective jury size N_eff > lagrangeJurySize ≈ 26.
    let isLagrangeStable (n: int) (rho: float) : bool =
        effectiveJurySize n rho > lagrangeJurySize

    /// The Lagrange stability gap: how far the effective jury size is from the Lagrange threshold.
    /// Positive = stable (N_eff > 26), negative = unstable (N_eff < 26).
    let lagrangeStabilityGap (n: int) (rho: float) : float =
        effectiveJurySize n rho - lagrangeJurySize

    /// The minimum N required for the ensemble to be Lagrange-stable at correlation ρ.
    /// Solve N_eff(N, ρ) > 1/μ_crit for N:
    ///   N / (1 + (N-1)*ρ) > 1/μ_crit
    ///   N * μ_crit > 1 + (N-1)*ρ
    ///   N * (μ_crit - ρ) > 1 - ρ
    ///   N > (1 - ρ) / (μ_crit - ρ)   [valid only when ρ < μ_crit]
    let minNForLagrangeStability (rho: float) : int option =
        if rho >= lagrangeMuCrit then None  // Never stable (ρ too high)
        else
            let nMin = (1.0 - rho) / (lagrangeMuCrit - rho)
            Some (int (ceil nMin))

    // ── The Condorcet ρ* limit ────────────────────────────────────────────────────────────────────

    /// The Condorcet ρ* threshold for a given N:
    /// The correlation above which the ensemble cannot beat the best individual.
    /// ρ*(N) = (N - 1) / (N * (N - 1)) * (N - 1) / 1 ... actually derived from:
    /// majority probability P(N, c, ρ) > c iff N_eff > 1 (need more than 1 effective voter)
    /// N_eff > 1 iff N / (1 + (N-1)*ρ) > 1 iff ρ < (N-1)/N/(N-1) = 1/N ... wait
    /// Actually: N_eff > 1 iff 1 + (N-1)*ρ < N iff ρ < (N-1)/(N-1) = 1... always true.
    /// The correct threshold is where N_eff = 3 (minimum meaningful majority):
    /// N_eff = 3 iff ρ = (N - 3) / (3 * (N - 1))
    /// As N → ∞: ρ* → 1/3.
    let condorcetRhoStar (n: int) : float =
        if n <= 3 then 0.0
        else float (n - 3) / (3.0 * float (n - 1))

    // ── Summary ──────────────────────────────────────────────────────────────────────────────────

    type CorrespondenceSummary =
        { /// The Lagrange μ_crit ≈ 0.03852.
          LagrangeMuCrit: float
          /// The Lagrange jury size 1/μ_crit ≈ 25.96.
          LagrangeJurySize: float
          /// The Condorcet ρ* limit as N → ∞: 1/3 ≈ 0.333.
          CondorcetRhoStarLimit: float
          /// The effective jury size at ρ = μ_crit for large N (should approach 25.96).
          EffectiveJurySizeAtLagrangeN10001: float
          /// The gap between the Lagrange jury size and the effective jury size at ρ = μ_crit.
          LagrangeJurySizeGap: float
          /// Whether N_eff(N→∞, μ_crit) ≈ 1/μ_crit numerically. CAUTION (Soraya 2026-07-04): this
          /// confirms only that a Möbius map converges to its own asymptote — `lim N_eff(N, μ) = 1/μ`
          /// is an identity for ANY μ, so `true` here is NOT evidence of a Lagrange↔Condorcet
          /// correspondence (see the CLOSURE section in the module header: coincidental, provably).
          CorrespondenceHolds: bool }

    let computeSummary () : CorrespondenceSummary =
        let nEff = effectiveJurySizeAtLagrange 10001
        let gap = abs (nEff - lagrangeJurySize)
        { LagrangeMuCrit = lagrangeMuCrit
          LagrangeJurySize = lagrangeJurySize
          CondorcetRhoStarLimit = condorcetRhoStarLimit
          EffectiveJurySizeAtLagrangeN10001 = nEff
          LagrangeJurySizeGap = gap
          CorrespondenceHolds = gap < 0.1 }  // Within 0.1 of 25.96
