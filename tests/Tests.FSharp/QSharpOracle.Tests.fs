module Zeta.Tests.QSharpOracleTests

open System
open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

let private tolerance = 1e-6
let private qsharpDumpTolerance = 1e-5

let private c = ImaginaryStack.complex

let private goldenRelativePath =
    Path.Combine("src", "Core.QSharp.ReferenceOracle", "qsharp-golden.json")

let private heatTreatyRelativePath =
    Path.Combine("src", "Core.QSharp.ReferenceOracle", "heat-signals-treaty.json")

let private isRepoRoot (path: string) =
    File.Exists(Path.Combine(path, "Zeta.sln"))
    && File.Exists(Path.Combine(path, goldenRelativePath))

let rec private tryFindRepoRoot (dir: DirectoryInfo) =
    if isNull dir then
        None
    elif isRepoRoot dir.FullName then
        Some dir.FullName
    elif isNull dir.Parent then
        None
    else
        tryFindRepoRoot dir.Parent

let private tryDirectory (path: string) =
    if String.IsNullOrWhiteSpace path then
        None
    else
        try
            let dir = DirectoryInfo(path)

            if dir.Exists then
                tryFindRepoRoot dir
            else
                None
        with
        | :? ArgumentException
        | :? NotSupportedException
        | :? PathTooLongException -> None

let private rootCandidates =
    [ Environment.GetEnvironmentVariable("ZETA_REPO_ROOT")
      Environment.GetEnvironmentVariable("GITHUB_WORKSPACE")
      AppContext.BaseDirectory
      Directory.GetCurrentDirectory()
      __SOURCE_DIRECTORY__ ]

let private root =
    rootCandidates
    |> List.choose tryDirectory
    |> List.tryHead
    |> Option.defaultWith (fun () ->
        rootCandidates
        |> List.map (fun candidate ->
            if isNull candidate then
                "<null>"
            else
                candidate)
        |> String.concat "; "
        |> failwithf "Could not find repository root containing %s from candidates: %s" goldenRelativePath)


let private goldenPath =
    Path.Combine(root, goldenRelativePath)

let private golden =
    JsonDocument.Parse(File.ReadAllText(goldenPath)).RootElement

let private heatTreatyPath =
    Path.Combine(root, heatTreatyRelativePath)

let private heatTreaty =
    JsonDocument.Parse(File.ReadAllText(heatTreatyPath)).RootElement

let private vectors = golden.GetProperty("vectors")

let private closeToWithin (epsilon: float) (expected: float) (actual: float) =
    Assert.True(
        abs (actual - expected) <= epsilon,
        sprintf "Expected %.12f, got %.12f" expected actual)

let private closeTo (expected: float) (actual: float) =
    closeToWithin tolerance expected actual

let private complexCloseToWithin (epsilon: float) (expected: Complex) (actual: Complex) =
    closeToWithin epsilon expected.Real actual.Real
    closeToWithin epsilon expected.Imag actual.Imag

let private complexCloseTo (expected: Complex) (actual: Complex) =
    complexCloseToWithin tolerance expected actual

let private jsonComplex (element: JsonElement) : Complex =
    { Real = element.GetProperty("real").GetDouble()
      Imag = element.GetProperty("imag").GetDouble() }

let private gateMatrix (name: string) =
    vectors.GetProperty("gateUnitaries").GetProperty(name)

let private matrixEntry (matrix: JsonElement) row col =
    matrix[row][col] |> jsonComplex

let private jsonFloatArray (element: JsonElement) =
    element.EnumerateArray() |> Seq.map _.GetDouble() |> Seq.toArray

let private singleQubitCase (id: string) =
    vectors.GetProperty("singleQubitMeasurement").EnumerateArray()
    |> Seq.find (fun item -> item.GetProperty("id").GetString() = id)

let private interferenceCase (id: string) =
    vectors.GetProperty("interferenceVisibility").EnumerateArray()
    |> Seq.find (fun item -> item.GetProperty("id").GetString() = id)

let private flowBitCase (id: string) =
    vectors.GetProperty("flowBitDistinction").EnumerateArray()
    |> Seq.find (fun item -> item.GetProperty("id").GetString() = id)

