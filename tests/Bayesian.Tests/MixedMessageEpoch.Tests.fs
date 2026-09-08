module Zeta.Bayesian.Tests.MixedMessageEpochTests

open System
open System.Text
open System.Text.Json
open Xunit
open Zeta.Bayesian

module E = MixedMessageEpoch

let private accepted = function Ok x -> x | Error e -> failwithf "Unexpected refusal: %A" e
let private refused = function Error x -> x | Ok e -> failwithf "Unexpected acceptance: %A" e
let private raw (s: string) = Encoding.UTF8.GetBytes s

[<Fact>]
let ``canonical payload keeps CLR plus and HTML literal`` () =
    let expected = "{\"Html\":\"<>&'+`\",\"Type\":\"Zeta.Bayesian.BoundedModuleLearner+StepAttempt\"}"
    let supplied = "{ \"Type\": \"Zeta.Bayesian.BoundedModuleLearner\\u002bStepAttempt\", \"Html\":\"<>&'+`\" }"
    Assert.Equal<byte[]>(raw expected, E.tryCanonicalPayload (raw supplied) 65536 |> accepted)

[<Fact>]
let ``canonical payload uses minimal scalar escapes and UTF8`` () =
    let expected = "{\"Value\":\"\\\"\\\\\\b\\t\\n\\f\\r\\u0000\\u001f/é😀\u2028\u2029\"}"
    let supplied = "{\"Value\":\"\\u0022\\u005c\\u0008\\u0009\\u000a\\u000c\\u000d\\u0000\\u001f\\/\\u00e9\\ud83d\\ude00\\u2028\\u2029\"}"
    Assert.Equal<byte[]>(raw expected, E.tryCanonicalPayload (raw supplied) 65536 |> accepted)

[<Fact>]
let ``all control scalars use the fixed lowercase canonical grammar`` () =
    let escapes = [ for i in 0 .. 31 -> "\\u" + i.ToString("x4",Globalization.CultureInfo.InvariantCulture) ] |> String.concat ""
    let expected =
        [ for i in 0 .. 31 ->
            match i with
            | 8 -> "\\b" | 9 -> "\\t" | 10 -> "\\n" | 12 -> "\\f" | 13 -> "\\r"
            | _ -> "\\u" + i.ToString("x4",Globalization.CultureInfo.InvariantCulture) ] |> String.concat ""
    Assert.Equal<byte[]>(raw ("[\""+expected+"\"]"), E.tryCanonicalPayload (raw ("[\""+escapes+"\"]")) 65536 |> accepted)

[<Fact>]
let ``canonical core JSON refuses duplicate float nonfinite and isolated surrogate`` () =
    for bad in [ "{\"x\":1,\"x\":2}"; "[1.0]"; "[NaN]"; "[1e999]"; "[\"\\ud800\"]"; "{\"é\":1}" ] do
        E.tryCanonicalPayload (raw bad) 65536 |> refused |> ignore
    E.tryCanonicalPayload [| 0xffuy |] 65536 |> refused |> ignore

[<Fact>]
let ``canonical byte allowance is measured exactly before emission`` () =
    let expected = raw "{\"a\":\"+\",\"b\":3}"
    Assert.Equal<byte[]>(expected,E.tryCanonicalPayload expected expected.Length |> accepted)
    E.tryCanonicalPayload expected (expected.Length-1) |> refused |> ignore

[<Fact>]
let ``ordinary null core records return typed encoder failures`` () =
    E.tryEncodePlan Unchecked.defaultof<E.EpochPlan> |> refused |> ignore
    E.tryEncodeState Unchecked.defaultof<E.State> |> refused |> ignore
    E.tryEncodeObservation Unchecked.defaultof<E.Observation> 65536 |> refused |> ignore
    E.tryEncodeCheckpoint Unchecked.defaultof<E.Checkpoint> 65536 |> refused |> ignore
    E.tryEncodeCommit Unchecked.defaultof<E.Commit> 65536 |> refused |> ignore
    E.tryEncodeProjectionResponse Unchecked.defaultof<E.ProjectionResponse> |> refused |> ignore
    let actual = E.tryEncode Unchecked.defaultof<E.EpochResult> 65536 |> refused
    Assert.Null(box actual.Result)

[<Fact>]
let ``malformed passive JSON remains a typed publication failure`` () =
    let observation: E.Observation =
        { Sequence=1;Operation=E.NeuralForward("node",0);InputRevision=0L
          Inputs=E.RawInputs Unchecked.defaultof<JsonElement>;Call=E.NotEntered;Proposal=None
          Admission=None;AppliedRevision=None;Failure=None }
    let actual = E.tryEncodeObservation observation 65536 |> refused
    Assert.Equal("Admission",actual.Code)

[<Fact>]
let ``wire snapshot bool cannot stand in for an integer`` () =
    let supplied = "{\"SnapshotIndex\":true}"
    E.tryDecodeBudgetSnapshot (raw supplied) |> refused |> ignore

[<Fact>]
let ``zero output allowance refuses before examining invalid passive input`` () =
    let observation: E.Observation =
        { Sequence=1;Operation=E.NeuralForward("node",0);InputRevision=0L
          Inputs=E.RawInputs Unchecked.defaultof<JsonElement>;Call=E.NotEntered;Proposal=None
          Admission=None;AppliedRevision=None;Failure=None }
    let failure = E.tryEncodeObservation observation 0 |> refused
    Assert.Equal(Some "encoding",failure.Field)
    Assert.Contains("before source traversal",failure.Message)

[<Fact>]
let ``tiny allowance stops before a malformed late passive scalar`` () =
    let encoded = "[" + String.concat "," (List.replicate 256 "\"small\"" @ ["\"\\ud800\""]) + "]"
    use document = JsonDocument.Parse encoded
    let observation: E.Observation =
        { Sequence=1;Operation=E.NeuralForward("node",0);InputRevision=0L
          Inputs=E.RawInputs(document.RootElement.Clone());Call=E.NotEntered;Proposal=None
          Admission=None;AppliedRevision=None;Failure=None }
    let failure = E.tryEncodeObservation observation 128 |> refused
    Assert.Equal(Some "encoding",failure.Field)
    Assert.Contains("allowance",failure.Message)

[<Fact>]
let ``canonical bytes match the independently captured Python golden`` () =
    let controls = [ for i in 0 .. 31 -> "\\u"+i.ToString("x4",Globalization.CultureInfo.InvariantCulture) ] |> String.concat ""
    let supplied = "{\"Type\":\"Zeta.Bayesian.BoundedModuleLearner+StepAttempt\",\"Text\":\"<>&\\\"\\\\/\\u00e9\\ud83d\\ude00\\u2028\\u2029\",\"Controls\":\""+controls+"\"}"
    let canonical = E.tryCanonicalPayload (raw supplied) 65536 |> accepted
    Assert.Equal(273,canonical.Length)
    let actualHash = Convert.ToHexString(Security.Cryptography.SHA256.HashData canonical)
    Assert.Equal("BEB199B5B256A3735BC238BA0801493F271D5A7AC028254F6CDA06E5DE2E10F8",actualHash)

[<Fact>]
let ``zero allowance precedes full result source traversal`` () =
    let malformed = Unchecked.defaultof<E.EpochResult>
    let full = E.tryEncode malformed 0 |> refused
    Assert.Null(box full.Result)
    Assert.Equal(Some "encoding",full.Failure.Field)
    Assert.Contains("before source traversal",full.Failure.Message)

[<Fact>]
let ``zero allowance precedes terminal source traversal`` () =
    let terminal = E.tryEncodeTerminal Unchecked.defaultof<E.EpochResult> Unchecked.defaultof<E.TerminalPublication> 0 |> refused
    Assert.Equal(Some "encoding",terminal.Field)
    Assert.Contains("before source traversal",terminal.Message)

[<Fact>]
let ``inert nonempty Gamma state and complete block call match Python golden`` () =
    use emptyDocument=JsonDocument.Parse "{}"
    let empty=emptyDocument.RootElement.Clone()
    let key:E.SiteKey=
        {InstancePath="fixture/gamma";Factor="normal/0";Port="gamma"
         ContributionId=E.tryContributionId "fixture/gamma" "normal/0" |> accepted}
    let gamma:PrecisionGateKernels.GammaKernel={LogPower=0.0;Rate=1.0}
    let state:E.State=
        {Revision=1L;Weights=Map.empty;GaussianSites=Map.empty;GammaSites=Map.ofList [key,gamma]
         Outputs=Map.empty;ActiveCut=String.replicate 64 "A"}
    let proposal:E.Proposal=
        {ExpectedRevision=0L;ExpectedStateSha256=String.replicate 64 "B";State=state;Details=empty}
    // These explicitly fabricated serialization values are not kernel outcomes.
    let kernel:Result<PrecisionGateKernels.GammaKernel,PrecisionGateKernels.KernelError>=Ok gamma
    let block:E.BlockAttempt=
        {Inputs=empty;Calls=[{Operation="tryGammaProduct";Inputs=empty;Call=E.SourceReturns.retain kernel}]
         Proposal=Some proposal;Outcome=Ok()}
    let observation:E.Observation=
        {Sequence=1;Operation=E.GammaBlock("fixture/gamma",0);InputRevision=0L
         Inputs=E.RawInputs empty;Call=E.SourceReturns.retain block;Proposal=Some proposal;Admission=Some(Ok())
         AppliedRevision=None;Failure=None}
    use encoded=JsonDocument.Parse(E.tryEncodeObservation observation 65536 |> accepted)
    let encodedState=E.tryEncodeState state |> accepted |> Encoding.UTF8.GetString
    let supplied="{\"State\":"+encodedState+",\"Call\":"+encoded.RootElement.GetProperty("Call").GetRawText()+"}"
    let canonical=E.tryCanonicalPayload (raw supplied) 65536 |> accepted
    Assert.Equal(1235,canonical.Length)
    Assert.Equal("7EC5B37CA1D3998375A50432765E7241E1FD0F9108BB2F72CE04602CBB7C6009",Convert.ToHexString(Security.Cryptography.SHA256.HashData canonical))

