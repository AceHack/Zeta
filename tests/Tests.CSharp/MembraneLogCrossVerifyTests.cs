// Membrane-log cross-verify — the C# oracle parses + re-serializes the SAME wire lines the F# oracle
// locked (src/Core.TypeScript/recorded-source/golden-vectors.lines), byte-for-byte.

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

public sealed class MembraneLogCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(MembraneLogCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent!;
        }

        return dir!.FullName;
    }

    private static List<string> GoldenLines()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "recorded-source", "golden-vectors.lines");
        Assert.True(File.Exists(path), $"golden not found: {path}");
        return File.ReadAllLines(path).Where(l => !l.StartsWith('#') && l.Length > 0).ToList();
    }

    [Fact]
    public void ByteLockEveryGoldenLineParsesAndReSerializesIdentically()
    {
        var lines = GoldenLines();
        Assert.Equal(10, lines.Count); // all 8 kinds across 4 ticks
        foreach (var line in lines)
        {
            var parsed = MembraneCrossing.OfLine(line);
            Assert.NotNull(parsed);
            Assert.Equal(line, parsed!.ToLine());
        }
    }

    [Fact]
    public void MalformedAndUnknownKindsAreRefusedHonestly()
    {
        Assert.Null(MembraneCrossing.OfLine("garbage"));
        Assert.Null(MembraneCrossing.OfLine("x\tTimerElapsed\t17"));
        Assert.Null(MembraneCrossing.OfLine("0\tNotAKind\t1"));
        Assert.Null(MembraneCrossing.OfLine("0\tTimerElapsed"));        // missing int arg
        Assert.Null(MembraneCrossing.OfLine("0\tSentinelMissing\tjunk")); // extra arg
    }
}
