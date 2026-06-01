using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp.Algebra;

/// <summary>
/// IndexedZSet (Z[K × V]) cross-language conformance — the C# native oracle for the join/aggregation
/// rung above the Z-set (G-Set ⊂ Bag ⊂ Z-set ⊂ IndexedZSet). Replays the SHARED, self-describing
/// golden vectors — <c>src/Core.TypeScript/indexed-z-set/golden-vectors.json</c> — and must
/// value-match <c>expectedA</c> (via <c>IndexWith</c>), <c>expectedAddAB</c> / <c>expectedNegA</c> /
/// <c>expectedSubAB</c>, the bilinear <c>expectedJoinAB</c>, <c>expectedToZSetA</c>, and the
/// key/tuple counts. Passing == agreeing with the TS reference + F# engine + Rust twin. Read with
/// <see cref="StringComparer.Ordinal"/> to match the fixture's stated key/value order.
/// </summary>
public class IndexedZSetCrossVerifyTests
{
    private static readonly StringComparer Ord = StringComparer.Ordinal;

    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(IndexedZSetCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName
            ?? throw new InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location.");
    }

    private static JsonElement Fixture()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "indexed-z-set", "golden-vectors.json");
        // Clone() detaches the element so it stays valid after dispose (CA2000, Copilot P1 #6404) —
        // JsonDocument holds unmanaged buffers and must be disposed.
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.Clone();
    }

    /// <summary>Parse a Z-set <c>[{ e, w }]</c> array as <c>(key, weight)</c> tuples.</summary>
    private static (string Key, long Weight)[] ZEntries(JsonElement array) =>
        array.EnumerateArray()
            .Select(e => (
                e.GetProperty("e").GetString()
                    ?? throw new InvalidOperationException($"entry key not a string: {e.GetRawText()}"),
                e.GetProperty("w").GetInt64()))
            .ToArray();

    /// <summary>Parse an indexed-state <c>[{ k, values:[{e,w}] }]</c> into a canonical IndexedZSet.</summary>
    private static IndexedZSet<string, string> ParseIndexed(JsonElement array)
    {
        var groups = array.EnumerateArray()
            .Select(g => new KeyGroup<string, string>(
                g.GetProperty("k").GetString()
                    ?? throw new InvalidOperationException($"group key not a string: {g.GetRawText()}"),
                ZSet.OfEntries(ZEntries(g.GetProperty("values")), Ord)));
        return IndexedZSet.OfGroups(groups, Ord, Ord);
    }

    private static (string Key, long Weight)[] AsTuples(ZSet<string> z) =>
        z.ToArray().Select(e => (e.Key, e.Weight)).ToArray();

    /// <summary>Build A the real way: source Z-set from <c>indexInput</c>, then <c>IndexWith</c>.</summary>
    private static IndexedZSet<string, string> BuildA(JsonElement r)
    {
        var pairCmp = Comparer<(string K, string V)>.Create((x, y) =>
        {
            var c = string.CompareOrdinal(x.K, y.K);
            return c != 0 ? c : string.CompareOrdinal(x.V, y.V);
        });

        var entries = r.GetProperty("indexInput").EnumerateArray().Select(item =>
        {
            var e = item.GetProperty("e");
            var pair = (
                e.GetProperty("k").GetString() ?? throw new InvalidOperationException("indexInput k not a string"),
                e.GetProperty("v").GetString() ?? throw new InvalidOperationException("indexInput v not a string"));
            return (pair, item.GetProperty("w").GetInt64());
        });

        var source = ZSet.OfEntries(entries, pairCmp);
        return IndexedZSet.IndexWith(source, p => p.Item1, p => p.Item2, Ord, Ord);
    }

    [Fact]
    public void IndexWithBuildsExpectedCanonicalA()
    {
        var r = Fixture();
        Assert.True(BuildA(r).Equals(ParseIndexed(r.GetProperty("expectedA"))));
    }

    [Fact]
    public void KeyCountAndTupleCountMatch()
    {
        var r = Fixture();
        var a = BuildA(r);
        Assert.Equal(r.GetProperty("expectedKeyCountA").GetInt32(), a.KeyCount);
        Assert.Equal(r.GetProperty("expectedTupleCountA").GetInt32(), a.TupleCount());
    }

    [Fact]
    public void AddNegSubMatchGoldenVectors()
    {
        var r = Fixture();
        var a = BuildA(r);
        var b = ParseIndexed(r.GetProperty("operandB"));

        Assert.True(a.Add(b).Equals(ParseIndexed(r.GetProperty("expectedAddAB"))));
        Assert.True(a.Negate().Equals(ParseIndexed(r.GetProperty("expectedNegA"))));
        Assert.True(a.Sub(b).Equals(ParseIndexed(r.GetProperty("expectedSubAB"))));
    }

    [Fact]
    public void JoinMatchesGoldenVector()
    {
        var r = Fixture();
        var a = BuildA(r);
        var b = ParseIndexed(r.GetProperty("operandB"));

        var joined = a.Join(b, (k, va, vb) => $"{k}|{va}|{vb}", Ord);
        Assert.Equal(ZEntries(r.GetProperty("expectedJoinAB")), AsTuples(joined));
    }

    [Fact]
    public void ToZSetMatchesGoldenVector()
    {
        var r = Fixture();
        var a = BuildA(r);

        var flat = a.ToZSet((k, v) => $"{k}|{v}", Ord);
        Assert.Equal(ZEntries(r.GetProperty("expectedToZSetA")), AsTuples(flat));
    }

    [Fact]
    public void AbelianGroupInverseCancelsToEmpty()
    {
        var r = Fixture();
        var a = BuildA(r);
        Assert.True(a.Add(a.Negate()).IsEmpty); // add(a, neg(a)) == empty (every group cancels + drops)
    }
}
