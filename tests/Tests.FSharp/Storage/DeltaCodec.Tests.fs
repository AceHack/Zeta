module Zeta.Tests.Storage.DeltaCodecTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// DeltaCodec — the pluggable serialization seam. Lossless round-trip for
// the Checkpoint baseline and the byte-verified canonical CBOR codec, via
// the ZSet↔DynamicValue mapping. (Disk log will land on this seam.)
// ═══════════════════════════════════════════════════════════════════

// int-key codec for DynamicValue-based codecs.
let private keyEnc (i: int) : DynamicValue = DynamicValue.Int(int64 i)
let private keyDec (dv: DynamicValue) : int =
    match dv with
    | DynamicValue.Int w -> int w
    | other -> failwithf "keyDec: expected Int, got %A" other

let private sample = ZSet.ofSeq [ 1, 1L; 2, 3L; 5, -2L; 9, 1L ]   // includes a retraction


[<Fact>]
let ``CheckpointDeltaCodec round-trips losslessly`` () =
    let codec = CheckpointDeltaCodec<int>() :> IDeltaCodec<int>
    codec.Decode(codec.Encode sample) |> should equal sample


[<Fact>]
let ``CborDeltaCodec round-trips losslessly`` () =
    let codec = CborDeltaCodec<int>(keyEnc, keyDec) :> IDeltaCodec<int>
    codec.Decode(codec.Encode sample) |> should equal sample


[<Fact>]
let ``ZSetDynamic mapping round-trips`` () =
    let dv = ZSetDynamic.toDynamicValue keyEnc sample
    ZSetDynamic.ofDynamicValue keyDec dv |> should equal sample


[<Fact>]
let ``CBOR encoding is deterministic (same delta -> same bytes)`` () =
    let codec = CborDeltaCodec<int>(keyEnc, keyDec) :> IDeltaCodec<int>
    codec.Encode sample |> should equal (codec.Encode sample)


[<Fact>]
let ``both codecs decode to the same ZSet (seam is interchangeable)`` () =
    let cp = CheckpointDeltaCodec<int>() :> IDeltaCodec<int>
    let cbor = CborDeltaCodec<int>(keyEnc, keyDec) :> IDeltaCodec<int>
    cp.Decode(cp.Encode sample) |> should equal (cbor.Decode(cbor.Encode sample))


[<Fact>]
let ``empty delta round-trips through both codecs`` () =
    let cp = CheckpointDeltaCodec<int>() :> IDeltaCodec<int>
    let cbor = CborDeltaCodec<int>(keyEnc, keyDec) :> IDeltaCodec<int>
    cp.Decode(cp.Encode ZSet<int>.Empty) |> should equal ZSet<int>.Empty
    cbor.Decode(cbor.Encode ZSet<int>.Empty) |> should equal ZSet<int>.Empty


[<Fact>]
let ``CBOR delta codec matches the byte-locked golden vectors (treaty)`` () =
    // Mirrors src/Core/golden-vectors-deltacodec.json — the 4-language byte-lock
    // treaty. The C#/Rust/TS ports must reproduce these exact hex bytes.
    let codec = CborDeltaCodec<int>(keyEnc, keyDec) :> IDeltaCodec<int>
    let hex (b: byte[]) = System.Convert.ToHexString(b).ToLowerInvariant()
    let vectors =
        [ "empty", ([]: (int * int64) list), "80"
          "single", [ 1, 1L ], "81820101"
          "multi", [ 1, 1L; 2, 3L ], "82820101820203"
          "retraction", [ 5, -2L; 7, 1L ], "82820521820701" ]
    for (_name, pairs, expected) in vectors do
        let z = ZSet.ofSeq pairs
        hex (codec.Encode z) |> should equal expected                          // byte-lock
        codec.Decode(System.Convert.FromHexString expected) |> should equal z  // round-trip from hex
