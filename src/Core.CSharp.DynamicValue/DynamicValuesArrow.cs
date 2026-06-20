// DynamicValues — Apache Arrow IPC codec (the C# oracle conforming BYTE-FOR-BYTE to the F# reference
// src/Core/DynamicValueArrow.fs). Arrow Phase 2, option c: F# and C# both use the .NET Apache.Arrow
// lib over the SAME node-table schema + DFS encode, so they emit byte-identical Arrow IPC streams.
//
// SHREDDED NODE-TABLE encoding: ONE Arrow RecordBatch, one row per tree node, in DFS pre-order
// (root = row 0). Recursion is carried in a `parent` column (adjacency-list shredding, à la
// Dremel/Parquet flattened to a node table) so arbitrary recursive/heterogeneous trees round-trip
// WITHOUT Arrow's (unsupported) self-referential schemas. Never-collapse-free: empty Array, empty
// Object, and Null are distinct `kind` tags, so no two distinct shapes share a row.
//
// Columns (all the same length = node count):
//   - kind  : Int8,    NOT null — 0=Null 1=Bool 2=Int 3=Float 4=String 5=Bytes 6=Array 7=Object
//   - parent: Int32,   NOT null — row index of the parent node; -1 for the root (row 0)
//   - key   : Utf8,    NULLABLE — for an Object ENTRY's value node, its key; null otherwise
//   - b     : Boolean, NULLABLE — set iff kind=Bool
//   - i     : Int64,   NULLABLE — set iff kind=Int
//   - f     : Float64, NULLABLE — set iff kind=Float (Arrow Double preserves the bit pattern, incl NaN/-0.0/±Inf)
//   - s     : Utf8,    NULLABLE — set iff kind=String
//   - by    : Binary,  NULLABLE — set iff kind=Bytes
//
// Reuses DecodeError.MalformedArrow (the Arrow analogue of MalformedXml). Never throws: any
// Apache.Arrow read failure is caught and surfaced as data per the Result-over-exception rule.

using System.Collections.Immutable;
using Apache.Arrow;
using Apache.Arrow.Ipc;
using Apache.Arrow.Types;

namespace Zeta.Core.CSharp;

/// <summary>Apache Arrow IPC codec for <see cref="DynamicValue"/> — encode + strict decode,
/// conforming byte-for-byte to the F# reference (<c>src/Core/DynamicValueArrow.fs</c>) via the shared
/// .NET <c>Apache.Arrow</c> lib (Arrow Phase 2, option c).</summary>
public static class DynamicValuesArrow
{
    // kind tags — keep in sync with the schema doc above and the F# reference.
    private const sbyte KindNull = 0;
    private const sbyte KindBool = 1;
    private const sbyte KindInt = 2;
    private const sbyte KindFloat = 3;
    private const sbyte KindString = 4;
    private const sbyte KindBytes = 5;
    private const sbyte KindArray = 6;
    private const sbyte KindObject = 7;

    // The fixed node-table schema (8 columns; kind/parent non-null, the rest nullable). Field
    // names/types/order/nullability MUST match the F# reference exactly for the byte-lock to hold.
    private static readonly Schema NodeSchema = new(
        new[]
        {
            new Field("kind", Int8Type.Default, nullable: false),
            new Field("parent", Int32Type.Default, nullable: false),
            new Field("key", StringType.Default, nullable: true),
            new Field("b", BooleanType.Default, nullable: true),
            new Field("i", Int64Type.Default, nullable: true),
            new Field("f", DoubleType.Default, nullable: true),
            new Field("s", StringType.Default, nullable: true),
            new Field("by", BinaryType.Default, nullable: true),
        },
        metadata: null);

    /// <summary>Serializes a <see cref="DynamicValue"/> to Arrow IPC stream bytes (one RecordBatch
    /// over the node table). DFS pre-order: the root is row 0 (parent -1, key null); an Array recurses
    /// its children in order (key null); an Object recurses each value child in order with its key
    /// set. Container nodes carry no scalar payload. <see cref="DynamicValue.Float"/> preserves the
    /// exact IEEE-754 bit pattern (NaN / -0.0 / ±Inf).</summary>
    /// <param name="value">the value to encode.</param>
    /// <returns>the Result containing the Arrow IPC stream bytes or an EncodeError.</returns>
    public static Result<byte[], EncodeError> ToArrow(DynamicValue value)
    {
        ArgumentNullException.ThrowIfNull(value);

        var enc = new NodeEncoder();
        var err = enc.Write(parent: -1, key: null, value, 0);
        if (err is EncodeError e)
        {
            return new Result<byte[], EncodeError>.Err(e);
        }
        RecordBatch batch = enc.BuildBatch();

        using var ms = new MemoryStream();
        using (var writer = new ArrowStreamWriter(ms, NodeSchema))
        {
            writer.WriteRecordBatch(batch);
            writer.WriteEnd();
        }

        return new Result<byte[], EncodeError>.Ok(ms.ToArray());
    }

