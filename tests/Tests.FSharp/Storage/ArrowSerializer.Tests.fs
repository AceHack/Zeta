module Zeta.Tests.Storage.ArrowSerializerTests
#nowarn "0893"

open System.Buffers
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// ArrowInt64Serializer — Apache Arrow IPC tier-4 serializer. First
// tests land round 34; BACKLOG P0 harsh-critic #28 residual.
//
// The serializer's contract: Write a ZSet<int64> to an
// IBufferWriter<byte> prefixed by a 4-byte little-endian length
// header, then serialise the payload as an Arrow IPC stream of two
// Int64 columns (key, weight). Read reverses that. Round-trip must
// preserve the full Z-set including negative weights (retraction-
// native invariant).
// ═══════════════════════════════════════════════════════════════════


/// Use the BCL's ArrayBufferWriter<byte>, which tracks Written
/// regions and grows the backing array as needed.
let private freshWriter () : System.Buffers.ArrayBufferWriter<byte> =
    System.Buffers.ArrayBufferWriter<byte> ()


/// Round-trip helper — serialise a ZSet and deserialise. Returns
/// the deserialised value for assertion.
let private roundTrip (zset: ZSet<int64>) : ZSet<int64> =
    let ser = ArrowInt64Serializer() :> ISerializer<int64>
    let writer = freshWriter ()
    ser.Write(writer, zset)
    ser.Read(writer.WrittenSpan)


[<Fact>]
let ``empty Z-set round-trips to empty`` () =
    let result = roundTrip ZSet<int64>.Empty
    ZSet.isEmpty result |> should be True


[<Fact>]
let ``single-entry Z-set round-trips with positive weight`` () =
    let original = ZSet.ofSeq [ 42L, 1L ]
    let result = roundTrip original
    result.[42L] |> should equal 1L


[<Fact>]
let ``negative weights survive the round-trip (retraction-native)`` () =
    // The retraction-native claim requires the wire format to
    // preserve negative weights faithfully. A serializer that
    // silently clamps to non-negative would break every DBSP
    // operator that emits -Δ.
    let original = ZSet.ofSeq [ 1L, 3L ; 2L, -1L ; 3L, -5L ]
    let result = roundTrip original
    result.[1L] |> should equal 3L
    result.[2L] |> should equal -1L
    result.[3L] |> should equal -5L


[<Fact>]
let ``larger Z-set round-trips with all weights preserved`` () =
    // 100 entries mixing positive and negative weights, covering
    // enough rows that a bug would likely show (off-by-one on
    // column length, truncation, padding mismatch).
    let original =
        [ for i in 0 .. 99 ->
            let k = int64 i
            let w = if i % 3 = 0 then int64 (-i) - 1L else int64 i + 1L
            k, w ]
        |> ZSet.ofSeq
    let result = roundTrip original

    // Every key is present with the original weight.
    for i in 0 .. 99 do
        let k = int64 i
        let expected = if i % 3 = 0 then int64 (-i) - 1L else int64 i + 1L
        result.[k] |> should equal expected


[<Fact>]
let ``length-header prefix is 4 little-endian bytes`` () =
    // Wire-format smoke: the first 4 bytes of the written buffer
    // are a little-endian int32 whose value equals the rest of the
    // buffer's length. If a consumer reads the first 4 bytes as a
    // length header, they must get the correct payload span.
    let ser = ArrowInt64Serializer() :> ISerializer<int64>
    let writer = freshWriter ()
    ser.Write(writer, ZSet.ofSeq [ 7L, 1L ])
    let bytes = writer.WrittenMemory.ToArray ()
    bytes.Length |> should be (greaterThan 4)
    let len =
        System.Buffers.Binary.BinaryPrimitives.ReadInt32LittleEndian(
            System.ReadOnlySpan(bytes, 0, 4))
    len |> should equal (bytes.Length - 4)


[<Fact>]
let ``serializer name is arrow-ipc-int64`` () =
    let ser = ArrowInt64Serializer() :> ISerializer<int64>
    ser.Name |> should equal "arrow-ipc-int64"


// ── ArrowStringSerializer (Phase 3 — columnar batch, string keys) ──

let private roundTripString (zset: ZSet<string>) : ZSet<string> =
    let ser = ArrowStringSerializer() :> ISerializer<string>
    let writer = freshWriter ()
    ser.Write(writer, zset)
    ser.Read(writer.WrittenSpan)

[<Fact>]
let ``string Z-set: empty round-trips to empty`` () =
    roundTripString ZSet<string>.Empty |> ZSet.isEmpty |> should be True

[<Fact>]
let ``string Z-set: single entry round-trips`` () =
    let result = roundTripString (ZSet.ofSeq [ "alpha", 1L ])
    result.["alpha"] |> should equal 1L

[<Fact>]
let ``string Z-set: multiple entries incl negative weights round-trip (retraction-native)`` () =
    let original = ZSet.ofSeq [ "a", 3L; "b", -2L; "zeta", 7L; "", 1L; "uni-é-☃", -5L ]
    let result = roundTripString original
    for k, w in [ "a", 3L; "b", -2L; "zeta", 7L; "", 1L; "uni-é-☃", -5L ] do
        result.[k] |> should equal w

[<Fact>]
let ``string Z-set: serializer name is arrow-ipc-string`` () =
    (ArrowStringSerializer() :> ISerializer<string>).Name |> should equal "arrow-ipc-string"
