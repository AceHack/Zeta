module Zeta.Tests.Crc32cCrossVerifyTests

open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// CRC32C cross-language agreement — the F# oracle uses the REAL canonical HardwareCrc.Crc32C (the
// hardware SSE4.2 / ARMv8 path on every supported host) and replays the shared seed
// (src/Core.TypeScript/crc32c/golden-vectors.json) that the C#/TS/Rust oracles also verify. Every CI
// host has hardware CRC32C, so this is a genuine hardware-vs-table cross-check; the canonical check
// value CRC32C("123456789") = 3808858755 anchors correctness.
// ═══════════════════════════════════════════════════════════════════

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

[<Fact>]
let ``F# HardwareCrc.Crc32C agrees with the shared golden seed`` () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "crc32c", "golden-vectors.json")
    Assert.True(File.Exists path, sprintf "seed not found: %s" path)
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let cases = doc.RootElement.GetProperty("crc32c").EnumerateArray() |> Seq.toArray

    for v in cases do
        let payload = [| for b in (v.GetProperty "payload").EnumerateArray() -> byte (b.GetInt32()) |]
        let expected = (v.GetProperty "result").GetUInt32()
        Assert.Equal<uint32>(expected, HardwareCrc.Crc32C(System.ReadOnlySpan<byte>(payload)))
