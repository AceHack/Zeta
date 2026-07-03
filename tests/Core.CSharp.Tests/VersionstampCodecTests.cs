// VersionstampCodecTests.cs — Gate T2 byte-lock cross-verify (C# oracle).
// Golden vectors: src/Core.TypeScript/clock/tick-codec-golden-vectors.json
using System;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Core.CSharp.Tests;

public class VersionstampCodecTests
{
    // Golden vectors from tick-codec-golden-vectors.json
    private static readonly (string Name, long Version, string Hex)[] Vectors =
    [
        ("zero",         0L,                    "0000000000000000"),
        ("one",          1L,                    "0000000000000001"),
        ("two",          2L,                    "0000000000000002"),
        ("255",          255L,                  "00000000000000ff"),
        ("256",          256L,                  "0000000000000100"),
        ("65535",        65535L,                "000000000000ffff"),
        ("65536",        65536L,                "0000000000010000"),
        ("1M",           1_000_000L,            "00000000000f4240"),
        ("1B",           1_000_000_000L,        "000000003b9aca00"),
        ("max-int32",    2_147_483_647L,        "000000007fffffff"),
        ("max-int32+1",  2_147_483_648L,        "0000000080000000"),
        ("max-uint32",   4_294_967_295L,        "00000000ffffffff"),
        ("max-uint32+1", 4_294_967_296L,        "0000000100000000"),
        ("1T",           1_000_000_000_000L,    "000000e8d4a51000"),
        ("max-int63",    9_223_372_036_854_775_807L, "7fffffffffffffff"),
        ("typical-tick", 42L,                   "000000000000002a"),
    ];

    [Fact]
    public void EncodeGoldenVectors()
    {
        foreach (var (name, version, hex) in Vectors)
        {
            var encoded = VersionstampCodec.Encode(version);
            var actual = VersionstampCodec.ToHex(encoded);
            Assert.Equal(hex, actual);
        }
    }

    [Fact]
    public void DecodeGoldenVectors()
    {
        foreach (var (name, version, hex) in Vectors)
        {
            var buf = Convert.FromHexString(hex);
            var decoded = VersionstampCodec.Decode(buf);
            Assert.Equal(version, decoded);
        }
    }

    [Fact]
    public void RoundTripGoldenVectors()
    {
        foreach (var (name, version, _) in Vectors)
        {
            var encoded = VersionstampCodec.Encode(version);
            var decoded = VersionstampCodec.Decode(encoded);
            Assert.Equal(version, decoded);
        }
    }
}
