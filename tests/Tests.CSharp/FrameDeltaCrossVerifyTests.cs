using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// FrameDelta cross-language agreement — the C# oracle replays the shared seed
/// (<c>src/Core.TypeScript/frame-delta/golden-vectors.json</c>) and asserts identical compose / inverse /
/// between / apply / magnitude / distance results. Passing == agreeing with the F# oracle on the
/// frame-offset transformation group.
/// </summary>
public class FrameDeltaCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(FrameDeltaCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new DirectoryNotFoundException("Could not locate repo root (Zeta.sln).");
    }

    private static Dictionary<string, long> Map(JsonElement obj) =>
        obj.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetInt64(), System.StringComparer.Ordinal);

    private static JsonElement Seed()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "frame-delta", "golden-vectors.json");
        Assert.True(File.Exists(path), $"seed not found: {path}");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.Clone();
    }

    private static void AssertMapEqual(Dictionary<string, long> expected, IReadOnlyDictionary<string, long> actual)
    {
        Assert.Equal(expected.Count, actual.Count);
        foreach (var kv in expected)
        {
            Assert.True(actual.TryGetValue(kv.Key, out var v) && v == kv.Value, $"key {kv.Key}");
        }
    }

    [Fact]
    public void CSharpFrameDeltaAgreesWithSeed()
    {
        var seed = Seed();

        foreach (var v in seed.GetProperty("compose").EnumerateArray())
        {
            AssertMapEqual(Map(v.GetProperty("result")), FrameDelta.Compose(Map(v.GetProperty("a")), Map(v.GetProperty("b"))));
        }

        foreach (var v in seed.GetProperty("inverse").EnumerateArray())
        {
            AssertMapEqual(Map(v.GetProperty("result")), FrameDelta.Inverse(Map(v.GetProperty("d"))));
        }

        foreach (var v in seed.GetProperty("between").EnumerateArray())
        {
            AssertMapEqual(Map(v.GetProperty("result")), FrameDelta.Between(Map(v.GetProperty("from")), Map(v.GetProperty("to"))));
        }

        foreach (var v in seed.GetProperty("apply").EnumerateArray())
        {
            AssertMapEqual(Map(v.GetProperty("result")), FrameDelta.Apply(Map(v.GetProperty("delta")), Map(v.GetProperty("frame"))));
        }

        foreach (var v in seed.GetProperty("magnitude").EnumerateArray())
        {
            Assert.Equal(v.GetProperty("result").GetInt64(), FrameDelta.Magnitude(Map(v.GetProperty("d"))));
        }

        foreach (var v in seed.GetProperty("distance").EnumerateArray())
        {
            Assert.Equal(v.GetProperty("result").GetInt64(), FrameDelta.Distance(Map(v.GetProperty("from")), Map(v.GetProperty("to"))));
        }
    }
}
