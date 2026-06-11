// MeshPong cross-verify — the C# oracle replays the SAME game-state treaty session the F# oracle locked
// (src/Core.TypeScript/mesh-pong/golden-vectors.lines): four compilers, one match, one world.

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

public sealed class MeshPongCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(MeshPongCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent!;
        }

        return dir!.FullName;
    }

    private static List<(string Kind, string Payload)> Golden()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "mesh-pong", "golden-vectors.lines");
        Assert.True(File.Exists(path), $"golden not found: {path}");
        return File.ReadAllLines(path)
            .Where(l => !l.StartsWith('#') && l.Length > 0)
            .Select(l =>
            {
                var i1 = l.IndexOf('\t');
                var i2 = l.IndexOf('\t', i1 + 1);
                return (l[..i1], l[(i2 + 1)..]); // kind, rest (skip the tick; replay is order-driven)
            })
            .ToList();
    }

    [Fact]
    public void ByteLockReplayingTheGoldenSessionHitsEveryCheckpointExactly()
    {
        var g = MeshPongGame.Create();
        var inputs = 0;
        var checks = 0;
        foreach (var (kind, payload) in Golden())
        {
            if (string.Equals(kind, "i", StringComparison.Ordinal))
            {
                var parsed = MeshPongGame.ParseInputs(payload);
                Assert.NotNull(parsed);
                g = g.Step(parsed!.Value.A, parsed.Value.B);
                inputs++;
            }
            else
            {
                Assert.Equal(payload, g.ToLine());
                checks++;
            }
        }

        Assert.Equal(300, inputs);
        Assert.Equal(5, checks);
    }

    [Fact]
    public void StateCodecRoundTripsAndRefusesMalformed()
    {
        var g = MeshPongGame.Create();
        Assert.Equal(g, MeshPongGame.OfLine(g.ToLine()));
        Assert.Null(MeshPongGame.OfLine("garbage"));
        Assert.Null(MeshPongGame.OfLine("ponggame2\t1\t2\t3\t4\t5\t6\t7\t8"));
        Assert.Null(MeshPongGame.OfLine("ponggame1\t1\t2\t3\t4\t5\t6\t7"));
    }
}
