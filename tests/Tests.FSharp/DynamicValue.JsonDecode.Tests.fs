module Zeta.Tests.DynamicValueJsonDecodeTests

open System.IO
open System.Reflection
open System.Globalization
open System.Text.Json
open global.Xunit
open Zeta.Core

// DynamicValue canonical-JSON DECODE byte-lock — DynamicValue.fromCanonicalJson is the inverse of
// toCanonicalJson for the six locked shapes (Float + Bytes are DEFERRED in JSON — they lock under
// CBOR). Strictly canonical (fixed-point check toCanonicalJson(decode s) = s → DecodeError.NonCanonical);
// int64 precision is preserved by parsing the number token as text. Asserts decode round-trips the
// seed structurally + malformed / deferred-float / oversized / non-canonical inputs are rejected with
// the right DecodeError. "The compilers don't lie."

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
    | "str" -> DynamicValue.String(el.GetProperty("v").GetString())
    | "arr" -> DynamicValue.Array(children (el.GetProperty "v") |> Array.map buildValue |> Array.toList)
    | "obj" ->
        DynamicValue.Object(
            children (el.GetProperty "v")
            |> Array.map (fun pair ->
                let parts = children pair
                (parts.[0].GetString(), buildValue parts.[1]))
            |> Array.toList)
    | other -> failwithf "unsupported tag in JSON seed: %s" other

[<Fact>]
let ``F# JSON decode round-trips the seed`` () =
    let path =
        Path.Join(repoRoot (), "src", "Core.TypeScript", "dynamic-value", "golden-vectors.json")

    use doc = JsonDocument.Parse(File.ReadAllText path)
    let vectors = children (doc.RootElement.GetProperty "vectors")
    Assert.NotEmpty vectors

    let failures =
        vectors
        |> Array.choose (fun v ->
            let name = v.GetProperty("name").GetString()
            let json = v.GetProperty("json").GetString()
            let expected = buildValue (v.GetProperty "value")

            match DynamicValue.fromCanonicalJson json with
            | Ok decoded when decoded = expected -> None
            | Ok _ -> Some(sprintf "%s: decoded value != expected" name)
            | Error e -> Some(sprintf "%s: decode failed with %A" name e))

    Assert.True(Array.isEmpty failures, System.String.Join("\n", failures))

[<Fact>]
let ``F# JSON decode rejects malformed, deferred, oversized, and non-canonical`` () =
    let err (s: string) =
        match DynamicValue.fromCanonicalJson s with
        | Error e -> e
        | Ok _ -> failwith "expected Error"

    // malformed
    Assert.Equal(DecodeError.UnexpectedEnd, err "") // empty
    Assert.Equal(DecodeError.UnexpectedEnd, err "tru") // truncated literal
    Assert.Equal(DecodeError.UnexpectedEnd, err "[1,") // unterminated array
    Assert.Equal(DecodeError.UnexpectedEnd, err "{\"a\"") // object missing colon+value
    Assert.Equal(DecodeError.UnexpectedEnd, err "\"unterminated") // unterminated string
    Assert.Equal(DecodeError.UnexpectedEnd, err "\"\\u00gg\"") // \uXXXX with non-hex digits
    Assert.Equal(DecodeError.UnexpectedEnd, err "\"\\u 001\"") // \uXXXX leading whitespace (HexNumber would trim)
    Assert.Equal(DecodeError.UnexpectedEnd, err "\"\\u001 \"") // \uXXXX trailing whitespace
    Assert.Equal(DecodeError.UnexpectedEnd, err "\"\\q\"") // invalid escape
    Assert.Equal(DecodeError.UnexpectedEnd, err "1.") // no digit after '.'
    Assert.Equal(DecodeError.UnexpectedEnd, err "1e") // no exponent digits
    Assert.Equal(DecodeError.UnexpectedEnd, err "1e+") // exponent sign without digits
    Assert.Equal(DecodeError.UnexpectedEnd, err "-") // sign without digits
    // trailing
    Assert.Equal(DecodeError.TrailingData, err "null x") // value + trailing token
    Assert.Equal(DecodeError.TrailingData, err "nullnull") // two values
    // deferred float
    Assert.Equal(DecodeError.Unsupported, err "1.5")
    Assert.Equal(DecodeError.Unsupported, err "1e10")
    Assert.Equal(DecodeError.Unsupported, err "-0.0")
    // oversized
    Assert.Equal(DecodeError.IntegerOverflow, err "9223372036854775808") // i64::MAX + 1
    Assert.Equal(DecodeError.IntegerOverflow, err "-9223372036854775809") // i64::MIN - 1
    // non-canonical
    Assert.Equal(DecodeError.NonCanonical, err " null") // leading whitespace
    Assert.Equal(DecodeError.NonCanonical, err "[1, 2]") // space after comma
    Assert.Equal(DecodeError.NonCanonical, err "01") // leading zero (parses to 1 → "1")
    Assert.Equal(DecodeError.NonCanonical, err "\"\\u0041\"") // A; canonical emits raw "A"
    Assert.Equal(DecodeError.NonCanonical, err "{ \"a\":1}") // whitespace inside object
