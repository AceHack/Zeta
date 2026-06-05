using System.Globalization;
using System.IO;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// SplitMix64 cross-language agreement — the C# oracle replays the shared seed
/// (<c>src/Core.TypeScript/splitmix64/golden-vectors.json</c>) that the F#/TS/Rust oracles also verify.
/// uint64 is carried as decimal strings for exactness (it exceeds JSON's exact number range).
/// </summary>
public class SplitMix64CrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(SplitMix64CrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new DirectoryNotFoundException("Could not locate repo root (Zeta.sln).");
    }

    private static JsonElement Seed()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "splitmix64", "golden-vectors.json");
        Assert.True(File.Exists(path), $"seed not found: {path}");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.Clone();
    }

    private static ulong U(string s) => ulong.Parse(s, CultureInfo.InvariantCulture);

    [Fact]
    public void MixAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("mix").EnumerateArray())
        {
            Assert.Equal(U(v.GetProperty("result").GetString()!), SplitMix64.Mix(U(v.GetProperty("x").GetString()!)));
        }
    }
}
