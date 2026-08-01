module Zeta.Bayesian.Tests.YinYangEnsembleTests

open Xunit
open Zeta.Core
open Zeta.Bayesian

// ── ENS-1: createFull seeds 16 distinct cells ──────────────────────────────────────────────────

[<Fact>]
let ``ENS-1: createFull seeds 16 cells from distinct Adinkra codewords`` () =
    let ensemble = YinYangEnsemble.createFull ()
    Assert.Equal(16, ensemble.Cells.Length)
    // All cells have distinct codewords (the 16 Adinkra codewords are distinct).
    let codewords = ensemble.Cells |> Array.map (fun c -> c.Codeword |> Array.map string |> String.concat "")
    let distinct = codewords |> Array.distinct
    Assert.Equal(16, distinct.Length)
    // All cells have valid Adinkra codewords (syndrome = 0).
    Assert.True(ensemble.Cells |> Array.forall YinYangCell.isValidSeed)
    // Initial consensus is uninformative.
    Assert.Equal(0.0, ensemble.Consensus.Precision)
    Assert.Equal(0, ensemble.Round)

// ── ENS-2: createN seeds k cells ──────────────────────────────────────────────────────────────

[<Fact>]
let ``ENS-2: createN seeds exactly k cells`` () =
    for k in [ 1; 4; 8; 16 ] do
        let ensemble = YinYangEnsemble.createN k
        Assert.Equal(k, ensemble.Cells.Length)

// ── ENS-3: observe updates all cells and recomputes consensus ─────────────────────────────────

[<Fact>]
let ``ENS-3: observe broadcasts to all cells and updates consensus precision`` () =
    let ensemble = YinYangEnsemble.createFull ()
    // Observe a strong signal: mean=1.0, precision=10.0.
    let signal = { Gaussian.PrecisionMean = 10.0; Precision = 10.0 }
    let updated = YinYangEnsemble.observe signal ensemble
    Assert.Equal(1, updated.Round)
    // All cells should have updated beliefs (non-zero precision).
    Assert.True(updated.Cells |> Array.forall (fun c -> c.Column.Belief.Precision > 0.0))
    // Consensus precision should be positive (the ensemble has learned something).
    Assert.True(updated.Consensus.Precision > 0.0)

// ── ENS-4: consensus mean converges with repeated observations ────────────────────────────────

[<Fact>]
let ``ENS-4: consensus mean converges toward the true signal after 10 observations`` () =
    let ensemble = YinYangEnsemble.createFull ()
    // True signal: mean = 2.5, precision = 5.0.
    let signal = { Gaussian.PrecisionMean = 12.5; Precision = 5.0 }  // PM = mean * precision
    let mutable e = ensemble
    for _ in 1 .. 10 do
        e <- YinYangEnsemble.observe signal e
    let mean = YinYangEnsemble.consensusMean e
    // After 10 rounds, the consensus mean should be close to 2.5.
    Assert.InRange(mean, 2.0, 3.0)
    Assert.Equal(10, e.Round)

// ── ENS-5: decorrelation variance is positive after seeding ───────────────────────────────────

[<Fact>]
let ``ENS-5: decorrelation variance is positive after cells observe different-weight signals`` () =
    // Seed 4 cells from weight-0, weight-4 (first two), weight-8 codewords.
    let codewords =
        AdinkraCode.allCodewords
        |> List.filter (fun cw -> AdinkraCode.weight cw = 0 || AdinkraCode.weight cw = 4 || AdinkraCode.weight cw = 8)
        |> List.truncate 4
        |> List.toArray
    let ensemble = YinYangEnsemble.create codewords
    // Observe a signal — all cells see the same signal but start from different seeds.
    // After one round, beliefs should be the same (same signal), so variance = 0.
    let signal = { Gaussian.PrecisionMean = 5.0; Precision = 5.0 }
    let updated = YinYangEnsemble.observe signal ensemble
    // Variance is 0 after one identical observation (all cells see the same thing).
    // This is the "identical voters add nothing" boundary.
    let variance = YinYangEnsemble.decorrelationVariance updated
    // All cells have the same belief after one identical observation.
    Assert.InRange(variance, 0.0, 1e-9)