module private RuntimeFixture =
    open System.Threading.Tasks
    let hash (bytes:byte[])=Convert.ToHexString(Security.Cryptography.SHA256.HashData bytes)
    let bindings=Map.ofList ["ProtocolSha256",String.replicate 64 "A";"fixture.fs",String.replicate 64 "B"]
    let snapshot:E.BudgetSnapshot=
        {SnapshotIndex=1;CompletedSessions=0;PriorWork=E.zeroWork
         Store={ReservedCombinedBytes=0L;ReservedArtifactSlots=0};TranscriptBytes=0L;TranscriptFrames=0
         PeerLaunchAttempted=1;NativePreparationEntered=0;RemainingMilliseconds=300000}
    let context:E.AdmissionContext=
        {Identity={SessionId="fixture/session";ServiceSha256=String.replicate 64 "C"}
         InitialBudgetSnapshot=snapshot;Forecasts=[]}
    let trainingPlan () : E.EpochPlan =
        let row:E.EvidenceRow=
            {Id="fixture/row";ContentSha256="";Origin=0L;FeatureAvailable=0L;TargetTime=1L;LabelAvailable=1L
             Split="train";Features=0.25::List.replicate 7 0.0;Target=Some 0.5;Uses=[]}
        let row={row with ContentSha256=E.tryRowContentHash row |> accepted}
        let cut:E.EvidenceCut={Id="fixture/cut";Rows=[row];ActiveIds=[row.Id];PriorOwners=Map.empty;ParentCut=None;Retractions=[]}
        let state:E.State=
            {Revision=0L;Weights=Map.empty;GaussianSites=Map.empty;GammaSites=Map.empty;Outputs=Map.empty;ActiveCut=E.tryCutHash cut |> accepted}
        {Id="fixture/train";Mode="train";EvidenceCut=cut;QueryRowId=None;Nodes=[];SelectedVersions=Map.empty
         InitialState=state;Operations=[E.LearnStep("fixture/model",0,row.Id);E.LearnStep("fixture/model",1,row.Id)]
         Sweeps=0;Damping=1.0;Horizon=1;SourceBindings=bindings
         Training=Some {Artifacts=[{Id="fixture/model";ParentVersion=None;Ports=["absent";"absent"]}]
                        RowIds=Map.ofList ["fixture/model",[row.Id]];CutEnd=1L;ChildCuts=Map.empty;ChildForecasts=[]}}
    let projectionPlan () =
        let training=trainingPlan()
        let node:E.Node=
            {Id="fixture/gate";InstancePath="fixture/gate";Kind="precision-gate";Inputs=[];Artifact=None
             Prior=Some {Gaussian={PrecisionMean=2.0;Precision=2.0};Gammas=[]};Unary=Some {K=0.0;C=1.0}
             Children=None;OutputAlias=None}
        let row={training.EvidenceCut.Rows.Head with Target=None;Split="control"}
        let row={row with ContentSha256=E.tryRowContentHash row |> accepted}
        let variable=E.tryVariableId node.InstancePath "z" |> accepted
        let cut={training.EvidenceCut with Rows=[row];PriorOwners=Map.ofList [variable,"fixture/prior"]}
        {training with Id="fixture/query";Mode="query";EvidenceCut=cut;QueryRowId=Some row.Id;Nodes=[node]
                       InitialState={training.InitialState with ActiveCut=E.tryCutHash cut |> accepted}
                       Operations=[E.GaussianBlock(node.Id,0)];Sweeps=1;Training=None}
    let service:E.ProjectionService=fun _ -> failwith "no projection is allowed in this learner fixture"
    let failure:E.Failure={Code="Storage";Stage="publish";Field=Some "fixture";Message="injected callback refusal"}
    let recorder () =
        let mutable latest=snapshot
        let commits=ResizeArray<E.Commit>()
        let checkpoints=ResizeArray<E.Checkpoint>()
        let value:E.Recorder=
            {Snapshot=fun () -> Ok latest
             Checkpoint=fun c -> task {
                 checkpoints.Add c
                 let payload=E.tryEncodeCheckpoint c (16*1024*1024) |> accepted |> Encoding.UTF8.GetString
                 let framed=raw("{\"Kind\":\"Checkpoint\",\"Schema\":\"zeta.mixed-epoch.peer.v1\",\"SessionId\":\"fixture/session\","+payload.Substring(1))
                 let canonical=E.tryCanonicalPayload framed (16*1024*1024) |> accepted
                 let bytes=Array.append canonical [|10uy|]
                 latest<-{latest with SnapshotIndex=latest.SnapshotIndex+1
                                      Store={ReservedCombinedBytes=latest.Store.ReservedCombinedBytes+2L*int64 bytes.Length
                                             ReservedArtifactSlots=latest.Store.ReservedArtifactSlots+1}
                                      TranscriptBytes=latest.TranscriptBytes+int64 bytes.Length;TranscriptFrames=latest.TranscriptFrames+1}
                 let digest=hash bytes
                 return Ok {Sequence=c.Sequence;CheckpointSha256=digest;BudgetSnapshot=latest
                            Artifact={File="fixture/checkpoint.json";Encoding="identity";Bytes=int64 bytes.Length;Sha256=digest
                                      StoredBytes=int64 bytes.Length;StoredSha256=digest}} }
             Commit=fun c -> commits.Add c;Task.FromResult(Ok())}
        value,checkpoints,commits

[<Fact>]
let ``real scheduler executes bounded learner commits and retains encoding failure`` () = task {
    let plan=RuntimeFixture.trainingPlan()
    let admitted=E.tryAdmit(plan,RuntimeFixture.context) |> accepted
    let recorder,checkpoints,commits=RuntimeFixture.recorder()
    let! actual=E.runEpoch(admitted,RuntimeFixture.service,recorder)
    Assert.Equal("completed",actual.Outcome)
    Assert.Equal(2,actual.Counters.LearnEntered)
    Assert.Equal(2,actual.Counters.ForwardEntered)
    Assert.Equal(2,actual.Counters.Applied)
    Assert.Equal(2L,actual.LastCommitted.Revision)
    Assert.Equal(2,checkpoints.Count)
    Assert.Equal(2,commits.Count)
    Assert.Equal(1,actual.ProposedArtifacts.Length)
    let selected=E.trySelectArtifacts(Map.empty,Map.ofList ["fixture/model",None],actual) |> accepted
    Assert.Equal(1,selected.Count)
    let publication=E.tryEncode actual 1 |> refused
    Assert.Same(actual,publication.Result)
    Assert.Equal(2,publication.Result.Counters.Returned)
}

[<Fact>]
let ``checkpoint refusal retains actual step before any state application`` () = task {
    let admitted=E.tryAdmit(RuntimeFixture.trainingPlan(),RuntimeFixture.context) |> accepted
    let recorder,_,_=RuntimeFixture.recorder()
    let recorder={recorder with Checkpoint=fun _ -> System.Threading.Tasks.Task.FromResult(Error RuntimeFixture.failure)}
    let! actual=E.runEpoch(admitted,RuntimeFixture.service,recorder)
    Assert.Equal("refused",actual.Outcome)
    Assert.Equal(0L,actual.LastCommitted.Revision)
    Assert.Equal(1,actual.Counters.Returned)
    Assert.Equal(0,actual.Counters.Applied)
    Assert.Equal(1,actual.Observations.Length)
    Assert.IsType<BoundedModuleLearner.StepAttempt>(E.tryReturnedValue actual.Observations[0].Call |> Option.get) |> ignore
    match actual.Scheduler with
    | E.SchedulerReturned(Error(Zeta.Core.Failed "Storage")) -> ()
    | other -> failwithf "actual scheduler prefix was lost: %A" other
}

[<Fact>]
let ``commit refusal preserves the already applied immutable vector`` () = task {
    let admitted=E.tryAdmit(RuntimeFixture.trainingPlan(),RuntimeFixture.context) |> accepted
    let recorder,_,_=RuntimeFixture.recorder()
    let recorder={recorder with Commit=fun _ -> System.Threading.Tasks.Task.FromResult(Error RuntimeFixture.failure)}
    let! actual=E.runEpoch(admitted,RuntimeFixture.service,recorder)
    Assert.Equal("refused",actual.Outcome)
    Assert.Equal(1L,actual.LastCommitted.Revision)
    Assert.Equal(1,actual.LastCommitted.Weights.Count)
    Assert.Equal(Some 1L,actual.Observations[0].AppliedRevision)
    Assert.Equal(1,actual.Counters.Applied)
}

[<Fact>]
let ``inflight and completed handle lookups keep the one owned task`` () = task {
    let admitted=E.tryAdmit(RuntimeFixture.trainingPlan(),RuntimeFixture.context) |> accepted
    let recorder,checkpoints,_=RuntimeFixture.recorder()
    let barrier=System.Threading.Tasks.TaskCompletionSource<unit>()
    let checkpoint c = task {
        do! barrier.Task
        return! recorder.Checkpoint c
    }
    let recorder={recorder with Checkpoint=checkpoint}
    let first=E.runEpoch(admitted,RuntimeFixture.service,recorder)
    let forbidden:E.Recorder={Snapshot=(fun () -> failwith "rebound");Checkpoint=(fun _ -> failwith "rebound");Commit=(fun _ -> failwith "rebound")}
    let second=E.runEpoch(admitted,RuntimeFixture.service,forbidden)
    Assert.Same(first,second)
    barrier.SetResult()
    let! actual=first
    let third=E.runEpoch(admitted,RuntimeFixture.service,forbidden)
    Assert.Same(first,third)
    let! repeated=third
    Assert.Same(actual,repeated)
    Assert.Equal(2,checkpoints.Count)
}

