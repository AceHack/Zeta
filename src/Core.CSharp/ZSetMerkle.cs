using System;
using System.Buffers.Binary;
using System.Collections.Immutable;
using System.IO.Hashing;
using System.Runtime.InteropServices;

namespace Zeta.Core.CSharp;

/// <summary>
/// Canonical Merkle root over a Z-set — the C# parity oracle for <c>src/Core/ZSetMerkle.fs</c>.
/// Leaves are the DBSP Z-set entries, so the content-addressed root is a pure function of the net Z-set state.
/// </summary>
public static class ZSetMerkle
{
    /// <summary>
    /// Canonical leaf encoding for one <c>(key, weight)</c> entry:
    /// <c>[4-byte LE keyLen][keyBytes][8-byte LE weight]</c>.
    /// </summary>
    private static byte[] LeafBytes(byte[] keyBytes, long weight)
    {
        var buf = new byte[4 + keyBytes.Length + 8];
        BinaryPrimitives.WriteInt32LittleEndian(buf.AsSpan(0, 4), keyBytes.Length);
        keyBytes.CopyTo(buf, 4);
        BinaryPrimitives.WriteInt64LittleEndian(buf.AsSpan(4 + keyBytes.Length, 8), weight);
        return buf;
    }

    /// <summary>
    /// Combine two child digests into a parent: 32 LE bytes <c>a.Hi a.Lo b.Hi b.Lo</c>, re-hashed.
    /// </summary>
    private static MerkleHash Combine(Func<byte[], MerkleHash> hash, MerkleHash a, MerkleHash b)
    {
        var buf = new byte[32];
        BinaryPrimitives.WriteUInt64LittleEndian(buf.AsSpan(0, 8), a.Hi);
        BinaryPrimitives.WriteUInt64LittleEndian(buf.AsSpan(8, 8), a.Lo);
        BinaryPrimitives.WriteUInt64LittleEndian(buf.AsSpan(16, 8), b.Hi);
        BinaryPrimitives.WriteUInt64LittleEndian(buf.AsSpan(24, 8), b.Lo);
        return hash(buf);
    }

    /// <summary>
    /// Fold a level of digests bottom-up; an odd trailing node is promoted (duplicated) — the standard Merkle construction.
    /// </summary>
    private static MerkleHash Fold(Func<byte[], MerkleHash> hash, MerkleHash[] level)
    {
        if (level.Length == 0)
        {
            return hash(Array.Empty<byte>());
        }

        var cur = level;
        while (cur.Length > 1)
        {
            var parent = new MerkleHash[(cur.Length + 1) / 2];
            for (var i = 0; i < parent.Length; i++)
            {
                var left = cur[2 * i];
                var right = 2 * i + 1 < cur.Length ? cur[2 * i + 1] : left;
                parent[i] = Combine(hash, left, right);
            }
            cur = parent;
        }

        return cur[0];
    }

    /// <summary>
    /// Canonical Merkle root over <c>z</c> with an explicit hash function. Leaves = <c>(key, weight)</c> entries
    /// encoded + sorted by key bytes (ordinal); folded bottom-up. Deterministic + retraction-native.
    /// </summary>
    public static MerkleHash RootWith<T>(Func<byte[], MerkleHash> hash, Func<T, byte[]> encodeKey, ZSet<T> z)
    {
        ArgumentNullException.ThrowIfNull(hash);
        ArgumentNullException.ThrowIfNull(encodeKey);
        ArgumentNullException.ThrowIfNull(z);

        var items = z.ToImmutableArray();
        var leavesTemp = new (byte[] KeyBytes, long Weight)[items.Length];
        for (var i = 0; i < items.Length; i++)
        {
            leavesTemp[i] = (encodeKey(items[i].Key), items[i].Weight);
        }

        // Lexicographic ordinal comparison of key byte arrays (the cross-language canonical order)
        Array.Sort(leavesTemp, (a, b) => a.KeyBytes.AsSpan().SequenceCompareTo(b.KeyBytes.AsSpan()));

        var leaves = new MerkleHash[leavesTemp.Length];
        for (var i = 0; i < leavesTemp.Length; i++)
        {
            leaves[i] = hash(LeafBytes(leavesTemp[i].KeyBytes, leavesTemp[i].Weight));
        }

        return Fold(hash, leaves);
    }

    /// <summary>
    /// Canonical Merkle root using the default digest (XxHash128 via <see cref="MerkleHash"/>).
    /// </summary>
    public static MerkleHash Root<T>(Func<T, byte[]> encodeKey, ZSet<T> z)
    {
        return RootWith(DefaultHash, encodeKey, z);
    }

    private static MerkleHash DefaultHash(byte[] bytes)
    {
        Span<byte> buf = stackalloc byte[16];
        XxHash128.Hash(bytes, buf);
        var lo = BinaryPrimitives.ReadUInt64LittleEndian(buf.Slice(0, 8));
        var hi = BinaryPrimitives.ReadUInt64LittleEndian(buf.Slice(8, 8));
        return new MerkleHash(hi, lo);
    }
}
