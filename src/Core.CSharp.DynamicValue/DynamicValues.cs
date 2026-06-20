// DynamicValues — the accessor / navigation companion for DynamicValue (the F# module +
// `RangeSets`/`ZSets` static-companion convention). These take a DynamicValue parameter (they test
// the parameter, not `this`), so the value tree stays a plain closed record hierarchy.

using System.Collections.Immutable;
using System.Globalization;
using System.Linq;
using System.Text;
using Zeta.Core.CSharp.Yaml;

namespace Zeta.Core.CSharp;

/// <summary>Accessors and property-path navigation for <see cref="DynamicValue"/> — the runtime
/// tag is on the value (<see cref="DynamicValue.Type"/>); the lazy-bind <c>Try*</c> accessors and
/// <see cref="Get(DynamicValue, string)"/> live here. Lazy bind is strict (no widening: a
/// <see cref="DynamicValue.Int"/> is not a <see cref="DynamicValue.Float"/>).</summary>
public static class DynamicValues
{
    /// <summary>True only for the null shape.</summary>
    /// <param name="value">the value.</param>
    public static bool IsNull(DynamicValue value) => value is DynamicValue.Null;

    /// <summary>Bind to a <see cref="bool"/>, or <c>null</c> on shape mismatch.</summary>
    /// <param name="value">the value.</param>
    public static bool? TryBool(DynamicValue value) => value is DynamicValue.Bool b ? b.Value : null;

    /// <summary>Bind to an <see cref="long"/>, or <c>null</c> on shape mismatch.</summary>
    /// <param name="value">the value.</param>
    public static long? TryInt(DynamicValue value) => value is DynamicValue.Int i ? i.Value : null;

    /// <summary>Bind to a <see cref="double"/>, or <c>null</c> on shape mismatch.</summary>
    /// <param name="value">the value.</param>
    public static double? TryFloat(DynamicValue value) => value is DynamicValue.Float f ? f.Value : null;

    /// <summary>Bind to a <see cref="string"/>, or <c>null</c> on shape mismatch.</summary>
    /// <param name="value">the value.</param>
    public static string? TryString(DynamicValue value) => value is DynamicValue.String s ? s.Value : null;

    /// <summary>Bind to the raw bytes, or <c>null</c> on shape mismatch.</summary>
    /// <param name="value">the value.</param>
    public static ImmutableArray<byte>? TryBytes(DynamicValue value) =>
        value is DynamicValue.Bytes b ? b.Value : null;

    /// <summary>Bind to the array items, or <c>null</c> on shape mismatch.</summary>
    /// <param name="value">the value.</param>
    public static ImmutableArray<DynamicValue>? TryArray(DynamicValue value) =>
        value is DynamicValue.Array a ? a.Items : null;

    /// <summary>Bind to the object pairs, or <c>null</c> on shape mismatch.</summary>
    /// <param name="value">the value.</param>
    public static ImmutableArray<KeyValuePair<string, DynamicValue>>? TryObject(DynamicValue value) =>
        value is DynamicValue.Object o ? o.Pairs : null;

    /// <summary>Look up a field by key in an object (first match wins; insertion order).
    /// <c>null</c> if not an object or the key is absent.</summary>
    /// <param name="value">the value.</param>
    /// <param name="key">the field name (ordinal comparison).</param>
    public static DynamicValue? TryField(DynamicValue value, string key) =>
        value is DynamicValue.Object o
            ? o.Pairs.Where(kv => string.Equals(kv.Key, key, StringComparison.Ordinal))
                .Select(kv => kv.Value)
                .FirstOrDefault()
            : null;

    /// <summary>Index into an array. <c>null</c> if not an array or the index is out of range
    /// (negative indices are out of range).</summary>
    /// <param name="value">the value.</param>
    /// <param name="index">the zero-based index.</param>
    public static DynamicValue? TryItem(DynamicValue value, int index) =>
        value is DynamicValue.Array a && index >= 0 && index < a.Items.Length ? a.Items[index] : null;

    /// <summary>Navigate a property path (<c>"a.b[3].c"</c>). Returns <c>null</c> on a null value
    /// or path, a malformed path, a missing key, an out-of-range index, or a type mismatch along
    /// the way. An empty path returns the value itself.</summary>
    /// <param name="value">the root value.</param>
    /// <param name="path">the dotted/indexed path.</param>
    public static DynamicValue? Get(DynamicValue value, string path)
    {
        if (value is null || path is null)
        {
            return null;
        }

        var steps = TryParsePath(path);
        if (steps is null)
        {
            return null;
        }

        DynamicValue? current = value;
        foreach (var step in steps)
        {
            if (current is null)
            {
                return null;
            }

            current = step.IsIndex ? TryItem(current, step.Index) : TryField(current, step.Key);
        }

        return current;
    }

    private readonly record struct Step(bool IsIndex, string Key, int Index);

    private static List<Step>? TryParsePath(string path)
    {
        var steps = new List<Step>();
        if (path.Length == 0)
        {
            return steps; // empty path = identity navigation
        }

        // Split on '.': any empty segment ("" — from a leading, doubled, or trailing dot) is
        // malformed and rejected, so typoed paths return null rather than silently resolving.
        // All(...) short-circuits on the first malformed segment (TryParseSegment appends to steps).
        return path.Split('.').All(segment => TryParseSegment(segment, steps)) ? steps : null;
    }

    // A segment is "key", "key[i][j]…", or "[i][j]…" (bare indices). Empty -> malformed.
    private static bool TryParseSegment(string segment, List<Step> steps)
    {
        if (segment.Length == 0)
        {
            return false;
        }

        int i = 0;
        int firstBracket = segment.IndexOf('[', StringComparison.Ordinal);
        if (firstBracket != 0)
        {
            string keyPart = firstBracket < 0 ? segment : segment[..firstBracket];
            if (keyPart.Contains(']', StringComparison.Ordinal))
            {
                return false; // stray ']' in the key part
            }

            steps.Add(new Step(false, keyPart, 0));
            i = firstBracket < 0 ? segment.Length : firstBracket;
        }

        while (i < segment.Length)
        {
            int next = TryReadIndex(segment, i, out int idx);
            if (next < 0)
            {
                return false;
            }

            steps.Add(new Step(true, string.Empty, idx));
            i = next;
        }

        return true;
    }

