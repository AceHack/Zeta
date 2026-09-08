module Zeta.Bayesian.Tests.PrecisionGateProjectionTests

open System
open System.Globalization
open System.Security.Cryptography
open System.Text
open System.Text.Json
open Xunit
open Zeta.Bayesian

module P = PrecisionGateProjection
module K = PrecisionGateKernels

let private accepted = function Ok value -> value | Error reason -> failwithf "Unexpected refusal: %A" reason
let private bindings =
    Map.ofList ["ProtocolSha256", P.ProtocolSha256
                P.DecimalClarificationPath, P.DecimalClarificationSha256
                P.RenderedZeroClarificationPath, P.RenderedZeroClarificationSha256]
let private input (t: string) (u: string) (k: string) (c: string) (profile: string) =
    JsonSerializer.SerializeToUtf8Bytes
        {| Schema = "zeta.precision-projection.input.v1"; Id = "fixture"
           Parameters = {| T = t; U = u; K = k; C = c |}; Profile = profile |}
let private callRaw (raw: byte array) = P.tryNativeCall raw (Convert.ToHexString(SHA256.HashData raw)) "fixture" bindings |> accepted
let private call t u k c = input t u k c "default" |> callRaw
let private candidate (receipt: P.NativeReceipt) =
    match receipt.Outcome with P.Candidate value -> value | P.Refused(reason, _) -> failwithf "Expected candidate: %A" reason
let private refusal (receipt: P.NativeReceipt) =
    match receipt.Outcome with P.Refused(reason, partial) -> reason, partial | P.Candidate _ -> failwith "Expected refusal"
let private number (value: string) =
    UInt64.Parse(value, NumberStyles.HexNumber, CultureInfo.InvariantCulture)
    |> int64 |> BitConverter.Int64BitsToDouble
let private floatBits value =
    (uint64 (BitConverter.DoubleToInt64Bits value)).ToString("X16", CultureInfo.InvariantCulture)
let private near expected actual = Assert.True(Double.IsFinite actual && abs (actual - expected) <= 1e-12)

[<Theory>]
[<InlineData("1", "0", "0.75", "1", -0.25, 0.5)>]
[<InlineData("2", "-1", "3.75", "2", -0.125, 0.25)>]
[<InlineData("0.03125", "0", "-0.21875", "0.03125", -8.0, 16.0)>]
let ``independent dyadic stationary centers discriminate signs and halves`` t u k c mean variance =
    let receipt = call t u k c
    let value = candidate receipt
    near mean (number value.MeanBits)
    near variance (number value.VarianceBits)
    near 0.0 (number value.OriginalObjective.DerivativeMeanBits)
    near 0.0 (number value.OriginalObjective.DerivativeVarianceBits)
    Assert.Equal(1, receipt.Counters.ObjectiveEntries)
    Assert.Equal(3, receipt.Counters.LogEntries)
    Assert.Equal(receipt.Counters.PhiEntries, receipt.Counters.ExpEntries)

[<Fact>]
let ``objective is actual original value at the candidate not a zero-residual substitute`` () =
    let receipt = call "1" "0" "0.75" "1"
    let value = candidate receipt
    near (47.0 / 32.0 + Math.Log(2.0) / 2.0) (number value.OriginalObjective.ValueBits)
    let observed =
        K.tryProjectionObjective
            { Precision = 1.0; Location = 0.0; Linear = 0.75; ExponentialRate = 1.0 }
            { Mean = number value.MeanBits; Variance = number value.VarianceBits } |> accepted
    Assert.Equal(floatBits observed.Value, value.OriginalObjective.ValueBits)
    Assert.Equal(floatBits observed.DerivativeMean, value.OriginalObjective.DerivativeMeanBits)
    Assert.Equal(floatBits observed.DerivativeVariance, value.OriginalObjective.DerivativeVarianceBits)

