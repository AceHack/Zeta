module Zeta.Tests.Storage.TlvSerializerTests
#nowarn "0893"

open System
open System.Buffers
open System.Buffers.Binary
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// TlvSerializer<'K> — Tier 2 general non-blittable serializer.
//
// Wire format: [magic=0xD85C02E1: uint32 LE][count: uint32 LE]
// [count entries of: [keyLen: uint32 LE][keyBytes: UTF-8 JSON]
//                     [weight: int64 LE]]
//
// Keys are serialized via System.Text.Json (UTF-8 JSON) so arbitrary
// F# shapes with `'K : comparison` round-trip without reflection-
// heavy machinery. The retraction-native invariant is the same as
// every other tier: negative int64 weights must survive unchanged,
// because every DBSP operator that emits -Δ depends on it. Unlike
// SpanSerializer this tier tolerates non-blittable `'K`, which is
// the reason `Serializer.auto<'T>()` defaults to TLV when no more
// specific dispatch applies.
// ═══════════════════════════════════════════════════════════════════


let private freshWriter () : ArrayBufferWriter<byte> =
    ArrayBufferWriter<byte> ()


let private roundTrip<'K when 'K : comparison> (zset: ZSet<'K>) : ZSet<'K> =
    let ser = TlvSerializer<'K>() :> ISerializer<'K>
    let writer = freshWriter ()
    ser.Write(writer, zset)
    ser.Read(writer.WrittenSpan)


[<Fact>]
let ``empty Z-set round-trips to empty`` () =
    let result = roundTrip ZSet<string>.Empty
    ZSet.isEmpty result |> should be True


[<Fact>]
let ``single string-keyed entry round-trips with positive weight`` () =
    let original = ZSet.ofSeq [ "alpha", 1L ]
    let result = roundTrip original
    result.["alpha"] |> should equal 1L


[<Fact>]
let ``negative weights survive the round-trip (retraction-native)`` () =
    // TLV's wire format stores the int64 weight as the last 8 bytes
    // of each entry frame. The invariant is identical to the other
    // tiers: a serializer that silently clamped to non-negative
    // would break every DBSP operator that emits -Δ.
    let original = ZSet.ofSeq [ "a", 3L ; "b", -1L ; "c", -5L ]
    let result = roundTrip original
    result.["a"] |> should equal 3L
    result.["b"] |> should equal -1L
    result.["c"] |> should equal -5L


[<Fact>]
let ``int64 keys round-trip via JSON key encoding`` () =
    // TLV JSON-encodes every key, including primitives that
    // SpanSerializer would fast-path as raw bytes. The tier's
    // selling point is uniformity — one wire format covers both
    // blittable and non-blittable keys at the cost of the JSON
    // framing overhead.
    let original = ZSet.ofSeq [ 1L, 1L ; 2L, -2L ; 3L, 0L ]
    let result = roundTrip original
    result.[1L] |> should equal 1L
    result.[2L] |> should equal -2L


[<Fact>]
let ``larger string-keyed Z-set round-trips with all weights preserved`` () =
    let original =
        [ for i in 0 .. 49 ->
            let k = sprintf "key-%02d" i
            let w = if i % 3 = 0 then int64 (-i) - 1L else int64 i + 1L
            k, w ]
        |> ZSet.ofSeq
    let result = roundTrip original
    for i in 0 .. 49 do
        let k = sprintf "key-%02d" i
        let expected = if i % 3 = 0 then int64 (-i) - 1L else int64 i + 1L
        result.[k] |> should equal expected


[<Fact>]
let ``magic header prefix is 0xD85C02E1 little-endian`` () =
    // Wire-format smoke: the first 4 bytes encode the TLV magic
    // constant. A deserializer that read the wrong magic would
    // silently accept foreign payloads; the magic is the tier's
    // only framing guard, so it has to be on the wire exactly.
    let ser = TlvSerializer<string>() :> ISerializer<string>
    let writer = freshWriter ()
    ser.Write(writer, ZSet.ofSeq [ "hello", 1L ])
    let bytes = writer.WrittenMemory.ToArray ()
    bytes.Length |> should be (greaterThanOrEqualTo 8)
    let magic =
        BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(bytes, 0, 4))
    magic |> should equal 0xD85C02E1u


