namespace Zeta.Bayesian.Tests

open Xunit
open Zeta.Bayesian

module CloneDetectionBenchmarkTests =

    [<Fact>]
    let ``CDB-1: default sweep — rotor AUC >= Pearson AUC at every noise level`` () =
        let rows = CloneDetectionBenchmark.defaultSweep ()
        Assert.Equal(7, rows.Length)
        for row in rows do
            Assert.True(
                row.RotorAuc >= row.PearsonAuc - 1e-09,
                sprintf "noise=%g: rotor AUC %g < pearson AUC %g" row.NoiseSigma row.RotorAuc row.PearsonAuc)

    [<Fact>]
    let ``CDB-2: zero-noise clone detection — rotor and pearson above 0.85 AUC`` () =
        let row = CloneDetectionBenchmark.runNoiseLevel 42u 200 12 0.0
        Assert.True(row.RotorAuc > 0.85, sprintf "rotor %g" row.RotorAuc)
        Assert.True(row.PearsonAuc > 0.85, sprintf "pearson %g" row.PearsonAuc)

    [<Fact>]
    let ``CDB-4: report table is stable (golden snapshot of AUC values, F# LCG seed 42)`` () =
        let row = CloneDetectionBenchmark.runNoiseLevel 42u 200 12 0.1
        Assert.True(abs (row.RotorAuc - 0.850) < 0.03, sprintf "rotor drift: %g" row.RotorAuc)
        Assert.True(abs (row.PearsonAuc - 0.808) < 0.03, sprintf "pearson drift: %g" row.PearsonAuc)
        Assert.True(abs (row.ProcrustesAuc - 0.992) < 0.03, sprintf "procrustes drift: %g" row.ProcrustesAuc)

    [<Fact>]
    let ``CDB-3: high noise — scores remain finite and AUC in [0,1]`` () =
        let row = CloneDetectionBenchmark.runNoiseLevel 42u 100 12 2.0
        for auc in [ row.RotorAuc; row.PearsonAuc; row.ProcrustesAuc ] do
            Assert.False(System.Double.IsNaN auc)
            Assert.True(auc >= 0.0 && auc <= 1.0, sprintf "auc out of range: %g" auc)
