module Zeta.Bayesian.Tests.QuantumFusionTests
#nowarn "0893"

open System
open System.IO
open System.Reflection
open System.Text.Json
open FsUnit.Xunit
open global.Xunit
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

let private qsharpGolden () =
    Path.Join(repoRoot (), "src", "Core.QSharp.ReferenceOracle", "qsharp-golden.json")
    |> File.ReadAllText
    |> JsonDocument.Parse

let private qsharpInterferenceIds () =
    use doc = qsharpGolden ()
    doc.RootElement.GetProperty("vectors").GetProperty("interferenceVisibility").EnumerateArray()
    |> Seq.map (fun item -> item.GetProperty("id").GetString())
    |> Set.ofSeq

let private budget : QuantumFusion.Budget =
    { Prior = Beta.create 1.0 1.0
      BaseSpaceBytes = 8L
      TimeTicks = 0
      BytesPerTick = 0L
      ResolutionBits = 16 }

let private openRow = QuantumObservableDbsp.machZehnderOpenRow ()

let private piRow =
    QuantumObservableDbsp.machZehnderClosedRow
        "mach-zehnder-closed-pi-phase"
        "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiPhase"
        Math.PI

[<Fact>]
let ``QSharp Mach-Zehnder deltas fuse into an exterior Bayesian GSet`` () =
    let report =
        [ QuantumObservableDbsp.delta openRow 1L
          QuantumObservableDbsp.delta piRow 1L
          QuantumObservableDbsp.delta openRow -1L ]
        |> QuantumFusion.fuseDeltas budget (SoftThrottle.tank 4096.0 0.0)
        |> mustOk

    let facts = report.Exterior |> GSet.toList
    Assert.Single facts |> ignore
    let fact = facts.Head

    Assert.Equal("InterferenceVisibility", fact.Kind)
    Assert.Equal("mach-zehnder-closed-pi-phase", fact.Id)
    Assert.Equal("Zeta.ReferenceOracle.ApplyMachZehnderClosedPiPhase", fact.Operation)
    Assert.Contains(fact.Id, qsharpInterferenceIds ())

    // Two touched identities, one exterior survivor: prior Beta(1,1) -> Beta(2,2).
    report.Posterior.Alpha |> should (equalWithin 1e-9) 2.0
    report.Posterior.Beta |> should (equalWithin 1e-9) 2.0
    Beta.mean report.Posterior |> should (equalWithin 1e-9) 0.5

[<Fact>]
let ``fusion hides multiplicity while Bayesian confidence counts exterior identity once`` () =
    let report =
        [ QuantumObservableDbsp.delta piRow 1L
          QuantumObservableDbsp.delta piRow 1L
          QuantumObservableDbsp.delta piRow 1L ]
        |> QuantumFusion.fuseDeltas budget (SoftThrottle.tank 4096.0 0.0)
        |> mustOk

    Assert.Equal(1, GSet.count report.Exterior)
    report.Posterior.Alpha |> should (equalWithin 1e-9) 2.0
    report.Posterior.Beta |> should (equalWithin 1e-9) 1.0

[<Fact>]
let ``Vision budget backpressure does not change fused arithmetic truth`` () =
    let report =
        QuantumObservableDbsp.machZehnderDeltas ()
        |> QuantumFusion.fuseDeltas budget (SoftThrottle.tank 0.0 0.0)
        |> mustOk

    Assert.Equal(6, GSet.count report.Exterior)
    Assert.Empty(report.Prediction.Boarded)
    Assert.Equal(6, report.Prediction.Deferred.Length)
    Assert.Equal(Vision.RejectedWithBackpressure, report.Prediction.Outcome)

[<Fact>]
let ``invalid quantum fusion budget returns feedback instead of throwing`` () =
    let invalid = { budget with ResolutionBits = -1 }

    match QuantumFusion.fuseDeltas invalid (SoftThrottle.tank 4096.0 0.0) [ QuantumObservableDbsp.delta piRow 1L ] with
    | Error (QuantumFusion.NegativeResolutionBits -1) -> ()
    | other -> Assert.Fail(sprintf "expected NegativeResolutionBits, got %A" other)
