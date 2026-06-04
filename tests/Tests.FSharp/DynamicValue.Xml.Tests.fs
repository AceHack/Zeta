module Zeta.Tests.DynamicValueXmlTests

open System.IO
open System.Reflection
open System.Globalization
open System.Collections.Immutable
open System.Text.Json
open global.Xunit
open Zeta.Core

// DynamicValue canonical XML cross-language byte-lock — the F# oracle RE-GROUNDED
// against the shared seed (src/Core.TypeScript/dynamic-value/golden-vectors-xml.json).
// Seed-first: the seed is the canonical DATA; this proves the F# XML codec AGREES on
// it (encode(value) = Ok xml AND decode(xml) = Ok value) for every locked vector.
// XML is the TOTAL form (8/8 shapes): float = 16-hex IEEE-754 f64 bits, bytes = hex.
// "The compilers don't lie."

/// Walk up from the test assembly to the repo root (Zeta.sln sentinel).
let private repoRoot () : string =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location))

    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    if isNull dir then
        failwith "Could not locate repo root (Zeta.sln) from test assembly location."

    dir.FullName

// Eager array of a JsonElement's children via a direct enumerator loop (NOT
// EnumerateArray() |> Seq.toArray): ArrayEnumerator is a mutable struct and boxing
// it through the lazy Seq pipeline corrupts its state in compiled F# (Release).
let private children (el: JsonElement) : JsonElement[] =
    [| for child in el.EnumerateArray() -> child |]

/// Build a DynamicValue from the seed's language-neutral tagged form `{ t, v }`.
let rec private buildValue (el: JsonElement) : DynamicValue =
    match el.GetProperty("t").GetString() with
    | "null" -> DynamicValue.Null
    | "bool" -> DynamicValue.Bool(el.GetProperty("v").GetBoolean())
    | "int" -> DynamicValue.Int(System.Int64.Parse(el.GetProperty("v").GetString(), CultureInfo.InvariantCulture))
    // float v is the IEEE-754 f64 big-endian bit pattern (16 hex) — built bit-exact
    // (mirrors DynamicValue.CborGoldenVectors.Tests.fs) so NaN/-0.0/Inf corners survive.
    | "float" ->
        DynamicValue.Float(
            System.BitConverter.UInt64BitsToDouble(
                System.UInt64.Parse(el.GetProperty("v").GetString(), NumberStyles.HexNumber, CultureInfo.InvariantCulture)))
    // bytes v is a hex string (empty -> empty payload)
    | "bytes" -> DynamicValue.Bytes(ImmutableArray.Create<byte>(System.Convert.FromHexString(el.GetProperty("v").GetString())))
    | "str" -> DynamicValue.String(el.GetProperty("v").GetString())
    | "arr" -> DynamicValue.Array [ for item in children (el.GetProperty("v")) -> buildValue item ]
    | "obj" ->
        DynamicValue.Object
            [ for pair in children (el.GetProperty("v")) do
                  let parts = children pair
                  yield (parts.[0].GetString(), buildValue parts.[1]) ]
    | other -> failwithf "unsupported tag in v1 seed: %s" other

let private seedVectors () : JsonElement[] =
    let path =
        Path.Join(repoRoot (), "src", "Core.TypeScript", "dynamic-value", "golden-vectors-xml.json")

    let doc = JsonDocument.Parse(File.ReadAllText(path))
    children (doc.RootElement.GetProperty("vectors"))

[<Fact>]
let ``F# canonical XML encoder agrees with the shared seed (byte-lock)`` () =
    let vectors = seedVectors ()
    Assert.True(vectors.Length > 0, "seed must have vectors")

    let failures =
        [ for v in vectors do
              let name = v.GetProperty("name").GetString()
              let value = buildValue (v.GetProperty("value"))
              let expected = v.GetProperty("xml").GetString()

              match DynamicValue.toCanonicalXml value with
              | Ok actual when actual = expected -> ()
              | Ok actual -> yield sprintf "%s: expected %s but got %s" name expected actual
              | Error e -> yield sprintf "%s: expected %s but got Error %A" name expected e ]

    Assert.True(List.isEmpty failures, "byte-lock mismatches:\n" + String.concat "\n" failures)

