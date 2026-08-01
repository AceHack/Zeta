module Zeta.Tests.Keyring4x4Tests

open System.IO
open System.Reflection
open System.Text.Json
open global.Xunit
open Zeta.Core
open Zeta.Tests.Support.SerializerLegs

/// Walk up from the test assembly to the repo root (Zeta.sln sentinel).
let private repoRoot () : string =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln) from test assembly location."
    dir.FullName

let private hex (bytes: byte[]) : string =
    System.Convert.ToHexString(bytes).ToLowerInvariant()

[<Fact>]
let ``Keyring 4x4: F# oracle reproduces the golden vector across JSON, CBOR, XML and Arrow`` () =
    let goldenPath = Path.Join(repoRoot (), "tools", "setup", "persona-keys", "golden-vectors-keyring-4x4.json")
    use doc = JsonDocument.Parse(File.ReadAllText goldenPath)
    let expected = doc.RootElement.GetProperty("expected")
    let jsonExpected = expected.GetProperty("canonical_json").GetString()
    let cborHexExpected = expected.GetProperty("canonical_cbor_hex").GetString()
    let xmlExpected = expected.GetProperty("canonical_xml").GetString()

    // 1. Decode canonical_json into a DynamicValue
    match DynamicValue.fromCanonicalJson jsonExpected with
    | Error err -> failwithf "Failed to decode canonical_json: %A" err
    | Ok dv ->
        // 2. Verify JSON re-encoding matches canonical_json
        match DynamicValue.toCanonicalJson dv with
        | Error err -> failwithf "Failed to encode canonical_json: %A" err
        | Ok reJson -> Assert.Equal(jsonExpected, reJson)

        // 3. Verify CBOR re-encoding matches canonical_cbor_hex
        let cborBytes = DynamicValue.toCanonicalCborOk dv
        let reCborHex = hex cborBytes
        Assert.Equal(cborHexExpected, reCborHex)

        // 4. Verify XML re-encoding matches canonical_xml
        match DynamicValue.toCanonicalXml dv with
        | Error err -> failwithf "Failed to encode canonical_xml: %A" err
        | Ok reXml -> Assert.Equal(xmlExpected, reXml)

        // 5. Verify 4-serializer agreement (JSON + CBOR + YAML + XML)
        Assert.True(fourSerAgree dv, "Keyring DynamicValue must round-trip cleanly across 4 serializers")

        // 6. Verify Arrow IPC round-trip agreement
        Assert.True(arrowAgreeStable 3 dv, "Keyring DynamicValue must round-trip cleanly through Arrow IPC")
