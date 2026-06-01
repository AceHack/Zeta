namespace Zeta.Core.CSharp.RangeSet;

/// <summary>
/// The typed reasons <c>Parse</c> declines — the shared cross-oracle rejection-vector contract
/// (variant-for-variant parity with the TS/F# oracles).
/// </summary>
public abstract record RangeSetFeedback
{
    private RangeSetFeedback() { }

    /// <summary>A token (or sub-token) was not a non-negative safe integer.</summary>
    public sealed record NotInteger(string Token) : RangeSetFeedback;

    /// <summary>A range <c>lo-hi</c> had <c>lo &gt; hi</c>.</summary>
    public sealed record InvertedRange(long Lo, long Hi) : RangeSetFeedback;

    /// <summary>A structurally bad token (empty between commas, trailing comma, empty sub-token,
    /// too many dashes).</summary>
    public sealed record Malformed(string Token) : RangeSetFeedback;
}