let private bellCoincidenceCase (id: string) =
    vectors.GetProperty("bellCoincidence").EnumerateArray()
    |> Seq.find (fun item -> item.GetProperty("id").GetString() = id)

let private pauliAnticommutationCase (id: string) =
    vectors.GetProperty("pauliAnticommutation").EnumerateArray()
    |> Seq.find (fun item -> item.GetProperty("id").GetString() = id)

let private probabilities (case: JsonElement) =
    let p = case.GetProperty("probabilities")
    p.GetProperty("Zero").GetDouble(), p.GetProperty("One").GetDouble()

let private fsharpSingleQubitCase id =
    QuantumObservableTreaty.singleQubitMeasurements()
    |> List.find (fun item -> item.Id = id)

let private fsharpSingletCorner id =
    (QuantumObservableTreaty.singletChsh()).Corners
    |> List.find (fun item -> item.Id = id)

let private fsharpBellCoincidenceCase id =
    QuantumObservableTreaty.bellCoincidences()
    |> List.find (fun item -> item.Id = id)

let private fsharpInterferenceCase id =
    QuantumObservableTreaty.interferenceVisibility()
    |> List.find (fun item -> item.Id = id)

let private fsharpFlowBitCase id =
    QuantumObservableTreaty.flowBitDistinctions()
    |> List.find (fun item -> item.Id = id)

let private assertQSharpColumn (matrix: JsonElement) col (state: QubitIso.JoinState) =
    complexCloseTo (matrixEntry matrix 0 col) state.A
    complexCloseTo (matrixEntry matrix 1 col) state.B

let private assertQSharpBellColumn (matrix: JsonElement) col (state: BellState.State) =
    complexCloseTo (matrixEntry matrix 0 col) state.ZeroZero
    complexCloseTo (matrixEntry matrix 1 col) state.ZeroOne
    complexCloseTo (matrixEntry matrix 2 col) state.OneZero
    complexCloseTo (matrixEntry matrix 3 col) state.OneOne

let private heatSignals =
    heatTreaty.GetProperty("signals").EnumerateArray()
    |> Seq.map (fun item -> item.GetProperty("token").GetString(), item)
    |> Map.ofSeq

let private heatCode token =
    heatSignals[token].GetProperty("code").GetInt32()

let private temperatureBands =
    heatTreaty.GetProperty("temperatureBands").EnumerateArray()
    |> Seq.map (fun item -> item.GetProperty("token").GetString(), item)
    |> Map.ofSeq

let private temperatureCode token =
    temperatureBands[token].GetProperty("code").GetInt32()

[<Fact>]
let ``F# reads the committed Q# observable treaty without depending on QDK at test time`` () =
    Assert.Equal("zeta.qsharp.reference-observables.v1", golden.GetProperty("schema").GetString())
    Assert.Equal("src/Core.QSharp.ReferenceOracle/ZetaReferenceOracle.qs", golden.GetProperty("qsharpSource").GetString())
    Assert.Equal("qsharp==1.29.1", golden.GetProperty("qsharpPackage").GetString())

[<Fact>]
let ``F# HeatSignal tokens match the Q# heat signal treaty`` () =
    Assert.Equal("zeta.qsharp.heat-signals.v1", heatTreaty.GetProperty("schema").GetString())
    Assert.Equal(HeatReadout.Schema, heatTreaty.GetProperty("readoutSchema").GetString())
    Assert.Equal(HeatReadout.TemperatureSchema, heatTreaty.GetProperty("temperatureReadoutSchema").GetString())
    Assert.Equal(HeatReadout.BlackBodySchema, heatTreaty.GetProperty("blackBodyReadoutSchema").GetString())
    Assert.Equal(HeatReadout.QSharpSignalSource, heatTreaty.GetProperty("qsharpSource").GetString())
    Assert.Equal(HeatReadout.FSharpSurface, heatTreaty.GetProperty("fsharpSurface").GetString())

    let expected =
        [ "forgotten", HeatSignal.Forgotten
          "backpressure", HeatSignal.Backpressure
          "denied", HeatSignal.Denied
          "storage-error", HeatSignal.StorageError
          "invalid", HeatSignal.Invalid
          "expired", HeatSignal.Expired
          "stale", HeatSignal.Stale
          "other", HeatSignal.Other "future.unknown-signal" ]

    Assert.Equal(0, heatCode "cold")

    for token, signal in expected do
        Assert.True(heatSignals[token].GetProperty("public").GetBoolean())
        Assert.Equal(token, HeatSignal.token signal)
        Assert.True(heatCode token > 0)

    let kindCases =
        heatTreaty.GetProperty("kindCases").EnumerateArray()

    for item in kindCases do
        let kind = item.GetProperty("kind").GetString()
        let token = item.GetProperty("token").GetString()
        Assert.Equal(token, HeatSignal.tokenOfKind kind)

    let storageWins =
        heatTreaty.GetProperty("qsharpCounterCases").EnumerateArray()
        |> Seq.find (fun item -> item.GetProperty("id").GetString() = "storage-error-wins-over-pressure")

    Assert.Equal("storage-error", storageWins.GetProperty("token").GetString())
    Assert.Equal(heatCode "storage-error", storageWins.GetProperty("code").GetInt32())

