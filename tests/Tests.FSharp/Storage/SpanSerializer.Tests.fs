module Zeta.Tests.Storage.SpanSerializerTests
#nowarn "0893"

open System
open System.Buffers
open System.Buffers.Binary
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// SpanSerializer<'K> — Tier 1 raw-span serializer for blittable
// primitive 'K. Zero-copy by definition: the Z-set's backing array
// IS the wire payload. Requires 'K : unmanaged; same-host endian
// only per the docstring.
//
// Wire format: [4B count little-endian][count × sizeof(ZEntry<'K>)
// bytes]. Round-trip must preserve the full Z-set including negative
// weights (retraction-native invariant on the wire).
// ═══════════════════════════════════════════════════════════════════


let private freshWriter () : ArrayBufferWriter<byte> =
    ArrayBufferWriter<byte> ()


/// Round-trip, with the WIRE INVARIANT checked between write and read.
///
/// The invariant is `written = 4 + header * sizeof<ZEntry<int64>>`, and it holds
/// by construction: `Write` takes the header count and the payload length from
/// the same span. It is asserted here anyway because on 2026-08-23 it did NOT
/// hold on windows-2025 (gate run 32646515868) and the only evidence the failure
/// left was a parameterless `ArgumentOutOfRangeException` at Serializer.fs:70 —
/// which names neither number. When it breaks again this names both, plus the
/// source count and the bytes. Mechanism still unknown: 081M0QPAJG3087G0R002BGJG8H.
let private roundTrip (zset: ZSet<int64>) : ZSet<int64> =
    let ser = SpanSerializer<int64>() :> ISerializer<int64>
    let writer = freshWriter ()
    let srcCount = zset.Count
    ser.Write(writer, zset)
    let written = writer.WrittenSpan
    let header =
        if written.Length >= 4 then BinaryPrimitives.ReadInt32LittleEndian(written.Slice(0, 4)) else -1
    let need = 4L + int64 header * int64 sizeof<ZEntry<int64>>
    if int64 written.Length <> need then
        failwithf
            "WIRE-INVARIANT-BROKEN srcCount=%d header=%d written=%d need=%d entrySize=%d thread=%d hex=%s"
            srcCount header written.Length need (sizeof<ZEntry<int64>>)
            Environment.CurrentManagedThreadId (Convert.ToHexString(written.ToArray()))
    ser.Read(written)


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
    // Tier 1's raw-span path is a memcpy of ZEntry<int64> records;
    // the invariant is that int64 negative weights on the wire come
    // back unchanged. A serializer that silently clamped here would
    // break every DBSP operator that emits -Δ.
    let original = ZSet.ofSeq [ 1L, 3L ; 2L, -1L ; 3L, -5L ]
    let result = roundTrip original
    result.[1L] |> should equal 3L
    result.[2L] |> should equal -1L
    result.[3L] |> should equal -5L


[<Fact>]
let ``larger Z-set round-trips with all weights preserved`` () =
    let original =
        [ for i in 0 .. 99 ->
            let k = int64 i
            let w = if i % 3 = 0 then int64 (-i) - 1L else int64 i + 1L
            k, w ]
        |> ZSet.ofSeq
    let result = roundTrip original
    for i in 0 .. 99 do
        let k = int64 i
        let expected = if i % 3 = 0 then int64 (-i) - 1L else int64 i + 1L
        result.[k] |> should equal expected


[<Fact>]
let ``length-header prefix is 4 little-endian bytes encoding count`` () =
    // Wire-format smoke: the first 4 bytes of the written buffer are
    // a little-endian int32 whose value equals the entry *count*
    // (distinct from Arrow's total-payload length; Tier 1's count
    // multiplied by sizeof<ZEntry<int64>> is the payload length).
    let ser = SpanSerializer<int64>() :> ISerializer<int64>
    let writer = freshWriter ()
    ser.Write(writer, ZSet.ofSeq [ 7L, 1L ; 8L, -2L ])
    let bytes = writer.WrittenMemory.ToArray ()
    bytes.Length |> should be (greaterThan 4)
    let count =
        BinaryPrimitives.ReadInt32LittleEndian(ReadOnlySpan(bytes, 0, 4))
    count |> should equal 2


[<Fact>]
let ``wire size equals 4 + count times sizeof ZEntry`` () =
    // Zero-copy claim (docstring line 43): the Z-set's backing array
    // IS the wire payload. The total written size therefore equals
    // the 4-byte header plus count × sizeof<ZEntry<int64>> exactly —
    // no framing overhead, no per-entry padding.
    let ser = SpanSerializer<int64>() :> ISerializer<int64>
    let writer = freshWriter ()
    let original = ZSet.ofSeq [ 10L, 1L ; 20L, -3L ; 30L, 7L ]
    ser.Write(writer, original)
    let totalBytes = writer.WrittenMemory.Length
    let expected = 4 + 3 * sizeof<ZEntry<int64>>
    totalBytes |> should equal expected


