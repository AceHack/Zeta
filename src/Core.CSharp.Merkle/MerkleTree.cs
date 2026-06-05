namespace Zeta.Core.CSharp;

/// <summary>
/// Merkle tree over a sequence of leaf blobs, built bottom-up. Mirrors the F#
/// <c>MerkleTree</c> exactly (duplicate-last-leaf for odd fan-in), so the root is
/// byte-identical to the F# implementation over the same leaves.
/// </summary>
public sealed class MerkleTree
{
    private readonly MerkleHash[][] _levels;

    public MerkleTree(byte[][] leaves)
    {
        var level0 = new MerkleHash[leaves.Length];
        for (var i = 0; i < leaves.Length; i++)
        {
            level0[i] = MerkleHash.OfBytes(leaves[i]);
        }

        var all = new List<MerkleHash[]> { level0 };
        var cur = level0;
        while (cur.Length > 1)
        {
            var parent = new MerkleHash[(cur.Length + 1) / 2];
            for (var i = 0; i < parent.Length; i++)
            {
                var left = cur[2 * i];
                var right = 2 * i + 1 < cur.Length ? cur[2 * i + 1] : left; // duplicate last for odd fan-in
                parent[i] = MerkleHash.Combine(left, right);
            }

            all.Add(parent);
            cur = parent;
        }

        _levels = all.ToArray();
    }

    /// <summary>Root digest — byte-identical to the F# root over the same leaves.</summary>
    public MerkleHash Root
    {
        get
        {
            var top = _levels[^1];
            return top.Length == 0 ? MerkleHash.Zero : top[0];
        }
    }

    /// <summary>The leaf hashes (level 0), useful for diffing.</summary>
    public MerkleHash[] LeafHashes => _levels[0];
}
