module Zeta.Tests.UncertainClockCrossVerifyTests

open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

module UC = Zeta.Core.UncertainClock

// ═══════════════════════════════════════════════════════════════════
// UncertainClock cross-language agreement — the F# oracle uses the REAL canonical UncertainClock and
// replays the shared seed (src/Core.TypeScript/uncertain-clock/golden-vectors.json) that the C#/TS/Rust
// oracles also verify. Every value is exact int64, so the full surface byte-locks (no float caveat):
// compareHlc, send, receive, definitelyBefore, uncertain.
// ═══════════════════════════════════════════════════════════════════

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private hlc (e: JsonElement) : UC.Hlc =
    { Physical = (e.GetProperty "physical").GetInt64(); Logical = (e.GetProperty "logical").GetInt64() }

[<Fact>]
let ``F# UncertainClock agrees with the shared golden seed`` () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "uncertain-clock", "golden-vectors.json")
    Assert.True(File.Exists path, sprintf "seed not found: %s" path)
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let root = doc.RootElement
    let section (name: string) : JsonElement[] = root.GetProperty(name).EnumerateArray() |> Seq.toArray

    for v in section "compareHlc" do
        Assert.Equal<int>((v.GetProperty "result").GetInt32(), UC.compareHlc (hlc (v.GetProperty "a")) (hlc (v.GetProperty "b")))

    for v in section "send" do
        Assert.Equal<UC.Hlc>(hlc (v.GetProperty "result"), UC.send (hlc (v.GetProperty "clock")) ((v.GetProperty "now").GetInt64()))

    for v in section "receive" do
        Assert.Equal<UC.Hlc>(hlc (v.GetProperty "result"), UC.receive (hlc (v.GetProperty "clock")) (hlc (v.GetProperty "msg")) ((v.GetProperty "now").GetInt64()))

    let mk (e: JsonElement) : UC.Uncertain =
        UC.make { Physical = (e.GetProperty "physical").GetInt64(); Logical = 0L } ((e.GetProperty "eps").GetInt64())

    for v in section "definitelyBefore" do
        Assert.Equal<bool>((v.GetProperty "result").GetBoolean(), UC.definitelyBefore (mk (v.GetProperty "a")) (mk (v.GetProperty "b")))

    for v in section "uncertain" do
        Assert.Equal<bool>((v.GetProperty "result").GetBoolean(), UC.uncertain (mk (v.GetProperty "a")) (mk (v.GetProperty "b")))
