module Zeta.Bayesian.Tests.BayesianTemperatureTests

open System.IO
open System.Reflection
open System.Text.Json
open Xunit
open Zeta.Bayesian
open Zeta.Core

let private mustOk =
    function
    | Ok value -> value
    | Error feedback -> failwithf "expected Ok, got %A" feedback

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private heatTreaty () =
    Path.Join(repoRoot (), "src", "Core.QSharp.ReferenceOracle", "heat-signals-treaty.json")
    |> File.ReadAllText
    |> JsonDocument.Parse

let private treatyCase (property: string) (id: string) =
    use doc = heatTreaty ()

    doc.RootElement.GetProperty(property).EnumerateArray()
    |> Seq.find (fun item -> item.GetProperty("id").GetString() = id)
    |> fun item -> item.Clone()

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

[<Fact>]
let ``Bayesian treaty bundle matches the QSharp heat temperature vector`` () =
    let belief = { Gaussian.PrecisionMean = 0.0; Precision = 7.0 }
    let bundle =
        BayesianTemperature.treatyOfBelief "attention-does-not-heat-cost" belief 125_000 0 1.0
        |> mustOk

    let temperatureCase = treatyCase "temperatureCases" "attention-does-not-heat-cost"
    let blackBodyCase = treatyCase "blackBodyCases" "attention-does-not-heat-cost"

    Assert.Equal(HeatReadout.Schema, bundle.HeatReadoutSchema)
    Assert.Equal(HeatReadout.TemperatureSchema, bundle.TemperatureReadoutSchema)
    Assert.Equal(HeatReadout.BlackBodySchema, bundle.BlackBodyReadoutSchema)
    Assert.Equal(HeatReadout.SignalTreaty, bundle.QSharpTreaty)
    Assert.Equal(HeatReadout.QSharpSignalSource, bundle.QSharpSource)
    Assert.Equal(HeatReadout.FSharpSurface, bundle.FSharpSurface)
    Assert.Equal("fsharp-blackbody-reference", bundle.ReferenceOracle)

    Assert.Equal(temperatureCase.GetProperty("heatPpm").GetInt32(), bundle.Temperature.HeatPpm)
    Assert.Equal(temperatureCase.GetProperty("uncertaintyPpm").GetInt32(), bundle.Temperature.UncertaintyPpm)
    Assert.Equal(temperatureCase.GetProperty("pressurePpm").GetInt32(), bundle.Temperature.PressurePpm)
    Assert.Equal(temperatureCase.GetProperty("attentionPpm").GetInt32(), bundle.Temperature.AttentionPpm)
    Assert.Equal(temperatureCase.GetProperty("temperaturePpm").GetInt32(), bundle.Temperature.TemperaturePpm)
    Assert.Equal(temperatureCase.GetProperty("band").GetString(), bundle.Temperature.Band)

    Assert.Equal(blackBodyCase.GetProperty("temperaturePpm").GetInt32(), bundle.BlackBody.TemperaturePpm)
    Assert.Equal(blackBodyCase.GetProperty("radiancePpm").GetInt32(), bundle.BlackBody.RadiancePpm)
    Assert.Equal(blackBodyCase.GetProperty("peakFrequencyPpm").GetInt32(), bundle.BlackBody.PeakFrequencyPpm)

[<Fact>]
let ``temperature reference oracle refuses schema drift as typed feedback`` () =
    let readout =
        { TemperatureReadout.ofPpm "bad-schema" 0 0 0 0 with
            Schema = "zeta.temperature.readout.future" }

    match TemperatureTreatyBundle.ofTemperatureReadout TemperatureReferenceOracle.localBlackBody readout with
    | Error(TemperatureReferenceFeedback.TemperatureSchemaMismatch(expected, actual)) ->
        Assert.Equal(HeatReadout.TemperatureSchema, expected)
        Assert.Equal("zeta.temperature.readout.future", actual)
    | other -> Assert.Fail(sprintf "expected TemperatureSchemaMismatch, got %A" other)
