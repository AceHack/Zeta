#r "../Core/bin/Release/net10.0/Zeta.Core.dll"
#r "../Core.Abstractions/bin/Release/net10.0/Zeta.Core.Abstractions.dll"
#r "../Core.CSharp.DynamicValue/bin/Release/net10.0/Zeta.Core.CSharp.DynamicValue.dll"
#r "../Bayesian/bin/Release/net10.0/Zeta.Bayesian.dll"

// Fixed, known-answer engineering rooms. See the separately committed room protocol.
// This script is not a generic rational API, learner, cost benchmark or runtime admission.
open System
open System.Collections.Generic
open System.Globalization
open System.IO
open System.Security.Cryptography
open System.Text.Json
open Zeta.Core
open Zeta.Bayesian

module PS = ProbabilitySemiring
module PI = PredictionInference

let objOf (fields: (string * obj) list) : obj =
    let value = Dictionary<string, obj>(StringComparer.Ordinal)
    for key, item in fields do
        value.Add(key, item)
    box value

let rationalDto (r: PS.Rational) =
    objOf [ "Num", box (r.Num.ToString(CultureInfo.InvariantCulture))
            "Den", box (r.Den.ToString(CultureInfo.InvariantCulture)) ]

let rationalArray values = values |> Array.map rationalDto |> box
let checkpoints = ResizeArray<obj>()
let mutable writtenCheckpoints = 0
let mutable journalBytes = 0
let mutable firstFailure: string option = None
let mutable pendingCheckpoint: obj option = None
let mutable pendingEncoded: byte array option = None
let fail reason =
    if firstFailure.IsNone then firstFailure <- Some reason
let faultAfter =
    match fsi.CommandLineArgs |> Array.skip 1 with
    | [||] -> None
    | [| "--fault-after-checkpoint"; value |] ->
        match Int32.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture) with
        | true, count when count >= 1 && count <= 25 -> Some count
        | _ -> fail "InvalidControlArguments"; None
    | _ -> fail "InvalidControlArguments"; None
let checkpoint category id value =
    // Called once after an actual return, including an already-recorded refusal.
    let event = objOf [ "Kind", box "checkpoint"; "Sequence", box (checkpoints.Count + 1)
                        "Category", box category; "Id", box id; "Value", value ]
    checkpoints.Add event
    pendingCheckpoint <- Some event
    pendingEncoded <- None
    let line = JsonSerializer.Serialize(event)
    let encoded = System.Text.Encoding.UTF8.GetBytes(line)
    pendingEncoded <- Some encoded
    let bytes = encoded.Length + 1
    if checkpoints.Count > 64 || bytes > 65536 || journalBytes + bytes > 1048576 then
        fail "JournalBoundExceeded"
    else
        Console.WriteLine(line)
        writtenCheckpoints <- writtenCheckpoints + 1
        journalBytes <- journalBytes + bytes
        pendingCheckpoint <- None
        pendingEncoded <- None
        if faultAfter = Some writtenCheckpoints then fail "InjectedCheckpointFailure"
let guard () =
    match firstFailure with
    | Some reason -> Error reason
    | None -> Ok ()

let asFloat (r: PS.Rational) = float r.Num / float r.Den
let sum values = Array.fold PS.add PS.zero values
let weighted weights values = Array.map2 PS.mul weights values |> sum
let support = [| -2L; -1L; 0L; 1L; 2L |] |> Array.map PS.ofInt
let actions = [| "steady"; "tail-exposed" |]
let utilities = [| Array.create 5 PS.zero; [| -7L; 1L; 1L; 1L; -7L |] |> Array.map PS.ofInt |]
let distributions =
    [| "P", [| PS.zero; PS.rat 1L 2L; PS.zero; PS.rat 1L 2L; PS.zero |]
       "Q", [| PS.rat 1L 8L; PS.zero; PS.rat 3L 4L; PS.zero; PS.rat 1L 8L |] |]
