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

    /// <summary>
    /// Inclusion (audit) proof for the leaf at <paramref name="index"/>: the sibling
    /// digest at each level from leaf to root, with its side. A verifier holding only
    /// the leaf, this proof, and the root can confirm membership without the tree
    /// (see <see cref="VerifyProof"/>). Replays the exact fold (duplicate-last on an
    /// odd trailing node → sibling is self, on the right), matching the F#
    /// <c>MerkleTree.Proof</c> step-for-step.
    /// </summary>
    /// <exception cref="ArgumentOutOfRangeException">Leaf index out of range.</exception>
    public MerkleProofStep[] Proof(int index)
    {
        var leafCount = _levels[0].Length;
        if (index < 0 || index >= leafCount)
        {
            throw new ArgumentOutOfRangeException(
                nameof(index),
                index,
                $"leaf index {index.ToString(System.Globalization.CultureInfo.InvariantCulture)} out of range [0, {leafCount.ToString(System.Globalization.CultureInfo.InvariantCulture)})");
        }

        var steps = new List<MerkleProofStep>();
        var idx = index;
        // Walk levels[0 .. n-2]; the last level is the root (no sibling).
        for (var lvl = 0; lvl < _levels.Length - 1; lvl++)
        {
            var cur = _levels[lvl];
            var selfIsLeft = idx % 2 == 0;
            var siblingIdx = selfIsLeft
                ? (idx + 1 < cur.Length ? idx + 1 : idx) // odd trailing node → sibling is self
                : idx - 1;
            steps.Add(new MerkleProofStep(cur[siblingIdx], selfIsLeft));
            idx /= 2;
        }

        return steps.ToArray();
    }

    /// <summary>
    /// Verify an inclusion proof: re-hash <paramref name="leaf"/>, fold the audit
    /// <paramref name="steps"/> up, and check the result equals
    /// <paramref name="expectedRoot"/>. Touches ONLY the leaf, the proof, and the root —
    /// never the tree (the third-party property). The fold matches <see cref="Proof"/> +
    /// <see cref="MerkleHash.Combine"/> byte-for-byte, so the same <c>(leaf, steps, root)</c>
    /// verifies identically in the F#/Rust/TS oracles.
    /// </summary>
    public static bool VerifyProof(byte[] leaf, MerkleProofStep[] steps, MerkleHash expectedRoot)
    {
        ArgumentNullException.ThrowIfNull(steps);
        var acc = MerkleHash.OfBytes(leaf);
        foreach (var step in steps)
        {
            acc = step.SiblingOnRight
                ? MerkleHash.Combine(acc, step.Sibling)
                : MerkleHash.Combine(step.Sibling, acc);
        }

        return acc.Equals(expectedRoot);
    }
}
