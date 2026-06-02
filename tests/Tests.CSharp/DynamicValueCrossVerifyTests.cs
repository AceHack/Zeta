using System.Collections.Immutable;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// DynamicValue cross-language byte-lock — the C# oracle RE-GROUNDED against the shared seed
/// (<c>src/Core.TypeScript/dynamic-value/golden-vectors.json</c>). Seed-first (the maintainer
/// 2026-06-01: "we are growing code from the seeds"): the seed is the canonical DATA; this proves
/// the C# canonical encoder AGREES on it (<c>ToCanonicalJson(value)</c> is <c>Ok json</c>) for
/// every locked vector. Passing == agreeing with the TS/F# oracles. v1 locks
/// null/bool/int/string/array/object; Float + Bytes are DEFERRED (not in the locked vectors).
/// "The compilers don't lie."
/// </summary>
public class DynamicValueCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(DynamicValueCrossVerifyTests).Assembly.Location)!);
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

    [Fact]
    public void CSharpCanonicalEncoderAgreesWithSeed()
    {
        string path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "dynamic-value", "golden-vectors.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        JsonElement[] vectors = doc.RootElement.GetProperty("vectors").EnumerateArray().ToArray();
        Assert.NotEmpty(vectors);

        var failures = new List<string>();
        foreach (JsonElement v in vectors)
        {
            string name = Str(v, "name");
            DynamicValue value = BuildValue(v.GetProperty("value"));
            string expected = Str(v, "json");

            switch (DynamicValues.ToCanonicalJson(value))
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
}
