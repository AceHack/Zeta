module Zeta.Tests.RendezvousHashCrossVerifyTests

open System.Globalization
open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// Rendezvous (HRW) consistent-hash cross-language agreement — the F# oracle uses the REAL canonical
// RendezvousHash.Create / Pick and replays the shared seed
// (src/Core.TypeScript/consistent-hash/golden-vectors.json) that the C#/TS/Rust oracles also verify.
// Pure wrapping uint64 (the SplitMix64 score). F# seeds are private, so the F# leg verifies Pick (the
// observable) — agreement transitively confirms the seed(i)=mix(i) formula matches; C#/TS/Rust verify
// the seeds array directly. Jump is excluded (f64, out of the proof lineage).
// ═══════════════════════════════════════════════════════════════════

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private u (s: string) : uint64 = System.UInt64.Parse(s, CultureInfo.InvariantCulture)

[<Fact>]
let ``F# RendezvousHash.Pick agrees with the shared golden seed`` () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "consistent-hash", "golden-vectors.json")
    Assert.True(File.Exists path, sprintf "seed not found: %s" path)
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let picks = doc.RootElement.GetProperty("pick").EnumerateArray() |> Seq.toArray

    for v in picks do
        let n = (v.GetProperty "buckets").GetInt32()
        let key = u ((v.GetProperty "key").GetString())
        let h = RendezvousHash.Create n
        Assert.Equal<int>((v.GetProperty "result").GetInt32(), h.Pick key)
