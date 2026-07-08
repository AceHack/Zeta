module Zeta.Bayesian.Tests.LyapunovContractionTests

open Xunit
open Zeta.Core

// ─────────────────────────────────────────────────────────────────────────────
// LYAP-1 through LYAP-5: Lyapunov contraction proof for the reseed step
//
// These tests pin the five key claims of the Lyapunov stability proof in
// docs/research/rhostar-analytic-proof.md and LyapunovContraction.fs.
// ─────────────────────────────────────────────────────────────────────────────

/// LYAP-1: The Lyapunov function V = KL(p || W_C) is zero at the fixed point W_C.
[<Fact>]
let ``LYAP-1: Lyapunov function is zero at the MacWilliams fixed point`` () =
    let wc = 1.0 / 16.0
    let v = LyapunovContraction.lyapunov wc wc wc
    Assert.True(abs v < 1e-10,
        sprintf "V(W_C) should be 0, got %e" v)

/// LYAP-2: The Lyapunov function is strictly positive away from W_C.
[<Fact>]
let ``LYAP-2: Lyapunov function is strictly positive away from W_C`` () =
    let testCases =
        [ (0.1, 0.8/14.0, 0.1)      // weight-4 heavy
          (0.2, 0.6/14.0, 0.2)      // more weight-4 heavy
          (0.05, 0.9/14.0, 0.05)    // very weight-4 heavy
          (0.15, 0.7/14.0, 0.15)    // moderate
          (0.5/16.0, 15.0/(16.0*14.0), 0.5/16.0) ]  // slightly off W_C
    for (p0, p4, p8) in testCases do
        Assert.True(
            LyapunovContraction.verifyStrictPositivity p0 p4 p8,
            sprintf "V(p0=%g, p4=%g, p8=%g) should be > 0" p0 p4 p8)
    // At W_C: V = 0
    let wc = 1.0 / 16.0
    Assert.True(
        LyapunovContraction.verifyStrictPositivity wc wc wc,
        "V(W_C) should be 0 (strict positivity check passes at fixed point)")

/// LYAP-3: The reseed step is a contraction — V decreases strictly at each step.
[<Fact>]
let ``LYAP-3: reseed step is a contraction (V decreases strictly)`` () =
    let nCells = 16
    let testCases =
        [ (0.1, 0.8/14.0, 0.1)
          (0.2, 0.6/14.0, 0.2)
          (0.05, 0.9/14.0, 0.05)
          (0.15, 0.7/14.0, 0.15) ]
    for (p0, p4, p8) in testCases do
        let (vBefore, vAfter, ratio) = LyapunovContraction.verifyContraction nCells p0 p4 p8
        // V must decrease strictly
        Assert.True(vAfter < vBefore,
            sprintf "V should decrease: vBefore=%e, vAfter=%e (p0=%g,p4=%g,p8=%g)" vBefore vAfter p0 p4 p8)
        // The contraction ratio must be ≤ (1 - 1/N)
        let maxRatio = 1.0 - 1.0 / float nCells
        Assert.True(ratio <= maxRatio + 1e-9,
            sprintf "Contraction ratio %e should be ≤ (1-1/N) = %e" ratio maxRatio)

/// LYAP-4: The positive-cone constraint (p0 ≥ p8) is preserved by the reseed step.
[<Fact>]
let ``LYAP-4: reseed step preserves the positive-cone constraint (p0 >= p8)`` () =
    let nCells = 16
    // Test cases where p0 >= p8 (in the positive cone)
    let inConeTests = [ (0.1, 0.1); (0.15, 0.05); (0.08, 0.08); (0.2, 0.0) ]
    for (p0, p8) in inConeTests do
        Assert.True(
            LyapunovContraction.verifyPositiveConePreservation nCells p0 p8,
            sprintf "Positive cone should be preserved: p0=%g, p8=%g" p0 p8)
    // The MacWilliams fixed point (p0 = p8 = 1/16) is in the cone
    let wc = 1.0 / 16.0
    Assert.True(
        LyapunovContraction.verifyPositiveConePreservation nCells wc wc,
        "W_C should be in the positive cone")

/// LYAP-5: Simulated convergence — V → 0 geometrically at rate (1 - 1/N)^k.
[<Fact>]
let ``LYAP-5: Lyapunov convergence is geometric at rate (1 - 1/N)^k`` () =
    let nCells = 16
    let p0Init = 0.1
    let p4Init = 0.8 / 14.0
    let p8Init = 0.1
    let v0 = LyapunovContraction.lyapunov p0Init p4Init p8Init
    let history = LyapunovContraction.simulateConvergence nCells 50 p0Init p4Init p8Init
    // V must be monotonically non-increasing
    let isMonotone =
        history |> List.pairwise |> List.forall (fun (v1, v2) -> v2 <= v1 + 1e-12)
    Assert.True(isMonotone, "Lyapunov values should be monotonically non-increasing")
    // After 50 steps, V should be much smaller than V_0
    let vFinal = List.last history
    Assert.True(vFinal < v0 * 0.1,
        sprintf "After 50 steps, V should be < 10%% of V_0 = %e, got %e" v0 vFinal)
    // The theoretical bound should hold at each step
    history |> List.iteri (fun k vk ->
        let bound = LyapunovContraction.theoreticalBound nCells k v0
        Assert.True(vk <= bound + 1e-9,
            sprintf "V[%d] = %e should be ≤ theoretical bound %e" k vk bound))
    // The fixed point is correct
    Assert.True(LyapunovContraction.verifyFixedPoint (),
        "W_C should be the fixed point of the reseed dynamics")
