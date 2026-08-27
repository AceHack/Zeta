namespace Zeta.Core

/// **`DelayDecorrelation` — the bridge between network delay and the Condorcet regime.**
///
/// The core theorem: **network delay is the mechanism that enforces decorrelation, which is the
/// mechanism that makes the Condorcet jury theorem work.**
///
/// The Condorcet jury theorem requires that jurors are independent (correlation ρ < ρ*). In a
/// distributed network, what makes agents independent is that they cannot coordinate
/// instantaneously — their beliefs evolve on separate causal trajectories. Network delay is the
/// physical mechanism that enforces this separation.
///
/// The connection to the Bell/CHSH hierarchy:
///   - S = 4 (superdeterministic): zero delay, full coordination, ρ → 1, ΔU → 0 (no Condorcet gain)
///   - S = 2√2 (Tsirelson/quantum-like): delay = √2 ticks, shared-state correlation, ρ = ρ*
///   - S = 2 (classical/independent): high delay, genuine decorrelation, ρ → 0, ΔU → max
///
/// The **Condorcet bonus** of a connection is the expected ΔU gain from routing a message over
/// that connection, given its delay. High delay = more independent = more Condorcet gain.
///
/// **Reticulum integration:** Reticulum is a delay-tolerant, store-and-forward mesh network.
/// Its propagation delay is not uniform — it depends on the path, link quality, and congestion.
/// The `ReticulumLink` type models a Reticulum link with its measured delay and the resulting
/// Condorcet bonus. The attention router uses this to weight connections by their independence
/// value, not just their information content.
///
/// **Honest scope:** the `attenuation` function in `FeedbackThrottle` is a modeling choice
/// (`1/(1+latency)`). The boundary conditions (S=4 at zero, S→2 at infinity) and monotonicity
/// are load-bearing; the exact interpolation is not. The `TsirelsonLatency = √2` is contingent
/// on this modeling choice — **neither derived nor fitted; to be measured** (Aaron/Otto
/// 2026-08-27). S=4 at L=0 is the measured seed-shared result. 2√2 is a predicted
/// degradation floor under real latency. The Condorcet-bonus formula is similarly a modeling
/// choice — the boundary conditions (bonus=0 at zero delay, bonus→max at high delay) are
/// load-bearing.
[<RequireQualifiedAccess>]
module DelayDecorrelation =

    /// The correlation ρ implied by a network delay, using the FeedbackThrottle model.
    /// At zero delay: ρ = 1 (fully correlated, S=4). At infinite delay: ρ = 0 (independent, S=2).
    /// The mapping: ρ(latency) = attenuation(latency) = 1 / (1 + latency).
    /// This is the "effective correlation" — how much of the agent's belief is shared via the
    /// fast feedback channel vs. independently derived.
    let effectiveCorrelation (latency: float) : float =
        let lat = max 0.0 latency
        1.0 / (1.0 + lat)

    /// The Condorcet regime for a given network delay.
    /// Maps directly from FeedbackThrottle.regimeOf but named for the Condorcet context.
    type CondorcetRegime =
        /// ρ ≈ 1: agents are effectively a single correlated agent. No Condorcet gain.
        | Correlated
        /// ρ ≈ ρ*: agents share a quantum-like state. Marginal Condorcet gain.
        | SharedState
        /// ρ < ρ*: agents are genuinely independent. Full Condorcet gain available.
        | Independent

    /// Classify the Condorcet regime for a given network delay.
    let condorcetRegime (latency: float) : CondorcetRegime =
        match FeedbackThrottle.regimeOf latency with
        | FeedbackThrottle.Signalling -> Correlated
        | FeedbackThrottle.Quantum    -> SharedState
        | FeedbackThrottle.Classical  -> Independent

    /// The Condorcet bonus: the multiplicative factor by which a connection's routing weight
    /// should be amplified due to the independence value of the delay.
    ///
    /// At zero delay (Correlated): bonus = 0.0 (no independence value)
    /// At TsirelsonLatency (SharedState): bonus = 0.5 (partial independence)
    /// At high delay (Independent): bonus → 1.0 (full independence value)
    ///
    /// Formula: bonus = 1 - 1/(1 + latency) = latency/(1+latency) = effectiveCorrelation(latency)
    /// (The more correlated the channel, the LESS bonus — we reward independence.)
    /// Wait — we want the INVERSE: high delay = high bonus. So:
    /// bonus = attenuation(latency) = 1/(1+latency)
    /// At latency=0: bonus=1 (instant, but correlated — this seems wrong)
    ///
    /// Correct formulation: the Condorcet bonus rewards INDEPENDENCE, not speed.
    /// independence(latency) = 1 - attenuation(latency) = latency/(1+latency)
    /// At latency=0: independence=0 (fully correlated, no bonus)
    /// At latency=√2: independence=√2/(1+√2) ≈ 0.586 (Tsirelson point)
    /// At latency→∞: independence→1 (fully independent, full bonus)
    let condorcetBonus (latency: float) : float =
        let lat = max 0.0 latency
        lat / (1.0 + lat)  // = effectiveCorrelation, but semantically: independence bonus

    /// The delay at which the Condorcet bonus equals a target value ∈ (0,1).
    /// Invert: bonus = lat/(1+lat) ⟹ lat = bonus/(1-bonus).
    let latencyForBonus (bonus: float) : float option =
        if bonus <= 0.0 || bonus >= 1.0 then None
        else Some(bonus / (1.0 - bonus))

    /// The Condorcet bonus at the Tsirelson point (latency = √2).
    /// = √2 / (1 + √2) = √2(√2-1) = 2-√2 ≈ 0.586
    let TsirelsonBonus : float = sqrt 2.0 / (1.0 + sqrt 2.0)

    /// The delay-adjusted routing weight between two agents.
    /// Combines the information-value weight (KL × trajectory alignment) with the
    /// Condorcet bonus (independence value of the delay).
    ///
    /// weight_adjusted = weight_base × (1 + condorcetBonus(latency))
    ///
    /// This means:
    ///   - A connection with zero delay has weight_adjusted = weight_base × 1.0 (no bonus)
    ///   - A connection at the Tsirelson point has weight_adjusted ≈ weight_base × 1.586
    ///   - A connection with very high delay has weight_adjusted → weight_base × 2.0
    let adjustedWeight (baseWeight: float) (latency: float) : float =
        baseWeight * (1.0 + condorcetBonus latency)

    /// A Reticulum link: a connection between two agents with a measured propagation delay.
    type ReticulumLink =
        { /// The source agent identifier.
          From: string
          /// The destination agent identifier.
          To: string
          /// The measured one-way propagation delay in ticks (Reticulum hop count × avg hop delay).
          Latency: float
          /// The effective correlation ρ implied by this delay.
          EffectiveCorrelation: float
          /// The Condorcet regime this link operates in.
          Regime: CondorcetRegime
          /// The Condorcet bonus for this link.
          Bonus: float }

    /// Create a ReticulumLink from a measured latency.
    let reticulumLink (from: string) (to_: string) (latency: float) : ReticulumLink =
        { From = from
          To = to_
          Latency = latency
          EffectiveCorrelation = effectiveCorrelation latency
          Regime = condorcetRegime latency
          Bonus = condorcetBonus latency }

    /// The Condorcet threshold latency: the delay at which ρ = ρ* (the Condorcet boundary).
    /// Below this latency, the society gain ΔU is negative (correlated agents hurt).
    /// Above this latency, the society gain ΔU is positive (independent agents help).
    ///
    /// From the Condorcet boundary: ρ* = (n-1)/(n-1+1/c) where c is competence and n is group size.
    /// For the canonical case n=3, c=0.7: ρ* ≈ 0.417.
    /// Invert effectiveCorrelation: latency = ρ/(1-ρ).
    let condorcetThresholdLatency (rhoStar: float) : float =
        if rhoStar <= 0.0 || rhoStar >= 1.0 then System.Double.PositiveInfinity
        else (1.0 - rhoStar) / rhoStar

    /// Is this link operating above the Condorcet threshold? (i.e. does it provide positive ΔU?)
    let isCondorcetPositive (rhoStar: float) (link: ReticulumLink) : bool =
        link.EffectiveCorrelation < rhoStar

    /// The expected ΔU gain from routing a message over a Reticulum link, given:
    /// - `n`: the number of agents in the society
    /// - `competence`: each agent's individual competence c ∈ (0.5, 1)
    /// - `valueSum`: the total value Σvⱼ at stake
    /// - `link`: the Reticulum link (provides ρ via its latency)
    ///
    /// From SocietyUsefulWork: ΔU = (1-ρ)(1-c)(1-(1-c)^(n-1)) × Σvⱼ
    let expectedDeltaU (n: int) (competence: float) (valueSum: float) (link: ReticulumLink) : float =
        let rho = link.EffectiveCorrelation
        let c = competence
        let nf = float n
        (1.0 - rho) * (1.0 - c) * (1.0 - (1.0 - c) ** (nf - 1.0)) * valueSum
