using System;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

public sealed class CollationTests
{
    [Fact]
    public void BinaryDefaultIsCodePointOrder()
    {
        Assert.Equal("binary", Collation.DefaultName);
        Assert.Same(Collation.Binary, Collation.ByNameOrDefault(Collation.DefaultName));
        Assert.True(Collation.Binary.Compare("�", "𠜎") < 0);
        Assert.True(Collation.ByNameOrDefault("BINARY").Compare("�", "𠜎") < 0);
    }

    [Fact]
    public void OrdinalNameUsesCodePointTreaty()
    {
        Assert.Same(Collation.Binary, Collation.ByNameOrDefault("ordinal"));
        Assert.True(Collation.ByNameOrDefault("ordinal").Compare("�", "𠜎") < 0);
    }

    [Fact]
    public void ForKeyStringUsesBinaryDefault()
    {
        var comparer = Collation.ForKey<string>();

        Assert.True(comparer.Compare("B", "a") < 0);
        Assert.True(comparer.Compare("�", "𠜎") < 0);
        Assert.Equal(0, comparer.Compare("abc", "abc"));
    }
}