[<Fact>]
let ``snapshot source admission refuses resets but permits exact local observation`` () =
    E.tryAdmitBudgetSnapshot(None,RuntimeFixture.snapshot,false) |> accepted
    E.tryAdmitBudgetSnapshot(Some RuntimeFixture.snapshot,RuntimeFixture.snapshot,true) |> accepted
    E.tryAdmitBudgetSnapshot(Some RuntimeFixture.snapshot,RuntimeFixture.snapshot,false) |> refused |> ignore
    let changed={RuntimeFixture.snapshot with Store={ReservedCombinedBytes=2L;ReservedArtifactSlots=1}}
    E.tryAdmitBudgetSnapshot(Some RuntimeFixture.snapshot,changed,true) |> refused |> ignore

[<Fact>]
let ``owned chain fault completes its retained task without inventing an epoch`` () = task {
    let admitted=E.tryAdmit(RuntimeFixture.trainingPlan(),RuntimeFixture.context) |> accepted
    let cause=InvalidOperationException "bounded owned-chain fault"
    let first=E.RuntimeControls.owned admitted (fun () -> Threading.Tasks.Task.FromException<E.EpochResult> cause)
    let recorder,_,_=RuntimeFixture.recorder()
    Assert.Same(first,E.runEpoch(admitted,RuntimeFixture.service,recorder))
    let! observed=task {
        try
            let! _=first.WaitAsync(TimeSpan.FromMilliseconds 500.0)
            return None
        with ex -> return Some ex
    }
    Assert.Same(cause,Option.get observed)
    Assert.True(first.IsFaulted)
}

[<Fact>]
let ``owned chain cancellation completes the original cancelled task`` () = task {
    let admitted=E.tryAdmit(RuntimeFixture.trainingPlan(),RuntimeFixture.context) |> accepted
    let token=Threading.CancellationToken(true)
    let first=E.RuntimeControls.owned admitted (fun () -> Threading.Tasks.Task.FromCanceled<E.EpochResult> token)
    let! observed=task {
        try
            let! _=first.WaitAsync(TimeSpan.FromMilliseconds 500.0)
            return None
        with ex -> return Some ex
    }
    Assert.IsAssignableFrom<OperationCanceledException>(Option.get observed) |> ignore
    Assert.True(first.IsCanceled)
}

[<Fact>]
let ``null private handle is an argument task failure outside admitted execution`` () = task {
    let recorder,checkpoints,_=RuntimeFixture.recorder()
    let pending=E.runEpoch(Unchecked.defaultof<E.AdmittedPlan>,RuntimeFixture.service,recorder)
    let! observed=task {
        try
            let! _=pending.WaitAsync(TimeSpan.FromMilliseconds 500.0)
            return None
        with ex -> return Some ex
    }
    Assert.IsType<ArgumentNullException>(Option.get observed) |> ignore
    Assert.Equal(0,checkpoints.Count)
}

[<Fact>]
let ``late ordinary snapshot cancellation retains the real committed scheduler prefix`` () = task {
    let admitted=E.tryAdmit(RuntimeFixture.trainingPlan(),RuntimeFixture.context) |> accepted
    let recorder,checkpoints,_=RuntimeFixture.recorder()
    let mutable calls=0
    let snapshot () =
        calls<-calls+1
        if calls=2 then raise(OperationCanceledException "bounded recorder cancellation")
        recorder.Snapshot()
    let! actual=E.runEpoch(admitted,RuntimeFixture.service,{recorder with Snapshot=snapshot})
    Assert.Equal("refused",actual.Outcome)
    Assert.Equal(1L,actual.LastCommitted.Revision)
    Assert.Equal(1,actual.Counters.Applied)
    Assert.Equal(1,checkpoints.Count)
    Assert.Equal<int list>([2],actual.Publication.Unpublished)
    let raised=actual.Publication.Recorder |> List.choose(fun r -> match r.Call with E.Raised e -> Some e | _ -> None)
    Assert.Equal("System.OperationCanceledException",raised.Head.Type)
}

[<Fact>]
let ``precallback checkpoint encoding retains the original unpublished observation`` () = task {
    let admitted=E.tryAdmit(RuntimeFixture.trainingPlan(),RuntimeFixture.context) |> accepted
    let recorder,checkpoints,_=RuntimeFixture.recorder()
    use supplied=JsonDocument.Parse("{\"Padding\":\""+String.replicate 65536 "x"+"\"}")
    let observation:E.Observation=
        {Sequence=1;Operation=E.NeuralForward("inert",0);InputRevision=0L;Inputs=E.RawInputs(supplied.RootElement.Clone())
         Call=E.NotEntered;Proposal=None;Admission=None;AppliedRevision=None;Failure=None}
    let! _,retained,unpublished,callbacks=E.RuntimeControls.publishRetained admitted recorder observation
    Assert.Same(observation,retained.Head)
    Assert.Equal<int list>([1],unpublished)
    Assert.Equal(0,checkpoints.Count)
    Assert.Empty callbacks
}

[<Fact>]
let ``unanswered service keeps remote counts explicitly incomplete`` () = task {
    let admitted=E.tryAdmit(RuntimeFixture.projectionPlan(),RuntimeFixture.context) |> accepted
    let recorder,_,_=RuntimeFixture.recorder()
    let service:E.ProjectionService=fun _ -> Threading.Tasks.Task.FromException<Result<E.ProjectionResponse,E.TransportFailure>>(InvalidOperationException "response lost")
    let! actual=E.runEpoch(admitted,service,recorder)
    Assert.Equal(1,actual.Counters.ProjectionRequested)
    let r=actual.Counters.Remote
    for count in [r.NativeCallEntered;r.NativeLaunchAttempted;r.NativeReturned;r.CertificateEntered;r.CertificateReturned;r.NestedReferenceEntered] do
        Assert.Equal(0,count.Observed)
        Assert.False(count.Complete)
    Assert.True(actual.PendingRequest.IsSome)
    Assert.Equal(0,actual.Counters.Applied)
}

[<Fact>]
let ``missing certificate after a source response does not imply zero certificate work`` () = task {
    let admitted=E.tryAdmit(RuntimeFixture.projectionPlan(),RuntimeFixture.context) |> accepted
    let recorder,_,_=RuntimeFixture.recorder()
    let service:E.ProjectionService=fun request ->
        let response:E.ProjectionResponse=
            {Sequence=request.Sequence;RequestId=request.RequestId
             InputSha256=request.InputSha256;BindingsSha256=request.BindingsSha256
             ServiceSha256=RuntimeFixture.context.Identity.ServiceSha256;Native=None;Certificate=None
             Failure=Some RuntimeFixture.failure;BudgetSnapshot={RuntimeFixture.snapshot with SnapshotIndex=2}}
        Threading.Tasks.Task.FromResult(Ok response)
    let! actual=E.runEpoch(admitted,service,recorder)
    Assert.Equal(1,actual.Counters.ProjectionRequested)
    let r=actual.Counters.Remote
    for count in [r.CertificateEntered;r.CertificateReturned;r.NestedReferenceEntered] do
        Assert.Equal(0,count.Observed)
        Assert.False(count.Complete)
    let block=E.tryReturnedValue actual.Observations.Head.Call |> Option.get |> unbox<E.BlockAttempt>
    Assert.True(block.Calls |> List.exists(fun c -> c.Operation="ProjectionService" && (E.tryReturnedValue c.Call).IsSome))
}

[<Theory>]
[<InlineData(0)>]
[<InlineData(1)>]
[<InlineData(2)>]
let ``callback diagnostics obey well formed UTF8 byte caps`` kind = task {
    let message=match kind with 0 -> String.replicate 2048 "x" | 1 -> String.replicate 600 "😀" | _ -> String([|char 0xd800|])+"invalid"
    let admitted=E.tryAdmit(RuntimeFixture.trainingPlan(),RuntimeFixture.context) |> accepted
    let recorder,_,_=RuntimeFixture.recorder()
    let recorder={recorder with Snapshot=fun () -> raise(InvalidOperationException message)}
    let! actual=E.runEpoch(admitted,RuntimeFixture.service,recorder)
    let strict=UTF8Encoding(false,true)
    Assert.InRange(strict.GetByteCount(actual.Failure.Value.Message),1,1024)
    let raised=actual.Publication.Recorder |> List.choose(fun r -> match r.Call with E.Raised e -> Some e | _ -> None)
    Assert.InRange(strict.GetByteCount(raised.Head.Message),1,512)
    E.tryEncode actual (1024*1024) |> accepted |> ignore
    Assert.Equal(0,actual.Counters.LearnEntered)
}

[<Fact>]
let ``malformed returned failure is retained while the epoch failure remains closed`` () = task {
    let admitted=E.tryAdmit(RuntimeFixture.trainingPlan(),RuntimeFixture.context) |> accepted
    let recorder,_,_=RuntimeFixture.recorder()
    let original:E.Failure={Code="not-a-core-code";Stage="not-a-core-stage";Field=Some "é";Message=String.replicate 2048 "x"}
    let recorder={recorder with Snapshot=fun () -> Error original}
    let! actual=E.runEpoch(admitted,RuntimeFixture.service,recorder)
    Assert.Equal("Transport",actual.Failure.Value.Code)
    Assert.Equal("publish",actual.Failure.Value.Stage)
    let returned=E.tryReturnedValue actual.Publication.Recorder.Head.Call |> Option.get |> unbox<Result<E.BudgetSnapshot,E.Failure>>
    Assert.Same(original,returned |> refused)
    let failedPublication=E.tryEncode actual (1024*1024) |> refused
    Assert.Same(actual,failedPublication.Result)
}

