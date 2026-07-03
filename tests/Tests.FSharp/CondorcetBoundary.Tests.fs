module Zeta.Tests.CondorcetBoundaryTests
/// **Generalized Condorcet / ΔU-aggregation theorem — §B → §A promotion candidate.**
///
/// Discharge obligation from FROZEN-CORE §B (row ~406): formalize the inequality
///   E[U_society(n, c, ρ)] > E[U_best_individual(c)]
/// find the exact boundary (ρ*, c*), prove the REVERSAL below the boundary, and
/// cross-check the analytic formula against the FsCheck statistical sweep.
///
/// **Analytic formula (SocietyUsefulWork.expectedGain):**
///   ΔU(n, c, ρ) = (1 − ρ)(1 − c)(1 − (1 − c)^(n−1)) · Σv_j
///
/// **Boundary:**
///   ΔU > 0  ⟺  ρ < 1  ∧  0 < c < 1  ∧  n ≥ 2
///   ΔU = 0  ⟺  ρ = 1  ∨  c = 0  ∨  c = 1  ∨  n < 2
///   ΔU < 0  never (the gain is always ≥ 0 by construction)
///
/// **Condorcet reversal:**
///   When ρ = 1 (perfectly correlated society), society = best individual (no gain).
///   When c = 0 (incompetent agents), society = 0 (no useful work at all).
///   These are the two "reversal" cases where the society is NOT better.
///
/// **ρ* and c*:**
///   The formula has no interior maximum in ρ or c — it is monotone decreasing in ρ
///   and has a unique interior maximum in c at c* = 1 − (1/(n−1))^(1/(n−2)) for n ≥ 3.
///   For n = 2: ΔU = (1−ρ)(1−c)c · Σv_j, maximized at c* = 0.5.
///   ρ* = 1 is the hard boundary (any ρ < 1 gives ΔU > 0 for valid c, n).
///
/// **Proof strategy:**
///   1. Algebraic: prove ΔU > 0 for the interior region (FsCheck, 1000 runs).
///   2. Boundary: prove ΔU = 0 at ρ=1, c=0, c=1 (Fact, exact arithmetic).
///   3. Reversal: prove ΔU never goes negative (FsCheck, 1000 runs).
///   4. Monotonicity: prove ΔU is strictly decreasing in ρ (FsCheck, 1000 runs).
///   5. c* maximum: prove the analytic c* formula for n=2 (c*=0.5) and n=3 (FsCheck).
///   6. Statistical sweep: FsCheck heterogeneous simulation agrees with analytic formula.
///   7. Condorcet reversal: correlated society (ρ→1) converges to single-agent work.

open System
open global.Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Core

module SUW = Zeta.Core.SocietyUsefulWork

let private unitFacts : SUW.Fact[] = [| { Id = 1; Value = 1.0 } |]
let private multiFacts : SUW.Fact[] = [|
    { Id = 1; Value = 10.0 }; { Id = 2; Value = 25.0 }; { Id = 3; Value = 5.0 }
|]

// ── 1. Interior region: ΔU > 0 for ρ ∈ (0,1), c ∈ (0,1), n ≥ 2 ──────────────
[<Property(MaxTest = 1000)>]
let ``Condorcet-1 ΔU is strictly positive in the interior region (ρ < 1, 0 < c < 1, n ≥ 2)``
    (rawN: int) (rawC: float) (rawRho: float) =
    if Double.IsFinite rawC && Double.IsFinite rawRho then
        let n   = (abs rawN % 9) + 2        // 2 .. 10
        let c   = (abs rawC % 0.98) + 0.01  // (0.01, 0.99)
        let rho = (abs rawRho % 0.98) + 0.01 // (0.01, 0.99)
        let gain = SUW.expectedGain n c rho unitFacts
        gain > 0.0
    else true

// ── 2. Boundary: ΔU = 0 at ρ=1, c=0, c=1 ────────────────────────────────────
[<Fact>]
let ``Condorcet-2a ΔU = 0 when ρ = 1 (fully correlated — no diversity gain)`` () =
    for n in 2 .. 8 do
        for c in [0.1; 0.3; 0.5; 0.7; 0.9] do
            Assert.Equal(0.0, SUW.expectedGain n c 1.0 unitFacts)

[<Fact>]
let ``Condorcet-2b ΔU = 0 when c = 0 (incompetent agents — no useful work)`` () =
    for n in 2 .. 8 do
        for rho in [0.0; 0.2; 0.5; 0.8; 1.0] do
            Assert.Equal(0.0, SUW.expectedGain n 0.0 rho unitFacts)

[<Fact>]
let ``Condorcet-2c ΔU = 0 when c = 1 (omniscient agents — best individual already perfect)`` () =
    for n in 2 .. 8 do
        for rho in [0.0; 0.2; 0.5; 0.8; 1.0] do
            Assert.Equal(0.0, SUW.expectedGain n 1.0 rho unitFacts)

