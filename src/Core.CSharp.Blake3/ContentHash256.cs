using System;
using System.Buffers.Binary;
using Zeta.Core;

namespace Zeta.Core.CSharp.Blake3;

/// <summary>
/// <b>ContentHash256</b> — the full 256-bit raw BLAKE3 digest (the proof tier; treaty <c>081KTH59TVZ</c>).
/// </summary>
public sealed class ContentHash256 : IEquatable<ContentHash256>
{
    public byte[] Raw { get; }

    public ContentHash256(byte[] raw)
    {
        if (raw == null || raw.Length != 32)
        {
            throw new ArgumentException("BLAKE3-256 digest must be exactly 32 bytes.", nameof(raw));
        }
        Raw = raw;
    }

    /// <summary>Lowercase hex of the raw 32 bytes (no reversal) — the canonical proof rendering.</summary>
    public string ToHex() => Convert.ToHexStringLower(Raw);

    public bool Equals(ContentHash256? other)
    {
        if (other is null) return false;
        return Raw.AsSpan().SequenceEqual(other.Raw);
    }

    public override bool Equals(object? obj) => Equals(obj as ContentHash256);

    public override int GetHashCode()
    {
        if (Raw == null || Raw.Length < 4) return 0;
        return (int)BinaryPrimitives.ReadUInt32LittleEndian(Raw.AsSpan(0, 4));
    }

    /// <summary>The full raw BLAKE3-256 digest of bytes (32 bytes, raw order).</summary>
    public static ContentHash256 OfBytes(byte[] bytes)
    {
        var hash = global::Blake3.Hasher.Hash(bytes);
        return new ContentHash256(hash.AsSpan().ToArray());
    }

    /// <summary>Parse a 32-byte BLAKE3-256 digest from its hex string representation (allows optional 'blake3:' prefix).</summary>
    public static ContentHash256 OfHex(string hex)
    {
        var hexClean = hex.StartsWith("blake3:", StringComparison.Ordinal) ? hex.Substring(7) : hex;
        return new ContentHash256(Convert.FromHexString(hexClean));
    }

    /// <summary>Derive the compact ContentAddress128 (MerkleHash) from the full digest.</summary>
    public static MerkleHash ToContentAddress128(ContentHash256 h)
    {
        ulong lo = BinaryPrimitives.ReadUInt64LittleEndian(h.Raw.AsSpan(0, 8));
        ulong hi = BinaryPrimitives.ReadUInt64LittleEndian(h.Raw.AsSpan(8, 8));
        return new MerkleHash(hi, lo);
    }
}
