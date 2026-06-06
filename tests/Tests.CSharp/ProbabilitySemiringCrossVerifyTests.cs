using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;
using R = Zeta.Core.CSharp.ProbabilitySemiring.Rational;

namespace Zeta.Tests.CSharp;

/// <summary>
/// ProbabilitySemiring cross-language agreement — the C# oracle replays the shared seed
/// (<c>src/Core.TypeScript/probability-semiring/golden-vectors.json</c>) that the F#/TS/Rust oracles
/// also verify. Exact rational ℚ.
/// </summary>
public class ProbabilitySemiringCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(ProbabilitySemiringCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new DirectoryNotFoundException("Could not locate repo root (Zeta.sln).");
    }

    private static JsonElement Seed()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "probability-semiring", "golden-vectors.json");
        Assert.True(File.Exists(path), $"seed not found: {path}");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.Clone();
    }

    private static R Rd(JsonElement e) => ProbabilitySemiring.Rat(e.GetProperty("n").GetInt64(), e.GetProperty("d").GetInt64());
    private static List<R> Vec(JsonElement e) => e.EnumerateArray().Select(Rd).ToList();
    private static List<IReadOnlyList<R>> Mat(JsonElement e) => e.EnumerateArray().Select(v => (IReadOnlyList<R>)Vec(v)).ToList();

    [Fact]
    public void NormalizeAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("normalize").EnumerateArray())
        {
            Assert.Equal(Rd(v.GetProperty("result")), ProbabilitySemiring.Rat(v.GetProperty("n").GetInt64(), v.GetProperty("d").GetInt64()));
        }
    }

    [Fact]
    public void AddAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("add").EnumerateArray())
        {
            Assert.Equal(Rd(v.GetProperty("result")), ProbabilitySemiring.Add(Rd(v.GetProperty("a")), Rd(v.GetProperty("b"))));
        }
    }

    [Fact]
    public void MulAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("mul").EnumerateArray())
        {
            Assert.Equal(Rd(v.GetProperty("result")), ProbabilitySemiring.Mul(Rd(v.GetProperty("a")), Rd(v.GetProperty("b"))));
        }
    }

    [Fact]
    public void MaxAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("max").EnumerateArray())
        {
            Assert.Equal(Rd(v.GetProperty("result")), ProbabilitySemiring.Max(Rd(v.GetProperty("a")), Rd(v.GetProperty("b"))));
        }
    }

    [Fact]
    public void ForwardStepAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("forwardStep").EnumerateArray())
        {
            Assert.Equal<IReadOnlyList<R>>(Vec(v.GetProperty("result")), ProbabilitySemiring.ForwardStep(Vec(v.GetProperty("pi")), Mat(v.GetProperty("p"))));
        }
    }

    [Fact]
    public void ViterbiStepAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("viterbiStep").EnumerateArray())
        {
            Assert.Equal<IReadOnlyList<R>>(Vec(v.GetProperty("result")), ProbabilitySemiring.ViterbiStep(Vec(v.GetProperty("v")), Mat(v.GetProperty("p"))));
        }
    }

    [Fact]
    public void DivAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("div").EnumerateArray())
        {
            Assert.Equal(Rd(v.GetProperty("result")), ProbabilitySemiring.Div(Rd(v.GetProperty("a")), Rd(v.GetProperty("b"))));
        }
    }

    [Fact]
    public void Merge3AgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("merge3").EnumerateArray())
        {
            Assert.Equal<IReadOnlyList<R>>(
                Vec(v.GetProperty("result")),
                ProbabilitySemiring.Merge3(Vec(v.GetProperty("ancestor")), Vec(v.GetProperty("a")), Vec(v.GetProperty("b"))));
        }
    }
}
