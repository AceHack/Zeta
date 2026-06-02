module Zeta.Tests.DynamicValueGoldenVectorsTests

open System.IO
open System.Reflection
open System.Globalization
open System.Text.Json
open global.Xunit
open Zeta.Core

// DynamicValue cross-language byte-lock — the F# oracle RE-GROUNDED against the
// shared seed (src/Core.TypeScript/dynamic-value/golden-vectors.json). Seed-first
// (the maintainer 2026-06-01: "we are growing code from the seeds"): the seed is
// the canonical DATA; this proves the F# canonical encoder AGREES on it
// (encode(value) = Ok json) for every locked vector. v1 locks
// null/bool/int/string/array/object; Float + Bytes are DEFERRED (not in the
// locked vectors). "The compilers don't lie."

/// Walk up from the test assembly to the repo root (Zeta.sln sentinel) — same
/// pattern as the algebra / observe golden-vector tests.
let private repoRoot () : string =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location))

    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    if isNull dir then
        failwith "Could not locate repo root (Zeta.sln) from test assembly location."

    dir.FullName

// Eager array of a JsonElement's children via a direct enumerator loop
// (`[| for … -> … |]`), NOT `EnumerateArray() |> Seq.toArray`:
// JsonElement.ArrayEnumerator is a mutable struct, and boxing it through the lazy
// Seq pipeline corrupts its state in compiled F# (works in fsi, fails in Release)
// — see tests/Tests.FSharp/Observe/GoldenVectors.Tests.fs.
let private children (el: JsonElement) : JsonElement[] =
    [| for child in el.EnumerateArray() -> child |]

/// Build a DynamicValue from the seed's language-neutral tagged form `{ t, v }`.
/// v1 locks null/bool/int/string/arr/obj; float/bytes are DEFERRED (not present
/// in the locked vectors), so an unsupported tag fails loudly.
let rec private buildValue (el: JsonElement) : DynamicValue =
    match el.GetProperty("t").GetString() with
    | "null" -> DynamicValue.Null
    | "bool" -> DynamicValue.Bool(el.GetProperty("v").GetBoolean())
    | "int" -> DynamicValue.Int(System.Int64.Parse(el.GetProperty("v").GetString(), CultureInfo.InvariantCulture))
    | "str" -> DynamicValue.String(el.GetProperty("v").GetString())
    | "arr" -> DynamicValue.Array [ for item in children (el.GetProperty("v")) -> buildValue item ]
    | "obj" ->
        DynamicValue.Object
            [ for pair in children (el.GetProperty("v")) do
                  let parts = children pair
                  yield (parts.[0].GetString(), buildValue parts.[1]) ]
    | other -> failwithf "unsupported tag in v1 seed: %s" other

[<Fact>]
let ``F# canonical encoder agrees with the shared DynamicValue seed (byte-lock)`` () =
    let path =
        Path.Join(repoRoot (), "src", "Core.TypeScript", "dynamic-value", "golden-vectors.json")

    use doc = JsonDocument.Parse(File.ReadAllText(path))
    let vectors = children (doc.RootElement.GetProperty("vectors"))
    Assert.True(vectors.Length > 0, "seed must have vectors")

    let failures =
        [ for v in vectors do
              let name = v.GetProperty("name").GetString()
              let value = buildValue (v.GetProperty("value"))
              let expected = v.GetProperty("json").GetString()

              match DynamicValue.toCanonicalJson value with
              | Ok actual when actual = expected -> ()
              | Ok actual -> yield sprintf "%s: expected %s but got %s" name expected actual
              | Error e -> yield sprintf "%s: expected %s but got Error %A" name expected e ]

    Assert.True(List.isEmpty failures, "byte-lock mismatches:\n" + String.concat "\n" failures)
