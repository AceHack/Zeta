using System;
using Zeta.Core;

namespace Zeta.Core.CSharp;

/// <summary>
/// C# implementation of the 64-bit integer ring, avoiding namespace collisions.
/// </summary>
public sealed class IntegerRing : IRing<long>
{
    /// <summary>
    /// The singleton instance of the integer ring.
    /// </summary>
    public static readonly IRing<long> Instance = new IntegerRing();

    private IntegerRing() { }

    /// <inheritdoc/>
    public long Zero => 0L;

    /// <inheritdoc/>
    public long One => 1L;

    /// <inheritdoc/>
    public long Add(long a, long b) => checked(a + b);

    /// <inheritdoc/>
    public long Mul(long a, long b) => checked(a * b);

    /// <inheritdoc/>
    public long Negate(long a) => checked(-a);
}