[<Fact>]
let ``F# TemperatureReadout matches the Q# thermal treaty`` () =
    let expectedBands =
        [ "cold", TemperatureBand.Cold
          "warm", TemperatureBand.Warm
          "hot", TemperatureBand.Hot
          "critical", TemperatureBand.Critical ]

    for token, band in expectedBands do
        Assert.Equal(token, TemperatureBand.token band)
        Assert.Equal(TemperatureBand.code band, temperatureCode token)

    let cases =
        heatTreaty.GetProperty("temperatureCases").EnumerateArray()
        |> Seq.toList

    let declaredBands =
        expectedBands |> List.map fst |> List.sort

    let reachedBands =
        cases
        |> List.map (fun item -> item.GetProperty("band").GetString())
        |> List.distinct
        |> List.sort

    Assert.Equal<string list>(declaredBands, reachedBands)

    for item in cases do
        let id = item.GetProperty("id").GetString()
        let heatPpm = item.GetProperty("heatPpm").GetInt32()
        let uncertaintyPpm = item.GetProperty("uncertaintyPpm").GetInt32()
        let pressurePpm = item.GetProperty("pressurePpm").GetInt32()
        let attentionPpm = item.GetProperty("attentionPpm").GetInt32()
        let expectedTemperature = item.GetProperty("temperaturePpm").GetInt32()
        let expectedBand = item.GetProperty("band").GetString()
        let expectedCode = item.GetProperty("code").GetInt32()
        let expectedFidelity = item.GetProperty("fidelity").GetString()

        let readout =
            TemperatureReadout.ofPpm id heatPpm uncertaintyPpm pressurePpm attentionPpm

        Assert.Equal(HeatReadout.TemperatureSchema, readout.Schema)
        Assert.Equal(expectedTemperature, TemperatureReadout.thermalPpm heatPpm uncertaintyPpm pressurePpm)
        Assert.Equal(expectedTemperature, readout.TemperaturePpm)
        Assert.Equal(expectedBand, readout.Band)
        Assert.Equal(expectedCode, temperatureCode readout.Band)
        // `fidelity` is a treaty key, not a TypeScript-local diagnostic. F#'s
        // `max 0 |> min MaxPpm` discarded a negative and an above-ceiling input
        // exactly as silently as the TypeScript clamp did; these rows are what
        // stop it doing so quietly again.
        Assert.Equal(expectedFidelity, readout.Fidelity)

    let attentionOnly =
        cases
        |> List.find (fun item -> item.GetProperty("id").GetString() = "attention-does-not-heat-cost")

    Assert.Equal(1_000_000, attentionOnly.GetProperty("attentionPpm").GetInt32())
    Assert.Equal(125_000, attentionOnly.GetProperty("temperaturePpm").GetInt32())

