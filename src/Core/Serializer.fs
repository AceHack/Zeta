namespace Zeta.Core

open System
open System.Buffers
open System.Buffers.Binary
open System.IO
open System.Runtime.InteropServices


/// Tiered serialization DI seam. The recommendation: **don't pick one
/// protocol for everything.** Small deltas, moderate bulk, and large
/// analytical batches each have a different best answer.
///
/// ## Why a tiered seam
///
/// - **Small frequent deltas (< 1 KB)** — a per-message Arrow
///   schema+flatbuffer header is 500-1000 B of overhead on a 16-B
///   payload. We use **TLV** or **raw-span memcpy** here.
/// - **Blittable primitive `'K`** — `MemoryMarshal.Cast<ZEntry<'K>, byte>`
///   over the `ImmutableArray` backing storage gives us *zero-copy*,
///   *zero-transform* wire bytes. The Z-set layout is already the
///   wire layout.
/// - **Non-blittable `'T` (records, strings, nested)** — MessagePack
///   wins: 30-60 ns/entry, source-gen AOT-clean, universal.
/// - **Large analytical batches (> 10 MB), cross-language** — Arrow
///   IPC + zstd. Columnar layout, SIMD-friendly, Flight for bi-di.
///
/// Callers pick explicitly with `ISerializer<'T>`; auto-detection at
/// `Circuit.Build()` can suggest the right one based on `typeof<'T>`
/// (blittable → span; complex → MessagePack; flagged → Arrow).
type ISerializer<'T when 'T : comparison> =
    /// Serialize a Z-set to a byte buffer. Writer owns the output;
    /// implementations typically use `ArrayPool<byte>.Shared` + a
    /// returned `IMemoryOwner<byte>` for zero-alloc fast paths.
    abstract Write: writer: IBufferWriter<byte> * zset: ZSet<'T> -> unit
    /// Deserialize a Z-set from a byte span.
    abstract Read: bytes: ReadOnlySpan<byte> -> ZSet<'T>
    /// Human-readable name for logs / metrics.
    abstract Name: string