[<Fact>]
let ``positive forcing does not initialize by overflowing exp of the location`` () =
    let receipt = call "1" "800" "0" "1"
    let value = candidate receipt
    Assert.True(Double.IsFinite(number value.MeanBits))
    Assert.True(number value.VarianceBits > 0.0)
    Assert.InRange(receipt.Counters.MidpointAttempts, 1, 256)
    Assert.True(receipt.Trace.Length <= 262)
    Assert.Equal(1, receipt.Counters.ObjectiveEntries)

[<Fact>]
let ``one midpoint retains updated bracket and actually entered counts`` () =
    let receipt = input "1" "0" "0" "1" "native-one" |> callRaw
    let reason, partial = refusal receipt
    Assert.Equal("IterationLimit", reason.Code)
    Assert.Equal("midpoint", reason.Stage)
    Assert.Equal(1, receipt.Counters.Starts)
    Assert.Equal(1, receipt.Counters.MidpointAttempts)
    Assert.Equal(1, receipt.Counters.BracketUpdates)
    Assert.Equal(3, receipt.Counters.PhiEntries)
    Assert.Equal(3, receipt.Counters.ExpEntries)
    Assert.Equal(0, receipt.Counters.ObjectiveEntries)
    Assert.Equal(floatBits -0.5, partial.Bracket.Value.LowerBits)
    Assert.Equal(floatBits 0.0, partial.Bracket.Value.UpperBits)
    Assert.Equal(5, receipt.Trace.Length)
    Assert.Equal(Some reason, receipt.Trace.[4].Failure)
    Assert.Equal(floatBits -0.5, receipt.Trace.[4].PointBits.Value)

[<Theory>]
[<InlineData("0", "1", "T")>]
[<InlineData("-1", "1", "T")>]
[<InlineData("1", "0", "C")>]
[<InlineData("1", "-1", "C")>]
let ``domain refusal preserves rendered target before any root arithmetic`` t c field =
    let receipt = call t "0" "0" c
    let reason, partial = refusal receipt
    Assert.Equal("Domain", reason.Code)
    Assert.Equal(Some field, reason.Field)
    Assert.True(partial.Target.IsSome)
    Assert.Equal(1, receipt.Counters.Starts)
    Assert.Equal(0, receipt.Counters.PhiEntries)
    Assert.Equal(0, receipt.Counters.LogEntries)
    Assert.Equal(0, receipt.Counters.ObjectiveEntries)

[<Fact>]
let ``exact decimal drift and negative zero remain distinct observations`` () =
    let _, partial = input "1" "0.1" "0" "1" "native-one" |> callRaw |> refusal
    Assert.Equal(({ Num = "1"; Den = "180143985094819840" }: P.Rational), partial.Target.Value.ConversionDelta.["U"])
    let positive = call "1" "0" "0" "1" |> candidate
    let negative = call "1" "-0" "0" "1" |> candidate
    Assert.Equal("0000000000000000", positive.TargetBits.["U"])
    Assert.Equal("8000000000000000", negative.TargetBits.["U"])
    Assert.Equal(positive.MeanBits, negative.MeanBits)
    Assert.Equal(positive.VarianceBits, negative.VarianceBits)

[<Fact>]
let ``nonzero decimal rendered signed zero retains exact conversion delta`` () =
    let _, partial = input "1" "-1e-400" "0" "1" "native-one" |> callRaw |> refusal
    let target = partial.Target.Value
    Assert.Equal("8000000000000000", target.TargetBits.["U"])
    Assert.Equal(({ Num = "0"; Den = "1" }: P.Rational), target.DyadicTarget.["U"])
    Assert.Equal(({ Num = "1"; Den = "1" + String('0', 400) }: P.Rational), target.ConversionDelta.["U"])
    let receipt = call "1e-400" "0" "0" "1"
    let reason, failed = refusal receipt
    Assert.Equal("Domain", reason.Code)
    Assert.Equal("0000000000000000", failed.Target.Value.TargetBits.["T"])
    Assert.Equal(0, receipt.Counters.LogEntries)