[<Fact>]
let ``F# fidelity separates readings that every other published key renders identically`` () =
    // The property, stated as a falsifier rather than as prose: an out-of-domain
    // input and a genuinely idle room produce byte-identical values in EVERY
    // other field of `zeta.temperature.readout.v1`. Before `Fidelity` existed
    // there was no key on which they differed, so a blind counter and a calm
    // room were one reading. Same for at-ceiling vs above-ceiling.
    let idle = TemperatureReadout.ofPpm "room" 0 0 0 0
    let blind = TemperatureReadout.ofPpm "room" -1 0 0 0

    Assert.Equal(idle.TemperaturePpm, blind.TemperaturePpm)
    Assert.Equal(idle.Band, blind.Band)
    Assert.Equal(idle.HeatPpm, blind.HeatPpm)
    Assert.Equal("exact", idle.Fidelity)
    Assert.Equal("out-of-domain", blind.Fidelity)
    Assert.NotEqual<TemperatureReadout>(idle, blind)

    let atCeiling = TemperatureReadout.ofPpm "room" TemperatureReadout.MaxPpm 0 0 0
    let aboveCeiling = TemperatureReadout.ofPpm "room" (TemperatureReadout.MaxPpm * 2) 0 0 0

    Assert.Equal(atCeiling.TemperaturePpm, aboveCeiling.TemperaturePpm)
    Assert.Equal(atCeiling.Band, aboveCeiling.Band)
    Assert.Equal("exact", atCeiling.Fidelity)
    Assert.Equal("saturated", aboveCeiling.Fidelity)

    // Out-of-domain outranks saturated: not-a-measurement is a worse fault than
    // one the channel could not hold.
    Assert.Equal(
        ChannelFidelity.OutOfDomain,
        TemperatureReadout.fidelityOfPpm -1 (TemperatureReadout.MaxPpm * 2) 0 0
    )

    // Every attention channel is covered too - attention is excluded from the
    // thermal fold, so a bad attention input would otherwise vanish entirely.
    Assert.Equal(ChannelFidelity.OutOfDomain, TemperatureReadout.fidelityOfPpm 0 0 0 -1)
    Assert.Equal("out-of-domain", (TemperatureReadout.ofPpm "room" 0 0 0 -1).Fidelity)

[<Fact>]
let ``F# BlackBodyReadout matches the Q# information-radiance treaty`` () =
    let cases =
        heatTreaty.GetProperty("blackBodyCases").EnumerateArray()

    for item in cases do
        let id = item.GetProperty("id").GetString()
        let temperaturePpm = item.GetProperty("temperaturePpm").GetInt32()
        let expectedRadiance = item.GetProperty("radiancePpm").GetInt32()
        let expectedPeak = item.GetProperty("peakFrequencyPpm").GetInt32()

        let readout = BlackBodyReadout.ofTemperaturePpm id temperaturePpm

        Assert.Equal(HeatReadout.BlackBodySchema, readout.Schema)
        Assert.Equal(id, readout.Source)
        Assert.Equal(temperaturePpm, readout.TemperaturePpm)
        Assert.Equal(expectedRadiance, BlackBodyReadout.radiancePpm temperaturePpm)
        Assert.Equal(expectedRadiance, readout.RadiancePpm)
        Assert.Equal(expectedPeak, BlackBodyReadout.peakFrequencyPpm temperaturePpm)
        Assert.Equal(expectedPeak, readout.PeakFrequencyPpm)

    Assert.Equal(62_500, BlackBodyReadout.radiancePpm 500_000)
    Assert.Equal(1_000_000, BlackBodyReadout.radiancePpm 1_000_000)

[<Fact>]
let ``QubitIso Pauli X Y Z match the Q# gate matrices on computational basis states`` () =
    let zero = QubitIso.ofQubit c.One c.Zero
    let one = QubitIso.ofQubit c.Zero c.One

    let x = gateMatrix "X"
    assertQSharpColumn x 0 (QubitIso.pauliX zero)
    assertQSharpColumn x 1 (QubitIso.pauliX one)

    let y = gateMatrix "Y"
    assertQSharpColumn y 0 (QubitIso.pauliY zero)
    assertQSharpColumn y 1 (QubitIso.pauliY one)

    let z = gateMatrix "Z"
    assertQSharpColumn z 0 (QubitIso.pauliZ zero)
    assertQSharpColumn z 1 (QubitIso.pauliZ one)