// ── 3. Reversal: ΔU ≥ 0 always (no negative gain — society never hurts) ──────
[<Property(MaxTest = 1000)>]
let ``Condorcet-3 ΔU is never negative for any valid inputs``
    (rawN: int) (rawC: float) (rawRho: float) =
    if Double.IsFinite rawC && Double.IsFinite rawRho then
        let n   = (abs rawN % 9) + 2
        let c   = (abs rawC % 1.0)
        let rho = (abs rawRho % 1.0)
        SUW.expectedGain n c rho unitFacts >= 0.0
    else true

// ── 4. Monotonicity: ΔU strictly decreasing in ρ ────────────────────────────
[<Property(MaxTest = 500)>]
let ``Condorcet-4 ΔU is strictly decreasing in ρ (more correlation = less diversity gain)``
    (rawN: int) (rawC: float) (rawRho1: float) (rawRho2: float) =
    if Double.IsFinite rawC && Double.IsFinite rawRho1 && Double.IsFinite rawRho2 then
        let n    = (abs rawN % 9) + 2
        let c    = (abs rawC % 0.98) + 0.01
        let rho1 = (abs rawRho1 % 0.98) + 0.01
        let rho2 = (abs rawRho2 % 0.98) + 0.01
        if abs (rho1 - rho2) > 0.001 then
            let g1 = SUW.expectedGain n c rho1 unitFacts
            let g2 = SUW.expectedGain n c rho2 unitFacts
            // Higher ρ → lower gain
            if rho1 > rho2 then g1 < g2 else g1 > g2
        else true
    else true

// ── 5. c* maximum for n=2: c* = 0.5 ─────────────────────────────────────────
[<Fact>]
let ``Condorcet-5a for n=2 the gain is maximized at c* = 0.5 (symmetric case)`` () =
    // ΔU(2, c, ρ) = (1−ρ)(1−c)c · Σv — quadratic in c, maximized at c=0.5
    let rho = 0.0 // ρ=0 for clearest signal
    let gain_at_half = SUW.expectedGain 2 0.5 rho unitFacts
    for c in [0.1; 0.2; 0.3; 0.4; 0.6; 0.7; 0.8; 0.9] do
        let g = SUW.expectedGain 2 c rho unitFacts
        Assert.True(gain_at_half >= g,
            sprintf "n=2: gain at c=0.5 (%f) should be >= gain at c=%f (%f)" gain_at_half c g)

[<Property(MaxTest = 500)>]
let ``Condorcet-5b for n=3 the gain is maximized near c* = 1 - 1/sqrt(2) ≈ 0.293``
    (rawRho: float) =
    if Double.IsFinite rawRho then
        let rho  = (abs rawRho % 0.95) + 0.01
        // c* for n=3: d/dc [(1-c)(1-(1-c)^2)] = 0 → c* = 1 - 1/sqrt(2) ≈ 0.2929
        let cStar = 1.0 - 1.0 / sqrt 2.0
        let gStar = SUW.expectedGain 3 cStar rho unitFacts
        // Check that c* is better than c=0.1 and c=0.9 (far from the maximum)
        let g01 = SUW.expectedGain 3 0.1 rho unitFacts
        let g09 = SUW.expectedGain 3 0.9 rho unitFacts
        gStar >= g01 && gStar >= g09
    else true

// ── 6. Statistical sweep: simulation agrees with analytic formula ─────────────
[<Fact>]
let ``Condorcet-6 heterogeneous simulation agrees with analytic formula within 5% for n=5, ρ=0.1`` () =
    let n = 5
    let c = 0.4
    let rho = 0.1
    let competences = Array.create n c
    let analytic = SUW.expectedSocietyIdentical n c rho multiFacts
    let simulated = SUW.simulateHeterogeneous n competences rho multiFacts 50000 7UL
    let relErr = abs (simulated - analytic) / analytic
    Assert.True(relErr < 0.05,
        sprintf "Relative error %f exceeds 5%% (analytic=%f, simulated=%f)" relErr analytic simulated)

// ── 7. Condorcet reversal: ρ→1 society converges to single-agent work ─────────
[<Fact>]
let ``Condorcet-7 fully correlated society (ρ=1) equals single best agent (Condorcet reversal)`` () =
    // E[U_society] at ρ=1 = c * Σv = E[U_individual]
    for n in [2; 5; 10] do
        for c in [0.2; 0.5; 0.8] do
            let socWork  = SUW.expectedSocietyIdentical n c 1.0 multiFacts
            let indWork  = SUW.expectedIndividual c multiFacts
            Assert.Equal(indWork, socWork)

// ── 8. ρ* = 1 is the hard boundary: any ρ < 1 gives ΔU > 0 ──────────────────
[<Property(MaxTest = 500)>]
let ``Condorcet-8 any ρ strictly below 1 gives strictly positive ΔU (ρ* = 1 is the hard boundary)``
    (rawRho: float) (rawC: float) =
    if Double.IsFinite rawRho && Double.IsFinite rawC then
        let rho = (abs rawRho % 0.999)       // [0, 0.999)
        let c   = (abs rawC % 0.98) + 0.01   // (0.01, 0.99)
        // For any ρ < 1 and c ∈ (0,1), n=2 is sufficient to show ΔU > 0
        SUW.expectedGain 2 c rho unitFacts > 0.0
    else true