[<Fact>]
let ``arithmetic exponential underflow still refuses with endpoint prefix`` () =
    let receipt = call "1" "-1000" "0" "1"
    let reason, partial = refusal receipt
    Assert.Equal("NumericalUnderflow", reason.Code)
    Assert.Equal("left-endpoint", reason.Stage)
    Assert.Equal(1, receipt.Counters.PhiEntries)
    Assert.Equal(1, receipt.Counters.ExpEntries)
    Assert.Equal(0, receipt.Counters.MidpointAttempts)
    Assert.Equal(0, receipt.Counters.ObjectiveEntries)
    Assert.True(partial.Parameters.IsSome && partial.Bracket.IsSome)
    Assert.Equal(Some(floatBits -1001.0), receipt.Trace.[2].PointBits)

[<Fact>]
let ``subnormal target range failure keeps successful parameter prefix`` () =
    let receipt = call "5e-324" "0" "1" "1"
    let reason, partial = refusal receipt
    Assert.Equal("NumericalRange", reason.Code)
    Assert.Equal("parameters", reason.Stage)
    Assert.Equal("0000000000000001", partial.Target.Value.TargetBits.["T"])
    Assert.True(partial.Parameters.Value.LogTBits.IsSome)
    Assert.True(partial.Parameters.Value.LogCBits.IsSome)
    Assert.True(partial.Parameters.Value.ABits.IsNone)
    Assert.Equal(0, receipt.Counters.PhiEntries)

[<Fact>]
let ``actual original objective refusal keeps reconstruction and original error`` () =
    let receipt = call "1e306" "100" "0" "1e308"
    let reason, partial = refusal receipt
    Assert.Equal("ObjectiveRefusal", reason.Code)
    Assert.Equal(1, receipt.Counters.ObjectiveEntries)
    Assert.True(partial.Candidate.Value.MeanBits.IsSome)
    Assert.True(partial.Candidate.Value.VarianceBits.IsSome)
    Assert.True(partial.Candidate.Value.OriginalObjective.IsNone)
    match partial.OriginalObjective.Value with
    | Ok _ -> failwith "Expected actual kernel refusal"
    | Error original ->
        Assert.Equal(Some original, reason.OriginalKernelFailure)
        Assert.Equal("NumericalFailure", original.Kind)
        Assert.Equal("projection scaled second moment", original.Field)
        Assert.Equal(Some "nonfinite result", original.Detail)

[<Theory>]
[<InlineData("+1")>]
[<InlineData("00.5")>]
[<InlineData(".5")>]
[<InlineData("1.")>]
[<InlineData("1E2")>]
[<InlineData("1\n")>]
[<InlineData("NaN")>]
[<InlineData("Infinity")>]
[<InlineData("1e401")>]
let ``registered decimal grammar refuses before numeric entry`` literal =
    let receipt = call "1" literal "0" "1"
    let reason, partial = refusal receipt
    Assert.Equal("Wire", reason.Code)
    Assert.Equal(0, receipt.Counters.Starts)
    Assert.Equal(0, receipt.Counters.ObjectiveEntries)
    Assert.True(partial.Target.IsNone)

[<Fact>]
let ``signed exponent and bounded extreme exponents have declared admission`` () =
    let receipt = input "1" "1e+2" "0" "1" "native-one" |> callRaw
    let _, partial = refusal receipt
    Assert.Equal(floatBits 100.0, partial.Target.Value.TargetBits.["U"])
    let range = call "1" "1e400" "0" "1"
    Assert.Equal("NumericalRange", (refusal range |> fst).Code)
    let huge = call "1" (String('1', 129)) "0" "1"
    Assert.Equal("Wire", (refusal huge |> fst).Code)

