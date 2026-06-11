// FourCorner cross-verify — the C# oracle conforms to the SAME treaty golden lines the F# oracle locked
// (src/Core.TypeScript/four-corner/golden-vectors.lines; B-1022 trigger fired: "we are the consumer for
// our treaties"). Two independent oracles producing identical bytes = the treaty means something.

using System.Collections.Generic;
using System.IO;
using System.Linq;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

public sealed class FourCornerCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(FourCornerCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent!;
        }

        return dir!.FullName;
    }

    private static List<string> GoldenLines()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "four-corner", "golden-vectors.lines");
        Assert.True(File.Exists(path), $"golden not found: {path}");
        return File.ReadAllLines(path).Where(l => !l.StartsWith('#') && l.Length > 0).ToList();
    }

    private static IReadOnlyList<FourCornerOwnership> Vectors() =>
    [
        new("operator-message", "emitted", "conv-feedback", "co-owned-ack"),
        new("only-input", null, null, null),
        new("tab\there\nand-newline", "back\\slash", null, "ends-with-tab\t"),
        new("", "", null, null),
        new("héllo-wörld-⊕-unicode", null, "反馈", null),
    ];

    [Fact]
    public void ByteLockEveryVectorSerializesToItsGoldenLineExactly()
    {
        var lines = GoldenLines();
        var vectors = Vectors();
        Assert.Equal(vectors.Count, lines.Count);
        for (var i = 0; i < vectors.Count; i++)
        {
            Assert.Equal(lines[i], vectors[i].ToLine());
        }
    }

    [Fact]
    public void RoundTripEveryGoldenLineParsesBackToItsVector()
    {
        var lines = GoldenLines();
        var vectors = Vectors();
        for (var i = 0; i < vectors.Count; i++)
        {
            var parsed = FourCornerOwnership.OfLine(lines[i]);
            Assert.NotNull(parsed);
            Assert.Equal(vectors[i], parsed);
        }
    }

    [Fact]
    public void MalformedIsRefusedHonestly()
    {
        Assert.Null(FourCornerOwnership.OfLine("garbage"));
        Assert.Null(FourCornerOwnership.OfLine("fourcorner1\tonly-three\t-\t-"));
        Assert.Null(FourCornerOwnership.OfLine("fourcorner2\ta\t-\t-\t-")); // wrong version tag
        Assert.Null(FourCornerOwnership.OfLine("fourcorner1\ta\t?\t-\t-")); // malformed opt
    }
}
