using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

public class DeltaLogEntryCodecTests
{
    private static DynamicValue KeyEnc(string s) => new DynamicValue.String(s);
    private static string KeyDec(DynamicValue dv)
    {
        if (dv is DynamicValue.String s)
        {
            return s.Value;
        }
        throw new ArgumentException($"key not String: {dv.Type}", nameof(dv));
    }

    private static Zeta.Core.DeltaLogEntry<string, ZSet<string>> Entry(long seq, (string, long)[] pairs, (string, string)[] captured)
    {
        var delta = ZSet.OfEntries(pairs);
        var capturedDict = captured.ToDictionary(kv => kv.Item1, kv => kv.Item2, StringComparer.Ordinal);
        return new Zeta.Core.DeltaLogEntry<string, ZSet<string>>(seq, delta, capturedDict);
    }

    private static readonly Zeta.Core.DeltaLogEntry<string, ZSet<string>>[] Samples = new[]
    {
        Entry(0L, Array.Empty<(string, long)>(), Array.Empty<(string, string)>()),
        Entry(1L, new[] { ("a", 1L) }, Array.Empty<(string, string)>()),
        Entry(2L, new[] { ("a", 1L), ("b", -2L), ("c", 3L) }, Array.Empty<(string, string)>()),
        Entry(7L, new[] { ("x", -1L) }, new[] { ("seed", "42"), ("actor", "otto") }),
        Entry(9L, new[] { ("k", 5L) }, new[] { ("b", "2"), ("a", "1"), ("Z", "26") })
    };

    private static void AssertEntriesEqual(Zeta.Core.DeltaLogEntry<string, ZSet<string>> expected, Zeta.Core.DeltaLogEntry<string, ZSet<string>> actual)
    {
        Assert.Equal(expected.Seq, actual.Seq);
        Assert.Equal(expected.Delta, actual.Delta);
        Assert.Equal(expected.Captured.Count, actual.Captured.Count);
        foreach (var kv in expected.Captured)
        {
            Assert.True(actual.Captured.TryGetValue(kv.Key, out var actualVal));
            Assert.Equal(kv.Value, actualVal);
        }
    }

    [Fact]
    public void CborRoundTripLosslesslyForAllSamples()
    {
        foreach (var e in Samples)
        {
            var encoded = DeltaLogEntryCodec.EncodeCbor(KeyEnc, e);
            var decoded = DeltaLogEntryCodec.DecodeCbor(KeyDec, encoded);
            AssertEntriesEqual(e, decoded);
        }
    }

    [Fact]
    public void JsonRoundTripLosslesslyForAllSamples()
    {
        foreach (var e in Samples)
        {
            var res = DeltaLogEntryCodec.EncodeJson(KeyEnc, e);
            Assert.True(res is Result<string, EncodeError>.Ok, $"encodeJson failed for seq {e.Seq}");
            var json = ((Result<string, EncodeError>.Ok)res).Value;
            var decoded = DeltaLogEntryCodec.DecodeJson(KeyDec, json);
            AssertEntriesEqual(e, decoded);
        }
    }

    [Fact]
    public void YamlRoundTripLosslesslyForAllSamples()
    {
        foreach (var e in Samples)
        {
            var res = DeltaLogEntryCodec.EncodeYaml(KeyEnc, e);
            Assert.True(res is Result<string, EncodeError>.Ok, $"encodeYaml failed for seq {e.Seq}");
            var yaml = ((Result<string, EncodeError>.Ok)res).Value;
            var decoded = DeltaLogEntryCodec.DecodeYaml(KeyDec, yaml);
            AssertEntriesEqual(e, decoded);
        }
    }

    [Fact]
    public void CborEncodingIsDeterministic()
    {
        foreach (var e in Samples)
        {
            var a = DeltaLogEntryCodec.EncodeCbor(KeyEnc, e);
            var b = DeltaLogEntryCodec.EncodeCbor(KeyEnc, e);
            Assert.Equal<byte>(a, b);
        }
    }

