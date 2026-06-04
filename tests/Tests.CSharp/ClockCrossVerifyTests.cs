using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// Clock cross-language byte-lock — the C# oracle replays the shared seed
/// (<c>src/Core.TypeScript/clock/golden-vectors.json</c>) and asserts
/// Scheduler.Run yields the identical monotone stamp sequence the F#/TS oracles
/// produce (B-1016 floor #1). DST replay agreement across languages.
/// </summary>
public class ClockCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(ClockCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new DirectoryNotFoundException("Could not locate repo root (Zeta.sln).");
    }

    private static JsonElement Seed()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "clock", "golden-vectors.json");
        Assert.True(File.Exists(path), $"seed not found: {path}");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.Clone();
    }

    [Fact]
    public void CSharpClockMatchesSeed()
    {
        var seed = Seed();
        Assert.Equal("clock", seed.GetProperty("primitive").GetString());
        Assert.Equal("v1", seed.GetProperty("version").GetString());

        var vectors = seed.GetProperty("vectors").EnumerateArray().ToArray();
        Assert.NotEmpty(vectors);

        foreach (var v in vectors)
        {
            var name = v.GetProperty("name").GetString();
            var s = v.GetProperty("seed").GetInt64();
            var steps = v.GetProperty("steps").GetInt32();
            var expected = v.GetProperty("stamps").EnumerateArray().Select(e => e.GetInt64()).ToArray();
            var actual = Scheduler.Run(s, steps).ToArray();
            Assert.True(actual.SequenceEqual(expected), $"clock vector '{name}': expected [{string.Join(",", expected)}], got [{string.Join(",", actual)}]");
        }
    }

    [Fact]
    public void TickIsUnitStepAndDelayInverts()
    {
        var a = new Versionstamp(41L);
        Assert.Equal(new Versionstamp(42L), a.Tick());
        Assert.Equal(a, a.Tick().Delay());
        Assert.Equal(101L, Scheduler.FromSeed(100L).Step().Now.Version);
    }
}