/// **Tier 1 — Raw-span serializer for blittable primitive `'K`.**
/// Zero-copy by definition: the Z-set's backing array IS the wire
/// payload. Requires `'K : unmanaged`. Only deterministic on same
/// endian; use on same-host IPC, not across architectures.
///
/// Wire format: `[4B count][count × sizeof(ZEntry<'K>) bytes]`.
[<Sealed>]
type SpanSerializer<'K when 'K : comparison and 'K : unmanaged and 'K : struct and 'K : (new : unit -> 'K) and 'K :> ValueType>() =
    interface ISerializer<'K> with
        member _.Name = "span"
        member _.Write(writer, zset) =
            let span = zset.AsSpan()
            let byteLen = span.Length * sizeof<ZEntry<'K>>
            let header = writer.GetSpan 4
            BinaryPrimitives.WriteInt32LittleEndian(header, span.Length)
            writer.Advance 4
            if span.Length > 0 then
                let bytes = MemoryMarshal.AsBytes<ZEntry<'K>> span
                let dst = writer.GetSpan byteLen
                bytes.CopyTo dst
                writer.Advance byteLen

        member _.Read(bytes) =
            if bytes.Length < 4 then ZSet<'K>.Empty
            else
                let count = BinaryPrimitives.ReadInt32LittleEndian(bytes.Slice(0, 4))
                if count = 0 then ZSet<'K>.Empty
                else
                    let payload = bytes.Slice(4, count * sizeof<ZEntry<'K>>)
                    let typed = MemoryMarshal.Cast<byte, ZEntry<'K>> payload
                    let arr = Array.zeroCreate<ZEntry<'K>> count
                    typed.CopyTo(Span arr)
                    ZSet(Pool.Freeze arr)


/// **Tier 2 — TLV serializer.** General, small fixed overhead per
/// message (~8 bytes), no schema registry, no reflection. Use for
/// non-blittable keys when MessagePack isn't pulled in.
///
/// Wire format: `[magic=0xD85C02E1][count: uint32][...entries]`
/// where each entry is `[keyLen: uint32][keyBytes][weight: int64]`.
/// Keys are UTF-8 if string, otherwise JSON — a deliberate
/// compromise for the non-blittable fallback.
[<Sealed>]
type TlvSerializer<'K when 'K : comparison>() =
    [<Literal>]
    let Magic = 0xD85C02E1u

    let writeKey (writer: IBufferWriter<byte>) (k: 'K) =
        let json = System.Text.Json.JsonSerializer.SerializeToUtf8Bytes k
        let lenHdr = writer.GetSpan 4
        BinaryPrimitives.WriteUInt32LittleEndian(lenHdr, uint32 json.Length)
        writer.Advance 4
        let dst = writer.GetSpan json.Length
        json.AsSpan().CopyTo dst
        writer.Advance json.Length

    interface ISerializer<'K> with
        member _.Name = "tlv"
        member this.Write(writer, zset) =
            let hdr = writer.GetSpan 8
            BinaryPrimitives.WriteUInt32LittleEndian(hdr, Magic)
            BinaryPrimitives.WriteUInt32LittleEndian(hdr.Slice 4, uint32 zset.Count)
            writer.Advance 8
            let span = zset.AsSpan()
            for i in 0 .. span.Length - 1 do
                writeKey writer span.[i].Key
                let wHdr = writer.GetSpan 8
                BinaryPrimitives.WriteInt64LittleEndian(wHdr, span.[i].Weight)
                writer.Advance 8

        member _.Read(bytes) =
            if bytes.Length < 8 then ZSet<'K>.Empty
            else
                let magic = BinaryPrimitives.ReadUInt32LittleEndian(bytes.Slice(0, 4))
                if magic <> Magic then
                    invalidOp $"TLV: wrong magic 0x{magic:X8}"
                let count = int (BinaryPrimitives.ReadUInt32LittleEndian(bytes.Slice(4, 4)))
                let entries = Array.zeroCreate<ZEntry<'K>> count
                let mutable pos = 8
                for i in 0 .. count - 1 do
                    let keyLen = int (BinaryPrimitives.ReadUInt32LittleEndian(bytes.Slice(pos, 4)))
                    pos <- pos + 4
                    let keyJson = bytes.Slice(pos, keyLen)
                    let key = System.Text.Json.JsonSerializer.Deserialize<'K>(keyJson)
                    pos <- pos + keyLen
                    let weight = BinaryPrimitives.ReadInt64LittleEndian(bytes.Slice(pos, 8))
                    pos <- pos + 8
                    entries.[i] <- ZEntry(key, weight)
                if count = 0 then ZSet<'K>.Empty else ZSet(Pool.Freeze entries)


/// **Tier 3 — FsPickler.** The canonical F# serializer; handles
/// every F# type natively (DUs, records, units of measure, `option`,
/// `Result`, quotations, inline functions captured as closures). The
/// richest F# support of any library and thus the safest default for
/// arbitrary user `'K`. Format is binary + schema-evolution-aware.
///
/// When to reach for this over TLV/Span:
///   - complex DUs with payload variants
///   - records nested inside records
///   - F# quotations you want to round-trip
///   - tuples / struct tuples (FsPickler honours layout)
///
/// Cost: requires the `FsPickler` NuGet package; slower than
/// MessagePack but more forgiving for gnarly F# shapes. Not the
/// hot-path serializer — keep SpanSerializer for that — but worth
/// having as a "this-will-just-work" default when the user has
/// exotic F# types.
[<Sealed>]
type FsPicklerSerializer<'K when 'K : comparison>() =
    // Lazy so projects that never use it don't pay the startup cost
    // of FsPickler's reflection tables.
    static let pickler =
        lazy (MBrace.FsPickler.FsPickler.CreateBinarySerializer())

    interface ISerializer<'K> with
        member _.Name = "fspickler"
        member _.Write(writer, zset) =
            // FsPickler wants a `Stream`; wrap our IBufferWriter in a
            // MemoryStream then copy. One extra copy, acceptable for
            // the "exotic types" case.
            use ms = new MemoryStream()
            pickler.Value.Serialize(ms, zset.AsSpan().ToArray())
            let payload = ms.ToArray()
            let lenHdr = writer.GetSpan 4
            BinaryPrimitives.WriteInt32LittleEndian(lenHdr, payload.Length)
            writer.Advance 4
            let dst = writer.GetSpan payload.Length
            payload.AsSpan().CopyTo dst
            writer.Advance payload.Length

        member _.Read(bytes) =
            if bytes.Length < 4 then ZSet<'K>.Empty
            else
                let len = BinaryPrimitives.ReadInt32LittleEndian(bytes.Slice(0, 4))
                if len = 0 then ZSet<'K>.Empty
                else
                    let payload = bytes.Slice(4, len).ToArray()
                    use ms = new MemoryStream(payload)
                    let entries = pickler.Value.Deserialize<ZEntry<'K> array>(ms)
                    if entries.Length = 0 then ZSet<'K>.Empty
                    else ZSet(Pool.Freeze entries)


[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module Serializer =

    /// Auto-pick the best serializer for a given `'T` at `Build()`
    /// time. Rule of thumb:
    ///   - blittable primitive → `SpanSerializer` (zero-copy)
    ///   - otherwise → `TlvSerializer` (general, small overhead)
    /// Callers can override with an explicit impl.
    let auto<'T when 'T : comparison> () : ISerializer<'T> =
        // F# doesn't let us conditionally dispatch on `'T : unmanaged`
        // at the call site without SRTP; default to TLV and let
        // specialisations override.
        TlvSerializer<'T>() :> _

    /// Convenience: serialize to a fresh `byte[]`.
    let toBytes<'T when 'T : comparison> (s: ISerializer<'T>) (zset: ZSet<'T>) : byte array =
        let bufWriter = ArrayBufferWriter<byte>()
        s.Write(bufWriter, zset)
        bufWriter.WrittenSpan.ToArray()

    /// Convenience: deserialize from bytes.
    let fromBytes<'T when 'T : comparison> (s: ISerializer<'T>) (bytes: byte array) : ZSet<'T> =
        s.Read(ReadOnlySpan<byte> bytes)
