using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text.Json;
using Xunit;

namespace Zeta.Tests.CSharp.Algebra;

/// <summary>
/// Merkle inclusion-proof cross-language byte-lock — the C# oracle leg of the
/// 4-language (F#/TS/Rust/C#) treaty. Replays the FROZEN golden vectors authored
/// by the F# reference (<c>src/Core/Merkle.fs</c>) and asserts that the C# port
/// (<c>src/Core.CSharp.Merkle/MerkleTree.cs</c>) reproduces every committed
/// proof step, root, and verification result byte-for-byte. The F# treaty is
/// authoritative; this test never edits the fixture.
///
/// Vector schema (hex-in-JSON, per <c>no-binary-in-proof-lineage</c>):
/// <c>{"leaves":["&lt;hex&gt;"...],"index":N,"siblings":[{"hash":"&lt;hex&gt;","right":bool}],"root":"&lt;hex&gt;"}</c>.
/// <c>right=true</c> ⇒ the sibling is the RIGHT child (current node LEFT,
/// <c>parent=Combine(self,sibling)</c>); the odd trailing node's sibling is itself, right=true.
/// </summary>
public class MerkleProofGoldenVectorsTests
{
    private sealed record ProofStepVector(string Hash, bool Right);

    private sealed record ProofVector(
        IReadOnlyList<string> Leaves,
        int Index,
        IReadOnlyList<ProofStepVector> Siblings,
        string Root);

    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(
            Path.GetDirectoryName(typeof(MerkleProofGoldenVectorsTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName
            ?? throw new InvalidOperationException(
                "Could not locate repo root (Zeta.sln) from test assembly location.");
    }

    private static byte[] FromHex(string hex)
    {
        if (hex.Length == 0)
        {
            return Array.Empty<byte>();
        }

        var bytes = new byte[hex.Length / 2];
        for (var i = 0; i < bytes.Length; i++)
        {
            bytes[i] = byte.Parse(
                hex.AsSpan(i * 2, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture);
        }

        return bytes;
    }

    private static List<ProofVector> LoadVectors()
    {
        var path = Path.Join(
            RepoRoot(), "src", "Core.TypeScript", "merkle", "golden-vectors-merkle-proofs.json");
        var json = File.ReadAllText(path);
        using var doc = JsonDocument.Parse(json);
        var vectors = new List<ProofVector>();
        foreach (var rowElement in doc.RootElement.EnumerateArray())
        {
            var leaves = new List<string>();
            foreach (var leaf in rowElement.GetProperty("leaves").EnumerateArray())
            {
                leaves.Add(leaf.GetString() ?? "");
            }

            var siblings = new List<ProofStepVector>();
            foreach (var sib in rowElement.GetProperty("siblings").EnumerateArray())
            {
                siblings.Add(new ProofStepVector(
                    sib.GetProperty("hash").GetString() ?? "",
                    sib.GetProperty("right").GetBoolean()));
            }

            vectors.Add(new ProofVector(
                leaves,
                rowElement.GetProperty("index").GetInt32(),
                siblings,
                rowElement.GetProperty("root").GetString() ?? ""));
        }

        return vectors;
    }

    public static IEnumerable<object[]> RowIndices()
    {
        var count = LoadVectors().Count;
        for (var i = 0; i < count; i++)
        {
            yield return new object[] { i };
        }
    }

    [Theory]
    [MemberData(nameof(RowIndices))]
    public void ProofReproducesCommittedVector(int row)
    {
        var vector = LoadVectors()[row];

        var leaves = new byte[vector.Leaves.Count][];
        for (var i = 0; i < leaves.Length; i++)
        {
            leaves[i] = FromHex(vector.Leaves[i]);
        }

        var tree = new Zeta.Core.CSharp.MerkleTree(leaves);

        // (b) Root matches the committed root byte-for-byte.
        Assert.Equal(vector.Root, tree.Root.ToHex());

        // (a) Proof reproduces the committed siblings byte-for-byte (ToHex + SiblingOnRight).
        var steps = tree.Proof(vector.Index);
        Assert.Equal(vector.Siblings.Count, steps.Length);
        for (var s = 0; s < steps.Length; s++)
        {
            Assert.Equal(vector.Siblings[s].Hash, steps[s].Sibling.ToHex());
            Assert.Equal(vector.Siblings[s].Right, steps[s].SiblingOnRight);
        }

        // (c) VerifyProof over the genuine leaf returns true.
        var expectedRoot = tree.Root;
        var leaf = leaves[vector.Index];
        Assert.True(
            Zeta.Core.CSharp.MerkleTree.VerifyProof(leaf, steps, expectedRoot),
            $"row {row.ToString(CultureInfo.InvariantCulture)}: VerifyProof should accept the genuine leaf");

        // (d) A tampered leaf (flip byte 0, or a single non-zero byte if empty) fails.
        byte[] tampered;
        if (leaf.Length == 0)
        {
            tampered = new byte[] { 0x01 };
        }
        else
        {
            tampered = (byte[])leaf.Clone();
            tampered[0] ^= 0x01;
        }

        Assert.False(
            Zeta.Core.CSharp.MerkleTree.VerifyProof(tampered, steps, expectedRoot),
            $"row {row.ToString(CultureInfo.InvariantCulture)}: VerifyProof must reject a tampered leaf");
    }

    [Fact]
    public void FixtureHasExpectedVectorCount()
    {
        Assert.Equal(22, LoadVectors().Count);
    }
}