module private ModelFixture =
    module K=PrecisionGateKernels
    module L=BoundedModuleLearner
    let close expected actual = Assert.InRange(abs(actual-expected),0.0,1e-12)
    // Explicit inert artifact for local structural/factor tests; no training
    // history or independent source/process admission is claimed for this value.
    let artifact id ports parameters : L.ModuleArtifact =
        let cut=String.replicate 64 "D"
        {Id=id;ParentVersion=None;TrainingCut=cut;Architecture=L.Architecture;Ports=ports;Parameters=parameters
         Preprocessing={TrainingCut=cut;Count=4;Means=List.replicate 8 0.0;Scales=List.replicate 8 1.0}
         UpdateReceiptSha256=String.replicate 64 "E";SourceBindings=RuntimeFixture.bindings}
    let neural id artifactId inputs : E.Node =
        {Id=id;InstancePath=id;Kind="neural";Inputs=inputs;Artifact=Some artifactId;Prior=None;Unary=None;Children=None;OutputAlias=None}
    let alias id child : E.Node =
        {Id=id;InstancePath=id;Kind="composite";Inputs=[];Artifact=None;Prior=None;Unary=None
         Children=Some [child];OutputAlias=Some {SourceNode=child;SourcePort="mean"}}
    let selected (artifacts:L.ModuleArtifact list) =
        artifacts |> List.map(fun a -> a.Id,({Version=L.tryVersion a |> accepted;Artifact=a}:E.SelectedVersion)) |> Map.ofList
    let withCut (plan:E.EpochPlan) cut =
        {plan with EvidenceCut=cut;InitialState={plan.InitialState with ActiveCut=E.tryCutHash cut |> accepted}}
    let gammaPlan () =
        let plan=RuntimeFixture.projectionPlan()
        let point=artifact "fixture/constant" ["absent";"absent"] (List.replicate 56 0.0@[-1.0])
        let child=neural "fixture/a-child" point.Id []
        let input:E.InputPort={SourceNode=child.Id;SourcePort="mean";TargetSlot=1}
        let prior:E.Prior={Gaussian={PrecisionMean=0.0;Precision=1.0};Gammas=[{Shape=2.0;Rate=3.0}]}
        let gate={plan.Nodes.Head with Inputs=[input];Prior=Some prior}
        let z=E.tryVariableId gate.InstancePath "z" |> accepted
        let gamma=E.tryVariableId gate.InstancePath "gamma/1" |> accepted
        let cut={plan.EvidenceCut with PriorOwners=Map.ofList [z,"fixture/prior-z";gamma,"fixture/prior-gamma"]}
        let key:E.SiteKey={InstancePath=gate.InstancePath;Factor="unary";Port="z";ContributionId=E.tryContributionId gate.InstancePath "unary" |> accepted}
        let state={plan.InitialState with GaussianSites=Map.ofList [key,({PrecisionMean=2.0/3.0;Precision= -2.0/3.0}:Gaussian)]
                                          Outputs=Map.ofList [child.Id,({Mean= -1.0;Variance=None;SourceSequence=1}:E.Output)]}
        let plan={plan with Nodes=[child;gate];SelectedVersions=selected [point];InitialState=state
                            Operations=[E.NeuralForward(child.Id,0);E.GammaBlock(gate.Id,0);E.GaussianBlock(gate.Id,0)]}
        withCut plan cut,gate
    let shapeDetails (block:E.BlockAttempt) = block.Proposal.Value.Details.GetProperty("Sites").EnumerateArray() |> Seq.head
    let scalar (value:JsonElement) = BitConverter.Int64BitsToDouble(int64(UInt64.Parse(value.GetString(),Globalization.NumberStyles.HexNumber,Globalization.CultureInfo.InvariantCulture)))

[<Fact>]
let ``M1 receiving factor is excluded and one keyed site is retained`` () =
    let plan=RuntimeFixture.projectionPlan()
    let node={plan.Nodes.Head with Prior=Some {Gaussian={PrecisionMean=0.0;Precision=1.0};Gammas=[]}}
    let key:E.SiteKey={InstancePath=node.InstancePath;Factor="unary";Port="z";ContributionId=E.tryContributionId node.InstancePath "unary" |> accepted}
    let value:Gaussian={PrecisionMean=2.0;Precision=3.0}
    let sites=Map.empty |> Map.add key value |> Map.add key value
    let plan={plan with Nodes=[node];InitialState={plan.InitialState with GaussianSites=sites}}
    let admitted=E.tryAdmit(plan,RuntimeFixture.context) |> accepted
    let cavity,_=E.RuntimeControls.cavity admitted plan.InitialState node.Id (Some "unary")
    let marginal,calls=E.RuntimeControls.cavity admitted plan.InitialState node.Id None
    Assert.Equal<Gaussian>({PrecisionMean=0.0;Precision=1.0},cavity |> accepted)
    Assert.Equal<Gaussian>({PrecisionMean=2.0;Precision=4.0},marginal |> accepted)
    Assert.Equal(1,sites.Count)
    Assert.Equal(1,calls.Length)
    Assert.Equal("tryGaussianProduct",calls.Head.Operation)

[<Fact>]
let ``M1 immutable evidence content and prior ownership cannot be relabeled`` () =
    let plan=RuntimeFixture.trainingPlan()
    let changed={plan.EvidenceCut.Rows.Head with Target=Some 0.75}
    E.tryAdmit({plan with EvidenceCut={plan.EvidenceCut with Rows=[changed]}},RuntimeFixture.context) |> refused |> ignore
    let plan,gate=ModelFixture.gammaPlan()
    let owners=plan.EvidenceCut.PriorOwners |> Map.map(fun _ _ -> "same-prior")
    let bad=ModelFixture.withCut plan {plan.EvidenceCut with PriorOwners=owners}
    E.tryAdmit(bad,RuntimeFixture.context) |> refused |> ignore
    let changedKey=plan.InitialState.GaussianSites |> Map.toList |> List.map(fun (k,v) -> {k with ContributionId="fixture/prior-z"},v) |> Map.ofList
    E.tryAdmit({plan with InitialState={plan.InitialState with GaussianSites=changedKey}},RuntimeFixture.context) |> refused |> ignore
    Assert.Equal(1,gate.Inputs.Head.TargetSlot)

[<Fact>]
let ``M2 marginal VMP preserves clamping half power and the sole slot one prior`` () =
    let plan,gate=ModelFixture.gammaPlan()
    let admitted=E.tryAdmit(plan,RuntimeFixture.context) |> accepted
    let actual=E.RuntimeControls.gamma admitted plan.InitialState gate.Id
    actual.Outcome |> accepted
    let call=actual.Calls |> List.find(fun c -> c.Operation="tryNormalPrecisionVmp")
    let messages=E.tryReturnedValue call.Call |> Option.get |> unbox<Result<PrecisionGateKernels.NormalPrecisionMessages,PrecisionGateKernels.KernelError>> |> accepted
    ModelFixture.close 12.0 messages.ResidualSecondMoment
    ModelFixture.close 6.0 messages.ToPrecision.Rate
    Assert.Equal(0.5,messages.ToPrecision.LogPower)
    Assert.Equal(BoundedModuleLearner.bits 0.0,call.Inputs.GetProperty("Mean").GetProperty("Variance").GetString())
    let state=actual.Proposal.Value.State
    let key,site=state.GammaSites |> Map.toList |> List.exactlyOne
    Assert.Equal("normal/1",key.Factor)
    Assert.Equal("gamma",key.Port)
    let encoded=PrecisionGateKernels.tryEncodeGamma 2.0 3.0 |> accepted
    let posterior=PrecisionGateKernels.tryGammaProduct encoded.Kernel site |> accepted |> PrecisionGateKernels.tryGammaMoments |> accepted
    Assert.Equal(2.5,posterior.RepresentedShape)
    ModelFixture.close 9.0 posterior.Rate
    let repeated=E.RuntimeControls.gamma admitted state gate.Id
    repeated.Outcome |> accepted
    Assert.Equal(1,repeated.Proposal.Value.State.GammaSites.Count)
    ModelFixture.close 6.0 repeated.Proposal.Value.State.GammaSites[key].Rate
    let wrong=PrecisionGateKernels.tryNormalPrecisionVmp {Mean=0.0;Variance=1.0} {Mean= -1.0;Variance=0.0} 1.0 |> accepted
    Assert.Equal(2.0,wrong.ResidualSecondMoment)
    Assert.Equal(1.0,wrong.ToPrecision.Rate)

[<Fact>]
let ``M2 prior encoding shape is distinct from combined posterior shape`` () =
    let plan,gate=ModelFixture.gammaPlan()
    let admitted=E.tryAdmit(plan,RuntimeFixture.context) |> accepted
    let actual=E.RuntimeControls.gamma admitted plan.InitialState gate.Id
    let detail=ModelFixture.shapeDetails actual
    Assert.Equal(2.0,ModelFixture.scalar(detail.GetProperty "RequestedShape"))
    Assert.Equal(2.0,ModelFixture.scalar(detail.GetProperty "RepresentedShape"))
    Assert.Equal(2.5,ModelFixture.scalar(detail.GetProperty "CombinedRepresentedShape"))

[<Fact>]
let ``M2 deterministic orientation and model identity cannot be swapped`` () =
    let kernel:PrecisionGateKernels.GammaKernel={LogPower=1.0;Rate=2.0}
    let expValue=PrecisionGateKernels.tryReverseLogKernel PrecisionGateKernels.ExpConstraint kernel 1.0 |> accepted
    let logValue=PrecisionGateKernels.tryReverseLogKernel PrecisionGateKernels.LogConstraint kernel 1.0 |> accepted
    Assert.Equal(1.0,logValue-expValue)
    let plan,gate=ModelFixture.gammaPlan()
    let wrongRole={gate with Inputs=[{gate.Inputs.Head with SourcePort="distribution"}]}
    E.tryAdmit({plan with Nodes=[plan.Nodes.Head;wrongRole]},RuntimeFixture.context) |> refused |> ignore
    let wrongModel={gate with Kind="normalized-conditional-product"}
    E.tryAdmit({plan with Nodes=[plan.Nodes.Head;wrongModel]},RuntimeFixture.context) |> refused |> ignore