[<Fact>]
let ``QubitIso H Ry and Rz match the Q# gate matrices on computational basis states`` () =
    let zero = QubitIso.ofQubit c.One c.Zero
    let one = QubitIso.ofQubit c.Zero c.One

    let h = gateMatrix "H"
    assertQSharpColumn h 0 (QubitIso.hadamard zero)
    assertQSharpColumn h 1 (QubitIso.hadamard one)

    let ryPiOver3 = gateMatrix "Ry(pi/3)"
    assertQSharpColumn ryPiOver3 0 (QubitIso.ry (Math.PI / 3.0) zero)
    assertQSharpColumn ryPiOver3 1 (QubitIso.ry (Math.PI / 3.0) one)

    let ryPiOver2 = gateMatrix "Ry(pi/2)"
    assertQSharpColumn ryPiOver2 0 (QubitIso.ry (Math.PI / 2.0) zero)
    assertQSharpColumn ryPiOver2 1 (QubitIso.ry (Math.PI / 2.0) one)

    let rzPiOver3 = gateMatrix "Rz(pi/3)"
    assertQSharpColumn rzPiOver3 0 (QubitIso.rz (Math.PI / 3.0) zero)
    assertQSharpColumn rzPiOver3 1 (QubitIso.rz (Math.PI / 3.0) one)

[<Fact>]
let ``QubitIso phase S and T match the Q# gate matrices on computational basis states`` () =
    let zero = QubitIso.ofQubit c.One c.Zero
    let one = QubitIso.ofQubit c.Zero c.One

    let s = gateMatrix "S"
    assertQSharpColumn s 0 (QubitIso.phaseS zero)
    assertQSharpColumn s 1 (QubitIso.phaseS one)

    let t = gateMatrix "T"
    assertQSharpColumn t 0 (QubitIso.phaseT zero)
    assertQSharpColumn t 1 (QubitIso.phaseT one)

[<Fact>]
let ``QubitIso raw kernels match Q# gate matrices on computational basis states`` () =
    let zero = QubitIso.ofQubit c.One c.Zero |> QubitIso.toRaw
    let one = QubitIso.ofQubit c.Zero c.One |> QubitIso.toRaw

    let assertRaw name op =
        let matrix = gateMatrix name
        assertQSharpColumn matrix 0 (zero |> op |> QubitIso.ofRaw)
        assertQSharpColumn matrix 1 (one |> op |> QubitIso.ofRaw)

    assertRaw "X" QubitIso.Raw.pauliX
    assertRaw "Y" QubitIso.Raw.pauliY
    assertRaw "Z" QubitIso.Raw.pauliZ
    assertRaw "S" QubitIso.Raw.phaseS
    assertRaw "T" QubitIso.Raw.phaseT
    assertRaw "H" QubitIso.Raw.hadamard
    assertRaw "Ry(pi/3)" (QubitIso.Raw.ry (Math.PI / 3.0))
    assertRaw "Ry(pi/2)" (QubitIso.Raw.ry (Math.PI / 2.0))
    assertRaw "Rz(pi/3)" (QubitIso.Raw.rz (Math.PI / 3.0))

[<Fact>]
let ``Q# flow-bit oracle turns external entropy into deterministic distinction`` () =
    let zero = flowBitCase "external-bit-zero"
    let expectedZero = fsharpFlowBitCase "external-bit-zero"
    let zeroProb = zero.GetProperty("probabilities")
    Assert.False(expectedZero.ExternalBit)
    Assert.Equal(expectedZero.ExternalBit, zero.GetProperty("externalBit").GetBoolean())
    Assert.Equal(expectedZero.Operation, zero.GetProperty("operation").GetString())
    closeTo expectedZero.Probabilities.Zero (zeroProb.GetProperty("Zero").GetDouble())
    closeTo expectedZero.Probabilities.One (zeroProb.GetProperty("One").GetDouble())

    let one = flowBitCase "external-bit-one"
    let expectedOne = fsharpFlowBitCase "external-bit-one"
    let oneProb = one.GetProperty("probabilities")
    Assert.True(expectedOne.ExternalBit)
    Assert.Equal(expectedOne.ExternalBit, one.GetProperty("externalBit").GetBoolean())
    Assert.Equal(expectedOne.Operation, one.GetProperty("operation").GetString())
    closeTo expectedOne.Probabilities.Zero (oneProb.GetProperty("Zero").GetDouble())
    closeTo expectedOne.Probabilities.One (oneProb.GetProperty("One").GetDouble())

