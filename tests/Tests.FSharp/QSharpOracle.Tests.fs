module Zeta.Tests.QSharpOracleTests

open System
open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

let private tolerance = 1e-6

let private c = ImaginaryStack.complex

let private real (value: float) : Complex = { Real = value; Imag = 0.0 }

let private frame (seed: uint64) =
    Chip8Cow.create seed |> Chip8Cow.loadRom [| 0x60uy; byte seed |]

let rec private findRepoRoot (dir: DirectoryInfo) =
    if File.Exists(Path.Combine(dir.FullName, "Zeta.sln")) then dir.FullName
    elif isNull dir.Parent then failwith "Could not find repository root from test output directory."
    else findRepoRoot dir.Parent

let private root = findRepoRoot (DirectoryInfo(Environment.CurrentDirectory))

let private goldenPath =
    Path.Combine(root, "tools", "qsharp-oracle", "qsharp-golden.json")

let private golden =
    JsonDocument.Parse(File.ReadAllText(goldenPath)).RootElement

let private vectors = golden.GetProperty("vectors")

let private closeTo (expected: float) (actual: float) =
    Assert.True(
        abs (actual - expected) <= tolerance,
        sprintf "Expected %.12f, got %.12f" expected actual)

let private complexCloseTo (expected: Complex) (actual: Complex) =
    closeTo expected.Real actual.Real
    closeTo expected.Imag actual.Imag

let private jsonComplex (element: JsonElement) : Complex =
    { Real = element.GetProperty("real").GetDouble()
      Imag = element.GetProperty("imag").GetDouble() }

let private gateMatrix (name: string) =
    vectors.GetProperty("gateUnitaries").GetProperty(name)

let private matrixEntry (matrix: JsonElement) row col =
    matrix[row][col] |> jsonComplex

let private singleQubitCase (id: string) =
    vectors.GetProperty("singleQubitMeasurement").EnumerateArray()
    |> Seq.find (fun item -> item.GetProperty("id").GetString() = id)

let private interferenceCase (id: string) =
    vectors.GetProperty("interferenceVisibility").EnumerateArray()
    |> Seq.find (fun item -> item.GetProperty("id").GetString() = id)

let private probabilities (case: JsonElement) =
    let p = case.GetProperty("probabilities")
    p.GetProperty("Zero").GetDouble(), p.GetProperty("One").GetDouble()

let private assertQSharpColumn (matrix: JsonElement) col (state: QubitIso.JoinState) =
    complexCloseTo (matrixEntry matrix 0 col) state.A
    complexCloseTo (matrixEntry matrix 1 col) state.B

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

    let assertCase id (amp: AmplitudeEmu.Amp) =
        let expectedZero, expectedOne = interferenceCase id |> probabilities
        let actual = amp |> AmplitudeEmu.merge |> AmplitudeEmu.bornProb
        closeTo expectedZero (probabilityFor detectorZero actual)
        closeTo expectedOne (probabilityFor detectorOne actual)

    assertCase
        "mach-zehnder-open"
        [ detectorZero, invSqrt2
          detectorOne, invSqrt2 ]

    assertCase
        "mach-zehnder-closed-zero-phase"
        [ detectorZero, half
          detectorZero, half
          detectorOne, half
          detectorOne, c.Negate half ]

    assertCase
        "mach-zehnder-closed-pi-phase"
        [ detectorZero, half
          detectorZero, c.Negate half
          detectorOne, half
          detectorOne, half ]
