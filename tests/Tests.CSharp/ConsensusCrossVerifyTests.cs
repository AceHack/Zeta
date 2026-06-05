using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// BFT consensus cross-language agreement — the C# oracle replays the shared seed
/// (<c>src/Core.TypeScript/consensus/golden-vectors.json</c>) that the F#/TS/Rust oracles also verify.
/// </summary>
public class ConsensusCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(ConsensusCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new DirectoryNotFoundException("Could not locate repo root (Zeta.sln).");
    }

    private static JsonElement Seed()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "consensus", "golden-vectors.json");
        Assert.True(File.Exists(path), $"seed not found: {path}");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.Clone();
    }

    [Fact]
    public void QuorumThresholdAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("quorumThreshold").EnumerateArray())
        {
            Assert.Equal(v.GetProperty("result").GetInt32(), Consensus.QuorumThreshold(v.GetProperty("n").GetInt32()));
        }
    }

    [Fact]
    public void DecideAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("decide").EnumerateArray())
        {
            var votes = v.GetProperty("votes").EnumerateArray().Select(e => e.GetString()!).ToArray();
            var r = v.GetProperty("result");
            var got = Consensus.Decide(votes);
            Assert.Equal(r.GetProperty("committed").GetBoolean(), got.Committed);
            var expectedValue = r.GetProperty("value").ValueKind == JsonValueKind.Null ? null : r.GetProperty("value").GetString();
            Assert.Equal(expectedValue, got.Value);
            Assert.Equal(r.GetProperty("count").GetInt32(), got.Count);
            Assert.Equal(r.GetProperty("total").GetInt32(), got.Total);
        }
    }
}