[<Fact>]
let ``duplicate escaped keys malformed UTF8 and wrong exact fields are wire refusals`` () =
    let original = input "1" "0" "0" "1" "default" |> Encoding.UTF8.GetString
    let variants =
        [ original.Replace("\"T\":\"1\"", "\"T\":\"1\",\"\\u0054\":\"1\"", StringComparison.Ordinal) |> Encoding.UTF8.GetBytes
          original.Replace("\"T\":\"1\"", "\"T\":true", StringComparison.Ordinal) |> Encoding.UTF8.GetBytes
          original.Replace("\"Schema\":", "\"Unexpected\":0,\"Schema\":", StringComparison.Ordinal) |> Encoding.UTF8.GetBytes
          [| 0xFFuy; 0xFEuy |] ]
    for raw in variants do
        let receipt = callRaw raw
        Assert.Equal("Wire", (refusal receipt |> fst).Code)
        Assert.Equal(0, receipt.Counters.Starts)
        Assert.Equal(1, receipt.Trace.Length)

[<Fact>]
let ``wrong independent metadata never becomes its own expectation`` () =
    let raw = input "1" "0" "0" "1" "default"
    let receipt = P.tryNativeCall raw (String('0', 64)) "fixture" bindings |> accepted
    Assert.Equal("TargetMismatch", (refusal receipt |> fst).Code)
    Assert.Equal(0, receipt.Counters.Starts)
    let malformed = bindings.Remove P.RenderedZeroClarificationPath
    match P.tryNativeCall raw (Convert.ToHexString(SHA256.HashData raw)) "fixture" malformed with
    | Error reason -> Assert.Equal("SourceMismatch", reason.Code)
    | Ok _ -> failwith "Malformed caller metadata accepted"

[<Fact>]
let ``receipt encoding keeps exact refused nulls and actual trace failure`` () =
    let receipt = input "1" "0" "0" "1" "native-one" |> callRaw
    use doc = P.tryEncode receipt |> accepted |> JsonDocument.Parse
    let root = doc.RootElement
    Assert.Equal(7, root.EnumerateObject() |> Seq.length)
    let outcome = root.GetProperty "Outcome"
    let partial = outcome.GetProperty "Partial"
    Assert.Equal(5, partial.EnumerateObject() |> Seq.length)
    Assert.Equal(JsonValueKind.Null, (partial.GetProperty "Candidate").ValueKind)
    Assert.Equal(JsonValueKind.Null, (partial.GetProperty "OriginalObjective").ValueKind)
    Assert.Equal(JsonValueKind.Null, ((outcome.GetProperty "Failure").GetProperty "OriginalKernelFailure").ValueKind)
    Assert.Equal("IterationLimit", (((root.GetProperty "Trace").[4]).GetProperty "Failure").GetProperty("Code").GetString())

[<Fact>]
let ``encoding size refusal leaves complete candidate objective available to caller`` () =
    let receipt = call "1" "0" "0.75" "1"
    let original = candidate receipt
    let oversized = { receipt with CaseId = String('x', 2 * 1024 * 1024) }
    match P.tryEncode oversized with
    | Error reason -> Assert.Equal("ResultTooLarge", reason.Code)
    | Ok _ -> failwith "Oversized result accepted"
    Assert.Equal(original.OriginalObjective, (candidate oversized).OriginalObjective)
    Assert.Equal(1, oversized.Counters.ObjectiveEntries)

module Replay = Zeta.Research.PrecisionGateProjectionReplay

let private withFiles work =
    let folder = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "zeta-projection-fixture-" + Guid.NewGuid().ToString("N"))
    System.IO.Directory.CreateDirectory folder |> ignore
    try
        let raw = input "1" "0" "0.75" "1" "default"
        let source = System.IO.Path.Combine(folder, "input.json")
        let bindingFile = System.IO.Path.Combine(folder, "bindings.json")
        let output = System.IO.Path.Combine(folder, "output.json")
        System.IO.File.WriteAllBytes(source, raw)
        System.IO.File.WriteAllBytes(bindingFile, JsonSerializer.SerializeToUtf8Bytes(bindings |> Map.toArray |> dict))
        work [| source; Convert.ToHexString(SHA256.HashData raw); "fixture"; bindingFile; output |]
    finally System.IO.Directory.Delete(folder, true)

