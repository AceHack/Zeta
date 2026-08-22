namespace Zeta.Core

open System

/// **SocietyUsefulWork — the delta-U aggregation theorem formalization and simulation.**
/// (Routed as workitem 081KV6B1MBM08QG0R000RZK4WY; math-team/Soraya).
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