[<Fact>]
let ``M3 projected belief is divided by its base before damping`` () =
    let baseKernel:Gaussian={PrecisionMean=1.5;Precision=1.0}
    let candidate:PrecisionGateKernels.RealMoments={Mean= -0.25;Variance=0.5}
    let neutral:Gaussian={PrecisionMean=0.0;Precision=0.0}
    let full,_=E.RuntimeControls.projectionSite baseKernel candidate neutral 1.0
    let projected,site,_,combined,moments=full |> accepted
    Assert.Equal<Gaussian>({PrecisionMean= -0.5;Precision=2.0},projected)
    Assert.Equal<Gaussian>({PrecisionMean= -2.0;Precision=1.0},site)
    Assert.Equal<Gaussian>({PrecisionMean= -0.5;Precision=2.0},combined)
    Assert.Equal<PrecisionGateKernels.RealMoments>(candidate,moments)
    let wrong=PrecisionGateKernels.tryGaussianProduct baseKernel projected |> accepted
    Assert.Equal<Gaussian>({PrecisionMean=1.0;Precision=3.0},wrong)
    let half,_=E.RuntimeControls.projectionSite baseKernel candidate neutral 0.5
    let _,_,_,halfCombined,halfMoments=half |> accepted
    Assert.Equal<Gaussian>({PrecisionMean=0.5;Precision=1.5},halfCombined)
    Assert.NotEqual<string>(BoundedModuleLearner.bits candidate.Mean,BoundedModuleLearner.bits halfMoments.Mean)

[<Fact>]
let ``M3 proper total may contain improper site and improper total refuses`` () =
    let candidate:PrecisionGateKernels.RealMoments={Mean=0.0;Variance=1.0}
    let neutral:Gaussian={PrecisionMean=0.0;Precision=0.0}
    let good,_=E.RuntimeControls.projectionSite {PrecisionMean=0.0;Precision=2.0} candidate neutral 1.0
    let _,site,_,_,moments=good |> accepted
    Assert.Equal(-1.0,site.Precision)
    Assert.Equal(1.0,moments.Variance)
    let bad,calls=E.RuntimeControls.projectionSite {PrecisionMean=0.0;Precision=1.0} candidate {PrecisionMean=0.0;Precision= -2.0} 0.5
    Assert.Equal("Improper",(bad |> refused).Code)
    Assert.Equal("tryGaussianMoments",calls[calls.Length-1].Operation)
    for alpha in [0.0;-1.0;1.01;Double.NaN;Double.PositiveInfinity] do
        let plan=RuntimeFixture.projectionPlan()
        E.tryAdmit({plan with Damping=alpha},RuntimeFixture.context) |> refused |> ignore

[<Fact>]
let ``M3 small requested Gamma shape keeps its actual represented prior`` () =
    let plan,gate=ModelFixture.gammaPlan()
    let gate={gate with Prior=Some {(Option.get gate.Prior) with Gammas=[{Shape=1e-16;Rate=3.0}]}}
    let plan={plan with Nodes=[plan.Nodes.Head;gate]}
    let admitted=E.tryAdmit(plan,RuntimeFixture.context) |> accepted
    let block=E.RuntimeControls.gamma admitted plan.InitialState gate.Id
    block.Outcome |> accepted
    let detail=ModelFixture.shapeDetails block
    Assert.Equal(1e-16,ModelFixture.scalar(detail.GetProperty "RequestedShape"))
    Assert.Equal(1.1102230246251565e-16,ModelFixture.scalar(detail.GetProperty "RepresentedShape"))
    let encoding=block.Calls |> List.find(fun c -> c.Operation="tryEncodeGamma")
    let actual=E.tryReturnedValue encoding.Call |> Option.get |> unbox<Result<PrecisionGateKernels.GammaEncoding,PrecisionGateKernels.KernelError>> |> accepted
    Assert.Equal(1.1102230246251565e-16,actual.RepresentedShape)

[<Fact>]
let ``M8 small applied change leaves a large undamped proposal and nonstationary belief`` () =
    let baseKernel:Gaussian={PrecisionMean=1.5;Precision=1.0}
    let candidate:PrecisionGateKernels.RealMoments={Mean= -0.25;Variance=0.5}
    let neutral:Gaussian={PrecisionMean=0.0;Precision=0.0}
    let alpha=1.0/1048576.0
    let actual,_=E.RuntimeControls.projectionSite baseKernel candidate neutral alpha
    let _,site,applied,_,moments=actual |> accepted
    Assert.Equal(-2.0,site.PrecisionMean)
    Assert.InRange(abs applied.PrecisionMean,0.0,0.000002)
    let target:PrecisionGateKernels.ProjectionTarget={Precision=1.0;Location=1.5;Linear= -0.75;ExponentialRate=1.0}
    let projected=PrecisionGateKernels.tryProjectionObjective target candidate |> accepted
    let damped=PrecisionGateKernels.tryProjectionObjective target moments |> accepted
    Assert.Equal(0.0,projected.DerivativeMean)
    Assert.Equal(0.0,projected.DerivativeVariance)
    Assert.True(abs damped.DerivativeMean>1.0)

module private RouteFixture =
    let json bytes =
        use doc=JsonDocument.Parse(bytes:byte[])
        doc.RootElement.Clone()
    // A capture harness may retain these complete actual unit returns. This
    // opt-in test sink is not the registered peer/Store publication path.
    let retainBytes name (bytes:byte[]) =
        Assert.InRange(bytes.Length,1,16*1024*1024)
        match Environment.GetEnvironmentVariable "ZETA_MIXED_UNIT_RETURN_DIRECTORY" with
        | null -> ()
        | directory ->
            use file=new IO.FileStream(IO.Path.Combine(directory,name+".json"),IO.FileMode.CreateNew,IO.FileAccess.Write,IO.FileShare.None)
            file.Write(bytes,0,bytes.Length)
        bytes
    let retain name (result:E.EpochResult) =
        E.tryEncode result (16*1024*1024) |> accepted |> retainBytes name
    let run plan = task {
        let recorder,_,_=RuntimeFixture.recorder()
        return! E.runEpoch(E.tryAdmit(plan,RuntimeFixture.context) |> accepted,RuntimeFixture.service,recorder)
    }
    let pointPlan sweeps =
        let p=RuntimeFixture.projectionPlan()
        let artifact=ModelFixture.artifact "fixture/point" ["absent";"absent"] (BoundedModuleLearner.initialParameters())
        let node=ModelFixture.neural "fixture/leaf" artifact.Id []
        let p={p with Nodes=[node];SelectedVersions=ModelFixture.selected [artifact];Sweeps=sweeps
                      Operations=[for sweep in 0..sweeps-1 -> E.NeuralForward(node.Id,sweep)]}
        ModelFixture.withCut p {p.EvidenceCut with PriorOwners=Map.empty}
    let compensation (original:E.EpochPlan) (result:E.EpochResult) target (checkpoint:E.State) prefix sweeps cut =
        let stateBytes=E.tryEncodeState checkpoint |> accepted
        let prefixBytes=raw("["+(prefix |> List.map(fun o -> E.tryEncodeObservation o (16*1024*1024) |> accepted |> Encoding.UTF8.GetString) |> String.concat ",")+"]")
        let checkpointJson="{\"State\":"+Encoding.UTF8.GetString stateBytes+",\"StateSha256\":\""+RuntimeFixture.hash stateBytes+
                           "\",\"Prefix\":"+Encoding.UTF8.GetString prefixBytes+",\"PrefixSha256\":\""+RuntimeFixture.hash prefixBytes+"\"}"
        let inputs:E.CompensationInputs=
            {TargetRevision=target;RetainedPlan=E.tryEncodePlan original |> accepted |> json
             RetainedResult=E.tryEncode result (16*1024*1024) |> accepted |> json;Checkpoint=raw checkpointJson |> json}
        {original with Id="fixture/compensate";Mode="compensate";QueryRowId=None;EvidenceCut=cut;InitialState=result.LastCommitted
                       Sweeps=sweeps;Operations=E.Compensate inputs::(if sweeps=0 then [] else original.Operations);Training=None}

