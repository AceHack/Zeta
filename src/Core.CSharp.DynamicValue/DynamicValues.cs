// DynamicValues — the accessor / navigation companion for DynamicValue (the F# module +
// `RangeSets`/`ZSets` static-companion convention). These take a DynamicValue parameter (they test
// the parameter, not `this`), so the value tree stays a plain closed record hierarchy.

using System.Collections.Immutable;
using System.Globalization;
using System.Text;

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
            if (keyPart.Contains(']'))
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
    public static Result<string, EncodeError> ToCanonicalJson(DynamicValue value)
    {
        ArgumentNullException.ThrowIfNull(value);

        if (FirstDeferred(value) is EncodeError deferred)
        {
            return new Result<string, EncodeError>.Err(deferred);
        }

        var sb = new StringBuilder();
        WriteCanonical(sb, value);
        return new Result<string, EncodeError>.Ok(sb.ToString());
    }

    // The first deferred variant (Float/Bytes) anywhere in the tree, or null if fully encodable.
    private static EncodeError? FirstDeferred(DynamicValue value)
    {
        switch (value)
        {
            case DynamicValue.Float:
                return EncodeError.FloatDeferred;
            case DynamicValue.Bytes:
                return EncodeError.BytesDeferred;
            case DynamicValue.Array a:
                // first deferred among the items (Select is lazy; FirstOrDefault short-circuits)
                return a.Items.Select(FirstDeferred).FirstOrDefault(e => e is not null);
            case DynamicValue.Object o:
                return o.Pairs.Select(pair => FirstDeferred(pair.Value)).FirstOrDefault(e => e is not null);
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
}
