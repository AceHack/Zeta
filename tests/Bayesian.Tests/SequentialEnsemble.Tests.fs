module Zeta.Bayesian.Tests.SequentialEnsembleTests

open Xunit
open Zeta.Core
open Zeta.Bayesian

// ── SEQ-1: empty observation list returns uninformative prior ─────────────────────────────────

[<Fact>]
let ``SEQ-1: run with empty observations returns uninformative prior with zero IV`` () =
    let result = SequentialEnsemble.run []
    Assert.Equal(0.0, result.FinalPosterior.Precision)
    Assert.Equal(0.0, result.FinalPosterior.PrecisionMean)
    Assert.Equal(0.0, result.TotalIV)
    Assert.Equal(0, result.StepCount)
    Assert.Equal(0, result.Intermediates.Length)

// ── SEQ-2: single observation produces a non-trivial posterior ────────────────────────────────

[<Fact>]
let ``SEQ-2: run with one observation produces a posterior with positive precision`` () =
    let obs = { Gaussian.PrecisionMean = 5.0; Precision = 5.0 }  // mean=1.0, precision=5.0
    let result = SequentialEnsemble.run [ obs ]
    Assert.Equal(1, result.StepCount)
    Assert.Equal(1, result.Intermediates.Length)
    // The posterior should have positive precision (the cell has learned something).
    Assert.True(result.FinalPosterior.Precision > 0.0,
        sprintf "FinalPosterior.Precision should be > 0, got %f" result.FinalPosterior.Precision)
    // The posterior mean should be close to 1.0 (the observed mean).
    let mean = SequentialEnsemble.finalMean result
    Assert.InRange(mean, 0.5, 1.5)
    // TotalIV should be positive.
    Assert.True(result.TotalIV > 0.0,
        sprintf "TotalIV should be > 0, got %f" result.TotalIV)

// ── SEQ-3: precision is monotonically non-decreasing along the pipeline ───────────────────────

[<Fact>]
let ``SEQ-3: precision is monotonically non-decreasing along the pipeline (Task.ContinueWith accumulation)`` () =
    // Each step adds a new observation, so precision should grow (or stay flat) at each step.
    // This is the core property of the Task.ContinueWith antecedent pattern:
    // each continuation inherits the accumulated belief of all prior steps.
    let observations =
        [ for i in 1 .. 8 ->
            // All observations have the same mean (1.0) and precision (2.0).
            { Gaussian.PrecisionMean = 2.0; Precision = 2.0 } ]
    let result = SequentialEnsemble.run observations
    Assert.Equal(8, result.StepCount)
    Assert.Equal(8, result.Intermediates.Length)
    // Precision should be monotonically non-decreasing.
    Assert.True(SequentialEnsemble.isPrecisionMonotone result,
        "Precision should be monotonically non-decreasing along the pipeline")
    // Final precision should be greater than the first intermediate precision.
    let firstPrec = result.Intermediates.[0].Precision
    let lastPrec = result.FinalPosterior.Precision
    Assert.True(lastPrec > firstPrec,
        sprintf "Final precision (%f) should be > first intermediate precision (%f)" lastPrec firstPrec)

// ── SEQ-4: final mean converges toward the true signal mean ──────────────────────────────────

[<Fact>]
let ``SEQ-4: final mean converges toward the true signal after 10 identical observations`` () =
    // True signal: mean = 3.0, precision = 4.0 (PM = 12.0).
    let obs = { Gaussian.PrecisionMean = 12.0; Precision = 4.0 }
    let observations = List.replicate 10 obs
    let result = SequentialEnsemble.run observations
    Assert.Equal(10, result.StepCount)
    let mean = SequentialEnsemble.finalMean result
    // After 10 steps accumulating the same signal, the mean should be close to 3.0.
    Assert.InRange(mean, 2.5, 3.5)
    // Final precision should be significantly higher than a single observation.
    let singleResult = SequentialEnsemble.run [ obs ]
    Assert.True(result.FinalPosterior.Precision > singleResult.FinalPosterior.Precision,
        "10-step pipeline should have higher precision than 1-step pipeline")

// ── SEQ-5: reconcileToReceipt emits a valid receipt with DeltaJ = N ──────────────────────────

[<Fact>]
let ``SEQ-5: reconcileToReceipt emits a receipt with DeltaJ = N (one joule per step)`` () =
    let observations =
        [ for _ in 1 .. 5 ->
            { Gaussian.PrecisionMean = 3.0; Precision = 3.0 } ]
    let result = SequentialEnsemble.run observations
    let receipt = SequentialEnsemble.reconcileToReceipt result
    // DeltaJ = N = 5 (one joule per step).
    Assert.Equal(5.0, receipt.DeltaJ)
    // IV should be positive.
    Assert.True(receipt.IV > 0.0, sprintf "IV should be > 0, got %f" receipt.IV)
    // Entropy should be non-negative.
    Assert.True(receipt.Entropy >= 0.0, sprintf "Entropy should be >= 0, got %f" receipt.Entropy)
    // LandauerRatio should be finite.
    Assert.False(System.Double.IsNaN(receipt.LandauerRatio),
        "LandauerRatio should not be NaN")
    Assert.False(System.Double.IsInfinity(receipt.LandauerRatio),
        "LandauerRatio should not be infinite")
    // TotalIV should match the receipt IV.
    Assert.Equal(result.TotalIV, receipt.IV)