[<Fact>]
let ``BellTest canonical CHSH observables match the Q# golden vector`` () =
    let canonical = vectors.GetProperty("bellChsh").GetProperty("canonical")
    let angles = canonical.GetProperty("anglesRadians")
    let correlators = canonical.GetProperty("correlators")
    let fsharp = QuantumObservableTreaty.canonicalChsh ()

    closeTo (angles.GetProperty("a").GetDouble()) fsharp.Angles.A
    closeTo (angles.GetProperty("aPrime").GetDouble()) fsharp.Angles.APrime
    closeTo (angles.GetProperty("b").GetDouble()) fsharp.Angles.B
    closeTo (angles.GetProperty("bPrime").GetDouble()) fsharp.Angles.BPrime

    closeTo (correlators.GetProperty("E(a,b)").GetDouble()) fsharp.Correlators.EAB
    closeTo (correlators.GetProperty("E(a,bPrime)").GetDouble()) fsharp.Correlators.EABPrime
    closeTo (correlators.GetProperty("E(aPrime,b)").GetDouble()) fsharp.Correlators.EAPrimeB
    closeTo (correlators.GetProperty("E(aPrime,bPrime)").GetDouble()) fsharp.Correlators.EAPrimeBPrime
    closeTo (canonical.GetProperty("s").GetDouble()) fsharp.S
    closeTo (canonical.GetProperty("tsirelson").GetDouble()) fsharp.Tsirelson
    closeTo (canonical.GetProperty("classicalBound").GetDouble()) fsharp.ClassicalBound

[<Fact>]
let ``TimeGen phasor CHSH matches Q# singlet corner observables and the analytic value`` () =
    let singlet = vectors.GetProperty("bellChsh").GetProperty("singletCorners")
    let corners = singlet.GetProperty("corners").EnumerateArray() |> Seq.toArray
    let fsharp = QuantumObservableTreaty.singletChsh ()

    Assert.Equal(4, corners.Length)
    Assert.Equal(corners.Length, fsharp.Corners.Length)
    Assert.Contains("Tsirelson maximality is cited/proved separately", singlet.GetProperty("scope").GetString())

    for corner in corners do
        let id = corner.GetProperty("id").GetString()
        let angles = corner.GetProperty("anglesRadians")
        let expected = fsharpSingletCorner id

        closeTo (angles.GetProperty("a").GetDouble()) expected.A
        closeTo (angles.GetProperty("b").GetDouble()) expected.B
        closeToWithin qsharpDumpTolerance (corner.GetProperty("oppositeOutcomeProbability").GetDouble()) expected.OppositeOutcomeProbability
        closeToWithin qsharpDumpTolerance (corner.GetProperty("sameOutcomeProbability").GetDouble()) expected.SameOutcomeProbability
        closeToWithin qsharpDumpTolerance (corner.GetProperty("correlator").GetDouble()) expected.Correlator
        Assert.Equal(expected.Coefficient, corner.GetProperty("coefficient").GetInt32())
        Assert.Equal(expected.Operation, corner.GetProperty("operation").GetString())

    let generator = TimeGen.mk "qsharp-singlet-corners" 1 0UL TimeGen.PhasorTsirelson
    let analytic = singlet.GetProperty("analytic").GetDouble()

    closeTo analytic fsharp.Analytic
    closeTo fsharp.Analytic (TimeGen.chsh generator 1)
    closeToWithin qsharpDumpTolerance (singlet.GetProperty("s").GetDouble()) fsharp.S

[<Fact>]
let ``BellState PhiPlus preparation matches the Q# two-qubit oracle`` () =
    let bell = vectors.GetProperty("bellChsh")
    let prepared = BellState.phiPlus ()

    assertQSharpBellColumn (gateMatrix "BellPhiPlusPrep") 0 prepared

    let expectedProbabilities = bell.GetProperty("preparation").GetProperty("probabilities") |> jsonFloatArray
    let actualProbabilities = BellState.probabilities prepared
    Assert.Equal(expectedProbabilities.Length, actualProbabilities.Length)

    Array.zip expectedProbabilities actualProbabilities
    |> Array.iter (fun (expected, actual) -> closeTo expected actual)

    closeTo 1.0 (BellState.normSq prepared)