let likelihoods =
    [| "unit", Array.create 5 PS.one
       "soft", [| PS.rat 1L 4L; PS.rat 1L 2L; PS.rat 3L 4L; PS.one; PS.rat 1L 2L |]
       "tail", [| PS.one; PS.zero; PS.zero; PS.zero; PS.one |] |]

let moments mass =
    let mean = weighted mass support
    let second = weighted mass (support |> Array.map (fun x -> PS.mul x x))
    let variance = PS.add second (PS.mul (PS.ofInt -1L) (PS.mul mean mean))
    mean, second, variance

let conditioned mass likelihood =
    let unnormalized = Array.map2 PS.mul mass likelihood
    let evidence = sum unnormalized
    if evidence = PS.zero then Error "ZeroEvidence"
    else Ok(evidence, Array.map (fun p -> PS.div p evidence) unnormalized)

let conditionDto outcome =
    match outcome with
    | Ok(evidence, posterior) ->
        objOf [ "Kind", box "conditioned"; "Evidence", rationalDto evidence
                "Posterior", rationalArray posterior ]
    | Error code ->
        objOf [ "Kind", box "refused"; "Code", box code
                "Message", box "conditioning evidence is zero" ]

let finiteReference () =
    let distributionRows =
        distributions |> Array.map (fun (id, mass) ->
            let mean, second, variance = moments mass
            let tailMask = support |> Array.map (fun x -> if PS.compare (PS.rat (abs x.Num) x.Den) (PS.rat 3L 2L) > 0 then PS.one else PS.zero)
            let values = utilities |> Array.map (weighted mass)
            let best = if PS.compare values.[1] values.[0] > 0 then 1 else 0
            objOf [ "Id", box id; "Mass", rationalArray mass
                    "Mean", rationalDto mean; "SecondMoment", rationalDto second; "Variance", rationalDto variance
                    "TailProbability", rationalDto (weighted mass tailMask)
                    "ExpectedUtilities", rationalArray values; "ActionIndex", box best; "Action", box actions.[best] ])
    let permutation = [| 1; 2; 3; 4; 0 |]
    let inverse = [| 4; 0; 1; 2; 3 |]
    let transport (indices: int array) (mass: PS.Rational array) =
        let output = Array.create 5 PS.zero
        for i in 0 .. 4 do output.[indices.[i]] <- mass.[i]
        output
    let transportRows =
        distributions |> Array.map (fun (id, mass) ->
            let forward = transport permutation mass
            let recovered = transport inverse forward
            let mean, _, variance = moments forward
            objOf [ "Id", box (id + "/cycle"); "Distribution", box id
                    "ForwardMass", rationalArray forward; "RecoveredMass", rationalArray recovered
                    "ForwardMean", rationalDto mean; "ForwardVariance", rationalDto variance ])
    let conditioningRows =
        [| for id, mass in distributions do
               for likelihoodId, likelihood in likelihoods do
                   yield objOf [ "Id", box (id + "/" + likelihoodId); "Distribution", box id
                                 "LikelihoodId", box likelihoodId; "Likelihood", rationalArray likelihood
                                 "Outcome", conditionDto (conditioned mass likelihood) ] |]
    objOf [ "Schema", box "zeta.distributional-rooms.reference.v1"
            "Support", rationalArray support; "Actions", box actions
            "Utilities", box (utilities |> Array.map rationalArray)
            "TailEvent", objOf [ "Kind", box "absolute-greater-than"; "Threshold", rationalDto (PS.rat 3L 2L) ]
            "Distributions", box distributionRows
            "Transport", objOf [ "Convention", box "source-index-to-destination-index"
                                 "Permutation", box permutation; "Inverse", box inverse; "Rows", box transportRows ]
            "Conditioning", box conditioningRows ]

