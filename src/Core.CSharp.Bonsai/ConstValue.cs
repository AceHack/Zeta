namespace Zeta.Core.CSharp.Bonsai;

/// <summary>
/// A literal value — tagged so every oracle round-trips the type exactly. Sealed-record
/// hierarchy mirrors the F# <c>ConstValue</c> DU and the TS <c>ConstValue</c> union.
/// </summary>
public abstract record ConstValue
{
    private ConstValue() { }

    /// <summary>An integer literal (no floats in the subset; the shared JS-safe-integer range).</summary>
    public sealed record Number(long Value) : ConstValue;

    /// <summary>A string literal.</summary>
    public sealed record Str(string Value) : ConstValue;

    /// <summary>A boolean literal.</summary>
    public sealed record Bool(bool Value) : ConstValue;

    /// <summary>The null literal.</summary>
    public sealed record Null : ConstValue;
}
