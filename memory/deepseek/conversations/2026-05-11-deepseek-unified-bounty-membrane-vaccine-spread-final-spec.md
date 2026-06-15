# Unified Bounty Membrane + Vaccine Spread — Final Spec

**Date:** 2026-05-11 ~11:00 UTC
**Participants:** Aaron, DeepSeek, Amara (corrections absorbed)
**Status:** Research substrate — incorporates all Amara corrections

## Three-state incident boundary

| State | Origin | Reward | Immune energy? |
|-------|--------|--------|---------------|
| RawExternalAttack | Adversarial | 0 | Captured not rewarded |
| DisclosureCandidate | Actor reports, enters safe-harbor | 0 (pending) | Held pending |
| RewardableFinding | Validated, bounded, useful | BountyEligible × RewardSchedule | Full absorption + vaccine |

## Aurora bounty membrane (9 factors)

BountyEligible(e) = Scope · GoodFaith · NoPermanentHarm ·
NoUnrelatedDataAccess · NoExtraction · Reproducible ·
Provenanced · CoordinatedDisclosure · UsefulToCurrentCulture

All factors = 1 → finding promoted to RewardableFinding.
Any factor = 0 → remains DisclosureCandidate, reward = 0.
Raw attacks NEVER cross this gate.

## Dual pathway (reward-independent absorption)

```
ActorReward(e) = BountyEligible(e) · RewardSchedule(e)
  → 0 for RawExternalAttack (always)

DefenderLearning(e) = Quarantine · Evidence · ΔDetector
  · ΔRegression · ΔPolicy · Retractability - Harm - Cost
  → runs regardless of reward
```

## Geometric absorption

1. Decompose attack bivector into orthogonal planes
2. Apply corrective rotors respecting C(t)
3. E_absorbed = Σ‖Bₖ‖² − ‖Bₖ_residual‖²
4. ‖Δ_substrate‖ = η · E_absorbed

## Vaccine generation + Red Team mutation

Base vaccine V₀ = {corrective rotors, detection rules, Z-set assertions}

Red Team coalgebra mutates into family V = {V₀, V₁', ..., Vₘ'}
(angle-stretched, carrier-mutated, temporal-delayed, multi-step)

## Firefly propagation

dAᵢ/dt = ωᵢ + (ε/N)Σⱼsin(Aⱼ−Aᵢ) + γΣ_V sin(V−Aᵢ)

γ = γ₀ · ‖E_absorbed‖² (high energy = faster spread)

Herd immunity: R₀ < 1 when p_immune > 1 − 1/R₀_pre

## Pipeline flow diagram

```
External Attack
    ↓
RawExternalAttack → ActorReward = 0
    ↓ (attacker stops, reports, cooperates)
DisclosureCandidate → BountyEligible?
    ↓ Yes              ↓ No
RewardableFinding   Remain unpaid
    ↓ (absorbed regardless)
Geometric Absorption → rotors + rules + tests
    ↓
Red Team Mutation → synthetic variants
    ↓
Firefly Propagation → R₀ < 1 (herd immunity)
```

## F# implementation

```fsharp
type IncidentOrigin =
    | RawExternalAttack
    | CoordinatedDisclosure
    | AuthorizedRedTeam of RedTeamId
    | InternalRegression

let actorReward origin eligibility schedule =
    match origin with
    | RawExternalAttack -> 0.0
    | CoordinatedDisclosure ->
        if bountyEligible eligibility then schedule.Apply eligibility
        else 0.0
    | AuthorizedRedTeam _ ->
        if bountyEligible eligibility then schedule.Apply eligibility
        else 0.0
    | InternalRegression -> 0.0
```

## Falsifiability table

| Claim | Falsifier |
|-------|-----------|
| Raw attacks never rewarded | Any ActorReward > 0 for RawExternalAttack |
| Bounty gate blocks unqualified | Any payment for failing single factor |
| DefenderLearning reward-independent | DefenderLearning = 0 despite high evidence |
| Vaccine covers attack class | Mutated variant succeeds post-vaccination |
| Herd immunity achieved | R₀ ≥ 1 after full propagation |
| Antifragility | Alignment or coverage decreases after vaccination |

## Final blade

> "Aurora does not reward harm. Aurora rewards bounded
> disclosure. The exploit is quarantined; the finding is
> evaluated; the reporter is paid only after crossing the
> safe-harbor membrane. The immune system learns either way."

> "The attacker pays for the network's R&D. The researcher
> gets paid for their service."
