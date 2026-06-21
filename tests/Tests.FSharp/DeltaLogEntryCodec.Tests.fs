module Zeta.Tests.DeltaLogEntryCodecTests

open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// `Log` noun — canonical entry codec (workitem 081KTGD5JMD). The F# REFERENCE oracle for the
// DeltaLogEntry byte-lock: a whole entry { Seq; Delta; Captured } maps to a DynamicValue.Object
// (captured/delta/seq, ordinal order) and rides DynamicValue's already-4-lang-locked canonical
// serializers — so the Log entry inherits the byte-lock with NO new canonical encoding (no new noun).
// These tests prove the F# side: lossless round-trip, deterministic byte-stability, and ORDINAL
// Captured-key ordering (culture-invariant; 081KT07NV0008QG0R001YDB73K — the property the old System.Text.Json framing
// did not guarantee). The cross-language hex treaty (C#/Rust/TS conform) is the follow-up seed slice.
// ═══════════════════════════════════════════════════════════════════

let private keyEnc (s: string) : DynamicValue = DynamicValue.String s
let private keyDec (dv: DynamicValue) : string =
    match dv with
    | DynamicValue.String s -> s
    | o -> failwithf "key not String: %A" o

let private entry seq pairs captured : DeltaLogEntry<string> =
    DeltaLogEntry<string>(seq, ZSet.ofSeq pairs, Map.ofList captured)

let private samples : DeltaLogEntry<string> list =
    [ entry 0L [] []                                            // empty entry
      entry 1L [ "a", 1L ] []                                   // single insert, no captured
      entry 2L [ "a", 1L; "b", -2L; "c", 3L ] []                // multi-key incl. ℤ retraction (-2)
      entry 7L [ "x", -1L ] [ "seed", "42"; "actor", "otto" ]   // captured present
      entry 9L [ "k", 5L ] [ "b", "2"; "a", "1"; "Z", "26" ] ]  // captured needing ordinal sort

let private eq (a: DeltaLogEntry<string>) (b: DeltaLogEntry<string>) =
    a.Seq = b.Seq && a.Delta = b.Delta && a.Captured = b.Captured

[<Fact>]
let ``CBOR round-trip: decodeCbor (encodeCbor e) = e for all samples`` () =
    for e in samples do
        let rt = DeltaLogEntryCodec.decodeCbor keyDec (DeltaLogEntryCodec.encodeCbor keyEnc e)
        Assert.True(eq e rt, sprintf "CBOR round-trip mismatch for seq %d" e.Seq)

[<Fact>]
let ``JSON round-trip: decodeJson (encodeJson e) = e for all samples`` () =
    for e in samples do
        match DeltaLogEntryCodec.encodeJson keyEnc e with
        | Ok json ->
            let rt = DeltaLogEntryCodec.decodeJson keyDec json
            Assert.True(eq e rt, sprintf "JSON round-trip mismatch for seq %d" e.Seq)
        | Error err -> Assert.True(false, sprintf "encodeJson failed for seq %d: %A" e.Seq err)

[<Fact>]
let ``Byte-stability: encodeCbor is deterministic (same entry -> same bytes)`` () =
    for e in samples do
        let a = DeltaLogEntryCodec.encodeCbor keyEnc e
        let b = DeltaLogEntryCodec.encodeCbor keyEnc e
        Assert.Equal<byte[]>(a, b)

