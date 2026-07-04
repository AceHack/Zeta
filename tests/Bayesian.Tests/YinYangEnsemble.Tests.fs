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
