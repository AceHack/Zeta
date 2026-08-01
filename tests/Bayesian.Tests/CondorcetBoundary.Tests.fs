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

/// COND-8: The algebraic ρ*(N) formula is exact for the effective-N approximation.
/// ρ*(N) = (N-3) / (3*(N-1)) — derived from N_eff ≥ 3 condition.
[<Fact>]
let ``COND-8: algebraic rho*(N) formula matches binary-search result`` () =
    for n in [ 11; 21; 51; 101; 201 ] do
        let algebraic = CondorcetBoundary.rhoStarAlgebraic n
        let binarySearch = CondorcetBoundary.findRhoStar n 0.6
        Assert.True(
            abs (algebraic - binarySearch) < 0.02,
            sprintf "Algebraic rho*(N=%d)=%f should match binary search %f" n algebraic binarySearch)

/// COND-9: The ρ* → 1/3 limit holds as N → ∞, independent of competence c.
/// This is the information-theoretic event horizon: the causal light cone closes at ρ = 1/3.
[<Fact>]
let ``COND-9: rho* converges to 1/3 as N grows, independent of c`` () =
    Assert.True(
        CondorcetBoundary.verifyRhoStarLimit (),
        "ρ*(N=100001) should be within 1e-5 of 1/3")
    // The limit is exactly 1/3
    Assert.True(
        abs (CondorcetBoundary.rhoStarLimit - (1.0/3.0)) < 1e-15,
        sprintf "ρ* limit should be exactly 1/3, got %f" CondorcetBoundary.rhoStarLimit)
    // rhoStarAlgebraic is independent of c (it only depends on N)
    // Verify: rhoStarAlgebraic(10001) is the same regardless of which c we would have used
    let rhoStarLargeN = CondorcetBoundary.rhoStarAlgebraic 10001
    Assert.True(
        abs (rhoStarLargeN - (1.0/3.0)) < 0.001,
        sprintf "ρ*(N=10001) should be close to 1/3, got %f" rhoStarLargeN)

/// ⚠ **NAMING CORRECTION (Soraya audit, 2026-08-01) — the assertion below is TRUE, the name is not.**
/// `ρ*/√2 = (1/3)/√2 = 1/(3√2)` is exact arithmetic and this test is sound as an algebraic check.
/// But `1/(3√2)` is NOT a Tsirelson bound: Tsirelson's bound is `S ≤ 2√2 ≈ 2.828` on the CHSH
/// *correlator* (`src/Core/Tsirelson.fs`, S² = 8 exact). There is no Tsirelson bound on a
/// correlation coefficient. `ρ_T` is the image of 2√2 under the FREELY CHOSEN linear map ρ = S/12 —
/// a design parameter, documented as such in
/// `docs/research/2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md`
/// This test therefore pins a DESIGN CHOICE (useful — it stops silent drift), not a law of physics.
/// §A #15 (Generalized Condorcet / ΔU-aggregation) cites this file but does NOT depend on this test:
/// its claim rests on ρ*(N) = (N−3)/(3(N−1)), proved in `docs/research/rhostar-analytic-proof.md`.
/// COND-10: The chosen operating point ρ_T = 1/(3√2) ≈ 0.236 is the reseed threshold.
///
/// The Bell inequality triangle maps onto the three ρ regimes:
///   S = 4  (ρ > 1/3):      superdeterminism / common seed — groupthink, useless ensemble
///   S = 2√2 (ρ ≈ 1/(3√2)): Tsirelson bound / quantum entanglement — optimal operating point
///   S = 2  (ρ < 1/(3√2)):  classical local realism — fully decorrelated, maximum diversity
///
/// The optimal reseed threshold is ρ_T = ρ*/√2 = 1/(3√2) ≈ 0.236, not ρ* = 1/3.
/// This gives a safety margin before groupthink fully sets in.
[<Fact>]
let ``COND-10: Tsirelson operating point is rho* / sqrt(2) = 1/(3*sqrt(2))`` () =
    let rhoStar = CondorcetBoundary.rhoStarLimit  // = 1/3
    let tsirelson = rhoStar / sqrt 2.0            // = 1/(3*sqrt(2)) ≈ 0.2357
    let expected = 1.0 / (3.0 * sqrt 2.0)
    Assert.True(
        abs (tsirelson - expected) < 1e-12,
        sprintf "Tsirelson point should be 1/(3√2) ≈ %f, got %f" expected tsirelson)
    // The Tsirelson point is strictly between S=2 (fully decorrelated) and S=4 (superdetermined)
    Assert.True(tsirelson > 0.0,  "Tsirelson point should be > 0 (above fully decorrelated)")
    Assert.True(tsirelson < rhoStar, "Tsirelson point should be < ρ* = 1/3 (below event horizon)")
    // Numerically: ≈ 0.2357
    Assert.True(
        abs (tsirelson - 0.2357) < 0.001,
        sprintf "Tsirelson point should be ≈ 0.2357, got %f" tsirelson)

