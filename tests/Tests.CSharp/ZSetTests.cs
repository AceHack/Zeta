using Zeta.Core;
using Xunit;

namespace Zeta.Tests.CSharp;

/// <summary>
/// Verifies that the F# DBSP API is ergonomic and correct when called from C#.
/// </summary>
public class ZSetTests
{
    [Fact]
    public void EmptyZSetHasCountZero()
    {
        var z = ZSet<int>.Empty;
        Assert.Equal(0, z.Count);
        Assert.True(z.IsEmpty);
    }

    [Fact]
    public void SingletonContainsKey()
    {
        var z = ZSetModule.singleton(42, 1L);
        Assert.Equal(1L, z[42]);
        Assert.Equal(0L, z[99]);
    }

    [Fact]
    public void AdditionCancelsNegativeWeights()
    {
        var a = ZSetModule.ofPairs(new[] { ((int, long))(1, 1L), ((int, long))(2, 2L) });
        var b = ZSetModule.ofPairs(new[] { ((int, long))(1, -1L), ((int, long))(3, 3L) });
        var c = ZSetModule.add(a, b);
        Assert.Equal(0L, c[1]);
        Assert.Equal(2L, c[2]);
        Assert.Equal(3L, c[3]);
    }

    [Fact]
    public void DistinctIsIdempotent()
    {
        var z = ZSetModule.ofPairs(new[]
        {
            ((int, long))(1, 3L),
            ((int, long))(2, 1L),
            ((int, long))(3, -1L),
        });
        var once = ZSetModule.distinct(z);
        var twice = ZSetModule.distinct(once);
        Assert.Equal(once, twice);
    }
}