let gaussianRooms () =
    let rows = ResizeArray<obj>()
    for id, mass in distributions do
        if firstFailure.IsNone then
            let mean, _, variance = moments mass
            let actual = Gaussian.ofMeanVariance (asFloat mean) (asFloat variance)
            let row = objOf [ "Id", box id; "PrecisionMean", box actual.PrecisionMean; "Precision", box actual.Precision
                              "Mean", box (Gaussian.mean actual); "Variance", box (Gaussian.variance actual) ]
            rows.Add row
            checkpoint "GaussianProjection" id row
    rows.ToArray()

let consensusRooms () =
    let rows = ResizeArray<obj>()
    if firstFailure.IsNone then
        let question: LocalConsensus.BinaryQuestion = { Id = "shared-source-room"; Prior = Gaussian.ofMeanVariance 0.0 1.0 }
        let supplied = Gaussian.ofMeanVariance 1.0 1.0
        for count in [ 1; 2 ] do
            if firstFailure.IsNone then
                let state = LocalConsensus.evaluate question (List.replicate count supplied) 2.5
                let outcome, posterior =
                    match state with
                    | LocalConsensus.Undecided p -> "Undecided", p
                    | LocalConsensus.ResolvedYes p -> "ResolvedYes", p
                    | LocalConsensus.ResolvedNo p -> "ResolvedNo", p
                let row = objOf [ "SuppliedCopies", box count; "SourceId", box "same-evidence"
                                  "ProvenanceEnforcedByApi", box false; "Threshold", box 2.5; "Outcome", box outcome
                                  "Precision", box posterior.Precision; "Mean", box (Gaussian.mean posterior) ]
                rows.Add row
                checkpoint "RepeatedEvidenceConsensus" (count.ToString(CultureInfo.InvariantCulture)) row
    rows.ToArray()

let softRooms () =
    let labels = [| "minus-two"; "minus-one"; "zero"; "one"; "two" |]
    let candidate i = DynamicValue.String labels.[i]
    let weightsOf posterior =
        labels |> Array.mapi (fun i _ -> SoftValue.candidates posterior |> List.sumBy (fun (d, p) -> if d = candidate i then p else 0.0))
    let snapshot = function
        | None -> objOf [ ("Kind", box "refused") ]
        | Some posterior -> objOf [ "Kind", box "conditioned"; "Posterior", box (weightsOf posterior);
                                   "MaximumMass", box (SoftValue.confidence posterior) ]
    let rows = ResizeArray<obj>()
    for id, mass in distributions do
        if firstFailure.IsNone then
            let input = mass |> Array.mapi (fun i p -> candidate i, asFloat p) |> Array.toList |> SoftValue.ofWeighted
            if input.IsNone then fail ("SoftValue input refused: " + id)
            checkpoint "SoftValueConstructor" id (snapshot input)
            match input with
            | None -> fail ("SoftValue input refused: " + id)
            | Some prior ->
                for likelihoodId, likelihood in likelihoods do
                    if firstFailure.IsNone then
                        let likelihoodOf value =
                            labels |> Array.mapi (fun i _ -> if value = candidate i then asFloat likelihood.[i] else 0.0) |> Array.sum
                        let actual = SoftValue.observe likelihoodOf prior
                        let row = objOf [ "Id", box (id + "/" + likelihoodId); "Outcome", snapshot actual ]
                        rows.Add row
                        checkpoint "SoftValueConditioning" (id + "/" + likelihoodId) row
    rows.ToArray()

let predictionSnapshot (prediction: PI.Prediction<string>) =
    let report = prediction.Budget
    objOf [ "PosteriorShares", rationalArray (prediction.Inference.Ranked |> List.map (fun x -> PI.posteriorShare x prediction.Inference) |> List.toArray)
            "Best", box prediction.Inference.Best.Candidate.Label
            "Requested", box (report.Requested |> List.map _.Label |> List.toArray)
            "Boarded", box (report.Boarded |> List.map _.Label |> List.toArray)
            "Deferred", box (report.Deferred |> List.map _.Label |> List.toArray)
            "RequestedBytes", box report.RequestedBytes; "BoardedBytes", box report.BoardedBytes; "DeferredBytes", box report.DeferredBytes
            "TankBeforeCharge", box report.TankBefore.Charge; "TankAfterCharge", box report.TankAfter.Charge
            "Outcome", box (string report.Outcome); "Starved", box report.Starved; "VisionConfidence", box report.Confidence ]

