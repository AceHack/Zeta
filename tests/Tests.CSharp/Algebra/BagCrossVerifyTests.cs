using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp.Algebra;

/// <summary>
/// Bag (multiset) cross-language conformance — the C# oracle for the MIDDLE rung of the algebra
/// ladder (G-Set ⊂ Bag ⊂ Z-set). Replays the SHARED, self-describing golden vectors —
/// <c>src/Core.TypeScript/bag/golden-vectors.json</c> — and must value-match every
/// <c>expectedReplayStates[i]</c> (after op i) AND <c>expectedFinalState</c>. Passing == agreeing
/// with the TS/F#/Rust oracles. Read with <see cref="StringComparer.Ordinal"/> to match the
/// fixture's stated ordinal/code-point key order (not culture-sensitive
/// <see cref="Comparer{T}.Default"/>).
/// </summary>
public class BagCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(BagCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName
            ?? throw new InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location.");
    }

    private static (string Key, long Count)[] Entries(JsonElement array) =>
        array.EnumerateArray()
            .Select(e => (
                e.GetProperty("e").GetString()
                    ?? throw new InvalidOperationException($"fixture entry key is not a string: {e.GetRawText()}"),
                e.GetProperty("n").GetInt64()))
            .ToArray();

    /// <summary>The canonical entries as <c>(key, count)</c> tuples — the shape the fixture compares against.</summary>
    private static (string Key, long Count)[] AsTuples(Bag<string> b) =>
        b.ToArray().Select(e => (e.Key, e.Count)).ToArray();

    [Fact]
    public void BagReplayMatchesGoldenVectors()
    {
        var root = RepoRoot();
        var path = Path.Join(root, "src", "Core.TypeScript", "bag", "golden-vectors.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var r = doc.RootElement;
        var cmp = StringComparer.Ordinal;

        var state = Bag.OfEntries(Entries(r.GetProperty("initialBag")), cmp);
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
                "addN" => state.AddN(op.GetProperty("arg").GetString()!, op.GetProperty("n").GetInt64()),
                "union" => state.Union(Bag.OfEntries(Entries(op.GetProperty("arg")), cmp)),
                _ => throw new InvalidOperationException($"unknown op {kind}"),
            };
            Assert.Equal(Entries(expectedReplay[i]), AsTuples(state));
            i++;
        }

        Assert.Equal(Entries(r.GetProperty("expectedFinalState")), AsTuples(state));
    }

    [Fact]
    public void UnionIsCommutativeMonoidButNotIdempotent()
    {
        var cmp = StringComparer.Ordinal;
        static Bag<string> B(StringComparer cmp, params (string, long)[] xs) => Bag.OfEntries(xs, cmp);

        var a = B(cmp, ("a", 1L), ("b", 2L));
        var b = B(cmp, ("b", 1L), ("c", 3L));
        var c = B(cmp, ("c", 5L), ("d", 1L));

        // NOT idempotent: union(a, a) doubles every count (the Bag/G-Set distinction).
        Assert.Equal(B(cmp, ("a", 2L), ("b", 4L)), a.Union(a));
        Assert.Equal(a.Union(b), b.Union(a)); // commutative
        Assert.Equal(a.Union(b).Union(c), a.Union(b.Union(c))); // associative
        Assert.Equal(a, a.Union(Bag.Empty<string>(cmp))); // identity
    }

    [Fact]
    public void OfEntriesSumsSortsAndDropsNonPositive()
    {
        var cmp = StringComparer.Ordinal;
        // c: 1+3=4; b nets to 0 → dropped; sorted ascending.
        var bag = Bag.OfEntries([("c", 1L), ("a", 2L), ("c", 3L), ("b", 1L), ("b", -1L)], cmp);
        Assert.Equal([("a", 2L), ("c", 4L)], AsTuples(bag));
    }

    [Fact]
    public void MultiplicityAddNAndTotal()
    {
        var cmp = StringComparer.Ordinal;
        var a = Bag.OfEntries([("a", 3L), ("c", 1L)], cmp);

        Assert.Equal(3L, a.Multiplicity("a"));
        Assert.Equal(0L, a.Multiplicity("b"));
        Assert.True(a.Contains("c"));
        Assert.False(a.Contains("z"));

        Assert.Equal(a, a.AddN("a", 0L)); // n <= 0 is a no-op
        Assert.Equal(a, a.AddN("b", -3L));
        Assert.Equal(Bag.OfEntries([("a", 4L), ("c", 1L)], cmp), a.Add("a"));
        Assert.Equal(4L, a.Total()); // 3 + 1
        Assert.Equal(2, a.Count); // distinct keys
    }

    [Fact]
    public void UnionThrowsOnMismatchedComparer()
    {
        // The comparer is part of a bag's identity (mirrors GSet, PR review 2026-06-01).
        var ordinal = StringComparer.Ordinal;
        var reverse = Comparer<string>.Create((x, y) => string.CompareOrdinal(y, x));

        var a = Bag.OfEntries([("a", 1L), ("b", 2L)], ordinal);
        var otherReverse = Bag.OfEntries([("c", 1L), ("a", 1L)], reverse);
        Assert.Throws<ArgumentException>(() => a.Union(otherReverse));

        // diff comparer ⇒ not equal
        Assert.False(Bag.OfEntries([("a", 1L)], ordinal).Equals(Bag.OfEntries([("a", 1L)], reverse)));
    }
}
