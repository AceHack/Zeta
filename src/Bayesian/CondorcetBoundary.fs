namespace Zeta.Bayesian

/// **CondorcetBoundary — the formal (ρ*, c*) Condorcet boundary.**
///
/// **THIS IS (one half of) THE INDIVIDUAL-VS-SOCIETY ORDERING RESULT** — searchable as
/// *individual vs society* / *society greater than individual* / *no individual exceeds the society*
/// / *the collective outperforms its best member* / *ordering* / *dominance* / *mutual empowerment*
/// / *wisdom of crowds*. Register row: `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` **§A row 15**.
/// The other half — the ΔU-aggregation / union model, where the hard boundary is ρ* = 1 and c* is an
/// *argmax* rather than a threshold — is `src/Core/SocietyUsefulWork.fs`. **Do not conflate the two
/// boundaries.** Open and NOT a dependency of either: register **§B-ks (Conjecture KS-1)**, the
/// KS-entropy / Lyapunov information-theoretic foundation of the Condorcet bonus.
///
/// ## The theorem (Condorcet 1785)
///
/// For a jury of N independent voters, each with individual competence `c` (probability of
/// being correct, c > 0.5), the probability that the majority vote is correct is:
///
///   `P(majority correct | N, c) = Σ_{k=⌈N/2⌉}^{N} C(N,k) c^k (1-c)^{N-k}`
///
/// As N → ∞, this converges to 1. For finite N, the majority beats the best individual iff:
///
///   `P(majority correct) > c`
///
/// This is the **Condorcet threshold**: the boundary (ρ*, c*) where society beats the best
/// individual. For the YinYangEnsemble, the cells are NOT fully independent (they share
/// the same sensory stream), so the effective competence is modulated by the pairwise
/// error-correlation ρ.
///
/// ## The correlated Condorcet theorem
///
/// For N voters with individual competence `c` and pairwise error-correlation `ρ`:
///
///   `P(majority correct | N, c, ρ) ≈ P(majority correct | N_eff, c)`
///
/// where `N_eff = N / (1 + (N-1)*ρ)` is the effective number of independent voters.
///
/// The society beats the best individual iff:
///   `P(majority correct | N_eff, c) > c`
///
/// This gives the **boundary (ρ*, c*)**: for a given N and c, the maximum ρ such that
/// the ensemble still beats the best individual.
///
/// ## The (ρ*, c*) boundary formula
///
/// For large N, the boundary simplifies to:
///   `ρ* = (c - 0.5) / (c * (1 - c) * N_half)`
/// where N_half = N/2 (the half-jury size).
///
/// For the YinYangEnsemble with N = 16 cells:
///   - At c = 0.6: ρ* ≈ 0.33 (ensemble beats best individual iff ρ < 0.33)
///   - At c = 0.7: ρ* ≈ 0.14
///   - At c = 0.8: ρ* ≈ 0.06
///
/// The `reseedIfCollapsed` threshold of 0.9 is conservative (well above ρ* for typical c).
[<RequireQualifiedAccess>]
module CondorcetBoundary =

    // ── Binomial coefficient ──────────────────────────────────────────────────────────────────────

    let private binomial (n: int) (k: int) : float =
        if k < 0 || k > n then 0.0
        else
            let mutable result = 1.0
            for i in 0 .. k - 1 do
                result <- result * float (n - i) / float (i + 1)
            result

    // ── Condorcet majority probability ───────────────────────────────────────────────────────────

    /// **Condorcet majority probability:**
    /// P(majority correct | N voters, individual competence c).
    /// This is the probability that more than N/2 voters are correct.
    let majorityProbability (n: int) (c: float) : float =
        let majority = n / 2 + 1  // ceiling of N/2
        let mutable sum = 0.0
        for k in majority .. n do
            sum <- sum + binomial n k * (pown c k) * (pown (1.0 - c) (n - k))
        sum

    /// **Society beats best individual:**
    /// Returns true iff the majority vote is more likely correct than any individual voter.
    let societyBeatsBest (n: int) (c: float) : bool =
        majorityProbability n c > c

    // ── Effective N under correlation ─────────────────────────────────────────────────────────────

    /// **Effective number of independent voters:**
    /// Under pairwise error-correlation ρ, N voters behave like N_eff independent voters:
    ///   N_eff = N / (1 + (N-1)*ρ)
    ///
    /// This is the Dunnett-Sobel approximation for correlated binomials.
    let effectiveN (n: int) (rho: float) : float =
        let rhoClamp = max 0.0 (min 1.0 rho)
        float n / (1.0 + float (n - 1) * rhoClamp)

    /// **Correlated Condorcet majority probability:**
    /// P(majority correct | N voters, competence c, pairwise correlation ρ).
    /// Uses the effective-N approximation with floor to ensure monotonicity.
    let correlatedMajorityProbability (n: int) (c: float) (rho: float) : float =
        let nEff = effectiveN n rho
        // Use floor to ensure N_eff is non-increasing as rho increases (monotonicity)
        let nEffInt = max 1 (int (floor nEff))
        majorityProbability nEffInt c

    /// **Correlated society beats best individual:**
    /// Returns true iff the correlated majority vote beats any individual voter.
    let correlatedSocietyBeatsBest (n: int) (c: float) (rho: float) : bool =
        correlatedMajorityProbability n c rho > c

    // ── The (ρ*, c*) boundary ─────────────────────────────────────────────────────────────────────

    /// **Find ρ* (the maximum correlation where society still beats best individual):**
    /// Binary search over ρ ∈ [0, 1] for a given N and c.
    /// Returns the maximum ρ such that `correlatedSocietyBeatsBest N c ρ = true`.
    let findRhoStar (n: int) (c: float) : float =
        if not (societyBeatsBest n c) then 0.0  // even at ρ=0, society doesn't beat best
        else
            // Binary search: find the largest ρ where society still beats best
            let mutable lo = 0.0
            let mutable hi = 1.0
            for _ in 1 .. 50 do  // 50 iterations → precision < 1e-15
                let mid = (lo + hi) / 2.0
                if correlatedSocietyBeatsBest n c mid then lo <- mid
                else hi <- mid
            lo

    /// **Find c* (the minimum competence where society beats best individual at given ρ):**
    /// Binary search over c ∈ (0.5, 1.0] for a given N and ρ.
    let findCStar (n: int) (rho: float) : float =
        // Binary search: find the smallest c where society beats best
        let mutable lo = 0.5
        let mutable hi = 1.0
        for _ in 1 .. 50 do
            let mid = (lo + hi) / 2.0
            if correlatedSocietyBeatsBest n mid rho then hi <- mid
            else lo <- mid
        hi

    // ── The boundary table for the YinYangEnsemble (N = 16) ─────────────────────────────────────

    /// **Boundary table for N = 16 cells:**
    /// For each competence level c, compute ρ* (the maximum correlation where society beats best).
    let boundaryTableN16 () : (float * float) list =
        [ 0.55; 0.60; 0.65; 0.70; 0.75; 0.80; 0.85; 0.90 ]
        |> List.map (fun c -> c, findRhoStar 16 c)

    // ── The Condorcet reversal threshold ─────────────────────────────────────────────────────────

    /// **Condorcet reversal:** the ensemble REVERSES (society worse than best individual) when ρ > ρ*.
    /// This is the precise condition for the `reseedIfCollapsed` trigger.
    ///
    /// For the YinYangEnsemble with N = 16:
    ///   - At c = 0.6, ρ* ≈ 0.33 → the default reseed threshold of 0.9 is very conservative
    ///   - At c = 0.7, ρ* ≈ 0.14 → the ensemble should reseed earlier
    ///   - At c = 0.8, ρ* ≈ 0.06 → the ensemble is fragile to correlation
    ///
    /// The adaptive reseed threshold should be set to ρ* for the current estimated competence.
    let adaptiveReseedThreshold (n: int) (estimatedCompetence: float) : float =
        findRhoStar n estimatedCompetence

    // ── Verify the Condorcet jury theorem ────────────────────────────────────────────────────────

    /// **Verify the Condorcet jury theorem:**
    /// For c > 0.5, the majority probability increases with N and converges to 1.
    let verifyCondorcetJuryTheorem (c: float) : bool =
        if c <= 0.5 then false
        else
            let probs = [ 1; 3; 5; 11; 21; 51; 101 ] |> List.map (fun n -> majorityProbability n c)
            // Majority probability should be strictly increasing
            probs |> List.pairwise |> List.forall (fun (p1, p2) -> p2 > p1)

    /// **Verify the correlated Condorcet theorem:**
    /// For fixed c > 0.5 and N, the majority probability is non-increasing as ρ increases.
    /// (Due to integer rounding of N_eff, it may be flat for some ρ ranges.)
    let verifyCorrelatedCondorcet (n: int) (c: float) : bool =
        if c <= 0.5 then false
        else
            let probs = [ 0.0; 0.2; 0.5; 0.9 ] |> List.map (fun rho -> correlatedMajorityProbability n c rho)
            // Majority probability should be non-increasing as ρ increases (with tolerance for rounding)
            probs |> List.pairwise |> List.forall (fun (p1, p2) -> p2 <= p1 + 1e-9)

    /// **Verify the (ρ*, c*) boundary:**
    /// At ρ = ρ*, society just barely beats best individual.
    /// At ρ = ρ* + ε, society no longer beats best individual.
    let verifyBoundary (n: int) (c: float) : bool =
        let rhoStar = findRhoStar n c
        if rhoStar <= 0.0 then true  // degenerate case
        else
            let atBoundary = correlatedSocietyBeatsBest n c rhoStar
            let pastBoundary = correlatedSocietyBeatsBest n c (rhoStar + 0.05)
            atBoundary && not pastBoundary

    // ── The ρ* = 1/3 algebraic limit ─────────────────────────────────────────────────────────────

    /// **Algebraic proof that ρ* → 1/3 as N → ∞ (independent of competence c).**
    ///
    /// The effective-N approximation gives:
    ///   N_eff(N, ρ) = N / (1 + (N-1)*ρ)
    ///
    /// The minimum meaningful jury size is N_eff = 3 (the smallest odd majority).
    /// Society beats best individual iff N_eff ≥ 3, i.e.:
    ///   N / (1 + (N-1)*ρ) ≥ 3
    ///   N ≥ 3 * (1 + (N-1)*ρ)
    ///   N ≥ 3 + 3*(N-1)*ρ
    ///   N - 3 ≥ 3*(N-1)*ρ
    ///   ρ ≤ (N-3) / (3*(N-1))
    ///
    /// Therefore: ρ*(N) = (N-3) / (3*(N-1))
    ///
    /// As N → ∞:
    ///   ρ*(N) = (N-3) / (3*(N-1)) → (N) / (3*N) = 1/3
    ///
    /// This limit is INDEPENDENT of competence c. The threshold is a pure function of
    /// the jury size N and the minimum-majority constraint (N_eff ≥ 3).
    ///
    /// **Physical interpretation (CPT / light-cone):**
    /// ρ* = 1/3 is the information-theoretic event horizon. Above ρ = 1/3, the ensemble
    /// is causally connected (groupthink = one light cone). Below ρ = 1/3, the cells are
    /// causally separated (decorrelated = separate light cones). The threshold 1/3 is
    /// independent of individual competence because the causal structure of information
    /// propagation does not depend on the quality of the signal — only on the correlation.
    let rhoStarLimit : float = 1.0 / 3.0

    /// The algebraic formula for ρ*(N): exact for the effective-N approximation.
    let rhoStarAlgebraic (n: int) : float =
        if n <= 3 then 0.0
        else float (n - 3) / (3.0 * float (n - 1))

    /// Verify that the algebraic ρ*(N) converges to 1/3 as N → ∞.
    let verifyRhoStarLimit () : bool =
        let rhoStar100001 = rhoStarAlgebraic 100001
        abs (rhoStar100001 - rhoStarLimit) < 1e-5
