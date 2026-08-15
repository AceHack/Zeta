module Zeta.Tests.QuantumObservableDbspTests

open System
open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

let private repoRoot () =
    let mutable dir = DirectoryInfo(System.AppContext.BaseDirectory)
    while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    dir.FullName

let private tolerance = 1e-5

let private mustOk =
    function
    | Ok value -> value
    | Error feedback -> failwithf "unexpected Mach-Zehnder heat feedback: %A" feedback

let private interferenceRowsById (rows: ZSet<QuantumObservableRow>) =
    rows
    |> Seq.choose (fun kv ->
        match kv.Key with
        | QuantumObservableRow.InterferenceVisibility v -> Some(v.Id, v)
        | _ -> None)
    |> Map.ofSeq

let private assertInterferenceNear
    (actual: QuantumObservableTreaty.InterferenceVisibility)
    (expected: QuantumObservableTreaty.InterferenceVisibility)
    =
    Assert.Equal(expected.Operation, actual.Operation)
    Assert.Equal<float option>(expected.PhaseRadians, actual.PhaseRadians)
    Assert.Equal<float option>(expected.Visibility, actual.Visibility)

    Assert.True(
        abs (actual.Probabilities.Zero - expected.Probabilities.Zero) <= tolerance,
        sprintf "%s Zero expected %f, got %f" actual.Id expected.Probabilities.Zero actual.Probabilities.Zero
    )

    Assert.True(
        abs (actual.Probabilities.One - expected.Probabilities.One) <= tolerance,
        sprintf "%s One expected %f, got %f" actual.Id expected.Probabilities.One actual.Probabilities.One
    )

