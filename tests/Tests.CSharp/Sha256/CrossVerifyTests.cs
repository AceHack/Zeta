using System.IO;
using System.Text;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp.Yaml;
using Sha256Lib = Zeta.Core.CSharp.Sha256.Sha256;

namespace Zeta.Tests.CSharp.Sha256;

/// <summary>
/// Reads tests/cross-verification/sha256/vectors.yaml via our YAML port,
/// computes SHA-256 for each vector, asserts against the canonical expected_hex,
/// and writes cs-output.json for the compare.ts milestone check.
/// </summary>
public class CrossVerifyTests
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    // --- YamlValue navigation helpers (own-the-interface: route through our port) ---

    private static IReadOnlyList<KeyValuePair<string, YamlValue>> MapEntries(YamlValue v, string ctx) =>
        v is YamlValue.YMap m
            ? m.Entries
            : throw new InvalidOperationException($"expected Map at {ctx}, got {v.GetType().Name}");

    private static YamlValue Field(IReadOnlyList<KeyValuePair<string, YamlValue>> entries, string key, string ctx)
    {
        foreach (var kvp in entries)
            if (string.Equals(kvp.Key, key, StringComparison.Ordinal))
                return kvp.Value;
        throw new InvalidOperationException($"missing field '{key}' at {ctx}");
    }

    private static bool TryField(IReadOnlyList<KeyValuePair<string, YamlValue>> entries, string key, out YamlValue value)
    {
        foreach (var kvp in entries)
        {
            if (string.Equals(kvp.Key, key, StringComparison.Ordinal))
            {
                value = kvp.Value;
                return true;
            }
        }
        value = YamlValue.YNull.Instance;
        return false;
    }

    private static string AsStr(YamlValue v, string ctx) =>
        v is YamlValue.YStr s
            ? s.Value
            : throw new InvalidOperationException($"expected Str at {ctx}, got {v.GetType().Name}");

    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(CrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
            dir = dir.Parent;
        return dir?.FullName
            ?? throw new InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location.");
    }

    [Fact]
    public void CrossVerifyFiveVectorsMatchCanonicalHex()
    {
        var root = RepoRoot();
        var yamlPath = Path.Join(root, "tests", "cross-verification", "sha256", "vectors.yaml");
        var yamlText = File.ReadAllText(yamlPath);

        // Own-the-interface: parse through our YAML port (YamlDom.Parse), not YamlDotNet.
        ParseResult parsed = YamlDom.Parse(yamlText);
        if (!parsed.Ok)
            throw new InvalidOperationException($"YAML port declined vectors.yaml: {parsed.Feedback}");

        var top = MapEntries(parsed.Value!, "<root>");
        if (Field(top, "vectors", "<root>") is not YamlValue.YSeq seq)
            throw new InvalidOperationException("expected Seq at vectors");

        var results = new Dictionary<string, string>(StringComparer.Ordinal);
        int mismatches = 0;

        for (int i = 0; i < seq.Items.Count; i++)
        {
            var ctx = $"vectors[{i}]";
            var m = MapEntries(seq.Items[i], ctx);

            var id = AsStr(Field(m, "id", ctx), $"{ctx}.id");
            var expectedHex = AsStr(Field(m, "expected_hex", ctx), $"{ctx}.expected_hex");

            // Determine input bytes: input_utf8 (empty string is valid) or input_hex.
            byte[] inputBytes;
            if (TryField(m, "input_utf8", out var utf8Val))
            {
                inputBytes = Encoding.UTF8.GetBytes(AsStr(utf8Val, $"{ctx}.input_utf8"));
            }
            else if (TryField(m, "input_hex", out var hexVal))
            {
                inputBytes = Convert.FromHexString(AsStr(hexVal, $"{ctx}.input_hex"));
            }
            else
            {
                throw new InvalidOperationException($"vector '{id}' has neither input_utf8 nor input_hex");
            }

            var hex = Sha256Lib.HashHex(inputBytes);
            results[id] = hex;

            if (!string.Equals(hex, expectedHex, StringComparison.Ordinal))
            {
                mismatches++;
                Console.Error.WriteLine($"MISMATCH {id}: got={hex} expected={expectedHex}");
            }
        }

        // Write cs-output.json for compare.ts.
        // Use UTF-8 without BOM, LF line endings (cross-platform consistency).
        var outputPath = Path.Join(root, "tests", "cross-verification", "sha256", "cs-output.json");
        var json = JsonSerializer.Serialize(results, JsonOptions);
        var lfJson = json.Replace("\r\n", "\n").Replace("\r", "\n");
        File.WriteAllText(outputPath, lfJson, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));

        Assert.Equal(0, mismatches);
    }
}