[<Fact>]
let ``exclusive existing output refuses before any input or numeric call`` () =
    withFiles (fun args ->
        let marker = [| 1uy; 2uy; 3uy |]
        System.IO.File.WriteAllBytes(args.[4], marker)
        let actual = Replay.run args
        Assert.False(actual.Complete)
        Assert.True(actual.Receipt.IsNone)
        Assert.Empty(actual.Inputs)
        Assert.Equal("output-create", actual.Failure.Value.Stage)
        Assert.Equal<byte>(marker, System.IO.File.ReadAllBytes(args.[4])))

[<Fact>]
let ``binding read failure preserves already observed input hash and empty owned output`` () =
    withFiles (fun args ->
        System.IO.File.Delete args.[3]
        let actual = Replay.run args
        Assert.False(actual.Complete)
        Assert.True(actual.Receipt.IsNone)
        Assert.Single(actual.Inputs) |> ignore
        Assert.Equal(args.[1], actual.Inputs.[0].Sha256)
        Assert.Equal(0L, System.IO.FileInfo(args.[4]).Length))

[<Fact>]
let ``oversized caller binding file is rejected before parsing and numeric entry`` () =
    withFiles (fun args ->
        System.IO.File.WriteAllBytes(args.[3], Array.create 65537 32uy)
        let actual = Replay.run args
        Assert.False(actual.Complete)
        Assert.True(actual.Receipt.IsNone)
        Assert.Single(actual.Inputs) |> ignore
        Assert.Equal("FileRead", actual.Failure.Value.Code))

type private FailingPublication(path: string) =
    inherit System.IO.Stream()
    let inner = new System.IO.FileStream(path, System.IO.FileMode.CreateNew, System.IO.FileAccess.Write, System.IO.FileShare.None)
    member val CloseCalls = 0 with get, set
    override _.CanRead = false
    override _.CanWrite = true
    override _.CanSeek = false
    override _.Length = inner.Length
    override _.Position with get() = inner.Position and set value = inner.Position <- value
    override _.Read(_, _, _) = raise (NotSupportedException())
    override _.Seek(_, _) = raise (NotSupportedException())
    override _.SetLength _ = raise (NotSupportedException())
    override _.Write(buffer, offset, count) = inner.Write(buffer, offset, count)
    override _.Flush() = raise (System.IO.IOException("fixture primary flush refusal"))
    override this.Dispose(disposing) =
        if disposing then
            this.CloseCalls <- this.CloseCalls + 1
            inner.Dispose()
            raise (System.IO.IOException("fixture secondary close refusal"))
        base.Dispose disposing

[<Fact>]
let ``actual returned receipt survives flush and close refusals with first failure primary`` () =
    withFiles (fun args ->
        let mutable owned: FailingPublication option = None
        let actual = Replay.runWith (fun path ->
            let stream = new FailingPublication(path)
            owned <- Some stream
            stream :> System.IO.Stream) args
        Assert.False(actual.Complete)
        Assert.Equal("receipt-flush", actual.Failure.Value.Stage)
        Assert.Equal("fixture primary flush refusal", actual.Failure.Value.Message)
        Assert.Equal(1, owned.Value.CloseCalls)
        Assert.Single(actual.Cleanup) |> ignore
        Assert.Equal("fixture secondary close refusal", actual.Cleanup.[0].Message)
        let complete = actual.Receipt.Value
        Assert.Equal(1, complete.Counters.ObjectiveEntries)
        Assert.True((candidate complete).OriginalObjective.ValueBits.Length = 16)
        Assert.Equal<byte>(P.tryEncode complete |> accepted, System.IO.File.ReadAllBytes args.[4])
        Assert.True(actual.Output.IsNone)
        use report = Replay.encodeCommand actual |> function Ok raw -> JsonDocument.Parse raw | Error e -> failwithf "%A" e
        Assert.False(report.RootElement.GetProperty("Complete").GetBoolean())
        Assert.True(report.RootElement.GetProperty("ReceiptAvailable").GetBoolean()))

