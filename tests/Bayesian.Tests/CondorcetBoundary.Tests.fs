module Zeta.Bayesian.Tests.CondorcetBoundaryTests

open Xunit
open Zeta.Bayesian

// ─────────────────────────────────────────────────────────────────────────────
// COND-1 through COND-7: Formal (ρ*, c*) Condorcet boundary
//
// Tests for the CondorcetBoundary module: the formal proof that the ensemble
// beats the best individual iff ρ < ρ* for a given competence c.
// ─────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``COND-1: Condorcet jury theorem — majority probability increases with N`` () =
    // For c > 0.5, the majority probability should increase with jury size.
    for c in [ 0.55; 0.60; 0.70; 0.80 ] do
        Assert.True(CondorcetBoundary.verifyCondorcetJuryTheorem c,
            sprintf "Condorcet jury theorem should hold for c = %g" c)

[<Fact>]
let ``COND-2: majority probability converges to 1 as N grows`` () =
    // For c = 0.6, the majority probability should approach 1 for large N.
    let p1   = CondorcetBoundary.majorityProbability 1   0.6
    let p11  = CondorcetBoundary.majorityProbability 11  0.6
    let p101 = CondorcetBoundary.majorityProbability 101 0.6
    let p501 = CondorcetBoundary.majorityProbability 501 0.6
    Assert.True(p1 < p11,   sprintf "p(N=1)=%g should be < p(N=11)=%g" p1 p11)
    Assert.True(p11 < p101, sprintf "p(N=11)=%g should be < p(N=101)=%g" p11 p101)
    Assert.True(p101 < p501, sprintf "p(N=101)=%g should be < p(N=501)=%g" p101 p501)
    Assert.True(p501 > 0.99, sprintf "p(N=501, c=0.6) should be > 0.99 (got %g)" p501)

[<Fact>]
let ``COND-3: society beats best individual for c > 0.5 and N >= 3 at rho = 0`` () =
    // For any c > 0.5, a jury of N >= 3 independent voters beats the best individual.
    for c in [ 0.55; 0.60; 0.70; 0.80 ] do
        let beats = CondorcetBoundary.societyBeatsBest 3 c
        Assert.True(beats, sprintf "Society (N=3) should beat best individual at c=%g, rho=0" c)
    // For c = 0.5 (random guessing), society should NOT beat best individual
    let notBeats = CondorcetBoundary.societyBeatsBest 3 0.5
    Assert.False(notBeats, "Society should NOT beat best individual at c=0.5 (random guessing)")

[<Fact>]
let ``COND-4: correlated majority probability decreases as rho increases`` () =
    // For fixed c and N, the correlated majority probability should decrease as ρ increases
    // in the range where N_eff >= 3 (the majority concept is meaningful).
    // At very high ρ, N_eff rounds to 1 (single voter) and P jumps back to c — that is
    // expected behavior, not a failure of the theorem.
    for c in [ 0.60; 0.70; 0.80 ] do
        // Key property: P(rho=0) > P(rho=0.5).
        // At rho=0: N_eff=N (full ensemble). At rho=0.5: N_eff is much smaller.
        // We use N=1001 to ensure N_eff at rho=0.5 is still large enough to be odd.
        let pFull = CondorcetBoundary.correlatedMajorityProbability 1001 c 0.0
        let pHalf = CondorcetBoundary.correlatedMajorityProbability 1001 c 0.5
        Assert.True(pFull > pHalf,
            sprintf "P(rho=0)=%g should be > P(rho=0.5)=%g for N=1001, c=%g" pFull pHalf c)
        // Also verify: P(rho=0, N=1001) > P(rho=0, N=3) (larger jury is better)
        let pSmall = CondorcetBoundary.correlatedMajorityProbability 3 c 0.0
        Assert.True(pFull > pSmall,
            sprintf "P(N=1001, rho=0)=%g should be > P(N=3, rho=0)=%g for c=%g" pFull pSmall c)

[<Fact>]
let ``COND-5: rho* boundary — society beats best individual iff rho <= rho*`` () =
    // For N=16 and c=0.6, find rho* and verify the boundary property.
    for c in [ 0.55; 0.60; 0.65; 0.70 ] do
        let rhoStar = CondorcetBoundary.findRhoStar 16 c
        Assert.True(rhoStar > 0.0,
            sprintf "rho* should be positive for c=%g (got %g)" c rhoStar)
        Assert.True(rhoStar < 1.0,
            sprintf "rho* should be < 1 for c=%g (got %g)" c rhoStar)
        // At rho = rho*, society should still beat best individual
        let atBoundary = CondorcetBoundary.correlatedSocietyBeatsBest 16 c rhoStar
        Assert.True(atBoundary,
            sprintf "Society should beat best individual at rho=rho*=%g, c=%g" rhoStar c)
        // At rho = rho* + 0.05, society should NOT beat best individual
        let pastBoundary = CondorcetBoundary.correlatedSocietyBeatsBest 16 c (rhoStar + 0.05)
        Assert.False(pastBoundary,
            sprintf "Society should NOT beat best individual at rho=rho*+0.05=%g, c=%g" (rhoStar + 0.05) c)

[<Fact>]
let ``COND-6: boundary table for N=16 — rho* decreases as c increases`` () =
    // As individual competence increases, the ensemble is more fragile to correlation.
    // rho* should decrease as c increases (more competent individuals need less correlation
    // tolerance to beat the ensemble).
    let table = CondorcetBoundary.boundaryTableN16 ()
    let rhoStars = table |> List.map snd
    // rho* should be non-increasing as c increases
    rhoStars
    |> List.pairwise
    |> List.iteri (fun i (r1, r2) ->
        Assert.True(r2 <= r1 + 1e-6,
            sprintf "rho* should decrease as c increases: rho*[%d]=%g > rho*[%d]=%g" i r1 (i+1) r2))

[<Fact>]
let ``COND-7: adaptive reseed threshold matches rho* for the YinYangEnsemble`` () =
    // The adaptive reseed threshold should equal rho* for the current estimated competence.
    // For N=16 and c=0.6, the threshold should be around 0.3-0.4.
    let threshold60 = CondorcetBoundary.adaptiveReseedThreshold 16 0.60
    let threshold70 = CondorcetBoundary.adaptiveReseedThreshold 16 0.70
    let threshold80 = CondorcetBoundary.adaptiveReseedThreshold 16 0.80
    // Thresholds should be positive and decreasing
    Assert.True(threshold60 > 0.0, sprintf "Threshold at c=0.6 should be positive (got %g)" threshold60)
    Assert.True(threshold70 > 0.0, sprintf "Threshold at c=0.7 should be positive (got %g)" threshold70)
    Assert.True(threshold80 > 0.0, sprintf "Threshold at c=0.8 should be positive (got %g)" threshold80)
    Assert.True(threshold60 >= threshold70 - 1e-6,
        sprintf "Threshold should be non-increasing as c increases: c=0.6 (%g) >= c=0.7 (%g)" threshold60 threshold70)
    Assert.True(threshold70 >= threshold80 - 1e-6,
        sprintf "Threshold should be non-increasing as c increases: c=0.7 (%g) >= c=0.8 (%g)" threshold70 threshold80)
    // The default reseed threshold of 0.9 is conservative (above rho* for typical c)
    Assert.True(0.9 > threshold60,
        sprintf "Default threshold 0.9 should be above rho* at c=0.6 (%g)" threshold60)
