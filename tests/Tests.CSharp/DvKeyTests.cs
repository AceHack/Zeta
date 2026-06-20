using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

public class DvKeyTests
{
    private static DvKey Row(params (string Key, DynamicValue Value)[] kvs)
    {
        var pairs = ImmutableArray.CreateBuilder<KeyValuePair<string, DynamicValue>>();
        foreach (var kv in kvs)
        {
            pairs.Add(new KeyValuePair<string, DynamicValue>(kv.Key, kv.Value));
        }
        return DvKey.OfValue(new DynamicValue.Object(pairs.ToImmutable()));
    }

    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(DvKeyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }
        return dir?.FullName ?? throw new DirectoryNotFoundException("Could not locate repo root (Zeta.sln).");
    }

    private static string Str(JsonElement el, string prop) =>
        el.GetProperty(prop).GetString()
            ?? throw new InvalidOperationException($"fixture property '{prop}' is not a string");

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
                            string key = parts[0].GetString() ?? "";
                            return new KeyValuePair<string, DynamicValue>(key, BuildValue(parts[1]));
                        })
                        .ToImmutableArray());
            default:
                throw new InvalidOperationException($"unsupported tag: {tag}");
        }
    }

    [Fact]
    public void EqualDynamicValueRowsGiveEqualKeysAndDistinctGiveDistinctKeys()
    {
        var a = Row(("id", new DynamicValue.Int(1L)), ("name", new DynamicValue.String("x")));
        var a2 = Row(("id", new DynamicValue.Int(1L)), ("name", new DynamicValue.String("x")));
        var b = Row(("id", new DynamicValue.Int(2L)), ("name", new DynamicValue.String("x")));

        Assert.Equal(a, a2);
        Assert.Equal(a.GetHashCode(), a2.GetHashCode());
        Assert.NotEqual(a, b);
    }

    [Fact]
    public void LexicographicalComparisonComparesCanonicalBytes()
    {
        var a = Row(("id", new DynamicValue.Int(1L)));
        var b = Row(("id", new DynamicValue.Int(2L)));

        Assert.True(a.CompareTo(b) < 0);
        Assert.True(b.CompareTo(a) > 0);
        Assert.Equal(0, a.CompareTo(a));
    }

    [Fact]
    public void CrossVerifyDvKeyVectorsMatchExpected()
    {
        var root = RepoRoot();
        var jsonPath = Path.Combine(root, "tests", "cross-verification", "dv-key-cloud-events", "vectors.json");
        Assert.True(File.Exists(jsonPath), $"vectors.json not found: {jsonPath}");

        using var doc = JsonDocument.Parse(File.ReadAllText(jsonPath));
        var vectors = doc.RootElement.GetProperty("dv_key_vectors").EnumerateArray();

        foreach (var v in vectors)
        {
            var val = BuildValue(v.GetProperty("value"));
            var expectedCborHex = Str(v, "expected_cbor_hex");
            var expectedHash = Str(v, "expected_hash");

            var key = DvKey.OfValue(val);
            var actualCborHex = Convert.ToHexString(key.Canonical).ToLowerInvariant();
            var actualHash = key.GetHashCode().ToString(CultureInfo.InvariantCulture);

            Assert.Equal(expectedCborHex, actualCborHex);
            Assert.Equal(expectedHash, actualHash);
        }
    }
}
