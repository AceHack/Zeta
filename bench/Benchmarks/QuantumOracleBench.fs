module Zeta.Benchmarks.QuantumOracleBench

open System
open System.IO
open System.Text.Json
open BenchmarkDotNet.Attributes
open Zeta.Core

/// Benchmarks the F# side of the Q# observable treaty without taking a
/// QDK/Q#/Python dependency at benchmark time. The Q# lane owns the golden
/// JSON; this lane measures Zeta's matching observable implementations and
/// the treaty-ingress cost separately.
[<MemoryDiagnoser>]
type QuantumOracleOps() =

    [<DefaultValue(false)>] val mutable private states: QubitIso.JoinState array
    [<DefaultValue(false)>] val mutable private rawStates: QubitIso.RawState array
    [<DefaultValue(false)>] val mutable private frames: Chip8Cow.Frame array
    [<DefaultValue(false)>] val mutable private goldenBytes: byte array

    [<Params(64, 1024, 16384)>]
    member val Size = 0 with get, set

    [<GlobalSetup>]
    member this.Setup() =
        this.states <-
            Array.init this.Size (fun i ->
                let theta = float i * 0.001
                let alpha = { Real = cos theta; Imag = sin theta }
                let beta = { Real = cos (theta * 0.5); Imag = sin (theta * 0.5) }
                QubitIso.ofQubit alpha beta)

        this.rawStates <- this.states |> Array.map QubitIso.toRaw

        this.frames <-
            Array.init 2 (fun i ->
                Chip8Cow.create (uint64 i)
                |> Chip8Cow.loadRom [| 0x60uy; byte i |])

        let root = QuantumOracleOps.FindRepoRoot(DirectoryInfo(Environment.CurrentDirectory))
        let path = Path.Combine(root, "src", "Core.QSharp.ReferenceOracle", "qsharp-golden.json")
        this.goldenBytes <- File.ReadAllBytes(path)

    static member FindRepoRoot(dir: DirectoryInfo) =
        let mutable current = dir
        let mutable found: string option = None
        while found.IsNone && not (isNull current) do
            if File.Exists(Path.Combine(current.FullName, "Zeta.sln")) then
                found <- Some current.FullName
            else
                current <- current.Parent
        match found with
        | Some root -> root
        | None -> invalidOp "Could not find repository root from benchmark output directory."

    [<Benchmark>]
    member this.QSharpGoldenJsonParse() =
        use doc = JsonDocument.Parse(ReadOnlyMemory this.goldenBytes)
        doc.RootElement.GetProperty("vectors").GetProperty("gateUnitaries").GetProperty("H").GetArrayLength()

    [<Benchmark>]
    member this.QubitIsoGateSweep() =
        let mutable acc = 0.0
        let states = this.states
        for i in 0 .. states.Length - 1 do
            let s =
                states.[i]
                |> QubitIso.hadamard
                |> QubitIso.ry (Math.PI / 3.0)
                |> QubitIso.rz (Math.PI / 3.0)
                |> QubitIso.pauliX
                |> QubitIso.pauliY
                |> QubitIso.pauliZ
                |> QubitIso.phaseS
                |> QubitIso.phaseT
            acc <- acc + QubitIso.normSq s + QubitIso.measureOne s
        acc

    [<Benchmark>]
    member this.QubitIsoRawGateSweep() =
        let mutable acc = 0.0
        let states = this.rawStates
        for i in 0 .. states.Length - 1 do
            let s =
                states.[i]
                |> QubitIso.Raw.hadamard
                |> QubitIso.Raw.ry (Math.PI / 3.0)
                |> QubitIso.Raw.rz (Math.PI / 3.0)
                |> QubitIso.Raw.pauliX
                |> QubitIso.Raw.pauliY
                |> QubitIso.Raw.pauliZ
                |> QubitIso.Raw.phaseS
                |> QubitIso.Raw.phaseT
            acc <- acc + QubitIso.normSqRaw s + QubitIso.measureOneRaw s
        acc

    [<Benchmark>]
    member this.BellChshSweep() =
        let mutable acc = 0.0
        for i in 0 .. this.Size - 1 do
            let offset = float i * 0.0001
            acc <- acc + BellTest.chsh offset (Math.PI / 2.0 + offset) (Math.PI / 4.0) (3.0 * Math.PI / 4.0)
        acc

    [<Benchmark>]
    member this.MachZehnderMergeSweep() =
        let detectorZero = this.frames.[0]
        let detectorOne = this.frames.[1]
        let half = { Real = 0.5; Imag = 0.0 }
        let mutable acc = 0.0
        for _ in 1 .. this.Size do
            let amp: AmplitudeEmu.Amp =
                [ detectorZero, half
                  detectorZero, half
                  detectorOne, half
                  detectorOne, { Real = -0.5; Imag = 0.0 } ]
            acc <- acc + (amp |> AmplitudeEmu.merge |> AmplitudeEmu.intensity)
        acc
