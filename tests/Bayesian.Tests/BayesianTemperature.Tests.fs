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
let ``Bayesian black-body radiance dims as precision rises`` () =
    let uncertain = { Gaussian.PrecisionMean = 0.0; Precision = 1.0 }
    let confident = { Gaussian.PrecisionMean = 0.0; Precision = 9.0 }

    let hot =
        BayesianTemperature.blackBodyOfBelief "bayes-uncertain" uncertain 0 0 0.0

    let cool =
        BayesianTemperature.blackBodyOfBelief "bayes-confident" confident 0 0 0.0

    Assert.Equal(HeatReadout.BlackBodySchema, hot.Schema)
    Assert.Equal(500_000, hot.TemperaturePpm)
    Assert.Equal(62_500, hot.RadiancePpm)
    Assert.Equal(100_000, cool.TemperaturePpm)
    Assert.Equal(100, cool.RadiancePpm)
    Assert.True(cool.RadiancePpm < hot.RadiancePpm)

[<Fact>]
let ``flat Bayesian belief saturates black-body information radiance`` () =
    let readout =
        BayesianTemperature.blackBodyOfBelief "bayes-flat" Gaussian.uniform 0 0 0.0

    Assert.Equal(TemperatureReadout.MaxPpm, readout.TemperaturePpm)
    Assert.Equal(TemperatureReadout.MaxPpm, readout.RadiancePpm)
    Assert.Equal(TemperatureReadout.MaxPpm, readout.PeakFrequencyPpm)

[<Fact>]
let ``attention is recorded but does not heat the Bayesian thermal cost`` () =
    let belief = { Gaussian.PrecisionMean = 0.0; Precision = 7.0 }

    let readout =
        BayesianTemperature.ofBelief "bayes-attention" belief 0 0 1.0

    Assert.Equal(HeatReadout.TemperatureSchema, readout.Schema)
    Assert.Equal(125_000, readout.TemperaturePpm)
    Assert.Equal("warm", readout.Band)
    Assert.Equal(1_000_000, readout.AttentionPpm)

    let radiance =
        BayesianTemperature.blackBodyOfBelief "bayes-attention" belief 0 0 1.0

    Assert.Equal(125_000, radiance.TemperaturePpm)
    Assert.Equal(244, radiance.RadiancePpm)

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

    let radiance =
        BayesianTemperature.blackBodyOfBelief "bayes-pressure" belief 250_000 750_000 1.0

    Assert.Equal(readout.TemperaturePpm, radiance.TemperaturePpm)
    Assert.Equal(BlackBodyReadout.radiancePpm readout.TemperaturePpm, radiance.RadiancePpm)
