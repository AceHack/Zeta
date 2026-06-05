using System;
using System.Collections.Generic;
using System.Linq;

namespace Zeta.Core.CSharp;

/// <summary>
/// FrameDelta — the relative-offset transformation group of the traveler frame, C# oracle (#3 of
/// TS/F#/C#/Rust). A delta and a frame are per-actor <c>long</c> maps; conforms to the F# canonical shape
/// (<c>src/Core/FrameDelta.fs</c>) by agreeing on the shared seed
/// (<c>src/Core.TypeScript/frame-delta/golden-vectors.json</c>). Deltas are normalized (zero shifts
/// dropped); <see cref="Apply"/> keeps zero coordinates (the union of keys).
/// </summary>
public static class FrameDelta
{
    private static long Get(IReadOnlyDictionary<string, long> m, string k) =>
        m.TryGetValue(k, out var v) ? v : 0L;

    private static Dictionary<string, long> Normalize(IEnumerable<KeyValuePair<string, long>> pairs) =>
        pairs.Where(kv => kv.Value != 0L).ToDictionary(kv => kv.Key, kv => kv.Value, StringComparer.Ordinal);

    /// <summary>Compose two transformations (the group op): pointwise add, normalized.</summary>
    public static IReadOnlyDictionary<string, long> Compose(
        IReadOnlyDictionary<string, long> a,
        IReadOnlyDictionary<string, long> b)
    {
        ArgumentNullException.ThrowIfNull(a);
        ArgumentNullException.ThrowIfNull(b);
        var keys = a.Keys.Union(b.Keys, StringComparer.Ordinal);
        return Normalize(keys.Select(k => new KeyValuePair<string, long>(k, Get(a, k) + Get(b, k))));
    }

    /// <summary>The group inverse: negate every shift.</summary>
    public static IReadOnlyDictionary<string, long> Inverse(IReadOnlyDictionary<string, long> d)
    {
        ArgumentNullException.ThrowIfNull(d);
        return Normalize(d.Select(kv => new KeyValuePair<string, long>(kv.Key, -kv.Value)));
    }

    /// <summary>The transformation taking frame <paramref name="from"/> to <paramref name="to"/>: per-actor (to − from).</summary>
    public static IReadOnlyDictionary<string, long> Between(
        IReadOnlyDictionary<string, long> from,
        IReadOnlyDictionary<string, long> to)
    {
        ArgumentNullException.ThrowIfNull(from);
        ArgumentNullException.ThrowIfNull(to);
        var keys = from.Keys.Union(to.Keys, StringComparer.Ordinal);
        return Normalize(keys.Select(k => new KeyValuePair<string, long>(k, Get(to, k) - Get(from, k))));
    }

    /// <summary>Apply a transformation to a frame (group action by translation); keeps zero coordinates.</summary>
    public static IReadOnlyDictionary<string, long> Apply(
        IReadOnlyDictionary<string, long> delta,
        IReadOnlyDictionary<string, long> frame)
    {
        ArgumentNullException.ThrowIfNull(delta);
        ArgumentNullException.ThrowIfNull(frame);
        var keys = delta.Keys.Union(frame.Keys, StringComparer.Ordinal);
        return keys.ToDictionary(k => k, k => Get(frame, k) + Get(delta, k), StringComparer.Ordinal);
    }

    /// <summary>The L1 magnitude of a transformation: total absolute shift.</summary>
    public static long Magnitude(IReadOnlyDictionary<string, long> d)
    {
        ArgumentNullException.ThrowIfNull(d);
        return d.Values.Sum(Math.Abs);
    }

    /// <summary>The range between two frames: the L1 distance of their offset.</summary>
    public static long Distance(IReadOnlyDictionary<string, long> from, IReadOnlyDictionary<string, long> to) =>
        Magnitude(Between(from, to));
}