    // Reads "[<digits>]" in `segment` starting at `open` (which must point at the '['). Returns the
    // offset just past ']' and the parsed index, or -1 on a malformed bracket (open not at '[', no
    // digits, unterminated, or an index that overflows Int32 — TryParse, never an OverflowException
    // escaping Get).
    private static int TryReadIndex(string segment, int open, out int index)
    {
        index = 0;
        if (open >= segment.Length || segment[open] != '[')
        {
            return -1;
        }

        int start = open + 1;
        int j = start;
        while (j < segment.Length && char.IsDigit(segment[j]))
        {
            j++;
        }

        if (j == start || j >= segment.Length || segment[j] != ']')
        {
            return -1;
        }

        return int.TryParse(segment.AsSpan(start, j - start), NumberStyles.None, CultureInfo.InvariantCulture, out index)
            ? j + 1
            : -1;
    }

    /// <summary>Canonical JSON encoding — the byte-lock target (the shared seed is
    /// <c>src/Core.TypeScript/dynamic-value/golden-vectors.json</c>). Minified; <see
    /// cref="DynamicValue.Object"/> keys in INSERTION order — NOT sorted, because Object is
    /// order-significant, so a key-sorting canonical form (JCS / RFC 8785 / CBOR §4.2) would be
    /// lossy / non-bijective; <see cref="DynamicValue.Int"/> = bare exact decimal (invariant);
    /// strings per RFC 8259 minimal escaping. v1 locks null/bool/int/string/array/object;
    /// <see cref="DynamicValue.Float"/> and <see cref="DynamicValue.Bytes"/> are DEFERRED (no
    /// canonical JSON form yet) and surfaced as <see cref="Result{T, TError}.Err"/> data per the
    /// Result-over-exception hard rule (AGENTS.md), never thrown.</summary>
    /// <param name="value">the value to encode.</param>
    /// <returns><see cref="Result{T, TError}.Ok"/> with the canonical JSON, or
    /// <see cref="Result{T, TError}.Err"/> carrying the deferred-variant reason.</returns>
    /// <summary>
    /// Maximum value/input nesting depth the recursive canonical codecs (JSON, XML) walk before
    /// returning <see cref="EncodeError.NestingTooDeep"/> / <see cref="DecodeError.NestingTooDeep"/>.
    /// A fixed resource-safety bound, NOT part of the contract's value domain: it sits FAR above any
    /// realistic <see cref="DynamicValue"/>, so golden vectors and real data are unaffected while a
    /// depth-bomb is rejected as data before it can overflow the stack on a tight-stack runtime. The
    /// literal is intentionally not exposed in the public surface (it may be raised later — only ever
    /// moving the error later, never earlier). Mirrored across F#/C#/Rust/TS. <c>internal</c> so the
    /// sibling <see cref="DynamicValuesXml"/> codec shares the one bound (no drift).
    /// </summary>
    internal const int MaxNestingDepth = 256;

    public static Result<string, EncodeError> ToCanonicalJson(DynamicValue value)
    {
        ArgumentNullException.ThrowIfNull(value);

        if (FirstDeferred(value, 0) is EncodeError deferred)
        {
            return new Result<string, EncodeError>.Err(deferred);
        }

        var sb = new StringBuilder();
        WriteCanonical(sb, value);
        return new Result<string, EncodeError>.Ok(sb.ToString());
    }

    public static Result<string, EncodeError> ToYaml(DynamicValue value)
    {
        ArgumentNullException.ThrowIfNull(value);

        if (FirstYamlDeferred(value, 0) is EncodeError deferred)
        {
            return new Result<string, EncodeError>.Err(deferred);
        }

        YamlValue yv = ToYamlValue(value);
        string encoded = YamlEncoder.Encode(yv);
        return new Result<string, EncodeError>.Ok(encoded);
    }

    private static YamlValue ToYamlValue(DynamicValue value)
    {
        return value switch
        {
            DynamicValue.Null => YamlValue.YNull.Instance,
            DynamicValue.Bool b => new YamlValue.YBool(b.Value),
            DynamicValue.Int i => new YamlValue.YInt(i.Value),
            DynamicValue.Float f => new YamlValue.YFloat(f.Value),
            DynamicValue.String s => new YamlValue.YStr(s.Value),
            DynamicValue.Array a => new YamlValue.YSeq(a.Items.Select(ToYamlValue).ToList()),
            DynamicValue.Object o => new YamlValue.YMap(o.Pairs.Select(p => new KeyValuePair<string, YamlValue>(p.Key, ToYamlValue(p.Value))).ToList()),
            _ => throw new InvalidOperationException("Unreachable: Bytes checked by FirstYamlDeferred")
        };
    }

    public static Result<DynamicValue, DecodeError> FromYaml(string yaml)
    {
        if (yaml == null)
        {
            return new Result<DynamicValue, DecodeError>.Err(DecodeError.NonCanonical);
        }

        ParseResult parseResult = YamlDom.Parse(yaml);
        if (!parseResult.Ok)
        {
            return new Result<DynamicValue, DecodeError>.Err(DecodeError.NonCanonical);
        }

        var decodeResult = FromYamlValue(parseResult.Value!, 0);
        if (decodeResult is not Result<DynamicValue, DecodeError>.Ok okDec)
        {
            var errDec = (Result<DynamicValue, DecodeError>.Err)decodeResult;
            return new Result<DynamicValue, DecodeError>.Err(errDec.Error);
        }

        var reEncodeResult = ToYaml(okDec.Value);
        if (reEncodeResult is not Result<string, EncodeError>.Ok okEnc || !string.Equals(okEnc.Value, yaml, StringComparison.Ordinal))
        {
            return new Result<DynamicValue, DecodeError>.Err(DecodeError.NonCanonical);
        }

        return new Result<DynamicValue, DecodeError>.Ok(okDec.Value);
    }

