module Zeta.Tests.RoomConsultationTests

open System
open System.IO
open System.Numerics
open System.Text.Json
open global.Xunit
open Zeta.Core

let private cost: RoomConsultation.CostPolicy =
    { LookupBytesPerAttempt = 2L
      ComputeBytesPerUnit = 10L
      Attribution = "RoomConsultation.Tests: exact fixture costs" }

let private advance port requested initial =
    RoomConsultation.advance cost (fun state -> state >= 99) ((+) 1) port requested initial

let private value =
    function
    | Ok result -> result
    | Error feedback -> failwithf "expected consultation result, got %A" feedback

[<Fact>]
let ``RC-1 every requested unit is reused or computed exactly once`` () =
    let port =
        { RoomConsultation.Port.TryAdvanceOne = fun state -> if state % 2 = 0 then Some(state + 1) else None }

    let result = advance port 5 0 |> value

    Assert.Equal(5, result.State)
    Assert.Equal(5, result.Receipt.ReusedUnits + result.Receipt.ComputedUnits)
    Assert.Equal(3, result.Receipt.ReusedUnits)
    Assert.Equal(2, result.Receipt.ComputedUnits)
    Assert.Equal(5, result.Receipt.LookupAttempts)
    Assert.Equal(RoomConsultation.Completed, result.Receipt.StopReason)

[<Fact>]
let ``RC-2 a full hit avoids compute but still pays lookup`` () =
    let result = advance { TryAdvanceOne = fun state -> Some(state + 1) } 3 0 |> value

    Assert.Equal(3, result.Receipt.ReusedUnits)
    Assert.Equal(0, result.Receipt.ComputedUnits)
    Assert.Equal(BigInteger 6, result.Receipt.ProjectedLookupBytes)
    Assert.Equal(BigInteger.Zero, result.Receipt.ProjectedComputeBytes)
    Assert.Equal(BigInteger 30, result.Receipt.ProjectedAvoidedComputeBytes)
    Assert.Equal(BigInteger 24, result.Receipt.ProjectedNetSavedBytes)

[<Fact>]
let ``RC-3 a miss falls through and records lookup plus compute`` () =
    let result = advance { TryAdvanceOne = fun _ -> None } 3 0 |> value

    Assert.Equal(0, result.Receipt.ReusedUnits)
    Assert.Equal(3, result.Receipt.ComputedUnits)
    Assert.Equal(BigInteger 6, result.Receipt.ProjectedLookupBytes)
    Assert.Equal(BigInteger 30, result.Receipt.ProjectedComputeBytes)
    Assert.Equal(BigInteger.Zero, result.Receipt.ProjectedAvoidedComputeBytes)
    Assert.Equal(BigInteger(-6), result.Receipt.ProjectedNetSavedBytes)

[<Fact>]
let ``RC-4 a room boundary is never crossed or looked through`` () =
    let mutable calls = 0
    let port =
        { RoomConsultation.Port.TryAdvanceOne =
            fun state ->
                calls <- calls + 1
                Some(state + 1) }

    let result =
        RoomConsultation.advance cost (fun state -> state = 2) ((+) 1) port 5 0
        |> value

    Assert.Equal(2, result.State)
    Assert.Equal(2, calls)
    Assert.Equal(2, result.Receipt.ReusedUnits)
    Assert.Equal(0, result.Receipt.ComputedUnits)
    Assert.Equal(RoomConsultation.Boundary, result.Receipt.StopReason)

[<Fact>]
let ``RC-5 invalid policy refuses before lookup or compute`` () =
    let mutable lookups = 0
    let mutable computes = 0
    let port =
        { RoomConsultation.Port.TryAdvanceOne =
            fun _ ->
                lookups <- lookups + 1
                None }
    let bad = { cost with Attribution = "" }

    let result =
        RoomConsultation.advance
            bad
            (fun _ -> false)
            (fun state ->
                computes <- computes + 1
                state + 1)
            port
            1
            0

    Assert.Equal<Result<RoomConsultation.Advance<int>, RoomConsultation.Feedback>>(
        Error RoomConsultation.CostPolicyUnattributed,
        result
    )
    Assert.Equal(0, lookups)
    Assert.Equal(0, computes)