[<Fact>]
let ``actual numerical refusal publishes a complete registered receipt with separate command success`` () =
    withFiles (fun args ->
        let raw = input "0" "0" "0" "1" "default"
        System.IO.File.WriteAllBytes(args.[0], raw)
        args.[1] <- Convert.ToHexString(SHA256.HashData raw)
        let actual = Replay.run args
        Assert.True(actual.Complete)
        Assert.True(actual.Failure.IsNone)
        let receipt = actual.Receipt.Value
        Assert.Equal("Domain", (refusal receipt |> fst).Code)
        Assert.Equal(1, receipt.Counters.Starts)
        Assert.Equal(0, receipt.Counters.ObjectiveEntries)
        Assert.Equal<byte>(P.tryEncode receipt |> accepted, System.IO.File.ReadAllBytes args.[4])
        Assert.Equal(2, actual.Assemblies.Length))

[<Fact>]
let ``escaped unpaired surrogate is a wire refusal before numeric entry`` () =
    let original = input "1" "0" "0" "1" "default" |> Encoding.UTF8.GetString
    let raw = original.Replace("\"U\":\"0\"", "\"U\":\"\\ud800\"", StringComparison.Ordinal) |> Encoding.UTF8.GetBytes
    let receipt = callRaw raw
    let reason, _ = refusal receipt
    Assert.True(reason.Code = "Wire", sprintf "Actual nonnumeric receipt: %A" receipt)
    Assert.Equal("input", reason.Stage)
    Assert.Equal(0, receipt.Counters.Starts)
    Assert.Equal(0, receipt.Counters.PhiEntries)

[<Theory>]
[<InlineData("Schema", "zeta.precision-projection.input.v1", "\\ud800")>]
[<InlineData("Id", "fixture", "\\udc00")>]
[<InlineData("Profile", "default", "\\ud800x")>]
[<InlineData("T", "1", "\\ud800\\ud800")>]
[<InlineData("U", "0", "\\udc00")>]
let ``deferred escaped string refusals keep the exact field and zero numeric entries`` field originalValue escaped =
    let original = input "1" "0" "0" "1" "default" |> Encoding.UTF8.GetString
    let raw = original.Replace(sprintf "\"%s\":\"%s\"" field originalValue, sprintf "\"%s\":\"%s\"" field escaped, StringComparison.Ordinal) |> Encoding.UTF8.GetBytes
    let receipt = callRaw raw
    let reason, partial = refusal receipt
    Assert.Equal("Wire", reason.Code)
    Assert.Equal(Some(if field = "T" || field = "U" then "Parameters." + field else field), reason.Field)
    Assert.Equal(0, receipt.Counters.Starts)
    Assert.True(partial.Target.IsNone)

[<Fact>]
let ``valid surrogate pair reaches decimal grammar and ordinary escaped digits remain admitted`` () =
    let original = input "1" "0" "0" "1" "default" |> Encoding.UTF8.GetString
    let pair = original.Replace("\"U\":\"0\"", "\"U\":\"\\ud83d\\ude00\"", StringComparison.Ordinal) |> Encoding.UTF8.GetBytes |> callRaw
    let reason, _ = refusal pair
    Assert.Equal("Wire", reason.Code)
    Assert.Contains("decimal grammar", reason.Message)
    let digit = original.Replace("\"U\":\"0\"", "\"U\":\"\\u0030\"", StringComparison.Ordinal) |> Encoding.UTF8.GetBytes |> callRaw
    Assert.Equal("0000000000000000", (candidate digit).TargetBits.["U"])
