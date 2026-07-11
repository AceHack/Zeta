module Zeta.Tests.Storage.FsPicklerSerializerTests
#nowarn "0893"

open System
open System.Buffers
open System.Buffers.Binary
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// FsPicklerSerializer<'K> — Tier 3 exotic-F#-shape serializer.
//
// Wire format: [payload-length: int32 LE][payload: FsPickler-
// serialized ZEntry<'K>[]].
//
// The tier's selling point is not "round-trips Z-sets" — every
// tier does that. It's "round-trips arbitrary F# shapes": DUs
// with payload variants, records nested in records, options,
// Results, tuples with layout preserved. The test set below
// specifically exercises those shapes, because a test over
// `string` keys would pass against Tlv too and wouldn't prove
// Tier 3 is doing its job.
//
// The retraction-native wire invariant (negative int64 weights
// survive unchanged) is the same as every other tier.
// ═══════════════════════════════════════════════════════════════════


type Colour =
    | Red
    | Green
    | Blue
    | Custom of hex: string

[<Struct>]
type Point = { X: int; Y: int }

type Nested = { Point: Point; Label: string }


let private freshWriter () : ArrayBufferWriter<byte> =
    ArrayBufferWriter<byte> ()


let private roundTrip<'K when 'K : comparison> (zset: ZSet<'K>) : ZSet<'K> =
    let ser = FsPicklerSerializer<'K>() :> ISerializer<'K>
    let writer = freshWriter ()
    ser.Write(writer, zset)
    ser.Read(writer.WrittenSpan)


[<Fact>]
let ``empty Z-set round-trips to empty`` () =
    let result = roundTrip ZSet<string>.Empty
    ZSet.isEmpty result |> should be True


[<Fact>]
let ``string-keyed entry round-trips with positive weight`` () =
    let original = ZSet.ofSeq [ "alpha", 1L ]
    let result = roundTrip original
    result.["alpha"] |> should equal 1L


[<Fact>]
let ``negative weights survive the round-trip (retraction-native)`` () =
    // The wire invariant shared across every tier: negative int64
    // weights must round-trip unchanged, because every DBSP operator
    // that emits -Δ depends on it.
    let original = ZSet.ofSeq [ "a", 3L ; "b", -1L ; "c", -5L ]
    let result = roundTrip original
    result.["a"] |> should equal 3L
    result.["b"] |> should equal -1L
    result.["c"] |> should equal -5L


[<Fact>]
let ``discriminated-union keys round-trip with payload variants`` () =
    // DUs are Tier 3's flagship case. SpanSerializer requires
    // blittable, which a DU with a `string` payload isn't;
    // TlvSerializer handles them via `System.Text.Json` but the
    // serialisation is structural and fragile under schema
    // evolution. FsPickler's binary schema-evolution-aware
    // format is the safer default.
    let original =
        ZSet.ofSeq
            [ Red, 2L
              Green, -1L
              Blue, 3L
              Custom "ff0080", -4L ]
    let result = roundTrip original
    result.[Red] |> should equal 2L
    result.[Green] |> should equal -1L
    result.[Blue] |> should equal 3L
    result.[Custom "ff0080"] |> should equal -4L


[<Fact>]
let ``record keys round-trip with field layout preserved`` () =
    // Records are the second flagship case. The record's field
    // order is part of its identity; FsPickler honours it.
    let original =
        ZSet.ofSeq
            [ { X = 1; Y = 2 }, 1L
              { X = 3; Y = 4 }, -2L
              { X = 0; Y = 0 }, 5L ]
    let result = roundTrip original
    result.[{ X = 1; Y = 2 }] |> should equal 1L
    result.[{ X = 3; Y = 4 }] |> should equal -2L
    result.[{ X = 0; Y = 0 }] |> should equal 5L


[<Fact>]
let ``nested record keys round-trip`` () =
    // Records-inside-records is the case the docstring calls out
    // as a Tier 3 selling point. Verifies recursive type handling
    // works through one level of nesting without custom config.
    let original =
        ZSet.ofSeq
            [ { Point = { X = 1; Y = 2 }; Label = "a" }, 1L
              { Point = { X = 3; Y = 4 }; Label = "b" }, -3L ]
    let result = roundTrip original
    result.[{ Point = { X = 1; Y = 2 }; Label = "a" }] |> should equal 1L
    result.[{ Point = { X = 3; Y = 4 }; Label = "b" }] |> should equal -3L


[<Fact>]
let ``option keys round-trip with Some and None`` () =
    // F#-specific shape: `option<'T>` is a DU with two cases, one
    // of them a unit case. Tlv's JSON encoding handles `Some x`
    // but `None` round-trips as `null` which collides with any
    // nullable payload. The tier under test keeps the distinction.
    let original =
        ZSet.ofSeq
            [ Some 1, 2L
              Some 2, -1L
              None, 3L ]
    let result = roundTrip original
    result.[Some 1] |> should equal 2L
    result.[Some 2] |> should equal -1L
    result.[None] |> should equal 3L


[<Fact>]
let ``tuple keys round-trip with layout preserved`` () =
    // Tuple layout must be preserved because `(1, "a")` and `(1, "b")`
    // are distinct keys under structural comparison. Tier 3 honours
    // tuple layout; a naive JSON-array encoding would only
    // accidentally preserve it.
    let original =
        ZSet.ofSeq
            [ (1, "a"), 1L
              (2, "b"), -2L
              (1, "b"), 3L ]
    let result = roundTrip original
    result.[(1, "a")] |> should equal 1L
    result.[(2, "b")] |> should equal -2L
    result.[(1, "b")] |> should equal 3L


[<Fact>]
let ``larger DU-keyed Z-set round-trips with all weights preserved`` () =
    // Stress the tier with a mix of DU cases and weights, keeping
    // every key unique so the Z-set's consolidation step doesn't
    // sum duplicates (which would obscure a per-entry wire bug).
    // Red/Green/Blue each appear once; the payload-case Custom
    // carries the bulk via unique hex strings.
    let keyAt i =
        match i with
        | 0 -> Red
        | 1 -> Green
        | 2 -> Blue
        | _ -> Custom (sprintf "hex-%02d" i)
    let weightAt i =
        if i % 3 = 0 then int64 (-i) - 1L else int64 i + 1L
    let original =
        [ for i in 0 .. 29 -> keyAt i, weightAt i ] |> ZSet.ofSeq
    let result = roundTrip original
    for i in 0 .. 29 do
        result.[keyAt i] |> should equal (weightAt i)


[<Fact>]
let ``wire format prefix is a 4-byte little-endian length header`` () =
    // Wire-format smoke: the first 4 bytes encode the payload
    // length as int32 LE. Distinct from Tlv (which starts with a
    // 4-byte magic 0xD85C02E1 then a count) and Span (count-only
    // header, no magic). The length header lets the reader slice
    // the payload without scanning.
    let ser = FsPicklerSerializer<string>() :> ISerializer<string>
    let writer = freshWriter ()
    ser.Write(writer, ZSet.ofSeq [ "hello", 1L ; "world", -1L ])
    let bytes = writer.WrittenMemory.ToArray ()
    bytes.Length |> should be (greaterThanOrEqualTo 4)
    let declaredLen =
        BinaryPrimitives.ReadInt32LittleEndian(ReadOnlySpan(bytes, 0, 4))
    declaredLen |> should equal (bytes.Length - 4)


[<Fact>]
let ``serializer name is fspickler`` () =
    let ser = FsPicklerSerializer<string>() :> ISerializer<string>
    ser.Name |> should equal "fspickler"


[<Fact>]
let ``short input reads as empty Z-set`` () =
    // Defensive read: bytes shorter than the 4-byte length header
    // must decode to empty, not crash. Matches the defensive
    // short-read behaviour of Span (< 4 bytes) and Tlv (< 8
    // bytes). Keeps the tier's decode surface safe against
    // truncated storage.
    let ser = FsPicklerSerializer<string>() :> ISerializer<string>
    let empty = ReadOnlySpan<byte>(Array.empty)
    let result = ser.Read(empty)
    ZSet.isEmpty result |> should be True


[<Fact>]
let ``zero-length payload reads as empty Z-set`` () =
    // Header says "0 bytes of payload follow". The reader should
    // treat this as empty, not attempt to deserialise a zero-
    // length stream (which would throw). This case arises when
    // an empty Z-set is serialised — the length-header path is
    // exercised, not just the missing-header path.
    let ser = FsPicklerSerializer<string>() :> ISerializer<string>
    let header = Array.zeroCreate<byte> 4
    BinaryPrimitives.WriteInt32LittleEndian(Span(header, 0, 4), 0)
    let result = ser.Read(ReadOnlySpan header)
    ZSet.isEmpty result |> should be True


[<Fact>]
let ``truncated declared payload reads as empty Z-set`` () =
    // The length header is untrusted storage input. A declared payload
    // longer than the available bytes must not escape as an
    // ArgumentOutOfRangeException from ReadOnlySpan.Slice.
    let ser = FsPicklerSerializer<string>() :> ISerializer<string>
    let bytes = Array.zeroCreate<byte> 8
    BinaryPrimitives.WriteInt32LittleEndian(Span(bytes, 0, 4), 16)
    let result = ser.Read(ReadOnlySpan bytes)
    ZSet.isEmpty result |> should be True
