module Zeta.Tests.SoftValueCrossVerifyTests

open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

module SV = Zeta.Core.SoftValue

// ═══════════════════════════════════════════════════════════════════
// SoftValue cross-language agreement — the F# oracle uses the REAL (float) SoftValue and asserts its
// DECISIONS match the shared seed (src/Core.TypeScript/soft-value/golden-vectors.json) that the C#/TS/Rust
// exact-arithmetic oracles also verify. The seed values are chosen far from float-precision boundaries, so
// the decision is float-safe. Only the decisions (resolve / observe-then-resolve) are cross-verified — the
// float confidence/entropy VALUES do not byte-lock and are out of scope.
// ═══════════════════════════════════════════════════════════════════

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private cands (e: JsonElement) : (DynamicValue * float) list =
    [ for p in e.EnumerateObject() -> DynamicValue.String p.Name, float (p.Value.GetInt64()) ]

let private likMap (e: JsonElement) : Map<string, int64> =
    [ for p in e.EnumerateObject() -> p.Name, p.Value.GetInt64() ] |> Map.ofList

let private expected (e: JsonElement) : string option =
    if e.ValueKind = JsonValueKind.Null then None else Some(e.GetString())

let private asString (dv: DynamicValue) : string =
    match dv with
    | DynamicValue.String s -> s
    | _ -> ""

[<Fact>]
let ``F# SoftValue decisions agree with the shared golden seed`` () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "soft-value", "golden-vectors.json")
    Assert.True(File.Exists path, sprintf "seed not found: %s" path)
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let root = doc.RootElement
    let section (name: string) : JsonElement[] = root.GetProperty(name).EnumerateArray() |> Seq.toArray

    for v in section "resolve" do
        let threshold = float ((v.GetProperty "num").GetInt64()) / float ((v.GetProperty "den").GetInt64())
        let got =
            SV.ofWeighted (cands (v.GetProperty "candidates"))
            |> Option.bind (SV.resolve threshold)
            |> Option.map asString
        Assert.Equal<string option>(expected (v.GetProperty "result"), got)

    for v in section "observeResolve" do
        let threshold = float ((v.GetProperty "num").GetInt64()) / float ((v.GetProperty "den").GetInt64())
        let lik = likMap (v.GetProperty "likelihood")
        let likelihood (d: DynamicValue) : float =
            match d with
            | DynamicValue.String s -> float (Map.tryFind s lik |> Option.defaultValue 0L)
            | _ -> 0.0
        let got =
            SV.ofWeighted (cands (v.GetProperty "prior"))
            |> Option.bind (SV.observe likelihood)
            |> Option.bind (SV.resolve threshold)
            |> Option.map asString
        Assert.Equal<string option>(expected (v.GetProperty "result"), got)
