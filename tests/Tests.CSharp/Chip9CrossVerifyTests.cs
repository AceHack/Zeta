// CHIP-9 cross-verify — the C# oracle replays the treaty ROM the F# oracle locked
// (src/Core.TypeScript/chip9/golden-vectors.lines) and must reproduce the 32x64 color grid exactly.

using System;
using System.Globalization;
using System.IO;
using System.Linq;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

public sealed class Chip9CrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(Chip9CrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent!;
        }

        return dir!.FullName;
    }

    [Fact]
    public void ByteLockReplayingTheTreatyRomReproducesTheGoldenColorGridExactly()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "chip9", "golden-vectors.lines");
        Assert.True(File.Exists(path), $"golden not found: {path}");
        var lines = File.ReadAllLines(path).Where(l => !l.StartsWith('#') && l.Length > 0).ToList();

        var romHex = lines[0].Split('\t')[1];
        var rom = Enumerable.Range(0, romHex.Length / 2)
            .Select(i => byte.Parse(romHex.AsSpan(i * 2, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture))
            .ToArray();
        var goldenPlane = byte.Parse(lines[1].Split('\t')[1], CultureInfo.InvariantCulture);
        var goldenRows = lines.Skip(2).Take(Chip9Machine.Height).ToList(); // fault-treaty keys follow the grid
        Assert.Equal(Chip9Machine.Height, goldenRows.Count);

        var m = new Chip9Machine();
        m.LoadRom(rom);
        for (var k = 0; k < 8; k++) m.Mem[0x300 + k] = 0xFF; // solid 8x8 treaty sprite (B-1031)
        for (var s = 0; s < 30; s++)
        {
            m.Step();
        }

        Assert.Equal(goldenPlane, m.Plane);
        for (var y = 0; y < Chip9Machine.Height; y++)
        {
            var row = string.Concat(Enumerable.Range(0, Chip9Machine.Width)
                .Select(x => m.ColorAt(x, y).ToString("x", CultureInfo.InvariantCulture)));
            Assert.Equal(goldenRows[y], row);
        }
    }

    [Theory]
    [InlineData("underflow")]
    [InlineData("overflow")]
    public void FaultTreatyRecordedNeverFatalRefusedCallFallsThroughTextPcDepthByteLocked(string which)
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "chip9", "golden-vectors.lines");
        var lines = File.ReadAllLines(path).Where(l => !l.StartsWith('#') && l.Length > 0).ToList();
        string Keyed(string key) => lines.First(l => l.StartsWith(key + "\t", StringComparison.Ordinal)).Split('\t')[1];

        var romHex = Keyed($"fault-rom-{which}");
        var rom = Enumerable.Range(0, romHex.Length / 2)
            .Select(i => byte.Parse(romHex.AsSpan(i * 2, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture))
            .ToArray();
        var steps = int.Parse(Keyed($"fault-steps-{which}"), CultureInfo.InvariantCulture);

        var m = new Chip9Machine();
        m.LoadRom(rom);
        for (var s = 0; s < steps; s++)
        {
            m.Step();
        }

        Assert.Equal(Keyed($"fault-text-{which}"), m.Fault);
        Assert.Equal(Keyed($"fault-pc-{which}"), m.Pc.ToString("x4", CultureInfo.InvariantCulture));
        Assert.Equal(int.Parse(Keyed($"fault-depth-{which}"), CultureInfo.InvariantCulture), m.CallStack.Count);
    }
}
