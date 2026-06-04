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
/// for every locked vector, plus never-collapse distinctness and canonicality rejection. v1 locks
/// null/bool/int/str/arr/obj; Float + Bytes are DEFERRED. "The compilers don't lie."
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
            case "str":
                return new DynamicValue.String(Str(el, "v"));
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
                throw new InvalidOperationException($"unsupported tag in v1 seed: {tag}");
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
    public void NeverCollapseGivesFourDistinctXmlStrings()
    {
        string nullXml = Encode(new DynamicValue.Null());
        string emptyArr = Encode(new DynamicValue.Array(ImmutableArray<DynamicValue>.Empty));
        string emptyObj = Encode(new DynamicValue.Object(ImmutableArray<KeyValuePair<string, DynamicValue>>.Empty));
        string emptyStr = Encode(new DynamicValue.String(string.Empty));

        var distinct = new HashSet<string>(StringComparer.Ordinal) { nullXml, emptyArr, emptyObj, emptyStr };
        Assert.Equal(4, distinct.Count);
        Assert.Equal("<null/>", nullXml);
        Assert.Equal("<arr></arr>", emptyArr);
        Assert.Equal("<obj></obj>", emptyObj);
        Assert.Equal("<str></str>", emptyStr);
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