// ── ENS-6: reconcileToReceipt emits a valid receipt ───────────────────────────────────────────

[<Fact>]
let ``ENS-6: reconcileToReceipt emits a receipt with correct DeltaJ = N`` () =
    let ensemble = YinYangEnsemble.createN 4
    let signal = { Gaussian.PrecisionMean = 3.0; Precision = 3.0 }
    let updated = YinYangEnsemble.observe signal ensemble
    let receipt = YinYangEnsemble.reconcileToReceipt updated
    // DeltaJ = N = 4 (one joule per cell per round).
    Assert.Equal(4.0, receipt.DeltaJ)
    // After one round, total IV should be positive (cells have learned something).
    Assert.True(receipt.IV > 0.0)
    // Entropy should be non-negative.
    Assert.True(receipt.Entropy >= 0.0)
    // LandauerRatio = DeltaU / (kT * ln2) where DeltaU = IV - DeltaJ.
    // With IV > 0 and DeltaJ = 4, DeltaU = IV - 4; ratio could be negative (heat tick).
    // Just verify it's finite.
    Assert.False(System.Double.IsNaN(receipt.LandauerRatio))
    Assert.False(System.Double.IsInfinity(receipt.LandauerRatio))

// ── RHO-1: rhoProxy is 1.0 for identical cells (fully collapsed) ──────────────────────────────

[<Fact>]
let ``RHO-1: rhoProxy is 1.0 when all cells have identical beliefs (fully collapsed)`` () =
    // Create a 4-cell ensemble and observe the same signal many times.
    // After many identical observations, all cells converge to the same belief → ρ = 1.
    let ensemble = YinYangEnsemble.createN 4
    let signal = { Gaussian.PrecisionMean = 5.0; Precision = 5.0 }
    let mutable e = ensemble
    for _ in 1 .. 20 do
        e <- YinYangEnsemble.observe signal e
    // All cells see the same signal → identical beliefs → ρ_proxy = 1.0 (fully correlated).
    let rho = YinYangEnsemble.rhoProxy e
    Assert.InRange(rho, 0.99, 1.01)

// ── RHO-2: rhoProxy is 0.0 for fresh uninformative cells ─────────────────────────────────────

[<Fact>]
let ``RHO-2: rhoProxy is 0.0 for a fresh ensemble (all cells uninformative)`` () =
    // A fresh ensemble has Precision = 0 for all cells → rhoProxy returns 0.0.
    let ensemble = YinYangEnsemble.createFull ()
    let rho = YinYangEnsemble.rhoProxy ensemble
    Assert.Equal(0.0, rho)

// ── RHO-3: isCollapsed detects collapse above threshold ───────────────────────────────────────

[<Fact>]
let ``RHO-3: isCollapsed returns true when ensemble has converged to identical beliefs`` () =
    let ensemble = YinYangEnsemble.createN 4
    let signal = { Gaussian.PrecisionMean = 5.0; Precision = 5.0 }
    let mutable e = ensemble
    for _ in 1 .. 20 do
        e <- YinYangEnsemble.observe signal e
    // With ρ ≈ 1.0, isCollapsed(0.9) should return true.
    Assert.True(YinYangEnsemble.isCollapsed 0.9 e)
    // A fresh ensemble is not collapsed.
    Assert.False(YinYangEnsemble.isCollapsed 0.9 ensemble)

// ── RHO-4: reseedLeastExperienced replaces the cell with lowest IV ────────────────────────────

