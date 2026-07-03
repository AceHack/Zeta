module Zeta.Bayesian.Tests.BayesianTemperatureTests

open Xunit
open Zeta.Bayesian
open Zeta.Core

[<Fact>]
let ``Gaussian precision cools the universal temperature readout`` () =
    let uncertain = { Gaussian.PrecisionMean = 0.0; Precision = 1.0 }
    let confident = { Gaussian.PrecisionMean = 0.0; Precision = 9.0 }

    Assert.Equal(500_000, BayesianTemperature.uncertaintyPpm uncertain)
    Assert.Equal(100_000, BayesianTemperature.uncertaintyPpm confident)
    Assert.True(BayesianTemperature.uncertaintyPpm confident < BayesianTemperature.uncertaintyPpm uncertain)

[<Fact>]
let ``flat or improper Gaussian belief is maximally hot instead of pretending certainty`` () =
    let flat = Gaussian.uniform
    let improper = { Gaussian.PrecisionMean = 1.0; Precision = -1.0 }

    Assert.Equal(TemperatureReadout.MaxPpm, BayesianTemperature.uncertaintyPpm flat)
    Assert.Equal(TemperatureReadout.MaxPpm, BayesianTemperature.uncertaintyPpm improper)

[<Fact>]
let ``attention is recorded but does not heat the Bayesian thermal cost`` () =
    let belief = { Gaussian.PrecisionMean = 0.0; Precision = 7.0 }

    let readout =
        BayesianTemperature.ofBelief "bayes-attention" belief 0 0 1.0

    Assert.Equal(HeatReadout.TemperatureSchema, readout.Schema)
    Assert.Equal(125_000, readout.TemperaturePpm)
    Assert.Equal("warm", readout.Band)
    Assert.Equal(1_000_000, readout.AttentionPpm)

[<Fact>]
let ``pressure and heat can raise temperature while attention stays a side lane`` () =
    let belief = { Gaussian.PrecisionMean = 0.0; Precision = 9.0 }

    let readout =
        BayesianTemperature.ofBelief "bayes-pressure" belief 250_000 750_000 1.0

    Assert.Equal(750_000, readout.TemperaturePpm)
    Assert.Equal("critical", readout.Band)
    Assert.Equal(250_000, readout.HeatPpm)
    Assert.Equal(100_000, readout.UncertaintyPpm)
    Assert.Equal(750_000, readout.PressurePpm)
    Assert.Equal(1_000_000, readout.AttentionPpm)
