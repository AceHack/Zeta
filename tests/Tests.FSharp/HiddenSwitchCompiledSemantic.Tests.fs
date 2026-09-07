namespace Zeta.Tests

open System
open System.IO
open System.Text.Json
open Xunit
open Zeta.Core
open Zeta.Research

module HiddenSwitchCompiledSemanticTests =
    let private get = function Ok value -> value | Error reason -> failwithf "unexpected refusal: %A" reason
    let private guards () =
        let binding = HiddenSwitchCompiledHand.bindings()
        let raw = HiddenSwitchCompiledCertificate.build binding |> get
        HiddenSwitchCompiledCertificate.verify raw binding |> get |> HiddenSwitchCompiledCertificate.guards
    let private sparse () = HiddenSwitchCarrier.handTapes() |> Array.find (fun (name, _) -> name = "sparse") |> snd
    let private json (value: 'a) = JsonSerializer.Serialize value
    let private episode (value: obj) = value :?> HiddenSwitchCompiledReceipt.Episode

    [<Fact>]
    let ``instrumented timeline preserves native episode and actual call distinctions`` () =
        let numeric = guards()
        for strategy in ["native-recursive"; "compiled-guarded"] do
            let actual, mutations = HiddenSwitchCompiledConformance.timeline ignore numeric strategy (sparse()) false false
            Assert.True(actual.Episode.Complete)
            Assert.Equal(json (HiddenSwitchCompiledHand.episode numeric strategy 18 (sparse()) true "dot" "fixed"), json actual.Episode)
            Assert.Empty mutations
            Assert.Equal(34, actual.Calls.EntryCalls)
            Assert.Equal(16, actual.Calls.ServiceEntries)
            if strategy = "native-recursive" then Assert.Equal(16, actual.Calls.EvaluatorEntries)
            Assert.Equal(49, actual.Events.Length)
            for index in 0 .. 15 do
                Assert.Equal("choose", actual.Events.[3 * index + 1].Kind)
                Assert.Equal("feedback", actual.Events.[3 * index + 2].Kind)
                Assert.Equal("observe", actual.Events.[3 * index + 3].Kind)

    [<Fact>]
    let ``executed interventions change private targets while preserving specified policy prefixes`` () =
        let rows, outcome, _ = HiddenSwitchCompiledInterventions.collect ignore (guards())
        outcome |> get
        Assert.Equal(10, rows.Length)
        for strategy in ["native-recursive"; "compiled-guarded"] do
            let find kind = rows |> Array.find (fun row -> row.CaseId = kind + "/" + strategy)
            let suffix = find "future-suffix"
            let before, after = episode suffix.Before, episode suffix.After
            Assert.Equal(before.Actions.Substring(0, 9), after.Actions.Substring(0, 9))
            Assert.NotEqual(before.States.[9], after.States.[9])
            Assert.NotEqual(before.Cues.[9], after.Cues.[9])
            let score = find "scorer-receipt-noninterference"
            let beforeScore, afterScore = episode score.Before, episode score.After
            Assert.Contains(beforeScore.Reward4, fun reward -> reward <> 0)
            Assert.All(afterScore.Reward4, fun reward -> Assert.Equal(0, reward))
            Assert.Equal<string>(beforeScore.FrameSha256, afterScore.FrameSha256)
            Assert.Equal(beforeScore.Actions, afterScore.Actions)
            let band = find "private-band-noninterference"
            let beforeBand, afterBand = episode band.Before, episode band.After
            Assert.Equal<string>(beforeBand.ProjectionSha256, afterBand.ProjectionSha256)
            for index in 0 .. 16 do Assert.NotEqual<string>(beforeBand.FrameSha256.[index], afterBand.FrameSha256.[index])
            let copy = find "caller-copy-isolation"
            use doc = JsonDocument.Parse(json copy.After)
            let root = doc.RootElement
            Assert.NotEqual<string>(root.GetProperty("RetainedSnapshot").GetProperty("BeliefBits").GetString(),
                            root.GetProperty("ControlObservedSnapshot").GetProperty("BeliefBits").GetString())
            Assert.Equal(5, copy.Events.Length)

    [<Fact>]
    let ``all fifty three invalid calls preserve actual refusal and avoid evaluator entry`` () =
        let groups, outcome, _ = HiddenSwitchCompiledRefusals.collect ignore (guards())
        outcome |> get
        Assert.Equal(15, groups.Length)
        Assert.Equal(53, groups |> Array.sumBy (fun group -> group.Operations.Length))
        for group in groups do
            for operation in group.Operations do
                Assert.Equal("refused", operation.Outcome.Kind)
                Assert.False(String.IsNullOrWhiteSpace operation.Outcome.Failure.Detail)
                Assert.Equal(1, operation.Calls.Operation.EntryCalls)
                Assert.Equal(0, operation.Calls.Operation.EvaluatorEntries)
                Assert.Equal((if operation.Operation = "fixture-raw-bits-service" then 1 else 0), operation.Calls.Operation.ServiceEntries)
        let terminal = groups |> Array.find (fun group -> group.CaseId = "terminal-choose")
        for operation in terminal.Operations do
            Assert.Equal(34, operation.Calls.Setup.EntryCalls)
            Assert.Equal(16, operation.Calls.Setup.ServiceEntries)
            Assert.Equal(49, operation.Setup.Events.Length)
            Assert.Equal("choice-order", operation.Outcome.Failure.Code)

    [<Fact>]
    let ``checkpoint failure retains already completed refusal operation in current group`` () =
        let numeric = guards()
        let checkpoint (value: obj) =
            use doc = JsonDocument.Parse(json value)
            if doc.RootElement.GetProperty("Kind").GetString() = "refusal-operation" then
                raise (IOException "synthetic checkpoint write failure")
        let groups, outcome, _ = HiddenSwitchCompiledRefusals.collect checkpoint numeric
        Assert.True(Result.isError outcome)
        Assert.Single groups |> ignore
        Assert.Single groups.[0].Operations |> ignore
        Assert.Equal("belief", groups.[0].Operations.[0].Outcome.Failure.Code)

    [<Fact>]
    let ``unexpected accepted result retains actual returned choice and call deltas`` () =
        let counter = HiddenSwitchCompiledConformance.Counter()
        counter.Enter()
        let given = box {| BeliefBits = "3FE0000000000000"; Effect = true; Depth = 3 |}
        let returned = HiddenSwitchCompiledConformance.service counter (guards()) "native-recursive" true 0.5 3 |> get
        let setup: HiddenSwitchCompiledRefusals.Setup = { Initial = None; Events = [||] }
        let calls: HiddenSwitchCompiledRefusals.Calls =
            { Setup = HiddenSwitchCompiledConformance.Counter().Snapshot(); Operation = counter.Snapshot() }
        // The deliberately successful value exercises the same outcome judgment
        // used by invalid operations; it does not claim that this input is invalid.
        let outcome, diagnostic = HiddenSwitchCompiledRefusals.judge "synthetic-accepted" "native-recursive" "fixture-raw-bits-service" given setup calls (Ok(box returned))
        match outcome with
        | Ok _ -> failwith "accepted-result seam must refuse"
        | Error reason -> Assert.Equal("unexpected-acceptance", reason.Code)
        use doc = JsonDocument.Parse(json diagnostic)
        let root = doc.RootElement
        Assert.Equal(json returned, root.GetProperty("Returned").GetRawText())
        Assert.Equal(1, root.GetProperty("Calls").GetProperty("Operation").GetProperty("EvaluatorEntries").GetInt32())
        Assert.Equal(returned.Nodes, root.GetProperty("Returned").GetProperty("Nodes").GetUInt32())

    [<Fact>]
    let ``broken setup journal preserves active observation and actual counters`` () =
        let checkpoint (value: obj) =
            use doc = JsonDocument.Parse(json value)
            if doc.RootElement.GetProperty("Kind").GetString() = "refusal-setup-event" then
                raise (IOException "synthetic setup publication failure")
        let _, outcome, active = HiddenSwitchCompiledRefusals.collect checkpoint (guards())
        Assert.True(Result.isError outcome)
        use doc = JsonDocument.Parse(json active)
        let root = doc.RootElement
        Assert.Equal(1, root.GetProperty("Setup").GetProperty("Events").GetArrayLength())
        Assert.Equal(2, root.GetProperty("Calls").GetProperty("Setup").GetProperty("EntryCalls").GetInt32())
        Assert.Equal(0, root.GetProperty("Calls").GetProperty("Operation").GetProperty("EntryCalls").GetInt32())
        Assert.Equal(1, root.GetProperty("Policy").GetProperty("Observed").GetInt32())
        Assert.Equal("observe", root.GetProperty("Operation").GetString())
        Assert.Equal(4096, root.GetProperty("Input").GetProperty("Frame").GetProperty("CellsHex").GetString().Length)

    [<Fact>]
    let ``broken copy journal preserves changed caller and actual retained choice`` () =
        let checkpoint (value: obj) =
            use doc = JsonDocument.Parse(json value)
            let root = doc.RootElement
            if root.GetProperty("Kind").GetString() = "copy-event" && root.GetProperty("Data").GetProperty("Kind").GetString() = "choose" then
                raise (IOException "synthetic copy publication failure")
        let rows, outcome, active = HiddenSwitchCompiledInterventions.collect checkpoint (guards())
        Assert.True(Result.isError outcome)
        Assert.Equal(8, rows.Length)
        use doc = JsonDocument.Parse(json active)
        let root = doc.RootElement
        Assert.Equal("active-copy", root.GetProperty("Kind").GetString())
        Assert.Equal(3, root.GetProperty("Events").GetArrayLength())
        Assert.Equal("choose", root.GetProperty("Events").[2].GetProperty("Kind").GetString())
        Assert.Equal(1, root.GetProperty("Calls").GetProperty("ServiceEntries").GetInt32())
        Assert.Equal(root.GetProperty("Cells").GetString(), root.GetProperty("Events").[1].GetProperty("Output").GetProperty("Cells").GetString())

    [<Fact>]
    let ``independent final output retains active choice when journal stays broken`` () =
        let directory = Path.Combine(Path.GetTempPath(), "zeta-semantic-fault-" + Guid.NewGuid().ToString("N"))
        Directory.CreateDirectory directory |> ignore
        let output = Path.Combine(directory, "semantic.json")
        let mutable broken = false
        let checkpoint (value: obj) =
            use doc = JsonDocument.Parse(json value)
            let root = doc.RootElement
            if root.GetProperty("Kind").GetString() = "conformance-event" && root.GetProperty("Data").GetProperty("Kind").GetString() = "choose" then
                broken <- true
            if broken then raise (IOException "synthetic persistent journal failure")
        let outcome = HiddenSwitchCompiledSemantic.runWithJournalObserver checkpoint output
        Assert.True(Result.isError outcome)
        use doc = JsonDocument.Parse(File.ReadAllBytes output)
        let root = doc.RootElement
        Assert.False(root.GetProperty("SlicesComplete").GetBoolean())
        Assert.Equal("hand-conformance", root.GetProperty("Failure").GetProperty("Stage").GetString())
        let active = root.GetProperty("ActiveDiagnostic")
        let episode = active.GetProperty("Episode")
        Assert.Equal(1, episode.GetProperty("Cues").GetString().Length)
        Assert.Equal(1, episode.GetProperty("Actions").GetString().Length)
        Assert.Equal(1, episode.GetProperty("ChoiceWork").GetArrayLength())
        Assert.Equal(1, episode.GetProperty("BeliefBits").GetArrayLength())
        Assert.Equal(2, active.GetProperty("Events").GetArrayLength())
        Assert.Equal(1, active.GetProperty("Calls").GetProperty("ServiceEntries").GetInt32())
        Assert.Equal(int (active.GetProperty("Episode").GetProperty("ChoiceWork").[0].GetProperty("Action").GetByte()), active.GetProperty("Policy").GetProperty("PendingAction").GetInt32())
        // Remove only this successful fixture's owned files. Failed assertions
        // leave the independent report and journal for diagnosis.
        doc.Dispose()
        Directory.Delete(directory, true)

    [<Fact>]
    let ``broken suffix checkpoint retains executed mutation and baseline`` () =
        let checkpoint (value: obj) =
            use doc = JsonDocument.Parse(json value)
            if doc.RootElement.GetProperty("Kind").GetString() = "intervention-mutation" then
                raise (IOException "synthetic mutation publication failure")
        let rows, outcome, active = HiddenSwitchCompiledInterventions.collect checkpoint (guards())
        Assert.True(Result.isError outcome)
        Assert.Equal(2, rows.Length)
        use doc = JsonDocument.Parse(json active)
        let context = doc.RootElement.GetProperty("Context")
        Assert.True(context.GetProperty("Baseline").GetProperty("Complete").GetBoolean())
        let mutation = context.GetProperty("Events").[0]
        Assert.Equal("tape-replace", mutation.GetProperty("Kind").GetString())
        let before = mutation.GetProperty("Input").GetProperty("Tape").GetProperty("Drift").GetString()
        let after = mutation.GetProperty("Output").GetProperty("Tape").GetProperty("Drift").GetString()
        Assert.Equal(before.Substring(0, 8), after.Substring(0, 8))
        Assert.NotEqual(before.[8], after.[8])
        Assert.Equal(after, context.GetProperty("ChangedTape").GetProperty("Drift").GetString())
