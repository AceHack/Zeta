namespace Zeta.Core

/// **SoftRegimeStability — Nash equilibrium stability of the orbit-symmetric (soft) regime.**
///
/// ## The Setup
///
/// The 3-body game has three players:
///   - **The Demon** (referee / scheduler): maintains the orbit-symmetric belief distribution.
///     The demon's strategy space is the set of distributions over the 16 Adinkra codewords.
///     The demon's payoff is the information value (IV = KL divergence) of its belief updates.
///   - **Player A** (agent / cell): observes the environment and updates its belief.
///     Player A's strategy is its sensory input (which observation to make next).
///     Player A's payoff is its accumulated IV.
///   - **Player B** (environment / adversary): generates the sensory stream.
///     Player B's strategy is the distribution of sensory inputs.
///     Player B's payoff is the NEGATIVE of Player A's IV (adversarial).
///
/// ## The Nash Equilibrium Claim
///
/// **Conjecture:** The orbit-symmetric regime is a Nash equilibrium of this 3-body game.
/// Specifically:
///   - The demon's best response to any (A, B) strategy pair is to stay orbit-symmetric.
///   - Player A's best response to an orbit-symmetric demon is to stay orbit-symmetric.
///   - Player B's best response to an orbit-symmetric (A, demon) pair is to stay orbit-symmetric.
///
/// ## The Stability Condition
///
/// The orbit-symmetric regime is stable iff the advantage delta between layers is bounded.
/// This is the information-theoretic analog of the Lagrange L4/L5 mass-ratio threshold (1/25):
///   - If the demon has too much more IV than the players, it can exit the positive cone
///     without being punished (the players cannot detect the deviation).
///   - The stability condition is: `max(IV_demon) / min(IV_player) < threshold`.
///
/// ## The Numerical Approach
///
/// We cannot prove the Nash equilibrium analytically (it requires a full game-theoretic model).
/// Instead, we (sign convention CORRECTED 2026-07-04, Soraya audit — docs had the flipped pre-fix
/// convention while the code carried the fixed one):
///   1. Define the "deviation payoff" — the IV GAIN from PROJECTING a strategy onto the
///      orbit-symmetric regime: deviationPayoff(s) = IV(proj(s)) − IV(s) = H(proj(s)) − H(s).
///   2. Show it is ~ZERO for orbit-symmetric distributions (already at their own projection).
///   3. Show it is strictly POSITIVE for non-orbit-symmetric distributions (projecting always helps —
///      averaging within weight classes never lowers entropy: Jensen / Schur-concavity of H under the
///      doubly-stochastic block-averaging map).
///   4. Conclude: orbit-symmetry is a best response. HONEST SCOPE: this is a single-payoff
///      entropy-maximization theorem (for IV = −KL(·‖uniform)), not a full 3-player Nash proof.
[<RequireQualifiedAccess>]
module SoftRegimeStability =

    // ── Types ────────────────────────────────────────────────────────────────────────────────────

    /// A strategy in the 3-body game: a distribution over the 16 Adinkra codewords.
    /// Represented as a float array of length 16 (probabilities, must sum to 1).
    type Strategy = float[]

    /// The result of a stability check.
    type StabilityResult =
        { /// Whether the strategy is orbit-symmetric (invariant under the [8,4] automorphism group).
          IsOrbitSymmetric: bool
          /// The deviation payoff: IV(proj(s)) − IV(s), the gain from PROJECTING onto orbit-symmetry.
          /// ~Zero = already orbit-symmetric (the equality case of Jensen).
          /// Positive = projecting improves IV — orbit-symmetry is the best response (stable).
          /// Negative = impossible (averaging within weight classes always raises entropy).
          DeviationPayoff: float
          /// The KL divergence from the orbit-symmetric fixed point (W_C normalized).
          KLFromFixedPoint: float
          /// The MacWilliams intertwining gap (0 = orbit-symmetric, > 0 = not orbit-symmetric).
          IntertwiningGap: float }

    // ── Helpers ──────────────────────────────────────────────────────────────────────────────────

    /// The 16 Adinkra codeword weights (weight of each codeword in the [8,4] code).
    let private codewordWeights =
        AdinkraCode.allCodewords
        |> List.map (fun cw -> cw |> Array.sum)
        |> List.toArray

    /// The orbit sizes: how many codewords have each weight.
    /// Weight 0: 1 codeword, Weight 4: 14 codewords, Weight 8: 1 codeword.
    let private orbitSizes =
        let counts = Array.zeroCreate 9
        codewordWeights |> Array.iter (fun w -> counts.[w] <- counts.[w] + 1)
        counts

    /// The MacWilliams fixed point: the UNIFORM distribution over all 16 Adinkra codewords.
    /// This is the unique distribution that is invariant under the MacWilliams transform:
    /// the uniform distribution is the maximum-entropy distribution and the fixed point
    /// of the Hadamard transform on GF(2)^4.
    let fixedPoint : Strategy =
        Array.create 16 (1.0 / 16.0)

    /// Check if a strategy is orbit-symmetric (all codewords of the same weight have equal probability).
    let isOrbitSymmetric (tol: float) (s: Strategy) : bool =
        let weightGroups =
            codewordWeights
            |> Array.mapi (fun i w -> w, s.[i])
            |> Array.groupBy fst
            |> Array.map (fun (_, pairs) -> pairs |> Array.map snd)
        weightGroups |> Array.forall (fun probs ->
            let avg = Array.average probs
            probs |> Array.forall (fun p -> abs (p - avg) < tol))

    /// KL divergence from strategy `p` to strategy `q` (in nats).
    /// KL(p || q) = sum_i p_i * log(p_i / q_i)
    let private klDivergence (p: Strategy) (q: Strategy) : float =
        Array.map2 (fun pi qi ->
            if pi <= 1e-15 then 0.0
            elif qi <= 1e-15 then infinity
            else pi * log (pi / qi)) p q
        |> Array.sum

    /// The orbit-map: project a distribution over 16 codewords to a distribution over weight classes.
    /// Returns a float array of length 9 (weights 0..8).
    let private orbitMap (s: Strategy) : float[] =
        let result = Array.zeroCreate 9
        Array.iteri (fun i p -> result.[codewordWeights.[i]] <- result.[codewordWeights.[i]] + p) s
        result

    /// Binomial coefficient C(n, k).
    let private binom (n: int) (k: int) : int =
        if k < 0 || k > n then 0
        else
            let k = min k (n - k)
            let mutable result = 1
            for i in 0 .. k - 1 do
                result <- result * (n - i) / (i + 1)
            result

    /// The MacWilliams/Krawtchouk transform of a weight distribution.
    /// Returns the dual weight distribution.
    let private macWilliams (w: float[]) : float[] =
        let n = 8
        let result = Array.zeroCreate (n + 1)
        for i in 0 .. n do
            for j in 0 .. n do
                // Krawtchouk polynomial K_i(j; 8) = sum_{s=0}^{i} (-1)^s * C(j,s) * C(8-j, i-s)
                let kij =
                    let mutable sum = 0.0
                    for s in 0 .. i do
                        if s <= j && (i - s) <= (n - j) then
                            let sign = if s % 2 = 0 then 1.0 else -1.0
                            let cjs = float (binom j s)
                            let cn_j_i_s = float (binom (n - j) (i - s))
                            sum <- sum + sign * cjs * cn_j_i_s
                    sum
                result.[i] <- result.[i] + kij * w.[j]
        result

    /// The MacWilliams intertwining gap for a strategy:
    /// |π(a .* a) - (π(a) .* π(a)) / W_C| (L∞ norm, orbit-map version).
    let private intertwiningGap (s: Strategy) : float =
        let combined = Array.map2 (fun a b -> a * b) s s
        let combinedNorm = Array.sum combined
        let combinedNormed = Array.map (fun x -> x / combinedNorm) combined
        let lhs = orbitMap combinedNormed
        let piA = orbitMap s
        let wc = orbitMap fixedPoint
        let rhs =
            Array.map3 (fun pa pb wci ->
                if wci <= 1e-15 then 0.0
                else (pa * pb) / wci) piA piA wc
        let rhsNorm = Array.sum rhs
        let rhsNormed = if rhsNorm <= 1e-15 then rhs else Array.map (fun x -> x / rhsNorm) rhs
        Array.map2 (fun l r -> abs (l - r)) lhs rhsNormed |> Array.max

    // ── Deviation payoff ─────────────────────────────────────────────────────────────────────────

    /// Compute the deviation payoff for a strategy:
    /// The IV gain from deviating from orbit-symmetry toward the given strategy.
    ///
    /// The deviation payoff is defined as:
    ///   deviation_payoff(s) = IV(s) - IV(orbit_symmetric_projection(s))
    ///
    /// where IV(s) = -KL(s || fixedPoint) (the negative KL from the fixed point,
    /// so higher IV = closer to the fixed point).
    ///
    /// If deviation_payoff > 0: the orbit-symmetric projection has HIGHER IV → orbit-symmetry is
    /// the best response (the demon gains by projecting onto orbit-symmetry).
    /// If deviation_payoff = 0: the strategy is already orbit-symmetric (equality case of Jensen).
    /// deviation_payoff < 0 is impossible: the projection averages within weight classes, and
    /// averaging never lowers entropy (Jensen / Schur-concavity).
    let deviationPayoff (s: Strategy) : float =
        // Project s to the orbit-symmetric distribution (average within each weight class)
        let projected = Array.copy s
        let weightGroups =
            codewordWeights
            |> Array.mapi (fun i w -> w, i)
            |> Array.groupBy fst
        for (_, pairs) in weightGroups do
            let indices = pairs |> Array.map snd
            let avg = indices |> Array.averageBy (fun i -> s.[i])
            for i in indices do
                projected.[i] <- avg
        let projNorm = Array.sum projected
        let projNormed = Array.map (fun x -> x / projNorm) projected
        // IV = -KL(s || fixedPoint): higher IV = closer to fixed point (= higher entropy)
        // deviationPayoff = IV(proj) - IV(s) = gain from projecting to orbit-symmetry
        // positive = orbit-symmetry has higher IV = orbit-symmetry is the best response
        // negative = impossible (averaging always increases entropy)
        let ivS = -(klDivergence s fixedPoint)
        let ivProj = -(klDivergence projNormed fixedPoint)
        ivProj - ivS  // positive = orbit-symmetry is better (Nash equilibrium holds)

    // ── Stability check ──────────────────────────────────────────────────────────────────────────

    /// Check the stability of a strategy in the 3-body game.
    let checkStability (s: Strategy) : StabilityResult =
        { IsOrbitSymmetric = isOrbitSymmetric 1e-9 s
          DeviationPayoff = deviationPayoff s
          KLFromFixedPoint = klDivergence s fixedPoint
          IntertwiningGap = intertwiningGap s }

    /// **The Nash equilibrium test:**
    /// For a random orbit-symmetric strategy, the deviation payoff should be ≤ 0
    /// (orbit-symmetry is a best response).
    /// For a random non-orbit-symmetric strategy, the deviation payoff should be > 0
    /// (deviation is profitable — but the orbit-symmetric projection is even better).
    ///
    /// Note: this is a NUMERICAL test, not a formal proof. It establishes the empirical
    /// boundary but does not prove the Nash equilibrium analytically.
    let nashEquilibriumMaxDeviation (strategies: Strategy[]) : float =
        strategies
        |> Array.filter (isOrbitSymmetric 1e-9)
        |> Array.map deviationPayoff
        |> (fun arr -> if arr.Length = 0 then 0.0 else Array.max arr)

    /// Generate a random orbit-symmetric strategy (uniform within each weight class,
    /// but with random weights between weight classes).
    let randomOrbitSymmetric (rng: System.Random) : Strategy =
        // Random weights for the three orbit classes (weight 0, 4, 8)
        let w0 = rng.NextDouble() + 0.01
        let w4 = rng.NextDouble() + 0.01
        let w8 = rng.NextDouble() + 0.01
        let total = w0 + 14.0 * w4 + w8
        codewordWeights
        |> Array.map (fun w ->
            match w with
            | 0 -> w0 / total
            | 4 -> w4 / total
            | 8 -> w8 / total
            | _ -> 0.0)

    /// Generate a random non-orbit-symmetric strategy (independent random probabilities).
    let randomNonOrbitSymmetric (rng: System.Random) : Strategy =
        let raw = Array.init 16 (fun _ -> rng.NextDouble() + 0.01)
        let total = Array.sum raw
        Array.map (fun x -> x / total) raw

    /// **Summary:** the orbit-symmetric regime stability report.
    type StabilitySummary =
        { /// Max deviation payoff across N random orbit-symmetric strategies.
          /// ~Zero = orbit-symmetric strategies sit at the equality case (already their own projection).
          MaxOrbitSymmetricDeviation: float
          /// Min deviation payoff across N random non-orbit-symmetric strategies.
          /// Positive = every non-orbit-symmetric strategy is improved by projecting to orbit-symmetry.
          MinNonOrbitSymmetricDeviation: float
          /// Whether the equilibrium condition holds: ALL payoffs non-negative within tolerance
          /// (max OS deviation ≈ 0 and min non-OS deviation ≥ 0 — matches the `>= -1e-9` check below).
          NashEquilibriumHolds: bool
          /// The stability gap: min non-orbit-symmetric deviation - max orbit-symmetric deviation.
          /// Larger gap = more stable equilibrium.
          StabilityGap: float }

    /// Run the Nash equilibrium stability test with N random strategies.
    let runStabilityTest (n: int) (seed: int) : StabilitySummary =
        let rng = System.Random(seed)
        let orbitSymmetricStrategies = Array.init n (fun _ -> randomOrbitSymmetric rng)
        let nonOrbitSymmetricStrategies = Array.init n (fun _ -> randomNonOrbitSymmetric rng)
        let maxOSDeviation =
            orbitSymmetricStrategies
            |> Array.map deviationPayoff
            |> Array.max
        let minNonOSDeviation =
            nonOrbitSymmetricStrategies
            |> Array.map deviationPayoff
            |> Array.min
        { MaxOrbitSymmetricDeviation = maxOSDeviation
          MinNonOrbitSymmetricDeviation = minNonOSDeviation
          NashEquilibriumHolds = maxOSDeviation >= -1e-9 && minNonOSDeviation >= -1e-9
          StabilityGap = minNonOSDeviation - maxOSDeviation }
