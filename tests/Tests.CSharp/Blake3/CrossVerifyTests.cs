using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.Json;
using Xunit;
using YamlDotNet.Serialization;
using Zeta.Core.CSharp.Blake3;

namespace Zeta.Tests.CSharp.Blake3;

public class CrossVerifyTests
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(CrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new DirectoryNotFoundException("Could not locate repo root (Zeta.sln).");
    }

    public class VectorsFile
    {
        [YamlMember(Alias = "version")]
        public int Version { get; set; }

        [YamlMember(Alias = "description")]
        public string Description { get; set; } = string.Empty;

        [YamlMember(Alias = "vectors")]
        public IList<YamlVector> Vectors { get; set; } = new List<YamlVector>();
    }

    public class YamlVector
    {
        [YamlMember(Alias = "id")]
        public string Id { get; set; } = string.Empty;

        [YamlMember(Alias = "input_utf8")]
        public string? InputUtf8 { get; set; }

        [YamlMember(Alias = "input_hex")]
        public string? InputHex { get; set; }

        [YamlMember(Alias = "expected_hex")]
        public string ExpectedHex { get; set; } = string.Empty;
    }

    [Fact]
    public void CrossVerifyBlake3VectorsMatchExpected()
    {
        var root = RepoRoot();
        var yamlPath = Path.Combine(root, "tests", "cross-verification", "blake3-256", "vectors.yaml");
        Assert.True(File.Exists(yamlPath), $"vectors.yaml not found: {yamlPath}");

        var yamlText = File.ReadAllText(yamlPath);
        var deserializer = new DeserializerBuilder().Build();
        var data = deserializer.Deserialize<VectorsFile>(yamlText);

        var results = new Dictionary<string, string>(StringComparer.Ordinal);
        int mismatches = 0;

        foreach (var v in data.Vectors)
        {
            byte[] bytes;
            if (v.InputUtf8 != null)
            {
                bytes = Encoding.UTF8.GetBytes(v.InputUtf8);
            }
            else if (v.InputHex != null)
            {
                bytes = Convert.FromHexString(v.InputHex);
            }
            else
            {
                throw new InvalidOperationException($"Vector {v.Id} has neither input_utf8 nor input_hex");
            }

            var hash = ContentHash256.OfBytes(bytes);
            var hex = hash.ToHex();
            results[v.Id] = hex;

            if (!string.Equals(hex, v.ExpectedHex, StringComparison.Ordinal))
            {
                mismatches++;
            }
        }

        var json = JsonSerializer.Serialize(results, JsonOptions).Replace("\r\n", "\n", StringComparison.Ordinal);
        var outputPath = Path.Combine(root, "tests", "cross-verification", "blake3-256", "cs-output.json");
        File.WriteAllText(outputPath, json);

        Assert.Equal(0, mismatches);
    }
}
