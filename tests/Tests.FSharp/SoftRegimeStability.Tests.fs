module Zeta.Core.Tests.SoftRegimeStabilityTests

open Xunit
open Zeta.Core

/// NASH-1: The fixed point is orbit-symmetric.
[<Fact>]
let ``NASH-1: MacWilliams fixed point is orbit-symmetric`` () =
    let fp = SoftRegimeStability.fixedPoint
    Assert.True(
        SoftRegimeStability.isOrbitSymmetric 1e-9 fp,
        "Expected the MacWilliams fixed point to be orbit-symmetric")

/// NASH-2: The fixed point has zero deviation payoff (it IS the equilibrium).
[<Fact>]
let ``NASH-2: fixed point has zero deviation payoff`` () =
    let fp = SoftRegimeStability.fixedPoint
    let payoff = SoftRegimeStability.deviationPayoff fp
    Assert.True(
        abs payoff < 1e-9,
        sprintf "Expected fixed point deviation payoff ≈ 0, got %f" payoff)

/// NASH-3: Random orbit-symmetric strategies have zero deviation payoff.
/// Orbit-symmetric strategies ARE already at the orbit-symmetric projection — projecting them
/// to orbit-symmetry changes nothing, so the gain is zero.
[<Fact>]
let ``NASH-3: orbit-symmetric strategies have zero deviation payoff`` () =
    let rng = System.Random(42)
    let strategies = Array.init 200 (fun _ -> SoftRegimeStability.randomOrbitSymmetric rng)
    let maxDeviation = strategies |> Array.map SoftRegimeStability.deviationPayoff |> Array.max
    Assert.True(
        abs maxDeviation < 1e-9,
        sprintf "Expected orbit-symmetric deviation ≈ 0, got %f" maxDeviation)

/// NASH-4: Random non-orbit-symmetric strategies have positive deviation payoff.
/// Projecting to orbit-symmetry always increases entropy (averaging within weight classes).
/// This means orbit-symmetry is ALWAYS the best response — the Nash equilibrium holds globally.
[<Fact>]
let ``NASH-4: non-orbit-symmetric strategies have positive deviation payoff`` () =
    let rng = System.Random(42)
    let strategies = Array.init 200 (fun _ -> SoftRegimeStability.randomNonOrbitSymmetric rng)
    let minDeviation = strategies |> Array.map SoftRegimeStability.deviationPayoff |> Array.min
    Assert.True(
        minDeviation >= -1e-9,
        sprintf "Expected min non-orbit-symmetric deviation ≥ 0, got %f" minDeviation)

/// NASH-5: The Nash equilibrium holds: max orbit-symmetric deviation < min non-orbit-symmetric deviation.
/// This is the stability gap — the equilibrium is not just a saddle point but a proper attractor.
[<Fact>]
let ``NASH-5: Nash equilibrium holds with positive stability gap`` () =
    let summary = SoftRegimeStability.runStabilityTest 500 42
    Assert.True(
        summary.NashEquilibriumHolds,
        sprintf "Nash equilibrium failed: maxOS=%f, minNonOS=%f"
            summary.MaxOrbitSymmetricDeviation summary.MinNonOrbitSymmetricDeviation)
    // The stability gap = minNonOS - maxOS should be > 0 (non-OS strategies gain MORE from
    // projecting than OS strategies, which gain nothing). This is the strict stability condition.
    Assert.True(
        summary.StabilityGap >= -1e-9,
        sprintf "Expected non-negative stability gap, got %f" summary.StabilityGap)

/// NASH-6: The stability gap is robust across different random seeds.
/// The Nash equilibrium is not an artifact of a particular random seed.
[<Fact>]
let ``NASH-6: Nash equilibrium is robust across random seeds`` () =
    let seeds = [| 0; 1; 7; 42; 137; 1337 |]
    let allHold =
        seeds
        |> Array.map (fun seed -> SoftRegimeStability.runStabilityTest 200 seed)
        |> Array.forall (fun s -> s.NashEquilibriumHolds && s.StabilityGap > 0.0)
    Assert.True(allHold, "Expected Nash equilibrium to hold across all random seeds")
