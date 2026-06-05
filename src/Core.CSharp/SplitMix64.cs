namespace Zeta.Core.CSharp;

/// <summary>
/// SplitMix64 finaliser — Sebastiano Vigna's mixer (arxiv 1410.0530 §3; public-domain reference
/// <see href="https://prng.di.unimi.it/splitmix64.c"/>), C# oracle. Conforms to the F# canonical shape
/// (<c>src/Core/SplitMix64.fs</c>) by agreeing on the shared seed
/// (<c>src/Core.TypeScript/splitmix64/golden-vectors.json</c>) that the F#/TS/Rust oracles also verify.
/// Pure wrapping <c>ulong</c> arithmetic (unsigned overflow wraps by default in C#).
/// </summary>
public static class SplitMix64
{
    /// <summary><c>floor(2^64 / phi)</c> — Knuth TAOCP §6.4 multiplicative-hashing constant.</summary>
    public const ulong GoldenRatio = 0x9E3779B97F4A7C15UL;

    /// <summary>First Vigna SplitMix64 finaliser multiplier (arxiv 1410.0530 §3).</summary>
    public const ulong VignaA = 0xBF58476D1CE4E5B9UL;

    /// <summary>Second Vigna SplitMix64 finaliser multiplier (arxiv 1410.0530 §3).</summary>
    public const ulong VignaB = 0x94D049BB133111EBUL;

    /// <summary>Apply the SplitMix64 finaliser to a 64-bit input (5 ops, no allocation).</summary>
    public static ulong Mix(ulong x)
    {
        var z = x * GoldenRatio;
        z = (z ^ (z >> 30)) * VignaA;
        z = (z ^ (z >> 27)) * VignaB;
        return z ^ (z >> 31);
    }
}
