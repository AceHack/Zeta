using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// Curve cross-language agreement — the C# oracle replays the shared seed
/// (<c>src/Core.TypeScript/curve/golden-vectors.json</c>) and asserts identical rate (∂), integrate (I),
/// and curvature (∂²) outputs. Passing == agreeing with the F# oracle on the discrete DBSP D/I calculus.
/// </summary>
public class CurveCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(CurveCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new DirectoryNotFoundException("Could not locate repo root (Zeta.sln).");
    }

    private static long[] Longs(JsonElement arr) => arr.EnumerateArray().Select(e => e.GetInt64()).ToArray();

    [Fact]
    public void CSharpCurveAgreesWithSeed()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "curve", "golden-vectors.json");
        Assert.True(File.Exists(path), $"seed not found: {path}");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));

        var vectors = doc.RootElement.GetProperty("vectors").EnumerateArray().ToArray();
        Assert.NotEmpty(vectors);

        foreach (var v in vectors)
        {
            var input = Longs(v.GetProperty("input"));
            Assert.Equal(Longs(v.GetProperty("rate")), Curve.Differentiate(input));
            Assert.Equal(Longs(v.GetProperty("integrate")), Curve.Integrate(input));
            Assert.Equal(Longs(v.GetProperty("curvature")), Curve.Curvature(input));
        }
    }
}
