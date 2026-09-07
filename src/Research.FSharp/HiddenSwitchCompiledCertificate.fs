namespace Zeta.Research

open System
open System.Collections.Generic
open System.Globalization
open System.IO
open System.Numerics
open System.Security.Cryptography
open System.Text.Encodings.Web
open System.Text.Json

/// Full finite-model certificate reconstruction. Exact rational algebra and
/// binary64 neighbor selection are independent of the measured floating tree.
/// This admits numeric proof data only; source and executing-code admission are
/// separate obligations of the archived runner.
[<RequireQualifiedAccess>]
module HiddenSwitchCompiledCertificate =
    [<Struct>]
    type private Rational = { N: BigInteger; D: BigInteger }
    // Every denominator below is a nonzero internal constant or a product of
    // positive rational denominators. Parsed certificate data never enters q.
    let private q n d =
        let sign = if d < 0I then -1I else 1I
        let divisor = BigInteger.GreatestCommonDivisor(n, d)
        { N = sign * n / divisor; D = sign * d / divisor }
    let private r (n: int) (d: int) = q (bigint n) (bigint d)
    let private whole n = r n 1
    let private zero = whole 0
    let private one = whole 1
    let private add a b = q (a.N * b.D + b.N * a.D) (a.D * b.D)
    let private sub a b = q (a.N * b.D - b.N * a.D) (a.D * b.D)
    let private mul a b = q (a.N * b.N) (a.D * b.D)
    let private div a b = q (a.N * b.D) (a.D * b.N)
    let private scale n a = mul (whole n) a
    let private compareQ a b = compare (a.N * b.D) (b.N * a.D)
    let private le a b = compareQ a b <= 0
    let private lt a b = compareQ a b < 0
    let private absolute a = { a with N = BigInteger.Abs a.N }

    type private Value =
        | Null
        | Boolean of bool
        | Number of int
        | Text of string
        | Array of Value[]
        | Object of (string * Value)[]

    let private obj values = Object(Array.ofList values)
    let private rational value =
        obj [ "Num", Text(value.N.ToString(CultureInfo.InvariantCulture))
              "Den", Text(value.D.ToString(CultureInfo.InvariantCulture)) ]
    let private optional = function Some value -> Number value | None -> Null
    let private textArray values = values |> List.map Text |> List.toArray |> Array
    let private bits (value: uint64) = value.ToString("X16", CultureInfo.InvariantCulture)
    let private fail code detail = Error(HiddenSwitchCompiledReceipt.failure "numeric-certificate" code detail)

    type private Alpha = { Action: int; Zero: int option; One: int option; V0: Rational; V1: Rational }
    let rec private alphas effect depth =
        if depth = 1 then
            [| { Action = 0; Zero = None; One = None; V0 = zero; V1 = one }
               { Action = 1; Zero = None; One = None; V0 = r -1 4; V1 = r -1 4 } |]
        else
            let children = alphas effect (depth - 1)
            [| for action in 0 .. 1 do
                   for cueZero in 0 .. children.Length - 1 do
                       for cueOne in 0 .. children.Length - 1 do
                           let hidden state =
                               let mutable value = if action = 0 then whole state else r -1 4
                               let intended = state ^^^ (if effect && action = 1 then 1 else 0)
                               for successor in 0 .. 1 do
                                   let transition = r (if successor = intended then 7 else 1) 8
                                   for cue in 0 .. 1 do
                                       let emission = r (if cue = successor then 3 else 1) 4
                                       let child = children.[if cue = 0 then cueZero else cueOne]
                                       let continuation = if successor = 0 then child.V0 else child.V1
                                       value <- add value (mul transition (mul emission continuation))
                               value
                           yield { Action = action; Zero = Some cueZero; One = Some cueOne
                                   V0 = hidden 0; V1 = hidden 1 } |]

    let private pieces effect depth action =
        if depth = 1 then
            [| zero, one, (if action = 0 then zero else r -1 4), (if action = 0 then one else zero) |]
        elif depth = 2 then
            let intercept, slope =
                if action = 0 then r 1 8, r 7 4
                elif effect then r 5 8, r -3 4
                else r -1 8, r 3 4
            [| zero, one, intercept, slope |]
        elif not effect then
            let intercept, slope = if action = 0 then r 11 32, r 37 16 else r 3 32, r 21 16
            [| zero, one, intercept, slope |]
        elif action = 0 then
            [| zero, r 17 42, r 39 64, r 53 32; r 17 42, one, r 11 32, r 37 16 |]
        else
            [| zero, r 25 42, r 45 32, r -21 16; r 25 42, one, r 65 64, r -21 32 |]

    let private model ensure effect depth =
        let vectors = alphas effect depth
        ensure "complete ordered alpha roster" (vectors.Length = (if depth = 1 then 2 elif depth = 2 then 8 else 128))
        let candidates =
            vectors |> Array.mapi (fun index vector ->
                ensure "hidden-value range" (le (r -depth 4) vector.V0 && le vector.V0 (whole depth) && le (r -depth 4) vector.V1 && le vector.V1 (whole depth))
                ensure "contingent Lipschitz bound" (le (absolute (sub vector.V1 vector.V0)) (r (5 * depth) 4))
                obj [ "Index", Number index; "Action", Number vector.Action
                      "ZeroChild", optional vector.Zero; "OneChild", optional vector.One
                      "Values", Array [| rational vector.V0; rational vector.V1 |] ])
        let envelopes = ResizeArray<Value>()
        for action in 0 .. 1 do
            let intervals = pieces effect depth action
            let first, _, _, _ = intervals.[0]
            let _, last, _, _ = intervals.[intervals.Length - 1]
            ensure "envelope endpoints" (first = zero && last = one)
            for index in 1 .. intervals.Length - 1 do
                let _, priorRight, _, _ = intervals.[index - 1]
                let nextLeft, _, _, _ = intervals.[index]
                ensure "envelope coverage" (priorRight = nextLeft)
            for left, right, intercept, slope in intervals do
                let chosen = vectors |> Array.tryFindIndex (fun candidate -> candidate.Action = action && candidate.V0 = intercept && candidate.V1 = add intercept slope)
                ensure "envelope candidate and interval" (chosen.IsSome && lt left right)
                let margins =
                    [| for endpoint in [left; right] do
                           for candidate in vectors do
                               if candidate.Action = action then
                                   let value = add (mul (sub one endpoint) candidate.V0) (mul endpoint candidate.V1)
                                   let margin = sub (add intercept (mul slope endpoint)) value
                                   ensure "full candidate endpoint dominance" (le zero margin)
                                   yield rational margin |]
                envelopes.Add(obj [ "Action", Number action; "Left", rational left; "Right", rational right
                                    "Intercept", rational intercept; "Slope", rational slope
                                    "CandidateIndex", Number(Option.defaultValue -1 chosen); "EndpointMargins", Array margins ])
        let cuts =
            [| for action in 0 .. 1 do
                   for left, right, _, _ in pieces effect depth action do yield left; yield right |]
            |> Array.distinct |> Array.sortWith compareQ
        let gaps =
            [| for index in 0 .. cuts.Length - 2 do
                   let left, right = cuts.[index], cuts.[index + 1]
                   let midpoint = div (add left right) (whole 2)
                   let line action =
                       pieces effect depth action
                       |> Array.tryFind (fun (lo, hi, _, _) -> le lo midpoint && le midpoint hi)
                       |> Option.map (fun (_, _, c, m) -> c, m)
                   let harvest, switch = line 0, line 1
                   ensure "gap interval coverage" (harvest.IsSome && switch.IsSome)
                   let hc, hm = Option.defaultValue (zero, zero) harvest
                   let sc, sm = Option.defaultValue (zero, zero) switch
                   let c, m = sub sc hc, sub sm hm
                   let expected =
                       if not effect || depth = 1 then r -1 4, whole -1
                       elif depth = 2 then r 1 2, r -5 2
                       elif lt midpoint (r 17 42) then r 51 64, r -95 32
                       elif lt midpoint (r 25 42) then r 17 16, r -29 8
                       else r 43 64, r -95 32
                   ensure "full-domain monotone gap" ((c, m) = expected && lt m zero)
                   yield obj [ "Left", rational left; "Right", rational right; "Intercept", rational c; "Slope", rational m ] |]
        obj [ "Effect", Boolean effect; "Depth", Number depth; "Candidates", Array candidates
              "Envelopes", Array(envelopes.ToArray()); "GapPieces", Array gaps ]

    let private bounds ensure epsilon =
        let eta = q 1I (1I <<< 48)
        let obligations = ResizeArray<Value>()
        let check name left relation right =
            ensure name (if relation = "=" then left = right elif relation = "<" then lt left right else le left right)
            obligations.Add(obj [ "Name", Text name; "Left", rational left; "Relation", Text relation; "Right", rational right ])
        let prediction, mass = scale 3 eta, scale 4 eta
        let posteriorSame = add (div (add eta mass) (r 1 8)) eta
        let posterior = add posteriorSame (scale 3 prediction)
        let probability = add mass (mul (r 1 2) prediction)
        check "prediction-three-roundings" (mul (add (r 3 4) (whole 2)) eta) "<=" prediction
        check "mass-four-roundings" (mul (add (r 1 4) (whole 3)) eta) "<=" mass
        check "posterior-Lipschitz" (div (r 3 16) (mul (r 1 4) (r 1 4))) "=" (whole 3)
        check "mass-Lipschitz" (sub (r 3 4) (r 1 4)) "=" (r 1 2)
        check "exact-recursive-posterior-lower" (div (mul (r 1 4) (r 1 8)) (sub (r 3 4) (mul (r 1 2) (r 1 8)))) "=" (r 1 22)
        check "exact-recursive-posterior-upper" (div (mul (r 3 4) (r 7 8)) (add (r 1 4) (mul (r 1 2) (r 7 8)))) "=" (r 21 22)
        check "computed-mass-positive" (r 1 8) "<" (sub (r 1 4) mass)
        check "computed-mass-less-than-one" (add (r 3 4) mass) "<" one
        check "posterior-same-prior" posteriorSame "=" (scale 41 eta)
        check "posterior-including-prior" posterior "=" (scale 50 eta)
        check "probability-including-prior" probability "<=" (scale 6 eta)
        check "predicted-prior-lower" zero "<" (sub (r 1 8) prediction)
        check "predicted-prior-upper" (add (r 7 8) prediction) "<" one
        check "recursive-posterior-lower" zero "<" (sub (r 1 22) posterior)
        check "recursive-posterior-upper" (add (r 21 22) posterior) "<" one
        check "elementary-absolute-rounding-at-eight" (q 1I (1I <<< 50)) "<=" eta
        let errors = ResizeArray<Rational>()
        errors.Add zero
        let depths = ResizeArray<Value>()
        for depth in 1 .. 3 do
            let n = depth - 1
            let lipschitz = r (5 * n) 4
            if n > 0 then
                let continuation = add (scale 2 errors.[errors.Count - 1]) (mul (add (scale 100 lipschitz) (whole (6 * n + 1))) eta)
                let error = add (scale 2 continuation) (scale 2 eta)
                check ($"depth{depth}-recurrence") error "=" (add (scale 4 errors.[errors.Count - 1]) (scale (262 * n + 4) eta))
                errors.Add error
                let childBound = add (add (whole n) errors.[n - 1]) (mul lipschitz posterior)
                check ($"depth{depth}-probability-range") (add (r 3 4) mass) "<" (whole 2)
                check ($"depth{depth}-weighted-sum-range-eight") (add (add one (scale 2 (mul (add (r 3 4) mass) childBound))) (scale 4 eta)) "<" (whole 8)
            let error = errors.[depth - 1]
            let rho = add (scale 2 error) eta
            check ($"depth{depth}-trivial-harvest") (add (r -1 4) rho) "<=" epsilon
            depths.Add(obj [ "Depth", Number depth; "ChildLipschitz", rational lipschitz; "Error", rational error; "Rho", rational rho ])
        check "depth2-error-fixed" errors.[1] "=" (scale 266 eta)
        check "depth3-error-fixed" errors.[2] "=" (scale 1592 eta)
        let value =
            obj [ "Eta", rational eta; "PredictionError", rational prediction; "MassError", rational mass
                  "PosteriorSamePriorError", rational posteriorSame; "PosteriorError", rational posterior
                  "ProbabilityError", rational (scale 6 eta); "Depths", Array(depths.ToArray())
                  "Obligations", Array(obligations.ToArray())
                  "StructuralPremises", textArray [
                      "RN is monotone; likelihood products are nonnegative"
                      "rounded mass >= each rounded numerator; RN(numerator/mass) remains in [0,1]"
                      "exact contingent hidden values lie in [-d/4,d]; slopes <=5d/4"
                      "exact V lies in [0,d]; maximum is nonexpansive"
                      "source expression order and actual runtime IEEE premises are separately admitted" ] ]
        value, [| for error in errors -> add (scale 2 error) eta |]

    // Positive finite binary64 encodings through one are monotonically ordered.
    // Search uses exact rational comparisons, including gradual underflow.
    let private valueOfBits (value: uint64) =
        let exponent = int ((value >>> 52) &&& 0x7FFUL)
        let fraction = value &&& 0x000FFFFFFFFFFFFFUL
        let significand = bigint (if exponent = 0 then fraction else fraction ||| 0x0010000000000000UL)
        let shift = if exponent = 0 then -1074 else exponent - 1075
        if shift >= 0 then q (significand <<< shift) 1I else q significand (1I <<< -shift)
    let private floorBits value =
        let mutable low = 0UL
        let mutable high = 0x3FF0000000000000UL
        while low < high do
            let middle = low + (high - low + 1UL) / 2UL
            if le (valueOfBits middle) value then low <- middle else high <- middle - 1UL
        low
    let private nearestBits value =
        let below = floorBits value
        if below = 0x3FF0000000000000UL then below
        else
            let comparison = compareQ (sub value (valueOfBits below)) (sub (valueOfBits (below + 1UL)) value)
            if comparison < 0 || (comparison = 0 && below % 2UL = 0UL) then below else below + 1UL

    /// Fixed protocol hand centers only; this introduces no general rational
    /// parser/API and is never called by the measured action service.
    let internal handCenterBits () =
        let epsilon = valueOfBits (BitConverter.DoubleToUInt64Bits 1e-12)
        [| r 1 5; r 51 190; r 17 42; r 25 42
           sub (r 1 5) (mul (r 2 5) epsilon)
           sub (r 51 190) (mul (r 32 95) epsilon) |] |> Array.map nearestBits

    type GuardSet = private GuardSet of float * float * float * float
    type VerifiedCertificate = private { NumericSha256: string; NumericGuards: GuardSet }
    let numericSha256 certificate = certificate.NumericSha256
    let guards certificate = certificate.NumericGuards
    let internal depthTwo (GuardSet(s, h, _, _)) = struct(s, h)
    let internal depthThree (GuardSet(_, _, s, h)) = struct(s, h)

    let private guardData ensure epsilon (rhos: Rational[]) =
        let admitted = ResizeArray<uint64 * uint64>()
        let rows =
            [| for depth, center, factor in [2, r 1 5, r 2 5; 3, r 51 190, r 32 95] do
                   let minus = sub center (mul factor (add epsilon rhos.[depth - 1]))
                   let plus = sub center (mul factor (sub epsilon rhos.[depth - 1]))
                   let intercept, slope = if depth = 2 then r 1 2, r -5 2 else r 51 64, r -95 32
                   ensure "rational guard cut equations" (add intercept (mul slope minus) = add epsilon rhos.[depth - 1] && add intercept (mul slope plus) = sub epsilon rhos.[depth - 1])
                   let lower = floorBits minus
                   let switch = if valueOfBits lower = minus then lower - 1UL else lower
                   let upper = floorBits plus
                   let harvest = if valueOfBits upper = plus then upper else upper + 1UL
                   let next, prior = switch + 1UL, harvest - 1UL
                   ensure "inward guard neighbors" (lt zero (valueOfBits switch) && lt (valueOfBits switch) minus && le minus (valueOfBits next) && lt (valueOfBits prior) plus && le plus (valueOfBits harvest) && lt (valueOfBits harvest) one && switch < harvest && (depth <> 3 || lt plus (r 17 42)))
                   admitted.Add(switch, harvest)
                   yield obj [ "Depth", Number depth; "Rminus", rational minus; "Rplus", rational plus
                               "SmaxBits", Text(bits switch); "SnextBits", Text(bits next)
                               "HprevBits", Text(bits prior); "HminBits", Text(bits harvest)
                               "Relations", textArray ["Smax<Rminus<=Snext"; "Hprev<Rplus<=Hmin"; "Smax<Hmin"; "effective-depth3:Rplus<17/42"] ] |]
        let s2, h2 = admitted.[0]
        let s3, h3 = admitted.[1]
        Array rows, GuardSet(BitConverter.UInt64BitsToDouble s2, BitConverter.UInt64BitsToDouble h2, BitConverter.UInt64BitsToDouble s3, BitConverter.UInt64BitsToDouble h3)

    let private protocol = "8BBDFE44A0844DD8CE4F6C5DD77B060A56E5B84EA94EA7A6FDBB482AEC9D738A"
    let private validBindings (bindings: Map<string, string>) =
        not (System.Object.ReferenceEquals(bindings, null)) && not bindings.IsEmpty
        && Map.tryFind "ProtocolSha256" bindings = Some protocol
        && (bindings |> Map.forall (fun key digest ->
            not (String.IsNullOrEmpty key) && (key |> Seq.forall (fun c -> c >= '!' && c <= '~'))
            && not (isNull digest) && digest.Length = 64
            && (digest |> Seq.forall (fun c -> (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F')))))

    let private derive bindings =
        let failures = ResizeArray<string>()
        let ensure name condition = if not condition then failures.Add name
        let epsilonBits = nearestBits (q 1I 1000000000000I)
        let epsilon = valueOfBits epsilonBits
        let numericBounds, rhos = bounds ensure epsilon
        let guardRows, numericGuards = guardData ensure epsilon rhos
        let tree =
            obj [ "Schema", Text "zeta.hidden-switch.compiled.numeric.v1"
                  "Bindings", Object(bindings |> Map.toArray |> Array.map (fun (key, value) -> key, Text value))
                  "Model", obj [ "Drift", rational (r 1 8); "CueAccuracy", rational (r 3 4); "SwitchReward", rational (r -1 4)
                                 "Horizon", Number 16; "EpsilonBits", Text(bits epsilonBits) ]
                  "ExpressionGraph", textArray [
                      "predict.u = effect && action==1 ? RN(1-b) : b"
                      "predict.prior = RN(1/8 + RN((3/4)*u))"
                      "condition.l1,l0 = cue==1 ? (3/4,1/4) : (1/4,3/4)"
                      "condition.mass = RN(RN(l1*prior) + RN(l0*RN(1-prior)))"
                      "condition.posterior = RN(RN(l1*prior)/mass)"
                      "tree.immediate = action==0 ? b : -1/4"
                      "tree.depth1 = immediate; no prediction or conditioning"
                      "tree.zero = RN(probability0*max(child0.H,child0.S))"
                      "tree.one = RN(probability1*max(child1.H,child1.S))"
                      "tree.value = RN(RN(immediate+zero)+one)"
                      "tree.order = H then S; cue0 then cue1; complete unpruned recursion"
                      "select = RN(QS-QH)>epsilon ? 1 : 0; max is numerical, not tolerance-selected" ]
                  "Bounds", numericBounds
                  "Models", Array [| for effect in [true; false] do for depth in 1 .. 3 do yield model ensure effect depth |]
                  "Guards", guardRows ]
        if failures.Count > 0 then fail "derivation" (String.Join("; ", failures)) else Ok(tree, numericGuards)

    let rec private matches expected (actual: JsonElement) =
        match expected with
        | Null -> actual.ValueKind = JsonValueKind.Null
        | Boolean value -> actual.ValueKind = (if value then JsonValueKind.True else JsonValueKind.False)
        | Number value ->
            let mutable parsed = 0
            actual.ValueKind = JsonValueKind.Number && actual.TryGetInt32(&parsed) && parsed = value
        | Text value -> actual.ValueKind = JsonValueKind.String && String.Equals(actual.GetString(), value, StringComparison.Ordinal)
        | Array values -> actual.ValueKind = JsonValueKind.Array && actual.GetArrayLength() = values.Length && Seq.forall2 matches values (actual.EnumerateArray())
        | Object properties ->
            if actual.ValueKind <> JsonValueKind.Object then false
            else
                let seen = HashSet<string>(StringComparer.Ordinal)
                let actualProperties = actual.EnumerateObject() |> Seq.toArray
                actualProperties.Length = properties.Length
                && (actualProperties |> Array.forall (fun property -> seen.Add property.Name))
                && (properties |> Array.forall (fun (name, value) ->
                    let mutable property = Unchecked.defaultof<JsonElement>
                    actual.TryGetProperty(name, &property) && matches value property))

    let private encode value =
        use stream = new MemoryStream()
        use writer = new Utf8JsonWriter(stream, JsonWriterOptions(Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping))
        let rec write node =
            match node with
            | Null -> writer.WriteNullValue()
            | Boolean value -> writer.WriteBooleanValue value
            | Number value -> writer.WriteNumberValue value
            | Text value -> writer.WriteStringValue value
            | Array values ->
                writer.WriteStartArray()
                for child in values do write child
                writer.WriteEndArray()
            | Object properties ->
                writer.WriteStartObject()
                properties |> Array.sortWith (fun (a, _) (b, _) -> StringComparer.Ordinal.Compare(a, b))
                |> Array.iter (fun (name, child) -> writer.WritePropertyName name; write child)
                writer.WriteEndObject()
        write value
        writer.Flush()
        stream.ToArray()

    /// Construct the entire independently rebuilt proof, without native-runtime admission.
    let build bindings =
        if not (validBindings bindings) then fail "bindings" "requires exact protocol and nonempty ASCII source names with uppercase SHA256 values"
        else derive bindings |> Result.map (fun (tree, _) -> encode tree)

    /// Reject every extra/missing/duplicate field and every altered numeric leaf.
    /// The expected binding map comes from separate archive/source admission.
    let verify (raw: byte[]) bindings =
        if isNull raw || raw.Length = 0 || raw.Length > 16 * 1024 * 1024 then
            fail "bytes" "requires a nonempty certificate of at most 16 MiB"
        elif not (validBindings bindings) then fail "bindings" "expected protocol/source binding map is invalid"
        else
            match derive bindings with
            | Error error -> Error error
            | Ok(tree, numericGuards) ->
                try
                    use document = JsonDocument.Parse(ReadOnlyMemory<byte>(raw), JsonDocumentOptions(MaxDepth = 128))
                    if not (matches tree document.RootElement) then fail "mismatch" "certificate differs from the full independent finite-model reconstruction"
                    else
                        let digest = SHA256.HashData(encode tree) |> Convert.ToHexString
                        Ok { NumericSha256 = digest; NumericGuards = numericGuards }
                with
                | :? JsonException as error -> fail "json" error.Message
                // JsonDocument delays some string unescaping until GetString
                // or property-name access; malformed UTF16/UTF8 then raises
                // InvalidOperationException rather than JsonException.
                | :? InvalidOperationException as error -> fail "json-string" error.Message