let predictionRooms () =
    let cost: Vision.BranchCost = { SpaceBytes = 6L; TimeTicks = 0; BytesPerTick = 0L; UncertaintyResolutionBits = 0 }
    let candidate label prior: PI.Candidate<string> = { Label = label; State = label; Prior = prior; Likelihood = PS.one; Cost = cost }
    let candidates = [ candidate "likely" (PS.rat 3L 4L); candidate "attended" (PS.rat 1L 4L) ]
    let rows = ResizeArray<obj>()
    if firstFailure.IsNone then
        let inferred = PI.infer candidates
        let snapshot =
            match inferred with
            | Error feedback -> objOf [ "Kind", box "refused"; "Feedback", box (sprintf "%A" feedback) ]
            | Ok inference -> objOf [ "Kind", box "inferred"; "PosteriorShares", rationalArray (inference.Ranked |> List.map (fun x -> PI.posteriorShare x inference) |> List.toArray) ]
        match inferred with
        | Error feedback -> fail (sprintf "inference refused: %A" feedback)
        | Ok _ -> ()
        checkpoint "Inference" "two-candidates" snapshot
        match inferred with
        | Error feedback -> fail (sprintf "inference refused: %A" feedback)
        | Ok inference ->
            for capacity in [ 0; 6; 12 ] do
                for priorityId in [ "neutral"; "attention-ten" ] do
                    if firstFailure.IsNone then
                        let priority (scored: PI.Scored<string>) =
                            if priorityId = "attention-ten" && scored.Candidate.Label = "attended" then
                                { PI.neutralPriority with Attention = PS.ofInt 10L }
                            else PI.neutralPriority
                        let tank = SoftThrottle.tank (float capacity) 0.0
                        let id = capacity.ToString(CultureInfo.InvariantCulture) + "/" + priorityId
                        let recordResult kind value =
                            match value with
                            | Ok prediction -> checkpoint kind id (predictionSnapshot prediction)
                            | Error feedback ->
                                fail (sprintf "prediction refused: %A" feedback)
                                checkpoint kind id (objOf [ "Kind", box "refused"; "Feedback", box (sprintf "%A" feedback) ])
                        let predicted = PI.predictWithPriority priority tank inference
                        recordResult "PriorityPrediction" predicted
                        if firstFailure.IsNone then
                            let directResult = PI.predict tank inference
                            recordResult "DirectPrediction" directResult
                            if firstFailure.IsNone then
                                match predicted, directResult with
                                | Ok prediction, Ok direct ->
                                    let report = prediction.Budget
                                    let shares = prediction.Inference.Ranked |> List.map (fun x -> PI.posteriorShare x prediction.Inference) |> List.toArray
                                    let boardedMass = prediction.Inference.Ranked |> List.filter (fun x -> report.Boarded |> List.exists (fun b -> b.Label = x.Candidate.Label)) |> List.map (fun x -> PI.posteriorShare x prediction.Inference) |> List.toArray |> sum
                                    rows.Add(objOf [ "CapacityBytes", box capacity; "Priority", box priorityId
                                                     "PosteriorShares", rationalArray shares; "Best", box prediction.Inference.Best.Candidate.Label
                                                     "Boarded", box (report.Boarded |> List.map _.Label |> List.toArray)
                                                     "Deferred", box (report.Deferred |> List.map _.Label |> List.toArray)
                                                     "RequestedBytes", box report.RequestedBytes; "BoardedBytes", box report.BoardedBytes; "DeferredBytes", box report.DeferredBytes
                                                     "VisionConfidence", box report.Confidence; "BoardedPosteriorMass", rationalDto boardedMass
                                                     "SameBudgetReportAsDirect", box (report = direct.Budget) ])
                                | _ -> () // An earlier typed result has already recorded the first failure.
    rows.ToArray()

