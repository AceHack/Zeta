module Zeta.Tests.ZSetMerkleProofCrossVerifyTests

open System
open System.IO
open System.Text
open System.Text.Json
open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Yaml.Dom

// math-team row 4 — INCLUSION-PROOF golden-vector leg (the N-way independence step).
//
// The root primitive (`zset-merkle`) already byte-locks the Merkle ROOT across the
// six language oracles. This file emits the F# side of the companion INCLUSION-PROOF
// primitive (`zset-merkle-proof`): for each vector it builds the audit proof for the
// named probe with the SHIPPING `ZSetMerkle.proofFor` (F# is the reference impl under
// test), serializes the canonical proof string, and writes `fsharp-output.json`. The
// independent TS oracle (`cross-verify-proof.ts`) re-derives the SAME string from
// scratch; `compare.ts` asserts N-way agreement AND that each proof verifies against
// its embedded root. This proves not only the root but the per-leaf WITNESS (sibling
// digests + left/right path) is byte-portable — the third-party audit property.

let private enc (s: string) : byte[] = Encoding.UTF8.GetBytes s

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

type private ProofVector =
    { Id: string
      Entries: (string * int64) list
      Probe: string }

let private mapEntries (v: YamlValue) (ctx: string) : (string * YamlValue) list =
    match v with
    | VMap entries -> entries
    | other -> raise (InvalidOperationException(sprintf "expected Map at %s, got %A" ctx other))

let private field (entries: (string * YamlValue) list) (key: string) (ctx: string) : YamlValue =
    match entries |> List.tryFind (fun (k, _) -> String.Equals(k, key, StringComparison.Ordinal)) with
    | Some(_, value) -> value
    | None -> raise (InvalidOperationException(sprintf "missing field '%s' at %s" key ctx))

let private asStr (v: YamlValue) (ctx: string) : string =
    match v with
    | VStr s -> s
    | other -> raise (InvalidOperationException(sprintf "expected Str at %s, got %A" ctx other))

let private loadVectors (yamlText: string) : ProofVector list =
    let rootVal =
        match Zeta.Core.FSharp.Yaml.Dom.parse yamlText with
        | Ok value -> value
        | Error feedback ->
            raise (InvalidOperationException(sprintf "our YAML port declined vectors.yaml: %A" feedback))
    let top = mapEntries rootVal "<root>"
    match field top "vectors" "<root>" with
    | VSeq items ->
        items
        |> List.mapi (fun idx item ->
            let ctx = sprintf "vectors[%d]" idx
            let m = mapEntries item ctx
            let id = asStr (field m "id" ctx) (ctx + ".id")
            let probe = asStr (field m "probe" ctx) (ctx + ".probe")
            let entriesVal = field m "entries" ctx
            let entries =
                match entriesVal with
                | VSeq entryItems ->
                    [ for i, entryVal in Seq.indexed entryItems ->
                        let eCtx = sprintf "%s.entries[%d]" ctx i
                        let em = mapEntries entryVal eCtx
                        let k = asStr (field em "key" eCtx) (eCtx + ".key")
                        let w =
                            match field em "weight" eCtx with
                            | VInt w -> w
                            | other -> raise (InvalidOperationException(sprintf "expected Int at %s.weight, got %A" eCtx other))
                        k, w ]
                | VNull -> []
                | other -> raise (InvalidOperationException(sprintf "expected Seq at %s.entries, got %A" ctx other))
            { Id = id; Entries = entries; Probe = probe })
    | other -> raise (InvalidOperationException(sprintf "expected Seq at vectors, got %A" other))

/// Canonical proof string: root_hex|leaf_key_hex:leaf_weight|<R|L>sibling_hex,...
let private proofString (rootHex: string) (proof: ZSetMerkle.MerkleProof) : string =
    let leafHex = proof.LeafKeyBytes |> Array.map (sprintf "%02x") |> String.concat ""
    let path =
        proof.Steps
        |> Array.map (fun s -> sprintf "%s%s" (if s.SiblingOnRight then "R" else "L") (s.Sibling.ToHex()))
        |> String.concat ","
    sprintf "%s|%s:%d|%s" rootHex leafHex proof.LeafWeight path

[<Fact>]
let ``cross-verify F# zset-merkle inclusion proofs matches expected`` () =
    let root = repoRoot ()
    let yamlPath = Path.Join(root, "tests", "cross-verification", "zset-merkle-proof", "vectors.yaml")
    let vectors = loadVectors (File.ReadAllText yamlPath)

    let results = System.Collections.Generic.Dictionary<string, string>(StringComparer.Ordinal)
    let mutable failures = 0

    for v in vectors do
        let z = ZSet.ofSeq v.Entries
        let rootHash = ZSetMerkle.root enc z
        match ZSetMerkle.proofFor enc z v.Probe with
        | Some proof ->
            // self-consistency: the shipping proof must verify against the shipping root.
            if not (ZSetMerkle.verify proof rootHash) then failures <- failures + 1
            results.[v.Id] <- proofString (rootHash.ToHex()) proof
        | None -> failures <- failures + 1

    let options = JsonSerializerOptions(WriteIndented = true)
    let json = JsonSerializer.Serialize(results, options).Replace("\r\n", "\n")
    let outputPath = Path.Join(root, "tests", "cross-verification", "zset-merkle-proof", "fsharp-output.json")
    File.WriteAllText(outputPath, json + "\n")

    Assert.Equal(0, failures)
