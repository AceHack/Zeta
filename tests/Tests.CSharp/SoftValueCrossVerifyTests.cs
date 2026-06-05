using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// SoftValue cross-language agreement — the C# oracle replays the shared seed
/// (<c>src/Core.TypeScript/soft-value/golden-vectors.json</c>) and asserts identical decisions (resolve /
/// observe-then-resolve). The float confidence/entropy values are not cross-verified (floats don't
/// byte-lock); only the exact decision behavior is.
/// </summary>
public class SoftValueCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(SoftValueCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new DirectoryNotFoundException("Could not locate repo root (Zeta.sln).");
    }

    private static Dictionary<string, long> Map(JsonElement obj) =>
        obj.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetInt64(), System.StringComparer.Ordinal);

    private static string? Result(JsonElement e) =>
        e.ValueKind == JsonValueKind.Null ? null : e.GetString();

    [Fact]
    public void CSharpSoftValueAgreesWithSeed()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "soft-value", "golden-vectors.json");
        Assert.True(File.Exists(path), $"seed not found: {path}");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var seed = doc.RootElement;

        foreach (var v in seed.GetProperty("resolve").EnumerateArray())
        {
            Assert.Equal(
                Result(v.GetProperty("result")),
                SoftValue.Resolve(Map(v.GetProperty("candidates")), v.GetProperty("num").GetInt64(), v.GetProperty("den").GetInt64()));
        }

        foreach (var v in seed.GetProperty("observeResolve").EnumerateArray())
        {
            Assert.Equal(
                Result(v.GetProperty("result")),
                SoftValue.ObserveResolve(
                    Map(v.GetProperty("prior")),
                    Map(v.GetProperty("likelihood")),
                    v.GetProperty("num").GetInt64(),
                    v.GetProperty("den").GetInt64()));
        }
    }
}
