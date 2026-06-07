using System;
using System.Text;
using Xunit;
using Zeta.Core;
using Zeta.Core.CSharp.Blake3;

namespace Zeta.Tests.CSharp.Blake3;

public class Blake3Tests
{
    [Fact]
    public void EmptyString256HashMatchesTreaty()
    {
        var h = ContentHash256.OfBytes(Array.Empty<byte>());
        Assert.Equal("af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262", h.ToHex());
    }

    [Fact]
    public void EmptyString128AddressMatchesTreaty()
    {
        var h256 = ContentHash256.OfBytes(Array.Empty<byte>());
        var h128 = ContentHash256.ToContentAddress128(h256);
        Assert.Equal("49c9dc36ea4d40a0a6a1f9f5b94913af", h128.ToHex());
    }

    [Fact]
    public void Blake3HasherAdapterMatchesEmptyStringTreaty()
    {
        var adapterHash = Blake3Hasher.Instance.Hash(Array.Empty<byte>());
        Assert.Equal("49c9dc36ea4d40a0a6a1f9f5b94913af", adapterHash.ToHex());
    }

    [Fact]
    public void EqualityOnContentHash256Works()
    {
        var raw1 = new byte[32];
        raw1[0] = 42;
        var h1 = new ContentHash256(raw1);

        var raw2 = new byte[32];
        raw2[0] = 42;
        var h2 = new ContentHash256(raw2);

        var raw3 = new byte[32];
        raw3[0] = 43;
        var h3 = new ContentHash256(raw3);

        Assert.Equal(h1, h2);
        Assert.NotEqual(h1, h3);
        Assert.Equal(h1.GetHashCode(), h2.GetHashCode());
    }
}
