using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp.Algebra;

/// <summary>
/// G-Set cross-language conformance (C# oracle joining "meet-in-the-middle" per the
/// fixture header). Replays the SHARED, self-describing golden vectors —
/// <c>src/Core.TypeScript/g-set/golden-vectors.json</c> — and must value-match every
/// <c>expectedReplayStates[i]</c> (after op i) AND <c>expectedFinalState</c>. The
/// fixture embeds the canonical expected states (no per-language output file), so
/// passing == agreeing with the TS/F#/Rust oracles. Read with
/// <see cref="StringComparer.Ordinal"/> to match the fixture's stated ordinal/code-point
/// order (not culture-sensitive <see cref="System.Collections.Generic.Comparer{T}.Default"/>).
/// </summary>
public class GSetCrossVerifyTests
{
    private static string RepoRoot()
    {
        // Walk up from the test assembly to the Zeta.sln sentinel (a git worktree's
        // .git is a file, not a dir, so Zeta.sln is the reliable repo-root marker).
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(GSetCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName
            ?? throw new InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location.");
    }

    private static string[] Strings(JsonElement array) =>
        array.EnumerateArray()
            .Select(e => e.GetString()
                ?? throw new InvalidOperationException($"fixture element is not a string: {e.GetRawText()}"))
            .ToArray();

    [Fact]
    public void GSetReplayMatchesGoldenVectors()
    {
        var root = RepoRoot();
        var path = Path.Join(root, "src", "Core.TypeScript", "g-set", "golden-vectors.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var r = doc.RootElement;
        var cmp = StringComparer.Ordinal;

        var state = GSet.OfSeq(Strings(r.GetProperty("initialSet")), cmp);
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
                "union" => state.Union(GSet.OfSeq(Strings(op.GetProperty("arg")), cmp)),
                _ => throw new InvalidOperationException($"unknown op {kind}"),
            };
            Assert.Equal(Strings(expectedReplay[i]), state.ToArray());
            i++;
        }

        Assert.Equal(Strings(r.GetProperty("expectedFinalState")), state.ToArray());
    }

    [Fact]
    public void UnionObeysCrdtLaws()
    {
        var cmp = StringComparer.Ordinal;
        static GSet<string> G(StringComparer cmp, params string[] xs) => GSet.OfSeq(xs, cmp);

        var a = G(cmp, "a", "c");
        var b = G(cmp, "b", "c", "d");
        var c = G(cmp, "c", "e");

        Assert.Equal(a, a.Union(a)); // idempotent
        Assert.Equal(a.Union(b), b.Union(a)); // commutative
        Assert.Equal(a.Union(b).Union(c), a.Union(b.Union(c))); // associative
        Assert.Equal(a, a.Union(GSet.Empty<string>(cmp))); // identity
        Assert.Equal(a, G(cmp, "a", "c").Add("c")); // add idempotent
        Assert.Equal(G(cmp, "a", "b", "c"), G(cmp, "a", "b").Add("c"));
    }

    [Fact]
    public void UnionThrowsOnMismatchedComparer()
    {
        // The comparer is part of a set's identity; unioning across different comparers is
        // a programming error (it would break commutativity), surfaced loudly rather than
        // silently recanonicalized (PR review 2026-06-01).
        var ordinal = StringComparer.Ordinal;
        var reverse = Comparer<string>.Create((x, y) => string.CompareOrdinal(y, x));

        string[] aItems = ["a", "b"];
        string[] otherItems = ["c", "a"];
        string[] expected = ["a", "b", "c"];

        var a = GSet.OfSeq(aItems, ordinal);
        var otherReverse = GSet.OfSeq(otherItems, reverse);
        Assert.Throws<ArgumentException>(() => a.Union(otherReverse));

        // Same comparer still unions cleanly + symmetric Equals holds.
        var otherOrdinal = GSet.OfSeq(otherItems, ordinal);
        Assert.Equal(GSet.OfSeq(expected, ordinal), a.Union(otherOrdinal));
        Assert.False(GSet.OfSeq(aItems, ordinal).Equals(GSet.OfSeq(aItems, reverse))); // diff comparer ⇒ not equal
    }

    [Fact]
    public void GenericMathAdditiveMonoidSurface()
    {
        // G-Set is an additive, commutative + idempotent monoid, so it surfaces the
        // generic-math IAdditiveIdentity + IAdditionOperators (NOT INumber — no inverse /
        // order / product). (+) == Union for same-comparer operands; AdditiveIdentity is empty.
        var cmp = StringComparer.Ordinal;
        static GSet<string> G(StringComparer cmp, params string[] xs) => GSet.OfSeq(xs, cmp);

        var a = G(cmp, "a", "c");
        var b = G(cmp, "b", "c", "d");
        var c = G(cmp, "c", "e");

        Assert.Equal(a.Union(b), a + b); // (+) equals Union
        Assert.True(GSet<string>.AdditiveIdentity.IsEmpty); // identity is the empty set
        Assert.Equal(a, GSet<string>.AdditiveIdentity + a); // identity law
        Assert.Equal(a, a + GSet<string>.AdditiveIdentity);
        Assert.Equal(a, a + a); // idempotent
        Assert.Equal(a + b, b + a); // commutative
        Assert.Equal((a + b) + c, a + (b + c)); // associative
    }

    [Fact]
    public void GenericMathIdentityIsComparerAgnosticButNonEmptyMismatchStillThrows()
    {
        // The additive identity (empty) must absorb under ANY comparer for the monoid identity
        // law to hold — AdditiveIdentity carries the default comparer, but a set may carry a
        // custom one. Empty has no elements, so its ordering is irrelevant: (+) short-circuits.
        var reverse = Comparer<string>.Create((x, y) => string.CompareOrdinal(y, x));
        var custom = GSet.OfSeq(["x", "y"], reverse);
        Assert.Equal(custom, custom + GSet<string>.AdditiveIdentity); // no throw
        Assert.Equal(custom, GSet<string>.AdditiveIdentity + custom);

        // But two NON-empty operands with different comparers still delegate to Union → throw
        // (the comparer-identity guard for real merges is preserved).
        var ordinal = GSet.OfSeq(["a", "b"], StringComparer.Ordinal);
        Assert.Throws<ArgumentException>(() => ordinal + custom);
    }
}
