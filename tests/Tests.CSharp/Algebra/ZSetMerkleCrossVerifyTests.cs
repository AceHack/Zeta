using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp.Algebra;

/// <summary>
/// ZSetMerkle cross-language conformance — the C# native oracle for computing Merkle root over a Z-set.
/// Replays the SHARED golden vectors from <c>src/Core.TypeScript/z-set-merkle/golden-vectors.json</c>
/// and asserts that the computed Merkle root matches the reference F#/TS/Rust root.
/// </summary>
public class ZSetMerkleCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(ZSetMerkleCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName
            ?? throw new InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location.");
    }

    private static (string Key, long Weight)[] Entries(JsonElement array) =>
        array.EnumerateArray()
            .Select(e => (
                e.GetProperty("key").GetString()
                    ?? throw new InvalidOperationException($"fixture entry key is not a string: {e.GetRawText()}"),
                e.GetProperty("weight").GetInt64()))
            .ToArray();

    [Fact]
    public void ZSetMerkleReplayMatchesGoldenVectors()
    {
        var root = RepoRoot();
        var path = Path.Join(root, "src", "Core.TypeScript", "z-set-merkle", "golden-vectors.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var r = doc.RootElement;
        var cmp = Collation.UnicodeCodePointComparer.Ordinal;

        var vectors = r.GetProperty("vectors");
        foreach (var vc in vectors.EnumerateArray())
        {
            var name = vc.GetProperty("name").GetString();
            var entries = Entries(vc.GetProperty("entries"));
            var expectedRoot = vc.GetProperty("root").GetString();

            var z = ZSet.OfEntries(entries, cmp);
            var gotRoot = ZSetMerkle.Root(s => Encoding.UTF8.GetBytes(s), z);

            Assert.Equal(expectedRoot, gotRoot.ToHex());
        }
    }
}