[<Fact>]
let ``BellTest coincidence probability matches Q# Bell analyzer observables`` () =
    let assertCase id =
        let item = bellCoincidenceCase id
        let angles = item.GetProperty("anglesRadians")
        let expected = fsharpBellCoincidenceCase id

        Assert.Equal(expected.State, item.GetProperty("state").GetString())
        Assert.Equal(expected.Operation, item.GetProperty("operation").GetString())
        Assert.Equal(expected.Event, item.GetProperty("event").GetString())
        closeTo (angles.GetProperty("a").GetDouble()) expected.A
        closeTo (angles.GetProperty("b").GetDouble()) expected.B
        closeTo (item.GetProperty("probability").GetDouble()) expected.Probability
        closeTo expected.Probability (PhasorEndurance.overlap expected.A expected.B)
        closeTo (2.0 * expected.Probability - 1.0) (BellTest.correlation expected.A expected.B)

    assertCase "PhiPlus same-outcome a=0 b=pi/4"
    assertCase "Singlet opposite-outcome a=0 b=pi/4"
    assertCase "PhiPlus same-outcome a=0 b=pi/2"
    assertCase "PhiPlus same-outcome a=0 b=pi"

[<Fact>]
let ``single-qubit probability formulas match the Q# observable treaty`` () =
    let assertCase id =
        let actualZero, actualOne = singleQubitCase id |> probabilities
        let expected = fsharpSingleQubitCase id

        closeTo expected.Probabilities.Zero actualZero
        closeTo expected.Probabilities.One actualOne

    assertCase "H|0>"
    assertCase "Ry(pi/3)|0>"
    assertCase "Ry(pi/2)|0>"


[<Fact>]
let ``AmplitudeEmu interference observables match the Q# Mach-Zehnder treaty`` () =
    let assertCase id =
        let expectedZero, expectedOne = interferenceCase id |> probabilities
        let actual = fsharpInterferenceCase id
        closeTo expectedZero actual.Probabilities.Zero
        closeTo expectedOne actual.Probabilities.One

    [ "mach-zehnder-open"
      "mach-zehnder-closed-zero-phase"
      "mach-zehnder-closed-pi-over-3-phase"
      "mach-zehnder-closed-pi-over-2-phase"
      "mach-zehnder-closed-two-pi-over-3-phase"
      "mach-zehnder-closed-pi-phase" ]
    |> List.iter assertCase

[<Fact>]
let ``Q# Pauli products pin the hardware-side anticommutation signs`` () =
    let assertCase id =
        let item = pauliAnticommutationCase id
        Assert.Equal("lhsMatrix = -rhsMatrix", item.GetProperty("relation").GetString())

        let lhs = item.GetProperty("lhsMatrix")
        let rhs = item.GetProperty("rhsMatrix")

        for row in 0..1 do
            for col in 0..1 do
                complexCloseTo
                    (matrixEntry lhs row col)
                    (c.Negate(matrixEntry rhs row col))

    assertCase "X after Z = -(Z after X)"
    assertCase "X after Y = -(Y after X)"
    assertCase "Y after Z = -(Z after Y)"

