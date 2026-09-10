namespace Zeta.Bayesian

open System
open System.Globalization
open System.IO
open System.Security.Cryptography
open System.Text.Json
open Zeta.Core

/// The fixed point-weight 12-4-1 learner from the mixed-message epoch contract.
/// All returned vectors are immutable proposals; this module never commits weights.
[<RequireQualifiedAccess>]
module BoundedModuleLearner =
    type private FlowBuilder() =
        inherit ResultBuilder()
        member _.For(values: seq<'T>, body: 'T -> Result<unit, 'E>) =
            use iterator = values.GetEnumerator()
            let mutable outcome = Ok()
            while Result.isOk outcome && iterator.MoveNext() do
                outcome <- body iterator.Current
            outcome
        member _.Using(resource: 'T, body: 'T -> Result<'U, 'E>) =
            try body resource
            finally
                if not (isNull (box resource)) then (resource :> IDisposable).Dispose()

    let private result = FlowBuilder()

    type Failure =
        { Code: string
          Stage: string
          Field: string option
          Message: string }

    type Preprocessing =
        { TrainingCut: string
          Count: int
          Means: float list
          Scales: float list }

    type ModuleArtifact =
        { Id: string
          ParentVersion: string option
          TrainingCut: string
          Architecture: string
          Ports: string list
          Parameters: float list
          Preprocessing: Preprocessing
          UpdateReceiptSha256: string
          SourceBindings: Map<string, string> }

    type ForwardInput =
        { Parameters: float list
          Inputs: float list }

    type ForwardAttempt =
        { Input: ForwardInput
          Preactivations: float list
          Hidden: float list
          Outcome: Result<float, Failure> }

    type StepInput =
        { Parameters: float list
          Inputs: float list
          Target: float }

    type StepAttempt =
        { Input: StepInput
          Forward: ForwardAttempt option
          Loss: float option
          Gradient: float list
          ProposedParameters: float list
          Outcome: Result<unit, Failure> }

    type PreprocessingAttempt =
        { TrainingCut: string
          Rows: float list list
          Means: float list
          Variances: float list
          Scales: float list
          Outcome: Result<Preprocessing, Failure> }

    type TransformAttempt =
        { Preprocessing: Preprocessing
          Row: float list
          Values: float list
          Outcome: Result<unit, Failure> }

    [<Literal>]
    let Architecture = "point-mlp-12-4-1-v1"

    [<Literal>]
    let ParameterCount = 57

    [<Literal>]
    let ArtifactLimit = 65536

    let private failure code stage field message =
        { Code = code; Stage = stage; Field = Some field; Message = message }

    let private present value = not (isNull (box value))

    let private countAtMost limit values =
        if not (present values) then false
        else values |> Seq.truncate (limit + 1) |> Seq.length |> fun n -> n <= limit

    let private exactCount field count values =
        if countAtMost count values && List.length values = count then Ok()
        else Error(failure "Admission" "admit" field ("expected " + string count + " values"))

    let private finiteBound stage field bound value =
        if Double.IsFinite value && abs value <= bound then Ok value
        else Error(failure "Arithmetic" stage field "finite value within the fixed absolute bound required")

    let private finite stage field value =
        if Double.IsFinite value then Ok value
        else Error(failure "Arithmetic" stage field "nonfinite arithmetic result")

    let isHash (value: string) =
        present value && value.Length = 64
        && (value |> Seq.forall (fun c -> (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F')))

    let isId (value: string) =
        let alnum c = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
        present value && value.Length > 0 && value.Length <= 64 && alnum value[0]
        && (value |> Seq.forall (fun c -> alnum c || c = '.' || c = '_' || c = '/' || c = '-'))

    let bits (value: float) = BitConverter.DoubleToUInt64Bits(value).ToString("X16", CultureInfo.InvariantCulture)

    let private validateParameters values =
        result {
            do! exactCount "Parameters" ParameterCount values
            for i, value in List.indexed values do
                let! _ = finiteBound "admit" ("Parameters[" + string i + "]") 64.0 value
                ()
        }

    let private validateInputs values =
        result {
            do! exactCount "Inputs" 12 values
            for i, value in List.indexed values do
                let bound = if i < 8 then 8.0 else 64.0
                let! _ = finiteBound "admit" ("Inputs[" + string i + "]") bound value
                if i >= 10 && value <> 0.0 && value <> 1.0 then
                    return! Error(failure "Admission" "admit" "Inputs.Presence" "presence must be zero or one")
            for i in 0 .. 1 do
                if values[10 + i] = 0.0 && values[8 + i] <> 0.0 then
                    return! Error(failure "Admission" "admit" "Inputs.Absent" "absent child must have zero value")
        }

    /// Source-fixed initializer; no random source or hidden state is consulted.
    let initialParameters () =
        [ yield! [ for h in 0 .. 3 do for j in 0 .. 11 -> float (((h + 1) * (j + 1)) % 7 - 3) / 32.0 ]
          yield! [ 0.0; 0.0; 0.0; 0.0 ]
          yield! [ for h in 0 .. 3 -> float (h + 1) / 16.0 ]
          yield 0.0 ]

    /// Complete actual forward return, including all intermediates reached on refusal.
    let tryForward (input: ForwardInput) : ForwardAttempt =
        let mutable preactivations = []
        let mutable hidden = []
        let outcome =
            result {
                if not (present input) then
                    return! Error(failure "Admission" "admit" "ForwardInput" "record required")
                do! validateParameters input.Parameters
                do! validateInputs input.Inputs
                let p = List.toArray input.Parameters
                let x = List.toArray input.Inputs
                for h in 0 .. 3 do
                    let mutable activation = p[48 + h]
                    for j in 0 .. 11 do
                        let! product = finite "forward" "activation.product" (p[12 * h + j] * x[j])
                        let! next = finite "forward" "activation.sum" (activation + product)
                        activation <- next
                    preactivations <- preactivations @ [ activation ]
                    let! value = finite "forward" "tanh" (Math.Tanh activation)
                    hidden <- hidden @ [ value ]
                let mutable prediction = p[56]
                for h in 0 .. 3 do
                    let! product = finite "forward" "output.product" (p[52 + h] * hidden[h])
                    let! next = finite "forward" "output.sum" (prediction + product)
                    prediction <- next
                return! finiteBound "forward" "prediction" 64.0 prediction
            }
        { Input = input; Preactivations = preactivations; Hidden = hidden; Outcome = outcome }

    /// Half squared error SGD. Every derivative uses exactly the same old vector.
    /// A partial replacement never becomes a committed or publishable vector.
    let tryStep (input: StepInput) : StepAttempt =
        let mutable forward = None
        let mutable loss = None
        let mutable gradient = []
        let mutable replacements = []
        let outcome =
            result {
                if not (present input) then
                    return! Error(failure "Admission" "admit" "StepInput" "record required")
                do! validateParameters input.Parameters
                do! validateInputs input.Inputs
                let! _ = finiteBound "admit" "Target" 64.0 input.Target
                let observed = tryForward { Parameters = input.Parameters; Inputs = input.Inputs }
                forward <- Some observed
                let! prediction = observed.Outcome
                let! error = finite "learn" "error" (prediction - input.Target)
                let! squared = finite "learn" "loss.square" (error * error)
                let! actualLoss = finite "learn" "loss.half" (squared / 2.0)
                loss <- Some actualLoss
                let old = List.toArray input.Parameters
                let x = List.toArray input.Inputs
                let h = List.toArray observed.Hidden
                let mutable deltas = []
                let mutable outputGradient = []
                for i in 0 .. 3 do
                    let! gv = finite "learn" "gradient.output" (error * h[i])
                    outputGradient <- outputGradient @ [ gv ]
                    let! weightedError = finite "learn" "gradient.old-output-weight" (error * old[52 + i])
                    let! square = finite "learn" "gradient.tanh-square" (h[i] * h[i])
                    let! slope = finite "learn" "gradient.tanh-slope" (1.0 - square)
                    let! delta = finite "learn" "gradient.hidden" (weightedError * slope)
                    deltas <- deltas @ [ delta ]
                for i in 0 .. 3 do
                    for j in 0 .. 11 do
                        let! value = finite "learn" "gradient.input" (deltas[i] * x[j])
                        gradient <- gradient @ [ value ]
                gradient <- gradient @ deltas @ outputGradient @ [ error ]
                for i in 0 .. 56 do
                    let! scaled = finite "learn" "replacement.scale" (gradient[i] / 1024.0)
                    let! proposed = finiteBound "learn" ("replacement[" + string i + "]") 64.0 (old[i] - scaled)
                    replacements <- replacements @ [ proposed ]
                return ()
            }
        { Input = input; Forward = forward; Loss = loss; Gradient = gradient
          ProposedParameters = replacements; Outcome = outcome }

    let private validateRawRow row =
        result {
            do! exactCount "Features" 8 row
            for value in row do
                let! _ = finiteBound "admit" "Features" 64.0 value
                ()
        }

    let tryValidatePreprocessing (value: Preprocessing) : Result<unit, Failure> =
        result {
            if not (present value) then
                return! Error(failure "Admission" "admit" "Preprocessing" "record required")
            if not (isHash value.TrainingCut) || value.Count < 1 || value.Count > 256 then
                return! Error(failure "Admission" "admit" "Preprocessing" "training hash and count 1..256 required")
            do! exactCount "Means" 8 value.Means
            do! exactCount "Scales" 8 value.Scales
            for mean in value.Means do
                let! _ = finiteBound "admit" "Means" 64.0 mean
                ()
            for scale in value.Scales do
                let! _ = finite "admit" "Scales" scale
                if scale <= 0.0 then
                    return! Error(failure "Admission" "admit" "Scales" "positive scale required")
        }

    /// Population variance, two passes in caller-admitted ordinal row order.
    /// This function fits only the supplied training rows; split admission is the epoch's job.
    let tryFitPreprocessing trainingCut (rows: float list list) : PreprocessingAttempt =
        let mutable means = []
        let mutable variances = []
        let mutable scales = []
        let outcome =
            result {
                if not (isHash trainingCut) || not (countAtMost 256 rows) || List.isEmpty rows then
                    return! Error(failure "Admission" "admit" "TrainingRows" "hash and 1..256 rows required")
                for row in rows do do! validateRawRow row
                let n = float rows.Length
                for j in 0 .. 7 do
                    let mutable total = 0.0
                    for row in rows do
                        let! next = finite "learn" "preprocessing.sum" (total + row[j])
                        total <- next
                    let! mean = finite "learn" "preprocessing.mean" (total / n)
                    means <- means @ [ mean ]
                for j in 0 .. 7 do
                    let mutable total = 0.0
                    for row in rows do
                        let! delta = finite "learn" "preprocessing.delta" (row[j] - means[j])
                        let! squared = finite "learn" "preprocessing.square" (delta * delta)
                        let! next = finite "learn" "preprocessing.variance-sum" (total + squared)
                        total <- next
                    let! variance = finite "learn" "preprocessing.variance" (total / n)
                    variances <- variances @ [ variance ]
                    let! scale = finite "learn" "preprocessing.scale" (if variance = 0.0 then 1.0 else sqrt variance)
                    if scale <= 0.0 then
                        return! Error(failure "Arithmetic" "learn" "preprocessing.scale" "positive scale required")
                    scales <- scales @ [ scale ]
                let value = { TrainingCut = trainingCut; Count = rows.Length; Means = means; Scales = scales }
                do! tryValidatePreprocessing value
                return value
            }
        { TrainingCut = trainingCut; Rows = rows; Means = means; Variances = variances
          Scales = scales; Outcome = outcome }

    /// Query transformation uses the stored scaler; an excess is refused, not clipped/refitted.
    let tryTransform (preprocessing: Preprocessing) row : TransformAttempt =
        let mutable values = []
        let outcome =
            result {
                do! tryValidatePreprocessing preprocessing
                do! exactCount "Features" 8 row
                for j in 0 .. 7 do
                    let! raw = finite "forward" "Features" row[j]
                    let! delta = finite "forward" "preprocessing.query-delta" (raw - preprocessing.Means[j])
                    let! value = finiteBound "forward" "preprocessing.query-value" 8.0 (delta / preprocessing.Scales[j])
                    values <- values @ [ value ]
                return ()
            }
        { Preprocessing = preprocessing; Row = row; Values = values; Outcome = outcome }

    let private validPath (value: string) =
        present value && value.Length > 0 && value.Length <= 256
        && (value |> Seq.forall (fun c -> Char.IsAsciiLetterOrDigit c || c = '/' || c = '.' || c = '-' || c = '_'))

    /// Ordinary values are revalidated; the record alone does not confer admission.
    let tryValidateArtifact (value: ModuleArtifact) : Result<unit, Failure> =
        result {
            if not (present value) then
                return! Error(failure "Admission" "admit" "Artifact" "record required")
            if not (isId value.Id) || not (isHash value.TrainingCut) || not (isHash value.UpdateReceiptSha256) then
                return! Error(failure "Admission" "admit" "Artifact.Identity" "canonical identity/hash required")
            if value.ParentVersion |> Option.exists (isHash >> not) then
                return! Error(failure "Admission" "admit" "ParentVersion" "canonical hash required")
            if value.Architecture <> Architecture then
                return! Error(failure "Admission" "admit" "Architecture" "fixed 12-4-1 architecture required")
            do! exactCount "Ports" 2 value.Ports
            if value.Ports |> List.exists (fun p -> p <> "required" && p <> "optional" && p <> "absent") then
                return! Error(failure "Admission" "admit" "Ports" "required/optional/absent required")
            do! validateParameters value.Parameters
            do! tryValidatePreprocessing value.Preprocessing
            if value.Preprocessing.TrainingCut <> value.TrainingCut then
                return! Error(failure "Admission" "admit" "TrainingCut" "scaler cut must match artifact cut")
            if not (present value.SourceBindings) || value.SourceBindings.IsEmpty || value.SourceBindings.Count > 1024 then
                return! Error(failure "Admission" "admit" "SourceBindings" "nonempty bounded map required")
            let mutable bytes = 0
            for KeyValue(path, hash) in value.SourceBindings do
                if not (validPath path) || not (isHash hash) then
                    return! Error(failure "Admission" "admit" "SourceBindings" "bounded ASCII paths and hashes required")
                bytes <- bytes + path.Length + hash.Length + 6
                if bytes + 4096 > ArtifactLimit then
                    return! Error(failure "Budget" "admit" "Artifact" "conservative encoded artifact bound exceeded")
        }

    let private writeBits (writer: Utf8JsonWriter) name values =
        writer.WriteStartArray(name: string)
        for value in values do writer.WriteStringValue(bits value)
        writer.WriteEndArray()

    /// Canonical explicit artifact codec. No reflection serializer or producer type names.
    let tryEncodeArtifact (value: ModuleArtifact) : Result<byte array, Failure> =
        result {
            do! tryValidateArtifact value
            use stream = new MemoryStream()
            use writer = new Utf8JsonWriter(stream)
            writer.WriteStartObject()
            writer.WriteString("Architecture", value.Architecture)
            writer.WriteString("Id", value.Id)
            writeBits writer "Parameters" value.Parameters
            match value.ParentVersion with
            | Some version -> writer.WriteString("ParentVersion", version)
            | None -> writer.WriteNull("ParentVersion")
            writer.WriteStartArray("Ports")
            for port in value.Ports do writer.WriteStringValue(port)
            writer.WriteEndArray()
            writer.WriteStartObject("Preprocessing")
            writer.WriteNumber("Count", value.Preprocessing.Count)
            writeBits writer "Means" value.Preprocessing.Means
            writeBits writer "Scales" value.Preprocessing.Scales
            writer.WriteString("TrainingCut", value.Preprocessing.TrainingCut)
            writer.WriteEndObject()
            writer.WriteStartObject("SourceBindings")
            for KeyValue(path, hash) in value.SourceBindings do writer.WriteString(path, hash)
            writer.WriteEndObject()
            writer.WriteString("TrainingCut", value.TrainingCut)
            writer.WriteString("UpdateReceiptSha256", value.UpdateReceiptSha256)
            writer.WriteEndObject()
            writer.Flush()
            if stream.Length > int64 ArtifactLimit then
                return! Error(failure "Budget" "publish" "Artifact" "encoded artifact limit exceeded")
            else return stream.ToArray()
        }

    /// Version binds all admitted artifact bytes, including ports, scaler and training lineage.
    let tryVersion value =
        tryEncodeArtifact value |> Result.map (fun raw -> Convert.ToHexString(SHA256.HashData raw))
