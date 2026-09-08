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
