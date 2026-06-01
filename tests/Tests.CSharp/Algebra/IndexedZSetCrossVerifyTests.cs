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

    // ─── generic-math abelian-group surface (System.Numerics IWSAM) ──────────

    private static IndexedZSet<string, string> BuildIxz(
        IComparer<string> kc,
        IComparer<string> vc,
        params (string K, string V, long W)[] triples)
    {
        var pairCmp = Comparer<(string, string)>.Create((x, y) =>
        {
            var c = kc.Compare(x.Item1, y.Item1);
            return c != 0 ? c : vc.Compare(x.Item2, y.Item2);
        });
        var source = ZSet.OfEntries(triples.Select(t => ((t.K, t.V), t.W)), pairCmp);
        return IndexedZSet.IndexWith(source, p => p.Item1, p => p.Item2, kc, vc);
    }

    private static IndexedZSet<string, string> Ixz(params (string K, string V, long W)[] triples) =>
        BuildIxz(Ord, Ord, triples);

    [Fact]
    public void GenericMathAbelianGroupSurface()
    {
        // dotnet IWSAM: IAdditiveIdentity + IAdditionOperators (monoid) PLUS
        // ISubtractionOperators + IUnaryNegationOperators (the abelian-group inverse).
        // (+) == Add, (-a) == Negate, (a-b) == Sub; AdditiveIdentity is empty. NOT INumber.
        var a = Ixz(("k1", "a", 1L), ("k2", "b", 2L));
        var b = Ixz(("k2", "b", 1L), ("k3", "c", 3L));
        var c = Ixz(("k3", "c", -1L), ("k4", "d", 4L));

        Assert.Equal(a.Add(b), a + b);  // (+) == Add
        Assert.Equal(a.Negate(), -a);   // unary (-) == Negate
        Assert.Equal(a.Sub(b), a - b);  // (-) == Sub
        Assert.True(IndexedZSet<string, string>.AdditiveIdentity.IsEmpty);
        Assert.Equal(a, IndexedZSet<string, string>.AdditiveIdentity + a); // identity law
        Assert.Equal(a, a + IndexedZSet<string, string>.AdditiveIdentity);

        Assert.Equal(a + b, b + a);             // commutative
        Assert.Equal((a + b) + c, a + (b + c)); // associative
        Assert.True((a + (-a)).IsEmpty);        // inverse: a + (-a) == empty
        Assert.True((a - a).IsEmpty);           // a - a == empty
    }

    [Fact]
    public void GenericMathAdditionIsNotIdempotentAndSubtractionRetracts()
    {
        // (+) is SUM, not set-union: a + a doubles every value-weight.
        var a = Ixz(("k", "a", 1L), ("k", "b", -3L));
        Assert.Equal(Ixz(("k", "a", 2L), ("k", "b", -6L)), a + a);

        // subtraction drives a shared (key,value) to net 0 → retracted (group empties + drops)
        var x = Ixz(("k", "a", 5L), ("k", "b", 2L));
        var y = Ixz(("k", "a", 5L));
        Assert.Equal(Ixz(("k", "b", 2L)), x - y);
    }

    [Fact]
    public void GenericMathIdentityIsComparerAgnosticButNonEmptyMismatchThrows()
    {
        // empty must absorb under ANY comparers (the identity law); (+)/(-) short-circuit empty
        // BEFORE Add's RequireSameComparers. Two NON-empty operands with mismatched comparers throw.
        var rev = Comparer<string>.Create((x, y) => string.CompareOrdinal(y, x));
        var custom = BuildIxz(rev, rev, ("x", "p", 1L));
        var id = IndexedZSet<string, string>.AdditiveIdentity;
        Assert.Equal(custom, custom + id); // a + empty = a (no throw)
        Assert.Equal(custom, id + custom); // empty + a = a (no throw)
        Assert.Equal(custom, custom - id); // a - empty = a (no throw)

        var ordinal = Ixz(("a", "p", 1L));
        Assert.Throws<ArgumentException>(() => ordinal + custom);
        Assert.Throws<ArgumentException>(() => ordinal - custom);
    }
}
