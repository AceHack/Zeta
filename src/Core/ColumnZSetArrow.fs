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
        // `MemoryMarshal.AsBytes` reinterprets in NATIVE byte order, while the
        // Arrow IPC format mandates little-endian buffers. On every platform
        // Zeta targets (arm64, x64) those coincide, which is exactly why this
        // would be a silent corruption rather than a failure on a big-endian
        // host: the bytes would be emitted byte-reversed and Arrow, being told
        // they are little-endian, would read wrong values back without error.
        // Fail closed instead of emitting a malformed batch.
        if not BitConverter.IsLittleEndian then
            raise (PlatformNotSupportedException
                "ColumnZSetArrow writes Arrow buffers by reinterpreting native-endian                  bytes and requires a little-endian host; the Arrow IPC format is                  little-endian by specification.")
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
    /// **Everything the Z-set invariant needs is checked here**, because this
    /// is the boundary where untrusted bytes become a `ColumnZSet` whose
    /// constructor documents that *the caller* owns the invariant. Skipping
    /// these would let crafted IPC produce an unsorted column, and `toZSet`
    /// would then hand the engine a `ZSet` whose binary search silently
    /// returns wrong answers — the exact silent-corruption class the checked
    /// arithmetic elsewhere in this file exists to avoid.
    static member OfRecordBatch(batch: RecordBatch) : ColumnZSet =
        if isNull (box batch) then ColumnZSet.Empty
        elif batch.ColumnCount <> 2 then
            invalidArg "batch"
                $"ColumnZSet expects exactly two int64 columns (key, weight); got {batch.ColumnCount}"
        else
            match batch.Column 0, batch.Column 1 with
            | (:? Int64Array as keyArr), (:? Int64Array as weightArr) ->
                // A null slot reads back as 0 from `.Values`, which would
                // become a zero-weight entry — illegal in a Z-set — with no
                // error anywhere. Refuse instead.
                if keyArr.NullCount <> 0 || weightArr.NullCount <> 0 then
                    invalidArg "batch"
                        "ColumnZSet requires non-nullable columns; a null slot would read back as 0"
                let n = batch.Length
                if n = 0 then ColumnZSet.Empty
                else
                    if keyArr.Length < n || weightArr.Length < n then
                        invalidArg "batch" "ColumnZSet column shorter than the batch length"
                    let keys = Pool.AllocateExact<int64> n
                    let weights = Pool.AllocateExact<int64> n
                    keyArr.Values.Slice(0, n).CopyTo(Span<int64> keys)
                    weightArr.Values.Slice(0, n).CopyTo(Span<int64> weights)
                    // Z-set invariants: strictly ascending keys, no zero weights.
                    for i in 0 .. n - 1 do
                        if weights.[i] = 0L then
                            invalidArg "batch" $"ColumnZSet weight at row {i} is zero; a Z-set drops zero weights"
                        if i > 0 && keys.[i] <= keys.[i - 1] then
                            invalidArg "batch"
                                $"ColumnZSet keys must be strictly ascending; row {i} ({keys.[i]}) <= row {i - 1} ({keys.[i - 1]})"
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
    ///
    /// **Malformed input raises; it does not quietly return the empty Z-set.**
    /// An empty input span means "nothing was written" and is the one benign
    /// case. Truncated, garbage or non-Arrow bytes are a decode failure, and
    /// returning `Empty` for them would make a corrupt checkpoint
    /// indistinguishable from a legitimately empty one — a silent failure that
    /// reads as success.
    static member ReadIpc(bytes: ReadOnlySpan<byte>) : ColumnZSet =
        if not BitConverter.IsLittleEndian then
            raise (PlatformNotSupportedException
                "ColumnZSetArrow requires a little-endian host; the Arrow IPC format is \
                 little-endian by specification.")
        if bytes.IsEmpty then ColumnZSet.Empty
        elif bytes.Length < 4 then
            raise (InvalidDataException
                $"ColumnZSet Arrow frame truncated: {bytes.Length} bytes, need at least the 4-byte length header")
        else
            let len = BinaryPrimitives.ReadInt32LittleEndian(bytes.Slice(0, 4))
            if len = 0 then ColumnZSet.Empty
            elif len < 0 then
                raise (InvalidDataException $"ColumnZSet Arrow frame declares a negative payload length ({len})")
            elif bytes.Length < 4 + len then
                raise (InvalidDataException
                    $"ColumnZSet Arrow frame truncated: declares {len} payload bytes, {bytes.Length - 4} present")
            else
                let payload = bytes.Slice(4, len).ToArray()
                use ms = new MemoryStream(payload)
                use reader = new ArrowStreamReader(ms)
                let batch = reader.ReadNextRecordBatch()
                if isNull (box batch) then
                    raise (InvalidDataException "ColumnZSet Arrow payload contained no record batch")
                else
                    use b = batch
                    ColumnZSetArrow.OfRecordBatch b
