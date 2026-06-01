// DynamicValues — the accessor / navigation companion for DynamicValue (the F# module +
// `RangeSets`/`ZSets` static-companion convention). These take a DynamicValue parameter (they test
// the parameter, not `this`), so the value tree stays a plain closed record hierarchy.

using System.Collections.Immutable;
using System.Globalization;

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
}
