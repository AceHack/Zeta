using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// ByteCost cross-language byte-lock — the C# oracle replays the shared seed
/// (<c>src/Core.TypeScript/byte-cost/golden-vectors.json</c>) and asserts identical UTF-8
/// byte counts. Passing == agreeing with the TS/F#/Rust oracles on the meter (B-1016 slice 1).
/// Bytes not model-tokens (deterministic + byte-lockable). "The compilers don't lie."
/// </summary>
public class ByteCostCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(ByteCostCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new DirectoryNotFoundException("Could not locate repo root (Zeta.sln).");
    }

    private static JsonElement Seed()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "byte-cost", "golden-vectors.json");
        Assert.True(File.Exists(path), $"seed not found: {path}");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.Clone();
    }

    [Fact]
    public void CSharpMeterAgreesWithSeed()
    {
        var seed = Seed();
        Assert.Equal("byte-cost", seed.GetProperty("primitive").GetString());
        Assert.Equal("v1", seed.GetProperty("version").GetString());
        Assert.Equal("utf8-bytes", seed.GetProperty("unit").GetString());

        var vectors = seed.GetProperty("vectors").EnumerateArray().ToArray();
        Assert.NotEmpty(vectors);

        var costs = new List<ByteCost>();
        foreach (var v in vectors)
        {
            var name = v.GetProperty("name").GetString();
            var text = v.GetProperty("text").GetString()!;
            var expected = v.GetProperty("bytes").GetInt64();
            var actual = ByteCost.MeasureText(text).Bytes;
            Assert.True(actual == expected, $"byte-cost vector '{name}': expected {expected}, measured {actual}");
            costs.Add(ByteCost.MeasureText(text));
        }

        // Order-independent sum (sound DORA aggregate).
        Assert.Equal(ByteCost.Sum(costs), ByteCost.Sum(Enumerable.Reverse(costs)));
    }

    [Fact]
    public void ZeroIsIdentityAndEmptyCostsZero()
    {
        Assert.Equal(ByteCost.Zero, ByteCost.MeasureText(""));
        var a = new ByteCost(7L);
        Assert.Equal(a, ByteCost.Add(a, ByteCost.Zero));
        Assert.Equal(a, ByteCost.Add(ByteCost.Zero, a));
    }
}
