module Zeta.Tests.DynamicValueCborDecodeTests

open System.IO
open System.Reflection
open System.Globalization
open System.Collections.Immutable
open System.Text.Json
open global.Xunit
open Zeta.Core

// DynamicValue canonical-CBOR DECODE byte-lock — DynamicValue.fromCanonicalCbor is the
// inverse of toCanonicalCbor, completing the byte↔value bijection. The decoder is strictly
// canonical (fixed-point check toCanonicalCbor(decode b) = b → DecodeError.NonCanonical),
// so a successful decode of the seed is guaranteed to round-trip; this test additionally
// asserts the decoded value structurally equals the expected value, and that malformed /
// non-canonical inputs are rejected with the right DecodeError. "The compilers don't lie."

let private repoRoot () : string =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location))

    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    if isNull dir then
        failwith "Could not locate repo root (Zeta.sln) from test assembly location."

    dir.FullName

let private children (el: JsonElement) : JsonElement[] =
    [| for child in el.EnumerateArray() -> child |]

let rec private buildValue (el: JsonElement) : DynamicValue =
    match el.GetProperty("t").GetString() with
    | "null" -> DynamicValue.Null
    | "bool" -> DynamicValue.Bool(el.GetProperty("v").GetBoolean())
    | "int" -> DynamicValue.Int(System.Int64.Parse(el.GetProperty("v").GetString(), CultureInfo.InvariantCulture))
    | "float" ->
        DynamicValue.Float(
            System.BitConverter.UInt64BitsToDouble(
                System.UInt64.Parse(el.GetProperty("v").GetString(), NumberStyles.HexNumber, CultureInfo.InvariantCulture)))
    | "str" -> DynamicValue.String(el.GetProperty("v").GetString())
    | "bytes" -> DynamicValue.Bytes(ImmutableArray.Create<byte>(System.Convert.FromHexString(el.GetProperty("v").GetString())))
    | "arr" -> DynamicValue.Array(children (el.GetProperty "v") |> Array.map buildValue |> Array.toList)
    | "obj" ->
        DynamicValue.Object(
            children (el.GetProperty "v")
            |> Array.map (fun pair ->
                let parts = children pair
                (parts.[0].GetString(), buildValue parts.[1]))
            |> Array.toList)
    | other -> failwithf "unsupported tag in CBOR seed: %s" other

[<Fact>]
let ``F# CBOR decode round-trips the seed`` () =
    let path =
        Path.Join(repoRoot (), "src", "Core.TypeScript", "dynamic-value", "golden-vectors-cbor.json")

    use doc = JsonDocument.Parse(File.ReadAllText path)
    let vectors = children (doc.RootElement.GetProperty "vectors")
    Assert.NotEmpty vectors

    let failures =
        vectors
        |> Array.choose (fun v ->
            let name = v.GetProperty("name").GetString()
            let cbor = System.Convert.FromHexString(v.GetProperty("cbor").GetString())
            let expected = buildValue (v.GetProperty "value")

            match DynamicValue.fromCanonicalCbor cbor with
            | Ok decoded when decoded = expected -> None
            | Ok _ -> Some(sprintf "%s: decoded value != expected" name)
            | Error e -> Some(sprintf "%s: decode failed with %A" name e))

    Assert.True(Array.isEmpty failures, System.String.Join("\n", failures))

[<Fact>]
let ``F# CBOR decode rejects malformed and non-canonical`` () =
    let err (bytes: byte[]) =
        match DynamicValue.fromCanonicalCbor bytes with
        | Error e -> e
        | Ok _ -> failwith "expected Error"

    Assert.Equal(DecodeError.UnexpectedEnd, err [||]) // empty
    Assert.Equal(DecodeError.UnexpectedEnd, err [| 0x18uy |]) // uint8 head, payload truncated
    Assert.Equal(DecodeError.TrailingData, err [| 0xf6uy; 0x00uy |]) // null + extra byte
    Assert.Equal(DecodeError.Unsupported, err [| 0xc0uy; 0x00uy |]) // tag (major 6)
    Assert.Equal(DecodeError.Unsupported, err [| 0xf7uy |]) // undefined (major 7, ai 23)
    Assert.Equal(DecodeError.NonTextKey, err [| 0xa1uy; 0x00uy; 0x00uy |]) // int map key
    Assert.Equal(DecodeError.NonCanonical, err [| 0x18uy; 0x00uy |]) // non-shortest int (0 as uint8)
    Assert.Equal(DecodeError.NonCanonical, err [| 0x61uy; 0xffuy |]) // text string with invalid UTF-8
    Assert.Equal(
        DecodeError.NonCanonical,
        err [| 0xfbuy; 0x3fuy; 0xf0uy; 0x00uy; 0x00uy; 0x00uy; 0x00uy; 0x00uy; 0x00uy |]) // 1.0 as float64
