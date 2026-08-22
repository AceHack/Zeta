namespace Zeta.Core

open System

/// **SocietyUsefulWork — the delta-U aggregation theorem formalization and simulation.**
/// (Routed as workitem 081KV6B1MBM08QG0R000RZK4WY; math-team/Soraya).
///
/// **THIS IS THE INDIVIDUAL-VS-SOCIETY ORDERING RESULT.** It is indexed in the register under
/// "Condorcet", which is why searches phrased in ordering vocabulary have missed it. The aliases
/// below are written on one line each, on purpose, so a grep from either vocabulary lands:
///
/// SEARCH: individual vs society | society greater than individual | society beats the individual
/// SEARCH: no individual exceeds the society | the collective outperforms its best member
/// SEARCH: ordering | dominance | mutual empowerment | wisdom of crowds | jury theorem
/// SEARCH: KS-entropy | Kolmogorov-Sinai | Lyapunov | Pesin | Condorcet bonus
///
/// - Register row: `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` **§A row 15,
///   "Generalized Condorcet / ΔU-aggregation theorem — society > best individual"** (PROVEN,
///   2026-07-03; falsifier mutation-verified 2026-08-16).
/// - Falsifiers: `tests/Tests.FSharp/CondorcetBoundary.Tests.fs` (`Condorcet-1` … `Condorcet-8`,
///   11 properties) and `tests/Tests.FSharp/SocietyUsefulWork.Tests.fs`.
/// - Sibling model (correlated majority vote, where rho* and c* are genuine thresholds and
///   `N_eff = N/(1+(N-1)*rho) -> 1/rho`): `src/Bayesian/CondorcetBoundary.fs`.
/// - **Open, and NOT a dependency of this proof:** the information-theoretic foundation, register
///   **§B-ks (Conjecture KS-1)** — `h_KS(ISociety) >= sum of positive Lyapunov exponents` (Pesin).
///   KS-1 would *explain* why the Condorcet bonus holds; this module's theorem stands without it,
///   and falsifying KS-1 would leave it untouched.
/// - Physical mechanism driving rho toward the admissible regime: §A row 19, Delay-Decorrelation.
/// - **Metered boundary:** metered as MATHEMATICS. Whether any real fleet satisfies the regime
///   (its actual rho and c) is UNMEASURED — see the register's A-method note on row 15.
///
/// Under the society architecture, aggregate useful work is the union (idempotent reconciliation)
/// of individual agents' discoveries, measured as banked uncertainty-reduction delta-U.
///
/// This module implements:
/// 1. The analytic expected value for identical agents under pairwise correlation rho.
/// 2. A Gaussian Copula model to simulate correlated heterogeneous agents.
[<RequireQualifiedAccess>]
module SocietyUsefulWork =

    /// A piece of work (e.g. bug, fact, design detail) with its intrinsic uncertainty-reduction value.
    type Fact = { Id: int; Value: double }

    /// Rational approximation of the inverse normal CDF (probit function).
    /// Beasley-Springer-Moro algorithm. Accurate to ~1e-9.
    let probit (p: double) : double =
        if p <= 0.0 || p >= 1.0 then
            failwithf "Probit argument must be in (0, 1), got %f" p
        
        let a = [| 2.50662823884; -18.61500062529; 41.39119773534; -28.476095865405 |]
        let b = [| 1.0; -8.47351093090; 23.08336743743; -21.06224101826; 3.13082909833 |]
        let c = [| -0.322232431088; -1.0; -0.342242088547; -0.0204231210245; -0.0000453640005 |]
        let d = [| 0.0993484626060; 0.588581570495; 0.531103462366; 0.103537752850; 0.0038560700634 |]

        let y = p - 0.5
        if abs y < 0.42 then
            let r = y * y
            let num = y * (((a.[3] * r + a.[2]) * r + a.[1]) * r + a.[0])
            let den = (((b.[4] * r + b.[3]) * r + b.[2]) * r + b.[1]) * r + b.[0]
            num / den
        else
            let r = if y < 0.0 then p else 1.0 - p
            let s = sqrt (-log r)
            let num = (((c.[4] * s + c.[3]) * s + c.[2]) * s + c.[1]) * s + c.[0]
            let den = (((d.[4] * s + d.[3]) * s + d.[2]) * s + d.[1]) * s + d.[0]
            let x = num / den
            if y < 0.0 then -x else x

    /// Expected useful work of a single agent with competence c.
    /// E[U_i] = c * sum(v_j)
    let expectedIndividual (c: double) (facts: Fact[]) : double =
        let totalValue = facts |> Array.sumBy (fun f -> f.Value)
        c * totalValue

    /// Expected aggregate useful work of a society of n identical agents
    /// with pairwise correlation rho and competence c.
    /// E[U_society] = [rho * c + (1 - rho) * (1 - (1 - c)^n)] * sum(v_j)
    let expectedSocietyIdentical (n: int) (c: double) (rho: double) (facts: Fact[]) : double =
        if n < 1 then 0.0
        else
            let totalValue = facts |> Array.sumBy (fun f -> f.Value)
            let probUnion = rho * c + (1.0 - rho) * (1.0 - Math.Pow(1.0 - c, double n))
            probUnion * totalValue

    /// Analytical expected gain of society over a single agent:
    /// E[U_society] - E[U_i] = (1 - rho) * (1 - c) * (1 - (1 - c)^(n-1)) * sum(v_j)
    let expectedGain (n: int) (c: double) (rho: double) (facts: Fact[]) : double =
        if n < 2 then 0.0
        else
            let totalValue = facts |> Array.sumBy (fun f -> f.Value)
            (1.0 - rho) * (1.0 - c) * (1.0 - Math.Pow(1.0 - c, double (n - 1))) * totalValue

    // ── Effective sample size: two DIFFERENT correct answers ───────────────────────────────────────
    //
    // "N correlated observations are not N observations" (.claude/rules/numerology-vs-number-theory.md)
    // is true, and the trap is that it has TWO distinct correct quantifications. Which one is right
    // depends on what you are computing, and using the wrong one is itself the error the rule warns
    // about. Both are exposed here so a caller has to choose deliberately.

    /// **Kish effective sample size** — for the VARIANCE OF A MEAN over correlated trials.
    ///
    /// Use this when averaging a score across n runs of the same agent/config: the runs share a
    /// common cause, so the standard error is not sigma/sqrt(n) but sigma/sqrt(nEff).
    ///
    ///   design effect  deff  = 1 + (n - 1) * rho        (Kish 1965, Survey Sampling, ch. 5)
    ///   effective size nEff  = n / deff
    ///
    /// Endpoints: rho = 0 gives nEff = n (independent); rho = 1 gives nEff = 1 (one observation
    /// counted n times). rho is clamped to [0, 1]: negative intraclass correlation is real in
    /// survey work (nEff > n) but is not a regime this substrate produces, so it is refused
    /// rather than silently extrapolated.
    let effectiveTrialCount (n: int) (rho: double) : double =
        if n < 1 then 0.0
        else
            let r = Math.Min(Math.Max(rho, 0.0), 1.0)
            let deff = 1.0 + (double n - 1.0) * r
            double n / deff

    /// **Union-equivalent agent count** — for the COVERAGE of a union over correlated agents.
    ///
    /// This is NOT the Kish count and generally disagrees with it. It answers a different question:
    /// how many INDEPENDENT agents of competence c would discover the same expected fraction of
    /// facts as n agents correlated at rho? It is the exact inverse of `expectedSocietyIdentical`
    /// against the rho = 0 case, so it is pinned to the shipped formula rather than assumed:
    ///
    ///   p          = rho*c + (1-rho)*(1 - (1-c)^n)      (the shipped union probability)
    ///   1-(1-c)^m  = p        =>        m = ln(1-p) / ln(1-c)
    ///
    /// Endpoints agree with Kish (m = n at rho = 0, m = 1 at rho = 1) and the interior does not —
    /// which is precisely why both exist. Degenerate competence (c <= 0 or c >= 1) has no
    /// finite inverse and returns 0.0.
    let unionEquivalentAgentCount (n: int) (c: double) (rho: double) : double =
        if n < 1 || c <= 0.0 || c >= 1.0 then 0.0
        else
            let r = Math.Min(Math.Max(rho, 0.0), 1.0)
            let p = r * c + (1.0 - r) * (1.0 - Math.Pow(1.0 - c, double n))
            if p >= 1.0 then double n
            else log (1.0 - p) / log (1.0 - c)

    /// Simulate discovery events for heterogeneous agents under correlation rho using a Gaussian Copula.
    /// Let X_j ~ N(0, 1) be the shared latent variable for fact j.
    /// Let eps_i,j ~ N(0, 1) be independent noise.
    /// Let V_i,j = sqrt(rho) * X_j + sqrt(1 - rho) * eps_i,j be the correlated latent variables.
    /// Agent i discovers fact j iff V_i,j < probit(c_i).
    let simulateHeterogeneous (n: int) (competences: double[]) (rho: double) (facts: Fact[]) (runs: int) (seed: uint64) : double =
        if n < 1 || competences.Length < n || facts.Length = 0 || runs < 1 then 0.0
        else
            let rng = System.Random(int (seed % (uint64 Int32.MaxValue)))
            
            // Standard normal sampler (Box-Muller transform)
            let nextNormal () =
                let u1 = rng.NextDouble()
                let u2 = rng.NextDouble()
                let safeU1 = Math.Max(u1, 1e-30)
                sqrt(-2.0 * log safeU1) * cos(2.0 * Math.PI * u2)

            let competencesNormalized = competences |> Array.truncate n |> Array.map (fun c -> Math.Min(Math.Max(c, 0.0), 1.0))
            let thresholds = competencesNormalized |> Array.map (fun c ->
                if c <= 0.0 then Double.NegativeInfinity
                elif c >= 1.0 then Double.PositiveInfinity
                else probit c)

            let mutable sumSociety = 0.0
            let sqrtRho = sqrt rho
            let sqrtOneMinusRho = sqrt (1.0 - rho)

            for _ in 1 .. runs do
                let mutable runValue = 0.0
                for f in facts do
                    let shared = nextNormal ()
                    let mutable discoveredByAtLeastOne = false
                    let mutable i = 0
                    while i < n && not discoveredByAtLeastOne do
                        let thresh = thresholds.[i]
                        if Double.IsPositiveInfinity thresh then
                            discoveredByAtLeastOne <- true
                        elif Double.IsNegativeInfinity thresh then
                            ()
                        else
                            let noise = nextNormal ()
                            let v = sqrtRho * shared + sqrtOneMinusRho * noise
                            if v < thresh then
                                discoveredByAtLeastOne <- true
                        i <- i + 1
                    if discoveredByAtLeastOne then
                        runValue <- runValue + f.Value
                sumSociety <- sumSociety + runValue

            sumSociety / double runs
