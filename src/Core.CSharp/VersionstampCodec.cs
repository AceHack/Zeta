// VersionstampCodec.cs — Gate T2 canonical Versionstamp big-endian codec (C# oracle).
// Encodes/decodes a Versionstamp as an unsigned 64-bit integer in network byte order (8 bytes).
// Mirrors F# Versionstamp.encode/decode in src/Core/Clock.fs.
// Golden vectors: src/Core.TypeScript/clock/tick-codec-golden-vectors.json.
using System;
using System.Buffers.Binary;

namespace Zeta.Core.CSharp;

/// <summary>
/// Gate T2 — canonical 8-byte big-endian codec for the Versionstamp (tick index).
/// The int64 version is treated as unsigned 64-bit in network byte order.
/// </summary>
public static class VersionstampCodec
{
    /// <summary>The number of bytes in a canonical Versionstamp encoding.</summary>
    public const int EncodedSize = 8;

    /// <summary>Encode a versionstamp to an 8-byte big-endian buffer.</summary>
    public static byte[] Encode(long version)
    {
        var buf = new byte[EncodedSize];
        BinaryPrimitives.WriteUInt64BigEndian(buf, (ulong)version);
        return buf;
    }

    /// <summary>Encode a versionstamp into an existing span (must be ≥ 8 bytes).</summary>
    public static void Encode(long version, Span<byte> destination)
    {
        if (destination.Length < EncodedSize)
            throw new ArgumentException($"Destination must be at least {EncodedSize} bytes.", nameof(destination));
        BinaryPrimitives.WriteUInt64BigEndian(destination, (ulong)version);
    }

    /// <summary>Decode an 8-byte big-endian buffer to a versionstamp.</summary>
    public static long Decode(ReadOnlySpan<byte> buf)
    {
        if (buf.Length < EncodedSize)
            throw new ArgumentException($"Buffer must be at least {EncodedSize} bytes.", nameof(buf));
        return (long)BinaryPrimitives.ReadUInt64BigEndian(buf);
    }

    /// <summary>Hex-encode a byte array (no prefix, lowercase).</summary>
    public static string ToHex(byte[] buf) => Convert.ToHexString(buf).ToLowerInvariant();
}
