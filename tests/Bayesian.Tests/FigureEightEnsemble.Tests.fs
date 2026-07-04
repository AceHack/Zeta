module Zeta.Bayesian.Tests.FigureEightEnsembleTests

open Xunit
open Zeta.Core
open Zeta.Bayesian

/// Helper: a non-trivial sensory input (informative Gaussian)
let private sensory = { Gaussian.PrecisionMean = 5.0; Precision = 2.0 }

/// Helper: the first three Adinkra codewords
let private cws = AdinkraCode.allCodewords |> List.truncate 3 |> List.toArray
let private cwA = cws.[0]
let private cwB = cws.[1]
let private cwC = cws.[2]

/// FIG8-1: A fresh figure-8 starts with rhoProxy = 0 (cells are uninformative, no correlation yet).
[<Fact>]
let ``FIG8-1: fresh figure-8 starts uncorrelated`` () =
    let fig8 = FigureEightEnsemble.create cwA cwB cwC
    Assert.Equal(0, fig8.Tick)
    Assert.Empty(fig8.RhoHistory)

/// FIG8-2: After 1 tick, rhoProxy is defined and in [0, 1].
[<Fact>]
let ``FIG8-2: rhoProxy is in [0,1] after one tick`` () =
    let fig8 = FigureEightEnsemble.create cwA cwB cwC |> FigureEightEnsemble.tick sensory
    let rho = FigureEightEnsemble.finalRho fig8
    Assert.Equal(1, fig8.Tick)
    Assert.True(rho >= 0.0 && rho <= 1.0 + 1e-9, sprintf "rho = %f not in [0,1]" rho)

/// FIG8-3: The figure-8 COLLAPSES after enough ticks (rhoProxy → 1).
/// This is the key result: the closed mutual-update loop IS the groupthink spiral.
/// The beliefs converge because each cell's posterior becomes the next cell's prior —
/// after N rounds, all three cells have processed the same information in the same order.
[<Fact>]
let ``FIG8-3: figure-8 collapses after 20 ticks (rho approaches 1)`` () =
    let fig8 = FigureEightEnsemble.create cwA cwB cwC |> FigureEightEnsemble.runN 20 sensory
    let rho = FigureEightEnsemble.finalRho fig8
    // After 20 ticks of mutual posterior-sharing, the cells should be highly correlated.
    // We expect rho > 0.5 (significant convergence). The exact value depends on the
    // sensory input and codeword seeds, but collapse is the expected outcome.
    Assert.True(rho > 0.5, sprintf "Expected figure-8 to collapse (rho > 0.5), got rho = %f" rho)

/// FIG8-4: An INDEPENDENT 3-cell ensemble stays decorrelated when cells receive DIFFERENT
/// sensory inputs. When all cells receive the SAME input, they converge regardless of seed —
/// this is the correct result: decorrelation requires different observations, not just different
/// starting frames. This test verifies that with different inputs, the cells stay decorrelated.
[<Fact>]
let ``FIG8-4: independent ensemble stays decorrelated with different sensory inputs`` () =
    // Give each cell a slightly different sensory input (different observations of the world)
    let sensoryA = { Gaussian.PrecisionMean = 5.0; Precision = 2.0 }
    let sensoryB = { Gaussian.PrecisionMean = 3.0; Precision = 1.5 }
    let sensoryC = { Gaussian.PrecisionMean = 7.0; Precision = 2.5 }
    // Manually update each cell with its own sensory stream
    let cellA = (YinYangCell.seed cwA, [ 1 .. 20 ]) ||> List.fold (fun c _ -> YinYangCell.observe sensoryA c)
    let cellB = (YinYangCell.seed cwB, [ 1 .. 20 ]) ||> List.fold (fun c _ -> YinYangCell.observe sensoryB c)
    let cellC = (YinYangCell.seed cwC, [ 1 .. 20 ]) ||> List.fold (fun c _ -> YinYangCell.observe sensoryC c)
    // Measure rhoProxy on the three independently-updated cells
    let means =
        [| cellA; cellB; cellC |]
        |> Array.choose (fun cell ->
            if cell.Column.Belief.Precision > 0.0 then
                Some (cell.Column.Belief.PrecisionMean / cell.Column.Belief.Precision)
            else None)
    let rho =
        if means.Length < 2 then 0.0
        else
            let avg = Array.average means
            let variance = means |> Array.averageBy (fun m -> (m - avg) ** 2.0)
            let maxMean = Array.max means
            let minMean = Array.min means
            let maxPossibleVariance = ((maxMean - minMean) / 2.0) ** 2.0
            if maxPossibleVariance <= 1e-12 then 1.0
            else 1.0 - (variance / maxPossibleVariance)
    // With different sensory inputs, cells should stay decorrelated (rho < 0.5)
    Assert.True(rho < 0.5, sprintf "Expected independent ensemble with different inputs to stay decorrelated (rho < 0.5), got rho = %f" rho)

/// FIG8-5: With IDENTICAL sensory inputs, BOTH the figure-8 AND the independent ensemble
/// collapse to rho = 1.0. This is the correct result: decorrelation requires different
/// observations, not just different starting frames. The figure-8 is not uniquely bad —
/// any ensemble collapses when all cells see the same stream.
/// This test documents this as a KNOWN result (not a failure).
[<Fact>]
let ``FIG8-5: both figure-8 and independent collapse with identical sensory input`` () =
    let fig8Rho, indepRho =
        FigureEightEnsemble.compareWithIndependent 20 sensory cwA cwB cwC
    // Both should collapse to rho = 1.0 with identical input
    Assert.True(fig8Rho > 0.9, sprintf "Expected figure-8 to collapse (rho > 0.9), got %f" fig8Rho)
    Assert.True(indepRho > 0.9, sprintf "Expected independent to collapse (rho > 0.9) with identical input, got %f" indepRho)

/// FIG8-6: The figure-8 rho history is monotonically non-decreasing (convergence is one-way).
/// Once the beliefs start converging, they don't spontaneously decorrelate.
/// This is the information-theoretic analog of the homoclinic tangle: the trajectory
/// spirals toward the fixed point (consensus) and stays there.
[<Fact>]
let ``FIG8-6: figure-8 rho history is monotonically non-decreasing`` () =
    let fig8 = FigureEightEnsemble.create cwA cwB cwC |> FigureEightEnsemble.runN 15 sensory
    let isMonotone = FigureEightEnsemble.isMonotonicallyConverging fig8
    Assert.True(isMonotone, "Expected figure-8 rho to be monotonically non-decreasing (convergence is one-way)")
