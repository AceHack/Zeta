module Zeta.Bayesian.Tests.LagrangeCondorcetTests

open Xunit
open Zeta.Bayesian

/// LAG-1: The Lagrange μ_crit is the correct classical value ≈ 0.03852.
[<Fact>]
let ``LAG-1: Lagrange mu_crit is the classical value`` () =
    let expected = (1.0 - sqrt(23.0 / 27.0)) / 2.0
    Assert.Equal(expected, LagrangeCondorcet.lagrangeMuCrit, 12)

/// LAG-2: The Lagrange jury size 1/μ_crit ≈ 25.96.
[<Fact>]
let ``LAG-2: Lagrange jury size is approximately 25.96`` () =
    let jurySize = LagrangeCondorcet.lagrangeJurySize
    Assert.True(
        abs (jurySize - 25.96) < 0.1,
        sprintf "Expected Lagrange jury size ≈ 25.96, got %f" jurySize)

/// LAG-3: The Condorcet ρ* limit as N → ∞ is 1/3.
[<Fact>]
let ``LAG-3: Condorcet rho* limit is 1/3`` () =
    let rhoStarLarge = LagrangeCondorcet.condorcetRhoStar 100001
    Assert.True(
        abs (rhoStarLarge - (1.0/3.0)) < 0.001,
        sprintf "Expected ρ* → 1/3 as N → ∞, got %f" rhoStarLarge)

/// LAG-4: The effective jury size at ρ = μ_crit converges to 1/μ_crit ≈ 25.96 as N → ∞.
/// This is the core of the Lagrange-Condorcet correspondence.
[<Fact>]
let ``LAG-4: effective jury size at Lagrange threshold converges to 1/mu_crit`` () =
    let nEff = LagrangeCondorcet.effectiveJurySizeAtLagrange 100001
    let expected = LagrangeCondorcet.lagrangeJurySize
    Assert.True(
        abs (nEff - expected) < 0.01,
        sprintf "Expected N_eff(N→∞, μ_crit) ≈ %f, got %f" expected nEff)

/// LAG-5: The Lagrange stability condition correctly classifies ensembles.
/// An ensemble with N_eff > 26 is Lagrange-stable; N_eff < 26 is unstable.
[<Fact>]
let ``LAG-5: Lagrange stability correctly classifies ensembles`` () =
    // Low correlation (ρ = 0.01) → high N_eff → stable
    Assert.True(LagrangeCondorcet.isLagrangeStable 1001 0.01, "Expected N=1001, ρ=0.01 to be Lagrange-stable")
    // High correlation (ρ = 0.5) → low N_eff → unstable
    Assert.False(LagrangeCondorcet.isLagrangeStable 1001 0.5, "Expected N=1001, ρ=0.5 to be Lagrange-unstable")
    // At exactly μ_crit with large N → N_eff ≈ 25.96 → just below threshold → unstable
    Assert.False(
        LagrangeCondorcet.isLagrangeStable 100001 LagrangeCondorcet.lagrangeMuCrit,
        "Expected N=100001 at ρ=μ_crit to be just below Lagrange threshold (unstable)")

/// LAG-6: The minimum N for Lagrange stability at ρ < μ_crit is finite and computable.
[<Fact>]
let ``LAG-6: minimum N for Lagrange stability is finite for rho < mu_crit`` () =
    // At ρ = 0.01 (well below μ_crit ≈ 0.0385):
    let nMin = LagrangeCondorcet.minNForLagrangeStability 0.01
    Assert.True(nMin.IsSome, "Expected finite N_min for ρ = 0.01 < μ_crit")
    Assert.True(nMin.Value > 0, sprintf "Expected N_min > 0, got %d" nMin.Value)
    // At ρ = μ_crit: no finite N works
    let nMinAtCrit = LagrangeCondorcet.minNForLagrangeStability LagrangeCondorcet.lagrangeMuCrit
    Assert.True(nMinAtCrit.IsNone, "Expected no finite N_min at ρ = μ_crit")
    // At ρ > μ_crit: no finite N works
    let nMinAboveCrit = LagrangeCondorcet.minNForLagrangeStability 0.1
    Assert.True(nMinAboveCrit.IsNone, "Expected no finite N_min for ρ = 0.1 > μ_crit")