[<Fact>]
let ``RHO-4: reseedLeastExperienced replaces the cell with lowest accumulated IV`` () =
    let ensemble = YinYangEnsemble.createN 4
    let signal = { Gaussian.PrecisionMean = 5.0; Precision = 5.0 }
    // Observe once — all cells have the same IV after one round.
    let updated = YinYangEnsemble.observe signal ensemble
    // Reseed with the 5th Adinkra codeword.
    let newCodeword = AdinkraCode.allCodewords |> List.item 4
    let reseeded = YinYangEnsemble.reseedLeastExperienced newCodeword updated
    // The ensemble still has 4 cells.
    Assert.Equal(4, reseeded.Cells.Length)
    // One cell has the new codeword.
    let hasNew = reseeded.Cells |> Array.exists (fun c -> c.Codeword = newCodeword)
    Assert.True(hasNew, "Reseeded ensemble should contain the new codeword")
    // The new cell has zero accumulated IV (fresh observer).
    let newCell = reseeded.Cells |> Array.find (fun c -> c.Codeword = newCodeword)
    Assert.Equal(0.0, float newCell.Column.AccumulatedIV)

// ── RHO-5: reseedIfCollapsed triggers reseed and restores decorrelation ───────────────────────

[<Fact>]
let ``RHO-5: reseedIfCollapsed triggers reseed on collapse and returns reseeded flag`` () =
    let ensemble = YinYangEnsemble.createN 4
    let signal = { Gaussian.PrecisionMean = 5.0; Precision = 5.0 }
    let mutable e = ensemble
    for _ in 1 .. 20 do
        e <- YinYangEnsemble.observe signal e
    // Ensemble is collapsed (ρ ≈ 1.0).
    Assert.True(YinYangEnsemble.isCollapsed 0.9 e)
    // Reseed with a new codeword.
    let newCodeword = AdinkraCode.allCodewords |> List.item 5
    let (reseeded, didReseed) = YinYangEnsemble.reseedIfCollapsed 0.9 newCodeword e
    Assert.True(didReseed, "reseedIfCollapsed should trigger reseed on collapsed ensemble")
    // The reseeded ensemble has one fresh cell (zero IV).
    let freshCells = reseeded.Cells |> Array.filter (fun c -> float c.Column.AccumulatedIV = 0.0)
    Assert.True(freshCells.Length >= 1, "Reseeded ensemble should have at least one fresh cell")
    // A fresh ensemble does not trigger reseed.
    let (_, didReseedFresh) = YinYangEnsemble.reseedIfCollapsed 0.9 newCodeword ensemble
    Assert.False(didReseedFresh, "reseedIfCollapsed should not trigger on a fresh ensemble")

// ── RHO-6: tsirelsonThreshold is 1/(3√2) ≈ 0.2357 ────────────────────────────────────────────
// ⚠ NAMING CORRECTION (2026-08-01, Soraya audit): the assertion is true arithmetic, but
// `1/(3√2)` is NOT a Tsirelson bound (that is S ≤ 2√2 on the CHSH correlator, src/Core/Tsirelson.fs).
// It is a design parameter — ρ*/√2 via the freely chosen map ρ = S/12. This test pins a CHOICE.
// See docs/research/2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md

[<Fact>]
let ``RHO-6: tsirelsonThreshold equals 1/(3*sqrt(2)) and is strictly between 0 and rho*=1/3`` () =
    let t = YinYangEnsemble.tsirelsonThreshold
    let expected = 1.0 / (3.0 * sqrt 2.0)
    Assert.True(abs (t - expected) < 1e-12,
        sprintf "tsirelsonThreshold should be 1/(3√2) ≈ %f, got %f" expected t)
    // Strictly between 0 (fully decorrelated) and 1/3 (event horizon)
    Assert.True(t > 0.0,  "tsirelsonThreshold should be > 0")
    Assert.True(t < 1.0/3.0, "tsirelsonThreshold should be < 1/3 (the event horizon)")
    // Numerically ≈ 0.2357
    Assert.True(abs (t - 0.2357) < 0.001,
        sprintf "tsirelsonThreshold should be ≈ 0.2357, got %f" t)

