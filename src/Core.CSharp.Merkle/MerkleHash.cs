using System.Buffers.Binary;
using System.IO.Hashing;
using System.Runtime.InteropServices;

namespace Zeta.Core.CSharp;

/// <summary>
/// A Merkle hash — 128 bits (Hi/Lo). C# oracle for the Merkle integrity primitive,
/// conforming byte-for-byte to the F# canonical shape (<c>src/Core/Merkle.fs</c>):
/// same XxHash128 leaf hash and the same little-endian Hi/Lo combine layout, so the
/// root over a given leaf sequence is identical across F# and C#.
/// </summary>
[StructLayout(LayoutKind.Auto)]
public readonly record struct MerkleHash(ulong Hi, ulong Lo)
{
    /// <summary>The all-zero hash (root of the empty tree).</summary>
    public static readonly MerkleHash Zero = new(0UL, 0UL);

    /// <summary>Hex representation (Hi then Lo, 16 hex digits each) — matches F#'s ToHex.</summary>
    public string ToHex() => $"{Hi:x16}{Lo:x16}";

    /// <summary>Hash a leaf (raw bytes) into a <see cref="MerkleHash"/>.</summary>
    public static MerkleHash OfBytes(ReadOnlySpan<byte> bytes)
    {
        Span<byte> buf = stackalloc byte[16];
        XxHash128.Hash(bytes, buf);
        var lo = BinaryPrimitives.ReadUInt64LittleEndian(buf.Slice(0, 8));
        var hi = BinaryPrimitives.ReadUInt64LittleEndian(buf.Slice(8, 8));
        return new MerkleHash(hi, lo);
    }

    /// <summary>Combine two child hashes into a parent (the internal-node construction).</summary>
    public static MerkleHash Combine(MerkleHash a, MerkleHash b)
    {
        Span<byte> buf = stackalloc byte[32];
        BinaryPrimitives.WriteUInt64LittleEndian(buf.Slice(0, 8), a.Hi);
        BinaryPrimitives.WriteUInt64LittleEndian(buf.Slice(8, 8), a.Lo);
        BinaryPrimitives.WriteUInt64LittleEndian(buf.Slice(16, 8), b.Hi);
        BinaryPrimitives.WriteUInt64LittleEndian(buf.Slice(24, 8), b.Lo);
        return OfBytes(buf);
    }
}
