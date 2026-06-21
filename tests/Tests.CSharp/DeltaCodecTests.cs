using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

public class DeltaCodecTests
{
    private static DynamicValue KeyEnc(int i) => new DynamicValue.Int(i);
    private static int KeyDec(DynamicValue dv)
    {
        if (dv is DynamicValue.Int integer)
        {
            return (int)integer.Value;
        }
        throw new ArgumentException($"keyDec: expected Int, got {dv.Type}", nameof(dv));
    }

    private static readonly ZSet<int> Sample = ZSet.OfEntries(new[]
    {
        (1, 1L),
        (2, 3L),
        (5, -2L),
        (9, 1L)
    });

    [Fact]
    public void CborDeltaCodecRoundTripsLosslessly()
    {
        var codec = new CborDeltaCodec<int>(KeyEnc, KeyDec);
        var bytes = codec.Encode(Sample);
        var decoded = codec.Decode(bytes);
        Assert.Equal(Sample, decoded);
    }

    [Fact]
    public void ZSetDynamicMappingRoundTrips()
    {
        var dv = ZSetDynamic.ToDynamicValue(KeyEnc, Sample);
        var decoded = ZSetDynamic.OfDynamicValue(KeyDec, dv);
        Assert.Equal(Sample, decoded);
    }

    [Fact]
    public void CborEncodingIsDeterministic()
    {
        var codec = new CborDeltaCodec<int>(KeyEnc, KeyDec);
        var a = codec.Encode(Sample);
        var b = codec.Encode(Sample);
        Assert.Equal<byte>(a, b);
    }

    [Fact]
    public void CborDeltaCodecMatchesByteLockedGoldenVectors()
    {
        var codec = new CborDeltaCodec<int>(KeyEnc, KeyDec);
        string Hex(byte[] b) => Convert.ToHexString(b).ToLowerInvariant();

        var vectors = new[]
        {
            ("empty", Array.Empty<(int, long)>(), "80"),
            ("single", new[] { (1, 1L) }, "81820101"),
            ("multi", new[] { (1, 1L), (2, 3L) }, "82820101820203"),
            ("retraction", new[] { (5, -2L), (7, 1L) }, "82820521820701")
        };

        foreach (var (name, pairs, expected) in vectors)
        {
            var z = ZSet.OfEntries(pairs);
            var encoded = codec.Encode(z);
            Assert.Equal(expected, Hex(encoded));

            var decoded = codec.Decode(Convert.FromHexString(expected));
            Assert.Equal(z, decoded);
        }
    }
}
