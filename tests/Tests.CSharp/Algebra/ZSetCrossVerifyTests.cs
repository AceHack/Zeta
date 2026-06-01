using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp.Algebra;

/// <summary>
/// Z-set (signed multiset) cross-language conformance — the C# native oracle for the TOP rung of
/// the algebra ladder (G-Set ⊂ Bag ⊂ Z-set). Replays the SHARED, self-describing golden vectors —
/// <c>src/Core.TypeScript/z-set/golden-vectors.json</c> — and must value-match every
/// <c>expectedReplayStates[i]</c> (after op i) AND <c>expectedFinalState</c>. Passing == agreeing
/// with the TS/F#/Rust oracles. Read with <see cref="StringComparer.Ordinal"/> to match the
/// fixture's stated ordinal/code-point key order (not culture-sensitive
/// <see cref="Comparer{T}.Default"/>).
/// </summary>
public class ZSetCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(ZSetCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName
            ?? throw new InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location.");
    }

    private static (string Key, long Weight)[] Entries(JsonElement array) =>
        array.EnumerateArray()
            .Select(e => (
                e.GetProperty("e").GetString()
                    ?? throw new InvalidOperationException($"fixture entry key is not a string: {e.GetRawText()}"),
                e.GetProperty("w").GetInt64()))
            .ToArray();

    /// <summary>The canonical entries as <c>(key, weight)</c> tuples — the shape the fixture compares against.</summary>
    private static (string Key, long Weight)[] AsTuples(ZSet<string> z) =>
        z.ToArray().Select(e => (e.Key, e.Weight)).ToArray();

    [Fact]
    public void ZSetReplayMatchesGoldenVectors()
    {
        var root = RepoRoot();
        var path = Path.Join(root, "src", "Core.TypeScript", "z-set", "golden-vectors.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var r = doc.RootElement;
        var cmp = StringComparer.Ordinal;

        var state = ZSet.OfEntries(Entries(r.GetProperty("initialZSet")), cmp);
        var ops = r.GetProperty("ops");
        var expectedReplay = r.GetProperty("expectedReplayStates");
        Assert.Equal(ops.GetArrayLength(), expectedReplay.GetArrayLength());

        var i = 0;
        foreach (var op in ops.EnumerateArray())
        {
            var kind = op.GetProperty("op").GetString();
            state = kind switch
            {
                "add" => state.Add(op.GetProperty("arg").GetString()!),
                "addW" => state.AddW(op.GetProperty("arg").GetString()!, op.GetProperty("w").GetInt64()),
                "union" => state.Union(ZSet.OfEntries(Entries(op.GetProperty("arg")), cmp)),
                _ => throw new InvalidOperationException($"unknown op {kind}"),
            };
            Assert.Equal(Entries(expectedReplay[i]), AsTuples(state));
            i++;
        }

        Assert.Equal(Entries(r.GetProperty("expectedFinalState")), AsTuples(state));
    }

    [Fact]
    public void UnionIsAbelianGroupButNotIdempotent()
    {
        var cmp = StringComparer.Ordinal;
        static ZSet<string> Z(StringComparer cmp, params (string, long)[] xs) => ZSet.OfEntries(xs, cmp);

        var a = Z(cmp, ("a", 1L), ("b", 2L));
        var b = Z(cmp, ("b", -1L), ("c", 3L));
        var c = Z(cmp, ("c", 1L), ("d", -4L));

        // NOT idempotent: union(a, a) doubles every weight (shared with Bag, distinct from G-Set).
        Assert.Equal(Z(cmp, ("a", 2L), ("b", 4L)), a.Union(a));
        Assert.Equal(a.Union(b), b.Union(a)); // commutative
        Assert.Equal(a.Union(b).Union(c), a.Union(b.Union(c))); // associative
        Assert.Equal(a, a.Union(ZSet.Empty<string>(cmp))); // identity
        // inverse: union(a, negate(a)) == empty (the law a Bag's monoid cannot satisfy)
        Assert.True(a.Union(a.Negate()).IsEmpty);
    }

    [Fact]
    public void OfEntriesSumsSortsDropsZeroKeepsNegatives()
    {
        var cmp = StringComparer.Ordinal;
        // c: 1+3=4; b nets to 0 → dropped; d: -1 KEPT (a Bag would drop it); sorted ascending.
        var z = ZSet.OfEntries([("c", 1L), ("a", 2L), ("c", 3L), ("b", 1L), ("b", -1L), ("d", -1L)], cmp);
        Assert.Equal([("a", 2L), ("c", 4L), ("d", -1L)], AsTuples(z));
    }

    [Fact]
    public void WeightAddWNegateAndTotal()
    {
        var cmp = StringComparer.Ordinal;
        var a = ZSet.OfEntries([("a", 3L), ("c", -1L)], cmp);

        Assert.Equal(3L, a.Weight("a"));
        Assert.Equal(-1L, a.Weight("c")); // negative weight stored
        Assert.Equal(0L, a.Weight("b"));
        Assert.True(a.Contains("c")); // negative still "contained" (weight != 0)
        Assert.False(a.Contains("z"));

        Assert.Equal(a, a.AddW("a", 0L)); // w == 0 is a no-op
        Assert.Equal(ZSet.OfEntries([("a", 4L), ("c", -1L)], cmp), a.Add("a"));
        Assert.Equal(ZSet.OfEntries([("c", -1L)], cmp), a.AddW("a", -3L)); // a: 3 + (-3) = 0 → retracted
        Assert.Equal(2L, a.Total()); // 3 + (-1)
        Assert.Equal(2, a.Count); // distinct keys

        // negate is an involution
        Assert.Equal(a, a.Negate().Negate());
    }

    [Fact]
    public void UnionThrowsOnMismatchedComparer()
    {
        // The comparer is part of a Z-set's identity (mirrors GSet/Bag, PR review 2026-06-01).
        var ordinal = StringComparer.Ordinal;
        var reverse = Comparer<string>.Create((x, y) => string.CompareOrdinal(y, x));

        var a = ZSet.OfEntries([("a", 1L), ("b", 2L)], ordinal);
        var otherReverse = ZSet.OfEntries([("c", 1L), ("a", 1L)], reverse);
        Assert.Throws<ArgumentException>(() => a.Union(otherReverse));

        // diff comparer ⇒ not equal
        Assert.False(ZSet.OfEntries([("a", 1L)], ordinal).Equals(ZSet.OfEntries([("a", 1L)], reverse)));
    }
}