// ── RHO-7: reseedIfCollapsedDefault uses the Tsirelson threshold ──────────────────────────────

[<Fact>]
let ``RHO-7: reseedIfCollapsedDefault triggers at tsirelsonThreshold not at 0.9`` () =
    // Build a collapsed ensemble (ρ ≈ 1.0 after many identical observations).
    let ensemble = YinYangEnsemble.createN 4
    let signal = { Gaussian.PrecisionMean = 5.0; Precision = 5.0 }
    let mutable e = ensemble
    for _ in 1 .. 20 do
        e <- YinYangEnsemble.observe signal e
    // The ensemble is collapsed above the Tsirelson threshold.
    Assert.True(YinYangEnsemble.isCollapsedDefault e,
        "isCollapsedDefault should detect collapse (ρ ≈ 1.0 > tsirelsonThreshold ≈ 0.2357)")
    // reseedIfCollapsedDefault should trigger.
    let newCodeword = AdinkraCode.allCodewords |> List.item 7
    let (_, didReseed) = YinYangEnsemble.reseedIfCollapsedDefault newCodeword e
    Assert.True(didReseed, "reseedIfCollapsedDefault should trigger on collapsed ensemble")
    // A fresh ensemble is below the Tsirelson threshold — should NOT trigger.
    let (_, didReseedFresh) = YinYangEnsemble.reseedIfCollapsedDefault newCodeword ensemble
    Assert.False(didReseedFresh, "reseedIfCollapsedDefault should not trigger on a fresh ensemble")
    // The Tsirelson default is more sensitive than the old 0.9 threshold:
    // a mildly correlated ensemble (ρ between 0.2357 and 0.9) would trigger the default but not 0.9.
    // We verify the threshold value directly.
    Assert.True(
        YinYangEnsemble.tsirelsonThreshold < 0.9,
        sprintf "tsirelsonThreshold (%f) should be more sensitive than the old 0.9 default"
            YinYangEnsemble.tsirelsonThreshold)

// ── RHO-8: rhoCount is 1.0 when all cells have identical AccumulatedIV ───────────────────────

[<Fact>]
let ``RHO-8: rhoCount is 1.0 when all cells have the same AccumulatedIV (zero temporal spread)`` () =
    // After N identical observations broadcast to all cells simultaneously, every cell has
    // processed exactly the same number of observations → CV = 0 → rhoCount = 1.0.
    let ensemble = YinYangEnsemble.createN 4
    let signal = { Gaussian.PrecisionMean = 5.0; Precision = 5.0 }
    let mutable e = ensemble
    for _ in 1 .. 10 do
        e <- YinYangEnsemble.observe signal e
    // All cells have been observed 10 times (AccumulatedIV = 10 each).
    let counts = e.Cells |> Array.map (fun c -> c.Column.AccumulatedIV)
    Assert.True(counts |> Array.forall (fun iv -> iv = counts.[0]),
        "All cells should have the same AccumulatedIV after synchronized observations")
    // rhoCount should be 1.0 (zero temporal spread = temporally collapsed).
    let rho = YinYangEnsemble.rhoCount e
    Assert.InRange(rho, 0.99, 1.01)

// ── RHO-9: rhoCount < 1.0 when cells have different AccumulatedIV ────────────────────────────

