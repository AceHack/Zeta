module Zeta.Bayesian.Tests.QuantumFusionTests
#nowarn "0893"

open System
open System.IO
open System.Reflection
open System.Threading.Tasks
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

let private ctx () : IntrCtx =
    { Memetic = "quantum-fusion"
      Prompt = ""
      Trust = ""
      Log = ""
      Otel = System.Diagnostics.ActivityContext() }

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

let private openRow = QuantumObservableDbsp.machZehnderOpenReferenceRow ()

let private piRow =
    QuantumObservableDbsp.machZehnderClosedReferenceRow
        "mach-zehnder-closed-pi-phase"
        "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiPhase"
        Math.PI

let private flowZero = QuantumObservableDbsp.flowBitRow false
let private flowOne = QuantumObservableDbsp.flowBitRow true

let private retDelta source sequence row weight : ReticulumQuantum.ObservableDelta =
    { Source = source
      Sequence = sequence
      Row = row
      Weight = weight }

let private exteriorIds (report: QuantumFusion.Report) =
    report.Exterior
    |> GSet.toList
    |> List.map (fun fact -> fact.Id)
    |> Set.ofList

let private boardedIds (report: QuantumFusion.Report) =
    report.Prediction.Boarded
    |> List.map (fun branch -> branch.State.Id)

let private forecastIds (forecast: QuantumFusion.Forecast<QuantumFusion.ReticulumFuture>) =
    forecast.Branches
    |> List.map (fun branch -> branch.State.Fact.Id)

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
    Assert.Equal(3, report.Ledger.DeltaCount)
    Assert.Equal(2, report.Ledger.TouchedIdentities)
    Assert.Equal(1, report.Ledger.ExteriorIdentities)
    Assert.Equal(1, report.Ledger.HiddenInteriorIdentities)

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
    Assert.Equal(3, report.Ledger.DeltaCount)
    Assert.Equal(1, report.Ledger.TouchedIdentities)
    Assert.Equal(1, report.Ledger.ExteriorIdentities)
    Assert.Equal(0, report.Ledger.HiddenInteriorIdentities)

[<Fact>]
let ``Vision budget backpressure does not change fused arithmetic truth`` () =
    let heatSink = RecordingHeatSink()

    let deltas =
        QuantumObservableDbsp.machZehnderDeltas (heatSink :> IHeatSink) "quantum-fusion"
        |> mustOk
        |> _.Value

    let report =
        deltas
        |> QuantumFusion.fuseDeltas budget (SoftThrottle.tank 0.0 0.0)
        |> mustOk

    Assert.Equal(6, GSet.count report.Exterior)
    Assert.Empty(report.Prediction.Boarded)
    Assert.Equal(6, report.Prediction.Deferred.Length)
    Assert.Equal(Vision.RejectedWithBackpressure, report.Prediction.Outcome)

[<Fact>]
let ``QSharp flow-bit oracle plugin bifurcates flow then fuses one exterior identity`` () =
    let oracle =
        [ QuantumObservableDbsp.delta flowZero 1L
          QuantumObservableDbsp.delta flowZero -1L
          QuantumObservableDbsp.delta flowOne 1L ]
        |> QuantumFusion.oracleFromDeltas "qsharp-flow-bit-golden"

    let report =
        oracle
        |> QuantumFusion.fuseOracle budget (SoftThrottle.tank 4096.0 0.0)
        |> mustOk

    Assert.Equal(1, GSet.count report.Exterior)
    let fact = report.Exterior |> GSet.toList |> List.exactlyOne
    Assert.Equal("FlowBitDistinction", fact.Kind)
    Assert.Equal("external-bit-one", fact.Id)
    Assert.Equal("Zeta.ReferenceOracle.ApplyExternalBitDistinguishOne", fact.Operation)
    Assert.Equal(Vision.Admitted, report.Prediction.Outcome)

