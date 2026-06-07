using System;
using System.Runtime.InteropServices;

namespace Zeta.Core;

/// <summary>
/// A Merkle hash — 128 bits wrapped in a struct for zero-alloc passing and equality checks.
/// Matches the F#/C#/Rust MerkleHash layout.
/// </summary>
[StructLayout(LayoutKind.Sequential)]
public readonly struct MerkleHash : IEquatable<MerkleHash>
{
    /// <summary>High 64 bits.</summary>
    public ulong Hi { get; }
    /// <summary>Low 64 bits.</summary>
    public ulong Lo { get; }

    /// <summary>Construct a MerkleHash from high and low halves.</summary>
    public MerkleHash(ulong hi, ulong lo)
    {
        Hi = hi;
        Lo = lo;
    }

    /// <summary>The all-zero hash (root of the empty tree).</summary>
    public static MerkleHash Zero => new(0, 0);

    /// <summary>Hex representation for log/diagnostic output (Hi then Lo, 16 hex digits each).</summary>
    public string ToHex() => $"{Hi:x16}{Lo:x16}";

    /// <summary>Value equality check.</summary>
    public bool Equals(MerkleHash other) => Hi == other.Hi && Lo == other.Lo;

    /// <summary>Equality check.</summary>
    public override bool Equals(object? obj) => obj is MerkleHash other && Equals(other);

    /// <summary>GetHashCode override.</summary>
    public override int GetHashCode() => (int)(Hi ^ Lo);

    /// <summary>Equality operator.</summary>
    public static bool operator ==(MerkleHash left, MerkleHash right) => left.Equals(right);

    /// <summary>Inequality operator.</summary>
    public static bool operator !=(MerkleHash left, MerkleHash right) => !left.Equals(right);
}
