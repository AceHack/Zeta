module Zeta.Tests.DeltaLogEntryCodecTests

open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// `Log` noun — canonical entry codec (workitem 081KTGD5JMD). The F# REFERENCE oracle for the
// DeltaLogEntry byte-lock: a whole entry { Seq; Delta; Captured } maps to a DynamicValue.Object
// (captured/delta/seq, ordinal order) and rides DynamicValue's already-4-lang-locked canonical
// serializers — so the Log entry inherits the byte-lock with NO new canonical encoding (no new noun).
// These tests prove the F# side: lossless round-trip, deterministic byte-stability, and ORDINAL
// Captured-key ordering (culture-invariant; B-0969 — the property the old System.Text.Json framing
// did not guarantee). The cross-language hex treaty (C#/Rust/TS conform) is the follow-up seed slice.
// ═══════════════════════════════════════════════════════════════════

let private keyEnc (s: string) : DynamicValue = DynamicValue.String s
let private keyDec (dv: DynamicValue) : string =
    match dv with
    | DynamicValue.String s -> s
    | o -> failwithf "key not String: %A" o

let private entry seq pairs captured : DeltaLogEntry<string> =
    { Seq = seq; Delta = ZSet.ofSeq pairs; Captured = Map.ofList captured }

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