[<Fact>]
let ``RC-6 negative horizons are typed refusals`` () =
    let result = advance { TryAdvanceOne = fun _ -> None } -1 0

    match result with
    | Error(RoomConsultation.NegativeRequestedUnits -1) -> ()
    | other -> Assert.Fail(sprintf "expected negative-unit refusal, got %A" other)

[<Fact>]
let ``RC-7 receipt preserves the request and cost attribution`` () =
    let result = advance { RoomConsultation.Port.TryAdvanceOne = fun _ -> None } 4 0 |> value

    Assert.Equal(4, result.Receipt.RequestedUnits)
    Assert.Equal("RoomConsultation.Tests: exact fixture costs", result.Receipt.CostAttribution)

let private repoRoot () =
    let mutable dir =
        DirectoryInfo(Path.GetDirectoryName(Reflection.Assembly.GetExecutingAssembly().Location))

    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    if isNull dir then
        failwith "Could not locate repo root (Zeta.sln)."
    else
        dir.FullName

let private optionalInt (element: JsonElement) (name: string) =
    let value = element.GetProperty name
    if value.ValueKind = JsonValueKind.Null then None else Some(value.GetInt32())

let private stopReasonText =
    function
    | RoomConsultation.Completed -> "completed"
    | RoomConsultation.Boundary -> "boundary"

[<Fact>]
let ``RC-8 portable golden vectors pin hit miss boundary and cost accounting`` () =
    let path = Path.Join(repoRoot (), "src", "Core", "golden-vectors-room-consultation.json")
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let root = doc.RootElement

    Assert.Equal(1, root.GetProperty("schemaVersion").GetInt32())
    Assert.Equal("room-consultation", root.GetProperty("contract").GetString())
    Assert.Equal("integer-successor", root.GetProperty("transition").GetString())

    let encodedPolicy = root.GetProperty "costPolicy"
    let policy: RoomConsultation.CostPolicy =
        { LookupBytesPerAttempt = encodedPolicy.GetProperty("lookupBytesPerAttempt").GetInt64()
          ComputeBytesPerUnit = encodedPolicy.GetProperty("computeBytesPerUnit").GetInt64()
          Attribution = encodedPolicy.GetProperty("attribution").GetString() }

    for encodedCase in root.GetProperty("cases").EnumerateArray() do
        let id = encodedCase.GetProperty("id").GetString()
        let boundary = optionalInt encodedCase "boundaryAtState"
        let hits =
            encodedCase.GetProperty("hitStates").EnumerateArray()
            |> Seq.map _.GetInt32()
            |> Set.ofSeq
        let port =
            { RoomConsultation.Port.TryAdvanceOne =
                fun state -> if Set.contains state hits then Some(state + 1) else None }

        let actual =
            RoomConsultation.advance
                policy
                (fun state -> boundary = Some state)
                ((+) 1)
                port
                (encodedCase.GetProperty("requestedUnits").GetInt32())
                (encodedCase.GetProperty("initialState").GetInt32())
            |> value

        let expected = encodedCase.GetProperty "expected"
        let assertInt (name: string) (actualValue: int) =
            Assert.True(
                expected.GetProperty(name).GetInt32() = actualValue,
                String.Format("{0}: {1} mismatch", id, name)
            )
        let assertBigInteger (name: string) (actualValue: BigInteger) =
            Assert.True(
                BigInteger(expected.GetProperty(name).GetInt64()) = actualValue,
                String.Format("{0}: {1} mismatch", id, name)
            )

        assertInt "finalState" actual.State
        assertInt "reusedUnits" actual.Receipt.ReusedUnits
        assertInt "computedUnits" actual.Receipt.ComputedUnits
        assertInt "lookupAttempts" actual.Receipt.LookupAttempts
        Assert.Equal(expected.GetProperty("stopReason").GetString(), stopReasonText actual.Receipt.StopReason)
        assertBigInteger "projectedLookupBytes" actual.Receipt.ProjectedLookupBytes
        assertBigInteger "projectedComputeBytes" actual.Receipt.ProjectedComputeBytes
        assertBigInteger "projectedAvoidedComputeBytes" actual.Receipt.ProjectedAvoidedComputeBytes
        assertBigInteger "projectedNetSavedBytes" actual.Receipt.ProjectedNetSavedBytes
