namespace Zeta.Core.CSharp.TriBoolean;

/// <summary>
/// Result of <see cref="FloatOps.Decode"/> / <see cref="FloatOps.Measure"/>: a decoded number, or
/// feedback that the float is held (cannot collapse). Sealed-record hierarchy mirrors F#
/// Result&lt;double, FloatFeedback&gt; and the TS DecodeResult discriminated union
/// (asymmetric-authorship: the value channel AND the feedback channel are both first-class).
/// </summary>
public abstract record DecodeResult
{
    private DecodeResult() { }

    /// <summary>The float was fully certain; it decoded to <paramref name="Value"/>.</summary>
    public sealed record Decoded(double Value) : DecodeResult;

    /// <summary>The float is held; collapsing it is surfaced as <paramref name="Feedback"/>.</summary>
    public sealed record Held(FloatFeedback Feedback) : DecodeResult;
}
