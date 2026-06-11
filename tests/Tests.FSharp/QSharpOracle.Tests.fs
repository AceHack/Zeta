module Zeta.Tests.QSharpOracleTests

open System
open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

let private tolerance = 1e-6
let private qsharpDumpTolerance = 1e-5

let private c = ImaginaryStack.complex

let private real (value: float) : Complex = { Real = value; Imag = 0.0 }

let private phase (angle: float) : Complex =
    { Real = cos angle; Imag = sin angle }

let private frame (seed: uint64) =
    Chip8Cow.create seed |> Chip8Cow.loadRom [| 0x60uy; byte seed |]

let private goldenRelativePath =
    Path.Combine("tools", "qsharp-oracle", "qsharp-golden.json")

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

let private bellCoincidenceCase (id: string) =
    vectors.GetProperty("bellCoincidence").EnumerateArray()
    |> Seq.find (fun item -> item.GetProperty("id").GetString() = id)

let private pauliAnticommutationCase (id: string) =
    vectors.GetProperty("pauliAnticommutation").EnumerateArray()
    |> Seq.find (fun item -> item.GetProperty("id").GetString() = id)

let private probabilities (case: JsonElement) =
    let p = case.GetProperty("probabilities")
    p.GetProperty("Zero").GetDouble(), p.GetProperty("One").GetDouble()

let private assertQSharpColumn (matrix: JsonElement) col (state: QubitIso.JoinState) =
    complexCloseTo (matrixEntry matrix 0 col) state.A
    complexCloseTo (matrixEntry matrix 1 col) state.B

let private assertQSharpBellColumn (matrix: JsonElement) col (state: BellState.State) =
    complexCloseTo (matrixEntry matrix 0 col) state.ZeroZero
    complexCloseTo (matrixEntry matrix 1 col) state.ZeroOne
    complexCloseTo (matrixEntry matrix 2 col) state.OneZero
    complexCloseTo (matrixEntry matrix 3 col) state.OneOne

let private probabilityFor frame probabilities =
    probabilities
    |> List.tryFind (fun (f, _) -> f = frame)
    |> Option.map snd
    |> Option.defaultValue 0.0

