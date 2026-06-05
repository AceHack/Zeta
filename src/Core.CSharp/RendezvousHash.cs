namespace Zeta.Core.CSharp;

/// <summary>
/// Rendezvous (HRW) consistent hash (Thaler &amp; Ravishankar 1998), C# oracle. Conforms to the F#
/// canonical shape (<c>src/Core/ConsistentHash.fs</c>, <c>RendezvousHash</c>) by agreeing on the shared
/// seed (<c>src/Core.TypeScript/consistent-hash/golden-vectors.json</c>) that the F#/TS/Rust oracles also
/// verify. Pure wrapping <c>ulong</c> — the score is the (4-lang-proven) SplitMix64 finaliser, so it
/// byte-locks. Jump consistent hash is deliberately not part of this oracle: it uses <c>double</c>
/// arithmetic, and floats are out of Zeta's proof lineage.
/// </summary>
public static class RendezvousHash
{
    private static ulong Mix(ulong x)
    {
        var z = x * SplitMix64.GoldenRatio;
        z = (z ^ (z >> 30)) * SplitMix64.VignaA;
        z = (z ^ (z >> 27)) * SplitMix64.VignaB;
        return z ^ (z >> 31);
    }

    /// <summary>Deterministic per-slot seeds: <c>seed(i) = mix(i)</c> for <c>i in [0, n)</c>.</summary>
    public static ulong[] Seeds(int n)
    {
        var s = new ulong[n];
        for (var i = 0; i < n; i++)
        {
            s[i] = Mix((ulong)i);
        }

        return s;
    }

    /// <summary>Pick a bucket for <paramref name="key"/> by maximum-score-wins (first index on a tie).</summary>
    public static int Pick(int n, ulong key)
    {
        var s = Seeds(n);
        var bestScore = 0UL;
        var bestIdx = 0;
        for (var i = 0; i < s.Length; i++)
        {
            var score = Mix(key ^ s[i]);
            if (score > bestScore)
            {
                bestScore = score;
                bestIdx = i;
            }
        }

        return bestIdx;
    }
}
