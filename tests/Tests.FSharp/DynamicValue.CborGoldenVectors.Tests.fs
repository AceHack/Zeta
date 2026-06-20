module Zeta.Tests.DynamicValueCborGoldenVectorsTests

open System.IO
open System.Reflection
open System.Globalization
open System.Collections.Immutable
open System.Text.Json
open global.Xunit
open Zeta.Core

// DynamicValue canonical-CBOR byte-lock — the F# oracle agrees on the shared seed
// (src/Core.TypeScript/dynamic-value/golden-vectors-cbor.json). CBOR is the TOTAL
// form (all 8 shapes), so this is where Float (RFC 8949 §4.2.2 shortest-float) and
// Bytes (major-type-2) lock — the two cases canonical JSON deferred. The seed was
// generated + RFC-8949-Appendix-A-anchored independently; `float matches RFC 8949
// Appendix A` re-anchors the float logic against the RFC directly so the lock is
// not circular, then the seed-replay proves agreement. "The compilers don't lie."

/// Walk up from the test assembly to the repo root (Zeta.sln sentinel).
let private repoRoot () : string =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location))

    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    if isNull dir then
        failwith "Could not locate repo root (Zeta.sln) from test assembly location."

    dir.FullName

// Eager array of a JsonElement's children via a direct enumerator loop, NOT a lazy
// Seq pipeline: JsonElement.ArrayEnumerator is a mutable struct and boxing it
// through Seq corrupts its state in compiled F# (works in fsi, fails in Release)
// — see tests/Tests.FSharp/Observe/GoldenVectors.Tests.fs.
let private children (el: JsonElement) : JsonElement[] =
    [| for child in el.EnumerateArray() -> child |]

let private hex (bytes: byte[]) : string =
    System.Convert.ToHexString(bytes).ToLowerInvariant()

/// Build a DynamicValue from the seed's language-neutral tagged form `{ t, v }`.
/// Float v is the IEEE-754 f64 bit pattern (16 hex, big-endian) for exactness;
/// bytes v is a hex string; int v is a decimal string.
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

                if parts.Length <> 2 then
                    failwithf "seed object pair must have exactly 2 elements [key, value], got %d" parts.Length

                (parts.[0].GetString(), buildValue parts.[1]))
            |> Array.toList)
    | other -> failwithf "unsupported tag in CBOR seed: %s" other

[<Fact>]
let ``F# CBOR encoder agrees with seed`` () =
    let path =
        Path.Join(repoRoot (), "src", "Core.TypeScript", "dynamic-value", "golden-vectors-cbor.json")

    use doc = JsonDocument.Parse(File.ReadAllText path)
    let vectors = children (doc.RootElement.GetProperty "vectors")
    Assert.NotEmpty vectors

    let failures =
        vectors
        |> Array.choose (fun v ->
            let name = v.GetProperty("name").GetString()
            let value = buildValue (v.GetProperty "value")
            let expected = v.GetProperty("cbor").GetString()
            let actual = hex (DynamicValue.toCanonicalCborOk value)

            if actual = expected then
                None
            else
                Some(sprintf "%s: expected %s but got %s" name expected actual))

    Assert.True(Array.isEmpty failures, System.String.Join("\n", failures))

// Independent RFC 8949 Appendix A anchor (anti-circularity): these canonical bytes
// come straight from the RFC, not from our encoder or the seed. ±Inf / NaN / -0.0
// are not finite literals (or need sign care), so they are a separate fact below.
[<Theory>]
[<InlineData(0.0, "f90000")>]
[<InlineData(1.0, "f93c00")>]
[<InlineData(1.5, "f93e00")>]
[<InlineData(65504.0, "f97bff")>]
[<InlineData(100000.0, "fa47c35000")>]
[<InlineData(3.4028234663852886e38, "fa7f7fffff")>]
[<InlineData(1.0e300, "fb7e37e43c8800759c")>]
[<InlineData(5.960464477539063e-8, "f90001")>]
[<InlineData(0.00006103515625, "f90400")>]
[<InlineData(-4.0, "f9c400")>]
[<InlineData(-4.1, "fbc010666666666666")>]
let ``float matches RFC 8949 Appendix A`` (value: float) (expected: string) =
    Assert.Equal(expected, hex (DynamicValue.toCanonicalCborOk (DynamicValue.Float value)))

[<Fact>]
let ``infinities, NaN, and negative zero canonicalize`` () =
    Assert.Equal("f97c00", hex (DynamicValue.toCanonicalCborOk (DynamicValue.Float System.Double.PositiveInfinity)))
    Assert.Equal("f9fc00", hex (DynamicValue.toCanonicalCborOk (DynamicValue.Float System.Double.NegativeInfinity)))
    Assert.Equal("f97e00", hex (DynamicValue.toCanonicalCborOk (DynamicValue.Float System.Double.NaN)))
    Assert.Equal("f98000", hex (DynamicValue.toCanonicalCborOk (DynamicValue.Float -0.0)))
