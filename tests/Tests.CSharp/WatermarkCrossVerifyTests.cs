using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// Watermark cross-language agreement — the C# oracle replays the shared seed
/// (<c>src/Core.TypeScript/watermark/golden-vectors.json</c>) that the F#/TS/Rust oracles also verify.
/// All values are exact int64 in the safe-integer range, so the surface byte-locks.
/// </summary>
public class WatermarkCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(WatermarkCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new DirectoryNotFoundException("Could not locate repo root (Zeta.sln).");
    }

    private static JsonElement Seed()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "watermark", "golden-vectors.json");
        Assert.True(File.Exists(path), $"seed not found: {path}");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.Clone();
    }

    private static long[] Longs(JsonElement arr) => arr.EnumerateArray().Select(e => e.GetInt64()).ToArray();

    [Fact]
    public void ObserveAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("observe").EnumerateArray())
        {
            var got = Watermark.Observe(
                v.GetProperty("strategy").GetString()!,
                v.GetProperty("lateness").GetInt64(),
                Longs(v.GetProperty("events")));
            Assert.Equal<IReadOnlyList<long>>(Longs(v.GetProperty("result")), got);
        }
    }

    [Fact]
    public void IsLateAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("isLate").EnumerateArray())
        {
            Assert.Equal(v.GetProperty("result").GetBoolean(),
                Watermark.IsLate(v.GetProperty("wm").GetInt64(), v.GetProperty("eventTime").GetInt64()));
        }
    }

    [Fact]
    public void CombineAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("combine").EnumerateArray())
        {
            Assert.Equal(v.GetProperty("result").GetInt64(), Watermark.Combine(Longs(v.GetProperty("sources"))));
        }
    }
}
