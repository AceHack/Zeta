namespace Zeta.Core.CSharp.TriBoolean;

/// <summary>
/// Result of <see cref="FloatOps.FromValue"/>: an encoded float, or feedback that the target value
/// is not representable in the given shape (v0 is unsigned + finite, and the value must be a
/// non-negative integer V times a power of two that fits the value field for some mode). Sealed-record
/// hierarchy mirrors F# Result&lt;TriFloat, string&gt; and the TS EncodeResult discriminated union.
/// </summary>
public abstract record EncodeResult
{
    private EncodeResult() { }

    /// <summary>The value was representable; <paramref name="Value"/> is a canonical encoding.</summary>
    public sealed record Encoded(TriFloat Value) : EncodeResult;

    /// <summary>The value is not representable in the shape; <paramref name="Detail"/> says why.</summary>
    public sealed record NotRepresentable(string Detail) : EncodeResult;
}