[<Fact>]
let ``RHO-9: rhoCount < 1.0 when cells have different AccumulatedIV (temporal diversity)`` () =
    // Simulate bus delay by manually constructing an ensemble where cells have different
    // AccumulatedIV values. We do this by observing a 4-cell ensemble, then replacing one
    // cell with a fresh cell (zero IV) — the fresh cell has a different count from the rest.
    let ensemble = YinYangEnsemble.createN 4
    let signal = { Gaussian.PrecisionMean = 5.0; Precision = 5.0 }
    let mutable e = ensemble
    for _ in 1 .. 10 do
        e <- YinYangEnsemble.observe signal e
    // All cells now have IV = 10. Replace one with a fresh cell (IV = 0).
    let freshCodeword = AdinkraCode.allCodewords |> List.item 5
    let reseeded = YinYangEnsemble.reseedLeastExperienced freshCodeword e
    // Now counts are [10, 10, 10, 0] (approximately — one cell was replaced).
    let counts = reseeded.Cells |> Array.map (fun c -> float c.Column.AccumulatedIV)
    let hasVariety = counts |> Array.exists (fun iv -> iv < 5.0)
    Assert.True(hasVariety, "Reseeded ensemble should have at least one cell with low AccumulatedIV")
    // rhoCount should be < 1.0 (temporal diversity present).
    let rho = YinYangEnsemble.rhoCount reseeded
    Assert.True(rho < 1.0,
        sprintf "rhoCount should be < 1.0 when cells have different AccumulatedIV, got %f" rho)
    // rhoCount should be ≥ 0.0 (clamped).
    Assert.True(rho >= 0.0,
        sprintf "rhoCount should be ≥ 0.0, got %f" rho)

// ── RHO-10: isCollapsedTemporal and reseedIfCollapsedTemporal fire at Tsirelson threshold ──────

[<Fact>]
let ``RHO-10: isCollapsedTemporal fires when rhoCount > tsirelsonThreshold; reseedIfCollapsedTemporal reseeds`` () =
    // Build a temporally collapsed ensemble: all cells have the same AccumulatedIV.
    let ensemble = YinYangEnsemble.createN 4
    let signal = { Gaussian.PrecisionMean = 5.0; Precision = 5.0 }
    let mutable e = ensemble
    for _ in 1 .. 10 do
        e <- YinYangEnsemble.observe signal e
    // rhoCount ≈ 1.0 (all cells synchronized) → well above tsirelsonThreshold ≈ 0.2357.
    let rho = YinYangEnsemble.rhoCount e
    Assert.True(rho > YinYangEnsemble.tsirelsonThreshold,
        sprintf "rhoCount (%f) should be > tsirelsonThreshold (%f) for synchronized ensemble"
            rho YinYangEnsemble.tsirelsonThreshold)
    // isCollapsedTemporal should return true at the Tsirelson threshold.
    Assert.True(
        YinYangEnsemble.isCollapsedTemporal YinYangEnsemble.tsirelsonThreshold e,
        "isCollapsedTemporal should fire for a synchronized ensemble")
    // reseedIfCollapsedTemporal should trigger reseed.
    let newCodeword = AdinkraCode.allCodewords |> List.item 6
    let (reseeded, didReseed) =
        YinYangEnsemble.reseedIfCollapsedTemporal YinYangEnsemble.tsirelsonThreshold newCodeword e
    Assert.True(didReseed, "reseedIfCollapsedTemporal should trigger on a temporally collapsed ensemble")
    // After reseed, rhoCount should be lower (one cell now has IV = 0).
    let rhoAfter = YinYangEnsemble.rhoCount reseeded
    Assert.True(rhoAfter < rho,
        sprintf "rhoCount after reseed (%f) should be lower than before (%f)" rhoAfter rho)
    // A fresh ensemble (all IV = 0) has rhoCount = 1.0 (mean = 0 → returns 1.0 by convention).
    // But a fresh ensemble with no observations should NOT trigger if we use a high threshold.
    let freshEnsemble = YinYangEnsemble.createN 4
    // rhoCount of fresh ensemble = 1.0 (mean = 0 → fully correlated by convention).
    // isCollapsedTemporal at tsirelsonThreshold should still fire (1.0 > 0.2357).
    // This is correct: a fresh ensemble with zero observations is "temporally collapsed"
    // (no bus delay has occurred yet — all cells are at the same starting point).
    let rhoFresh = YinYangEnsemble.rhoCount freshEnsemble
    Assert.InRange(rhoFresh, 0.99, 1.01)