[<Fact>]
let ``F# validates the TypeScript Q# treaty transcript`` () =
    let transcriptRelativePath =
        Path.Combine("src", "Core.QSharp.ReferenceOracle", "treaty-transcript.json")

    let transcriptPath =
        Path.Combine(root, transcriptRelativePath)

    let transcript =
        JsonDocument.Parse(File.ReadAllText(transcriptPath)).RootElement

    Assert.Equal("zeta.qsharp.treaty-transcript.v1", transcript.GetProperty("schema").GetString())

    let jobs = transcript.GetProperty("jobs")
    
    // 1. Validate CHSH Corners
    let chsh = jobs.GetProperty("chshCorners")
    let sParam = chsh.GetProperty("sParameter")
    let sAnalytic = sParam.GetProperty("fsharpAnalytic").GetDouble()
    let sTS = sParam.GetProperty("ts").GetDouble()
    let sQSharp = sParam.GetProperty("qsharp").GetDouble()

    // Assert S parameters are consistent within tolerances
    closeTo sAnalytic sTS
    closeToWithin 1e-4 sAnalytic sQSharp

    let chshResults = chsh.GetProperty("results").EnumerateArray() |> Seq.toArray
    Assert.Equal(4, chshResults.Length)

    for res in chshResults do
        let angles = res.GetProperty("angles")
        let a = angles.GetProperty("a").GetDouble()
        let b = angles.GetProperty("b").GetDouble()
        
        let ts = res.GetProperty("ts")
        let tsOpposite = ts.GetProperty("pOpposite").GetDouble()
        let tsCorrelator = ts.GetProperty("correlator").GetDouble()

        let qs = res.GetProperty("qsharp")
        let qsOpposite = qs.GetProperty("pOpposite").GetDouble()
        let qsCorrelator = qs.GetProperty("correlator").GetDouble()

        let fa = res.GetProperty("fsharpAnalytic")
        let faOpposite = fa.GetProperty("pOpposite").GetDouble()
        let faCorrelator = fa.GetProperty("correlator").GetDouble()

        // Assert that the F# code values match the expected analytic values
        closeTo faOpposite (BellTest.coincidenceProbability a b)
        closeTo faCorrelator (BellTest.correlation a b)

        // Assert that TS matches F# Analytic
        closeToWithin 1e-5 tsOpposite faOpposite
        closeToWithin 1e-5 tsCorrelator faCorrelator

        // Assert that Q# matches F# Analytic
        closeToWithin 1e-5 qsOpposite faOpposite
        closeToWithin 1e-5 qsCorrelator faCorrelator

    // 2. Validate Bell Coincidence
    let coincidenceResults = jobs.GetProperty("bellCoincidence").GetProperty("results").EnumerateArray() |> Seq.toArray
    for res in coincidenceResults do
        let angles = res.GetProperty("angles")
        let a = angles.GetProperty("a").GetDouble()
        let b = angles.GetProperty("b").GetDouble()
        let state = res.GetProperty("state").GetString()
        let event = res.GetProperty("event").GetString()
        
        let tsProb = res.GetProperty("ts").GetDouble()
        let qsProb = res.GetProperty("qsharp").GetDouble()
        let faProb = res.GetProperty("fsharpAnalytic").GetDouble()

        let fsharpProb =
            if state = "Singlet" then
                if event = "oppositeOutcome" then
                    BellTest.coincidenceProbability a b
                else
                    1.0 - BellTest.coincidenceProbability a b
            else // PhiPlus
                if event = "sameOutcome" then
                    BellTest.coincidenceProbability a b
                else
                    1.0 - BellTest.coincidenceProbability a b

        closeTo faProb fsharpProb
        closeToWithin 1e-5 tsProb faProb
        closeToWithin 1e-5 qsProb faProb

    // 3. Validate Interference Visibility
    let interferenceResults = jobs.GetProperty("interferenceGrid").GetProperty("results").EnumerateArray() |> Seq.toArray
    for res in interferenceResults do
        let id = res.GetProperty("id").GetString()
        let expected = fsharpInterferenceCase id
        let phaseValEl = res.GetProperty("phase")

        let tsZero = res.GetProperty("ts").GetProperty("Zero").GetDouble()
        let tsOne = res.GetProperty("ts").GetProperty("One").GetDouble()
        let qsZero = res.GetProperty("qsharp").GetProperty("Zero").GetDouble()
        let qsOne = res.GetProperty("qsharp").GetProperty("One").GetDouble()
        let faZero = res.GetProperty("fsharpAnalytic").GetProperty("Zero").GetDouble()
        let faOne = res.GetProperty("fsharpAnalytic").GetProperty("One").GetDouble()

        Assert.Equal(expected.Operation, res.GetProperty("operation").GetString())

        match expected.PhaseRadians with
        | None -> Assert.Equal(JsonValueKind.Null, phaseValEl.ValueKind)
        | Some phase -> closeToWithin 1e-12 phase (phaseValEl.GetDouble())

        closeTo faZero expected.Probabilities.Zero
        closeTo faOne expected.Probabilities.One
        closeToWithin 1e-5 tsZero faZero
        closeToWithin 1e-5 tsOne faOne
        closeToWithin 1e-5 qsZero faZero
        closeToWithin 1e-5 qsOne faOne