[<Fact>]
let ``attention changes boarding order but not fused DBSP truth`` () =
    let deltas =
        [ QuantumObservableDbsp.delta flowZero 1L
          QuantumObservableDbsp.delta flowOne 1L ]

    let favor id : QuantumFusion.AttentionPolicy =
        fun (_: Beta) (fact: QuantumFusion.BoundaryFact) -> if fact.Id = id then 10.0 else 0.1

    let oneFirst =
        deltas
        |> QuantumFusion.fuseDeltasWithAttention budget (SoftThrottle.tank 100.0 0.0) (favor "external-bit-one")
        |> mustOk

    let zeroFirst =
        deltas
        |> QuantumFusion.fuseDeltasWithAttention budget (SoftThrottle.tank 100.0 0.0) (favor "external-bit-zero")
        |> mustOk

    Assert.True(exteriorIds oneFirst = exteriorIds zeroFirst)
    oneFirst.Posterior.Alpha |> should (equalWithin 1e-9) zeroFirst.Posterior.Alpha
    oneFirst.Posterior.Beta |> should (equalWithin 1e-9) zeroFirst.Posterior.Beta
    Assert.Equal(Vision.PartiallyAdmitted, oneFirst.Prediction.Outcome)
    Assert.Equal(Vision.PartiallyAdmitted, zeroFirst.Prediction.Outcome)
    Assert.Equal<string list>([ "external-bit-one" ], boardedIds oneFirst)
    Assert.Equal<string list>([ "external-bit-zero" ], boardedIds zeroFirst)
    Assert.Equal(2, oneFirst.Ledger.ExteriorIdentities)
    Assert.Equal(0, oneFirst.Ledger.HiddenInteriorIdentities)

[<Fact>]
let ``time horizon bytes backpressure without changing exterior fusion`` () =
    let horizon = { budget with TimeTicks = 4; BytesPerTick = 64L }

    let report =
        [ QuantumObservableDbsp.delta flowOne 1L ]
        |> QuantumFusion.fuseDeltas horizon (SoftThrottle.tank 100.0 0.0)
        |> mustOk

    Assert.True(Set.singleton "external-bit-one" = exteriorIds report)
    Assert.Empty(report.Prediction.Boarded)
    Assert.Single(report.Prediction.Deferred) |> ignore
    Assert.Equal(Vision.RejectedWithBackpressure, report.Prediction.Outcome)
    Assert.True(report.Prediction.DeferredBytes > int64 report.Prediction.TankBefore.Charge)

[<Fact>]
let ``Reticulum forecast turns fused facts into scheduler future branches`` () =
    let deltas =
        [ retDelta "edge-zero" 10L flowZero 1L
          retDelta "edge-one" 11L flowOne 1L ]

    let favorOne : QuantumFusion.AttentionPolicy =
        fun (_: Beta) (fact: QuantumFusion.BoundaryFact) ->
            if fact.Id = "external-bit-one" then 10.0 else 0.1

    let forecast =
        deltas
        |> QuantumFusion.forecastReticulumDeltasWithAttention budget favorOne
        |> mustOk

    Assert.Equal(2, forecast.Snapshot.Ledger.ExteriorIdentities)
    Assert.Equal<string list>([ "external-bit-one"; "external-bit-zero" ], forecastIds forecast)

    let first = forecast.Branches.Head
    Assert.Equal("external-bit-one", first.State.Fact.Id)
    Assert.Equal<string list>([ "edge-one" ], first.State.Sources)
    Assert.Equal(11L, first.State.FirstSequence)
    Assert.Equal(11L, first.State.LastSequence)
    Assert.Equal(1, first.State.DeltaCount)
    Assert.True(first.State.WireBytes > 0L)
    Assert.True(first.Cost.SpaceBytes >= first.State.WireBytes)

    let firstBytes = Vision.branchBytes first.Cost |> mustOk

    let report =
        Vision.predictBranches forecast.Branches (SoftThrottle.tank (float firstBytes) 0.0)
        |> mustOk

    Assert.Equal(Vision.PartiallyAdmitted, report.Outcome)

    Assert.Equal<string list>(
        [ "external-bit-one" ],
        report.Boarded |> List.map (fun branch -> branch.State.Fact.Id)
    )

[<Fact>]
let ``Reticulum forecaster plugs into the owned Vision port`` () =
    let deltas =
        [ retDelta "edge-zero" 30L flowZero 1L
          retDelta "edge-one" 31L flowOne 1L ]

    let favorZero : QuantumFusion.AttentionPolicy =
        fun (_: Beta) (fact: QuantumFusion.BoundaryFact) ->
            if fact.Id = "external-bit-zero" then 10.0 else 0.1

    let forecaster = QuantumFusion.reticulumForecasterWithAttention budget favorZero

    let forecast =
        (deltas :> ReticulumQuantum.ObservableDelta seq)
        |> Vision.forecastWith forecaster
        |> mustOk

    Assert.Equal<string list>([ "external-bit-zero"; "external-bit-one" ], forecastIds forecast)

    let firstBytes = Vision.branchBytes forecast.Branches.Head.Cost |> mustOk

    let report =
        Vision.predictForecast forecast (SoftThrottle.tank (float firstBytes) 0.0)
        |> mustOk

    Assert.Equal(Vision.PartiallyAdmitted, report.Outcome)
    Assert.Equal("external-bit-zero", report.Boarded.Head.State.Fact.Id)