    [Fact]
    public void CapturedKeysSerializeInOrdinalOrder()
    {
        // Same pairs, different insertion order -> identical canonical bytes (ordinal-sorted keys).
        var e1 = Entry(3L, new[] { ("k", 1L) }, new[] { ("b", "2"), ("a", "1"), ("Z", "26") });
        var e2 = Entry(3L, new[] { ("k", 1L) }, new[] { ("Z", "26"), ("a", "1"), ("b", "2") });

        var bytes1 = DeltaLogEntryCodec.EncodeCbor(KeyEnc, e1);
        var bytes2 = DeltaLogEntryCodec.EncodeCbor(KeyEnc, e2);
        Assert.Equal<byte>(bytes1, bytes2);

        // Verify the dynamic value object has sorted keys: "Z" (90) < "a" (97) < "b" (98)
        var dv = DeltaLogEntryDynamic.ToDynamicValue(KeyEnc, e1);
        Assert.True(dv is DynamicValue.Object, "entry must map to Object");
        var obj = (DynamicValue.Object)dv;

        var capturedField = obj.Pairs.FirstOrDefault(p => string.Equals(p.Key, "captured", StringComparison.Ordinal)).Value;
        Assert.NotNull(capturedField);
        Assert.True(capturedField is DynamicValue.Object, "captured field must be Object");
        var capturedObj = (DynamicValue.Object)capturedField;

        var keys = capturedObj.Pairs.Select(p => p.Key).ToList();
        Assert.Equal(new List<string> { "Z", "a", "b" }, keys);
    }

    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }
        if (dir == null)
        {
            throw new InvalidOperationException("Could not locate repo root (Zeta.sln).");
        }
        return dir.FullName;
    }

    private static Zeta.Core.DeltaLogEntry<string, ZSet<string>> EntryOfJson(JsonElement e)
    {
        var seq = e.GetProperty("seq").GetInt64();
        var deltaPairs = new List<(string, long)>();
        foreach (var pair in e.GetProperty("delta").EnumerateArray())
        {
            var arr = pair.EnumerateArray().ToArray();
            deltaPairs.Add((arr[0].GetString()!, arr[1].GetInt64()));
        }
        var delta = ZSet.OfEntries(deltaPairs);

        var capturedDict = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var p in e.GetProperty("captured").EnumerateObject())
        {
            capturedDict[p.Name] = p.Value.GetString()!;
        }

        return new Zeta.Core.DeltaLogEntry<string, ZSet<string>>(seq, delta, capturedDict);
    }

    [Fact]
    public void GoldenTreatyMatchesTypeScriptJsonVectors()
    {
        var path = Path.Combine(RepoRoot(), "src", "Core.TypeScript", "delta-log-entry", "golden-vectors.json");
        Assert.True(File.Exists(path), $"seed not found at: {path}");

        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var vectors = doc.RootElement.GetProperty("vectors").EnumerateArray().ToArray();
        Assert.True(vectors.Length >= 5, "expected at least 5 golden vectors");

        foreach (var v in vectors)
        {
            var name = v.GetProperty("name").GetString();
            var expectedHex = v.GetProperty("cbor").GetString();
            var e = EntryOfJson(v.GetProperty("entry"));

            var encoded = DeltaLogEntryCodec.EncodeCbor(KeyEnc, e);
            var actualHex = Convert.ToHexString(encoded).ToLowerInvariant();
            Assert.Equal(expectedHex, actualHex);

            var decoded = DeltaLogEntryCodec.DecodeCbor(KeyDec, Convert.FromHexString(expectedHex!));
            AssertEntriesEqual(e, decoded);
        }
    }

    [Fact]
    public void CborEntryCodecIsByteFaithfulAndRoundTrips()
    {
        var codec = new CborEntryCodec<string>(KeyEnc, KeyDec);
        foreach (var e in Samples)
        {
            var expectedBytes = DeltaLogEntryCodec.EncodeCbor(KeyEnc, e);
            var actualBytes = codec.Encode(e);
            Assert.Equal<byte>(expectedBytes, actualBytes);

            var rt = codec.Decode(actualBytes);
            AssertEntriesEqual(e, rt);
        }
    }

    [Fact]
    public void YamlEntryCodecIsByteFaithfulAndRoundTrips()
    {
        var codec = new YamlEntryCodec<string>(KeyEnc, KeyDec);
        foreach (var e in Samples)
        {
            var expectedBytes = System.Text.Encoding.UTF8.GetBytes(((Result<string, EncodeError>.Ok)DeltaLogEntryCodec.EncodeYaml(KeyEnc, e)).Value);
            var actualBytes = codec.Encode(e);
            Assert.Equal<byte>(expectedBytes, actualBytes);

            var rt = codec.Decode(actualBytes);
            AssertEntriesEqual(e, rt);
        }
    }
}