    /// <summary>Exposes a way to cleanly unwrap the Arrow encode result for low-depth invariants in calling/test code.</summary>
    public static byte[] ToArrowOk(DynamicValue value)
    {
        var result = ToArrow(value);
        if (result is Result<byte[], EncodeError>.Ok ok)
        {
            return ok.Value;
        }
        else
        {
            var err = (Result<byte[], EncodeError>.Err)result;
            throw new InvalidOperationException($"ToArrow failed on low-depth invariant: {err.Error}");
        }
    }

    /// <summary>Deserializes Arrow IPC stream bytes back into a <see cref="DynamicValue"/> — the
    /// inverse of <see cref="ToArrow"/>. Reads the single RecordBatch, reconstructs each node from
    /// kind+payload, and attaches children to their parent in row order (preserving sibling order;
    /// Object children carry their <c>key</c>). Validates structure (parent in range / forms a tree
    /// rooted at row 0, kind valid, payload present for the kind) → <see cref="DecodeError.MalformedArrow"/>
    /// otherwise. Never throws: any <c>Apache.Arrow</c> read failure is caught and surfaced as data.</summary>
    /// <param name="bytes">the Arrow IPC stream bytes.</param>
    /// <returns><see cref="Result{T, TError}.Ok"/> with the decoded value, or
    /// <see cref="Result{T, TError}.Err"/> carrying <see cref="DecodeError.MalformedArrow"/>.</returns>
    public static Result<DynamicValue, DecodeError> FromArrow(byte[] bytes)
    {
        ArgumentNullException.ThrowIfNull(bytes);

        try
        {
            using var ms = new MemoryStream(bytes);
            using var reader = new ArrowStreamReader(ms);
            using RecordBatch? batch = reader.ReadNextRecordBatch();

            if (batch is null || !NodeColumns.TryRead(batch, out NodeColumns cols))
            {
                return Malformed();
            }

            if (BuildAdjacency(cols, batch.Length, out List<int>[] children) is DecodeError adjErr)
            {
                return new Result<DynamicValue, DecodeError>.Err(adjErr);
            }

            var decoder = new NodeDecoder(cols, children);
            return decoder.Build(0, 0);
        }
        catch (Exception)
        {
            // Never throw: any Apache.Arrow read failure (truncation, garbage, schema mismatch) is data.
            return Malformed();
        }
    }

    // Parent-adjacency: validate the parent column forms a tree rooted at row 0 (parent -1) with each
    // non-root parent a valid EARLIER row (DFS pre-order ⇒ parent < child), and bucket children per
    // parent in row order. Returns null on success (children set) or the DecodeError.
    private static DecodeError? BuildAdjacency(NodeColumns cols, int n, out List<int>[] children)
    {
        children = System.Array.Empty<List<int>>();
        if (n == 0)
        {
            // a node table always has >= 1 row (the root); zero rows is malformed.
            return DecodeError.MalformedArrow;
        }

        var buckets = new List<int>[n];
        for (int idx = 0; idx < n; idx++)
        {
            buckets[idx] = new List<int>();
        }

        for (int ri = 0; ri < n; ri++)
        {
            int? p = cols.Parent.GetValue(ri);
            if (ri == 0)
            {
                if (p is not -1)
                {
                    return DecodeError.MalformedArrow;
                }
            }
            else if (p is not int pv || pv < 0 || pv >= ri)
            {
                return DecodeError.MalformedArrow;
            }
            else
            {
                buckets[pv].Add(ri);
            }
        }

        children = buckets;
        return null;
    }

    private static Result<DynamicValue, DecodeError> Malformed() =>
        new Result<DynamicValue, DecodeError>.Err(DecodeError.MalformedArrow);

    // The eight column builders + the DFS encoder. Each row sets kind/parent/key plus exactly one
    // live scalar column (the rest null), so a built column has the same length as the node count.
    private sealed class NodeEncoder
    {
        private readonly Int8Array.Builder _kind = new();
        private readonly Int32Array.Builder _parent = new();
        private readonly StringArray.Builder _key = new();
        private readonly BooleanArray.Builder _b = new();
        private readonly Int64Array.Builder _i = new();
        private readonly DoubleArray.Builder _f = new();
        private readonly StringArray.Builder _s = new();
        private readonly BinaryArray.Builder _by = new();
        private int _count;

