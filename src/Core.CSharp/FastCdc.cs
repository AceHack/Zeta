using System.Collections.Generic;

namespace Zeta.Core.CSharp;

/// <summary>
/// FastCDC content-defined chunking (Xia et al., USENIX ATC 2016; arXiv:1706.03410), C# oracle. Conforms
/// to the F# canonical shape (<c>src/Core/FastCdc.fs</c>, <c>FastCdc.chunkAll</c>) by agreeing on the
/// shared seed (<c>src/Core.TypeScript/fastcdc/golden-vectors.json</c>) that the F#/TS/Rust oracles also
/// verify. Pure wrapping <c>ulong</c> — the Gear table is SplitMix64.mix(i), the rolling hash is
/// <c>(hash &lt;&lt; 1) + GEAR[byte]</c>, normalized masks 2^15-1 / 2^11-1.
/// </summary>
public static class FastCdc
{
    private const ulong MaskS = (1UL << 15) - 1; // stricter (offset < avg)
    private const ulong MaskL = (1UL << 11) - 1; // looser (offset >= avg)

    private static ulong Mix(ulong x)
    {
        var z = x * SplitMix64.GoldenRatio;
        z = (z ^ (z >> 30)) * SplitMix64.VignaA;
        z = (z ^ (z >> 27)) * SplitMix64.VignaB;
        return z ^ (z >> 31);
    }

    /// <summary>The GEAR lookup table: 256 entries, <c>table[i] = SplitMix64.mix(i)</c>.</summary>
    public static ulong[] GearTable()
    {
        var t = new ulong[256];
        for (var i = 0; i < 256; i++)
        {
            t[i] = Mix((ulong)i);
        }

        return t;
    }

    /// <summary>Deterministic test byte stream: <c>byte[i] = mix(i) &amp; 0xFF</c>.</summary>
    public static byte[] GenBytes(int count)
    {
        var b = new byte[count];
        for (var i = 0; i < count; i++)
        {
            b[i] = (byte)(Mix((ulong)i) & 0xFF);
        }

        return b;
    }

    /// <summary>Chunk an entire byte array; returns chunk LENGTHS in order. Mirrors <c>FastCdc.chunkAll</c>.</summary>
    public static IReadOnlyList<int> ChunkLengths(byte[] bytes, int min, int avg, int max)
    {
        var gear = GearTable();
        var n = bytes.Length;
        var lengths = new List<int>();
        var head = 0;
        while (head < n)
        {
            var end = n; // default: flush trailing remainder as one chunk
            if (head + min < n)
            {
                var hash = 0UL;
                var i = head + min;
                while (i < n)
                {
                    hash = (hash << 1) + gear[bytes[i]];
                    var offset = i - head;
                    var mask = offset < avg ? MaskS : MaskL;
                    if ((hash & mask) == 0)
                    {
                        end = i + 1;
                        break;
                    }

                    if (offset + 1 >= max)
                    {
                        end = i + 1;
                        break;
                    }

                    i++;
                }
            }

            lengths.Add(end - head);
            head = end;
        }

        return lengths;
    }
}