[<Fact>]
let ``Captured keys serialize in ORDINAL order regardless of insertion order`` () =
    // Same pairs, different insertion order -> identical canonical bytes (ordinal-sorted keys).
    let e1 = entry 3L [ "k", 1L ] [ "b", "2"; "a", "1"; "Z", "26" ]
    let e2 = entry 3L [ "k", 1L ] [ "Z", "26"; "a", "1"; "b", "2" ]
    Assert.Equal<byte[]>(DeltaLogEntryCodec.encodeCbor keyEnc e1, DeltaLogEntryCodec.encodeCbor keyEnc e2)
    // And the mapping's captured-object keys are in ordinal order: 'Z'(90) < 'a'(97) < 'b'(98).
    match DeltaLogEntryDynamic.toDynamicValue keyEnc e1 with
    | DynamicValue.Object fields ->
        match List.tryFind (fun (k, _) -> k = "captured") fields with
        | Some(_, DynamicValue.Object kvs) ->
            Assert.Equal<string list>([ "Z"; "a"; "b" ], kvs |> List.map fst)
        | _ -> Assert.True(false, "captured field missing or not Object")
    | o -> Assert.True(false, sprintf "entry not Object: %A" o)

// ── The cross-language TREATY: F# is the reference oracle for the shared golden seed
//    (src/Core.TypeScript/delta-log-entry/golden-vectors.json). C#/Rust/TS oracles MUST reproduce
//    byte-identical CBOR. This locks F# encode→hex AND decode(hex)→round-trip against the seed. ──

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private toHex (b: byte[]) = b |> Array.map (sprintf "%02x") |> String.concat ""
let private ofHex (s: string) =
    [| for i in 0 .. 2 .. s.Length - 2 -> System.Convert.ToByte(s.Substring(i, 2), 16) |]

let private entryOfJson (e: JsonElement) : DeltaLogEntry<string> =
    let seq = (e.GetProperty "seq").GetInt64()
    let delta =
        [ for pair in (e.GetProperty "delta").EnumerateArray() ->
            let arr = pair.EnumerateArray() |> Seq.toArray
            arr.[0].GetString(), arr.[1].GetInt64() ]
        |> ZSet.ofSeq
    let captured =
        [ for p in (e.GetProperty "captured").EnumerateObject() -> p.Name, p.Value.GetString() ]
        |> Map.ofList
    DeltaLogEntry<string>(seq, delta, captured)

[<Fact>]
let ``Golden treaty: F# reproduces the shared seed's canonical CBOR + round-trips it`` () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "delta-log-entry", "golden-vectors.json")
    Assert.True(File.Exists path, sprintf "seed not found: %s" path)
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let vectors = doc.RootElement.GetProperty("vectors").EnumerateArray() |> Seq.toArray
    Assert.True(vectors.Length >= 5, "expected at least 5 golden vectors")
    for v in vectors do
        let name = (v.GetProperty "name").GetString()
        let expectedHex = (v.GetProperty "cbor").GetString()
        let e = entryOfJson (v.GetProperty "entry")
        // encode → must equal the seed hex (the byte-lock the other oracles conform to)
        Assert.Equal(expectedHex, toHex (DeltaLogEntryCodec.encodeCbor keyEnc e))
        // decode(seed hex) → must round-trip back to the structured entry
        let decoded = DeltaLogEntryCodec.decodeCbor keyDec (ofHex expectedHex)
        Assert.True(eq e decoded, sprintf "round-trip mismatch for vector '%s'" name)

// ── The IEntryCodec seam (CborEntryCodec) — the backend migration target. It must be byte-faithful to
//    the proven DeltaLogEntryCodec.encodeCbor (so backends storing via the seam store the treaty bytes)
//    and round-trip losslessly. This is the interface GitDeltaLog/DiskDeltaLog migrate onto. ──

[<Fact>]
let ``CborEntryCodec is byte-faithful to DeltaLogEntryCodec.encodeCbor + round-trips`` () =
    let codec = CborEntryCodec<string>(keyEnc, keyDec) :> IEntryCodec<string>
    for e in samples do
        // the seam produces exactly the proven canonical bytes
        Assert.Equal<byte[]>(DeltaLogEntryCodec.encodeCbor keyEnc e, codec.Encode e)
        // and decodes back losslessly
        let rt = codec.Decode(codec.Encode e)
        Assert.True(eq e rt, sprintf "CborEntryCodec round-trip mismatch for seq %d" e.Seq)
