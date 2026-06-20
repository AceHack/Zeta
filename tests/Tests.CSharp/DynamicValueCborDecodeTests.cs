using System.Collections.Immutable;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// DynamicValue canonical-CBOR DECODE byte-lock — <see cref="DynamicValues.FromCanonicalCbor"/> is
/// the inverse of <see cref="DynamicValues.ToCanonicalCbor"/>, completing the byte↔value bijection.
/// Primary check is the round-trip <c>ToCanonicalCbor(FromCanonicalCbor(b)) == b</c> over the shared
/// seed (sound because canonical encode is bijective, and it sidesteps NaN/-0.0 value-equality
/// traps — NaN re-encodes to f97e00 regardless of bit pattern). A direct structural
/// <c>decode == value</c> check runs too (C# DynamicValue has structural equality). "The compilers
/// don't lie."
/// </summary>
public class DynamicValueCborDecodeTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(DynamicValueCborDecodeTests).Assembly.Location)!);
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
    public void CSharpDecodeRoundTripsSeed()
    {
        string path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "dynamic-value", "golden-vectors-cbor.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        JsonElement[] vectors = doc.RootElement.GetProperty("vectors").EnumerateArray().ToArray();
        Assert.NotEmpty(vectors);

        var failures = new List<string>();
        foreach (JsonElement v in vectors)
        {
            string name = Str(v, "name");
            byte[] cbor = Convert.FromHexString(Str(v, "cbor"));

            switch (DynamicValues.FromCanonicalCbor(cbor))
            {
                case Result<DynamicValue, DecodeError>.Ok ok:
                    // (a) byte round-trip: re-encoding the decoded value reproduces the canonical bytes
                    string reEncoded = Hex(DynamicValues.ToCanonicalCborOk(ok.Value));
                    if (!string.Equals(reEncoded, Str(v, "cbor"), StringComparison.Ordinal))
                    {
                        failures.Add($"{name}: re-encode {reEncoded} != {Str(v, "cbor")}");
                    }

                    // (b) structural: the decoded value equals the expected value
                    DynamicValue expected = BuildValue(v.GetProperty("value"));
                    if (!ok.Value.Equals(expected))
                    {
                        failures.Add($"{name}: decoded value != expected");
                    }

                    break;
                case Result<DynamicValue, DecodeError>.Err err:
                    failures.Add($"{name}: decode failed with {err.Error}");
                    break;
                default:
                    failures.Add($"{name}: unexpected Result shape");
                    break;
            }
        }

        Assert.Empty(failures);
    }

    [Theory]
    [InlineData(new byte[] { }, DecodeError.UnexpectedEnd)] // empty
    [InlineData(new byte[] { 0x18 }, DecodeError.UnexpectedEnd)] // uint8 head, payload truncated
    [InlineData(new byte[] { 0x43, 0x01, 0x02 }, DecodeError.UnexpectedEnd)] // 3-byte bstr, only 2 present
    [InlineData(new byte[] { 0xf6, 0x00 }, DecodeError.TrailingData)] // null + extra byte
    [InlineData(new byte[] { 0xc0, 0x00 }, DecodeError.Unsupported)] // tag (major 6)
    [InlineData(new byte[] { 0xf7 }, DecodeError.Unsupported)] // undefined (major 7, ai 23)
    [InlineData(new byte[] { 0x9f }, DecodeError.Unsupported)] // indefinite-length array (ai 31)
    [InlineData(new byte[] { 0x18, 0x00 }, DecodeError.NonCanonical)] // non-shortest int (0 as uint8)
    [InlineData(new byte[] { 0x61, 0xff }, DecodeError.NonCanonical)] // text string with invalid UTF-8 (silent U+FFFD repair)
    [InlineData(new byte[] { 0xfb, 0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 }, DecodeError.NonCanonical)] // 1.0 as float64 (non-shortest float)
    [InlineData(new byte[] { 0x81, 0x18, 0x00 }, DecodeError.NonCanonical)] // non-canonical nested in an array
    [InlineData(new byte[] { 0x18, 0x17 }, DecodeError.NonCanonical)] // 23 as uint8 (non-shortest arg width)
    [InlineData(new byte[] { 0xf9, 0x7e, 0x01 }, DecodeError.NonCanonical)] // float16 NaN, non-canonical payload (≠ 0x7e00)
    [InlineData(new byte[] { 0xfa, 0x7f, 0xc0, 0x00, 0x00 }, DecodeError.NonCanonical)] // float32 NaN (canonicalizes to f97e00)
    [InlineData(new byte[] { 0xfa, 0x3f, 0x80, 0x00, 0x00 }, DecodeError.NonCanonical)] // 1.0 as float32 (fits float16)
    public void DecodeRejectsMalformed(byte[] bytes, DecodeError expected)
    {
        var result = DynamicValues.FromCanonicalCbor(bytes);
        var err = Assert.IsType<Result<DynamicValue, DecodeError>.Err>(result);
        Assert.Equal(expected, err.Error);
    }

    [Fact]
    public void DecodeRejectsNonTextMapKey()
    {
        // a1 (map, 1 pair) 00 (int key 0) 00 (int value 0) — our objects require text keys
        var result = DynamicValues.FromCanonicalCbor([0xa1, 0x00, 0x00]);
        var err = Assert.IsType<Result<DynamicValue, DecodeError>.Err>(result);
        Assert.Equal(DecodeError.NonTextKey, err.Error);
    }
}
