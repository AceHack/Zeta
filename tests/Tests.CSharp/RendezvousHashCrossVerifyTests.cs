using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// Rendezvous consistent-hash cross-language agreement — the C# oracle replays the shared seed
/// (<c>src/Core.TypeScript/consistent-hash/golden-vectors.json</c>) that the F#/TS/Rust oracles also
/// verify. Pure wrapping uint64 (the SplitMix64 score); uint64 carried as decimal strings.
/// </summary>
public class RendezvousHashCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(RendezvousHashCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new DirectoryNotFoundException("Could not locate repo root (Zeta.sln).");
    }

    private static JsonElement Seed()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "consistent-hash", "golden-vectors.json");
        Assert.True(File.Exists(path), $"seed not found: {path}");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.Clone();
    }

    private static ulong U(string s) => ulong.Parse(s, CultureInfo.InvariantCulture);

    [Fact]
    public void SeedsAgreeWithSeed()
    {
        var seeds = Seed().GetProperty("seeds");
        var expected = seeds.GetProperty("result").EnumerateArray().Select(e => U(e.GetString()!)).ToArray();
        Assert.Equal<IReadOnlyList<ulong>>(expected, RendezvousHash.Seeds(seeds.GetProperty("n").GetInt32()));
    }

    [Fact]
    public void PickAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("pick").EnumerateArray())
        {
            Assert.Equal(v.GetProperty("result").GetInt32(),
                RendezvousHash.Pick(v.GetProperty("buckets").GetInt32(), U(v.GetProperty("key").GetString()!)));
        }
    }
}
