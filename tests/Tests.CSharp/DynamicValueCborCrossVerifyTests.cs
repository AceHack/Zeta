using System.Collections.Immutable;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// DynamicValue canonical-CBOR byte-lock — the C# oracle agrees on the shared seed
/// (<c>src/Core.TypeScript/dynamic-value/golden-vectors-cbor.json</c>). CBOR is the TOTAL form
/// (all 8 shapes), so this is where Float (RFC 8949 §4.2.2 shortest-float) and Bytes
/// (major-type-2) finally lock — the two cases canonical JSON deferred. The seed was generated +
/// RFC-8949-Appendix-A-anchored independently (tools-side); <see cref="FloatMatchesRfc8949AppendixA"/>
/// re-anchors the float logic against the RFC directly so the lock is not circular.
/// "The compilers don't lie."
/// </summary>
public class DynamicValueCborCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(DynamicValueCborCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName
            ?? throw new InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location.");
    }

    private static string Str(JsonElement el, string prop) =>
        el.GetProperty(prop).GetString()
            ?? throw new InvalidOperationException($"fixture property '{prop}' is not a string: {el.GetRawText()}");

    private static string Hex(byte[] bytes) => Convert.ToHexString(bytes).ToLowerInvariant();

    /// <summary>Build a DynamicValue from the seed's language-neutral tagged form { t, v }. Float v is
    /// the IEEE-754 f64 bit pattern (16 hex, big-endian) for exactness; bytes v is a hex string; int v
    /// is a decimal string.</summary>
    private static DynamicValue BuildValue(JsonElement el)
    {
        string tag = Str(el, "t");
        switch (tag)
        {
            case "null":
                return new DynamicValue.Null();
            case "bool":
                return new DynamicValue.Bool(el.GetProperty("v").GetBoolean());
            case "int":
                return new DynamicValue.Int(long.Parse(Str(el, "v"), CultureInfo.InvariantCulture));
            case "float":
                return new DynamicValue.Float(
                    BitConverter.UInt64BitsToDouble(
                        ulong.Parse(Str(el, "v"), NumberStyles.HexNumber, CultureInfo.InvariantCulture)));
            case "str":
                return new DynamicValue.String(Str(el, "v"));
            case "bytes":
                return new DynamicValue.Bytes(Convert.FromHexString(Str(el, "v")).ToImmutableArray());
            case "arr":
                return new DynamicValue.Array(
                    el.GetProperty("v").EnumerateArray().Select(BuildValue).ToImmutableArray());
            case "obj":
                return new DynamicValue.Object(
                    el.GetProperty("v").EnumerateArray()
                        .Select(pair =>
                        {
                            JsonElement[] parts = pair.EnumerateArray().ToArray();
                            if (parts.Length != 2)
                            {
                                throw new InvalidOperationException(
                                    $"seed object pair must have exactly 2 elements [key, value], got {parts.Length}");
                            }

                            string key = parts[0].GetString()
                                ?? throw new InvalidOperationException("object key is not a string");
                            return new KeyValuePair<string, DynamicValue>(key, BuildValue(parts[1]));
                        })
                        .ToImmutableArray());
            default:
                throw new InvalidOperationException($"unsupported tag in CBOR seed: {tag}");
        }
    }

    [Fact]
    public void CSharpCborEncoderAgreesWithSeed()
    {
        string path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "dynamic-value", "golden-vectors-cbor.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        JsonElement[] vectors = doc.RootElement.GetProperty("vectors").EnumerateArray().ToArray();
        Assert.NotEmpty(vectors);

        var failures = new List<string>();
        foreach (JsonElement v in vectors)
        {
            string name = Str(v, "name");
            DynamicValue value = BuildValue(v.GetProperty("value"));
            string expected = Str(v, "cbor");
            string actual = Hex(DynamicValues.ToCanonicalCborOk(value));
            if (!string.Equals(actual, expected, StringComparison.Ordinal))
            {
                failures.Add($"{name}: expected {expected} but got {actual}");
            }
        }

        Assert.Empty(failures);
    }

    // Independent RFC 8949 Appendix A anchor (anti-circularity): these canonical bytes come straight
    // from the RFC, not from our encoder or the seed. double.{Positive,Negative}Infinity / NaN / -0.0
    // are not compile-time constants (or need sign care), so they are separate facts below.
    [Theory]
    [InlineData(0.0, "f90000")]
    [InlineData(1.0, "f93c00")]
    [InlineData(1.5, "f93e00")]
    [InlineData(65504.0, "f97bff")]
    [InlineData(100000.0, "fa47c35000")]
    [InlineData(3.4028234663852886e38, "fa7f7fffff")]
    [InlineData(1.0e300, "fb7e37e43c8800759c")]
    [InlineData(5.960464477539063e-8, "f90001")]
    [InlineData(0.00006103515625, "f90400")]
    [InlineData(-4.0, "f9c400")]
    [InlineData(-4.1, "fbc010666666666666")]
    public void FloatMatchesRfc8949AppendixA(double value, string expectedHex) =>
        Assert.Equal(expectedHex, Hex(DynamicValues.ToCanonicalCborOk(new DynamicValue.Float(value))));

    [Fact]
    public void PositiveInfinityIsHalf() =>
        Assert.Equal("f97c00", Hex(DynamicValues.ToCanonicalCborOk(new DynamicValue.Float(double.PositiveInfinity))));

    [Fact]
    public void NegativeInfinityIsHalf() =>
        Assert.Equal("f9fc00", Hex(DynamicValues.ToCanonicalCborOk(new DynamicValue.Float(double.NegativeInfinity))));

    [Fact]
    public void NanCanonicalizesToQuietHalf() =>
        Assert.Equal("f97e00", Hex(DynamicValues.ToCanonicalCborOk(new DynamicValue.Float(double.NaN))));

    [Fact]
    public void NegativeZeroPreservesSign() =>
        Assert.Equal("f98000", Hex(DynamicValues.ToCanonicalCborOk(new DynamicValue.Float(-0.0))));
}
