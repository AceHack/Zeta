module Zeta.Tests.WatermarkCrossVerifyTests

open System
open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// Watermark cross-language agreement — the F# oracle uses the REAL canonical WatermarkTracker /
// Watermark.combine / Watermark.isLate and replays the shared seed
// (src/Core.TypeScript/watermark/golden-vectors.json) that the C#/TS/Rust oracles also verify.
// All exact int64 in the safe-integer range; the surface byte-locks.
// ═══════════════════════════════════════════════════════════════════

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private longs (e: JsonElement) : int64[] =
    e.EnumerateArray() |> Seq.map (fun x -> x.GetInt64()) |> Seq.toArray

[<Fact>]
let ``F# Watermark agrees with the shared golden seed`` () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "watermark", "golden-vectors.json")
    Assert.True(File.Exists path, sprintf "seed not found: %s" path)
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let root = doc.RootElement
    let section (name: string) : JsonElement[] = root.GetProperty(name).EnumerateArray() |> Seq.toArray

    for v in section "observe" do
        let strategy =
            match (v.GetProperty "strategy").GetString() with
            | "monotonic" -> WatermarkStrategy.Monotonic
            | _ -> WatermarkStrategy.BoundedLateness(TimeSpan.FromMilliseconds(float ((v.GetProperty "lateness").GetInt64())))
        let tracker = WatermarkTracker strategy
        let got = [| for e in longs (v.GetProperty "events") -> tracker.Observe e |]
        Assert.Equal<int64[]>(longs (v.GetProperty "result"), got)

    for v in section "isLate" do
        Assert.Equal<bool>((v.GetProperty "result").GetBoolean(),
                           Watermark.isLate ((v.GetProperty "wm").GetInt64()) ((v.GetProperty "eventTime").GetInt64()))

    for v in section "combine" do
        Assert.Equal<int64>((v.GetProperty "result").GetInt64(), Watermark.combine (longs (v.GetProperty "sources")))