[<Fact>]
let ``M6 nested aliases and flattened fixed modules retain equal complete numeric returns`` () = task {
    let flat=RouteFixture.pointPlan 1
    let leaf=flat.Nodes.Head
    let parentArtifact=ModelFixture.artifact "fixture/parent" ["required";"absent"] (BoundedModuleLearner.initialParameters())
    let port:E.InputPort={SourceNode=leaf.Id;SourcePort="mean";TargetSlot=0}
    let parent=ModelFixture.neural "fixture/parent-node" parentArtifact.Id [port]
    let chosen=(ModelFixture.selected [parentArtifact])[parentArtifact.Id]
    let flat={flat with Nodes=[leaf;parent];SelectedVersions=Map.add parentArtifact.Id chosen flat.SelectedVersions
                        Operations=[E.NeuralForward(leaf.Id,0);E.NeuralForward(parent.Id,0)]}
    let alias=ModelFixture.alias "fixture/child-alias" leaf.Id
    let nested={flat with Id="fixture/nested";Nodes=[leaf;alias;{parent with Inputs=[{port with SourceNode=alias.Id}]};ModelFixture.alias "fixture/output" parent.Id]}
    let! actualFlat=RouteFixture.run flat
    let! actualNested=RouteFixture.run nested
    RouteFixture.retain "m6-flat" actualFlat |> ignore
    RouteFixture.retain "m6-nested" actualNested |> ignore
    Assert.Equal("completed",actualFlat.Outcome)
    Assert.Equal("completed",actualNested.Outcome)
    Assert.Equal<byte[]>(E.tryEncodeState actualFlat.LastCommitted |> accepted,E.tryEncodeState actualNested.LastCommitted |> accepted)
    Assert.Equal<Map<string,E.SelectedVersion>>(flat.SelectedVersions,nested.SelectedVersions)
    Assert.Equal(2,actualFlat.Counters.ForwardEntered)
    Assert.Equal(actualFlat.Counters.ForwardEntered,actualNested.Counters.ForwardEntered)
    Assert.Equal(actualFlat.Counters.KernelEntered,actualNested.Counters.KernelEntered)
    Assert.Equal(actualFlat.Counters.LearnEntered,actualNested.Counters.LearnEntered)
    Assert.Equal(actualFlat.Counters.ProjectionRequested,actualNested.Counters.ProjectionRequested)
    for a,b in List.zip actualFlat.Observations actualNested.Observations do
        Assert.Equal<byte[]>(E.tryEncodeObservation a 65536 |> accepted,E.tryEncodeObservation b 65536 |> accepted)
    let missing={flat with Nodes=[leaf;{parent with Inputs=[]}]}
    Assert.Equal(Some "Inputs",(E.tryAdmit(missing,RuntimeFixture.context) |> refused).Field)
    let stale=flat.SelectedVersions[parentArtifact.Id]
    let stalePlan={flat with SelectedVersions=Map.add parentArtifact.Id {stale with Version=String.replicate 64 "F"} flat.SelectedVersions}
    E.tryAdmit(stalePlan,RuntimeFixture.context) |> refused |> ignore
}

[<Fact>]
let ``M7 actual applied query compensation replays from the retained checkpoint`` () = task {
    let original=RouteFixture.pointPlan 2
    let! first=RouteFixture.run original
    let originalBytes=RouteFixture.retain "m7-original" first
    let cut={original.EvidenceCut with Id="fixture/revised-cut";ParentCut=Some(E.tryCutHash original.EvidenceCut |> accepted)}
    let compensation=RouteFixture.compensation original first 1L original.InitialState [] 2 cut
    let! undone=RouteFixture.run compensation
    RouteFixture.retain "m7-compensated" undone |> ignore
    Assert.Equal("completed",undone.Outcome)
    Assert.Equal(3,undone.Counters.SchedulerEntered)
    Assert.Equal(2,undone.Counters.ForwardEntered)
    Assert.Equal(3,undone.Counters.Applied)
    let checkpoint=undone.Observations.Head.Proposal.Value.State
    let fresh={original with Id="fixture/fresh-replay";EvidenceCut=cut;InitialState=checkpoint}
    let! freshResult=RouteFixture.run fresh
    RouteFixture.retain "m7-fresh" freshResult |> ignore
    let freshState,undoneState=freshResult.LastCommitted,undone.LastCommitted
    Assert.Equal(freshState.Revision,undoneState.Revision)
    Assert.Equal<string>(freshState.ActiveCut,undoneState.ActiveCut)
    Assert.Equal<Map<E.SiteKey,Gaussian>>(freshState.GaussianSites,undoneState.GaussianSites)
    Assert.Equal<Map<E.SiteKey,PrecisionGateKernels.GammaKernel>>(freshState.GammaSites,undoneState.GammaSites)
    Assert.Equal<Map<string,E.Weight>>(freshState.Weights,undoneState.Weights)
    Assert.Equal<string list>(freshState.Outputs |> Map.toList |> List.map fst,undoneState.Outputs |> Map.toList |> List.map fst)
    for KeyValue(id,value) in freshState.Outputs do
        let other=undoneState.Outputs[id]
        Assert.Equal<string>(BoundedModuleLearner.bits value.Mean,BoundedModuleLearner.bits other.Mean)
        Assert.Equal(value.Variance,other.Variance)
        // The one actual compensation checkpoint precedes the replay's
        // forward checkpoints; source sequence is preserved, not erased.
        Assert.Equal(value.SourceSequence+1,other.SourceSequence)
    Assert.Equal<byte[]>(originalBytes,E.tryEncode first (16*1024*1024) |> accepted)
    let impossible=RouteFixture.compensation original first 99L original.InitialState [] 0 cut
    E.tryAdmit(impossible,RuntimeFixture.context) |> refused |> ignore
    let direct=RouteFixture.compensation original first 2L first.Observations.Head.Proposal.Value.State [first.Observations.Head] 0 cut
    let! restored=RouteFixture.run direct
    RouteFixture.retain "m7-direct" restored |> ignore
    Assert.Equal("completed",restored.Outcome)
    Assert.Equal(0,restored.Counters.ForwardEntered)
    Assert.Equal<Map<string,E.Output>>(first.Observations.Head.Proposal.Value.State.Outputs,restored.LastCommitted.Outputs)
    let prior={RuntimeFixture.snapshot with PriorWork={E.zeroWork with SchedulerEntered=4094}}
    let context={RuntimeFixture.context with InitialBudgetSnapshot=prior}
    Assert.Equal("Budget",(E.tryAdmit(compensation,context) |> refused).Code)
}

[<Fact>]
let ``M7 no inverse SGD or unapplied proposal can be admitted as compensation`` () = task {
    let training=RuntimeFixture.trainingPlan()
    let! learned=RouteFixture.run training
    let invalid=RouteFixture.compensation training learned 1L training.InitialState [] 0 training.EvidenceCut
    Assert.Equal(Some "RetainedPlan",(E.tryAdmit(invalid,RuntimeFixture.context) |> refused).Field)
    let original=RouteFixture.pointPlan 1
    let recorder,_,_=RuntimeFixture.recorder()
    let recorder={recorder with Checkpoint=fun _ -> Threading.Tasks.Task.FromResult(Error RuntimeFixture.failure)}
    let! refusedResult=E.runEpoch(E.tryAdmit(original,RuntimeFixture.context) |> accepted,RuntimeFixture.service,recorder)
    RouteFixture.retain "m7-unapplied" refusedResult |> ignore
    let invalid=RouteFixture.compensation original refusedResult 1L original.InitialState [] 0 original.EvidenceCut
    E.tryAdmit(invalid,RuntimeFixture.context) |> refused |> ignore
}

[<Fact>]
let ``withdrawal refuses selected artifacts and retained learned weights before entry`` () =
    let selected=RouteFixture.pointPlan 1
    let changed=ModelFixture.withCut selected {selected.EvidenceCut with Retractions=["fixture/withdrawn"]}
    Assert.Equal(Some "Retractions.SelectedVersions",(E.tryAdmit(changed,RuntimeFixture.context) |> refused).Field)
    let p=RuntimeFixture.projectionPlan()
    let values=BoundedModuleLearner.initialParameters()
    let weight:E.Weight={BaseArtifactId="fixture/point";Parameters=values;VectorSha256=E.tryVectorHash values |> accepted}
    let weighted={p with InitialState={p.InitialState with Weights=Map.ofList ["fixture/point",weight]}}
    let changed=ModelFixture.withCut weighted {p.EvidenceCut with Retractions=["fixture/withdrawn"]}
    Assert.Equal(Some "Retractions.Weights",(E.tryAdmit(changed,RuntimeFixture.context) |> refused).Field)

[<Fact>]
let ``withdrawal refuses child cuts but permits active cold start with parent metadata`` () = task {
    let training=RuntimeFixture.trainingPlan()
    let t=training.Training.Value
    let parent={t.Artifacts.Head with ParentVersion=Some(String.replicate 64 "F")}
    let training={training with Training=Some {t with Artifacts=[parent]}}
    let changed=ModelFixture.withCut training {training.EvidenceCut with Retractions=["fixture/withdrawn"]}
    let inherited={changed with Training=Some {changed.Training.Value with ChildCuts=Map.ofList [E.tryCutHash training.EvidenceCut |> accepted,training.EvidenceCut]}}
    Assert.Equal(Some "Retractions.ChildForecasts",(E.tryAdmit(inherited,RuntimeFixture.context) |> refused).Field)
    let! cold=RouteFixture.run changed
    RouteFixture.retain "withdrawal-cold-start" cold |> ignore
    Assert.Equal("completed",cold.Outcome)
    Assert.Equal(parent.ParentVersion,cold.ProposedArtifacts.Head.ParentVersion)
    let first=E.tryReturnedValue cold.Observations.Head.Call |> Option.get |> unbox<BoundedModuleLearner.StepAttempt>
    Assert.Equal<float list>(BoundedModuleLearner.initialParameters(),first.Input.Parameters)
    let overlap=ModelFixture.withCut changed {changed.EvidenceCut with Retractions=changed.EvidenceCut.ActiveIds}
    Assert.Equal(Some "Retractions",(E.tryAdmit(overlap,RuntimeFixture.context) |> refused).Field)
}

[<Theory>]
[<InlineData(0)>]
[<InlineData(1)>]
[<InlineData(2)>]
let ``M7 supplied history cannot claim application without admitted returned work`` mutation = task {
    let original=RouteFixture.pointPlan 1
    let! actual=RouteFixture.run original
    let valid=RouteFixture.compensation original actual 1L original.InitialState [] 0 original.EvidenceCut
    let inputs=match valid.Operations.Head with E.Compensate c -> c | _ -> failwith "fixture"
    let corrupted=Json.Nodes.JsonNode.Parse(inputs.RetainedResult.GetRawText())
    let observation=corrupted["Observations"][0]
    match mutation with
    | 0 -> observation["Admission"]<-null
    | 1 -> observation["Call"]<-Json.Nodes.JsonNode.Parse("{\"Kind\":\"NotEntered\"}")
    | _ -> observation["Failure"]<-Json.Nodes.JsonNode.Parse("{\"Code\":\"Admission\",\"Stage\":\"forward\",\"Field\":null,\"Message\":\"injected inconsistent failed proposal\"}")
    let changed={valid with Operations=[E.Compensate {inputs with RetainedResult=raw(corrupted.ToJsonString()) |> RouteFixture.json}]}
    E.tryAdmit(changed,RuntimeFixture.context) |> refused |> ignore
}

