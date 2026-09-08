namespace Zeta.Bayesian

open System
open System.Diagnostics
open System.Globalization
open System.IO
open System.Security.Cryptography
open System.Text
open System.Text.Json
open System.Threading.Tasks
open Zeta.Core

/// One finite immutable epoch, with explicit source-admitted transport premises.
/// Local certification does not prove source/process custody or global convergence.
[<RequireQualifiedAccess>]
module MixedMessageEpoch =
    module L = BoundedModuleLearner
    module K = PrecisionGateKernels

    type Failure = L.Failure
    type ExceptionObservation = { Type: string; Message: string }
    type ActualReturn = private { Value: obj }
    type Call =
        | NotEntered
        | Returned of ActualReturn
        | Raised of ExceptionObservation

    type ContributionUse =
        { ContributionId: string; Role: string
          ProducerArtifact: string option; ProducerTrainingCut: string option }
    type EvidenceRow =
        { Id: string; ContentSha256: string; Origin: int64; FeatureAvailable: int64
          TargetTime: int64; LabelAvailable: int64; Split: string
          Features: float list; Target: float option; Uses: ContributionUse list }
    type EvidenceCut =
        { Id: string; Rows: EvidenceRow list; ActiveIds: string list
          PriorOwners: Map<string,string>; ParentCut: string option; Retractions: string list }
    type InputPort = { SourceNode: string; SourcePort: string; TargetSlot: int }
    type OutputAlias = { SourceNode: string; SourcePort: string }
    type GammaPrior = { Shape: float; Rate: float }
    type Prior = { Gaussian: Gaussian; Gammas: GammaPrior list }
    type Unary = { K: float; C: float }
    type Node =
        { Id: string; InstancePath: string; Kind: string; Inputs: InputPort list
          Artifact: string option; Prior: Prior option; Unary: Unary option
          Children: string list option; OutputAlias: OutputAlias option }
    type SelectedVersion = { Version: string; Artifact: L.ModuleArtifact }
    type TrainingArtifact = { Id: string; ParentVersion: string option; Ports: string list }
    type ChildForecast =
        { ArtifactId: string; TrainingRowId: string; TargetSlot: int; BundleSha256: string
          QueryRowId: string; ProducerNode: string; OutputPort: string; ProducerVersion: string
          ProducerTrainingCut: string option; ObservationSequence: int; CommitRevision: int64
          Mean: float }
    type Training =
        { Artifacts: TrainingArtifact list; RowIds: Map<string,string list>; CutEnd: int64
          ChildCuts: Map<string,EvidenceCut>; ChildForecasts: ChildForecast list }
    [<StructuralEquality; StructuralComparison>]
    type SiteKey = { InstancePath: string; Factor: string; Port: string; ContributionId: string }
    type Weight = { BaseArtifactId: string; VectorSha256: string; Parameters: float list }
    type Output = { Mean: float; Variance: float option; SourceSequence: int }
    type State =
        { Revision: int64; Weights: Map<string,Weight>; GaussianSites: Map<SiteKey,Gaussian>
          GammaSites: Map<SiteKey,K.GammaKernel>; Outputs: Map<string,Output>; ActiveCut: string }
    /// Passive retained historical trees. Admission checks this exact finite variant;
    /// no type name or producer verdict selects an executable operation.
    type CompensationInputs =
        { TargetRevision: int64; RetainedPlan: JsonElement; RetainedResult: JsonElement
          Checkpoint: JsonElement }
    type Operation =
        | LearnStep of artifactId: string * pass: int * rowId: string
        | NeuralForward of nodeId: string * sweep: int
        | GammaBlock of nodeId: string * sweep: int
        | GaussianBlock of nodeId: string * sweep: int
        | Compensate of CompensationInputs
    type EpochPlan =
        { Id: string; Mode: string; EvidenceCut: EvidenceCut; QueryRowId: string option
          Nodes: Node list; SelectedVersions: Map<string,SelectedVersion>; InitialState: State
          Operations: Operation list; Sweeps: int; Damping: float; Training: Training option
          Horizon: int; SourceBindings: Map<string,string> }
    type Work =
        { SchedulerEntered: int; KernelEntered: int; ForwardEntered: int; LearnEntered: int
          ProjectionRequested: int; NativeLaunchAttempted: int; CertificateEntered: int
          NestedReferenceEntered: int; TrainingArtifacts: int }
    type StoreBudget = { ReservedCombinedBytes: int64; ReservedArtifactSlots: int }
    type BudgetSnapshot =
        { SnapshotIndex: int; CompletedSessions: int; PriorWork: Work; Store: StoreBudget
          TranscriptBytes: int64; TranscriptFrames: int; PeerLaunchAttempted: int
          NativePreparationEntered: int; RemainingMilliseconds: int }
    type RemainingStore = { CombinedBytes: int64; ArtifactSlots: int }
    type Remaining =
        { Work: Work; Store: RemainingStore; TranscriptBytes: int64; TranscriptFrames: int
          RemainingMilliseconds: int; SnapshotIndex: int }
    type CountObservation = { Observed: int; Complete: bool }
    type RemoteCounters =
        { NativeCallEntered: CountObservation; NativeLaunchAttempted: CountObservation
          NativeReturned: CountObservation; CertificateEntered: CountObservation
          CertificateReturned: CountObservation; NestedReferenceEntered: CountObservation }
    type Counters =
        { SchedulerEntered: int; KernelEntered: int; ForwardEntered: int; LearnEntered: int
          Returned: int; Proposed: int; Certified: int; Applied: int; ProjectionRequested: int
          ProtocolBytes: int64; ReservedBytes: int64; ArtifactSlots: int; Remote: RemoteCounters }
    type ProjectionRequest =
        { Sequence: int; RequestId: string; InputRevision: int64; Base: Gaussian
          TargetBits: K.ProjectionTarget; RawInputHex: string; InputSha256: string
          CaseId: string; BindingsSha256: string; Remaining: Remaining }
    type ProjectionResponse =
        { Sequence: int; RequestId: string; InputSha256: string; BindingsSha256: string
          ServiceSha256: string; Native: JsonElement option; Certificate: JsonElement option
          Failure: Failure option; BudgetSnapshot: BudgetSnapshot }
    type TransportFailure =
        { Failure: Failure; Received: JsonElement option; RawSha256: string option
          ReceivedBytes: int64; Exception: ExceptionObservation option }
    type Artifact =
        { File: string; Encoding: string; Bytes: int64; Sha256: string
          StoredBytes: int64; StoredSha256: string }
    type Proposal =
        { ExpectedRevision: int64; ExpectedStateSha256: string; State: State; Details: JsonElement }
    type ArtifactEntry = { Request: TrainingArtifact; Preprocessing: Call }
    type LearningInput =
        { ArtifactId: string; Pass: int; RowId: string; Row: EvidenceRow; OldVector: float list
          Inputs: float list; Target: float; ArtifactEntry: ArtifactEntry option; Transform: Call }
    type ForwardingInput =
        { NodeId: string; RowId: string; ArtifactVersion: string; Transform: Call; Inputs: float list }
    type EpochInputs =
        | RawInputs of JsonElement
        | LearningInputs of LearningInput
        | ForwardingInputs of ForwardingInput
    type Observation =
        { Sequence: int; Operation: Operation; InputRevision: int64; Inputs: EpochInputs
          Call: Call; Proposal: Proposal option; Admission: Result<unit,Failure> option
          AppliedRevision: int64 option; Failure: Failure option }
    type PrimitiveObservation = { Operation: string; Inputs: JsonElement; Call: Call }
    type BlockAttempt =
        { Inputs: JsonElement; Calls: PrimitiveObservation list; Proposal: Proposal option
          Outcome: Result<unit,Failure> }
    type Checkpoint =
        { Sequence: int; Observation: Observation; LastRevision: int64; StateSha256: string }
    type StoredCheckpoint =
        { Sequence: int; CheckpointSha256: string; Artifact: Artifact; BudgetSnapshot: BudgetSnapshot }
    type Commit =
        { Sequence: int; CheckpointSha256: string; AppliedRevision: int64
          LastCommitted: State; Counters: Counters }
    type Recorder =
        { Checkpoint: Checkpoint -> Task<Result<StoredCheckpoint,Failure>>
          Commit: Commit -> Task<Result<unit,Failure>>
          Snapshot: unit -> Result<BudgetSnapshot,Failure> }
    type ProjectionService = ProjectionRequest -> Task<Result<ProjectionResponse,TransportFailure>>
    type RecorderObservation = { Kind: string; Sequence: int option; Call: Call }
    type Publication =
        { Recorder: RecorderObservation list; Unpublished: int list; Failure: Failure option
          BudgetSnapshot: BudgetSnapshot }
    type SchedulerObservation =
        | SchedulerReturned of Result<int,InterruptFeedback>
        | SchedulerRaised of ExceptionObservation
    type EpochResult =
        { PlanSha256: string; Outcome: string; Termination: string; Failure: Failure option
          LastCommitted: State; ProposedArtifacts: L.ModuleArtifact list
          Observations: Observation list; Counters: Counters; PendingRequest: ProjectionRequest option
          Scheduler: SchedulerObservation; Publication: Publication }
    type PublicationFailure = { Failure: Failure; Result: EpochResult }
    type PeerIdentity = { SessionId: string; ServiceSha256: string }
    /// Issued only by the source-admitted coordinator route. This is ordinary
    /// same-process trust, not proof that matching hashes imply prior execution.
    type AdmittedForecast = private { Binding: ChildForecast }
    type AdmissionContext =
        { Identity: PeerIdentity; InitialBudgetSnapshot: BudgetSnapshot
          Forecasts: AdmittedForecast list }
    type private TrainingPrepared = { Request: TrainingArtifact; Preprocessing: L.Preprocessing }
    type AdmittedPlan =
        private
            { Plan: EpochPlan; Context: AdmissionContext; PlanSha256: string
              Resolved: Map<string,string>; Ordered: Node list
              TrainingPrepared: Map<string,TrainingPrepared>; Replay: EpochPlan option
              RestoreState: State option; Sequence: int ref; Entered: bool ref }
    type EpochReturnReference =
        { Sequence: int; ResultSha256: string; FrameSha256: string; Artifact: Artifact }
    type PartialWrite = { Sequence: int option; ReservedBytes: int64; ObservedWrittenBytes: int64 option }
    type PeerTransport =
        { IncomingBytes: int64; IncomingFrames: int; OutgoingReservedBytes: int64
          OutgoingReservedFrames: int; OutgoingCompletedBytes: int64; OutgoingCompletedFrames: int
          PartialWrite: PartialWrite option }
    type TerminalPublication =
        { EpochReturn: EpochReturnReference option; ResultRetention: string; Failure: Failure option
          Coordinator: BudgetSnapshot option; Peer: PeerTransport }

    let private failure code stage field message : Failure =
        { Code = code; Stage = stage; Field = field; Message = message }
    let private error field message = Error(failure "Admission" "admit" (Some field) message)
    let private present x = not (isNull (box x))
    let private hash (bytes: byte[]) = Convert.ToHexString(SHA256.HashData bytes)
    let private invariant (value: int) = value.ToString(CultureInfo.InvariantCulture)
    let private finite x = Double.IsFinite x
    let private bounded n xs = present xs && (xs |> Seq.truncate (n + 1) |> Seq.length) <= n
    let private unique xs = Set.count (Set.ofList xs) = List.length xs
    let private ordinal (a: string) (b: string) = StringComparer.Ordinal.Compare(a,b)
    type private FlowBuilder() =
        inherit ResultBuilder()
        member _.For(values: seq<'T>, body: 'T -> Result<unit,'E>) =
            use e = values.GetEnumerator()
            let mutable r = Ok()
            while Result.isOk r && e.MoveNext() do r <- body e.Current
            r
        member _.While(guard: unit -> bool, body: unit -> Result<unit,'E>) =
            let mutable r = Ok()
            while Result.isOk r && guard () do r <- body ()
            r
    let private flow = FlowBuilder()

    // Closed canonical tree used only by the explicit source codecs below.
    // No reflection, CLR type loading, or producer-selected dispatch.
    type private J = N | B of bool | I of int64 | S of string | A of seq<J> | O of seq<string * J>
    exception private WireFailure of Failure
    let private wireError field message = raise (WireFailure(failure "Admission" "admit" (Some field) message))
    let private text (value: JsonElement) =
        if value.ValueKind <> JsonValueKind.String then wireError "string" "string required"
        let s = value.GetString()
        if isNull s then wireError "string" "non-null string required"
        s
    let private integer (value: JsonElement) =
        let mutable x = 0L
        if value.ValueKind <> JsonValueKind.Number || not (value.TryGetInt64 (&x)) then
            wireError "integer" "exact integer token required"
        x
    let private intSmall value =
        let x = integer value
        if x < 0L || x > int64 Int32.MaxValue then wireError "integer" "bounded nonnegative integer required"
        int x
    let private boolean (value: JsonElement) =
        if value.ValueKind <> JsonValueKind.True && value.ValueKind <> JsonValueKind.False then
            wireError "boolean" "boolean token required"
        value.GetBoolean()
    let private keys expected (value: JsonElement) =
        if value.ValueKind <> JsonValueKind.Object then wireError "object" "object required"
        let actual = value.EnumerateObject() |> Seq.map (fun p -> p.Name) |> Seq.toList
        if not (unique actual) || List.sortWith ordinal actual <> List.sortWith ordinal expected then
            wireError "keys" ("expected exact keys: " + String.concat "," expected)
    let private prop name (value: JsonElement) = value.GetProperty(name: string)
    let private arr n (value: JsonElement) =
        if value.ValueKind <> JsonValueKind.Array || value.GetArrayLength() > n then
            wireError "array" "array exceeds its declared count or has wrong type"
        value.EnumerateArray() |> Seq.toList
    let private opt decode (value: JsonElement) = if value.ValueKind = JsonValueKind.Null then None else Some(decode value)
    let private bits (value: JsonElement) =
        let s = text value
        if s.Length <> 16 || not (s |> Seq.forall (fun c -> (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F'))) then
            wireError "Bits" "uppercase sixteen-character bits required"
        let value = BitConverter.UInt64BitsToDouble(UInt64.Parse(s,NumberStyles.HexNumber,CultureInfo.InvariantCulture))
        if not (finite value) then wireError "Bits" "finite binary64 required"
        value
    let private mapRead maxCount decode (value: JsonElement) =
        if value.ValueKind <> JsonValueKind.Object then wireError "map" "object required"
        let mutable count = 0
        let mutable result = Map.empty
        for p in value.EnumerateObject() do
            count <- count + 1
            if count > maxCount || Map.containsKey p.Name result then wireError "map" "bounded unique map required"
            result <- Map.add p.Name (decode p.Value) result
        result
    let private jOpt f = function None -> N | Some x -> f x
    let private jBits x = S(L.bits x)
    let private jInt x = I(int64 x)
    let private jMap f (m: Map<string,'T>) = O (seq { for KeyValue(k,v) in m -> k,f v })
    let private utf8 = UTF8Encoding(false,true)
    let private stringBytes (s: string) =
        if isNull s then wireError "string" "non-null string required"
        // Validate scalar well-formedness before canonical UTF8 emission.
        utf8.GetByteCount s |> ignore
        let b = StringBuilder(s.Length + 2)
        b.Append('"') |> ignore
        for c in s do
            match c with
            | '"' -> b.Append("\\\"") |> ignore
            | '\\' -> b.Append("\\\\") |> ignore
            | '\b' -> b.Append("\\b") |> ignore
            | '\t' -> b.Append("\\t") |> ignore
            | '\n' -> b.Append("\\n") |> ignore
            | '\f' -> b.Append("\\f") |> ignore
            | '\r' -> b.Append("\\r") |> ignore
            | x when x < ' ' -> b.Append("\\u00").Append((int x).ToString("x2",CultureInfo.InvariantCulture)) |> ignore
            | x -> b.Append x |> ignore
        b.Append('"') |> ignore
        utf8.GetBytes(b.ToString())
    let private stringSize limit (s: string) =
        if isNull s then wireError "string" "non-null string required"
        if int64 s.Length + 2L > limit then wireError "encoding" "remaining string allowance exceeded before traversal"
        let mutable size = 2L + int64 (utf8.GetByteCount s)
        for c in s do
            match c with
            | '"' | '\\' | '\b' | '\t' | '\n' | '\f' | '\r' -> size <- size + 1L
            | x when x < ' ' -> size <- size + 5L
            | _ -> ()
        size
    let rec private measureJ limit j =
        let mutable total = 0L
        let charge n =
            total <- total + n
            if total > limit then wireError "encoding" "remaining canonical byte allowance exceeded"
        match j with
        | N -> charge 4L
        | B true -> charge 4L
        | B false -> charge 5L
        | I n -> charge (int64 (n.ToString(CultureInfo.InvariantCulture).Length))
        | S s -> charge (stringSize limit s)
        | A xs ->
            charge 2L
            for i,x in Seq.indexed xs do
                if i > 0 then charge 1L
                charge (measureJ (limit-total) x)
        | O fields ->
            let seen = Collections.Generic.HashSet<string>(StringComparer.Ordinal)
            charge 2L
            for i,(k,v) in Seq.indexed fields do
                if not (seen.Add k) then wireError "keys" "duplicate canonical key"
                if k |> Seq.exists (fun c -> c > char 127) then wireError "keys" "ASCII object keys required"
                if i > 0 then charge 1L
                charge (stringSize (limit-total) k + 1L)
                charge (measureJ (limit-total) v)
        total
    let rec private writeJ (stream: Stream) j =
        let raw (s: string) = stream.Write(utf8.GetBytes s)
        match j with
        | N -> raw "null"
        | B true -> raw "true"
        | B false -> raw "false"
        | I n -> raw (n.ToString(CultureInfo.InvariantCulture))
        | S s -> stream.Write(stringBytes s)
        | A xs ->
            raw "["
            for i,x in Seq.indexed xs do
                if i > 0 then raw ","
                writeJ stream x
            raw "]"
        | O fields ->
            raw "{"
            for i,(k,v) in Seq.indexed (Seq.sortWith (fun (a,_) (b,_) -> ordinal a b) fields) do
                if i > 0 then raw ","
                stream.Write(stringBytes k)
                raw ":"
                writeJ stream v
            raw "}"
    let private encodeJ limit j =
        try
            if limit < 1 then wireError "encoding" "positive remaining byte allowance required"
            let size = measureJ (int64 limit) j
            use stream = new MemoryStream(int size)
            writeJ stream j
            if stream.Length <> size then wireError "encoding" "canonical byte preflight mismatch"
            Ok(stream.ToArray())
        with
        | WireFailure f -> Error f
        | ex -> Error(failure "Unexpected" "publish" None (ex.GetType().FullName + ": " + ex.Message))
    let private encodeSource limit makeTree =
        try
            if limit < 1 then wireError "encoding" "positive remaining allowance required before source traversal"
            encodeJ limit (makeTree ())
        with
        | WireFailure f -> Error f
        | ex -> Error(failure "Unexpected" "publish" None (ex.GetType().FullName + ": " + ex.Message))
    let private element j =
        match encodeJ (16*1024*1024) j with
        | Error f -> raise (WireFailure f)
        | Ok bytes ->
            use doc = JsonDocument.Parse bytes
            doc.RootElement.Clone()
    let rec private tree (value: JsonElement) =
        match value.ValueKind with
        | JsonValueKind.Null -> N
        | JsonValueKind.True -> B true
        | JsonValueKind.False -> B false
        | JsonValueKind.String -> S(text value)
        | JsonValueKind.Number -> I(integer value)
        | JsonValueKind.Array -> A (seq { for x in value.EnumerateArray() -> tree x })
        | JsonValueKind.Object -> O (seq { for p in value.EnumerateObject() -> p.Name,tree p.Value })
        | _ -> wireError "json" "undefined JSON value"
    let private strictDecode limit (raw: byte[]) decode =
        try
            if isNull raw || raw.Length = 0 || raw.Length > limit then
                wireError "bytes" "nonempty bounded exact raw input required"
            let utf8 = UTF8Encoding(false,true)
            utf8.GetCharCount(raw) |> ignore
            use doc = JsonDocument.Parse(ReadOnlyMemory<byte>(raw),JsonDocumentOptions(MaxDepth=64))
            // Duplicate detection and exact integral tokens throughout the core wire.
            measureJ (int64 limit) (tree doc.RootElement) |> ignore
            Ok(decode doc.RootElement)
        with
        | WireFailure f -> Error f
        | :? JsonException as ex -> error "json" ex.Message
        | :? DecoderFallbackException as ex -> error "utf8" ex.Message
        | ex -> Error(failure "Unexpected" "admit" None (ex.GetType().FullName + ": " + ex.Message))

    let private jFailure (f: Failure) = O ["Code",S f.Code;"Stage",S f.Stage;"Field",jOpt S f.Field;"Message",S f.Message]
    let private readFailure e : Failure =
        keys ["Code";"Stage";"Field";"Message"] e
        {Code=text (prop "Code" e);Stage=text (prop "Stage" e);Field=opt text (prop "Field" e);Message=text (prop "Message" e)}
    let private jResult f = function Ok x -> O ["Kind",S "Ok";"Value",f x] | Error e -> O ["Kind",S "Error";"Failure",jFailure e]
    let private jException (e: ExceptionObservation) = O ["Type",S e.Type;"Message",S e.Message]
    let private jGaussian (g: Gaussian) = O ["PrecisionMean",jBits g.PrecisionMean;"Precision",jBits g.Precision]
    let private readGaussian e : Gaussian =
        keys ["PrecisionMean";"Precision"] e
        {PrecisionMean=bits (prop "PrecisionMean" e);Precision=bits (prop "Precision" e)}
    let private jGamma (g: K.GammaKernel) = O ["LogPower",jBits g.LogPower;"Rate",jBits g.Rate]
    let private readGamma e : K.GammaKernel =
        keys ["LogPower";"Rate"] e
        {LogPower=bits (prop "LogPower" e);Rate=bits (prop "Rate" e)}
    let private jPreprocessing (p: L.Preprocessing) =
        O ["TrainingCut",S p.TrainingCut;"Count",jInt p.Count;"Means",A(Seq.map jBits p.Means);"Scales",A(Seq.map jBits p.Scales)]
    let private readPreprocessing e : L.Preprocessing =
        keys ["TrainingCut";"Count";"Means";"Scales"] e
        {TrainingCut=text (prop "TrainingCut" e);Count=intSmall (prop "Count" e)
         Means=arr 8 (prop "Means" e)|>List.map bits;Scales=arr 8 (prop "Scales" e)|>List.map bits}
    let private jArtifact (a: L.ModuleArtifact) =
        O ["Id",S a.Id;"ParentVersion",jOpt S a.ParentVersion;"TrainingCut",S a.TrainingCut
           "Architecture",S a.Architecture;"Ports",A(Seq.map S a.Ports);"Parameters",A(Seq.map jBits a.Parameters)
           "Preprocessing",jPreprocessing a.Preprocessing;"UpdateReceiptSha256",S a.UpdateReceiptSha256
           "SourceBindings",jMap S a.SourceBindings]
    let private readArtifact e : L.ModuleArtifact =
        keys ["Id";"ParentVersion";"TrainingCut";"Architecture";"Ports";"Parameters";"Preprocessing";"UpdateReceiptSha256";"SourceBindings"] e
        {Id=text (prop "Id" e);ParentVersion=opt text (prop "ParentVersion" e);TrainingCut=text (prop "TrainingCut" e)
         Architecture=text (prop "Architecture" e);Ports=arr 2 (prop "Ports" e)|>List.map text
         Parameters=arr 57 (prop "Parameters" e)|>List.map bits;Preprocessing=readPreprocessing (prop "Preprocessing" e)
         UpdateReceiptSha256=text (prop "UpdateReceiptSha256" e);SourceBindings=mapRead 1024 text (prop "SourceBindings" e)}
    let private jUse (u: ContributionUse) =
        O ["ContributionId",S u.ContributionId;"Role",S u.Role;"ProducerArtifact",jOpt S u.ProducerArtifact;"ProducerTrainingCut",jOpt S u.ProducerTrainingCut]
    let private readUse e : ContributionUse =
        keys ["ContributionId";"Role";"ProducerArtifact";"ProducerTrainingCut"] e
        {ContributionId=text (prop "ContributionId" e);Role=text (prop "Role" e);ProducerArtifact=opt text (prop "ProducerArtifact" e);ProducerTrainingCut=opt text (prop "ProducerTrainingCut" e)}
    let private rowFields (r: EvidenceRow) =
        ["Id",S r.Id;"Origin",I r.Origin;"FeatureAvailable",I r.FeatureAvailable;"TargetTime",I r.TargetTime
         "LabelAvailable",I r.LabelAvailable;"Split",S r.Split;"Features",A(Seq.map jBits r.Features)
         "Target",jOpt jBits r.Target;"Uses",A(Seq.map jUse r.Uses)]
    let private jRow r = O (("ContentSha256",S r.ContentSha256)::rowFields r)
    let private readRow e : EvidenceRow =
        keys ["Id";"ContentSha256";"Origin";"FeatureAvailable";"TargetTime";"LabelAvailable";"Split";"Features";"Target";"Uses"] e
        {Id=text (prop "Id" e);ContentSha256=text (prop "ContentSha256" e);Origin=integer (prop "Origin" e)
         FeatureAvailable=integer (prop "FeatureAvailable" e);TargetTime=integer (prop "TargetTime" e)
         LabelAvailable=integer (prop "LabelAvailable" e);Split=text (prop "Split" e)
         Features=arr 8 (prop "Features" e)|>List.map bits;Target=opt bits (prop "Target" e);Uses=arr 8 (prop "Uses" e)|>List.map readUse}
    let private jCut (c: EvidenceCut) =
        O ["Id",S c.Id;"Rows",A(Seq.map jRow c.Rows);"ActiveIds",A(Seq.map S c.ActiveIds)
           "PriorOwners",jMap S c.PriorOwners;"ParentCut",jOpt S c.ParentCut;"Retractions",A(Seq.map S c.Retractions)]
    let private readCut e : EvidenceCut =
        keys ["Id";"Rows";"ActiveIds";"PriorOwners";"ParentCut";"Retractions"] e
        {Id=text (prop "Id" e);Rows=arr 1024 (prop "Rows" e)|>List.map readRow;ActiveIds=arr 1024 (prop "ActiveIds" e)|>List.map text
         PriorOwners=mapRead 32 text (prop "PriorOwners" e);ParentCut=opt text (prop "ParentCut" e)
         Retractions=arr 1024 (prop "Retractions" e)|>List.map text}
    let private jPort (p: InputPort) = O ["SourceNode",S p.SourceNode;"SourcePort",S p.SourcePort;"TargetSlot",jInt p.TargetSlot]
    let private readPort e : InputPort =
        keys ["SourceNode";"SourcePort";"TargetSlot"] e
        {SourceNode=text (prop "SourceNode" e);SourcePort=text (prop "SourcePort" e);TargetSlot=intSmall (prop "TargetSlot" e)}
    let private jNode (n: Node) =
        let prior (p: Prior) = O ["Gaussian",jGaussian p.Gaussian;"Gammas",A (seq {for g in p.Gammas -> O ["Shape",jBits g.Shape;"Rate",jBits g.Rate]})]
        let unary (u: Unary) = O ["K",jBits u.K;"C",jBits u.C]
        let alias (a: OutputAlias) = O ["SourceNode",S a.SourceNode;"SourcePort",S a.SourcePort]
        O ["Id",S n.Id;"InstancePath",S n.InstancePath;"Kind",S n.Kind;"Inputs",A(Seq.map jPort n.Inputs)
           "Artifact",jOpt S n.Artifact;"Prior",jOpt prior n.Prior;"Unary",jOpt unary n.Unary
           "Children",jOpt (Seq.map S >> A) n.Children;"OutputAlias",jOpt alias n.OutputAlias]
    let private readNode e : Node =
        keys ["Id";"InstancePath";"Kind";"Inputs";"Artifact";"Prior";"Unary";"Children";"OutputAlias"] e
        let prior p : Prior =
            keys ["Gaussian";"Gammas"] p
            let gamma g : GammaPrior = keys ["Shape";"Rate"] g; {Shape=bits (prop "Shape" g);Rate=bits (prop "Rate" g)}
            {Gaussian=readGaussian (prop "Gaussian" p);Gammas=arr 2 (prop "Gammas" p)|>List.map gamma}
        let unary u : Unary = keys ["K";"C"] u; {K=bits (prop "K" u);C=bits (prop "C" u)}
        let alias a : OutputAlias = keys ["SourceNode";"SourcePort"] a; {SourceNode=text (prop "SourceNode" a);SourcePort=text (prop "SourcePort" a)}
        {Id=text (prop "Id" e);InstancePath=text (prop "InstancePath" e);Kind=text (prop "Kind" e)
         Inputs=arr 2 (prop "Inputs" e)|>List.map readPort;Artifact=opt text (prop "Artifact" e)
         Prior=opt prior (prop "Prior" e);Unary=opt unary (prop "Unary" e)
         Children=opt (arr 8 >> List.map text) (prop "Children" e);OutputAlias=opt alias (prop "OutputAlias" e)}
    let private jSiteKey (k: SiteKey) = O ["InstancePath",S k.InstancePath;"Factor",S k.Factor;"Port",S k.Port;"ContributionId",S k.ContributionId]
    let private readSiteKey e : SiteKey =
        keys ["InstancePath";"Factor";"Port";"ContributionId"] e
        {InstancePath=text (prop "InstancePath" e);Factor=text (prop "Factor" e);Port=text (prop "Port" e);ContributionId=text (prop "ContributionId" e)}
    let private jState (s: State) =
        let weight (w: Weight) = O ["BaseArtifactId",S w.BaseArtifactId;"VectorSha256",S w.VectorSha256;"Parameters",A(Seq.map jBits w.Parameters)]
        let output (o: Output) = O ["Mean",jBits o.Mean;"Variance",jOpt jBits o.Variance;"SourceSequence",jInt o.SourceSequence]
        let sites f m = A (seq {for KeyValue(k,v) in m -> O ["Key",jSiteKey k;"Value",f v]})
        O ["Revision",I s.Revision;"Weights",jMap weight s.Weights;"GaussianSites",sites jGaussian s.GaussianSites
           "GammaSites",sites jGamma s.GammaSites;"Outputs",jMap output s.Outputs;"ActiveCut",S s.ActiveCut]
    let private readState e : State =
        keys ["Revision";"Weights";"GaussianSites";"GammaSites";"Outputs";"ActiveCut"] e
        let weight w : Weight =
            keys ["BaseArtifactId";"VectorSha256";"Parameters"] w
            {BaseArtifactId=text (prop "BaseArtifactId" w);VectorSha256=text (prop "VectorSha256" w);Parameters=arr 57 (prop "Parameters" w)|>List.map bits}
        let output o : Output =
            keys ["Mean";"Variance";"SourceSequence"] o
            {Mean=bits (prop "Mean" o);Variance=opt bits (prop "Variance" o);SourceSequence=intSmall (prop "SourceSequence" o)}
        let sites read value =
            let rows = arr 64 value |> List.map(fun r -> keys ["Key";"Value"] r; readSiteKey (prop "Key" r),read (prop "Value" r))
            if not (unique(List.map fst rows)) || List.map fst rows <> List.sort(List.map fst rows) then
                wireError "Sites" "unique canonical site order required"
            Map.ofList rows
        {Revision=integer (prop "Revision" e);Weights=mapRead 4 weight (prop "Weights" e)
         GaussianSites=sites readGaussian (prop "GaussianSites" e);GammaSites=sites readGamma (prop "GammaSites" e)
         Outputs=mapRead 8 output (prop "Outputs" e);ActiveCut=text (prop "ActiveCut" e)}
    let private jForecast (f: ChildForecast) =
        O ["ArtifactId",S f.ArtifactId;"TrainingRowId",S f.TrainingRowId;"TargetSlot",jInt f.TargetSlot
           "BundleSha256",S f.BundleSha256;"QueryRowId",S f.QueryRowId;"ProducerNode",S f.ProducerNode
           "OutputPort",S f.OutputPort;"ProducerVersion",S f.ProducerVersion;"ProducerTrainingCut",jOpt S f.ProducerTrainingCut
           "ObservationSequence",jInt f.ObservationSequence;"CommitRevision",I f.CommitRevision;"Mean",jBits f.Mean]
    let private readForecast e : ChildForecast =
        keys ["ArtifactId";"TrainingRowId";"TargetSlot";"BundleSha256";"QueryRowId";"ProducerNode";"OutputPort";"ProducerVersion";"ProducerTrainingCut";"ObservationSequence";"CommitRevision";"Mean"] e
        {ArtifactId=text (prop "ArtifactId" e);TrainingRowId=text (prop "TrainingRowId" e);TargetSlot=intSmall (prop "TargetSlot" e)
         BundleSha256=text (prop "BundleSha256" e);QueryRowId=text (prop "QueryRowId" e);ProducerNode=text (prop "ProducerNode" e)
         OutputPort=text (prop "OutputPort" e);ProducerVersion=text (prop "ProducerVersion" e);ProducerTrainingCut=opt text (prop "ProducerTrainingCut" e)
         ObservationSequence=intSmall (prop "ObservationSequence" e);CommitRevision=integer (prop "CommitRevision" e);Mean=bits (prop "Mean" e)}
    let private jTraining (t: Training) =
        let a (r: TrainingArtifact) = O ["Id",S r.Id;"ParentVersion",jOpt S r.ParentVersion;"Ports",A(Seq.map S r.Ports)]
        O ["Artifacts",A(Seq.map a t.Artifacts);"RowIds",jMap (Seq.map S >> A) t.RowIds;"CutEnd",I t.CutEnd
           "ChildCuts",jMap jCut t.ChildCuts;"ChildForecasts",A(Seq.map jForecast t.ChildForecasts)]
    let private readTraining e : Training =
        keys ["Artifacts";"RowIds";"CutEnd";"ChildCuts";"ChildForecasts"] e
        let a x : TrainingArtifact =
            keys ["Id";"ParentVersion";"Ports"] x
            {Id=text (prop "Id" x);ParentVersion=opt text (prop "ParentVersion" x);Ports=arr 2 (prop "Ports" x)|>List.map text}
        {Artifacts=arr 4 (prop "Artifacts" e)|>List.map a;RowIds=mapRead 4 (arr 256 >> List.map text) (prop "RowIds" e)
         CutEnd=integer (prop "CutEnd" e);ChildCuts=mapRead 16 readCut (prop "ChildCuts" e)
         ChildForecasts=arr 2048 (prop "ChildForecasts" e)|>List.map readForecast}
    let private jCompensation (c: CompensationInputs) =
        O ["TargetRevision",I c.TargetRevision;"RetainedPlan",tree c.RetainedPlan
           "RetainedResult",tree c.RetainedResult;"Checkpoint",tree c.Checkpoint]
    let private jOperation = function
        | LearnStep(a,p,r) -> O ["Kind",S "LearnStep";"ArtifactId",S a;"Pass",jInt p;"RowId",S r]
        | NeuralForward(n,s) -> O ["Kind",S "NeuralForward";"NodeId",S n;"Sweep",jInt s]
        | GammaBlock(n,s) -> O ["Kind",S "GammaBlock";"NodeId",S n;"Sweep",jInt s]
        | GaussianBlock(n,s) -> O ["Kind",S "GaussianBlock";"NodeId",S n;"Sweep",jInt s]
        | Compensate c -> O ["Kind",S "Compensate";"Inputs",jCompensation c]
    let private readOperation e =
        match text (prop "Kind" e) with
        | "LearnStep" ->
            keys ["Kind";"ArtifactId";"Pass";"RowId"] e
            LearnStep(text (prop "ArtifactId" e),intSmall (prop "Pass" e),text (prop "RowId" e))
        | ("NeuralForward"|"GammaBlock"|"GaussianBlock") as k ->
            keys ["Kind";"NodeId";"Sweep"] e
            let n,s = text (prop "NodeId" e),intSmall (prop "Sweep" e)
            if k="NeuralForward" then NeuralForward(n,s) elif k="GammaBlock" then GammaBlock(n,s) else GaussianBlock(n,s)
        | "Compensate" ->
            keys ["Kind";"Inputs"] e
            let c = prop "Inputs" e
            keys ["TargetRevision";"RetainedPlan";"RetainedResult";"Checkpoint"] c
            Compensate {TargetRevision=integer (prop "TargetRevision" c);RetainedPlan=(prop "RetainedPlan" c).Clone()
                        RetainedResult=(prop "RetainedResult" c).Clone();Checkpoint=(prop "Checkpoint" c).Clone()}
        | _ -> wireError "Operation.Kind" "unknown fixed operation"
    let private jPlan (p: EpochPlan) =
        let selected (s: SelectedVersion) = O ["Version",S s.Version;"Artifact",jArtifact s.Artifact]
        O ["Id",S p.Id;"Mode",S p.Mode;"EvidenceCut",jCut p.EvidenceCut;"QueryRowId",jOpt S p.QueryRowId
           "Nodes",A(Seq.map jNode p.Nodes);"SelectedVersions",jMap selected p.SelectedVersions
           "InitialState",jState p.InitialState;"Operations",A(Seq.map jOperation p.Operations)
           "Sweeps",jInt p.Sweeps;"Damping",jBits p.Damping;"Training",jOpt jTraining p.Training
           "Horizon",jInt p.Horizon;"SourceBindings",jMap S p.SourceBindings]
    let private readPlan e : EpochPlan =
        keys ["Id";"Mode";"EvidenceCut";"QueryRowId";"Nodes";"SelectedVersions";"InitialState";"Operations";"Sweeps";"Damping";"Training";"Horizon";"SourceBindings"] e
        let selected s : SelectedVersion =
            keys ["Version";"Artifact"] s
            {Version=text (prop "Version" s);Artifact=readArtifact (prop "Artifact" s)}
        {Id=text (prop "Id" e);Mode=text (prop "Mode" e);EvidenceCut=readCut (prop "EvidenceCut" e)
         QueryRowId=opt text (prop "QueryRowId" e);Nodes=arr 8 (prop "Nodes" e)|>List.map readNode
         SelectedVersions=mapRead 4 selected (prop "SelectedVersions" e);InitialState=readState (prop "InitialState" e)
         Operations=arr 4096 (prop "Operations" e)|>List.map readOperation;Sweeps=intSmall (prop "Sweeps" e)
         Damping=bits (prop "Damping" e);Training=opt readTraining (prop "Training" e);Horizon=intSmall (prop "Horizon" e)
         SourceBindings=mapRead 1024 text (prop "SourceBindings" e)}

    let tryReadPlan raw = strictDecode (1024*1024) raw readPlan
    let tryEncodePlan plan = encodeSource (1024*1024) (fun () -> jPlan plan)
    let tryEncodeState state = encodeSource (1024*1024) (fun () -> jState state)
    let tryEncodeRow row = encodeSource 65536 (fun () -> jRow row)
    let tryRowContentHash row = encodeSource 65536 (fun () -> O(rowFields row)) |> Result.map hash
    let tryCutHash cut = encodeSource (1024*1024) (fun () -> jCut cut) |> Result.map hash
    let tryVectorHash parameters = encodeSource 65536 (fun () -> A(Seq.map jBits parameters)) |> Result.map hash

    let private jWork (w: Work) =
        O ["SchedulerEntered",jInt w.SchedulerEntered;"KernelEntered",jInt w.KernelEntered
           "ForwardEntered",jInt w.ForwardEntered;"LearnEntered",jInt w.LearnEntered
           "ProjectionRequested",jInt w.ProjectionRequested;"NativeLaunchAttempted",jInt w.NativeLaunchAttempted
           "CertificateEntered",jInt w.CertificateEntered;"NestedReferenceEntered",jInt w.NestedReferenceEntered
           "TrainingArtifacts",jInt w.TrainingArtifacts]
    let private readWork e : Work =
        keys ["SchedulerEntered";"KernelEntered";"ForwardEntered";"LearnEntered";"ProjectionRequested";"NativeLaunchAttempted";"CertificateEntered";"NestedReferenceEntered";"TrainingArtifacts"] e
        {SchedulerEntered=intSmall (prop "SchedulerEntered" e);KernelEntered=intSmall (prop "KernelEntered" e)
         ForwardEntered=intSmall (prop "ForwardEntered" e);LearnEntered=intSmall (prop "LearnEntered" e)
         ProjectionRequested=intSmall (prop "ProjectionRequested" e);NativeLaunchAttempted=intSmall (prop "NativeLaunchAttempted" e)
         CertificateEntered=intSmall (prop "CertificateEntered" e);NestedReferenceEntered=intSmall (prop "NestedReferenceEntered" e)
         TrainingArtifacts=intSmall (prop "TrainingArtifacts" e)}
    let private jSnapshot (b: BudgetSnapshot) =
        O ["SnapshotIndex",jInt b.SnapshotIndex;"CompletedSessions",jInt b.CompletedSessions;"PriorWork",jWork b.PriorWork
           "Store",O ["ReservedCombinedBytes",I b.Store.ReservedCombinedBytes;"ReservedArtifactSlots",jInt b.Store.ReservedArtifactSlots]
           "TranscriptBytes",I b.TranscriptBytes;"TranscriptFrames",jInt b.TranscriptFrames
           "PeerLaunchAttempted",jInt b.PeerLaunchAttempted;"NativePreparationEntered",jInt b.NativePreparationEntered
           "RemainingMilliseconds",jInt b.RemainingMilliseconds]
    let private readSnapshot e : BudgetSnapshot =
        keys ["SnapshotIndex";"CompletedSessions";"PriorWork";"Store";"TranscriptBytes";"TranscriptFrames";"PeerLaunchAttempted";"NativePreparationEntered";"RemainingMilliseconds"] e
        let s = prop "Store" e
        keys ["ReservedCombinedBytes";"ReservedArtifactSlots"] s
        {SnapshotIndex=intSmall (prop "SnapshotIndex" e);CompletedSessions=intSmall (prop "CompletedSessions" e)
         PriorWork=readWork (prop "PriorWork" e);Store={ReservedCombinedBytes=integer (prop "ReservedCombinedBytes" s);ReservedArtifactSlots=intSmall (prop "ReservedArtifactSlots" s)}
         TranscriptBytes=integer (prop "TranscriptBytes" e);TranscriptFrames=intSmall (prop "TranscriptFrames" e)
         PeerLaunchAttempted=intSmall (prop "PeerLaunchAttempted" e);NativePreparationEntered=intSmall (prop "NativePreparationEntered" e)
         RemainingMilliseconds=intSmall (prop "RemainingMilliseconds" e)}
    let private jRemaining (r: Remaining) =
        O ["Work",jWork r.Work;"Store",O ["CombinedBytes",I r.Store.CombinedBytes;"ArtifactSlots",jInt r.Store.ArtifactSlots]
           "TranscriptBytes",I r.TranscriptBytes;"TranscriptFrames",jInt r.TranscriptFrames
           "RemainingMilliseconds",jInt r.RemainingMilliseconds;"SnapshotIndex",jInt r.SnapshotIndex]
    let private jCount (c: CountObservation) = O ["Observed",jInt c.Observed;"Complete",B c.Complete]
    let private jCounters (c: Counters) =
        O ["SchedulerEntered",jInt c.SchedulerEntered;"KernelEntered",jInt c.KernelEntered
           "ForwardEntered",jInt c.ForwardEntered;"LearnEntered",jInt c.LearnEntered;"Returned",jInt c.Returned
           "Proposed",jInt c.Proposed;"Certified",jInt c.Certified;"Applied",jInt c.Applied
           "ProjectionRequested",jInt c.ProjectionRequested;"ProtocolBytes",I c.ProtocolBytes
           "ReservedBytes",I c.ReservedBytes;"ArtifactSlots",jInt c.ArtifactSlots
           "Remote",O ["NativeCallEntered",jCount c.Remote.NativeCallEntered;"NativeLaunchAttempted",jCount c.Remote.NativeLaunchAttempted
                       "NativeReturned",jCount c.Remote.NativeReturned;"CertificateEntered",jCount c.Remote.CertificateEntered
                       "CertificateReturned",jCount c.Remote.CertificateReturned;"NestedReferenceEntered",jCount c.Remote.NestedReferenceEntered]]
    let private jTarget (t: K.ProjectionTarget) = O ["T",jBits t.Precision;"U",jBits t.Location;"K",jBits t.Linear;"C",jBits t.ExponentialRate]
    let private jRequest (r: ProjectionRequest) =
        O ["Sequence",jInt r.Sequence;"RequestId",S r.RequestId;"InputRevision",I r.InputRevision
           "Base",jGaussian r.Base;"TargetBits",jTarget r.TargetBits;"RawInputHex",S r.RawInputHex
           "InputSha256",S r.InputSha256;"CaseId",S r.CaseId;"BindingsSha256",S r.BindingsSha256;"Remaining",jRemaining r.Remaining]
    let private jResponse (r: ProjectionResponse) =
        O ["Sequence",jInt r.Sequence;"RequestId",S r.RequestId;"InputSha256",S r.InputSha256
           "BindingsSha256",S r.BindingsSha256;"ServiceSha256",S r.ServiceSha256
           "Native",jOpt tree r.Native;"Certificate",jOpt tree r.Certificate
           "Failure",jOpt jFailure r.Failure;"BudgetSnapshot",jSnapshot r.BudgetSnapshot]
    let private readResponse e : ProjectionResponse =
        keys ["Sequence";"RequestId";"InputSha256";"BindingsSha256";"ServiceSha256";"Native";"Certificate";"Failure";"BudgetSnapshot"] e
        {Sequence=intSmall (prop "Sequence" e);RequestId=text (prop "RequestId" e);InputSha256=text (prop "InputSha256" e)
         BindingsSha256=text (prop "BindingsSha256" e);ServiceSha256=text (prop "ServiceSha256" e)
         Native=opt (fun (x:JsonElement)->x.Clone()) (prop "Native" e);Certificate=opt (fun (x:JsonElement)->x.Clone()) (prop "Certificate" e)
         Failure=opt readFailure (prop "Failure" e);BudgetSnapshot=readSnapshot (prop "BudgetSnapshot" e)}
    let private jDescriptor (a: Artifact) =
        O ["File",S a.File;"Encoding",S a.Encoding;"Bytes",I a.Bytes;"Sha256",S a.Sha256
           "StoredBytes",I a.StoredBytes;"StoredSha256",S a.StoredSha256]
    let private readDescriptor e : Artifact =
        keys ["File";"Encoding";"Bytes";"Sha256";"StoredBytes";"StoredSha256"] e
        {File=text (prop "File" e);Encoding=text (prop "Encoding" e);Bytes=integer (prop "Bytes" e);Sha256=text (prop "Sha256" e)
         StoredBytes=integer (prop "StoredBytes" e);StoredSha256=text (prop "StoredSha256" e)}
    let private jStored (s: StoredCheckpoint) =
        O ["Sequence",jInt s.Sequence;"CheckpointSha256",S s.CheckpointSha256;"Artifact",jDescriptor s.Artifact;"BudgetSnapshot",jSnapshot s.BudgetSnapshot]
    let private readStored e : StoredCheckpoint =
        keys ["Sequence";"CheckpointSha256";"Artifact";"BudgetSnapshot"] e
        {Sequence=intSmall (prop "Sequence" e);CheckpointSha256=text (prop "CheckpointSha256" e)
         Artifact=readDescriptor (prop "Artifact" e);BudgetSnapshot=readSnapshot (prop "BudgetSnapshot" e)}
    let private jProposal (p: Proposal) =
        O ["ExpectedRevision",I p.ExpectedRevision;"ExpectedStateSha256",S p.ExpectedStateSha256
           "State",jState p.State;"Details",tree p.Details]
    let private sourceReturn name fields = O ["Type",S name;"Fields",fields]
    let private jForwardInput (i: L.ForwardInput) = O ["Parameters",A(Seq.map jBits i.Parameters);"Inputs",A(Seq.map jBits i.Inputs)]
    let private jForward (a: L.ForwardAttempt) =
        sourceReturn "Zeta.Bayesian.BoundedModuleLearner+ForwardAttempt"
            (O ["Input",(if present a.Input then jForwardInput a.Input else N);"Preactivations",A(Seq.map jBits a.Preactivations)
                "Hidden",A(Seq.map jBits a.Hidden);"Outcome",jResult jBits a.Outcome])
    let private jStep (a: L.StepAttempt) =
        let input (i:L.StepInput) = O ["Parameters",A(Seq.map jBits i.Parameters);"Inputs",A(Seq.map jBits i.Inputs);"Target",jBits i.Target]
        sourceReturn "Zeta.Bayesian.BoundedModuleLearner+StepAttempt"
            (O ["Input",(if present a.Input then input a.Input else N);"Forward",jOpt jForward a.Forward
                "Loss",jOpt jBits a.Loss;"Gradient",A(Seq.map jBits a.Gradient);"ProposedParameters",A(Seq.map jBits a.ProposedParameters)
                "Outcome",jResult (fun () -> N) a.Outcome])
    let private jKernelError = function
        | K.InvalidInput(field,requirement) -> O ["Kind",S "InvalidInput";"Field",S field;"Requirement",S requirement]
        | K.NumericalFailure(operation,reason) -> O ["Kind",S "NumericalFailure";"Operation",S operation;"Reason",S reason]
        | K.ImproperBelief family -> O ["Kind",S "ImproperBelief";"Family",S family]
    let private jKernelResult f = function
        | Ok value -> O ["Kind",S "Ok";"Value",f value]
        | Error error -> O ["Kind",S "Error";"Failure",jKernelError error]
    let private jPreprocessingAttempt (a:L.PreprocessingAttempt) =
        sourceReturn "Zeta.Bayesian.BoundedModuleLearner+PreprocessingAttempt"
            (O ["TrainingCut",S a.TrainingCut;"Rows",A (seq {for row in a.Rows -> A(Seq.map jBits row)})
                "Means",A(Seq.map jBits a.Means);"Variances",A(Seq.map jBits a.Variances)
                "Scales",A(Seq.map jBits a.Scales);"Outcome",jResult jPreprocessing a.Outcome])
    let private jTransformAttempt (a:L.TransformAttempt) =
        sourceReturn "Zeta.Bayesian.BoundedModuleLearner+TransformAttempt"
            (O ["Preprocessing",jPreprocessing a.Preprocessing;"Row",A(Seq.map jBits a.Row)
                "Values",A(Seq.map jBits a.Values);"Outcome",jResult (fun () -> N) a.Outcome])
    let private jTransportFailure (t:TransportFailure) =
        O ["Failure",jFailure t.Failure;"Received",jOpt tree t.Received;"RawSha256",jOpt S t.RawSha256
           "ReceivedBytes",I t.ReceivedBytes;"Exception",jOpt jException t.Exception]
    let rec private jBlock (a: BlockAttempt) =
        sourceReturn "Zeta.Bayesian.MixedMessageEpoch+BlockAttempt"
            (O ["Inputs",tree a.Inputs;"Calls",A (seq {for c in a.Calls -> O ["Operation",S c.Operation;"Inputs",tree c.Inputs;"Call",jCall c.Call]});"Proposal",jOpt jProposal a.Proposal;"Outcome",jResult (fun () -> N) a.Outcome])

    and private jReturned (value: obj) =
        match value with
        | :? L.ForwardAttempt as a -> jForward a
        | :? L.StepAttempt as a -> jStep a
        | :? L.PreprocessingAttempt as a -> jPreprocessingAttempt a
        | :? L.TransformAttempt as a -> jTransformAttempt a
        | :? BlockAttempt as a -> jBlock a
        | :? Result<StoredCheckpoint,Failure> as a -> jResult jStored a
        | :? Result<unit,Failure> as a -> jResult (fun () -> N) a
        | :? Result<BudgetSnapshot,Failure> as a -> jResult jSnapshot a
        | :? Result<ProjectionResponse,TransportFailure> as a ->
            match a with Ok v -> O ["Kind",S "Ok";"Value",jResponse v] | Error f -> O ["Kind",S "Error";"Failure",jTransportFailure f]
        | :? Result<Gaussian,K.KernelError> as a -> jKernelResult jGaussian a
        | :? Result<K.GammaKernel,K.KernelError> as a -> jKernelResult jGamma a
        | :? Result<K.RealMoments,K.KernelError> as a -> jKernelResult (fun (m:K.RealMoments) -> O ["Mean",jBits m.Mean;"Variance",jBits m.Variance]) a
        | :? Result<K.GammaEncoding,K.KernelError> as a ->
            jKernelResult (fun (g:K.GammaEncoding) -> O ["RequestedShape",jBits g.RequestedShape;"RepresentedShape",jBits g.RepresentedShape;"Kernel",jGamma g.Kernel]) a
        | :? Result<K.GammaMoments,K.KernelError> as a ->
            jKernelResult (fun (g:K.GammaMoments) -> O ["RepresentedShape",jBits g.RepresentedShape;"Rate",jBits g.Rate;"Mean",jBits g.Mean;"Variance",jBits g.Variance]) a
        | :? Result<K.NormalPrecisionMessages,K.KernelError> as a ->
            jKernelResult (fun (m:K.NormalPrecisionMessages) -> O ["ResidualSecondMoment",jBits m.ResidualSecondMoment;"ToY",jGaussian m.ToY;"ToMean",jGaussian m.ToMean;"ToPrecision",jGamma m.ToPrecision]) a
        | _ -> wireError "Call.Returned" "actual result type is outside the closed source encoder catalog"
    and private jCall = function
        | NotEntered -> O ["Kind",S "NotEntered"]
        | Returned value -> O ["Kind",S "Returned";"Result",jReturned value.Value]
        | Raised ex -> O ["Kind",S "Raised";"Exception",jException ex]
    and private jInputs = function
        | RawInputs value -> tree value
        | LearningInputs value ->
            let request (r:TrainingArtifact) = O ["Id",S r.Id;"ParentVersion",jOpt S r.ParentVersion;"Ports",A(Seq.map S r.Ports)]
            let entry (e:ArtifactEntry) = O ["Request",request e.Request;"Preprocessing",jCall e.Preprocessing]
            O ["Kind",S "LearnStep";"ArtifactId",S value.ArtifactId;"Pass",jInt value.Pass;"RowId",S value.RowId
               "Row",jRow value.Row;"OldVector",A(Seq.map jBits value.OldVector);"Inputs",A(Seq.map jBits value.Inputs)
               "Target",jBits value.Target;"ArtifactEntry",jOpt entry value.ArtifactEntry;"Transform",jCall value.Transform]
        | ForwardingInputs value ->
            O ["Kind",S "NeuralForward";"NodeId",S value.NodeId;"RowId",S value.RowId
               "ArtifactVersion",S value.ArtifactVersion;"Transform",jCall value.Transform;"Inputs",A(Seq.map jBits value.Inputs)]
    let private returned value = Returned {Value=box value}
    /// Read-only access to an already retained actual value; no decoder uses it
    /// to select a type, source implementation, or executable operation.
    let tryReturnedValue = function Returned actual -> Some actual.Value | _ -> None
    let private jObservation (o: Observation) =
        O ["Sequence",jInt o.Sequence;"Operation",jOperation o.Operation;"InputRevision",I o.InputRevision
           "Inputs",jInputs o.Inputs;"Call",jCall o.Call;"Proposal",jOpt jProposal o.Proposal
           "Admission",jOpt (jResult (fun () -> N)) o.Admission
           "AppliedRevision",jOpt I o.AppliedRevision;"Failure",jOpt jFailure o.Failure]
    let private jCheckpoint (c: Checkpoint) =
        O ["Sequence",jInt c.Sequence;"Observation",jObservation c.Observation;"LastRevision",I c.LastRevision;"StateSha256",S c.StateSha256]
    let private jCommit (c: Commit) =
        O ["Sequence",jInt c.Sequence;"CheckpointSha256",S c.CheckpointSha256;"AppliedRevision",I c.AppliedRevision
           "LastCommitted",jState c.LastCommitted;"Counters",jCounters c.Counters]
    let private jScheduler = function
        | SchedulerRaised ex -> O ["Kind",S "Raised";"Exception",jException ex]
        | SchedulerReturned value ->
            let feedback = function
                | Failed message -> O ["Kind",S "Failed";"Message",S message]
                | Interrupted kind -> O ["Kind",S "Interrupted";"Interrupt",S(string kind)]
            let result = match value with Ok i -> O ["Kind",S "Ok";"Value",jInt i] | Error f -> O ["Kind",S "Error";"Failure",feedback f]
            O ["Kind",S "Returned";"Result",result]
    let private jPublication (p: Publication) =
        O ["Recorder",A (seq {for r in p.Recorder -> O ["Kind",S r.Kind;"Sequence",jOpt jInt r.Sequence;"Call",jCall r.Call]})
           "Unpublished",A(Seq.map jInt p.Unpublished);"Failure",jOpt jFailure p.Failure;"BudgetSnapshot",jSnapshot p.BudgetSnapshot]
    let private jEpoch (r: EpochResult) =
        O ["PlanSha256",S r.PlanSha256;"Outcome",S r.Outcome;"Termination",S r.Termination
           "Failure",jOpt jFailure r.Failure;"LastCommitted",jState r.LastCommitted
           "ProposedArtifacts",A(Seq.map jArtifact r.ProposedArtifacts);"Observations",A(Seq.map jObservation r.Observations)
           "Counters",jCounters r.Counters;"PendingRequest",jOpt jRequest r.PendingRequest
           "Scheduler",jScheduler r.Scheduler;"Publication",jPublication r.Publication]
    let private jTerminalPublication (p: TerminalPublication) =
        let reference (r: EpochReturnReference) = O ["Sequence",jInt r.Sequence;"ResultSha256",S r.ResultSha256;"FrameSha256",S r.FrameSha256;"Artifact",jDescriptor r.Artifact]
        let partial (w: PartialWrite) = O ["Sequence",jOpt jInt w.Sequence;"ReservedBytes",I w.ReservedBytes;"ObservedWrittenBytes",jOpt I w.ObservedWrittenBytes]
        let t = p.Peer
        O ["EpochReturn",jOpt reference p.EpochReturn;"ResultRetention",S p.ResultRetention;"Failure",jOpt jFailure p.Failure
           "Transport",O ["Coordinator",jOpt jSnapshot p.Coordinator
                          "Peer",O ["IncomingBytes",I t.IncomingBytes;"IncomingFrames",jInt t.IncomingFrames
                                    "OutgoingReservedBytes",I t.OutgoingReservedBytes;"OutgoingReservedFrames",jInt t.OutgoingReservedFrames
                                    "OutgoingCompletedBytes",I t.OutgoingCompletedBytes;"OutgoingCompletedFrames",jInt t.OutgoingCompletedFrames
                                    "PartialWrite",jOpt partial t.PartialWrite]]]
    let tryDecodeBudgetSnapshot raw = strictDecode 65536 raw readSnapshot
    let tryDecodeStoredCheckpoint raw = strictDecode 65536 raw readStored
    let tryDecodeProjectionResponse raw = strictDecode (12*1024*1024) raw readResponse
    let tryEncodeBudgetSnapshot snapshot = encodeSource 65536 (fun () -> jSnapshot snapshot)
    let tryEncodeProjectionRequest request = encodeSource (256*1024) (fun () -> jRequest request)
    let tryEncodeProjectionResponse response = encodeSource (12*1024*1024) (fun () -> jResponse response)
    let tryEncodeObservation observation remainingBytes = encodeSource (min remainingBytes (16*1024*1024)) (fun () -> jObservation observation)
    let tryEncodeCheckpoint checkpoint remainingBytes = encodeSource (min remainingBytes (16*1024*1024)) (fun () -> jCheckpoint checkpoint)
    let tryEncodeCommit commit remainingBytes = encodeSource (min remainingBytes 65536) (fun () -> jCommit commit)
    let tryEncode result remainingBytes =
        try
            match encodeSource (min remainingBytes (16*1024*1024)) (fun () -> jEpoch result) with
            | Ok bytes -> Ok bytes
            | Error f -> Error {Failure=f;Result=result}
        with ex -> Error {Failure=failure "Unexpected" "publish" None ex.Message;Result=result}
    let tryEncodeTerminal (result: EpochResult) publication remainingBytes =
        try
            flow {
                if remainingBytes <= 0 then
                    return! error "encoding" "positive output allowance required before source traversal"
                let! ledger = encodeSource (16*1024*1024) (fun () -> A(Seq.map jObservation result.Observations))
                return! encodeSource (min remainingBytes (1024*1024)) (fun () ->
                    O ["Outcome",S result.Outcome;"Termination",S result.Termination;"Failure",jOpt jFailure result.Failure
                       "Counters",jCounters result.Counters;"LastCommitted",jState result.LastCommitted
                       "LedgerCount",jInt result.Observations.Length;"LedgerSha256",S(hash ledger)
                       "PendingRequest",jOpt jRequest result.PendingRequest;"Publication",jTerminalPublication publication])
            }
        with
        | WireFailure f -> Error f
        | ex -> Error(failure "Unexpected" "publish" None ex.Message)

    /// Canonical source-fixed tree check for peer framing/golden controls. Passive
    /// integer-only JSON has no authority to construct a CLR type or operation.
    let tryCanonicalPayload raw remainingBytes =
        flow {
            let! parsed = strictDecode remainingBytes raw (fun e -> e.Clone())
            return! encodeSource remainingBytes (fun () -> tree parsed)
        }

    let workLimits : Work =
        { SchedulerEntered=4096;KernelEntered=256;ForwardEntered=4096;LearnEntered=2048
          ProjectionRequested=32;NativeLaunchAttempted=32;CertificateEntered=32
          NestedReferenceEntered=32;TrainingArtifacts=4 }
    let zeroWork : Work =
        {SchedulerEntered=0;KernelEntered=0;ForwardEntered=0;LearnEntered=0;ProjectionRequested=0
         NativeLaunchAttempted=0;CertificateEntered=0;NestedReferenceEntered=0;TrainingArtifacts=0}
    let private workValues (w:Work) =
        [w.SchedulerEntered;w.KernelEntered;w.ForwardEntered;w.LearnEntered;w.ProjectionRequested
         w.NativeLaunchAttempted;w.CertificateEntered;w.NestedReferenceEntered;w.TrainingArtifacts]
    let private validateSnapshot (s: BudgetSnapshot) =
        if not (present s) || not (present s.PriorWork) || not (present s.Store) then error "BudgetSnapshot" "complete snapshot required"
        elif s.SnapshotIndex < 1 || s.CompletedSessions < 0 || s.CompletedSessions > 3
             || s.Store.ReservedCombinedBytes < 0L || s.Store.ReservedCombinedBytes > 268435456L
             || s.Store.ReservedArtifactSlots < 0 || s.Store.ReservedArtifactSlots > 4096
             || s.TranscriptBytes < 0L || s.TranscriptBytes > 67108864L
             || s.TranscriptFrames < 0 || s.TranscriptFrames > 16384
             || s.PeerLaunchAttempted < 1 || s.PeerLaunchAttempted > 4
             || s.NativePreparationEntered < 0 || s.NativePreparationEntered > 1
             || s.RemainingMilliseconds < 0 || s.RemainingMilliseconds > 300000
             || not (List.forall2 (fun value cap -> value >= 0 && value <= cap) (workValues s.PriorWork) (workValues workLimits)) then
            error "BudgetSnapshot" "fixed global bounds violated"
        else Ok()
    let private validateSnapshotAdvance (old: BudgetSnapshot) (next: BudgetSnapshot) allowSame =
        flow {
            do! validateSnapshot next
            if next.SnapshotIndex = old.SnapshotIndex && allowSame then
                if next <> old then return! error "BudgetSnapshot" "same index changed content"
            elif next.SnapshotIndex <= old.SnapshotIndex then
                return! error "BudgetSnapshot" "new received snapshot index must advance"
            if next.CompletedSessions <> old.CompletedSessions || next.PriorWork <> old.PriorWork
               || next.Store.ReservedCombinedBytes < old.Store.ReservedCombinedBytes
               || next.Store.ReservedArtifactSlots < old.Store.ReservedArtifactSlots
               || next.TranscriptBytes < old.TranscriptBytes || next.TranscriptFrames < old.TranscriptFrames
               || next.PeerLaunchAttempted <> old.PeerLaunchAttempted
               || next.NativePreparationEntered <> old.NativePreparationEntered
               || next.RemainingMilliseconds > old.RemainingMilliseconds then
                return! error "BudgetSnapshot" "snapshot reversed reservations, extended time or changed prior-session work"
        }
    let private bindingsValid (m: Map<string,string>) =
        present m && m.Count > 0 && m.Count <= 1024
        && (m |> Map.forall (fun key value -> key.Length > 0 && key.Length <= 256 && (key |> Seq.forall (fun c -> c >= ' ' && c <= '~')) && L.isHash value))
    let tryVariableId instancePath role =
        if not (L.isId instancePath) || not (List.contains role ["z";"gamma/0";"gamma/1"]) then
            error "Variable" "source-fixed instance and variable role required"
        else encodeSource 1024 (fun () -> O ["Kind",S "mixed-epoch-variable-v1";"InstancePath",S instancePath;"Role",S role]) |> Result.map hash
    let tryContributionId instancePath factor =
        if not (L.isId instancePath) || not (List.contains factor ["normal/0";"normal/1";"unary"]) then
            error "Factor" "source-fixed instance and factor role required"
        else encodeSource 1024 (fun () -> O ["Kind",S "mixed-epoch-factor-v1";"InstancePath",S instancePath;"Factor",S factor]) |> Result.map hash
    let private getOrRaise = function Ok x -> x | Error f -> raise (WireFailure f)
    let private variable (n: Node) role = tryVariableId n.InstancePath role |> getOrRaise
    let private contribution (n: Node) factor = tryContributionId n.InstancePath factor |> getOrRaise
    let private site (n: Node) factor port =
        {InstancePath=n.InstancePath;Factor=factor;Port=port;ContributionId=contribution n factor}
    let private finiteGaussian (g: Gaussian) = finite g.PrecisionMean && finite g.Precision
    let private properGaussian (g:Gaussian) =
        finiteGaussian g && g.Precision > 0.0 && finite (1.0/g.Precision)
        && 1.0/g.Precision > 0.0 && finite (g.PrecisionMean/g.Precision)
    let private properGammaPrior (g: GammaPrior) =
        finite g.Shape && finite g.Rate && g.Shape > 0.0 && g.Rate > 0.0
        && (g.Shape-1.0)+1.0 > 0.0
    let private validateCut (c: EvidenceCut) =
        flow {
            if not (L.isId c.Id) || not (bounded 1024 c.Rows) || not (bounded 1024 c.ActiveIds)
               || not (bounded 1024 c.Retractions) || c.PriorOwners.Count > 32
               || not (unique(List.map (fun (r:EvidenceRow) -> r.Id) c.Rows)) || not (unique c.ActiveIds)
               || not (unique c.Retractions) || not (unique(c.PriorOwners |> Map.toList |> List.map snd)) then
                return! error "EvidenceCut" "bounded unique rows, active IDs and prior ownership required"
            let rowIds = Set.ofList(List.map (fun (r:EvidenceRow) -> r.Id) c.Rows)
            if c.ActiveIds |> List.exists (fun id -> not (Set.contains id rowIds)) then
                return! error "ActiveIds" "active row must be supplied"
            if c.Retractions |> List.exists (fun id -> Set.contains id (Set.ofList c.ActiveIds)) then
                return! error "Retractions" "withdrawn IDs cannot remain active"
            if c.ParentCut |> Option.exists (L.isHash >> not) then return! error "ParentCut" "hash required"
            for KeyValue(k,v) in c.PriorOwners do
                if not (L.isHash k) || not (L.isId v) then return! error "PriorOwners" "derived variable hash and contribution ID required"
            let mutable contributions = Map.empty
            for r in c.Rows do
                if not (L.isId r.Id) || not (L.isHash r.ContentSha256) || r.Origin < 0L || r.FeatureAvailable < 0L
                   || r.TargetTime < 0L || r.LabelAvailable < 0L || r.Features.Length <> 8
                   || not (List.forall finite r.Features) || not (bounded 8 r.Uses)
                   || not (List.contains r.Split ["train";"validation";"test";"control"])
                   || (r.Target |> Option.exists (finite >> not)) then
                    return! error "EvidenceRow" "invalid exact finite row"
                let! actual = tryRowContentHash r
                if actual <> r.ContentSha256 then return! error "ContentSha256" "immutable row content changed"
                for u in r.Uses do
                    if not (L.isId u.ContributionId) || not (List.contains u.Role ["observation";"prior";"forecast"])
                       || (u.ProducerArtifact |> Option.exists (L.isHash >> not))
                       || (u.ProducerTrainingCut |> Option.exists (L.isHash >> not)) then
                        return! error "Uses" "invalid contribution lineage"
                    let! encoded = encodeSource 4096 (fun () -> jUse u)
                    let identity = hash encoded
                    match Map.tryFind u.ContributionId contributions with
                    | Some old when old <> identity -> return! Error(failure "Conflict" "admit" (Some u.ContributionId) "same contribution ID has different lineage")
                    | _ -> contributions <- Map.add u.ContributionId identity contributions
        }
    let private canonicalEqual f a b =
        flow {
            let! aa = encodeSource (1024*1024) (fun () -> f a)
            let! bb = encodeSource (1024*1024) (fun () -> f b)
            return aa.AsSpan().SequenceEqual(bb.AsSpan())
        }
    let private validateForecastBinding (f: ChildForecast) =
        if not (List.forall L.isId [f.ArtifactId;f.TrainingRowId;f.QueryRowId;f.ProducerNode])
           || f.OutputPort <> "mean" || f.TargetSlot < 0 || f.TargetSlot > 1
           || not (L.isHash f.BundleSha256 && L.isHash f.ProducerVersion)
           || (f.ProducerTrainingCut |> Option.exists (L.isHash >> not))
           || f.ObservationSequence < 1 || f.CommitRevision < 1L || not (finite f.Mean) || abs f.Mean > 64.0 then
            error "ChildForecast" "invalid compact source-admitted binding"
        else Ok()
    /// The caller has admitted complete retained bundles and actual closed query
    /// sessions. This constructor checks compact bytes only; it cannot prove that premise.
    let tryAdmitCoordinatorForecasts (bindings: ChildForecast list) =
        try
            flow {
                if not (bounded 2048 bindings) then return! error "Forecasts" "bounded compact roster required"
                if not (unique(List.map (fun (f:ChildForecast) -> f.ArtifactId,f.TrainingRowId,f.TargetSlot) bindings)) then
                    return! error "Forecasts" "duplicate artifact/row/slot binding"
                for f in bindings do do! validateForecastBinding f
                return List.map (fun f -> {Binding=f}) bindings
            }
        with ex -> Error(failure "Unexpected" "admit" None ex.Message)
    let private topology (nodes: Node list) =
        flow {
            if nodes.Length > 8 || not (unique(List.map (fun (n:Node) -> n.Id) nodes))
               || not (unique(List.map (fun (n:Node) -> n.InstancePath) nodes)) then
                return! error "Nodes" "unique nodes/instances within eight required"
            let byId = nodes |> List.map (fun (n:Node) -> n.Id,n) |> Map.ofList
            let mutable resolved = Map.empty
            let rec resolve path depth id =
                if depth > 3 || Set.contains id path || not (Map.containsKey id byId) then wireError "Nodes" "cycle, unknown child or depth excess"
                let n = byId[id]
                if n.Kind = "composite" then
                    let alias = Option.get n.OutputAlias
                    resolve (Set.add id path) (depth+1) alias.SourceNode
                else id
            for n in nodes do
                if not (L.isId n.Id && L.isId n.InstancePath) || not (bounded 2 n.Inputs)
                   || not (unique(List.map (fun (p:InputPort) -> p.TargetSlot) n.Inputs)) then
                    return! error "Node" "bounded IDs and unique input slots required"
                for input in n.Inputs do
                    if input.SourcePort <> "mean" || input.TargetSlot < 0 || input.TargetSlot > 1 || not (Map.containsKey input.SourceNode byId) then
                        return! error "Inputs" "unknown source or port"
                match n.Kind with
                | "neural" when n.Artifact.IsSome && n.Prior.IsNone && n.Unary.IsNone && n.Children.IsNone && n.OutputAlias.IsNone -> ()
                | "precision-gate" when n.Artifact.IsNone && n.Prior.IsSome && n.Unary.IsSome && n.Children.IsNone && n.OutputAlias.IsNone ->
                    let p,u = Option.get n.Prior, Option.get n.Unary
                    if p.Gammas.Length <> n.Inputs.Length || not (properGaussian p.Gaussian)
                       || not (List.forall properGammaPrior p.Gammas) || not (finite u.K && finite u.C && u.C > 0.0) then
                        return! error "Prior" "proper priors and ordered input/Gamma pairing required"
                | "composite" when n.Artifact.IsNone && n.Prior.IsNone && n.Unary.IsNone && n.Inputs.IsEmpty && n.Children.IsSome && n.OutputAlias.IsSome ->
                    let children, alias = Option.get n.Children, Option.get n.OutputAlias
                    if children.IsEmpty || children.Length > 8 || not (unique children) || alias.SourcePort <> "mean"
                       || not (List.contains alias.SourceNode children) || children |> List.exists (fun id -> not (Map.containsKey id byId)) then
                        return! error "OutputAlias" "one exact declared child mean alias required"
                | _ -> return! error "Node.Kind" "unknown kind or non-null unused fields"
            for n in nodes do resolved <- Map.add n.Id (resolve Set.empty 1 n.Id) resolved
            let rec childDepth seen depth id =
                if depth > 3 || Set.contains id seen then wireError "Children" "composite containment cycle or depth excess"
                let n = byId[id]
                for child in Option.defaultValue [] n.Children do childDepth (Set.add id seen) (depth+1) child
            for n in nodes do childDepth Set.empty 1 n.Id
            let computational = nodes |> List.filter (fun n -> n.Kind <> "composite")
            if (computational |> List.filter (fun n -> n.Kind="neural") |> List.length) > 4
               || (computational |> List.filter (fun n -> n.Kind="precision-gate") |> List.length) > 4 then
                return! error "Nodes" "four neural/four precision bounds exceeded"
            let mutable pending = computational |> List.sortWith (fun (a:Node) (b:Node) -> ordinal a.Id b.Id)
            let mutable ordered = []
            while not pending.IsEmpty do
                let doneIds = Set.ofList(List.map (fun (n:Node) -> n.Id) ordered)
                let ready = pending |> List.tryFind (fun n -> n.Inputs |> List.forall (fun p -> Set.contains resolved[p.SourceNode] doneIds))
                match ready with
                | None -> wireError "Nodes" "data dependency cycle"
                | Some n -> ordered <- ordered @ [n]; pending <- pending |> List.filter (fun p -> p.Id <> n.Id)
            return resolved,ordered
        }
    let private queryOperations sweeps (ordered: Node list) =
        [for sweep in 0 .. sweeps-1 do
             for n in ordered do
                 if n.Kind="neural" then yield NeuralForward(n.Id,sweep)
                 else
                     if not n.Inputs.IsEmpty then yield GammaBlock(n.Id,sweep)
                     yield GaussianBlock(n.Id,sweep)]
    let private trainOperations (t: Training) =
        [for a in t.Artifacts do for pass in 0 .. 1 do for row in t.RowIds[a.Id] -> LearnStep(a.Id,pass,row)]
    let private validateTraining (plan: EpochPlan) (ctx: AdmissionContext) (training: Training) =
        flow {
            let requests = training.Artifacts
            if requests.IsEmpty || requests.Length > 4 || not (unique(List.map (fun (r:TrainingArtifact) -> r.Id) requests))
               || List.map (fun (r:TrainingArtifact) -> r.Id) requests <> List.sortWith ordinal (List.map (fun (r:TrainingArtifact) -> r.Id) requests)
               || (training.RowIds |> Map.toList |> List.map fst) <> List.map (fun (r:TrainingArtifact) -> r.Id) requests
               || training.CutEnd < 0L then return! error "Training" "exact bounded ordinal artifact/row roster required"
            let! cutHash = tryCutHash plan.EvidenceCut
            let rows = plan.EvidenceCut.Rows |> List.map (fun (r:EvidenceRow) -> r.Id,r) |> Map.ofList
            let compact = ctx.Forecasts |> List.map (fun f -> f.Binding)
            let! same = canonicalEqual (Seq.map jForecast >> A) compact training.ChildForecasts
            if not same then return! error "ChildForecasts" "source-admitted compact roster differs"
            for KeyValue(expected,cut) in training.ChildCuts do
                do! validateCut cut
                let! actual = tryCutHash cut
                if actual <> expected then return! error "ChildCuts" "full cut hash differs"
            for request in requests do
                if not (L.isId request.Id) || request.Ports.Length <> 2
                   || not (List.forall (fun p -> List.contains p ["required";"optional";"absent"]) request.Ports)
                   || (request.ParentVersion |> Option.exists (L.isHash >> not)) then
                    return! error "TrainingArtifact" "invalid fixed artifact request"
                let ids = training.RowIds[request.Id]
                if ids.IsEmpty || ids.Length > 256 || not (unique ids) then return! error "RowIds" "one to 256 unique ordered rows required"
                for id in ids do
                    if not (Map.containsKey id rows && List.contains id plan.EvidenceCut.ActiveIds) then
                        return! error "TrainingRow" "missing or inactive row"
                    let row = rows[id]
                    if row.Split <> "train" || row.Target.IsNone || row.FeatureAvailable > row.Origin
                       || row.Origin >= row.TargetTime || row.Origin > Int64.MaxValue-int64 plan.Horizon
                       || row.TargetTime <> row.Origin+int64 plan.Horizon || row.LabelAvailable < row.TargetTime
                       || row.LabelAvailable > training.CutEnd || List.exists (fun x -> abs x > 64.0) row.Features
                       || abs (Option.get row.Target) > 64.0 then return! error "TrainingRow" "training-only chronological finite row required"
                    let forecasts = training.ChildForecasts |> List.filter (fun f -> f.ArtifactId=request.Id && f.TrainingRowId=id)
                    for slot in 0 .. 1 do
                        let found = forecasts |> List.filter (fun f -> f.TargetSlot=slot)
                        if found.Length > 1 || (request.Ports[slot]="required" && found.IsEmpty)
                           || (request.Ports[slot]="absent" && not found.IsEmpty) then
                            return! error "ChildForecasts" "fixed required/absent slot violated"
                    for f in forecasts do
                        do! validateForecastBinding f
                        if f.QueryRowId=id then return! error "ChildForecasts.QueryRowId" "target-hidden identity must differ"
            for f in training.ChildForecasts do
                if not (training.RowIds |> Map.tryFind f.ArtifactId |> Option.exists (List.contains f.TrainingRowId)) then
                    return! error "ChildForecasts" "unused forecast outside fixed artifact/row roster"
            // Fitting enters only inside the first LearnStep, where its full return
            // and actual artifact-entry observation can be retained before refusal.
            return cutHash
        }

    let private validateState (plan:EpochPlan) (nodes:Node list) =
        flow {
            let state = plan.InitialState
            let! cutHash = tryCutHash plan.EvidenceCut
            if state.Revision < 0L || state.Revision = Int64.MaxValue || not (L.isHash state.ActiveCut) || (plan.Mode<>"compensate" && state.ActiveCut <> cutHash) then
                return! error "InitialState" "nonnegative revision with exact active cut required"
            let byPath = nodes |> List.map (fun (n:Node) -> n.InstancePath,n) |> Map.ofList
            for KeyValue(id,w) in state.Weights do
                if not (L.isId id && L.isId w.BaseArtifactId) || w.Parameters.Length <> 57
                   || not (List.forall (fun x -> finite x && abs x <= 64.0) w.Parameters) then
                    return! error "Weights" "finite exact vector required"
                let! vectorHash = tryVectorHash w.Parameters
                if vectorHash <> w.VectorSha256 then return! error "Weights.VectorSha256" "complete vector bytes changed"
                if plan.Mode="query" then
                    match Map.tryFind id plan.SelectedVersions with
                    | None -> return! error "Weights" "query weight has no frozen artifact"
                    | Some selected ->
                        if w.BaseArtifactId <> selected.Artifact.Id || List.map L.bits w.Parameters <> List.map L.bits selected.Artifact.Parameters then
                            return! error "Weights" "query changed frozen parameters"
            let checkKey k family =
                flow {
                    match Map.tryFind k.InstancePath byPath with
                    | None -> return! error "SiteKey" "site names an absent computational instance"
                    | Some n ->
                        if n.Kind <> "precision-gate" || k.ContributionId <> contribution n k.Factor then
                            return! error "SiteKey" "model factor contribution identity differs"
                        let normalSlots = n.Inputs |> List.map (fun p -> "normal/"+invariant p.TargetSlot)
                        if family="gaussian" then
                            if k.Port <> "z" || (k.Factor <> "unary" && not (List.contains k.Factor normalSlots)) then
                                return! error "SiteKey" "unknown Gaussian model site"
                        elif k.Port <> "gamma" || not (List.contains k.Factor normalSlots) then
                            return! error "SiteKey" "unknown Gamma model site"
                }
            for KeyValue(key,value) in state.GaussianSites do
                do! checkKey key "gaussian"
                if not (finiteGaussian value) then return! error "GaussianSites" "finite natural coefficients required"
            for KeyValue(key,value) in state.GammaSites do
                do! checkKey key "gamma"
                if not (finite value.LogPower && finite value.Rate) then return! error "GammaSites" "finite natural coefficients required"
            let byId = nodes |> List.map (fun (n:Node) -> n.Id,n) |> Map.ofList
            for KeyValue(id,o) in state.Outputs do
                if not (Map.containsKey id byId) || not (finite o.Mean) || abs o.Mean > 64.0 || o.SourceSequence < 1 then
                    return! error "Outputs" "finite output for computational node required"
                match byId[id].Kind,o.Variance with
                | "neural",None -> ()
                | "precision-gate",Some v when finite v && v>0.0 -> ()
                | _ -> return! error "Outputs.Variance" "point/precision output family mismatch"
        }
    let private validateIdentities (plan:EpochPlan) (nodes:Node list) =
        flow {
            let mutable variables = []
            let mutable factors = []
            for n in nodes do
                if n.Kind="precision-gate" then
                    variables <- variables @ [variable n "z"]
                    factors <- factors @ [contribution n "unary"]
                    for p in n.Inputs do
                        variables <- variables @ [variable n ("gamma/"+invariant p.TargetSlot)]
                        factors <- factors @ [contribution n ("normal/"+invariant p.TargetSlot)]
            let owners = plan.EvidenceCut.PriorOwners |> Map.toList
            if variables.Length > 32 || not (unique variables && unique factors)
               || List.sort variables <> List.sort(List.map fst owners) then
                return! error "PriorOwners" "exact derived variable roster required"
            let evidenceIds = plan.EvidenceCut.Rows |> List.map (fun (r:EvidenceRow) -> r.Id)
            let useIds = plan.EvidenceCut.Rows |> List.collect (fun r -> List.map (fun (u:ContributionUse) -> u.ContributionId) r.Uses)
            let ownIds = List.map snd owners
            if not (unique (variables @ factors @ ownIds))
               || variables @ factors |> List.exists (fun id -> List.contains id evidenceIds || List.contains id useIds) then
                return! Error(failure "Conflict" "admit" (Some "Identities") "derived variable/factor identity collides with independent lineage")
            for row in plan.EvidenceCut.Rows do
                for contributionUse in row.Uses do
                    if List.contains contributionUse.ContributionId ownIds && contributionUse.Role <> "prior" then
                        return! Error(failure "Conflict" "admit" (Some "PriorOwners") "prior identity reused as another contribution role")
        }
    let private validateQueryRow (plan:EpochPlan) =
        flow {
            match plan.QueryRowId with
            | None -> return! error "QueryRowId" "one selected query row is required"
            | Some id ->
                match plan.EvidenceCut.Rows |> List.tryFind (fun r -> r.Id=id) with
                | Some r when List.contains id plan.EvidenceCut.ActiveIds && r.Target.IsNone
                              && r.FeatureAvailable<=r.Origin && r.Origin<=Int64.MaxValue-int64 plan.Horizon
                              && r.TargetTime=r.Origin+int64 plan.Horizon -> return ()
                | _ -> return! error "QueryRowId" "active target-hidden available row required"
        }
    let private validateSelected (plan:EpochPlan) (nodes:Node list) =
        flow {
            for KeyValue(id,selected) in plan.SelectedVersions do
                do! L.tryValidateArtifact selected.Artifact
                let! version = L.tryVersion selected.Artifact
                if selected.Artifact.Id <> id || version <> selected.Version || selected.Artifact.SourceBindings <> plan.SourceBindings then
                    return! error "SelectedVersions" "complete frozen artifact identity/source mismatch"
            for n in nodes do
                if n.Kind="neural" then
                    match n.Artifact |> Option.bind (fun id -> Map.tryFind id plan.SelectedVersions) with
                    | None -> return! error "Node.Artifact" "neural node requires a supplied frozen artifact"
                    | Some selected ->
                        for slot in 0 .. 1 do
                            let present = n.Inputs |> List.exists (fun (p:InputPort) -> p.TargetSlot=slot)
                            if (selected.Artifact.Ports[slot]="required" && not present)
                               || (selected.Artifact.Ports[slot]="absent" && present) then
                                return! error "Inputs" "frozen required/absent input contract changed"
        }
    let private validateExpectedOperations expected actual =
        flow {
            let! same = canonicalEqual (Seq.map jOperation >> A) expected actual
            if not same then return! error "Operations" "exact source-derived operation roster differs"
        }
    let private validatePlanBase (plan:EpochPlan) (context:AdmissionContext) =
        flow {
            if not (L.isId plan.Id) || not (List.contains plan.Mode ["query";"train";"compensate"])
               || plan.Horizon < 1 || plan.Horizon > 1024 || not (finite plan.Damping)
               || plan.Damping<=0.0 || plan.Damping>1.0 || not (bindingsValid plan.SourceBindings) then
                return! error "EpochPlan" "fixed IDs, mode, horizon, damping and source bindings required"
            if not (present context) || not (present context.Identity) || not (L.isId context.Identity.SessionId)
               || not (L.isHash context.Identity.ServiceSha256) then return! error "AdmissionContext" "explicit source-admitted peer identity required"
            do! validateSnapshot context.InitialBudgetSnapshot
            if not (bounded 2048 context.Forecasts) then return! error "Forecasts" "bounded source-admitted forecasts required"
            do! validateCut plan.EvidenceCut
            let! resolved,ordered = topology plan.Nodes
            do! validateIdentities plan ordered
            do! validateSelected plan ordered
            do! validateState plan ordered
            return resolved,ordered
        }

    let private historicalRestore (plan:EpochPlan) (context:AdmissionContext) (inputs:CompensationInputs) =
        flow {
            let retained = readPlan inputs.RetainedPlan
            if retained.Mode <> "query" || retained.Operations |> List.exists (function Compensate _ -> true | _ -> false) then
                return! error "RetainedPlan" "query-only nonrecursive history required"
            let! _,ordered = validatePlanBase retained context
            do! validateQueryRow retained
            do! validateExpectedOperations (queryOperations retained.Sweeps ordered) retained.Operations
            let! retainedRaw = tryEncodePlan retained
            let r = inputs.RetainedResult
            keys ["PlanSha256";"Outcome";"Termination";"Failure";"LastCommitted";"ProposedArtifacts";"Observations";"Counters";"PendingRequest";"Scheduler";"Publication"] r
            if text (prop "PlanSha256" r) <> hash retainedRaw then return! error "RetainedResult" "actual prior plan identity differs"
            let last = readState (prop "LastCommitted" r)
            let! sameLast = canonicalEqual jState last plan.InitialState
            if not sameLast then return! error "RetainedResult.LastCommitted" "current state does not equal actual retained last state"
            let checkpoint = inputs.Checkpoint
            keys ["State";"StateSha256";"Prefix";"PrefixSha256"] checkpoint
            let restore = readState (prop "State" checkpoint)
            let! stateRaw = tryEncodeState restore
            if hash stateRaw <> text (prop "StateSha256" checkpoint) then return! error "Checkpoint.StateSha256" "checkpoint bytes differ"
            let prefix = arr 4096 (prop "Prefix" checkpoint)
            let observations = arr 4096 (prop "Observations" r)
            if prefix.Length > observations.Length then return! error "Checkpoint.Prefix" "prefix exceeds actual ledger"
            let! prefixRaw = encodeSource (1024*1024) (fun () -> A(Seq.map tree prefix))
            let! originalPrefix = encodeSource (1024*1024) (fun () -> A(Seq.map tree (List.take prefix.Length observations)))
            if hash prefixRaw <> text (prop "PrefixSha256" checkpoint) || not (prefixRaw.AsSpan().SequenceEqual(originalPrefix.AsSpan())) then
                return! error "Checkpoint.Prefix" "prefix must be exact actual retained observations"
            let mutable current = retained.InitialState
            let mutable atCheckpoint = if prefix.IsEmpty then Some current else None
            let mutable targetApplied = false
            let mutable descendants = false
            for i,o in List.indexed observations do
                keys ["Sequence";"Operation";"InputRevision";"Inputs";"Call";"Proposal";"Admission";"AppliedRevision";"Failure"] o
                if i >= retained.Operations.Length then return! error "RetainedResult.Observations" "ledger exceeds fixed original schedule"
                let! sameOperation = canonicalEqual jOperation (readOperation (prop "Operation" o)) retained.Operations[i]
                if not sameOperation || integer (prop "InputRevision" o) <> current.Revision then
                    return! error "RetainedResult.Observations" "operation/revision chain differs"
                match opt integer (prop "AppliedRevision" o) with
                | None -> ()
                | Some revision ->
                    let proposal = prop "Proposal" o
                    keys ["ExpectedRevision";"ExpectedStateSha256";"State";"Details"] proposal
                    let! oldRaw = tryEncodeState current
                    if integer (prop "ExpectedRevision" proposal) <> current.Revision
                       || text (prop "ExpectedStateSha256" proposal) <> hash oldRaw || revision <> current.Revision+1L then
                        return! error "RetainedResult.Proposal" "applied revision lacks its exact old state"
                    let next = readState (prop "State" proposal)
                    if next.Revision <> revision then return! error "RetainedResult.AppliedRevision" "state/revision mismatch"
                    if revision=inputs.TargetRevision then targetApplied <- true
                    if revision>inputs.TargetRevision then descendants <- true
                    current <- next
                if i+1=prefix.Length then atCheckpoint <- Some current
            let! sameEnd = canonicalEqual jState current last
            let! sameCheckpoint = canonicalEqual jState (Option.get atCheckpoint) restore
            if not sameEnd || not sameCheckpoint || not targetApplied || inputs.TargetRevision <> restore.Revision+1L then
                return! error "TargetRevision" "target must be an actual applied revision immediately after the retained checkpoint"
            if plan.SourceBindings <> retained.SourceBindings || plan.SelectedVersions <> retained.SelectedVersions
               || plan.Horizon <> retained.Horizon || L.bits plan.Damping <> L.bits retained.Damping then
                return! error "Compensate" "replay changes frozen source, versions, horizon or damping"
            let! sameNodes = canonicalEqual (Seq.map jNode >> A) plan.Nodes retained.Nodes
            if not sameNodes then return! error "Compensate.Nodes" "same original computational graph required"
            if descendants then
                if plan.Sweeps < 1 || plan.Sweeps > 8 then return! error "Compensate.Sweeps" "descendant replay requires finite sweeps"
                let replay = {plan with Mode="query";QueryRowId=retained.QueryRowId;Training=None}
                do! validateQueryRow replay
                return restore,Some replay
            else
                if plan.Sweeps <> 0 then return! error "Compensate.Sweeps" "direct restoration has zero query sweeps"
                return restore,None
        }
    /// Admission constructs an immutable, single-session plan. It does not run
    /// preprocessing, a learner, a projection, or a scheduler operation.
    let tryAdmit (input:EpochPlan,context:AdmissionContext) =
        try
            flow {
                let! raw = tryEncodePlan input
                let! plan = tryReadPlan raw
                let! resolved,ordered = validatePlanBase plan context
                let mutable replay = None
                let mutable restore = None
                let mutable expected = []
                match plan.Mode with
                | "query" ->
                    if plan.Sweeps < 1 || plan.Sweeps > 8 || plan.Training.IsSome then
                        return! error "Query" "one to eight query sweeps and null training required"
                    do! validateQueryRow plan
                    expected <- queryOperations plan.Sweeps ordered
                | "train" ->
                    if plan.Sweeps <> 0 || plan.QueryRowId.IsSome || plan.Training.IsNone || not plan.InitialState.Weights.IsEmpty
                       || not plan.InitialState.GaussianSites.IsEmpty || not plan.InitialState.GammaSites.IsEmpty
                       || not plan.InitialState.Outputs.IsEmpty then
                        return! error "Training" "fresh working state and no implicit child execution required"
                    let t = Option.get plan.Training
                    let! _ = validateTraining plan context t
                    expected <- trainOperations t
                | "compensate" ->
                    if plan.QueryRowId.IsSome || plan.Training.IsSome then return! error "Compensate" "query row inherited from retained query; training null"
                    match plan.Operations with
                    | Compensate c :: _ ->
                        let! initial,query = historicalRestore plan context c
                        restore <- Some initial
                        replay <- query
                        expected <- Compensate c :: (query |> Option.map (fun p -> queryOperations p.Sweeps ordered) |> Option.defaultValue [])
                    | _ -> return! error "Compensate" "first operation must carry exact retained history"
                | _ -> return! error "Mode" "unknown fixed mode"
                do! validateExpectedOperations expected plan.Operations
                let p = expected |> List.filter (function GaussianBlock _ -> true | _ -> false) |> List.length
                let forwards = expected |> List.filter (function NeuralForward _ -> true | _ -> false) |> List.length
                let learns = expected |> List.filter (function LearnStep _ -> true | _ -> false) |> List.length
                let prior = context.InitialBudgetSnapshot.PriorWork
                if expected.Length+prior.SchedulerEntered>4096 || p+prior.ProjectionRequested>32
                   || p+prior.NativeLaunchAttempted>32 || p+prior.CertificateEntered>32 || p+prior.NestedReferenceEntered>32
                   || forwards>1024 || forwards+learns+prior.ForwardEntered>4096 || learns+prior.LearnEntered>2048
                   || (plan.Training |> Option.map (fun t -> t.Artifacts.Length) |> Option.defaultValue 0)+prior.TrainingArtifacts>4 then
                    return! Error(failure "Budget" "admit" (Some "Operations") "derived full schedule exceeds inherited fixed work limits")
                return {Plan=plan;Context=context;PlanSha256=hash raw;Resolved=resolved;Ordered=ordered
                        TrainingPrepared=Map.empty;Replay=replay;RestoreState=restore;Sequence=ref 1;Entered=ref false}
            }
        with
        | WireFailure f -> Error f
        | ex -> Error(failure "Unexpected" "admit" None ex.Message)
    let admittedIdentity (plan:AdmittedPlan) = plan.Context.Identity
    let admittedPlanSha256 (plan:AdmittedPlan) = plan.PlanSha256
    let nextProtocolSequence (plan:AdmittedPlan) = plan.Sequence.Value
