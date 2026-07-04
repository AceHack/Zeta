module Zeta.Tests.DynamicValueMsgpackGoldenVectorsTests

open System.IO
open System.Reflection
open System.Globalization
open System.Collections.Immutable
open System.Text.Json
open global.Xunit
open Zeta.Core

/// Walk up from the test assembly to the repo root (Zeta.sln sentinel).
let private repoRoot () : string =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location))

    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    if isNull dir then
        failwith "Could not locate repo root (Zeta.sln) from test assembly location."

    dir.FullName

// Eager array of a JsonElement's children via a direct enumerator loop, NOT a lazy
// Seq pipeline.
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

[<Fact>]
let ``F# MessagePack encoder agrees with seed`` () =
    let path =
        Path.Join(repoRoot (), "src", "Core.TypeScript", "dynamic-value", "golden-vectors-msgpack.json")

    use doc = JsonDocument.Parse(File.ReadAllText path)
    let vectors = children (doc.RootElement.GetProperty "vectors")
    Assert.NotEmpty vectors

    let failures =
        vectors
        |> Array.choose (fun v ->
            let name = v.GetProperty("name").GetString()
            let value = buildValue (v.GetProperty "value")
            let expected = v.GetProperty("msgpack").GetString()
            let actual = hex (DynamicValue.toCanonicalMsgpack value)

            if actual = expected then
                None
            else
                Some(sprintf "%s: expected %s but got %s" name expected actual))

    Assert.True(Array.isEmpty failures, System.String.Join("\n", failures))

[<Fact>]
let ``MessagePack roundtrip is bijective for all vectors`` () =
    let path =
        Path.Join(repoRoot (), "src", "Core.TypeScript", "dynamic-value", "golden-vectors-msgpack.json")

    use doc = JsonDocument.Parse(File.ReadAllText path)
    let vectors = children (doc.RootElement.GetProperty "vectors")
    
    for v in vectors do
        let value = buildValue (v.GetProperty "value")
        let bytes = DynamicValue.toCanonicalMsgpack value
        match DynamicValue.fromCanonicalMsgpack bytes with
        | Ok decoded -> Assert.Equal(value, decoded)
        | Error e -> failwithf "failed to decode %s: %A" (v.GetProperty("name").GetString()) e