        public EncodeError? Write(int parent, string? key, DynamicValue v, int depth)
        {
            if (depth > DynamicValues.MaxNestingDepth)
            {
                return EncodeError.NestingTooDeep;
            }

            switch (v)
            {
                case DynamicValue.Null:
                    Emit(KindNull, parent, key);
                    FillNone();
                    break;
                case DynamicValue.Bool b:
                    Emit(KindBool, parent, key);
                    FillBool(b.Value);
                    break;
                case DynamicValue.Int i:
                    Emit(KindInt, parent, key);
                    FillInt(i.Value);
                    break;
                case DynamicValue.Float f:
                    Emit(KindFloat, parent, key);
                    FillFloat(f.Value);
                    break;
                case DynamicValue.String s:
                    Emit(KindString, parent, key);
                    FillString(s.Value);
                    break;
                case DynamicValue.Bytes by:
                    Emit(KindBytes, parent, key);
                    FillBytes(by.Value);
                    break;
                case DynamicValue.Array arr:
                    return WriteArray(parent, key, arr, depth);
                case DynamicValue.Object obj:
                    return WriteObject(parent, key, obj, depth);
                default:
                    throw new InvalidOperationException(
                        $"ToArrow reached a non-locked variant ({v.Type}); the hierarchy is closed");
            }

            return null;
        }

        public RecordBatch BuildBatch()
        {
            var columns = new IArrowArray[]
            {
                _kind.Build(), _parent.Build(), _key.Build(), _b.Build(),
                _i.Build(), _f.Build(), _s.Build(), _by.Build(),
            };
            return new RecordBatch(NodeSchema, columns, _count);
        }

        private EncodeError? WriteArray(int parent, string? key, DynamicValue.Array arr, int depth)
        {
            int me = Emit(KindArray, parent, key);
            FillNone();
            foreach (DynamicValue item in arr.Items)
            {
                var err = Write(me, null, item, depth + 1);
                if (err != null)
                {
                    return err;
                }
            }
            return null;
        }

        private EncodeError? WriteObject(int parent, string? key, DynamicValue.Object obj, int depth)
        {
            int me = Emit(KindObject, parent, key);
            FillNone();
            foreach (KeyValuePair<string, DynamicValue> pair in obj.Pairs)
            {
                var err = Write(me, pair.Key, pair.Value, depth + 1);
                if (err != null)
                {
                    return err;
                }
            }
            return null;
        }

        // Emit a row's header (kind/parent/key); returns its row index (the count BEFORE the append).
        private int Emit(sbyte kind, int parent, string? key)
        {
            _kind.Append(kind);
            _parent.Append(parent);
            if (key is null)
            {
                _key.AppendNull();
            }
            else
            {
                _key.Append(key);
            }

            return _count++;
        }

        // Fill the scalar columns: set the one live column for the row, null in the other four.
        private void FillBool(bool v)
        {
            _b.Append(v);
            _i.AppendNull();
            _f.AppendNull();
            _s.AppendNull();
            _by.AppendNull();
        }

        private void FillInt(long v)
        {
            _b.AppendNull();
            _i.Append(v);
            _f.AppendNull();
            _s.AppendNull();
            _by.AppendNull();
        }

        private void FillFloat(double v)
        {
            _b.AppendNull();
            _i.AppendNull();
            _f.Append(v);
            _s.AppendNull();
            _by.AppendNull();
        }

        private void FillString(string v)
        {
            _b.AppendNull();
            _i.AppendNull();
            _f.AppendNull();
            _s.Append(v ?? string.Empty);
            _by.AppendNull();
        }

        private void FillBytes(ImmutableArray<byte> v)
        {
            ImmutableArray<byte> payload = v.IsDefault ? ImmutableArray<byte>.Empty : v;
            _b.AppendNull();
            _i.AppendNull();
            _f.AppendNull();
            _s.AppendNull();
            _by.Append(payload.AsSpan());
        }

        private void FillNone()
        {
            _b.AppendNull();
            _i.AppendNull();
            _f.AppendNull();
            _s.AppendNull();
            _by.AppendNull();
        }
    }

