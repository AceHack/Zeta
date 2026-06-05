module Zeta.Tests.FrameDeltaCrossVerifyTests

open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

module FD = Zeta.Core.FrameDelta
module TF = Zeta.Core.TravelerFrame

// ═══════════════════════════════════════════════════════════════════
// FrameDelta cross-language agreement — the F# oracle replays the shared seed
// (src/Core.TypeScript/frame-delta/golden-vectors.json) that the C# oracle (and, in turn, TS/Rust) also
// verify. Both passing == agreement on the frame-offset transformation group (the 4-lang leg).
// ═══════════════════════════════════════════════════════════════════

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private toMap (e: JsonElement) : Map<string, int64> =
    [ for p in e.EnumerateObject() -> p.Name, p.Value.GetInt64() ] |> Map.ofList

let private toDelta (e: JsonElement) : FD.Delta = { FD.Shifts = toMap e }
let private toFrame (e: JsonElement) : TF.Frame =
    { TF.Coords = toMap e |> Map.map (fun _ v -> Versionstamp.ofInt64 v) }
let private frameMap (f: TF.Frame) : Map<string, int64> = f.Coords |> Map.map (fun _ vs -> vs.Version)

let private seed () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "frame-delta", "golden-vectors.json")
    Assert.True(File.Exists path, sprintf "seed not found: %s" path)
    JsonDocument.Parse(File.ReadAllText path)

[<Fact>]
let ``F# FrameDelta agrees with the shared golden seed`` () =
    use doc = seed ()
    let root = doc.RootElement
    let section (name: string) : JsonElement[] = root.GetProperty(name).EnumerateArray() |> Seq.toArray

    for v in section "compose" do
        Assert.Equal<Map<string, int64>>(toMap (v.GetProperty "result"), (FD.compose (toDelta (v.GetProperty "a")) (toDelta (v.GetProperty "b"))).Shifts)

    for v in section "inverse" do
        Assert.Equal<Map<string, int64>>(toMap (v.GetProperty "result"), (FD.inverse (toDelta (v.GetProperty "d"))).Shifts)

    for v in section "between" do
        Assert.Equal<Map<string, int64>>(toMap (v.GetProperty "result"), (FD.between (toFrame (v.GetProperty "from")) (toFrame (v.GetProperty "to"))).Shifts)

    for v in section "apply" do
        Assert.Equal<Map<string, int64>>(toMap (v.GetProperty "result"), frameMap (FD.apply (toDelta (v.GetProperty "delta")) (toFrame (v.GetProperty "frame"))))

    for v in section "magnitude" do
        Assert.Equal<int64>((v.GetProperty "result").GetInt64(), FD.magnitude (toDelta (v.GetProperty "d")))

    for v in section "distance" do
        Assert.Equal<int64>((v.GetProperty "result").GetInt64(), FD.distance (toFrame (v.GetProperty "from")) (toFrame (v.GetProperty "to")))

    // homeostat leg (order-independent aggregation) across the oracle: folding the deltas in any order
    // gives the same total.
    for v in section "aggregate" do
        let deltas = [ for d in (v.GetProperty "deltas").EnumerateArray() -> toDelta d ]
        let total = toMap (v.GetProperty "total")
        let fold order = (List.fold FD.compose FD.identity order).Shifts
        Assert.Equal<Map<string, int64>>(total, fold deltas)
        Assert.Equal<Map<string, int64>>(total, fold (List.rev deltas))
