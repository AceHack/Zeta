module Zeta.Tests.FSharp.MessagePack.CrossVerifyTests

open System
open System.IO
open System.Reflection
open System.Globalization
open System.Collections.Immutable
open System.Text
open System.Text.Json
open Xunit
open Zeta.Core

// ---------------------------------------------------------------------------
// Repo-root walk (Zeta.sln sentinel; mirrors CanonicalJson CrossVerifyTests)
// ---------------------------------------------------------------------------

type private Marker = class end

let private repoRoot () : string =
    let assembly = typeof<Marker>.Assembly
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(assembly.Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then
        raise (InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location."))
    dir.FullName

let private children (el: JsonElement) : JsonElement[] =
    [| for child in el.EnumerateArray() -> child |]

let private hex (bytes: byte[]) : string =
    System.Convert.ToHexString(bytes).ToLowerInvariant()

/// Build a DynamicValue from the seed's tagged form `{ t, v }`.
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
    | other -> failwithf "unsupported tag in MessagePack seed: %s" other

/// Escape string for writing JSON output.
let private jsonEscape (s: string) : string =
    let sb = StringBuilder()
    sb.Append '"' |> ignore
    for ch in s do
        match ch with
        | '"' -> sb.Append "\\\"" |> ignore
        | '\\' -> sb.Append "\\\\" |> ignore
        | '\b' -> sb.Append "\\b" |> ignore
        | '\012' -> sb.Append "\\f" |> ignore
        | '\n' -> sb.Append "\\n" |> ignore
        | '\r' -> sb.Append "\\r" |> ignore
        | '\t' -> sb.Append "\\t" |> ignore
        | _ ->
            let code = int ch
            if code <= 0x1f then sb.Append("\\u").Append(code.ToString("x4")) |> ignore
            else sb.Append ch |> ignore
    sb.Append '"' |> ignore
    sb.ToString()

[<Fact>]
let ``cross-verify messagepack vectors match TS`` () =
    let root = repoRoot ()
    let dir = Path.Join(root, "tests", "cross-verification", "messagepack")
    let vectorsPath = Path.Join(dir, "vectors.json")
    let vectorsText = File.ReadAllText(vectorsPath)

    use doc = JsonDocument.Parse(vectorsText)
    let vectors = children (doc.RootElement.GetProperty("vectors"))

    let results = ResizeArray<string * string>()
    let mutable mismatches = 0

    for vec in vectors do
        let id = vec.GetProperty("id").GetString()
        let expected = vec.GetProperty("expected_msgpack").GetString()
        let value = buildValue (vec.GetProperty("value"))
        let actual = hex (DynamicValue.toCanonicalMsgpack value)

        results.Add(id, actual)
        if not (String.Equals(actual, expected, StringComparison.Ordinal)) then
            mismatches <- mismatches + 1

    // Write fsharp-output.json so compare.ts can verify TS == F#.
    // Hand-emit `{ "key": "value", ... }` to match JS JSON.stringify format exactly.
    let body =
        results
        |> Seq.map (fun (k, v) -> "  " + jsonEscape k + ": " + jsonEscape v)
        |> String.concat ",\n"
    let json = "{\n" + body + "\n}\n"
    let outputPath = Path.Join(dir, "fsharp-output.json")
    File.WriteAllText(outputPath, json, UTF8Encoding(false))

    Assert.Equal(0, mismatches)