    private static Result<DynamicValue, DecodeError> FromYamlValue(YamlValue yv, int depth)
    {
        if (depth > MaxNestingDepth)
        {
            return new Result<DynamicValue, DecodeError>.Err(DecodeError.NestingTooDeep);
        }

        switch (yv)
        {
            case YamlValue.YNull:
                return new Result<DynamicValue, DecodeError>.Ok(new DynamicValue.Null());
            case YamlValue.YBool b:
                return new Result<DynamicValue, DecodeError>.Ok(new DynamicValue.Bool(b.Value));
            case YamlValue.YInt i:
                return new Result<DynamicValue, DecodeError>.Ok(new DynamicValue.Int(i.Value));
            case YamlValue.YFloat f:
                return new Result<DynamicValue, DecodeError>.Ok(new DynamicValue.Float(f.Value));
            case YamlValue.YStr s:
                return new Result<DynamicValue, DecodeError>.Ok(new DynamicValue.String(s.Value));
            case YamlValue.YSeq seq:
                var items = ImmutableArray.CreateBuilder<DynamicValue>(seq.Items.Count);
                foreach (var item in seq.Items)
                {
                    var res = FromYamlValue(item, depth + 1);
                    if (res is not Result<DynamicValue, DecodeError>.Ok okRes)
                    {
                        return res;
                    }
                    items.Add(okRes.Value);
                }
                return new Result<DynamicValue, DecodeError>.Ok(new DynamicValue.Array(items.ToImmutable()));
            case YamlValue.YMap map:
                var pairs = ImmutableArray.CreateBuilder<KeyValuePair<string, DynamicValue>>(map.Entries.Count);
                foreach (var kv in map.Entries)
                {
                    var res = FromYamlValue(kv.Value, depth + 1);
                    if (res is not Result<DynamicValue, DecodeError>.Ok okRes)
                    {
                        return res;
                    }
                    pairs.Add(new KeyValuePair<string, DynamicValue>(kv.Key, okRes.Value));
                }
                return new Result<DynamicValue, DecodeError>.Ok(new DynamicValue.Object(pairs.ToImmutable()));
            default:
                return new Result<DynamicValue, DecodeError>.Err(DecodeError.Unsupported);
        }
    }

    // The first deferred variant (Float/Bytes) or NestingTooDeep anywhere in the tree, or null if
    // fully encodable. This recursive pre-pass is also the depth guard: ToCanonicalJson always runs
    // it before WriteCanonical, so a too-deep value is rejected here (and FirstDeferred's own
    // recursion is bounded), keeping WriteCanonical safe from stack overflow.
    private static EncodeError? FirstDeferred(DynamicValue value, int depth)
    {
        if (depth > MaxNestingDepth)
        {
            return EncodeError.NestingTooDeep;
        }

        switch (value)
        {
            case DynamicValue.Float:
                return EncodeError.FloatDeferred;
            case DynamicValue.Bytes:
                return EncodeError.BytesDeferred;
            case DynamicValue.Array a:
                // first deferred among the items (Select is lazy; FirstOrDefault short-circuits)
                return a.Items.Select(item => FirstDeferred(item, depth + 1)).FirstOrDefault(e => e is not null);
            case DynamicValue.Object o:
                return o.Pairs.Select(pair => FirstDeferred(pair.Value, depth + 1)).FirstOrDefault(e => e is not null);
            default:
                return null;
        }
    }

    private static EncodeError? FirstYamlDeferred(DynamicValue value, int depth)
    {
        if (depth > MaxNestingDepth)
        {
            return EncodeError.NestingTooDeep;
        }

        switch (value)
        {
            case DynamicValue.Bytes:
                return EncodeError.BytesDeferred;
            case DynamicValue.Array a:
                return a.Items.Select(item => FirstYamlDeferred(item, depth + 1)).FirstOrDefault(e => e is not null);
            case DynamicValue.Object o:
                return o.Pairs.Select(pair => FirstYamlDeferred(pair.Value, depth + 1)).FirstOrDefault(e => e is not null);
            default:
                return null;
        }
    }

    private static void WriteCanonical(StringBuilder sb, DynamicValue value)
    {
        switch (value)
        {
            case DynamicValue.Null:
                sb.Append("null");
                break;
            case DynamicValue.Bool b:
                sb.Append(b.Value ? "true" : "false");
                break;
            case DynamicValue.Int i:
                sb.Append(i.Value.ToString(CultureInfo.InvariantCulture));
                break;
            case DynamicValue.String s:
                AppendEscaped(sb, s.Value);
                break;
            case DynamicValue.Array a:
                sb.Append('[');
                for (int k = 0; k < a.Items.Length; k++)
                {
                    if (k > 0)
                    {
                        sb.Append(',');
                    }

                    WriteCanonical(sb, a.Items[k]);
                }

                sb.Append(']');
                break;
            case DynamicValue.Object o:
                sb.Append('{');
                for (int k = 0; k < o.Pairs.Length; k++)
                {
                    if (k > 0)
                    {
                        sb.Append(',');
                    }

                    AppendEscaped(sb, o.Pairs[k].Key);
                    sb.Append(':');
                    WriteCanonical(sb, o.Pairs[k].Value);
                }

                sb.Append('}');
                break;
            default:
                // Unreachable: null is guarded, Float/Bytes are caught by FirstDeferred.
                throw new InvalidOperationException(
                    $"WriteCanonical reached a non-locked variant ({value.Type}); should be pre-checked by FirstDeferred");
        }
    }