[<Fact>]
let ``withdrawal weighted current state and child forecast refusal have independent fields`` () =
    let p=RuntimeFixture.projectionPlan()
    let values=BoundedModuleLearner.initialParameters()
    let weight:E.Weight={BaseArtifactId="fixture/point";Parameters=values;VectorSha256=E.tryVectorHash values |> accepted}
    let p={p with InitialState={p.InitialState with Weights=Map.ofList ["fixture/point",weight]}}
    let changed=ModelFixture.withCut p {p.EvidenceCut with Retractions=["fixture/withdrawn"]}
    Assert.Equal(Some "Retractions.Weights",(E.tryAdmit(changed,RuntimeFixture.context) |> refused).Field)

[<Fact>]
let ``withdrawal supplied compact forecast is refused before source roster comparison`` () =
    let training=RuntimeFixture.trainingPlan()
    let forecast:E.ChildForecast=
        {ArtifactId="fixture/model";TrainingRowId="fixture/row";QueryRowId="fixture/hidden";ProducerNode="fixture/child"
         OutputPort="mean";TargetSlot=0;BundleSha256=String.replicate 64 "A";ProducerVersion=String.replicate 64 "B"
         ProducerTrainingCut=None;ObservationSequence=1;CommitRevision=1L;Mean=0.0}
    let changed=ModelFixture.withCut training {training.EvidenceCut with Retractions=["fixture/withdrawn"]}
    let changed={changed with Training=Some {changed.Training.Value with ChildForecasts=[forecast]}}
    Assert.Equal(Some "Retractions.ChildForecasts",(E.tryAdmit(changed,RuntimeFixture.context) |> refused).Field)

[<Fact>]
let ``M8 fixed four-row fit discriminates initializer and counterfactual labels`` () = task {
    let basePlan=RuntimeFixture.trainingPlan()
    let values=[-1.0;-0.5;0.5;1.0]
    let makePlan counterfactual =
        let stem=if counterfactual then "control/permuted" else "control/learn"
        let rows=values |> List.mapi(fun i x ->
            let row:E.EvidenceRow=
                {Id=stem+"/"+string i;ContentSha256="";Origin=int64(2*i);FeatureAvailable=int64(2*i)
                 TargetTime=int64(2*i+1);LabelAvailable=int64(2*i+1);Split="train";Features=x::List.replicate 7 0.0
                 Target=Some(if counterfactual then values[3-i] else x);Uses=[]}
            {row with ContentSha256=E.tryRowContentHash row |> accepted})
        let ids=List.map(fun (r:E.EvidenceRow) -> r.Id) rows
        let cut={basePlan.EvidenceCut with Id=stem+"/cut";Rows=rows;ActiveIds=ids}
        let training={basePlan.Training.Value with RowIds=Map.ofList ["fixture/model",ids];CutEnd=7L}
        let plan={basePlan with Id=stem+"/fit";Training=Some training;
                               Operations=[for pass in 0..1 do for id in ids -> E.LearnStep("fixture/model",pass,id)]}
        ModelFixture.withCut plan cut
    let original,permuted=makePlan false,makePlan true
    let originalBytes=E.tryEncodePlan original |> accepted
    let! learned=RouteFixture.run original
    let! changed=RouteFixture.run permuted
    RouteFixture.retain "m8-learned" learned |> ignore
    RouteFixture.retain "m8-permuted" changed |> ignore
    Assert.Equal("completed",learned.Outcome)
    Assert.Equal("completed",changed.Outcome)
    Assert.Equal(8,learned.Counters.LearnEntered)
    Assert.Equal(8,changed.Counters.LearnEntered)
    Assert.Equal(8,learned.Counters.ForwardEntered)
    Assert.Equal(8,changed.Counters.ForwardEntered)
    let artifact=learned.ProposedArtifacts.Head
    let other=changed.ProposedArtifacts.Head
    Assert.NotEqual<string>(artifact.TrainingCut,other.TrainingCut)
    let parameters=[BoundedModuleLearner.initialParameters();artifact.Parameters;other.Parameters]
    let calls=ResizeArray<JsonElement>()
    let losses=parameters |> List.map(fun vector ->
        values |> List.map(fun target ->
            let transformed=BoundedModuleLearner.tryTransform artifact.Preprocessing (target::List.replicate 7 0.0)
            transformed.Outcome |> accepted
            let actual=BoundedModuleLearner.tryForward {Parameters=vector;Inputs=transformed.Values@List.replicate 4 0.0}
            // This is a serialization envelope for an actual isolated unit
            // forward call, not a scheduler or applied epoch observation.
            let envelope:E.Observation=
                {Sequence=calls.Count+1;Operation=E.NeuralForward("unit/m8-evaluation",0);InputRevision=0L
                 Inputs=E.RawInputs(RouteFixture.json(raw "{}"));Call=E.SourceReturns.retain actual
                 Proposal=None;Admission=None;AppliedRevision=None;Failure=None}
            let encoded=E.tryEncodeObservation envelope 65536 |> accepted |> RouteFixture.json
            calls.Add(encoded.GetProperty("Call").Clone())
            let residual=(actual.Outcome |> accepted)-target
            residual*residual/2.0) |> List.fold (+) 0.0)
    let evidence=raw("{\"ForwardEntries\":12,\"TransformEntries\":12,\"Calls\":["+
                     (calls |> Seq.map(fun c -> c.GetRawText()) |> String.concat ",")+
                     "],\"LossSumsBits\":["+(losses |> List.map(fun v -> "\""+BoundedModuleLearner.bits v+"\"") |> String.concat ",")+"]}")
    RouteFixture.retainBytes "m8-training-only-evaluations" evidence |> ignore
    Assert.Equal(12,calls.Count)
    Assert.True(losses[1]<losses[0],sprintf "learned %g, initial %g" losses[1] losses[0])
    Assert.True(losses[1]<losses[2],sprintf "learned %g, permuted %g" losses[1] losses[2])
    Assert.Equal<string>(RuntimeFixture.hash originalBytes,learned.PlanSha256)
    Assert.Equal<string>(E.tryEncodePlan permuted |> accepted |> RuntimeFixture.hash,changed.PlanSha256)
    let stale=E.trySelectArtifacts(Map.empty,Map.ofList ["fixture/model",Some(String.replicate 64 "F")],learned)
    stale |> refused |> ignore
    for split in ["validation";"test"] do
        let row={original.EvidenceCut.Rows.Head with Split=split}
        let row={row with ContentSha256=E.tryRowContentHash row |> accepted}
        let cut={original.EvidenceCut with Rows=row::original.EvidenceCut.Rows.Tail}
        E.tryAdmit(ModelFixture.withCut original cut,RuntimeFixture.context) |> refused |> ignore
}

[<Fact>]
let ``M6 a second declared Normal factor changes model identity without inventing independence`` () =
    let one,gate=ModelFixture.gammaPlan()
    let existing=gate.Inputs.Head
    let prior=gate.Prior.Value
    let twoGate={gate with Inputs=[{existing with TargetSlot=0};existing];
                          Prior=Some {prior with Gammas=[prior.Gammas.Head;prior.Gammas.Head]}}
    let addedVariable=E.tryVariableId gate.InstancePath "gamma/0" |> accepted
    let two={one with Nodes=[one.Nodes.Head;twoGate]}
    let two=ModelFixture.withCut two {two.EvidenceCut with PriorOwners=Map.add addedVariable "fixture/prior-second" two.EvidenceCut.PriorOwners}
    let oneAdmitted=E.tryAdmit(one,RuntimeFixture.context) |> accepted
    let twoAdmitted=E.tryAdmit(two,RuntimeFixture.context) |> accepted
    Assert.NotEqual<string>(E.admittedPlanSha256 oneAdmitted,E.admittedPlanSha256 twoAdmitted)
    let block=E.RuntimeControls.gamma twoAdmitted two.InitialState gate.Id
    block.Outcome |> accepted
    Assert.Equal(2,block.Proposal.Value.State.GammaSites.Count)
    let ids=block.Proposal.Value.State.GammaSites |> Map.toList |> List.map(fun (key,_) -> key.ContributionId)
    Assert.NotEqual<string>(ids[0],ids[1])
    // Reusing one clamped mean in two explicitly declared factors is a
    // different model, not evidence that those outputs are independent.
    let replaced=E.RuntimeControls.gamma twoAdmitted block.Proposal.Value.State gate.Id
    replaced.Outcome |> accepted
    Assert.Equal(2,replaced.Proposal.Value.State.GammaSites.Count)

