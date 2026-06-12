using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// Braid cross-language agreement — the C# oracle replays the shared seed
/// (<c>src/Core.TypeScript/braid/golden-vectors.json</c>, generated from the F# shelf
/// <c>src/Core/Braid.fs</c>) that the F#/TS/Rust oracles also verify. Faithfulness
/// (Artin 1925) means the action images pin braid identity exactly — agreement here is
/// the four-oracle byte-lock for the math REPORT #3 §2 kernel functor.
/// </summary>
public class BraidCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(BraidCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new DirectoryNotFoundException("Could not locate repo root (Zeta.sln).");
    }

    private static JsonElement Seed()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "braid", "golden-vectors.json");
        Assert.True(File.Exists(path), $"seed not found: {path}");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.Clone();
    }

    private static List<int> Ints(JsonElement arr) => arr.EnumerateArray().Select(e => e.GetInt32()).ToList();

    private static List<(int G, int E)> Word(JsonElement arr) =>
        arr.EnumerateArray().Select(l => (l[0].GetInt32(), l[1].GetInt32())).ToList();

    [Fact]
    public void AllVectorsAgreeWithSeed()
    {
        var seed = Seed();
        var n = seed.GetProperty("n").GetInt32();
        foreach (var v in seed.GetProperty("vectors").EnumerateArray())
        {
            var braid = Ints(v.GetProperty("braid"));
            Assert.Equal(v.GetProperty("writhe").GetInt32(), Braid.Writhe(braid));
            Assert.Equal(v.GetProperty("writheParity").GetInt32(), Braid.WritheParity(braid));
            Assert.Equal(Ints(v.GetProperty("permutation")), Braid.Permutation(n, braid).ToList());

            var actions = v.GetProperty("actions");
            for (var i = 0; i < n; i++)
            {
                Assert.Equal(Word(actions[i]), Braid.Act(braid, Braid.Gen(i)));
            }
        }
    }
}