[<Fact>]
let ``Reticulum forecaster records scheduler prediction through the Vision wrapper`` () =
    task {
        let deltas =
            [ retDelta "edge-zero" 40L flowZero 1L
              retDelta "edge-one" 41L flowOne 1L ]

        let favorOne : QuantumFusion.AttentionPolicy =
            fun (_: Beta) (fact: QuantumFusion.BoundaryFact) ->
                if fact.Id = "external-bit-one" then 10.0 else 0.1

        let forecaster = QuantumFusion.reticulumForecasterWithAttention budget favorOne
        let makeInput _ _ = deltas :> ReticulumQuantum.ObservableDelta seq
        let feedbackText feedback = sprintf "%A" feedback

        let handler =
            SoftScheduler.handlerK
                "count"
                (function TimerElapsed _ -> true | _ -> false)
                (fun _ _ count -> Task.FromResult(Ok(count + 1)))

        let forecast =
            Vision.forecastWith forecaster (deltas :> ReticulumQuantum.ObservableDelta seq)
            |> mustOk

        let firstBytes = Vision.branchBytes forecast.Branches.Head.Cost |> mustOk

        let initial: Vision.ForecastBudgeted<int, QuantumFusion.FusionSnapshot, QuantumFusion.ReticulumFuture> =
            Vision.forecastBudgeted 0 (SoftThrottle.tank (float firstBytes) 0.0)

        let source _ = [ TimerElapsed 17 ]

        let! result =
            (SoftScheduler.driveK [ Vision.wrapForecastHandlerK makeInput forecaster feedbackText handler ] source)
                .Run(ctx ()) 7L initial 1

        let final = result |> mustOk
        Assert.Equal(1, final.Inner)
        Assert.Equal(1, final.Tick)

        match final.LastForecast, final.LastPrediction with
        | Some recordedForecast, Some report ->
            Assert.Equal(2, recordedForecast.Snapshot.Ledger.ExteriorIdentities)
            Assert.Equal(Vision.PartiallyAdmitted, report.Outcome)
            Assert.Equal<string list>(
                [ "external-bit-one" ],
                report.Boarded |> List.map (fun branch -> branch.State.Fact.Id)
            )
        | _ -> Assert.Fail "Vision should record the Reticulum forecast and prediction"
    }

[<Fact>]
let ``Reticulum forecast keeps retracted interior churn out of branch states`` () =
    let deltas =
        [ retDelta "edge" 20L openRow 1L
          retDelta "edge" 21L openRow -1L
          retDelta "edge" 22L piRow 1L ]

    let forecast =
        deltas
        |> QuantumFusion.forecastReticulumDeltasWithAttention budget (fun posterior _ -> Beta.mean posterior)
        |> mustOk

    Assert.Equal(3, forecast.Snapshot.Ledger.DeltaCount)
    Assert.Equal(2, forecast.Snapshot.Ledger.TouchedIdentities)
    Assert.Equal(1, forecast.Snapshot.Ledger.ExteriorIdentities)
    Assert.Equal(1, forecast.Snapshot.Ledger.HiddenInteriorIdentities)

    let branch = Assert.Single forecast.Branches
    Assert.Equal("mach-zehnder-closed-pi-phase", branch.State.Fact.Id)
    Assert.Equal(1, branch.State.DeltaCount)
    Assert.Equal(22L, branch.State.FirstSequence)
    Assert.Equal(22L, branch.State.LastSequence)

[<Fact>]
let ``invalid attention policy returns feedback instead of throwing`` () =
    match
        [ QuantumObservableDbsp.delta flowOne 1L ]
        |> QuantumFusion.fuseDeltasWithAttention budget (SoftThrottle.tank 4096.0 0.0) (fun _ _ -> Double.NaN)
    with
    | Error (QuantumFusion.VisionBudget (VisionAttention.InvalidAttentionWeight value)) -> Assert.True(Double.IsNaN value)
    | other -> Assert.Fail(sprintf "expected InvalidAttentionWeight, got %A" other)

[<Fact>]
let ``invalid quantum fusion budget returns feedback instead of throwing`` () =
    let invalid = { budget with ResolutionBits = -1 }

    match QuantumFusion.fuseDeltas invalid (SoftThrottle.tank 4096.0 0.0) [ QuantumObservableDbsp.delta piRow 1L ] with
    | Error (QuantumFusion.NegativeResolutionBits -1) -> ()
    | other -> Assert.Fail(sprintf "expected NegativeResolutionBits, got %A" other)