    // JSON string literal (incl. surrounding quotes), RFC 8259 minimal escaping: '"' and '\' and
    // control chars U+0000..U+001F (short forms where they exist, else \u00XX lowercase-hex); '/'
    // is NOT escaped; valid surrogate PAIRS emit the astral char raw, but LONE surrogates are
    // \u-escaped (a raw lone surrogate is invalid Unicode + non-bijective under UTF-8 byte-lock);
    // all other characters emitted raw.
    private static void AppendEscaped(StringBuilder sb, string? rawValue)
    {
        // Null-safe: normalize a malformed null String payload / object key (reachable via
        // nullable-disabled / interop callers) to empty, so the encoder never throws here.
        string s = rawValue ?? string.Empty;
        sb.Append('"');
        for (int i = 0; i < s.Length; i++)
        {
            char ch = s[i];
            switch (ch)
            {
                case '"':
                    sb.Append("\\\"");
                    break;
                case '\\':
                    sb.Append("\\\\");
                    break;
                case '\b':
                    sb.Append("\\b");
                    break;
                case '\f':
                    sb.Append("\\f");
                    break;
                case '\n':
                    sb.Append("\\n");
                    break;
                case '\r':
                    sb.Append("\\r");
                    break;
                case '\t':
                    sb.Append("\\t");
                    break;
                default:
                    if (ch < 0x20)
                    {
                        sb.Append("\\u");
                        sb.Append(((int)ch).ToString("x4", CultureInfo.InvariantCulture));
                    }
                    else if (char.IsHighSurrogate(ch) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1]))
                    {
                        // valid surrogate pair -> emit the astral char raw
                        sb.Append(ch);
                        sb.Append(s[i + 1]);
                        i++;
                    }
                    else if (char.IsSurrogate(ch))
                    {
                        // lone surrogate -> escape (raw would be invalid Unicode / non-bijective)
                        sb.Append("\\u");
                        sb.Append(((int)ch).ToString("x4", CultureInfo.InvariantCulture));
                    }
                    else
                    {
                        sb.Append(ch);
                    }

                    break;
            }
        }

        sb.Append('"');
    }

    /// <summary>Canonical CBOR encoding (RFC 8949) — the TOTAL byte-lock target for all eight shapes
    /// (the shared seed is <c>src/Core.TypeScript/dynamic-value/golden-vectors-cbor.json</c>). Where
    /// <summary>Canonical CBOR encoding (RFC 8949) — the TOTAL byte-lock target for all
    /// eight shapes (the shared seed is
    /// <c>src/Core.TypeScript/dynamic-value/golden-vectors-cbor.json</c>). Where
    /// <see cref="ToCanonicalJson"/> is a partial projection (6/8 shapes; Float/Bytes deferred), CBOR
    /// is total: <see cref="DynamicValue.Float"/> uses the RFC 8949 §4.2.2 shortest-float rule
    /// (float16 if it round-trips exactly, else float32, else float64; NaN canonicalizes to
    /// <c>0xf97e00</c>) and <see cref="DynamicValue.Bytes"/> uses a native major-type-2 byte string.
    /// <para>One deliberate deviation from RFC 8949 §4.2.1 deterministic encoding:
    /// <see cref="DynamicValue.Object"/> map keys stay in INSERTION order, NOT bytewise-sorted,
    /// because Object is order-significant — the §4.2.1 key-sort would be lossy / non-bijective (the
    /// same call v1 made for canonical JSON). Integers and string/array/map lengths use preferred
    /// (shortest) serialization per §4.2.1.</para></summary>
    /// <param name="value">the value to encode.</param>
    /// <returns>the Result containing the canonical CBOR bytes or an EncodeError.</returns>
    public static Result<byte[], EncodeError> ToCanonicalCbor(DynamicValue value)
    {
        ArgumentNullException.ThrowIfNull(value);
        var buf = new List<byte>();
        var err = WriteCbor(buf, value, 0);
        if (err is EncodeError e)
        {
            return new Result<byte[], EncodeError>.Err(e);
        }
        return new Result<byte[], EncodeError>.Ok(buf.ToArray());
    }

    /// <summary>Exposes a way to cleanly unwrap the CBOR encode result for low-depth invariants in calling code.</summary>
    public static byte[] ToCanonicalCborOk(DynamicValue value)
    {
        var result = ToCanonicalCbor(value);
        if (result is Result<byte[], EncodeError>.Ok ok)
        {
            return ok.Value;
        }
        else
        {
            var err = (Result<byte[], EncodeError>.Err)result;
            throw new InvalidOperationException($"ToCanonicalCbor failed on low-depth invariant: {err.Error}");
        }
    }

    private static EncodeError? WriteCbor(List<byte> buf, DynamicValue value, int depth)
    {
        if (depth > MaxNestingDepth)
        {
            return EncodeError.NestingTooDeep;
        }

        switch (value)
        {
            case DynamicValue.Null:
                buf.Add(0xf6);
                break;
            case DynamicValue.Bool b:
                buf.Add(b.Value ? (byte)0xf5 : (byte)0xf4);
                break;
            case DynamicValue.Int i:
                WriteCborInt(buf, i.Value);
                break;
            case DynamicValue.Float f:
                WriteCborFloat(buf, f.Value);
                break;
            case DynamicValue.String s:
                WriteCborText(buf, s.Value);
                break;
            case DynamicValue.Bytes by:
                WriteCborHead(buf, 2, (ulong)by.Value.Length);
                buf.AddRange(by.Value);
                break;
            case DynamicValue.Array a:
                WriteCborHead(buf, 4, (ulong)a.Items.Length);
                foreach (DynamicValue item in a.Items)
                {
                    var err = WriteCbor(buf, item, depth + 1);
                    if (err != null)
                    {
                        return err;
                    }
                }

                break;
            case DynamicValue.Object o:
                WriteCborHead(buf, 5, (ulong)o.Pairs.Length);
                foreach (KeyValuePair<string, DynamicValue> pair in o.Pairs)
                {
                    WriteCborText(buf, pair.Key);
                    var err = WriteCbor(buf, pair.Value, depth + 1);
                    if (err != null)
                    {
                        return err;
                    }
                }

                break;
            default:
                // Unreachable: the DynamicValue hierarchy is closed (sealed record cases).
                throw new InvalidOperationException(
                    $"WriteCbor reached an unknown variant ({value.Type}); the DynamicValue hierarchy is closed");
        }

        return null;
    }

    // CBOR initial byte (major type in top 3 bits) + preferred/shortest argument (RFC 8949 §3, §4.2.1).
    private static void WriteCborHead(List<byte> buf, int major, ulong arg)
    {
        byte mt = (byte)(major << 5);
        if (arg <= 23UL)
        {
            buf.Add((byte)(mt | (byte)arg));
        }
        else if (arg <= 0xffUL)
        {
            buf.Add((byte)(mt | 24));
            buf.Add((byte)arg);
        }
        else if (arg <= 0xffffUL)
        {
            buf.Add((byte)(mt | 25));
            buf.Add((byte)(arg >> 8));
            buf.Add((byte)arg);
        }
        else if (arg <= 0xffffffffUL)
        {
            buf.Add((byte)(mt | 26));
            buf.Add((byte)(arg >> 24));
            buf.Add((byte)(arg >> 16));
            buf.Add((byte)(arg >> 8));
            buf.Add((byte)arg);
        }
        else
        {
            buf.Add((byte)(mt | 27));
            for (int shift = 56; shift >= 0; shift -= 8)
            {
                buf.Add((byte)(arg >> shift));
            }
        }
    }

    // Major 0 for v >= 0; major 1 for v < 0 (which encodes -1 - v). `~v` yields -1 - v without the
    // long.MinValue overflow that `-1 - v` / `-v` would hit.
    private static void WriteCborInt(List<byte> buf, long value)
    {
        if (value >= 0)
        {
            WriteCborHead(buf, 0, (ulong)value);
        }
        else
        {
            WriteCborHead(buf, 1, (ulong)(~value));
        }
    }

    // Major 3 text string: raw UTF-8, no escaping (unlike JSON). A String holding a lone surrogate
    // is not a valid Unicode scalar sequence; .NET UTF-8 encodes it as U+FFFD (encoder-defined) — the
    // seed's string vectors are all valid UTF-8.
    private static void WriteCborText(List<byte> buf, string? value)
    {
        byte[] utf8 = Encoding.UTF8.GetBytes(value ?? string.Empty);
        WriteCborHead(buf, 3, (ulong)utf8.Length);
        buf.AddRange(utf8);
    }

    // RFC 8949 §4.2.2 shortest float: NaN -> 0xf97e00; otherwise the shortest of float16 / float32 /
    // float64 that decodes back to the exact same value (±0 and ±Inf round-trip through float16). The
    // `(double)narrowed == value` test also rejects a width that overflowed to Inf (e.g. 1e300 as
    // float32), correctly falling through to the wider form.
    private static void WriteCborFloat(List<byte> buf, double value)
    {
        if (double.IsNaN(value))
        {
            buf.Add(0xf9);
            buf.Add(0x7e);
            buf.Add(0x00);
            return;
        }

        float f32 = (float)value;
        if ((double)f32 == value)
        {
            var f16 = (Half)f32;
            if ((float)f16 == f32)
            {
                ushort bits16 = BitConverter.HalfToUInt16Bits(f16);
                buf.Add(0xf9);
                buf.Add((byte)(bits16 >> 8));
                buf.Add((byte)bits16);
                return;
            }

            uint bits32 = BitConverter.SingleToUInt32Bits(f32);
            buf.Add(0xfa);
            buf.Add((byte)(bits32 >> 24));
            buf.Add((byte)(bits32 >> 16));
            buf.Add((byte)(bits32 >> 8));
            buf.Add((byte)bits32);
            return;
        }

        ulong bits64 = BitConverter.DoubleToUInt64Bits(value);
        buf.Add(0xfb);
        for (int shift = 56; shift >= 0; shift -= 8)
        {
            buf.Add((byte)(bits64 >> shift));
        }
    }

    /// <summary>Decode canonical CBOR (RFC 8949) bytes back into a <see cref="DynamicValue"/> — the
    /// inverse of <see cref="ToCanonicalCbor"/>, completing the byte↔value bijection for all eight
    /// shapes. Decode is partial (truncation, reserved/indefinite forms, CBOR tags, oversized
    /// integers, non-text map keys), so it returns <see cref="Result{T, TError}"/> per the
    /// Result-over-exception hard rule (AGENTS.md) — never throws for malformed input.
    /// <para>Round-trip is the byte-lock: <c>ToCanonicalCbor(FromCanonicalCbor(b)) == b</c> for every
    /// canonical <c>b</c> in the shared seed. float16 payloads decode via <see cref="Half"/>.</para>
    /// </summary>
    /// <param name="bytes">canonical CBOR bytes.</param>
    /// <returns><see cref="Result{T, TError}.Ok"/> with the decoded value, or
    /// <see cref="Result{T, TError}.Err"/> carrying the <see cref="DecodeError"/>.</returns>
    public static Result<DynamicValue, DecodeError> FromCanonicalCbor(byte[] bytes)
    {
        ArgumentNullException.ThrowIfNull(bytes);
        int pos = 0;
        DecodeError? err = TryReadCbor(bytes, ref pos, 0, out DynamicValue value);
        if (err is DecodeError e)
        {
            return new Result<DynamicValue, DecodeError>.Err(e);
        }

        if (pos != bytes.Length)
        {
            return new Result<DynamicValue, DecodeError>.Err(DecodeError.TrailingData);
        }

        // Canonical-form fixed-point check: the canonical bytes are exactly those `b` with
        // ToCanonicalCbor(decode(b)) == b. This rejects well-formed-but-non-canonical input —
        // non-shortest int/length widths (18 00 vs 00), non-shortest floats / non-canonical NaN,
        // and invalid UTF-8 silently repaired to U+FFFD (which re-encodes to different bytes) — in
        // one uniform check, instead of scattering per-form strictness through the reader.
        if (ToCanonicalCbor(value) is not Result<byte[], EncodeError>.Ok ok || !ok.Value.AsSpan().SequenceEqual(bytes))
        {
            return new Result<DynamicValue, DecodeError>.Err(DecodeError.NonCanonical);
        }

        return new Result<DynamicValue, DecodeError>.Ok(value);
    }

    // Reads one CBOR item starting at `pos`, advancing it. Returns null on success (value set), or
    // the DecodeError on failure.
    private static DecodeError? TryReadCbor(byte[] b, ref int pos, int depth, out DynamicValue value)
    {
        value = new DynamicValue.Null();
        if (depth > MaxNestingDepth)
        {
            return DecodeError.NestingTooDeep;
        }
        if (pos >= b.Length)
        {
            return DecodeError.UnexpectedEnd;
        }

        byte initial = b[pos++];
        int major = initial >> 5;
        int ai = initial & 0x1f;

        // Major 7: simple values (false/true/null) + IEEE floats.
        if (major == 7)
        {
            return TryReadSimpleOrFloat(b, ref pos, ai, out value);
        }

        DecodeError? argErr = TryReadCborArg(b, ref pos, ai, out ulong arg);
        if (argErr is DecodeError ae)
        {
            return ae;
        }

        switch (major)
        {
            case 0: // unsigned integer
                if (arg > long.MaxValue)
                {
                    return DecodeError.IntegerOverflow;
                }

                value = new DynamicValue.Int((long)arg);
                return null;
            case 1: // negative integer = -1 - arg
                if (arg > long.MaxValue)
                {
                    return DecodeError.IntegerOverflow;
                }

                value = new DynamicValue.Int(-1L - (long)arg);
                return null;
            case 2:
                return TryReadByteString(b, ref pos, arg, out value);
            case 3:
                return TryReadTextString(b, ref pos, arg, out value);
            case 4:
                return TryReadArray(b, ref pos, depth, arg, out value);
            case 5:
                return TryReadMap(b, ref pos, depth, arg, out value);
            default:
                return DecodeError.Unsupported; // major 6 = tags, not used by our canonical form
        }
    }

    // Major 7: simple values (false/true/null) + IEEE floats (float16/32/64). NaN/Inf/±0 ride the
    // float payloads; float16 decodes via System.Half.
    private static DecodeError? TryReadSimpleOrFloat(byte[] b, ref int pos, int ai, out DynamicValue value)
    {
        value = new DynamicValue.Null();
        switch (ai)
        {
            case 20:
                value = new DynamicValue.Bool(false);
                return null;
            case 21:
                value = new DynamicValue.Bool(true);
                return null;
            case 22:
                return null; // value already Null
            case 25:
                {
                    if (pos + 2 > b.Length)
                    {
                        return DecodeError.UnexpectedEnd;
                    }

                    ushort bits16 = (ushort)((b[pos] << 8) | b[pos + 1]);
                    pos += 2;
                    value = new DynamicValue.Float((double)BitConverter.UInt16BitsToHalf(bits16));
                    return null;
                }
            case 26:
                {
                    if (pos + 4 > b.Length)
                    {
                        return DecodeError.UnexpectedEnd;
                    }

                    uint bits32 = ((uint)b[pos] << 24) | ((uint)b[pos + 1] << 16) | ((uint)b[pos + 2] << 8) | b[pos + 3];
                    pos += 4;
                    value = new DynamicValue.Float(BitConverter.UInt32BitsToSingle(bits32));
                    return null;
                }
            case 27:
                {
                    if (pos + 8 > b.Length)
                    {
                        return DecodeError.UnexpectedEnd;
                    }

                    ulong bits64 = 0;
                    for (int i = 0; i < 8; i++)
                    {
                        bits64 = (bits64 << 8) | b[pos + i];
                    }

                    pos += 8;
                    value = new DynamicValue.Float(BitConverter.UInt64BitsToDouble(bits64));
                    return null;
                }
            default:
                return DecodeError.Unsupported; // undefined / 1-byte simple value / reserved
        }
    }

    private static DecodeError? TryReadByteString(byte[] b, ref int pos, ulong arg, out DynamicValue value)
    {
        value = new DynamicValue.Null();
        if (arg > (ulong)(b.Length - pos))
        {
            return DecodeError.UnexpectedEnd;
        }

        int n = (int)arg;
        var slice = new byte[n];
        Array.Copy(b, pos, slice, 0, n);
        pos += n;
        value = new DynamicValue.Bytes(slice.ToImmutableArray());
        return null;
    }

    private static DecodeError? TryReadTextString(byte[] b, ref int pos, ulong arg, out DynamicValue value)
    {
        value = new DynamicValue.Null();
        if (arg > (ulong)(b.Length - pos))
        {
            return DecodeError.UnexpectedEnd;
        }

        int n = (int)arg;
        value = new DynamicValue.String(Encoding.UTF8.GetString(b, pos, n));
        pos += n;
        return null;
    }

    private static DecodeError? TryReadArray(byte[] b, ref int pos, int depth, ulong arg, out DynamicValue value)
    {
        value = new DynamicValue.Null();
        // each item is ≥ 1 byte, so a count beyond the remaining bytes is truncated
        if (arg > (ulong)(b.Length - pos))
        {
            return DecodeError.UnexpectedEnd;
        }

        var items = ImmutableArray.CreateBuilder<DynamicValue>((int)arg);
        for (ulong i = 0; i < arg; i++)
        {
            DecodeError? itemErr = TryReadCbor(b, ref pos, depth + 1, out DynamicValue item);
            if (itemErr is DecodeError ie)
            {
                return ie;
            }

            items.Add(item);
        }

        value = new DynamicValue.Array(items.ToImmutable());
        return null;
    }

    private static DecodeError? TryReadMap(byte[] b, ref int pos, int depth, ulong arg, out DynamicValue value)
    {
        value = new DynamicValue.Null();
        if (arg > (ulong)(b.Length - pos))
        {
            return DecodeError.UnexpectedEnd;
        }

        var pairs = ImmutableArray.CreateBuilder<KeyValuePair<string, DynamicValue>>((int)arg);
        for (ulong i = 0; i < arg; i++)
        {
            DecodeError? keyErr = TryReadCbor(b, ref pos, depth + 1, out DynamicValue key);
            if (keyErr is DecodeError ke)
            {
                return ke;
            }

            if (key is not DynamicValue.String ks)
            {
                return DecodeError.NonTextKey;
            }

            DecodeError? valErr = TryReadCbor(b, ref pos, depth + 1, out DynamicValue val);
            if (valErr is DecodeError ve)
            {
                return ve;
            }

            pairs.Add(new KeyValuePair<string, DynamicValue>(ks.Value, val));
        }

        value = new DynamicValue.Object(pairs.ToImmutable());
        return null;
    }

    // Reads a CBOR argument (the value after the initial byte) for additional-info `ai`: inline for
    // 0–23, else 1/2/4/8 big-endian bytes for 24/25/26/27. 28–31 are reserved/indefinite (Unsupported).
    private static DecodeError? TryReadCborArg(byte[] b, ref int pos, int ai, out ulong arg)
    {
        arg = 0;
        if (ai < 24)
        {
            arg = (ulong)ai;
            return null;
        }

        int n = ai switch
        {
            24 => 1,
            25 => 2,
            26 => 4,
            27 => 8,
            _ => -1,
        };
        if (n < 0)
        {
            return DecodeError.Unsupported;
        }

        if (pos + n > b.Length)
        {
            return DecodeError.UnexpectedEnd;
        }

        ulong v = 0;
        for (int i = 0; i < n; i++)
        {
            v = (v << 8) | b[pos + i];
        }

        pos += n;
        arg = v;
        return null;
    }

    /// <summary>Decodes canonical JSON text into a <see cref="DynamicValue"/> — the inverse of
    /// <see cref="ToCanonicalJson"/>, completing the text↔value round-trip for the six locked shapes
    /// (Float + Bytes are DEFERRED in JSON and lock under CBOR instead; a number with a decimal point
    /// or exponent is a Float → <see cref="DecodeError.Unsupported"/>).
    /// <para>Strictly canonical: a lenient recursive-descent parse, then one fixed-point check
    /// (<c>ToCanonicalJson(decoded) == input</c>) rejects every non-canonical form (insignificant
    /// whitespace, non-minimal escapes, leading zeros / '+' signs) as <see cref="DecodeError.NonCanonical"/>.
    /// int64 precision is preserved by parsing the number token as text (<see cref="long"/>), never via a
    /// double. Surfaced as data via <see cref="Result{T, TError}"/>, never thrown. Mirrors the TS/F#/Rust
    /// decoder.</para></summary>
    /// <param name="json">canonical JSON text.</param>
    /// <returns><see cref="Result{T, TError}.Ok"/> with the decoded value, or
    /// <see cref="Result{T, TError}.Err"/> carrying the <see cref="DecodeError"/>.</returns>
    public static Result<DynamicValue, DecodeError> FromCanonicalJson(string json)
    {
        ArgumentNullException.ThrowIfNull(json);
        int pos = 0;
        DecodeError? err = TryReadJsonValue(json, ref pos, 0, out DynamicValue value);
        if (err is DecodeError e)
        {
            return new Result<DynamicValue, DecodeError>.Err(e);
        }

        SkipJsonWs(json, ref pos);
        if (pos != json.Length)
        {
            return new Result<DynamicValue, DecodeError>.Err(DecodeError.TrailingData);
        }

        // Canonical-form fixed-point: a canonical string re-encodes to itself. The decoder only
        // produces the six locked shapes, so ToCanonicalJson is always Ok here; anything else (extra
        // whitespace, non-minimal escapes, leading zeros) is well-formed but not canonical.
        if (ToCanonicalJson(value) is not Result<string, EncodeError>.Ok reEnc
            || !string.Equals(reEnc.Value, json, StringComparison.Ordinal))
        {
            return new Result<DynamicValue, DecodeError>.Err(DecodeError.NonCanonical);
        }

        return new Result<DynamicValue, DecodeError>.Ok(value);
    }

    private static void SkipJsonWs(string s, ref int pos)
    {
        while (pos < s.Length && (s[pos] == ' ' || s[pos] == '\t' || s[pos] == '\n' || s[pos] == '\r'))
        {
            pos++;
        }
    }

    // Reads one JSON value at `pos`, advancing it. Returns null on success (value set), else the error.
    // `depth` guards the per-nesting-level recursion: past the fixed bound the input is rejected as
    // data (NestingTooDeep) rather than overflowing the stack.
    private static DecodeError? TryReadJsonValue(string s, ref int pos, int depth, out DynamicValue value)
    {
        value = new DynamicValue.Null();
        if (depth > MaxNestingDepth)
        {
            return DecodeError.NestingTooDeep;
        }

        SkipJsonWs(s, ref pos);
        if (pos >= s.Length)
        {
            return DecodeError.UnexpectedEnd;
        }

        char c = s[pos];
        switch (c)
        {
            case 'n':
                return TryReadJsonLiteral(s, ref pos, "null", new DynamicValue.Null(), out value);
            case 't':
                return TryReadJsonLiteral(s, ref pos, "true", new DynamicValue.Bool(true), out value);
            case 'f':
                return TryReadJsonLiteral(s, ref pos, "false", new DynamicValue.Bool(false), out value);
            case '"':
                return TryReadJsonString(s, ref pos, out value);
            case '[':
                return TryReadJsonArray(s, ref pos, depth, out value);
            case '{':
                return TryReadJsonObject(s, ref pos, depth, out value);
            default:
                if (c == '-' || (c >= '0' && c <= '9'))
                {
                    return TryReadJsonNumber(s, ref pos, out value);
                }

                return DecodeError.UnexpectedEnd;
        }
    }

    private static DecodeError? TryReadJsonLiteral(
        string s, ref int pos, string lit, DynamicValue lifted, out DynamicValue value)
    {
        value = new DynamicValue.Null();
        if (pos + lit.Length > s.Length || !s.AsSpan(pos, lit.Length).SequenceEqual(lit))
        {
            return DecodeError.UnexpectedEnd;
        }

        pos += lit.Length;
        value = lifted;
        return null;
    }

    // Reads a JSON string body into `result` (pos is at the opening quote). Lenient on escapes;
    // the fixed-point check rejects non-canonical escapes (e.g. A for raw "A") as NonCanonical.
    private static DecodeError? TryReadJsonStringRaw(string s, ref int pos, out string result)
    {
        result = string.Empty;
        var sb = new StringBuilder();
        pos++; // opening quote
        while (pos < s.Length)
        {
            char c = s[pos];
            if (c == '"')
            {
                pos++;
                result = sb.ToString();
                return null;
            }

            if (c == '\\')
            {
                DecodeError? escErr = ReadJsonEscape(s, ref pos, sb);
                if (escErr is DecodeError ee)
                {
                    return ee;
                }
            }
            else
            {
                sb.Append(c);
                pos++;
            }
        }

        return DecodeError.UnexpectedEnd; // unterminated string
    }

    // Reads one escape sequence (pos at the backslash), appends the decoded char, advances pos.
    private static DecodeError? ReadJsonEscape(string s, ref int pos, StringBuilder sb)
    {
        pos++; // past backslash
        if (pos >= s.Length)
        {
            return DecodeError.UnexpectedEnd;
        }

        char e = s[pos];
        if (e == 'u')
        {
            if (pos + 5 > s.Length)
            {
                return DecodeError.UnexpectedEnd; // 'u' + 4 hex digits
            }

            // require exactly 4 hex digits — AllowHexSpecifier (NOT HexNumber, which also permits
            // leading/trailing whitespace) so a "\u 001"-style escape is rejected, not trimmed
            if (!ushort.TryParse(
                    s.AsSpan(pos + 1, 4), NumberStyles.AllowHexSpecifier, CultureInfo.InvariantCulture, out ushort code))
            {
                return DecodeError.UnexpectedEnd;
            }

            sb.Append((char)code);
            pos += 5; // 'u' + 4 hex
            return null;
        }

        char? rep = e switch
        {
            '"' => '"',
            '\\' => '\\',
            '/' => '/',
            'b' => '\b',
            'f' => '\f',
            'n' => '\n',
            'r' => '\r',
            't' => '\t',
            _ => (char?)null,
        };
        if (rep is not char rc)
        {
            return DecodeError.UnexpectedEnd; // invalid escape
        }

        sb.Append(rc);
        pos++; // past escape char
        return null;
    }

    private static DecodeError? TryReadJsonString(string s, ref int pos, out DynamicValue value)
    {
        value = new DynamicValue.Null();
        DecodeError? err = TryReadJsonStringRaw(s, ref pos, out string str);
        if (err is DecodeError e)
        {
            return e;
        }

        value = new DynamicValue.String(str);
        return null;
    }

    // Consumes one or more digits at pos; UnexpectedEnd if none (enforces the JSON grammar's
    // "at least one digit" for the integer part, fraction, and exponent).
    private static DecodeError? ConsumeJsonDigits(string s, ref int pos)
    {
        int d0 = pos;
        while (pos < s.Length && s[pos] >= '0' && s[pos] <= '9')
        {
            pos++;
        }

        return pos == d0 ? DecodeError.UnexpectedEnd : null;
    }

    private static DecodeError? TryReadJsonNumber(string s, ref int pos, out DynamicValue value)
    {
        value = new DynamicValue.Null();
        int start = pos;
        if (s[pos] == '-')
        {
            pos++;
        }

        if (ConsumeJsonDigits(s, ref pos) is DecodeError intErr) // integer part — required ("-", "-.5")
        {
            return intErr;
        }

        bool isFloat = false;
        if (pos < s.Length && s[pos] == '.')
        {
            isFloat = true;
            pos++;
            if (ConsumeJsonDigits(s, ref pos) is DecodeError fracErr) // fraction — required after '.'
            {
                return fracErr;
            }
        }

        if (pos < s.Length && (s[pos] == 'e' || s[pos] == 'E'))
        {
            isFloat = true;
            pos++;
            if (pos < s.Length && (s[pos] == '+' || s[pos] == '-'))
            {
                pos++;
            }

            if (ConsumeJsonDigits(s, ref pos) is DecodeError expErr) // exponent — required ("1e", "1e+")
            {
                return expErr;
            }
        }

        if (isFloat)
        {
            return DecodeError.Unsupported; // Float deferred in v1 JSON
        }

        // token is `-?[0-9]+`, so the only way long.TryParse fails is int64 overflow
        if (!long.TryParse(
                s.AsSpan(start, pos - start), NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out long n))
        {
            return DecodeError.IntegerOverflow;
        }

        value = new DynamicValue.Int(n);
        return null;
    }

    private static DecodeError? TryReadJsonArray(string s, ref int pos, int depth, out DynamicValue value)
    {
        value = new DynamicValue.Null();
        pos++; // past the opening bracket
        var items = ImmutableArray.CreateBuilder<DynamicValue>();
        SkipJsonWs(s, ref pos);
        if (pos < s.Length && s[pos] == ']')
        {
            pos++;
            value = new DynamicValue.Array(items.ToImmutable());
            return null;
        }

        while (pos < s.Length)
        {
            DecodeError? itemErr = TryReadJsonValue(s, ref pos, depth + 1, out DynamicValue item);
            if (itemErr is DecodeError ie)
            {
                return ie;
            }

            items.Add(item);
            SkipJsonWs(s, ref pos);
            if (pos >= s.Length)
            {
                break;
            }

            char c = s[pos];
            if (c == ',')
            {
                pos++;
                continue;
            }

            if (c == ']')
            {
                pos++;
                value = new DynamicValue.Array(items.ToImmutable());
                return null;
            }

            return DecodeError.UnexpectedEnd;
        }

        return DecodeError.UnexpectedEnd;
    }

    // Reads one "key": value pair (pos at the opening quote of the key), advancing pos.
    private static DecodeError? TryReadJsonPair(
        string s, ref int pos, int depth, out KeyValuePair<string, DynamicValue> pair)
    {
        pair = default;
        DecodeError? keyErr = TryReadJsonStringRaw(s, ref pos, out string key);
        if (keyErr is DecodeError ke)
        {
            return ke;
        }

        SkipJsonWs(s, ref pos);
        if (pos >= s.Length || s[pos] != ':')
        {
            return DecodeError.UnexpectedEnd;
        }

        pos++;
        DecodeError? valErr = TryReadJsonValue(s, ref pos, depth, out DynamicValue val);
        if (valErr is DecodeError ve)
        {
            return ve;
        }

        pair = new KeyValuePair<string, DynamicValue>(key, val);
        return null;
    }

    private static DecodeError? TryReadJsonObject(string s, ref int pos, int depth, out DynamicValue value)
    {
        value = new DynamicValue.Null();
        pos++; // past the opening brace
        var pairs = ImmutableArray.CreateBuilder<KeyValuePair<string, DynamicValue>>();
        SkipJsonWs(s, ref pos);
        if (pos < s.Length && s[pos] == '}')
        {
            pos++;
            value = new DynamicValue.Object(pairs.ToImmutable());
            return null;
        }

        while (pos < s.Length)
        {
            SkipJsonWs(s, ref pos);
            if (pos >= s.Length || s[pos] != '"')
            {
                return DecodeError.UnexpectedEnd; // key must be a string
            }

            DecodeError? pairErr = TryReadJsonPair(s, ref pos, depth + 1, out KeyValuePair<string, DynamicValue> pair);
            if (pairErr is DecodeError pe)
            {
                return pe;
            }

            pairs.Add(pair);
            SkipJsonWs(s, ref pos);
            if (pos >= s.Length)
            {
                break;
            }

            char c = s[pos];
            if (c == ',')
            {
                pos++;
                continue;
            }

            if (c == '}')
            {
                pos++;
                value = new DynamicValue.Object(pairs.ToImmutable());
                return null;
            }

            return DecodeError.UnexpectedEnd;
        }

        return DecodeError.UnexpectedEnd;
    }
}
