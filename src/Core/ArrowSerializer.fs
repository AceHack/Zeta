namespace Zeta.Core

open System
open System.Buffers
open System.Buffers.Binary
open System.IO
open Apache.Arrow
open Apache.Arrow.Ipc
open Apache.Arrow.Types


/// **Tier 4 — Apache Arrow IPC serializer.** Columnar, zstd-
/// compressible, cross-language, SIMD-friendly. Use for:
///   - Large analytical batches (> 10 MB)
///   - Cross-language subscribers (C++, Rust, Go, TS via Arrow Flight)
///   - Long-lived checkpoints that must survive binary rebuilds
///
/// We ship an `int64`-keyed specialisation first — it's the majority
/// of DBSP workloads (time-series, IDs, sharded primaries) and it
/// lines up perfectly with Arrow's `Int64Array` columnar layout:
/// two `Int64Array` columns (keys, weights) packed with 8-byte
/// alignment; zero transform on the hot path. Extending to string /
/// struct keys is a matter of choosing the corresponding Arrow type.
///
/// ## When to reach for Arrow vs the other tiers
///
/// - **`SpanSerializer`** wins for same-endian same-host IPC of
///   blittable primitives — zero-copy, zero-metadata.
/// - **`TlvSerializer`** wins for non-blittable small deltas — tiny
///   metadata overhead (~8 bytes).
/// - **`FsPicklerSerializer`** wins when keys are exotic F# DUs,
///   records, quotations — no schema ceremony.
/// - **`ArrowInt64Serializer`** wins when payloads are large,
///   analytical, and cross-language — 500-1000 B of metadata
///   amortises over MB-scale batches and the columnar layout buys
///   3-5× zstd compression plus SIMD-friendly downstream
///   consumption.
///
/// References:
///   - Apache Arrow 22.0 columnar format spec
///   - Arrow Flight RPC for bi-directional streaming
[<Sealed>]
type ArrowInt64Serializer() =

    /// Schema: two int64 columns — `key` (sorted asc), `weight` (nonzero).
    static let schema =
        let fields = [| Field("key", Int64Type.Default, nullable = false)
                        Field("weight", Int64Type.Default, nullable = false) |]
        Schema(fields, null)

    interface ISerializer<int64> with
        member _.Name = "arrow-ipc-int64"

        member _.Write(writer: IBufferWriter<byte>, zset: ZSet<int64>) =
            let span = zset.AsSpan()
            let n = span.Length
            let keyBuilder = Int64Array.Builder()
            let weightBuilder = Int64Array.Builder()
            for i in 0 .. n - 1 do
                keyBuilder.Append(span.[i].Key : int64) |> ignore
                weightBuilder.Append(span.[i].Weight : int64) |> ignore
            let keyArray = keyBuilder.Build() :> IArrowArray
            let weightArray = weightBuilder.Build() :> IArrowArray
            let batch = new RecordBatch(schema, [| keyArray ; weightArray |], n)
            use ms = new MemoryStream()
            use arrowWriter = new ArrowStreamWriter(ms, schema)
            arrowWriter.WriteRecordBatch batch
            arrowWriter.WriteEnd()
            let payload = ms.ToArray()
            let lenHdr = writer.GetSpan 4
            BinaryPrimitives.WriteInt32LittleEndian(lenHdr, payload.Length)
            writer.Advance 4
            let dst = writer.GetSpan payload.Length
            payload.AsSpan().CopyTo dst
            writer.Advance payload.Length

        member _.Read(bytes: ReadOnlySpan<byte>) : ZSet<int64> =
            if bytes.Length < 4 then ZSet<int64>.Empty
            else
                let len = BinaryPrimitives.ReadInt32LittleEndian(bytes.Slice(0, 4))
                if len = 0 then ZSet<int64>.Empty
                else
                    let payload = bytes.Slice(4, len).ToArray()
                    use ms = new MemoryStream(payload)
                    use reader = new ArrowStreamReader(ms)
                    let batch = reader.ReadNextRecordBatch()
                    if isNull batch then ZSet<int64>.Empty
                    else
                        use _ = batch
                        let keyArr = batch.Column 0 :?> Int64Array
                        let weightArr = batch.Column 1 :?> Int64Array
                        let n = batch.Length
                        let entries = Array.zeroCreate<ZEntry<int64>> n
                        for i in 0 .. n - 1 do
                            let k = keyArr.GetValue(i)
                            let w = weightArr.GetValue(i)
                            if k.HasValue && w.HasValue then
                                entries.[i] <- ZEntry(k.Value, w.Value)
                        if n = 0 then ZSet<int64>.Empty else ZSet(Pool.Freeze entries)
