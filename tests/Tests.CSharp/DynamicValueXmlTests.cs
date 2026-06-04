using System.Collections.Immutable;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// DynamicValue cross-language canonical XML byte-lock — the C# oracle grounded against the shared
/// seed (<c>src/Core.TypeScript/dynamic-value/golden-vectors-xml.json</c>). Proves encode AGREES
/// (<c>ToCanonicalXml(value) == xml</c>) and decode round-trips (<c>FromCanonicalXml(xml) == value</c>)
/// for every locked vector, plus never-collapse distinctness and canonicality rejection. Locks all
/// eight shapes: null/bool/int/str/float/bytes/arr/obj. "The compilers don't lie."
/// </summary>
public class DynamicValueXmlTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(DynamicValueXmlTests).Assembly.Location)!);
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

    /// <summary>Build a DynamicValue from the seed's language-neutral tagged form { t, v }.</summary>
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
                // v is the IEEE-754 f64 bit pattern (16 hex, big-endian) — mirrors the CBOR golden test.
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
                throw new InvalidOperationException($"unsupported tag in seed: {tag}");
        }
    }

    private static JsonElement[] LoadVectors()
    {
        string path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "dynamic-value", "golden-vectors-xml.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        JsonElement[] vectors = doc.RootElement.GetProperty("vectors")
            .EnumerateArray().Select(e => e.Clone()).ToArray();
        Assert.NotEmpty(vectors);
        return vectors;
    }

    [Fact]
    public void EncodeAgreesWithSeedXml()
    {
        var failures = new List<string>();
        foreach (JsonElement v in LoadVectors())
        {
            string name = Str(v, "name");
            DynamicValue value = BuildValue(v.GetProperty("value"));
            string expected = Str(v, "xml");

            switch (DynamicValuesXml.ToCanonicalXml(value))
            {
                case Result<string, EncodeError>.Ok ok:
                    if (!string.Equals(ok.Value, expected, StringComparison.Ordinal))
                    {
                        failures.Add($"{name}: expected {expected} but got {ok.Value}");
                    }

                    break;
                case Result<string, EncodeError>.Err err:
                    failures.Add($"{name}: expected {expected} but got Err {err.Error}");
                    break;
                default:
                    failures.Add($"{name}: unexpected Result shape");
                    break;
            }
        }

        Assert.Empty(failures);
    }

    [Fact]
    public void DecodeRoundTripsSeedXml()
    {
        var failures = new List<string>();
        foreach (JsonElement v in LoadVectors())
        {
            string name = Str(v, "name");
            DynamicValue expected = BuildValue(v.GetProperty("value"));
            string xml = Str(v, "xml");

            switch (DynamicValuesXml.FromCanonicalXml(xml))
            {
                case Result<DynamicValue, DecodeError>.Ok ok:
                    if (!ok.Value.Equals(expected))
                    {
                        failures.Add($"{name}: decoded value mismatch for {xml}");
                    }

                    break;
                case Result<DynamicValue, DecodeError>.Err err:
                    failures.Add($"{name}: expected value but got Err {err.Error} for {xml}");
                    break;
                default:
                    failures.Add($"{name}: unexpected Result shape");
                    break;
            }
        }

        Assert.Empty(failures);
    }

    [Fact]
    public void NeverCollapseGivesFiveDistinctXmlStrings()
    {
        string nullXml = Encode(new DynamicValue.Null());
        string emptyArr = Encode(new DynamicValue.Array(ImmutableArray<DynamicValue>.Empty));
        string emptyObj = Encode(new DynamicValue.Object(ImmutableArray<KeyValuePair<string, DynamicValue>>.Empty));
        string emptyStr = Encode(new DynamicValue.String(string.Empty));
        string emptyBytes = Encode(new DynamicValue.Bytes(ImmutableArray<byte>.Empty));

        var distinct = new HashSet<string>(StringComparer.Ordinal) { nullXml, emptyArr, emptyObj, emptyStr, emptyBytes };
        Assert.Equal(5, distinct.Count);
        Assert.Equal("<null/>", nullXml);
        Assert.Equal("<arr></arr>", emptyArr);
        Assert.Equal("<obj></obj>", emptyObj);
        Assert.Equal("<str></str>", emptyStr);
        Assert.Equal("<bytes></bytes>", emptyBytes);
    }

    [Fact]
    public void NaNFloatRoundTripsByBitPattern()
    {
        // XML preserves the EXACT f64 bit pattern (unlike CBOR, which collapses all NaNs to f97e00),
        // so the seed's canonical NaN is 7ff8000000000000. double.NaN != double.NaN, so compare BIT
        // PATTERNS (mirrors the CBOR golden test's NaN handling) rather than value equality.
        const ulong canonicalNaNBits = 0x7ff8000000000000UL;
        double nan = BitConverter.UInt64BitsToDouble(canonicalNaNBits);
        Assert.True(double.IsNaN(nan));

        const string xml = "<float>7ff8000000000000</float>";
        Assert.Equal(xml, Encode(new DynamicValue.Float(nan)));

        var ok = Assert.IsType<Result<DynamicValue, DecodeError>.Ok>(DynamicValuesXml.FromCanonicalXml(xml));
        var f = Assert.IsType<DynamicValue.Float>(ok.Value);
        Assert.Equal(canonicalNaNBits, (ulong)BitConverter.DoubleToInt64Bits(f.Value));
    }

    [Theory]
    [InlineData("<arr/>")]
    [InlineData("<str/>")]
    [InlineData("<int>01</int>")]
    public void NonCanonicalXmlIsRejected(string xml)
    {
        Result<DynamicValue, DecodeError> result = DynamicValuesXml.FromCanonicalXml(xml);
        var err = Assert.IsType<Result<DynamicValue, DecodeError>.Err>(result);
        Assert.Equal(DecodeError.NonCanonical, err.Error);
    }

    private static string Encode(DynamicValue value)
    {
        var ok = Assert.IsType<Result<string, EncodeError>.Ok>(DynamicValuesXml.ToCanonicalXml(value));
        return ok.Value;
    }
}