[<Fact>]
let ``F# parses quantum Z-set transcript and verifies parity under DBSP updates`` () =
    let path = Path.Combine(repoRoot (), "src", "Core.TypeScript", "quantum-observable", "quantum-treaty-transcript.json")
    let json = File.ReadAllText path
    let transcript = JsonSerializer.Deserialize<Transcript>(json)

    Assert.Equal("zeta.quantum.zset-transcript.v1", transcript.Schema)
    Assert.Equal(2, transcript.Batches.Length)

    // Batch 0
    let batch0 = transcript.Batches.[0]
    Assert.Equal(0, batch0.BatchId)

    let batch0Z =
        batch0.Deltas
        |> List.map (fun d -> d.Row, d.Weight)
        |> ZSet.ofSeq

    // Initial state after Batch 0
    let state = batch0Z
    Assert.Equal(19, ZSet.count state) // 19 distinct rows

    // Query 1: Filter Mach-Zehnder interference rows
    let interferenceRows =
        state
        |> ZSet.filter (fun r ->
            match r with
            | QuantumObservableRow.InterferenceVisibility _ -> true
            | _ -> false)

    Assert.Equal(6, ZSet.count interferenceRows)

    let heatSink = RecordingHeatSink()

    let meteredRows =
        QuantumObservableDbsp.machZehnderZSet (heatSink :> IHeatSink) "quantum-observable-dbsp"
        |> mustOk

    let wsetInterferenceRows = meteredRows.Value |> interferenceRowsById
    Assert.Equal(6, wsetInterferenceRows.Count)
    Assert.Equal(12, meteredRows.Heat.Length)
    Assert.Equal<HeatSignature list>(meteredRows.Heat, List.ofSeq heatSink.Signatures)

    // Check Mach-Zehnder probabilities against the source-owned WSet→observable-row bridge.
    for kv in interferenceRows do
        match kv.Key with
        | QuantumObservableRow.InterferenceVisibility v ->
            let expected = wsetInterferenceRows.[v.Id]
            assertInterferenceNear v expected
        | _ -> Assert.Fail("Expected InterferenceVisibility row")

    // Query 2: Filter Bell Coincidence rows
    let coincidenceRows =
        state
        |> ZSet.filter (fun r ->
            match r with
            | QuantumObservableRow.BellCoincidence _ -> true
            | _ -> false)

    Assert.Equal(4, ZSet.count coincidenceRows)

    for kv in coincidenceRows do
        match kv.Key with
        | QuantumObservableRow.BellCoincidence v ->
            let expected =
                if v.State = "Singlet" then
                    if v.Event = "oppositeOutcome" then
                        BellTest.coincidenceProbability v.A v.B
                    else
                        1.0 - BellTest.coincidenceProbability v.A v.B
                else // PhiPlus
                    if v.Event = "sameOutcome" then
                        BellTest.coincidenceProbability v.A v.B
                    else
                        1.0 - BellTest.coincidenceProbability v.A v.B

            Assert.True(abs (v.Probability - expected) <= tolerance, sprintf "%s probability expected %f, got %f" v.Id expected v.Probability)
        | _ -> Assert.Fail("Expected BellCoincidence row")

    // Batch 1: Retractions and updates
    let batch1 = transcript.Batches.[1]
    Assert.Equal(1, batch1.BatchId)

    let batch1Z =
        batch1.Deltas
        |> List.map (fun d -> d.Row, d.Weight)
        |> ZSet.ofSeq

    // Apply incremental update (DBSP state update)
    let state' = state + batch1Z

    // Validate retractions (deleted entries must have weight 0 and be dropped from the Z-set)
    let interferenceRows' =
        state'
        |> ZSet.filter (fun r ->
            match r with
            | QuantumObservableRow.InterferenceVisibility _ -> true
            | _ -> false)

    // 6 original MZ rows - 2 retracted + 1 new = 5 rows
    Assert.Equal(5, ZSet.count interferenceRows')

    // Assert retracted keys are completely gone
    for kv in interferenceRows' do
        match kv.Key with
        | QuantumObservableRow.InterferenceVisibility v ->
            Assert.NotEqual<string>("mach-zehnder-open", v.Id)
            Assert.NotEqual<string>("mach-zehnder-closed-zero-phase", v.Id)
        | _ -> ()

    // Verify new row is present and correct
    let piOver6RowOpt =
        interferenceRows'
        |> ZSet.filter (fun r ->
            match r with
            | QuantumObservableRow.InterferenceVisibility v -> v.Id = "mach-zehnder-closed-pi-over-6-phase"
            | _ -> false)

    Assert.Equal(1, ZSet.count piOver6RowOpt)
    
    // Validate new row probabilities against F# analytic
    let piOver6Key = (Seq.head piOver6RowOpt).Key
    match piOver6Key with
    | QuantumObservableRow.InterferenceVisibility v ->
        let expected =
            QuantumObservableDbsp.machZehnderClosedReferenceRow
                "mach-zehnder-closed-pi-over-6-phase"
                "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiOver6Phase"
                (System.Math.PI / 6.0)

        match expected with
        | QuantumObservableRow.InterferenceVisibility expectedVisibility -> assertInterferenceNear v expectedVisibility
        | _ -> Assert.Fail("Expected InterferenceVisibility row")
    | _ -> Assert.Fail("Expected InterferenceVisibility row")

[<Fact>]
let ``Q# oracle observable rows live on the signed Z-set ledger`` () =
    let row =
        QuantumObservableDbsp.machZehnderClosedReferenceRow
            "mach-zehnder-closed-pi-phase"
            "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiPhase"
            Math.PI

    let signed =
        [ QuantumObservableDbsp.delta row 1L
          QuantumObservableDbsp.delta row -1L ]
        |> QuantumObservableDbsp.zsetOfDeltas

    Assert.True(ZSet.isEmpty signed)

[<Fact>]
let ``Mach-Zehnder DBSP generation emits every erasing boundary through the injected sink`` () =
    let sink = RecordingHeatSink()

    let generated =
        QuantumObservableDbsp.machZehnderRows (sink :> IHeatSink) "quantum-room"
        |> mustOk

    Assert.Equal(6, generated.Value.Length)
    Assert.Equal(12, generated.Heat.Length)
    Assert.Equal<HeatSignature list>(generated.Heat, List.ofSeq sink.Signatures)

    let kinds = generated.Heat |> List.countBy _.Kind |> Map.ofList
    Assert.Equal(6, kinds.["wset.consolidate.forgotten"])
    Assert.Equal(6, kinds.["wset.bornProb.forgotten"])
    Assert.All(generated.Heat, fun heat -> Assert.Equal(ShedDisposition.Annihilated, heat.Disposition.Value))

[<Fact>]
let ``Mach-Zehnder DBSP generation preserves completed heat when the next stage backpressures`` () =
    let sink = BoundedHeatSink(BoundedGSetConfig.noForgetBackpressure 1)

    match QuantumObservableDbsp.machZehnderRows (sink :> IHeatSink) "bounded-quantum-room" with
    | Ok _ -> Assert.Fail "the second heat signature must backpressure at capacity one"
    | Error feedback ->
        Assert.Empty feedback.CompletedRows
        Assert.Equal(MachZehnderWSetHeat.Stage.BornProjection, feedback.Measurement.Stage)
        Assert.Single feedback.Measurement.Completed |> ignore
        Assert.Equal("wset.consolidate.forgotten", feedback.Measurement.Completed.Head.Kind)
        Assert.Equal("wset.bornProb.forgotten", feedback.Measurement.Pending.Kind)

        match feedback.Measurement.Sink with
        | HeatSinkFeedback.Backpressure(heat, capacity, count) ->
            Assert.Equal(feedback.Measurement.Pending, heat)
            Assert.Equal(1, capacity)
            Assert.Equal(2, count)
        | other -> Assert.Fail(sprintf "expected typed backpressure, got %A" other)
