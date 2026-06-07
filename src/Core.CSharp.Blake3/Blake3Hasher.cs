using System;
using System.Buffers.Binary;
using Zeta.Core;

namespace Zeta.Core.CSharp.Blake3;

/// <summary>
/// <b>BLAKE3 adapter for the IContentHasher port</b> — the tamper-evident (cryptographic) content hash for
/// the C# implementation.
/// </summary>
public sealed class Blake3Hasher : IContentHasher
{
    public static readonly IContentHasher Instance = new Blake3Hasher();

    public string Name => "blake3";

    public MerkleHash Hash(byte[] value)
    {
        var digest = global::Blake3.Hasher.Hash(value);
        var span = digest.AsSpan();
        ulong lo = BinaryPrimitives.ReadUInt64LittleEndian(span.Slice(0, 8));
        ulong hi = BinaryPrimitives.ReadUInt64LittleEndian(span.Slice(8, 8));
        return new MerkleHash(hi, lo);
    }
}
