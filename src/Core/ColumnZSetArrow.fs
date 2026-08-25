namespace Zeta.Core

open System
open System.Buffers.Binary
open System.IO
open System.Runtime.InteropServices
open Apache.Arrow
open Apache.Arrow.Ipc
open Apache.Arrow.Types


/// **`ColumnZSet` ⇄ Apache Arrow.** The columnar Z-set and an Arrow
/// `RecordBatch` of two `Int64Array` columns are the *same physical layout* —
/// two contiguous, 8-byte-aligned `int64` runs — so this bridge is a buffer
/// handoff, not a transform.
///
/// ## How this differs from `ArrowSerializer.fs`
///
/// `ArrowInt64Serializer` converts the **row** store, and so must walk the
/// AoS entries one at a time through `Int64Array.Builder().Append(...)`,
/// paying a per-element call and a growable staging buffer to *rebuild*
/// column-major order Arrow could have consumed directly. That is the AoS tax,
/// and it is the same tax `ZSet.weightedCount` pays. Here the columns already
/// exist, so writing is `MemoryMarshal.AsBytes` over each column into an
/// `ArrowBuffer`, and reading is a span copy out of `Int64Array.Values`.
/// Neither direction touches a builder.
///
/// This is the practical argument for the columnar sibling that has nothing to
/// do with SIMD: Arrow *is* a struct-of-arrays format, so a row store can
/// never hand it a buffer — it can only re-encode into one.
///
/// ## What the Arrow round-trip does and does not prove
///
/// **It is a round-trip check, not a cross-implementation one.** Both
/// directions here call the same `Apache.Arrow` 23.0.0 .NET library, so a
/// green round-trip shows this code uses that library self-consistently and
/// shows *nothing* about whether the bytes are readable by pyarrow, arrow-rs,
/// or arrow-cpp. Agreement between two calls into one library is agreement
/// between perfectly correlated implementations, which is not evidence. The
/// same caveat already applies to `golden-vectors-arrow.json`, whose F# and C#
/// sides are also both .NET.
///
/// Making it a genuine cross-implementation check needs a vector produced by
/// something that is not this library — pyarrow or arrow-rs writing the IPC
/// bytes, checked in hex-in-JSON per the no-binary-in-the-proof-lineage rule.
/// That is a real task with a real dependency (a Python or Rust toolchain in
/// CI) and it is **not** done here; this header is the honest statement of the
/// gap rather than a claim that it is closed.
///
/// Register: `unmetered`. Correct and round-trip tested; no benchmark compares
/// it against `ArrowInt64Serializer`, and no cross-language vector exists.
///
/// Anchors (Beacon): the Apache Arrow columnar format specification (in-memory
/// layout + IPC streaming format); Boncz, Zukowski & Nes, *MonetDB/X100*
/// (CIDR 2005) for why the batch is the unit.
[<AbstractClass; Sealed>]
type ColumnZSetArrow =

    /// Schema: `key` int64 (ascending), `weight` int64 (non-zero). Matches
    /// `ArrowInt64Serializer`'s schema field-for-field so the two produce
    /// interchangeable batches.
    static member val Schema =
        Schema(
            [| Field("key", Int64Type.Default, nullable = false)
               Field("weight", Int64Type.Default, nullable = false) |],
            null)

    /// Wrap an `int64` column as an Arrow `Int64Array` by reinterpreting the
    /// column's bytes — no per-element append. `nullCount = 0`, so the
    /// validity buffer is empty.
    static member private ColumnToArray(column: ReadOnlySpan<int64>) : IArrowArray =
        let bytes = MemoryMarshal.AsBytes(column).ToArray()
        let data =
            new ArrayData(
                Int64Type.Default,
                column.Length,
                0,
                0,
                [| ArrowBuffer.Empty; new ArrowBuffer(ReadOnlyMemory<byte> bytes) |])
        new Int64Array(data) :> IArrowArray

    /// `ColumnZSet` → Arrow `RecordBatch`, one row per Z-set entry.
    static member ToRecordBatch(c: ColumnZSet) : RecordBatch =
        let keys = ColumnZSetArrow.ColumnToArray(c.KeySpan())
        let weights = ColumnZSetArrow.ColumnToArray(c.WeightSpan())
        new RecordBatch(ColumnZSetArrow.Schema, [| keys; weights |], c.Count)

    /// Arrow `RecordBatch` → `ColumnZSet`. Copies straight out of each
    /// column's `Values` span; no builder, no per-element accessor.
    ///
    /// The batch must carry two non-null `Int64Array` columns in `key`,
    /// `weight` order; anything else is a schema the caller did not get from
    /// `ToRecordBatch`, and is refused rather than silently coerced.
    static member OfRecordBatch(batch: RecordBatch) : ColumnZSet =
        if isNull (box batch) then ColumnZSet.Empty
        elif batch.ColumnCount < 2 then
            invalidArg "batch" "ColumnZSet expects two int64 columns (key, weight)"
        else
            match batch.Column 0, batch.Column 1 with
            | (:? Int64Array as keyArr), (:? Int64Array as weightArr) ->
                let n = batch.Length
                if n = 0 then ColumnZSet.Empty
                else
                    let keys = Pool.AllocateExact<int64> n
                    let weights = Pool.AllocateExact<int64> n
                    keyArr.Values.Slice(0, n).CopyTo(Span<int64> keys)
                    weightArr.Values.Slice(0, n).CopyTo(Span<int64> weights)
                    ColumnZSet(Pool.Freeze keys, Pool.Freeze weights)
            | _ ->
                invalidArg "batch" "ColumnZSet expects two int64 columns (key, weight)"

    /// Serialise to Arrow IPC stream bytes, prefixed with a 4-byte
    /// little-endian payload length — the same framing `ArrowInt64Serializer`
    /// uses, so the two are wire-compatible.
    static member WriteIpc(c: ColumnZSet) : byte array =
        use batch = ColumnZSetArrow.ToRecordBatch c
        use ms = new MemoryStream()
        use writer = new ArrowStreamWriter(ms, ColumnZSetArrow.Schema)
        writer.WriteRecordBatch batch
        writer.WriteEnd()
        let payload = ms.ToArray()
        let framed = Array.zeroCreate<byte> (4 + payload.Length)
        BinaryPrimitives.WriteInt32LittleEndian(Span<byte>(framed, 0, 4), payload.Length)
        Array.blit payload 0 framed 4 payload.Length
        framed

    /// Inverse of `WriteIpc`.
    static member ReadIpc(bytes: ReadOnlySpan<byte>) : ColumnZSet =
        if bytes.Length < 4 then ColumnZSet.Empty
        else
            let len = BinaryPrimitives.ReadInt32LittleEndian(bytes.Slice(0, 4))
            if len <= 0 || bytes.Length < 4 + len then ColumnZSet.Empty
            else
                let payload = bytes.Slice(4, len).ToArray()
                use ms = new MemoryStream(payload)
                use reader = new ArrowStreamReader(ms)
                let batch = reader.ReadNextRecordBatch()
                if isNull (box batch) then ColumnZSet.Empty
                else
                    use b = batch
                    ColumnZSetArrow.OfRecordBatch b