[<Fact>]
let ``F# canonical XML decoder round-trips the shared seed`` () =
    let vectors = seedVectors ()
    Assert.True(vectors.Length > 0, "seed must have vectors")

    let failures =
        [ for v in vectors do
              let name = v.GetProperty("name").GetString()
              let value = buildValue (v.GetProperty("value"))
              let xml = v.GetProperty("xml").GetString()

              match DynamicValue.fromCanonicalXml xml with
              | Ok actual when actual = value -> ()
              | Ok actual -> yield sprintf "%s: expected %A but got %A" name value actual
              | Error e -> yield sprintf "%s: expected %A but got Error %A" name value e ]

    Assert.True(List.isEmpty failures, "round-trip mismatches:\n" + String.concat "\n" failures)

[<Fact>]
let ``empty shapes never collapse — five distinct canonical XML strings`` () =
    let nul = DynamicValue.toCanonicalXml DynamicValue.Null
    let arr = DynamicValue.toCanonicalXml (DynamicValue.Array [])
    let obj = DynamicValue.toCanonicalXml (DynamicValue.Object [])
    let str = DynamicValue.toCanonicalXml (DynamicValue.String "")
    let bytes = DynamicValue.toCanonicalXml (DynamicValue.Bytes ImmutableArray.Empty)
    Assert.Equal(Ok "<null/>", nul)
    Assert.Equal(Ok "<arr></arr>", arr)
    Assert.Equal(Ok "<obj></obj>", obj)
    Assert.Equal(Ok "<str></str>", str)
    Assert.Equal(Ok "<bytes></bytes>", bytes)
    let all = [ "<null/>"; "<arr></arr>"; "<obj></obj>"; "<str></str>"; "<bytes></bytes>" ]
    Assert.Equal(5, all |> List.distinct |> List.length)

[<Fact>]
let ``non-canonical XML is rejected (self-closing empties, leading zeros)`` () =
    Assert.True(
        (match DynamicValue.fromCanonicalXml "<arr/>" with
         | Error DecodeError.NonCanonical -> true
         | _ -> false),
        "<arr/> must be NonCanonical"
    )

    Assert.True(
        (match DynamicValue.fromCanonicalXml "<str/>" with
         | Error DecodeError.NonCanonical -> true
         | _ -> false),
        "<str/> must be NonCanonical"
    )

    Assert.True(
        (match DynamicValue.fromCanonicalXml "<int>01</int>" with
         | Error DecodeError.NonCanonical -> true
         | _ -> false),
        "<int>01</int> must be NonCanonical"
    )

[<Fact>]
let ``Float and Bytes are total in canonical XML (16-hex / hex)`` () =
    // 1.5 = IEEE-754 f64 bits 0x3ff8000000000000
    Assert.Equal(Ok "<float>3ff8000000000000</float>", DynamicValue.toCanonicalXml (DynamicValue.Float 1.5))
    // NaN built from the canonical 7ff8… bit pattern round-trips bit-exact (XML carries
    // the raw f64 bits, so the golden `float-nan` payload 7ff8000000000000 is preserved
    // verbatim — distinct from .NET's own Double.NaN which is fff8…).
    let nanCanon = System.BitConverter.UInt64BitsToDouble(0x7ff8000000000000UL)
    Assert.Equal(Ok "<float>7ff8000000000000</float>", DynamicValue.toCanonicalXml (DynamicValue.Float nanCanon))
    Assert.Equal(Ok "<float>8000000000000000</float>", DynamicValue.toCanonicalXml (DynamicValue.Float -0.0))
    Assert.Equal(Ok "<float>0000000000000000</float>", DynamicValue.toCanonicalXml (DynamicValue.Float 0.0))

    Assert.Equal(
        Ok "<bytes>0102ff</bytes>",
        DynamicValue.toCanonicalXml (DynamicValue.Bytes(ImmutableArray.Create<byte>([| 1uy; 2uy; 255uy |])))
    )

    Assert.Equal(Ok "<bytes></bytes>", DynamicValue.toCanonicalXml (DynamicValue.Bytes ImmutableArray.Empty))

[<Fact>]
let ``unknown tags decode to Unsupported; malformed float/bytes are MalformedXml`` () =
    Assert.Equal(Error DecodeError.Unsupported, DynamicValue.fromCanonicalXml "<wat>x</wat>")
    // non-16-hex float / odd-length / uppercase hex → malformed (regex validation)
    Assert.Equal(Error DecodeError.MalformedXml, DynamicValue.fromCanonicalXml "<float>1.5</float>")
    Assert.Equal(Error DecodeError.MalformedXml, DynamicValue.fromCanonicalXml "<float>3FF8000000000000</float>")
    Assert.Equal(Error DecodeError.MalformedXml, DynamicValue.fromCanonicalXml "<bytes>0</bytes>")
    Assert.Equal(Error DecodeError.MalformedXml, DynamicValue.fromCanonicalXml "<bytes>FF</bytes>")
