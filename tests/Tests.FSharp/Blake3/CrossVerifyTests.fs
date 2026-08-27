module Zeta.Tests.FSharp.Blake3.CrossVerifyTests

open System
open System.IO
open System.Text
open System.Text.Json
open Xunit
open Zeta.Core.FSharp.Blake3
open Zeta.Core.FSharp.Yaml.Dom

// ---------------------------------------------------------------------------
// Repo-root walk (Zeta.sln sentinel)
// ---------------------------------------------------------------------------

let private repoRoot () : string =
    let assembly = typeof<YamlValue>.Assembly
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(assembly.Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then
        raise (InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location."))
    dir.FullName

// ---------------------------------------------------------------------------
// YamlValue navigation helpers
// ---------------------------------------------------------------------------

let private mapEntries (v: YamlValue) (ctx: string) : (string * YamlValue) list =
    match v with
    | VMap entries -> entries
    | other -> raise (InvalidOperationException(sprintf "expected Map at %s, got %A" ctx other))

let private field (entries: (string * YamlValue) list) (key: string) (ctx: string) : YamlValue =
    match entries |> List.tryFind (fun (k, _) -> String.Equals(k, key, StringComparison.Ordinal)) with
    | Some(_, value) -> value
    | None -> raise (InvalidOperationException(sprintf "missing field '%s' at %s" key ctx))

let private tryField (entries: (string * YamlValue) list) (key: string) : YamlValue option =
    entries
    |> List.tryFind (fun (k, _) -> String.Equals(k, key, StringComparison.Ordinal))
    |> Option.map snd

let private asStr (v: YamlValue) (ctx: string) : string =
    match v with
    | VStr s -> s
    | other -> raise (InvalidOperationException(sprintf "expected Str at %s, got %A" ctx other))

// ---------------------------------------------------------------------------
// Hex decode helper
// ---------------------------------------------------------------------------

let private hexDecode (hexStr: string) : byte[] =
    let n = hexStr.Length
    if n % 2 <> 0 then
        raise (InvalidOperationException(sprintf "hex string length %d is not even" n))
    [| for i in 0 .. (n / 2) - 1 ->
        byte (Convert.ToInt32(hexStr.Substring(i * 2, 2), 16)) |]

// ---------------------------------------------------------------------------
// Vector schema
// ---------------------------------------------------------------------------

type private Blake3Vector = {
    Id: string
    InputBytes: byte[]
    ExpectedHex: string
}

let private toVector (idx: int) (item: YamlValue) : Blake3Vector =
    let ctx = sprintf "vectors[%d]" idx
    let m = mapEntries item ctx
    let id = asStr (field m "id" ctx) (ctx + ".id")
    let expectedHex = asStr (field m "expected_hex" ctx) (ctx + ".expected_hex")
    let inputBytes =
        match tryField m "input_utf8" with
        | Some v ->
            let s = asStr v (ctx + ".input_utf8")
            Encoding.UTF8.GetBytes s
        | None ->
            match tryField m "input_hex" with
            | Some v ->
                let h = asStr v (ctx + ".input_hex")
                hexDecode h
            | None ->
                raise (InvalidOperationException(sprintf "vector %s has neither input_utf8 nor input_hex" id))
    { Id = id; InputBytes = inputBytes; ExpectedHex = expectedHex }

let private loadVectors (yamlText: string) : Blake3Vector list =
    let root =
        match parse yamlText with
        | Ok value -> value
        | Error feedback ->
            raise (InvalidOperationException(sprintf "our YAML port declined vectors.yaml: %A" feedback))
    let top = mapEntries root "<root>"
    match field top "vectors" "<root>" with
    | VSeq items -> items |> List.mapi toVector
    | other -> raise (InvalidOperationException(sprintf "expected Seq at vectors, got %A" other))

// ---------------------------------------------------------------------------
// Cross-verify fact
// ---------------------------------------------------------------------------

[<Fact>]
let ``cross-verify five blake3-256 vectors match TS+Rust hex`` () =
    // Initialize Blake3Hasher assembly to wire the ContentHash256 hook
    System.Runtime.CompilerServices.RuntimeHelpers.RunClassConstructor(typeof<OwnBlake3Hasher>.TypeHandle)

    let root = repoRoot ()
    let yamlPath = Path.Join(root, "tests", "cross-verification", "blake3-256", "vectors.yaml")
    let yamlText = File.ReadAllText(yamlPath)

    let vectors = loadVectors yamlText

    let results = System.Collections.Generic.Dictionary<string, string>(StringComparer.Ordinal)
    let mutable mismatches = 0

    for v in vectors do
        let hash = ContentHash256.ofBytes v.InputBytes
        let hex = hash.ToHex()
        results.[v.Id] <- hex
        if not (String.Equals(hex, v.ExpectedHex, StringComparison.Ordinal)) then
            mismatches <- mismatches + 1

    // Write fsharp-output.json so compare.ts can verify TS == F# == Rust.
    // Normalize to pure LF (net10 System.Text.Json indents with platform newline on Windows).
    let options = JsonSerializerOptions(WriteIndented = true)
    let json = JsonSerializer.Serialize(results, options).Replace("\r\n", "\n")
    let outputPath = Path.Join(root, "tests", "cross-verification", "blake3-256", "fsharp-output.json")
    File.WriteAllText(outputPath, json)

    Assert.Equal(0, mismatches)