    // The eight typed columns of the node table, read + type-checked from a RecordBatch.
    private readonly struct NodeColumns
    {
        private NodeColumns(
            Int8Array kind, Int32Array parent, StringArray key, BooleanArray b,
            Int64Array i, DoubleArray f, StringArray s, BinaryArray by)
        {
            Kind = kind;
            Parent = parent;
            Key = key;
            Bool = b;
            Int = i;
            Float = f;
            Str = s;
            Bytes = by;
        }

        public Int8Array Kind { get; }

        public Int32Array Parent { get; }

        public StringArray Key { get; }

        public BooleanArray Bool { get; }

        public Int64Array Int { get; }

        public DoubleArray Float { get; }

        public StringArray Str { get; }

        public BinaryArray Bytes { get; }

        public static bool TryRead(RecordBatch batch, out NodeColumns cols)
        {
            cols = default;
            if (batch.Column(0) is Int8Array kind
                && batch.Column(1) is Int32Array parent
                && batch.Column(2) is StringArray key
                && batch.Column(3) is BooleanArray b
                && batch.Column(4) is Int64Array i
                && batch.Column(5) is DoubleArray f
                && batch.Column(6) is StringArray s
                && batch.Column(7) is BinaryArray by)
            {
                cols = new NodeColumns(kind, parent, key, b, i, f, s, by);
                return true;
            }

            return false;
        }
    }

    // Reconstructs the DynamicValue tree from the columns + parent-adjacency. Recursion is bounded by
    // the node count and parent < child guarantees acyclicity.
    private sealed class NodeDecoder
    {
        private readonly NodeColumns _cols;
        private readonly List<int>[] _children;

        public NodeDecoder(NodeColumns cols, List<int>[] children)
        {
            _cols = cols;
            _children = children;
        }

        public Result<DynamicValue, DecodeError> Build(int row, int depth)
        {
            if (depth > DynamicValues.MaxNestingDepth)
            {
                return new Result<DynamicValue, DecodeError>.Err(DecodeError.NestingTooDeep);
            }

            if (_cols.Kind.GetValue(row) is not sbyte kind)
            {
                return Malformed();
            }

            return kind switch
            {
                KindNull => Ok(new DynamicValue.Null()),
                KindBool => _cols.Bool.GetValue(row) is bool bv ? Ok(new DynamicValue.Bool(bv)) : Malformed(),
                KindInt => _cols.Int.GetValue(row) is long iv ? Ok(new DynamicValue.Int(iv)) : Malformed(),
                KindFloat => _cols.Float.GetValue(row) is double fv ? Ok(new DynamicValue.Float(fv)) : Malformed(),
                KindString => BuildString(row),
                KindBytes => BuildBytes(row),
                KindArray => BuildArray(row, depth),
                KindObject => BuildObject(row, depth),
                _ => Malformed(),
            };
        }

        private Result<DynamicValue, DecodeError> BuildString(int row)
        {
            string sv = _cols.Str.GetString(row);
            return sv is null ? Malformed() : Ok(new DynamicValue.String(sv));
        }

        private Result<DynamicValue, DecodeError> BuildBytes(int row)
        {
            if (_cols.Bytes.IsNull(row))
            {
                return Malformed();
            }

            ReadOnlySpan<byte> span = _cols.Bytes.GetBytes(row);
            return Ok(new DynamicValue.Bytes(span.ToArray().ToImmutableArray()));
        }

        private Result<DynamicValue, DecodeError> BuildArray(int row, int depth)
        {
            List<int> kids = _children[row];
            var acc = ImmutableArray.CreateBuilder<DynamicValue>(kids.Count);
            foreach (int childRow in kids)
            {
                Result<DynamicValue, DecodeError> child = Build(childRow, depth + 1);
                if (child is not Result<DynamicValue, DecodeError>.Ok ok)
                {
                    return child;
                }

                acc.Add(ok.Value);
            }

            return Ok(new DynamicValue.Array(acc.ToImmutable()));
        }

        private Result<DynamicValue, DecodeError> BuildObject(int row, int depth)
        {
            List<int> kids = _children[row];
            var acc = ImmutableArray.CreateBuilder<KeyValuePair<string, DynamicValue>>(kids.Count);
            foreach (int childRow in kids)
            {
                string key = _cols.Key.GetString(childRow);
                if (key is null)
                {
                    // an Object entry value must carry its key.
                    return Malformed();
                }

                Result<DynamicValue, DecodeError> child = Build(childRow, depth + 1);
                if (child is not Result<DynamicValue, DecodeError>.Ok ok)
                {
                    return child;
                }

                acc.Add(new KeyValuePair<string, DynamicValue>(key, ok.Value));
            }

            return Ok(new DynamicValue.Object(acc.ToImmutable()));
        }
    }

    private static Result<DynamicValue, DecodeError> Ok(DynamicValue value) =>
        new Result<DynamicValue, DecodeError>.Ok(value);
}
