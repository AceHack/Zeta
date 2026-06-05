module Zeta.Tests.SplitMix64CrossVerifyTests

open System.Globalization
open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// SplitMix64 cross-language agreement — the F# oracle uses the REAL canonical SplitMix64.mix and
// replays the shared seed (src/Core.TypeScript/splitmix64/golden-vectors.json) that the C#/TS/Rust
// oracles also verify. Pure wrapping uint64; load-bearing for DST (replays must produce identical
// pseudo-random streams across language ports). uint64 is carried as decimal strings for exactness.
// ═══════════════════════════════════════════════════════════════════

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private u (s: string) : uint64 = System.UInt64.Parse(s, CultureInfo.InvariantCulture)

[<Fact>]
let ``F# SplitMix64.mix agrees with the shared golden seed`` () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "splitmix64", "golden-vectors.json")
    Assert.True(File.Exists path, sprintf "seed not found: %s" path)
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let mix = doc.RootElement.GetProperty("mix").EnumerateArray() |> Seq.toArray

    for v in mix do
        Assert.Equal<uint64>(u ((v.GetProperty "result").GetString()), SplitMix64.mix (u ((v.GetProperty "x").GetString())))
