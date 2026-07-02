#pragma warning disable CA1861
#pragma warning disable CA1859

using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using Zeta.Core;
using Zeta.Core.Abstractions;
using Zeta.Core.CSharp;
using IntegerRing = Zeta.Core.CSharp.IntegerRing;
using WeightedSet = Zeta.Core.CSharp.WeightedSet;

namespace Zeta.Tests.CSharp;

public class WeightedSetTests
{
    private static readonly IRing<long> sr = IntegerRing.Instance;

    [Fact]
    public void OfSeqCombinesDuplicateCoordinatesViaAddAndPrunesZero()
    {
        var ws = WeightedSet.OfSeq(sr, new[]
        {
            KeyValuePair.Create("a", 1L),
            KeyValuePair.Create("b", 2L),
            KeyValuePair.Create("a", 3L),
            KeyValuePair.Create("c", 0L)
        });

        Assert.Equal(4L, ws.GetWeight(sr, "a")); // 1+3
        Assert.Equal(2L, ws.GetWeight(sr, "b"));
        Assert.Equal(0L, ws.GetWeight(sr, "c")); // 0 weight pruned -> absent -> Zero
        Assert.Equal(2, ws.Count); // c not stored
        Assert.Equal(new[] { "a", "b" }, ws.Support);
    }

    [Fact]
    public void AddIsRetractionNative()
    {
        var a = WeightedSet.OfSeq(sr, new[]
        {
            KeyValuePair.Create("x", 5L),
            KeyValuePair.Create("y", -2L)
        });

        Assert.True(a.Add(sr, a.Negate(sr)).IsEmpty);

        // partial cancellation prunes the zeroed coordinate
        var b = WeightedSet.OfSeq(sr, new[] { KeyValuePair.Create("x", -5L) });
        var r = a.Add(sr, b);
        Assert.Equal(new[] { "y" }, r.Support);
        Assert.Equal(-2L, r.GetWeight(sr, "y"));
    }

    [Fact]
    public void AddIsCommutativeAndAssociative()
    {
        var a = WeightedSet.OfSeq(sr, new[]
        {
            KeyValuePair.Create("p", 1L),
            KeyValuePair.Create("q", 2L)
        });
        var b = WeightedSet.OfSeq(sr, new[]
        {
            KeyValuePair.Create("q", 3L),
            KeyValuePair.Create("r", 4L)
        });
        var c = WeightedSet.OfSeq(sr, new[]
        {
            KeyValuePair.Create("p", -1L),
            KeyValuePair.Create("s", 5L)
        });

        var ab = a.Add(sr, b);
        var ba = b.Add(sr, a);
        Assert.Equal(ab.Support, ba.Support);
        Assert.Equal(ab.GetWeight(sr, "q"), ba.GetWeight(sr, "q"));

        var ab_c = ab.Add(sr, c);
        var a_bc = a.Add(sr, b.Add(sr, c));
        Assert.Equal(ab_c.Support, a_bc.Support);
        foreach (var key in ab_c.Support)
        {
            Assert.Equal(ab_c.GetWeight(sr, key), a_bc.GetWeight(sr, key));
        }
    }

    [Fact]
    public void ScaleByZeroAnnihilatesScaleByOneIsIdentityScaleDistributesOverAdd()
    {
        var a = WeightedSet.OfSeq(sr, new[]
        {
            KeyValuePair.Create("a", 2L),
            KeyValuePair.Create("b", 3L)
        });

        Assert.True(a.Scale(sr, 0L).IsEmpty); // xZero annihilator

        var scaledOne = a.Scale(sr, 1L);
        Assert.Equal(a.Support, scaledOne.Support);
        Assert.Equal(a.GetWeight(sr, "a"), scaledOne.GetWeight(sr, "a"));

        var b = WeightedSet.OfSeq(sr, new[]
        {
            KeyValuePair.Create("b", 1L),
            KeyValuePair.Create("c", 4L)
        });

        // k*(a+b) = k*a + k*b
        var lhs = a.Add(sr, b).Scale(sr, 3L);
        var rhs = a.Scale(sr, 3L).Add(sr, b.Scale(sr, 3L));

        Assert.Equal(lhs.Support, rhs.Support);
        foreach (var key in lhs.Support)
        {
            Assert.Equal(lhs.GetWeight(sr, key), rhs.GetWeight(sr, key));
        }
    }

    [Fact]
    public void InnerIsContractionOverSharedCoordinates()
    {
        var a = WeightedSet.OfSeq(sr, new[]
        {
            KeyValuePair.Create("x", 2L),
            KeyValuePair.Create("y", 3L),
            KeyValuePair.Create("z", 1L)
        });
        var b = WeightedSet.OfSeq(sr, new[]
        {
            KeyValuePair.Create("y", 4L),
            KeyValuePair.Create("z", 5L),
            KeyValuePair.Create("w", 9L)
        });

        Assert.Equal(3L * 4L + 1L * 5L, a.Inner(sr, b)); // shared y,z only

        // SDR overlap: 0/1 weights, inner = count of shared active coordinates
        Func<string[], WeightedSet<string, long>> sdr = xs =>
            WeightedSet.OfSeq(sr, xs.Select(x => KeyValuePair.Create(x, 1L)));

        var s1 = sdr(new[] { "f1", "f3", "f7", "f9" });
        var s2 = sdr(new[] { "f3", "f7", "f8" });
        Assert.Equal(2L, s1.Inner(sr, s2)); // f3, f7 overlap
    }

    [Fact]
    public void SumIsOrderIndependentAndMapKeysMergesCollisions()
    {
        var parts = new[]
        {
            WeightedSet.Singleton(sr, "a", 1L),
            WeightedSet.Singleton(sr, "b", 2L),
            WeightedSet.Singleton(sr, "a", 1L)
        };

        var forward = WeightedSet.Sum(sr, parts);
        var reversed = WeightedSet.Sum(sr, parts.Reverse());

        Assert.Equal(forward.Support, reversed.Support);
        Assert.Equal(2L, forward.GetWeight(sr, "a"));

        var ws = WeightedSet.OfSeq(sr, new[]
        {
            KeyValuePair.Create("a", 1L),
            KeyValuePair.Create("b", 2L)
        });
        var collapsed = ws.MapKeys(sr, _ => "k");
        Assert.Equal(3L, collapsed.GetWeight(sr, "k"));
        Assert.Equal(1, collapsed.Count);
    }

    [Fact]
    public void SatisfiesITensorContract()
    {
        var ws = WeightedSet.OfSeq(sr, new[]
        {
            KeyValuePair.Create("a", 1L),
            KeyValuePair.Create("b", 2L),
            KeyValuePair.Create("c", 0L)
        });

        var t = (ITensor<string, long>)ws;
        Assert.True(t.IsSparse);
        Assert.Equal(2L, t.StoredCount);

        var entries = t.StoredEntries.ToList();
        Assert.Equal(2, entries.Count);
        Assert.Equal("a", entries[0].Key);
        Assert.Equal(1L, entries[0].Value);
        Assert.Equal("b", entries[1].Key);
        Assert.Equal(2L, entries[1].Value);
    }
}
