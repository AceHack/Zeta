using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// FastCDC cross-language agreement — the C# oracle replays the shared seed
/// (<c>src/Core.TypeScript/fastcdc/golden-vectors.json</c>) that the F#/TS/Rust oracles also verify.
/// Each oracle regenerates the byte stream deterministically (byte[i] = mix(i) &amp; 0xFF) and the chunk
/// lengths are cross-verified; the large stream exercises genuine content-defined cuts.
/// </summary>
public class FastCdcCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(FastCdcCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new DirectoryNotFoundException("Could not locate repo root (Zeta.sln).");
    }

    private static JsonElement Seed()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "fastcdc", "golden-vectors.json");
        Assert.True(File.Exists(path), $"seed not found: {path}");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.Clone();
    }

    [Fact]
    public void GearSamplesAgreeWithSeed()
    {
        var table = FastCdc.GearTable();
        foreach (var v in Seed().GetProperty("gearSamples").EnumerateArray())
        {
            Assert.Equal(ulong.Parse(v.GetProperty("value").GetString()!, CultureInfo.InvariantCulture),
                table[v.GetProperty("i").GetInt32()]);
        }
    }

    [Fact]
    public void ChunkLengthsAgreeWithSeed()
    {
        foreach (var v in Seed().GetProperty("chunk").EnumerateArray())
        {
            var expected = v.GetProperty("lengths").EnumerateArray().Select(e => e.GetInt32()).ToArray();
            var bytes = FastCdc.GenBytes(v.GetProperty("count").GetInt32());
            var got = FastCdc.ChunkLengths(
                bytes,
                v.GetProperty("min").GetInt32(),
                v.GetProperty("avg").GetInt32(),
                v.GetProperty("max").GetInt32());
            Assert.Equal<IReadOnlyList<int>>(expected, got);
        }
    }
}
