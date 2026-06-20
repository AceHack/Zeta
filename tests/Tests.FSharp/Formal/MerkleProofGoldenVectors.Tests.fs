module Zeta.Tests.Formal.MerkleProofGoldenVectorsTests

open System
open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

// Cross-language byte-lock for Merkle INCLUSION PROOFS (math-team handoff row 4
// follow-up). Companion to the existing root byte-lock (golden-vectors-merkle.json,
// shared by TS + Rust). The fixture golden-vectors-merkle-proofs.json was generated
// from THIS F# implementation (the treaty); the C#/Rust/TS oracles each replay it and
// must agree byte-for-byte on every audit path. Proofs are hex-in-JSON (no binary in
// the proof lineage): each step is {hash, right}, diffable + DST-replayable.
//
// This F# leg asserts the generating oracle still reproduces its own committed vectors
// (regression lock) AND that each proof verifies / a tampered leaf fails.

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private hexToBytes (s: string) : byte[] =
    if String.IsNullOrEmpty s then Array.empty
    else Array.init (s.Length / 2) (fun i -> Convert.ToByte(s.Substring(i * 2, 2), 16))

let private vectorsPath () =
    Path.Join(repoRoot (), "src", "Core.TypeScript", "merkle", "golden-vectors-merkle-proofs.json")

[<Fact>]
let ``proof golden vectors are present`` () =
    let doc = JsonDocument.Parse(File.ReadAllText(vectorsPath ()))
    Assert.True(doc.RootElement.GetArrayLength() >= 12, "expected at least 12 proof golden vectors")

[<Fact>]
let ``F# reproduces every committed Merkle inclusion-proof vector byte-for-byte`` () =
    let doc = JsonDocument.Parse(File.ReadAllText(vectorsPath ()))
    for v in doc.RootElement.EnumerateArray() do
        let leaves = [| for l in v.GetProperty("leaves").EnumerateArray() -> hexToBytes (l.GetString()) |]
        let index = v.GetProperty("index").GetInt32()
        let expectedRoot = v.GetProperty("root").GetString()
        let tree = MerkleTree(leaves)

        // Root agrees with the committed vector.
        Assert.Equal(expectedRoot, tree.Root.ToHex())

        // Each audit-path step (hash + side) reproduces the committed proof byte-for-byte.
        let steps = tree.Proof(index)
        let expectedSteps = v.GetProperty("siblings")
        Assert.Equal(expectedSteps.GetArrayLength(), steps.Length)
        steps
        |> Array.iteri (fun i s ->
            let es = expectedSteps.[i]
            Assert.Equal(es.GetProperty("hash").GetString(), s.Sibling.ToHex())
            Assert.Equal(es.GetProperty("right").GetBoolean(), s.SiblingOnRight))

        // The proof verifies against the committed root...
        Assert.True(MerkleTree.verifyProof leaves.[index] steps tree.Root)

        // ...and a tampered leaf does NOT (no-forge), even for a single-leaf empty path.
        let original = leaves.[index]
        let tampered =
            if original.Length = 0 then [| 0uy |]
            else Array.mapi (fun j b -> if j = 0 then b ^^^ 1uy else b) original
        Assert.False(MerkleTree.verifyProof tampered steps tree.Root)
