using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// CRC32C cross-language agreement — the C# oracle replays the shared seed
/// (<c>src/Core.TypeScript/crc32c/golden-vectors.json</c>) that the F#/TS/Rust oracles also verify.
/// </summary>
public class Crc32cCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(Crc32cCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new DirectoryNotFoundException("Could not locate repo root (Zeta.sln).");
    }

    private static JsonElement Seed()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "crc32c", "golden-vectors.json");
        Assert.True(File.Exists(path), $"seed not found: {path}");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.Clone();
    }

    [Fact]
    public void Crc32cAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("crc32c").EnumerateArray())
        {
            var payload = v.GetProperty("payload").EnumerateArray().Select(e => (byte)e.GetInt32()).ToArray();
            Assert.Equal(v.GetProperty("result").GetUInt32(), Crc32c.Compute(payload));
        }
    }
}
