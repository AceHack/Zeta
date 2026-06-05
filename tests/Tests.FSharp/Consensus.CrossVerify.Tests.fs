module Zeta.Tests.ConsensusCrossVerifyTests

open System
open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

module C = Zeta.Core.Consensus

// ═══════════════════════════════════════════════════════════════════
// BFT consensus cross-language agreement — the F# oracle uses the REAL canonical Consensus.quorumThreshold
// / decide and replays the shared seed (src/Core.TypeScript/consensus/golden-vectors.json) that the
// C#/TS/Rust oracles also verify. Pure integer decision core; the vote state machine carries timestamps
// and is out of byte-lock scope.
// ═══════════════════════════════════════════════════════════════════

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

[<Fact>]
let ``F# Consensus decision core agrees with the shared golden seed`` () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "consensus", "golden-vectors.json")
    Assert.True(File.Exists path, sprintf "seed not found: %s" path)
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let root = doc.RootElement
    let section (name: string) : JsonElement[] = root.GetProperty(name).EnumerateArray() |> Seq.toArray

    for v in section "quorumThreshold" do
        Assert.Equal<int>((v.GetProperty "result").GetInt32(), C.quorumThreshold ((v.GetProperty "n").GetInt32()))

    for v in section "decide" do
        let votes =
            [ for e in (v.GetProperty "votes").EnumerateArray() ->
                { C.Node = C.NodeId "n"; C.Value = e.GetString(); C.Timestamp = DateTimeOffset.UnixEpoch } ]
        let r = v.GetProperty "result"
        let expectedCommitted = (r.GetProperty "committed").GetBoolean()
        let expectedValue = if (r.GetProperty "value").ValueKind = JsonValueKind.Null then None else Some((r.GetProperty "value").GetString())
        let expectedCount = (r.GetProperty "count").GetInt32()
        let expectedTotal = (r.GetProperty "total").GetInt32()

        match C.decide votes with
        | C.Committed(value, quorum, total) ->
            Assert.True(expectedCommitted, "expected reject but got commit")
            Assert.Equal<string option>(expectedValue, Some value)
            Assert.Equal<int>(expectedCount, quorum)
            Assert.Equal<int>(expectedTotal, total)
        | C.Rejected(_, votesFor, total) ->
            Assert.False(expectedCommitted, "expected commit but got reject")
            Assert.Equal<string option>(expectedValue, None)
            Assert.Equal<int>(expectedCount, votesFor)
            Assert.Equal<int>(expectedTotal, total)
