using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;
using Zeta.Core.CSharp.Yaml;

namespace Zeta.Tests.CSharp.Algebra;

/// <summary>
/// ZSetMerkle cross-language conformance — the C# native oracle for computing Merkle root over a Z-set.
/// Replays the SHARED golden vectors from <c>tests/cross-verification/zset-merkle/vectors.yaml</c>
/// and asserts that the computed Merkle root matches the reference F#/TS/Rust root.
/// </summary>
public class ZSetMerkleCrossVerifyTests
{
    private class ZSetMerkleVector
    {
        public string Id { get; set; } = "";
        public List<(string Key, long Weight)> Entries { get; set; } = new();
        public string ExpectedHex { get; set; } = "";
    }

    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(ZSetMerkleCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName
            ?? throw new InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location.");
    }

    private static YamlValue GetField(IReadOnlyList<KeyValuePair<string, YamlValue>> entries, string key)
    {
        foreach (var kvp in entries)
            if (string.Equals(kvp.Key, key, StringComparison.Ordinal))
                return kvp.Value;
        return YamlValue.YNull.Instance;
    }

    private static List<ZSetMerkleVector> ParseYaml(string yamlText)
    {
        ParseResult parsed = YamlDom.Parse(yamlText);
        if (!parsed.Ok)
            throw new InvalidOperationException($"YAML parse failed: {parsed.Feedback}");

        var top = parsed.Value as YamlValue.YMap;
        if (top == null) throw new InvalidOperationException("Expected Map root");

        var vectorsSeq = GetField(top.Entries, "vectors") as YamlValue.YSeq;
        if (vectorsSeq == null) throw new InvalidOperationException("Expected 'vectors' sequence");

        var list = new List<ZSetMerkleVector>();
        foreach (var item in vectorsSeq.Items)
        {
            var m = item as YamlValue.YMap;
            if (m == null) throw new InvalidOperationException("Expected Vector Map");

            var id = (GetField(m.Entries, "id") as YamlValue.YStr).Value;
            var expectedHex = (GetField(m.Entries, "expected_hex") as YamlValue.YStr).Value;

            var entriesSeq = GetField(m.Entries, "entries") as YamlValue.YSeq;
            var entries = new List<(string Key, long Weight)>();
            if (entriesSeq != null)
            {
                foreach (var entryItem in entriesSeq.Items)
                {
                    var em = entryItem as YamlValue.YMap;
                    var k = (GetField(em.Entries, "key") as YamlValue.YStr).Value;
                    var w = (GetField(em.Entries, "weight") as YamlValue.YInt).Value;
                    entries.Add((k, w));
                }
            }
            list.Add(new ZSetMerkleVector { Id = id, Entries = entries, ExpectedHex = expectedHex });
        }
        return list;
    }

    [Fact]
    public void ZSetMerkleReplayMatchesGoldenVectors()
    {
        var root = RepoRoot();
        var path = Path.Join(root, "tests", "cross-verification", "zset-merkle", "vectors.yaml");
        var yamlText = File.ReadAllText(path);
        var vectors = ParseYaml(yamlText);

        var cmp = Collation.UnicodeCodePointComparer.Ordinal;
        var results = new Dictionary<string, string>(StringComparer.Ordinal);

        foreach (var v in vectors)
        {
            var z = ZSet.OfEntries(v.Entries, cmp);
            var gotRoot = ZSetMerkle.Root(s => Encoding.UTF8.GetBytes(s), z);
            var hex = gotRoot.ToHex();

            results[v.Id] = hex;
            Assert.Equal(v.ExpectedHex, hex);
        }

        var outputPath = Path.Join(root, "tests", "cross-verification", "zset-merkle", "cs-output.json");
        var json = JsonSerializer.Serialize(results, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(outputPath, json + "\n");
    }
}
