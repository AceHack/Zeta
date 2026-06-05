using System;

namespace Zeta.Core.CSharp;

/// <summary>
/// CRC32C (Castagnoli polynomial, reflected 0x82F63B78), C# oracle. Conforms to the F# canonical shape
/// (<c>src/Core/HardwareCrc.fs</c>, <c>HardwareCrc.Crc32C</c>) by agreeing on the shared seed
/// (<c>src/Core.TypeScript/crc32c/golden-vectors.json</c>) that the F#/TS/Rust oracles also verify. The
/// hardware (SSE4.2 / ARMv8) and bitwise forms compute the identical standard CRC32C value; this is the
/// bitwise form. Pure integer.
/// </summary>
public static class Crc32c
{
    private const uint Poly = 0x82F63B78;

    /// <summary>Compute the standard CRC32C of <paramref name="payload"/> (init 0xFFFFFFFF, reflected, final xor).</summary>
    public static uint Compute(ReadOnlySpan<byte> payload)
    {
        var crc = 0xFFFFFFFFu;
        foreach (var b in payload)
        {
            crc ^= b;
            for (var i = 0; i < 8; i++)
            {
                crc = (crc & 1) != 0 ? (crc >> 1) ^ Poly : crc >> 1;
            }
        }

        return crc ^ 0xFFFFFFFFu;
    }
}
