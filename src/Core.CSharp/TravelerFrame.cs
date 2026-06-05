using System;
using System.Collections.Generic;
using System.Linq;

namespace Zeta.Core.CSharp;

/// <summary>
/// TravelerFrame — the causal vector-clock frame, C# oracle (#3 of TS/F#/C#/Rust). A frame is a per-actor
/// <c>long</c> map; conforms to the F# canonical shape (<c>src/Core/TravelerFrame.fs</c>) by agreeing on
/// the shared seed (<c>src/Core.TypeScript/traveler-frame/golden-vectors.json</c>). <see cref="Transform"/>
/// is the causal-join (pointwise max = LUB), <see cref="Dominates"/> the semilattice order, and
/// <see cref="Converge"/> folds a set of frames to their LUB (order-independent — the homeostat).
/// </summary>
public static class TravelerFrame
{
    private static long Coord(IReadOnlyDictionary<string, long> f, string k) =>
        f.TryGetValue(k, out var v) ? v : 0L;

    /// <summary>The inter-frame transformation: the causal-join (pointwise max over the union of keys).</summary>
    public static IReadOnlyDictionary<string, long> Transform(
        IReadOnlyDictionary<string, long> a,
        IReadOnlyDictionary<string, long> b)
    {
        ArgumentNullException.ThrowIfNull(a);
        ArgumentNullException.ThrowIfNull(b);
        return a.Keys.Union(b.Keys, StringComparer.Ordinal)
            .ToDictionary(k => k, k => Math.Max(Coord(a, k), Coord(b, k)), StringComparer.Ordinal);
    }

    /// <summary><paramref name="a"/> dominates <paramref name="b"/>: a ≥ b on every coordinate of b.</summary>
    public static bool Dominates(IReadOnlyDictionary<string, long> a, IReadOnlyDictionary<string, long> b)
    {
        ArgumentNullException.ThrowIfNull(a);
        ArgumentNullException.ThrowIfNull(b);
        return b.All(kv => Coord(a, kv.Key) >= kv.Value);
    }

    /// <summary>The common frame of a set: fold <see cref="Transform"/> from the origin (the LUB).</summary>
    public static IReadOnlyDictionary<string, long> Converge(IEnumerable<IReadOnlyDictionary<string, long>> frames)
    {
        ArgumentNullException.ThrowIfNull(frames);
        IReadOnlyDictionary<string, long> acc = new Dictionary<string, long>(StringComparer.Ordinal);
        foreach (var f in frames)
        {
            acc = Transform(acc, f);
        }

        return acc;
    }
}