[<Fact>]
let ``F# reads the committed Q# observable treaty without depending on QDK at test time`` () =
    Assert.Equal("zeta.qsharp.reference-observables.v1", golden.GetProperty("schema").GetString())
    Assert.Equal("tools/qsharp-oracle/ZetaReferenceOracle.qs", golden.GetProperty("qsharpSource").GetString())
    Assert.Equal("qsharp==1.29.1", golden.GetProperty("qsharpPackage").GetString())

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
let ``BellTest canonical CHSH observables match the Q# golden vector`` () =
    let canonical = vectors.GetProperty("bellChsh").GetProperty("canonical")
    let angles = canonical.GetProperty("anglesRadians")
    let correlators = canonical.GetProperty("correlators")

    let a = angles.GetProperty("a").GetDouble()
    let a' = angles.GetProperty("aPrime").GetDouble()
    let b = angles.GetProperty("b").GetDouble()
    let b' = angles.GetProperty("bPrime").GetDouble()

    closeTo (correlators.GetProperty("E(a,b)").GetDouble()) (BellTest.correlation a b)
    closeTo (correlators.GetProperty("E(a,bPrime)").GetDouble()) (BellTest.correlation a b')
    closeTo (correlators.GetProperty("E(aPrime,b)").GetDouble()) (BellTest.correlation a' b)
    closeTo (correlators.GetProperty("E(aPrime,bPrime)").GetDouble()) (BellTest.correlation a' b')
    closeTo (canonical.GetProperty("s").GetDouble()) (BellTest.chsh a a' b b')
    closeTo (canonical.GetProperty("tsirelson").GetDouble()) BellTest.TsirelsonBound

[<Fact>]
let ``TimeGen phasor CHSH matches Q# singlet corner observables and the analytic value`` () =
    let singlet = vectors.GetProperty("bellChsh").GetProperty("singletCorners")
    let corners = singlet.GetProperty("corners").EnumerateArray() |> Seq.toArray

    Assert.Equal(4, corners.Length)
    Assert.Contains("Tsirelson maximality is cited/proved separately", singlet.GetProperty("scope").GetString())

    let mutable observedS = 0.0

    for corner in corners do
        let angles = corner.GetProperty("anglesRadians")
        let a = angles.GetProperty("a").GetDouble()
        let b = angles.GetProperty("b").GetDouble()
        let expectedOpposite = corner.GetProperty("oppositeOutcomeProbability").GetDouble()
        let expectedCorrelation = corner.GetProperty("correlator").GetDouble()
        let coefficient = corner.GetProperty("coefficient").GetInt32()

        closeToWithin qsharpDumpTolerance expectedOpposite (BellTest.coincidenceProbability a b)
        closeToWithin qsharpDumpTolerance expectedCorrelation (BellTest.correlation a b)
        observedS <- observedS + float coefficient * expectedCorrelation

    let generator = TimeGen.mk "qsharp-singlet-corners" 1 0UL TimeGen.PhasorTsirelson
    let analytic = singlet.GetProperty("analytic").GetDouble()

    closeTo analytic (TimeGen.chsh generator 1)
    closeToWithin qsharpDumpTolerance analytic observedS
    closeToWithin qsharpDumpTolerance analytic (singlet.GetProperty("s").GetDouble())

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
        let a = angles.GetProperty("a").GetDouble()
        let b = angles.GetProperty("b").GetDouble()
        let expected = item.GetProperty("probability").GetDouble()

        closeTo expected (BellTest.coincidenceProbability a b)
        closeTo expected (PhasorEndurance.overlap a b)
        closeTo (2.0 * expected - 1.0) (BellTest.correlation a b)

    assertCase "PhiPlus same-outcome a=0 b=pi/4"
    assertCase "Singlet opposite-outcome a=0 b=pi/4"
    assertCase "PhiPlus same-outcome a=0 b=pi/2"
    assertCase "PhiPlus same-outcome a=0 b=pi"

[<Fact>]
let ``single-qubit probability formulas match the Q# observable treaty`` () =
    let assertCase id expectedZero expectedOne =
        let actualZero, actualOne = singleQubitCase id |> probabilities
        closeTo expectedZero actualZero
        closeTo expectedOne actualOne

    assertCase "H|0>" 0.5 0.5

    let ryPiOver3 = singleQubitCase "Ry(pi/3)|0>"
    let theta3 = ryPiOver3.GetProperty("thetaRadians").GetDouble()
    assertCase "Ry(pi/3)|0>" ((cos (theta3 / 2.0)) ** 2.0) ((sin (theta3 / 2.0)) ** 2.0)

    let ryPiOver2 = singleQubitCase "Ry(pi/2)|0>"
    let theta2 = ryPiOver2.GetProperty("thetaRadians").GetDouble()
    assertCase "Ry(pi/2)|0>" ((cos (theta2 / 2.0)) ** 2.0) ((sin (theta2 / 2.0)) ** 2.0)

[<Fact>]
let ``AmplitudeEmu interference observables match the Q# Mach-Zehnder treaty`` () =
    let detectorZero = frame 0UL
    let detectorOne = frame 1UL
    let half = real 0.5
    let invSqrt2 = real (1.0 / sqrt 2.0)

    let closedInterferometer (phi: float) : AmplitudeEmu.Amp =
        let phase0 = phase (-phi / 2.0)
        let phase1 = phase (phi / 2.0)

        [ detectorZero, c.Mul(half, phase0)
          detectorZero, c.Mul(half, phase1)
          detectorOne, c.Mul(half, phase0)
          detectorOne, c.Negate(c.Mul(half, phase1)) ]

    let assertCase id (amp: AmplitudeEmu.Amp) =
        let expectedZero, expectedOne = interferenceCase id |> probabilities
        let actual = amp |> AmplitudeEmu.merge |> AmplitudeEmu.bornProb
        closeTo expectedZero (probabilityFor detectorZero actual)
        closeTo expectedOne (probabilityFor detectorOne actual)

    assertCase
        "mach-zehnder-open"
        [ detectorZero, invSqrt2
          detectorOne, invSqrt2 ]

    [ "mach-zehnder-closed-zero-phase", 0.0
      "mach-zehnder-closed-pi-over-3-phase", Math.PI / 3.0
      "mach-zehnder-closed-pi-over-2-phase", Math.PI / 2.0
      "mach-zehnder-closed-two-pi-over-3-phase", 2.0 * Math.PI / 3.0
      "mach-zehnder-closed-pi-phase", Math.PI ]
    |> List.iter (fun (id, phi) -> assertCase id (closedInterferometer phi))

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