// ─────────────────────────────────────────────────────────────────────────────
// RHO-STAR-1 through RHO-STAR-5: Analytic proof discharge tests
//
// These tests pin each step of the analytic proof in
// docs/research/rhostar-analytic-proof.md.
// ─────────────────────────────────────────────────────────────────────────────

/// RHO-STAR-1: Dunnett–Sobel N_eff formula is exact for exchangeable correlations.
/// N_eff(N, ρ) = N / (1 + (N-1)*ρ).
[<Fact>]
let ``RHO-STAR-1: effectiveN formula matches Dunnett-Sobel derivation`` () =
    // At ρ = 0: N_eff = N (fully independent)
    Assert.Equal(16.0, CondorcetBoundary.effectiveN 16 0.0, 12)
    // At ρ = 1: N_eff = 1 (fully correlated — one effective voter)
    Assert.Equal(1.0, CondorcetBoundary.effectiveN 16 1.0, 12)
    // At ρ = 1/3: N_eff = N / (1 + (N-1)/3) = 3N / (3 + N - 1) = 3N / (N + 2)
    // For N = 16: N_eff = 48 / 18 = 2.666...
    let nEff16AtRhoStar = CondorcetBoundary.effectiveN 16 (1.0 / 3.0)
    Assert.True(
        abs (nEff16AtRhoStar - (48.0 / 18.0)) < 1e-10,
        sprintf "N_eff(16, 1/3) should be 48/18 ≈ 2.667, got %f" nEff16AtRhoStar)
    // At ρ = ρ*(N): N_eff = 3 exactly
    // ρ*(N) = (N-3)/(3(N-1)) → N_eff = N / (1 + (N-1)*(N-3)/(3(N-1))) = N / (1 + (N-3)/3) = 3N/(N+0) = 3
    // Wait: 1 + (N-3)/3 = (3 + N - 3)/3 = N/3, so N_eff = N / (N/3) = 3. ✓
    for n in [ 7; 11; 16; 21; 51 ] do
        let rhoStar = CondorcetBoundary.rhoStarAlgebraic n
        let nEff = CondorcetBoundary.effectiveN n rhoStar
        Assert.True(
            abs (nEff - 3.0) < 1e-10,
            sprintf "N_eff(N=%d, rho*=%f) should be exactly 3.0, got %f" n rhoStar nEff)

/// RHO-STAR-2: The N_eff ≥ 3 condition is necessary and sufficient for ensemble advantage.
/// At N_eff = 3, the majority probability is c²(3 - 2c) > c for all c > 0.5.
[<Fact>]
let ``RHO-STAR-2: majority probability at N_eff=3 is c^2*(3-2c) and exceeds c for c > 0.5`` () =
    for c in [ 0.51; 0.55; 0.60; 0.70; 0.80; 0.90 ] do
        let pMajority = CondorcetBoundary.majorityProbability 3 c
        let pAlgebraic = c * c * (3.0 - 2.0 * c)
        // Algebraic formula matches the binomial sum
        Assert.True(
            abs (pMajority - pAlgebraic) < 1e-12,
            sprintf "P(majority | N=3, c=%g) = %f should equal c²(3-2c) = %f" c pMajority pAlgebraic)
        // And it exceeds c for all c > 0.5
        Assert.True(
            pMajority > c,
            sprintf "P(majority | N=3, c=%g) = %f should exceed c = %g" c pMajority c)
    // At N_eff = 1: P(majority) = c (no gain)
    for c in [ 0.55; 0.70 ] do
        let pSingle = CondorcetBoundary.majorityProbability 1 c
        Assert.Equal(c, pSingle, 12)

/// RHO-STAR-3: The algebraic formula ρ*(N) = (N-3)/(3(N-1)) is derived from N_eff ≥ 3.
/// Verify the algebra: N/(1+(N-1)*ρ) ≥ 3 ↔ ρ ≤ (N-3)/(3(N-1)).
[<Fact>]
let ``RHO-STAR-3: rhoStarAlgebraic satisfies N_eff = 3 exactly`` () =
    // For each N, verify that N_eff(N, rho*(N)) = 3.0 (the derivation is tight).
    for n in [ 4; 7; 10; 16; 50; 100; 1000 ] do
        let rhoStar = CondorcetBoundary.rhoStarAlgebraic n
        // Direct substitution: N / (1 + (N-1)*rho*(N))
        //   = N / (1 + (N-1)*(N-3)/(3(N-1)))
        //   = N / (1 + (N-3)/3)
        //   = N / ((3 + N - 3)/3)
        //   = N / (N/3)
        //   = 3
        let nEff = float n / (1.0 + float (n - 1) * rhoStar)
        Assert.True(
            abs (nEff - 3.0) < 1e-9,
            sprintf "N_eff(N=%d, rho*(N)=%f) should be 3.0, got %f" n rhoStar nEff)
    // For N ≤ 3: rhoStarAlgebraic = 0 (no positive threshold exists)
    Assert.Equal(0.0, CondorcetBoundary.rhoStarAlgebraic 3)
    Assert.Equal(0.0, CondorcetBoundary.rhoStarAlgebraic 1)

