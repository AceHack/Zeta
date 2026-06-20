module Zeta.Tests.CloudEventsTests

open global.Xunit
open Zeta.Core
open System
open System.IO
open System.Text.Json
open System.Globalization
open System.Collections.Immutable

module CE = Zeta.Core.CloudEvents

type private Marker = class end

let private repoRoot () : string =
    let assembly = typeof<Marker>.Assembly
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(assembly.Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then
        raise (InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location."))
    dir.FullName

let rec private buildValue (el: JsonElement) : DynamicValue =
    let tag = el.GetProperty("t").GetString()
    match tag with
    | "null" -> DynamicValue.Null
    | "bool" -> DynamicValue.Bool(el.GetProperty("v").GetBoolean())
    | "int" -> DynamicValue.Int(int64 (el.GetProperty("v").GetString()))
    | "float" ->
        let bits = UInt64.Parse(el.GetProperty("v").GetString(), NumberStyles.HexNumber, CultureInfo.InvariantCulture)
        DynamicValue.Float(BitConverter.UInt64BitsToDouble(bits))
    | "str" -> DynamicValue.String(el.GetProperty("v").GetString())
    | "bytes" ->
        let hexStr = el.GetProperty("v").GetString()
        DynamicValue.Bytes(ImmutableArray.Create<byte>(Convert.FromHexString(hexStr)))
    | "arr" ->
        let arr = el.GetProperty("v").EnumerateArray() |> Seq.map buildValue |> Seq.toList
        DynamicValue.Array(arr)
    | "obj" ->
        let obj =
            el.GetProperty("v").EnumerateArray()
            |> Seq.map (fun pair ->
                let parts = pair.EnumerateArray() |> Seq.toArray
                parts.[0].GetString(), buildValue parts.[1]
            )
            |> Seq.toList
        DynamicValue.Object(obj)
    | _ -> failwithf "unsupported tag: %s" tag

let private tryStr (el: JsonElement) (prop: string) : string option =
    match el.TryGetProperty(prop) with
    | true, p when p.ValueKind = JsonValueKind.String -> Some(p.GetString())
    | _ -> None

[<Fact>]
let ``create yields a valid v1.0 event; validate catches a missing required attribute`` () =
    let e = CE.create "id-1" "/zeta/source" "com.zeta.change" (Some(DynamicValue.Int 7L))
    Assert.Equal("1.0", e.SpecVersion)
    Assert.Equal<Result<unit, string>>(Ok(), CE.validate e)
    match CE.validate { e with Id = "" } with
    | Error msg -> Assert.Contains("id", msg)
    | Ok () -> Assert.Fail "expected missing-id error"

[<Fact>]
let ``toDynamic ∘ ofDynamic round-trips (required + optionals + extensions + data)`` () =
    let e =
        { CE.create "id-2" "/s" "t" (Some(DynamicValue.String "payload")) with
            Time = Some "2026-06-07T00:00:00Z"
            DataSchema = Some "schema://v2"
            Extensions = [ "iodebeziumop", "c"; "traceparent", "abc" ] }
    Assert.Equal<Result<CE.CloudEvent, string>>(Ok e, CE.ofDynamic (CE.toDynamic e))

[<Fact>]
let ``ofDynamic rejects a non-object and an object missing required attributes`` () =
    Assert.True(match CE.ofDynamic (DynamicValue.Int 1L) with Error _ -> true | _ -> false)
    Assert.True(
        match CE.ofDynamic (DynamicValue.Object [ "id", DynamicValue.String "x" ]) with
        | Error _ -> true
        | _ -> false
    ) // missing source/type

[<Fact>]
let ``unknown string keys become extension attributes, core keys do not`` () =
    let dv =
        DynamicValue.Object
            [ "specversion", DynamicValue.String "1.0"
              "id", DynamicValue.String "i"
              "source", DynamicValue.String "s"
              "type", DynamicValue.String "t"
              "myext", DynamicValue.String "v"
              "data", DynamicValue.Int 5L ]
    match CE.ofDynamic dv with
    | Ok e ->
        Assert.Equal<(string * string) list>([ "myext", "v" ], e.Extensions)
        Assert.Equal<DynamicValue option>(Some(DynamicValue.Int 5L), e.Data)
    | Error m -> Assert.Fail m

[<Fact>]
let ``CrossVerifyCloudEventVectorsMatchExpected`` () =
    let root = repoRoot ()
    let jsonPath = Path.Combine(root, "tests", "cross-verification", "dv-key-cloud-events", "vectors.json")
    Assert.True(File.Exists(jsonPath), sprintf "vectors.json not found: %s" jsonPath)

    use doc = JsonDocument.Parse(File.ReadAllText(jsonPath))
    let vectors = doc.RootElement.GetProperty("cloud_event_vectors").EnumerateArray()

    for v in vectors do
        let expectedJson = v.GetProperty("expected_json").GetString()
        let expectedCborHex = v.GetProperty("expected_cbor_hex").GetString()

        let eventEl = v.GetProperty("event")
        let id = eventEl.GetProperty("id").GetString()
        let source = eventEl.GetProperty("source").GetString()
        let typ = eventEl.GetProperty("type").GetString()
        let specversion = eventEl.GetProperty("specversion").GetString()

        let data =
            match eventEl.TryGetProperty("data") with
            | true, d when d.ValueKind <> JsonValueKind.Null -> Some(buildValue d)
            | _ -> None

        let extensions =
            match eventEl.TryGetProperty("extensions") with
            | true, ext when ext.ValueKind = JsonValueKind.Array ->
                ext.EnumerateArray()
                |> Seq.map (fun pair ->
                    let parts = pair.EnumerateArray() |> Seq.toArray
                    parts.[0].GetString(), parts.[1].GetString()
                )
                |> Seq.toList
            | _ -> []

        let ce =
            { CE.create id source typ data with
                SpecVersion = specversion
                Time = tryStr eventEl "time"
                Subject = tryStr eventEl "subject"
                DataContentType = tryStr eventEl "datacontenttype"
                DataSchema = tryStr eventEl "dataschema"
                Extensions = extensions }

        let dynamicVal = CE.toDynamic ce

        // JSON Canonical check
        let actualJson =
            match DynamicValue.toCanonicalJson dynamicVal with
            | Ok s -> s
            | Error e -> failwithf "JSON encode failed: %A" e
        Assert.Equal(expectedJson, actualJson)

        // CBOR Canonical check
        let actualCborHex =
            match DynamicValue.toCanonicalCbor dynamicVal with
            | Ok bytes -> Convert.ToHexString(bytes).ToLowerInvariant()
            | Error e -> failwithf "CBOR encode failed: %A" e
        Assert.Equal(expectedCborHex, actualCborHex)
