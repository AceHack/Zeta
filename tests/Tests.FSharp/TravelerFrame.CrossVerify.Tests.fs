module Zeta.Tests.TravelerFrameCrossVerifyTests

open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

module TF = Zeta.Core.TravelerFrame

// ═══════════════════════════════════════════════════════════════════
// TravelerFrame cross-language agreement — the F# oracle replays the shared seed
// (src/Core.TypeScript/traveler-frame/golden-vectors.json) that the C# oracle (and TS/Rust) also verify.
// Both passing == agreement on the causal vector-clock frame (the 4-lang leg).
// ═══════════════════════════════════════════════════════════════════

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private toFrame (e: JsonElement) : TF.Frame =
    { TF.Coords = [ for p in e.EnumerateObject() -> p.Name, Versionstamp.ofInt64 (p.Value.GetInt64()) ] |> Map.ofList }

let private frameMap (f: TF.Frame) : Map<string, int64> = f.Coords |> Map.map (fun _ vs -> vs.Version)
let private toMap (e: JsonElement) : Map<string, int64> =
    [ for p in e.EnumerateObject() -> p.Name, p.Value.GetInt64() ] |> Map.ofList

[<Fact>]
let ``F# TravelerFrame agrees with the shared golden seed`` () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "traveler-frame", "golden-vectors.json")
    Assert.True(File.Exists path, sprintf "seed not found: %s" path)
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let root = doc.RootElement
    let section (name: string) : JsonElement[] = root.GetProperty(name).EnumerateArray() |> Seq.toArray

    for v in section "transform" do
        Assert.Equal<Map<string, int64>>(toMap (v.GetProperty "result"), frameMap (TF.transform (toFrame (v.GetProperty "a")) (toFrame (v.GetProperty "b"))))

    for v in section "dominates" do
        Assert.Equal<bool>((v.GetProperty "result").GetBoolean(), TF.dominates (toFrame (v.GetProperty "a")) (toFrame (v.GetProperty "b")))

    for v in section "converge" do
        let frames = [ for f in (v.GetProperty "frames").EnumerateArray() -> toFrame f ]
        let lub = toMap (v.GetProperty "lub")
        Assert.Equal<Map<string, int64>>(lub, frameMap (TF.commonFrame frames))
        Assert.Equal<Map<string, int64>>(lub, frameMap (TF.commonFrame (List.rev frames)))