module private SyntheticProjectionFixture =
    // These are deliberately supplied unit carriers, not native/reference
    // returns. Null unconsumed custody fields make that limitation visible.
    // This fixture tests the core's declared injected-service trust boundary;
    // the independent actual bridge would not admit these as process evidence.
    let objectValue values = box(Map.ofList values:Map<string,obj>)
    let encoded value = JsonSerializer.SerializeToUtf8Bytes(value:obj)
    let element value = encoded value |> RouteFixture.json
    let s value=box(value:string)
    let b value=box(value:bool)
    let i value=box(value:int)
    let service bindings (snapshot:unit->E.BudgetSnapshot) : E.ProjectionService = fun request -> task {
        let input=Convert.FromHexString request.RawInputHex |> RouteFixture.json
        let target=objectValue ["T",s(BoundedModuleLearner.bits request.TargetBits.Precision);"U",s(BoundedModuleLearner.bits request.TargetBits.Location)
                                "K",s(BoundedModuleLearner.bits request.TargetBits.Linear);"C",s(BoundedModuleLearner.bits request.TargetBits.ExponentialRate)]
        let objective=objectValue ["ValueBits",s "0000000000000000";"DerivativeMeanBits",s "0000000000000000";"DerivativeVarianceBits",s "0000000000000000"]
        let candidate=objectValue ["TargetBits",target;"LogRatioBits",s "0000000000000000";"RatioBits",s "3FF0000000000000";"RBits",s "3FF0000000000000"
                                   "MeanBits",s "BFD0000000000000";"VarianceBits",s "3FE0000000000000";"Bracket",null;"Stop",null;"OriginalObjective",objective]
        let identity schema=["Schema",s schema;"CaseId",s request.CaseId;"InputSha256",s request.InputSha256;"Bindings",box bindings]
        let receipt=objectValue(identity "zeta.precision-projection.native.v1"@
                                ["Outcome",objectValue ["Kind",s "candidate";"Value",candidate];"Counters",null;"Trace",box [||]]) |> encoded
        let original=objectValue ["BytesHex",s(Convert.ToHexString(receipt).ToLowerInvariant())]
        let nullNames=["Argv";"StartedAtUtc";"FinishedAtUtc";"LaunchStartedAtUtc";"ChildPid";"CleanupExitCode";"Stdout";"Stderr";"StdoutEof";"StderrEof"
                       "StdoutLimitExceeded";"StderrLimitExceeded";"StdoutFailure";"StderrFailure";"Failure";"Cleanup";"InputFiles";"Output";"Producer";"Dependencies";"CreatedFiles";"EnvironmentOverrides"]
        let nativeFields=objectValue(["Complete",b true;"Receipt",original;"LaunchAttempted",b true;"ExitCode",i 0;"DirectChildClosed",b true;"ReadersClosed",b true]@
                                     (nullNames |> List.map(fun name -> name,null)))
        let native=objectValue ["Type",s "zeta_interp.precision_gate_projection_process.NativeObservation";"Fields",nativeFields] |> element
        let reference=objectValue(identity "zeta.precision-projection.reference.v1"@["Outcome",objectValue ["Kind",s "enclosure"]])
        let leaves=["MeanBits","BFD0000000000000";"VarianceBits","3FE0000000000000";"RatioBits","3FF0000000000000";"RBits","3FF0000000000000"
                    "OriginalObjective.ValueBits","0000000000000000";"OriginalObjective.DerivativeMeanBits","0000000000000000";"OriginalObjective.DerivativeVarianceBits","0000000000000000"]
                   |> List.map(fun (field,value) -> objectValue ["Field",s field;"NativeBits",s value;"ReferenceInterval",objectValue ["Lower",s "0";"Upper",s "0"];"Tolerance",s "synthetic";"Passed",b true])
        let certificateFields=objectValue(identity "zeta.precision-projection.certificate.v1"@
            ["Target",objectValue ["RequestedParameters",box(input.GetProperty "Parameters");"TargetBits",target;"DyadicTarget",null;"ConversionDelta",null]
             "NativeRaw",objectValue ["BytesHex",s(Convert.ToHexString(receipt).ToLowerInvariant());"Bytes",i receipt.Length;"Sha256",s(RuntimeFixture.hash receipt)]
             "Reference",reference;"CertificateContext",null;"Coordinates",null;"Objective",null
             "Outcome",objectValue ["Kind",s "certified";"TargetScope",s "exact-native-dyadic";"NativeTrajectoryCertified",b false;"GraphApplicationPerformed",b false]
             "LeafChecks",box leaves;"Counters",objectValue ["Starts",i 1;"ReferenceRootCalls",i 1;"CertificatePreparations",i 1;"CoordinateIntervalCalls",i 1;"ObjectiveIntervalCalls",i 1;"CertificateTranscendentalEntries",i 0;"LeafChecks",i 7]])
        let certificate=objectValue ["Type",s "zeta_interp.precision_gate_projection_intervals.Success";"Fields",objectValue ["Value",certificateFields]] |> element
        let next=snapshot()
        return Ok {Sequence=request.Sequence;RequestId=request.RequestId;InputSha256=request.InputSha256;BindingsSha256=request.BindingsSha256
                   ServiceSha256=RuntimeFixture.context.Identity.ServiceSha256;Native=Some native;Certificate=Some certificate;Failure=None;BudgetSnapshot=next}
    }

[<Fact>]
let ``M7 pure-site compensation uses synthetic service carriers without claiming numerical certification`` () = task {
    let original=RuntimeFixture.projectionPlan()
    let node={original.Nodes.Head with Prior=Some {Gaussian={PrecisionMean=1.5;Precision=1.0};Gammas=[]};Unary=Some {K= -0.75;C=1.0}}
    let original={original with Nodes=[node]}
    let recorder,_,_=RuntimeFixture.recorder()
    let mutable current=RuntimeFixture.snapshot
    let checkpoint value = task {
        let! returned=recorder.Checkpoint value
        match returned with
        | Ok acknowledgment ->
            current<-{acknowledgment.BudgetSnapshot with SnapshotIndex=current.SnapshotIndex+1}
            return Ok {acknowledgment with BudgetSnapshot=current}
        | Error failure -> return Error failure }
    let recorder={recorder with Snapshot=(fun () -> Ok current);Checkpoint=checkpoint}
    let supplied=SyntheticProjectionFixture.service original.SourceBindings (fun () -> current<-{current with SnapshotIndex=current.SnapshotIndex+1};current)
    let calls=ResizeArray<E.ProjectionRequest*E.ProjectionResponse>()
    let service request = task {
        let! actual=supplied request
        calls.Add(request,actual |> accepted)
        return actual }
    let! prior=E.runEpoch(E.tryAdmit(original,RuntimeFixture.context) |> accepted,service,recorder)
    RouteFixture.retain "m7-synthetic-carrier-query" prior |> ignore
    Assert.Equal("completed",prior.Outcome)
    Assert.Equal(1,calls.Count)
    let request,response=calls[0]
    let block=E.tryReturnedValue prior.Observations.Head.Call |> Option.get |> unbox<E.BlockAttempt>
    let primitive=block.Calls |> List.find(fun c -> c.Operation="ProjectionService")
    Assert.Equal<byte[]>(E.tryEncodeProjectionRequest request |> accepted,E.tryCanonicalPayload (raw(primitive.Inputs.GetRawText())) (1024*1024) |> accepted)
    let actualResponse=E.tryReturnedValue primitive.Call |> Option.get |> unbox<Result<E.ProjectionResponse,E.TransportFailure>> |> accepted
    Assert.Same(response,actualResponse)
    Assert.Equal<string>(request.RequestId,block.Proposal.Value.Details.GetProperty("RequestId").GetString())
    Assert.Equal(1,prior.LastCommitted.GaussianSites.Count)
    let cut={original.EvidenceCut with Id="fixture/withdrawn-cut";ParentCut=Some(E.tryCutHash original.EvidenceCut |> accepted);Retractions=["fixture/earlier-observation"]}
    let compensation=RouteFixture.compensation original prior 1L original.InitialState [] 0 cut
    let! actual=RouteFixture.run compensation
    RouteFixture.retain "m7-pure-site-withdrawal" actual |> ignore
    Assert.Equal("completed",actual.Outcome)
    Assert.True(actual.LastCommitted.GaussianSites.IsEmpty)
    Assert.Equal(0,actual.Counters.ProjectionRequested)
    Assert.Equal(0,actual.Counters.ForwardEntered)
    Assert.Equal(1,actual.Counters.Applied)
}

[<Fact>]
let ``M6 explicit alias resolution also preserves nonempty mixed sites and primitive returns`` () =
    let flat,gate=ModelFixture.gammaPlan()
    let child=flat.Nodes.Head
    let alias=ModelFixture.alias "fixture/gamma-alias" child.Id
    let nested={flat with Id="fixture/gamma-nested";Nodes=[child;alias;{gate with Inputs=[{gate.Inputs.Head with SourceNode=alias.Id}]}]}
    let compute plan =
        let admitted=E.tryAdmit(plan,RuntimeFixture.context) |> accepted
        E.RuntimeControls.gamma admitted plan.InitialState gate.Id
    let a,b=compute flat,compute nested
    a.Outcome |> accepted
    b.Outcome |> accepted
    Assert.Equal(1,a.Proposal.Value.State.GaussianSites.Count)
    Assert.Equal(1,a.Proposal.Value.State.GammaSites.Count)
    Assert.Equal<byte[]>(E.tryEncodeState a.Proposal.Value.State |> accepted,E.tryEncodeState b.Proposal.Value.State |> accepted)
    let retain name (actual:E.BlockAttempt) =
        let envelope:E.Observation=
            {Sequence=1;Operation=E.GammaBlock(gate.Id,0);InputRevision=flat.InitialState.Revision
             Inputs=E.RawInputs actual.Inputs;Call=E.SourceReturns.retain actual;Proposal=actual.Proposal
             Admission=None;AppliedRevision=None;Failure=None}
        let encoded=E.tryEncodeObservation envelope (1024*1024) |> accepted |> RouteFixture.json
        let call=encoded.GetProperty("Call")
        RouteFixture.retainBytes name (raw(call.GetRawText())) |> ignore
        let fields=call.GetProperty("Result").GetProperty("Fields")
        raw(fields.GetProperty("Calls").GetRawText())
    // The enclosing Node input alias is the declared structural difference;
    // all actual primitive inputs, results and numerical site bits coincide.
    Assert.Equal<byte[]>(retain "m6-flat-gamma-call" a,retain "m6-nested-gamma-call" b)
