using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// TravelerFrame cross-language agreement — the C# oracle replays the shared seed
/// (<c>src/Core.TypeScript/traveler-frame/golden-vectors.json</c>) and asserts identical transform /
/// dominates / converge results. Passing == agreeing with the F# oracle on the causal vector-clock frame.
/// </summary>
public class TravelerFrameCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(TravelerFrameCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new DirectoryNotFoundException("Could not locate repo root (Zeta.sln).");
    }

    private static Dictionary<string, long> Map(JsonElement obj) =>
        obj.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetInt64(), System.StringComparer.Ordinal);

    private static void AssertMapEqual(Dictionary<string, long> expected, IReadOnlyDictionary<string, long> actual)
    {
        Assert.Equal(expected.Count, actual.Count);
        foreach (var kv in expected)
        {
            Assert.True(actual.TryGetValue(kv.Key, out var v) && v == kv.Value, $"key {kv.Key}");
        }
    }

    [Fact]
    public void CSharpTravelerFrameAgreesWithSeed()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "traveler-frame", "golden-vectors.json");
        Assert.True(File.Exists(path), $"seed not found: {path}");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var seed = doc.RootElement;

        foreach (var v in seed.GetProperty("transform").EnumerateArray())
        {
            AssertMapEqual(Map(v.GetProperty("result")), TravelerFrame.Transform(Map(v.GetProperty("a")), Map(v.GetProperty("b"))));
        }

        foreach (var v in seed.GetProperty("dominates").EnumerateArray())
        {
            Assert.Equal(v.GetProperty("result").GetBoolean(), TravelerFrame.Dominates(Map(v.GetProperty("a")), Map(v.GetProperty("b"))));
        }

        foreach (var v in seed.GetProperty("converge").EnumerateArray())
        {
            var frames = v.GetProperty("frames").EnumerateArray().Select(e => (IReadOnlyDictionary<string, long>)Map(e)).ToList();
            var lub = Map(v.GetProperty("lub"));
            AssertMapEqual(lub, TravelerFrame.Converge(frames));
            AssertMapEqual(lub, TravelerFrame.Converge(Enumerable.Reverse(frames))); // order-independent
        }
    }
}
