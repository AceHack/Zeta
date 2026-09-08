namespace Zeta.Bayesian

open System
open System.Collections.Generic
open System.Globalization
open System.Numerics
open System.Security.Cryptography
open System.Text
open System.Text.Json
open System.Text.RegularExpressions
open Zeta.Core

/// Bounded binary64 Gaussian projection candidate. Rounded signs are diagnostic,
/// not interval certificates. No graph application or mixed inference schedule.
/// Frozen contract 1bf71 and both admission clarifications are separate bindings.
[<RequireQualifiedAccess>]
module PrecisionGateProjection =

    /// Local bounded control flow; it extends the existing Result operations
    /// without changing Core's public builder or translating returned failures.
    type private FlowBuilder() =
        inherit ResultBuilder()
        member _.While(guard, body: unit -> Result<unit, 'Error>) =
            let mutable outcome = Ok()
            while Result.isOk outcome && guard() do outcome <- body()
            outcome
        member this.For(values: seq<'Value>, body: 'Value -> Result<unit, 'Error>) =
            use iterator = values.GetEnumerator()
            this.While(iterator.MoveNext, fun () -> body iterator.Current)
        member _.TryWith(body: unit -> Result<'Value, 'Error>, handler) =
            try body() with ex -> handler ex
        member _.Using(resource: 'Resource, body: 'Resource -> Result<'Value, 'Error>) =
            try body resource
            finally
                if not (isNull (box resource)) then (resource :> IDisposable).Dispose()

    let private result = FlowBuilder()

    [<Literal>]
    let ProtocolSha256 = "537054779BF9E0BFA9271B5CC56116FBC80B16C4A2BE9F1B5E3C022FE95A0F8E"

    [<Literal>]
    let DecimalClarificationPath = "docs/research/2026-09-08-precision-gate-projection-decimal-admission-clarification.md"

    [<Literal>]
    let DecimalClarificationSha256 = "BA359E4FEC2484A680B6B149E6E887FBEA82AFBB67A15EAFBDB99949101BDAB8"

    [<Literal>]
    let RenderedZeroClarificationPath = "docs/research/2026-09-08-precision-gate-projection-rendered-zero-clarification.md"

    [<Literal>]
    let RenderedZeroClarificationSha256 = "67B7C9EFB6B42CEFE341507738B6122FAC4BEDF18C07A72564F3DEEFEE71235E"

    type Rational = { Num: string; Den: string }
    type TargetSnapshot =
        { RequestedParameters: Map<string, string>
          TargetBits: Map<string, string>
          DyadicTarget: Map<string, Rational>
          ConversionDelta: Map<string, Rational> }
    type OriginalKernelFailure = { Kind: string; Field: string; Detail: string option }
    type Failure =
        { Code: string; Stage: string; Field: string option; Message: string
          OriginalKernelFailure: OriginalKernelFailure option }
    type Counters =
        { Starts: int; PhiEntries: int; MidpointAttempts: int; BracketUpdates: int
          LogEntries: int; ExpEntries: int; ObjectiveEntries: int }
    type Bracket = { LowerBits: string; UpperBits: string }
    type Parameters =
        { LogTBits: string option; LogCBits: string option; ABits: string option
          BBits: string option; DBits: string option }
    type Objective =
        { ValueBits: string; DerivativeMeanBits: string; DerivativeVarianceBits: string }
    type Candidate =
        { TargetBits: Map<string, string>; LogRatioBits: string; RatioBits: string
          RBits: string; MeanBits: string; VarianceBits: string; Bracket: Bracket
          Stop: string; OriginalObjective: Objective }
    type PartialCandidate =
        { TargetBits: Map<string, string> option; LogRatioBits: string option
          RatioBits: string option; RBits: string option; MeanBits: string option
          VarianceBits: string option; Bracket: Bracket option; Stop: string option
          OriginalObjective: Objective option }
    type Partial =
        { Target: TargetSnapshot option; Parameters: Parameters option
          Bracket: Bracket option; Candidate: PartialCandidate option
          OriginalObjective: Result<Objective, OriginalKernelFailure> option }
    type TraceRow =
        { Sequence: int; Stage: string; Attempt: int; PointBits: string option
          PhiBits: string option; LowerBits: string option; UpperBits: string option
          Failure: Failure option }
    type Outcome = Candidate of Candidate | Refused of Failure * Partial
    type NativeReceipt =
        { Schema: string; CaseId: string; InputSha256: string
          Bindings: Map<string, string>; Outcome: Outcome; Counters: Counters
          Trace: TraceRow array }

    let private bits (value: float) =
        (uint64 (BitConverter.DoubleToInt64Bits value)).ToString("X16", CultureInfo.InvariantCulture)

    let private failure code stage field (message: string) =
        { Code = code; Stage = stage; Field = field
          Message = if message.Length <= 1024 then message else message.Substring(0, 1024)
          OriginalKernelFailure = None }

    let private zeroCounters =
        { Starts = 0; PhiEntries = 0; MidpointAttempts = 0; BracketUpdates = 0
          LogEntries = 0; ExpEntries = 0; ObjectiveEntries = 0 }

    let private emptyPartial =
        { Target = None; Parameters = None; Bracket = None; Candidate = None
          OriginalObjective = None }

    type private Input =
        { Snapshot: TargetSnapshot; Target: PrecisionGateKernels.ProjectionTarget
          MaximumAttempts: int }

    /// Local state is the bounded diagnostic accumulator, including failed entries.
    /// Every stage appends its actual outcome after preserving in-memory partial work.
    type private RunState() =
        member val Counts = zeroCounters with get, set
        member val Partial = emptyPartial with get, set
        member val Stage = "input" with get, set
        member val Attempt = 0 with get, set
        member val Point: string option = None with get, set
        member val Phi: string option = None with get, set
        member val Trace = ResizeArray<TraceRow>()

    let private runStage (state: RunState) stage (work: unit -> Result<'T, Failure>) =
        state.Stage <- stage
        state.Point <- None
        state.Phi <- None
        if stage <> "midpoint" then state.Attempt <- 0
        let observed =
            try work()
            with ex -> Error(failure "Unexpected" stage None ex.Message)
        let lower, upper =
            match state.Partial.Bracket with
            | Some b -> Some b.LowerBits, Some b.UpperBits
            | None -> None, None
        state.Trace.Add
            { Sequence = state.Trace.Count + 1; Stage = stage; Attempt = state.Attempt
              PointBits = state.Point; PhiBits = state.Phi; LowerBits = lower; UpperBits = upper
              Failure = match observed with Error reason -> Some reason | Ok _ -> None }
        observed

    let private finite (state: RunState) field value =
        if Double.IsFinite value then Ok value
        else Error(failure "NumericalRange" state.Stage (Some field) "nonfinite result")

    let private add state field a b = finite state field (a + b)
    let private subtract state field a b = finite state field (a - b)
    let private multiply (state: RunState) field a b =
        result {
            let! value = finite state field (a * b)
            if a <> 0.0 && b <> 0.0 && value = 0.0 then
                return! Error(failure "NumericalUnderflow" state.Stage (Some field) "nonzero product underflow")
            return value
        }
    let private divide (state: RunState) field a b =
        result {
            if b = 0.0 then
                return! Error(failure "NumericalRange" state.Stage (Some field) "zero denominator")
            let! value = finite state field (a / b)
            if a <> 0.0 && value = 0.0 then
                return! Error(failure "NumericalUnderflow" state.Stage (Some field) "nonzero quotient underflow")
            return value
        }
    let private logarithm (state: RunState) field value =
        state.Counts <- { state.Counts with LogEntries = state.Counts.LogEntries + 1 }
        finite state field (Math.Log value)
    let private exponential (state: RunState) field value =
        state.Counts <- { state.Counts with ExpEntries = state.Counts.ExpEntries + 1 }
        result {
            let! result = finite state field (Math.Exp value)
            if result = 0.0 then
                return! Error(failure "NumericalUnderflow" state.Stage (Some field) "positive exponential underflow")
            return result
        }

    let private phi (state: RunState) b d x =
        state.Counts <- { state.Counts with PhiEntries = state.Counts.PhiEntries + 1 }
        result {
            let! q = exponential state "phi.exp" x
            let! denominator = add state "phi.one-plus-q" 1.0 q
            let! sum = add state "phi.x-plus-q" x q
            let! quotient = divide state "phi.D-over-denominator" d denominator
            let! difference = subtract state "phi.subtract-quotient" sum quotient
            let! p = subtract state "phi.subtract-B" difference b
            state.Phi <- Some(bits p)
            return p, q
        }

    let private originalFailure = function
        | PrecisionGateKernels.InvalidInput(field, detail) ->
            { Kind = "InvalidInput"; Field = field; Detail = Some detail }
        | PrecisionGateKernels.NumericalFailure(field, detail) ->
            { Kind = "NumericalFailure"; Field = field; Detail = Some detail }
        | PrecisionGateKernels.ImproperBelief family ->
            { Kind = "ImproperBelief"; Field = family; Detail = None }

    let private numeric (state: RunState) (input: Input) : Result<Candidate, Failure> =
        state.Counts <- { state.Counts with Starts = state.Counts.Starts + 1 }
        let target = input.Target
        let t, u, k, c = target.Precision, target.Location, target.Linear, target.ExponentialRate
        let mutable parameters: Parameters =
            { LogTBits = None; LogCBits = None; ABits = None; BBits = None; DBits = None }
        let keepParameters update =
            parameters <- update parameters
            state.Partial <- { state.Partial with Parameters = Some parameters }
        let keepBracket l r =
            state.Partial <- { state.Partial with Bracket = Some { LowerBits = bits l; UpperBits = bits r } }
        result {
            let! lt, lc, b, d, initialLower, initialUpper =
                runStage state "parameters" (fun () -> result {
                    for name, value in ["T", t; "U", u; "K", k; "C", c] do
                        if not (Double.IsFinite value) then
                            return! Error(failure "Domain" "parameters" (Some name) "finite target required")
                    for name, value in ["T", t; "C", c] do
                        if value <= 0.0 then
                            return! Error(failure "Domain" "parameters" (Some name) "strictly positive target required")
                    keepParameters id
                    let! lt = logarithm state "log(T)" t
                    keepParameters (fun p -> { p with LogTBits = Some(bits lt) })
                    let! lc = logarithm state "log(C)" c
                    keepParameters (fun p -> { p with LogCBits = Some(bits lc) })
                    let! kt = divide state "K/T" k t
                    let! a = add state "A" u kt
                    keepParameters (fun p -> { p with ABits = Some(bits a) })
                    let! logDifference = subtract state "log(C)-log(T)" lc lt
                    let! b = add state "B" logDifference a
                    keepParameters (fun p -> { p with BBits = Some(bits b) })
                    let! inverseT = divide state "1/T" 1.0 t
                    let! d = divide state "D" inverseT 2.0
                    keepParameters (fun p -> { p with DBits = Some(bits d) })
                    let! lowerArgument = subtract state "B-1" b 1.0
                    let lower = min 0.0 lowerArgument
                    let! upperArgument = add state "B+D" b d
                    let! upper = logarithm state "initial-upper" (max 1.0 upperArgument)
                    keepBracket lower upper
                    return lt, lc, b, d, lower, upper
                })
            let mutable lower = initialLower
            let mutable upper = initialUpper
            let! left, _ = runStage state "left-endpoint" (fun () ->
                state.Point <- Some(bits lower)
                phi state b d lower)
            let! _ = runStage state "right-endpoint" (fun () -> result {
                state.Point <- Some(bits upper)
                let! right, q = phi state b d upper
                if not (lower < upper && left <= 0.0 && right >= 0.0) then
                    return! Error(failure "NoRoundedBracket" "right-endpoint" None "ordered endpoints with rounded signs required")
                return right, q
            })
            let mutable selected: (float * float * string) option = None
            let mutable loopResult: Result<unit, Failure> = Ok()
            while selected.IsNone && Result.isOk loopResult do
                loopResult <- runStage state "midpoint" (fun () -> result {
                    state.Counts <- { state.Counts with MidpointAttempts = state.Counts.MidpointAttempts + 1 }
                    state.Attempt <- state.Counts.MidpointAttempts
                    let! width = subtract state "midpoint.width" upper lower
                    let! half = divide state "midpoint.half-width" width 2.0
                    let! x = add state "midpoint.point" lower half
                    state.Point <- Some(bits x)
                    if not (lower < x && x < upper) then
                        return! Error(failure "ResolutionLimit" "midpoint" (Some "PointBits") "finite strictly interior midpoint required")
                    let! p, q = phi state b d x
                    if p = 0.0 then selected <- Some(x, q, "rounded-zero")
                    else
                        if p < 0.0 then lower <- x else upper <- x
                        state.Counts <- { state.Counts with BracketUpdates = state.Counts.BracketUpdates + 1 }
                        keepBracket lower upper
                        let! updatedWidth = subtract state "stopping.width" upper lower
                        let! scale = add state "stopping.scale" 1.0 (max (abs lower) (abs upper))
                        let! tolerance = multiply state "stopping.tolerance" (Math.ScaleB(1.0, -48)) scale
                        if updatedWidth <= tolerance then selected <- Some(x, q, "rounded-width")
                    if selected.IsNone && state.Counts.MidpointAttempts >= input.MaximumAttempts then
                        return! Error(failure "IterationLimit" "midpoint" None "midpoint attempt limit reached")
                    return ()
                })
            do! loopResult
            let! x, q, stop =
                match selected with
                | Some value -> Ok value
                | None -> Error(failure "Unexpected" "midpoint" None "missing selected midpoint")
            let bracket = { LowerBits = bits lower; UpperBits = bits upper }
            let mutable partialCandidate: PartialCandidate =
                { TargetBits = Some input.Snapshot.TargetBits; LogRatioBits = Some(bits x)
                  RatioBits = Some(bits q); RBits = None; MeanBits = None; VarianceBits = None
                  Bracket = Some bracket; Stop = Some stop; OriginalObjective = None }
            let keepCandidate update =
                partialCandidate <- update partialCandidate
                state.Partial <- { state.Partial with Candidate = Some partialCandidate }
            let! r, mean, variance = runStage state "reconstruction" (fun () -> result {
                keepCandidate id
                let! r = multiply state "R=T*q" t q
                keepCandidate (fun p -> { p with RBits = Some(bits r) })
                let! inverseT = divide state "reconstruction.1/T" 1.0 t
                let! denominator = add state "reconstruction.1+q" 1.0 q
                let! variance = divide state "Variance" inverseT denominator
                keepCandidate (fun p -> { p with VarianceBits = Some(bits variance) })
                let! logRatio = add state "reconstruction.logT+x" lt x
                let! shifted = subtract state "reconstruction.subtract-logC" logRatio lc
                let! halfVariance = divide state "reconstruction.half-variance" variance 2.0
                let! mean = subtract state "Mean" shifted halfVariance
                keepCandidate (fun p -> { p with MeanBits = Some(bits mean) })
                if q <= 0.0 || r <= 0.0 || variance <= 0.0 then
                    return! Error(failure "NumericalRange" "reconstruction" None "positive q, R and variance required")
                return r, mean, variance
            })
            let! objective = runStage state "objective" (fun () ->
                state.Counts <- { state.Counts with ObjectiveEntries = state.Counts.ObjectiveEntries + 1 }
                let observed = PrecisionGateKernels.tryProjectionObjective target { Mean = mean; Variance = variance }
                match observed with
                | Ok value ->
                    let encoded =
                        { ValueBits = bits value.Value; DerivativeMeanBits = bits value.DerivativeMean
                          DerivativeVarianceBits = bits value.DerivativeVariance }
                    state.Partial <- { state.Partial with OriginalObjective = Some(Ok encoded) }
                    keepCandidate (fun p -> { p with OriginalObjective = Some encoded })
                    Ok encoded
                | Error reason ->
                    let original = originalFailure reason
                    state.Partial <- { state.Partial with OriginalObjective = Some(Error original) }
                    Error { failure "ObjectiveRefusal" "objective" (Some original.Field) "original objective refused" with OriginalKernelFailure = Some original })
            return
                { TargetBits = input.Snapshot.TargetBits; LogRatioBits = bits x; RatioBits = bits q
                  RBits = bits r; MeanBits = bits mean; VarianceBits = bits variance
                  Bracket = bracket; Stop = stop; OriginalObjective = objective }
        }

    let private canonicalRational (num: BigInteger) (den: BigInteger) : Rational =
        let gcd = BigInteger.GreatestCommonDivisor(BigInteger.Abs num, den)
        { Num = (num / gcd).ToString(CultureInfo.InvariantCulture)
          Den = (den / gcd).ToString(CultureInfo.InvariantCulture) }

    let private exactDyadic (value: float) =
        let raw = uint64 (BitConverter.DoubleToInt64Bits value)
        let exponent = int ((raw >>> 52) &&& 0x7FFUL)
        let fraction = raw &&& 0xFFFFFFFFFFFFFUL
        let significand = if exponent = 0 then bigint fraction else bigint (fraction ||| 0x10000000000000UL)
        let shift = if exponent = 0 then -1074 else exponent - 1023 - 52
        let signed = if raw >>> 63 = 0UL then significand else -significand
        if shift < 0 then signed, BigInteger.One <<< -shift
        else signed <<< shift, BigInteger.One

    let private decimalPattern =
        Regex(@"\A-?(0|[1-9][0-9]*)(\.[0-9]+)?(e[+-]?[0-9]+)?\z",
              RegexOptions.CultureInvariant ||| RegexOptions.NonBacktracking)

    let private parseDecimal field (literal: string) =
        let wire message = Error(failure "Wire" "input" (Some field) message)
        if isNull literal || literal.Length = 0 || literal.Length > 128
           || (literal |> Seq.exists (fun c -> int c > 127))
           || not (decimalPattern.IsMatch literal) then
            wire "registered ASCII decimal grammar and 128-character bound required"
        else
            let split = literal.Split('e')
            let exponentText = if split.Length = 1 then "0" else split.[1]
            let magnitude = exponentText.TrimStart([| '+'; '-' |]).TrimStart('0')
            if magnitude.Length > 3 || (magnitude.Length = 3 && String.CompareOrdinal(magnitude, "400") > 0) then
                wire "absolute exponent must not exceed 400"
            else
                // Integer construction occurs only after lexical length and exponent admission.
                let exponent = Int32.Parse(exponentText, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture)
                let mantissa = split.[0]
                let dot = mantissa.IndexOf('.', StringComparison.Ordinal)
                let fractionalDigits = if dot < 0 then 0 else mantissa.Length - dot - 1
                let integer = BigInteger.Parse(mantissa.Replace(".", "", StringComparison.Ordinal), CultureInfo.InvariantCulture)
                let scale = exponent - fractionalDigits
                let numerator, denominator =
                    if scale < 0 then integer, BigInteger.Pow(10I, -scale)
                    else integer * BigInteger.Pow(10I, scale), BigInteger.One
                let parsed, value = Double.TryParse(literal, NumberStyles.Float, CultureInfo.InvariantCulture)
                if not parsed || not (Double.IsFinite value) then
                    Error(failure "NumericalRange" "input" (Some field) "decimal does not render to finite binary64")
                else Ok(value, numerator, denominator)

    let private strictDocument (raw: byte array) =
        result {
            if raw.Length > 65536 then
                return! Error(failure "Wire" "input" None "64-KiB byte limit exceeded")
            try
                let text = UTF8Encoding(false, true).GetString raw
                use doc = JsonDocument.Parse(text, JsonDocumentOptions(MaxDepth = 16))
                let rec unique path (node: JsonElement) =
                    result {
                        if node.ValueKind = JsonValueKind.Object then
                            let names = HashSet<string>(StringComparer.Ordinal)
                            for property in node.EnumerateObject() do
                                let field = if path = "" then property.Name else path + "." + property.Name
                                if not (names.Add property.Name) then
                                    return! Error(failure "Wire" "input" (Some field) "duplicate property")
                                do! unique field property.Value
                        elif node.ValueKind = JsonValueKind.Array then
                            for item in node.EnumerateArray() do do! unique path item
                    }
                do! unique "" doc.RootElement
                return doc.RootElement.Clone()
            with
            | :? DecoderFallbackException as ex -> return! Error(failure "Wire" "input" None ex.Message)
            | :? JsonException as ex -> return! Error(failure "Wire" "input" None ex.Message)
            | :? InvalidOperationException as ex -> return! Error(failure "Wire" "input" None ex.Message)
        }

    let private exactKeys field names (node: JsonElement) =
        if node.ValueKind <> JsonValueKind.Object then
            Error(failure "Wire" "input" (Some field) "object required")
        else
            let actual = node.EnumerateObject() |> Seq.map (fun p -> p.Name) |> Set.ofSeq
            if actual = Set.ofList names then Ok()
            else Error(failure "Wire" "input" (Some field) "exact registered property set required")

    let private stringField field (node: JsonElement) =
        try
            if node.ValueKind = JsonValueKind.String then Ok(node.GetString())
            else Error(failure "Wire" "input" (Some field) "string required")
        with :? InvalidOperationException as ex ->
            // JsonElement defers malformed UTF-16 escape rejection until GetString.
            Error(failure "Wire" "input" (Some field) ex.Message)

    let private admitInput expectedCaseId (raw: byte array) =
        result {
            let! root = strictDocument raw
            do! exactKeys "Input" ["Schema"; "Id"; "Parameters"; "Profile"] root
            let! schema = stringField "Schema" (root.GetProperty "Schema")
            let! caseId = stringField "Id" (root.GetProperty "Id")
            let! profile = stringField "Profile" (root.GetProperty "Profile")
            if schema <> "zeta.precision-projection.input.v1" then
                return! Error(failure "Wire" "input" (Some "Schema") "registered input schema required")
            if caseId <> expectedCaseId then
                return! Error(failure "TargetMismatch" "input" (Some "Id") "numeric subject identity differs from caller expectation")
            if not (List.contains profile ["default"; "native-one"; "reference-one"]) then
                return! Error(failure "Wire" "input" (Some "Profile") "registered profile required")
            let parameters = root.GetProperty "Parameters"
            do! exactKeys "Parameters" ["T"; "U"; "K"; "C"] parameters
            let mutable requested = Map.empty
            let mutable targetBits = Map.empty
            let mutable dyadics = Map.empty
            let mutable deltas = Map.empty
            let mutable values = Map.empty
            for name in ["T"; "U"; "K"; "C"] do
                let! literal = stringField ("Parameters." + name) (parameters.GetProperty name)
                let! value, numerator, denominator = parseDecimal ("Parameters." + name) literal
                let dyadicNum, dyadicDen = exactDyadic value
                requested <- requested.Add(name, literal)
                targetBits <- targetBits.Add(name, bits value)
                dyadics <- dyadics.Add(name, canonicalRational dyadicNum dyadicDen)
                deltas <- deltas.Add(name, canonicalRational (dyadicNum * denominator - numerator * dyadicDen) (dyadicDen * denominator))
                values <- values.Add(name, value)
            return
                { Snapshot = { RequestedParameters = requested; TargetBits = targetBits
                               DyadicTarget = dyadics; ConversionDelta = deltas }
                  Target = { Precision = values.["T"]; Location = values.["U"]
                             Linear = values.["K"]; ExponentialRate = values.["C"] }
                  MaximumAttempts = if profile = "native-one" then 1 else 256 }
        }

    let private hashSpelling (value: string) =
        not (isNull value) && value.Length = 64
        && (value |> Seq.forall (fun c -> (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F')))

    let private admitBindings (bindings: Map<string, string>) =
        if isNull (box bindings) then
            Error(failure "SourceMismatch" "input" (Some "Bindings") "independent bindings required")
        elif bindings.Count > 1024 || (bindings |> Map.exists (fun key value -> String.IsNullOrEmpty key || key.Length > 65536 || not (hashSpelling value))) then
            Error(failure "SourceMismatch" "input" (Some "Bindings") "named uppercase SHA256 bindings required")
        elif (bindings |> Map.fold (fun total key _ -> total + int64 (Encoding.UTF8.GetByteCount key) + 70L) 2L) > 65536L then
            Error(failure "SourceMismatch" "input" (Some "Bindings") "64-KiB logical caller binding limit exceeded")
        elif Map.tryFind "ProtocolSha256" bindings <> Some ProtocolSha256
             || Map.tryFind DecimalClarificationPath bindings <> Some DecimalClarificationSha256
             || Map.tryFind RenderedZeroClarificationPath bindings <> Some RenderedZeroClarificationSha256 then
            Error(failure "SourceMismatch" "input" (Some "Bindings") "registered protocol and admission clarifications required")
        else Ok()

    /// Parse a caller's bounded expected binding file. This checks its wire form
    /// and registered declarations, not that these hashes describe loaded code.
    let tryReadBindings (raw: byte array) : Result<Map<string, string>, Failure> =
        if isNull raw then Error(failure "Wire" "input" (Some "Bindings") "bytes required")
        else
            try
                result {
                    let! root = strictDocument raw
                    if root.ValueKind <> JsonValueKind.Object then
                        return! Error(failure "Wire" "input" (Some "Bindings") "object required")
                    let mutable bindings = Map.empty
                    for property in root.EnumerateObject() do
                        let! value = stringField ("Bindings." + property.Name) property.Value
                        bindings <- bindings.Add(property.Name, value)
                    do! admitBindings bindings
                    return bindings
                }
            with ex -> Error(failure "Unexpected" "input" (Some "Bindings") ex.Message)

    /// Caller expectations must come from independently admitted metadata. Valid
    /// caller metadata yields a complete receipt even when its actual input refuses.
    /// Source/runtime custody remains the coordinator's separate obligation.
    let tryNativeCall (raw: byte array) expectedInputSha256 expectedCaseId expectedBindings
        : Result<NativeReceipt, Failure> =
        result {
            if isNull raw || String.IsNullOrEmpty expectedCaseId || expectedCaseId.Length > 65536
               || Encoding.UTF8.GetByteCount(expectedCaseId) > 65536 || not (hashSpelling expectedInputSha256) then
                return! Error(failure "Wire" "input" None "bytes, expected subject and uppercase expected hash required")
            do! admitBindings expectedBindings
            let state = RunState()
            let observed =
                result {
                    let! input = runStage state "input" (fun () -> result {
                        if raw.Length > 65536 then
                            return! Error(failure "Wire" "input" None "64-KiB input limit exceeded")
                        let actualHash = Convert.ToHexString(SHA256.HashData raw)
                        if actualHash <> expectedInputSha256 then
                            return! Error(failure "TargetMismatch" "input" (Some "InputSha256") "actual input hash differs from caller expectation")
                        let! input = admitInput expectedCaseId raw
                        state.Partial <- { state.Partial with Target = Some input.Snapshot }
                        return input
                    })
                    return! numeric state input
                }
            return
                { Schema = "zeta.precision-projection.native.v1"; CaseId = expectedCaseId
                  InputSha256 = expectedInputSha256; Bindings = expectedBindings
                  Outcome = match observed with Ok value -> Candidate value | Error reason -> Refused(reason, state.Partial)
                  Counters = state.Counts; Trace = state.Trace.ToArray() }
        }

    let private objectOf (properties: (string * obj) list) : obj =
        let result = Dictionary<string, obj>(StringComparer.Ordinal)
        for key, value in properties do result.Add(key, value)
        box result
    let private optional convert value : obj =
        match value with Some present -> convert present | None -> null
    let private stringMap (values: Map<string, string>) =
        values |> Map.toList |> List.map (fun (key, value) -> key, box value) |> objectOf
    let private rationalObject (value: Rational) = objectOf ["Num", box value.Num; "Den", box value.Den]
    let private rationalMap values =
        values |> Map.toList |> List.map (fun (key, value) -> key, rationalObject value) |> objectOf
    let private targetObject (value: TargetSnapshot) =
        objectOf ["RequestedParameters", stringMap value.RequestedParameters
                  "TargetBits", stringMap value.TargetBits; "DyadicTarget", rationalMap value.DyadicTarget
                  "ConversionDelta", rationalMap value.ConversionDelta]
    let private originalObject (value: OriginalKernelFailure) =
        objectOf ["Kind", box value.Kind; "Field", box value.Field; "Detail", optional box value.Detail]
    let private failureObject (value: Failure) =
        objectOf ["Code", box value.Code; "Stage", box value.Stage; "Field", optional box value.Field
                  "Message", box value.Message; "OriginalKernelFailure", optional originalObject value.OriginalKernelFailure]
    let private bracketObject (value: Bracket) =
        objectOf ["LowerBits", box value.LowerBits; "UpperBits", box value.UpperBits]
    let private objectiveObject (value: Objective) =
        objectOf ["ValueBits", box value.ValueBits; "DerivativeMeanBits", box value.DerivativeMeanBits
                  "DerivativeVarianceBits", box value.DerivativeVarianceBits]
    let private candidateObject (value: Candidate) =
        objectOf ["TargetBits", stringMap value.TargetBits; "LogRatioBits", box value.LogRatioBits
                  "RatioBits", box value.RatioBits; "RBits", box value.RBits; "MeanBits", box value.MeanBits
                  "VarianceBits", box value.VarianceBits; "Bracket", bracketObject value.Bracket
                  "Stop", box value.Stop; "OriginalObjective", objectiveObject value.OriginalObjective]
    let private partialCandidateObject (value: PartialCandidate) =
        objectOf ["TargetBits", optional stringMap value.TargetBits; "LogRatioBits", optional box value.LogRatioBits
                  "RatioBits", optional box value.RatioBits; "RBits", optional box value.RBits
                  "MeanBits", optional box value.MeanBits; "VarianceBits", optional box value.VarianceBits
                  "Bracket", optional bracketObject value.Bracket; "Stop", optional box value.Stop
                  "OriginalObjective", optional objectiveObject value.OriginalObjective]
    let private parametersObject (value: Parameters) =
        objectOf ["LogTBits", optional box value.LogTBits; "LogCBits", optional box value.LogCBits
                  "ABits", optional box value.ABits; "BBits", optional box value.BBits; "DBits", optional box value.DBits]
    let private objectiveObservation = function
        | Ok value -> objectOf ["Kind", box "returned"; "Value", objectiveObject value]
        | Error reason -> objectOf ["Kind", box "refused"; "Failure", originalObject reason]
    let private partialObject (value: Partial) =
        objectOf ["Target", optional targetObject value.Target; "Parameters", optional parametersObject value.Parameters
                  "Bracket", optional bracketObject value.Bracket; "Candidate", optional partialCandidateObject value.Candidate
                  "OriginalObjective", optional objectiveObservation value.OriginalObjective]
    let private traceObject (value: TraceRow) =
        objectOf ["Sequence", box value.Sequence; "Stage", box value.Stage; "Attempt", box value.Attempt
                  "PointBits", optional box value.PointBits; "PhiBits", optional box value.PhiBits
                  "LowerBits", optional box value.LowerBits; "UpperBits", optional box value.UpperBits
                  "Failure", optional failureObject value.Failure]
    let private receiptObject (value: NativeReceipt) =
        let outcome =
            match value.Outcome with
            | Candidate candidate -> objectOf ["Kind", box "candidate"; "Value", candidateObject candidate]
            | Refused(reason, partial) ->
                objectOf ["Kind", box "refused"; "Failure", failureObject reason; "Partial", partialObject partial]
        objectOf ["Schema", box value.Schema; "CaseId", box value.CaseId; "InputSha256", box value.InputSha256
                  "Bindings", stringMap value.Bindings; "Outcome", outcome; "Counters", box value.Counters
                  "Trace", box (value.Trace |> Array.map traceObject)]

    /// Encode only the passed in-memory receipt, preserving explicit null fields.
    /// A refusal does not destroy that receipt. The caller must retain it and any
    /// failed publication separately. This is a byte ceiling, not a peak-allocation bound.
    let tryEncode (receipt: NativeReceipt) : Result<byte array, Failure> =
        try
            let bytes = JsonSerializer.SerializeToUtf8Bytes(receiptObject receipt)
            if bytes.Length > 2 * 1024 * 1024 then
                Error(failure "ResultTooLarge" "encoding" None "complete receipt exceeds two MiB")
            else Ok bytes
        with ex -> Error(failure "Unexpected" "encoding" None ex.Message)

    /// Separate bounded API/command failure serialization, never a native success.
    let tryEncodeFailure (reason: Failure) : Result<byte array, Failure> =
        try
            let bytes = JsonSerializer.SerializeToUtf8Bytes(failureObject reason)
            if bytes.Length > 65536 then
                Error(failure "ResultTooLarge" "encoding" None "failure record exceeds 64 KiB")
            else Ok bytes
        with ex -> Error(failure "Unexpected" "encoding" None ex.Message)
