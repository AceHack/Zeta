module Zeta.Tests.BraidGoldenVectorsTests

// Braid cross-language agreement — the F# oracle (the SHELF the seed was generated from)
// replays src/Core.TypeScript/braid/golden-vectors.json, which the C#/TS/Rust oracles also
// verify. Faithfulness (Artin 1925) means the action images pin braid identity exactly —
// agreement here is the four-oracle byte-lock for the math REPORT #3 §2 kernel functor.
// This test is the regeneration check: if Braid.fs drifts from the committed seed, it fails.

open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(typeof<Zeta.Core.ZSet<int>>.Assembly.Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private ints (e: JsonElement) : int list =
    [ for x in e.EnumerateArray() -> x.GetInt32() ]

let private word (e: JsonElement) : Braid.Word =
    [ for l in e.EnumerateArray() -> l.[0].GetInt32(), l.[1].GetInt32() ]

[<Fact>]
let ``all golden vectors agree with the F# shelf`` () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "braid", "golden-vectors.json")
    Assert.True(File.Exists path, $"seed not found: {path}")
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let root = doc.RootElement
    let n = root.GetProperty("n").GetInt32()

    for v in root.GetProperty("vectors").EnumerateArray() do
        let braid = ints (v.GetProperty "braid")
        Assert.Equal(v.GetProperty("writhe").GetInt32(), Braid.writhe braid)
        Assert.Equal(v.GetProperty("writheParity").GetInt32(), Braid.writheParity braid)
        Assert.Equal<int list>(ints (v.GetProperty "permutation"), Braid.permutation n braid)
        let actions = v.GetProperty "actions"

        for i in 0 .. n - 1 do
            Assert.Equal<Braid.Word>(word actions.[i], Braid.act braid (Braid.gen i))