/// RHO-STAR-4: The limit ρ*(N) → 1/3 as N → ∞ is independent of c.
/// Verify the convergence rate: |ρ*(N) - 1/3| = O(1/N).
[<Fact>]
let ``RHO-STAR-4: rho*(N) converges to 1/3 at rate O(1/N) independent of c`` () =
    // The exact error: ρ*(N) - 1/3 = (N-3)/(3(N-1)) - 1/3
    //   = [(N-3) - (N-1)] / (3(N-1))
    //   = -2 / (3(N-1))
    // So |ρ*(N) - 1/3| = 2/(3(N-1)) = O(1/N). ✓
    for n in [ 10; 100; 1000; 10000 ] do
        let rhoStar = CondorcetBoundary.rhoStarAlgebraic n
        let error = abs (rhoStar - 1.0 / 3.0)
        let expectedError = 2.0 / (3.0 * float (n - 1))
        Assert.True(
            abs (error - expectedError) < 1e-12,
            sprintf "Error |ρ*(N=%d) - 1/3| = %e should equal 2/(3(N-1)) = %e" n error expectedError)
    // The limit is independent of c: rhoStarAlgebraic does not take c as a parameter.
    // Verify that the binary-search result at moderate N matches the algebraic formula for multiple c values.
    // Note: findRhoStar uses binomial coefficients which overflow for very large N;
    // we use N=201 (the largest N tested in COND-8) for the cross-validation.
    let n = 201
    let algebraic = CondorcetBoundary.rhoStarAlgebraic n
    for c in [ 0.55; 0.65; 0.75; 0.85 ] do
        let binarySearch = CondorcetBoundary.findRhoStar n c
        Assert.True(
            abs (algebraic - binarySearch) < 0.02,
            sprintf "ρ*(N=%d) algebraic=%f should match binary-search at c=%g (%f)" n algebraic c binarySearch)

/// ⚠ **NAMING CORRECTION (Soraya audit, 2026-08-01) — the assertion below is TRUE, the name is not.**
/// `ρ*/√2 = (1/3)/√2 = 1/(3√2)` is exact arithmetic and this test is sound as an algebraic check.
/// But `1/(3√2)` is NOT a Tsirelson bound: Tsirelson's bound is `S ≤ 2√2 ≈ 2.828` on the CHSH
/// *correlator* (`src/Core/Tsirelson.fs`, S² = 8 exact). There is no Tsirelson bound on a
/// correlation coefficient. `ρ_T` is the image of 2√2 under the FREELY CHOSEN linear map ρ = S/12 —
/// a design parameter, documented as such in
/// `docs/research/2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md`
/// This test therefore pins a DESIGN CHOICE (useful — it stops silent drift), not a law of physics.
/// §A #15 (Generalized Condorcet / ΔU-aggregation) cites this file but does NOT depend on this test:
/// its claim rests on ρ*(N) = (N−3)/(3(N−1)), proved in `docs/research/rhostar-analytic-proof.md`.
/// RHO-STAR-5: The chosen threshold ρ_T = ρ*/√2 = 1/(3√2) is the reseed point.
/// Verify: ρ_T < ρ* = 1/3 (safety margin), and ρ_T = YinYangEnsemble.tsirelsonThreshold.
[<Fact>]
let ``RHO-STAR-5: Tsirelson threshold is rho*/sqrt(2) and matches YinYangEnsemble.tsirelsonThreshold`` () =
    let rhoStarLimit = CondorcetBoundary.rhoStarLimit  // = 1/3
    let tsirelsonFromProof = rhoStarLimit / sqrt 2.0   // = 1/(3√2) ≈ 0.2357
    let tsirelsonFromEnsemble = YinYangEnsemble.tsirelsonThreshold
    // The two constants must agree to machine precision
    Assert.True(
        abs (tsirelsonFromProof - tsirelsonFromEnsemble) < 1e-12,
        sprintf "Tsirelson from proof (%f) should match YinYangEnsemble.tsirelsonThreshold (%f)"
            tsirelsonFromProof tsirelsonFromEnsemble)
    // ρ_T < ρ* (safety margin)
    Assert.True(
        tsirelsonFromEnsemble < rhoStarLimit,
        sprintf "Tsirelson (%f) should be < ρ* = 1/3 (%f)" tsirelsonFromEnsemble rhoStarLimit)
    // ρ_T > 0 (above fully decorrelated)
    Assert.True(tsirelsonFromEnsemble > 0.0, "Tsirelson threshold should be > 0")
    // Numerically: ≈ 0.2357
    Assert.True(
        abs (tsirelsonFromEnsemble - 0.2357) < 0.001,
        sprintf "Tsirelson threshold should be ≈ 0.2357, got %f" tsirelsonFromEnsemble)
    // The safety margin is exactly 1 - 1/√2 ≈ 29.3% below the event horizon
    let safetyMargin = (rhoStarLimit - tsirelsonFromEnsemble) / rhoStarLimit
    Assert.True(
        abs (safetyMargin - (1.0 - 1.0 / sqrt 2.0)) < 1e-10,
        sprintf "Safety margin should be 1 - 1/√2 ≈ 0.293, got %f" safetyMargin)