[<Fact>]
let ``serializer name is span`` () =
    let ser = SpanSerializer<int64>() :> ISerializer<int64>
    ser.Name |> should equal "span"


[<Fact>]
let ``empty input reads as empty Z-set`` () =
    // Defensive read: a length-0 byte span (below the 4-byte header
    // minimum) must decode to the empty Z-set, not crash. The
    // implementation returns ZSet<'K>.Empty for bytes.Length < 4.
    let ser = SpanSerializer<int64>() :> ISerializer<int64>
    let empty = ReadOnlySpan<byte>(Array.empty)
    let result = ser.Read(empty)
    ZSet.isEmpty result |> should be True


// ═══════════════════════════════════════════════════════════════════
// UNTRUSTED COUNT — the header is read off the buffer, so it is an
// untrusted int32 even when we wrote the buffer. Before these tests
// `Read` sliced on it directly: a truncated or corrupt buffer threw
// the PARAMETERLESS ArgumentOutOfRangeException, which names neither
// the claimed count nor the bytes available. That is exactly the
// evidence-free failure seen on windows-2025 (081M0QPAJG3087G0R002BGJG8H).
// Each of these fails against the pre-guard implementation.
// ═══════════════════════════════════════════════════════════════════


let private validWire (entries: (int64 * int64) list) : byte array =
    let ser = SpanSerializer<int64>() :> ISerializer<int64>
    let writer = freshWriter ()
    ser.Write(writer, ZSet.ofSeq entries)
    writer.WrittenMemory.ToArray ()


[<Fact>]
let ``a truncated payload is refused, naming both numbers`` () =
    let full = validWire [ 1L, 1L ; 2L, 2L ]
    // Same header (2 entries), one byte short of the payload it promises.
    let truncated = full.[.. full.Length - 2]
    let ser = SpanSerializer<int64>() :> ISerializer<int64>
    let ex = Assert.Throws<InvalidOperationException>(fun () -> ser.Read(ReadOnlySpan truncated) |> ignore)
    ex.Message |> should haveSubstring "2 entries"
    ex.Message |> should haveSubstring "follow the 4-byte header"


[<Fact>]
let ``a count that overflows the byte-length multiply is refused, not sliced`` () =
    // int32.MaxValue * 16 overflows to a NEGATIVE length in the unchecked
    // multiply the reader used to hand straight to `Slice`. The guard is
    // computed in int64 for exactly this input.
    let bogus = Array.zeroCreate<byte> 20
    BinaryPrimitives.WriteInt32LittleEndian(Span(bogus, 0, 4), Int32.MaxValue)
    let ser = SpanSerializer<int64>() :> ISerializer<int64>
    (fun () -> ser.Read(ReadOnlySpan bogus) |> ignore)
    |> should throw typeof<InvalidOperationException>


[<Fact>]
let ``a negative count is refused`` () =
    let bogus = Array.zeroCreate<byte> 20
    BinaryPrimitives.WriteInt32LittleEndian(Span(bogus, 0, 4), -1)
    let ser = SpanSerializer<int64>() :> ISerializer<int64>
    (fun () -> ser.Read(ReadOnlySpan bogus) |> ignore)
    |> should throw typeof<InvalidOperationException>


[<Fact>]
let ``trailing bytes past the payload stay legal (framing is the caller's)`` () =
    // The guard refuses TOO FEW bytes, never too many: a Z-set embedded in a
    // larger frame must still decode. Refusing the surplus would break every
    // caller that puts a length-prefixed Z-set inside its own envelope.
    let full = validWire [ 7L, 3L ]
    let padded = Array.append full (Array.zeroCreate<byte> 64)
    let ser = SpanSerializer<int64>() :> ISerializer<int64>
    let result = ser.Read(ReadOnlySpan padded)
    result.[7L] |> should equal 3L


[<Fact>]
let ``the round-trip holds under concurrent readers and writers`` () =
    // The windows-2025 failure has only ever been seen in the FULL suite, never
    // in isolation — so the first hypothesis was a shared buffer mutated by a
    // concurrent neighbour. This is the direct falsifier for that hypothesis on
    // whatever platform runs it: N threads through the identical path, with the
    // wire invariant checked on every single round-trip by `roundTrip` above.
    // It has never gone red (~250 M iterations locally); it is here so that the
    // claim "the serializer is concurrency-clean" is CHECKED rather than argued.
    let iterations = 20_000
    let errors = System.Collections.Concurrent.ConcurrentBag<string>()
    System.Threading.Tasks.Parallel.For(0, 4, fun _ ->
        try
            for _ in 1 .. iterations do
                let result = roundTrip (ZSet.ofSeq [ 42L, 1L ])
                if result.[42L] <> 1L then
                    errors.Add(sprintf "value disagreed: %d" result.[42L])
        with ex -> errors.Add(ex.Message))
    |> ignore
    errors |> Seq.truncate 3 |> String.concat " | " |> should equal ""