let run () =
    result {
        do! guard ()
        let finite = finiteReference ()
        let gaussian = gaussianRooms ()
        do! guard ()
        let consensus = consensusRooms ()
        do! guard ()
        let soft = softRooms ()
        do! guard ()
        let prediction = predictionRooms ()
        do! guard ()
        let assemblies = [| typeof<PS.Rational>.Assembly; typeof<Gaussian>.Assembly; typeof<DynamicValue>.Assembly |]
        let loaded = assemblies |> Array.map (fun assembly ->
            let bytes = File.ReadAllBytes assembly.Location
            objOf [ "Name", box (assembly.GetName().Name); "Bytes", box bytes.LongLength
                    "Sha256", box (Convert.ToHexString(SHA256.HashData bytes)) ])
        return objOf [ "Schema", box "zeta.distributional-rooms.actual-zeta.v1"
                       "FiniteReference", finite
                       "ZetaObservations", objOf [ "GaussianProjection", box gaussian
                                                   "RepeatedEvidenceConsensus", box consensus
                                                   "SoftValueConditioning", box soft; "BudgetAndPriority", box prediction ]
                       "Runtime", objOf [ "DotNetVersion", box (Environment.Version.ToString())
                                          "LoadedAssemblies", box loaded; "CompleteRuntimeClosureAdmitted", box false ] ]
    }

// Unexpected runtime/I/O exceptions are translated only at this CLI boundary.
// Earlier NDJSON lines remain the actual prefix, even when no terminal can be written.
let outcome =
    try run ()
    with ex ->
        fail (ex.GetType().FullName + ": " + ex.Message)
        Error (firstFailure |> Option.defaultValue "UnexpectedRunnerFailure")
let complete, receipt, failure =
    match outcome with
    | Ok value -> true, value, null
    | Error reason -> false, null, box reason
if not complete then Environment.ExitCode <- 2
let pendingOmission reason =
    match pendingCheckpoint with
    | None -> null
    | Some _ ->
        let bytes, digest =
            match pendingEncoded with
            | None -> null, null
            | Some encoded -> box encoded.Length, box (Convert.ToHexString(SHA256.HashData encoded))
        objOf [ "Sequence", box checkpoints.Count; "EncodedBytes", bytes; "Sha256", digest; "Reason", box reason ]
let terminal includePending =
    let pending, omission =
        match pendingCheckpoint, pendingEncoded with
        | None, _ -> null, null
        | Some value, Some _ when includePending -> value, null
        | Some _, None -> null, pendingOmission "CheckpointSerializationFailed"
        | Some _, Some _ -> null, pendingOmission "TerminalBoundExceeded"
    objOf [ "Kind", box "terminal"; "Schema", box "zeta.distributional-rooms.run.v1"
            "Complete", box complete; "Failure", failure; "Receipt", receipt
            "ObservedCheckpointCount", box checkpoints.Count; "WrittenCheckpointCount", box writtenCheckpoints
            "PendingCheckpoint", pending; "PendingCheckpointOmission", omission ]
try
    let line = JsonSerializer.Serialize(terminal true)
    let size (text: string) = System.Text.Encoding.UTF8.GetByteCount(text) + 1
    let bounded line = size line <= 65536 && journalBytes + size line <= 1048576
    let finalLine = if bounded line then line else JsonSerializer.Serialize(terminal false)
    if not (bounded finalLine) then
        Environment.ExitCode <- 2
        Console.Error.WriteLine("TerminalJournalBoundExceeded")
    else Console.WriteLine(finalLine)
with ex ->
    Environment.ExitCode <- 2
    Console.Error.WriteLine("TerminalPublicationFailed: " + ex.GetType().FullName)