[<Fact>]
let ``count field follows magic at bytes 4-7`` () =
    // After the 4-byte magic, bytes 4-7 carry the entry count as
    // a little-endian uint32. This is distinct from the Arrow
    // tier (total-payload length) and the Span tier (entry count
    // only, no magic).
    let ser = TlvSerializer<string>() :> ISerializer<string>
    let writer = freshWriter ()
    ser.Write(writer, ZSet.ofSeq [ "a", 1L ; "b", -1L ; "c", 2L ])
    let bytes = writer.WrittenMemory.ToArray ()
    let count =
        BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan(bytes, 4, 4))
    count |> should equal 3u


[<Fact>]
let ``wrong magic raises on read`` () =
    // The implementation calls `invalidOp` when the magic mismatches.
    // An unconditional accept would let a caller decode arbitrary
    // bytes as a Z-set and return garbage keys — the magic check
    // is the tier's only sanity frame, so it must throw.
    let ser = TlvSerializer<string>() :> ISerializer<string>
    let bogus = Array.zeroCreate<byte> 16
    BinaryPrimitives.WriteUInt32LittleEndian(
        Span(bogus, 0, 4), 0xDEADBEEFu)
    (fun () -> ser.Read(ReadOnlySpan bogus) |> ignore)
    |> should throw typeof<InvalidOperationException>


[<Fact>]
let ``serializer name is tlv`` () =
    let ser = TlvSerializer<string>() :> ISerializer<string>
    ser.Name |> should equal "tlv"


[<Fact>]
let ``empty input reads as empty Z-set`` () =
    // Defensive read: bytes shorter than the 8-byte header minimum
    // (magic + count) must decode to the empty Z-set, not crash.
    // Matches SpanSerializer's < 4-byte defensive behaviour in
    // spirit — short reads are empty, not invalid.
    let ser = TlvSerializer<string>() :> ISerializer<string>
    let empty = ReadOnlySpan<byte>(Array.empty)
    let result = ser.Read(empty)
    ZSet.isEmpty result |> should be True


[<Fact>]
let ``Serializer.auto defaults to TLV for non-blittable 'T`` () =
    // `Serializer.auto<'T>()` promises TLV as the general-purpose
    // fallback when more specific dispatch isn't wired in. Lock
    // that in: if the default silently switched to FsPickler or
    // Arrow, callers that explicitly opted into the TLV wire
    // format would break on the next `Build()` without warning.
    let ser = Serializer.auto<string> ()
    ser.Name |> should equal "tlv"


[<Fact>]
let ``an impossible entry count is refused BEFORE the array is allocated`` () =
    // The count is a wire-supplied uint32 and `Array.zeroCreate count` used to
    // run before any bound on it was known — so eight bytes of header could ask
    // for a 2^31-entry array. The bound is the minimum entry width (4 B keyLen +
    // 8 B weight = 12 B), which no honest encoder can undercut. Same class as
    // the SpanSerializer guard (081M0QPAJG3087G0R002BGJG8H); the magic check
    // above does not cover it, because a real TLV buffer carries a real magic.
    let bogus = Array.zeroCreate<byte> 16
    BinaryPrimitives.WriteUInt32LittleEndian(Span(bogus, 0, 4), 0xD85C02E1u)
    BinaryPrimitives.WriteUInt32LittleEndian(Span(bogus, 4, 4), 1_000_000u)
    let ser = TlvSerializer<string>() :> ISerializer<string>
    (fun () -> ser.Read(ReadOnlySpan bogus) |> ignore)
    |> should throw typeof<InvalidOperationException>


[<Fact>]
let ``a count that exactly fits the minimum entry width is still admitted`` () =
    // The guard must refuse only the impossible, never the merely small: a real
    // one-entry buffer is 8 B header + 4 B keyLen + 2 B `""` + 8 B weight = 22 B,
    // which is above the 12 B floor and must decode.
    let ser = TlvSerializer<string>() :> ISerializer<string>
    let writer = freshWriter ()
    ser.Write(writer, ZSet.ofSeq [ "", 5L ])
    let bytes = writer.WrittenMemory.ToArray ()
    let result = ser.Read(ReadOnlySpan bytes)
    result.[""] |> should equal 5L
