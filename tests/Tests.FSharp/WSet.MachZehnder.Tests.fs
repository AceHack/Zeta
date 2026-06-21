module Zeta.Tests.WSetMachZehnderTests

// THREE ORACLES ON ONE INTERFEROMETER (081KTZ4EF0008QG0R001R3XPYV first demo, Aaron's "yes please too"):
// the Mach-Zehnder as a two-key WSet circuit over the ℂ ring, cross-checked against
//   (1) the F# analytic law  P(0) = cos²(φ/2)                    — exact
//   (2) AmplitudeEmu          (the in-tree ℂ-weighted instance)   — exact
//   (3) Vera's Q# treaty transcript (sampled hardware-shape runs) — within sampling tolerance
// One linear calculus, the Born rule only at the boundary — the ZSet↔quantum connection, literal.

open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

let private repoRoot () =
    let mutable dir = DirectoryInfo(System.AppContext.BaseDirectory)
    while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    dir.FullName

let private probFor (k: int) (ps: (int * float) list) =
    ps |> List.filter (fun (key, _) -> key = k) |> List.sumBy snd

[<Fact>]
let ``ORACLE 1 — analytic: the WSet interferometer reproduces P(0) = cos²(φ/2) across the phase sweep, exactly`` () =
    for phi in [ 0.0; System.Math.PI / 3.0; System.Math.PI / 2.0; 2.0 * System.Math.PI / 3.0; System.Math.PI ] do
        let ps = MachZehnderWSet.closed phi
        let expected = cos (phi / 2.0) ** 2.0
        Assert.True(abs (probFor 0 ps - expected) < 1e-12, sprintf "phi=%f" phi)
        Assert.True(abs (probFor 1 ps - (1.0 - expected)) < 1e-12, sprintf "phi=%f (one)" phi)
    // the OPEN arm: no recombination, no interference — equal halves
    let openPs = MachZehnderWSet.openArm ()
    Assert.True(abs (probFor 0 openPs - 0.5) < 1e-12)

[<Fact>]
let ``ORACLE 2 — AmplitudeEmu: the WSet circuit and the frame-ensemble emulator agree (two in-tree ℂ instances, one number)`` () =
    let ring = ImaginaryStack.complex
    let frame (seed: uint64) = Chip8Cow.create seed
    let half = Doubled.make 0.5 0.0
    let phase (theta: float) = Doubled.make (cos theta) (sin theta)
    for phi in [ 0.0; System.Math.PI / 3.0; System.Math.PI / 2.0; System.Math.PI ] do
        // the emulator's closed interferometer (the QSharpOracle construction, two frames as detectors)
        let amp: AmplitudeEmu.Amp =
            [ frame 0UL, ring.Mul(half, phase (-phi / 2.0))
              frame 0UL, ring.Mul(half, phase (phi / 2.0))
              frame 1UL, ring.Mul(half, phase (-phi / 2.0))
              frame 1UL, ring.Negate(ring.Mul(half, phase (phi / 2.0))) ]
        let emuProbs = amp |> AmplitudeEmu.merge |> AmplitudeEmu.bornProb
        let emuZero = emuProbs |> List.filter (fun (f, _) -> f = frame 0UL) |> List.sumBy snd
        let ws = MachZehnderWSet.closed phi
        Assert.True(abs (probFor 0 ws - emuZero) < 1e-9, sprintf "phi=%f" phi)

[<Fact>]
let ``ORACLE 3 — the Q# treaty transcript: the WSet circuit lands inside the sampled grid's tolerance, row by row`` () =
    let path = Path.Combine(repoRoot (), "src", "Core.QSharp.ReferenceOracle", "treaty-transcript.json")
    let jobs = JsonDocument.Parse(File.ReadAllText path).RootElement.GetProperty "jobs"
    let results = jobs.GetProperty("interferenceGrid").GetProperty("results").EnumerateArray() |> Seq.toArray
    Assert.True(results.Length >= 6)
    for res in results do
        let isOpen = res.GetProperty("operation").GetString().EndsWith "Open"
        let qsZero = res.GetProperty("qsharp").GetProperty("Zero").GetDouble()
        let ws =
            if isOpen then MachZehnderWSet.openArm ()
            else
                let p = res.GetProperty "phase"
                MachZehnderWSet.closed (if p.ValueKind = JsonValueKind.Null then 0.0 else p.GetDouble())
        Assert.True(abs (probFor 0 ws - qsZero) < 1e-3, res.GetProperty("id").GetString()) // sampled oracle: sampling tolerance
