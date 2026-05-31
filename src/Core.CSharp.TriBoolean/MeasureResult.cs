namespace Zeta.Core.CSharp.TriBoolean;

/// <summary>
/// Result of <see cref="TriOps.Measure"/>: a resolved boolean, or feedback that a living cell was
/// asked to collapse. Sealed-record hierarchy mirrors F# Result&lt;bool, CollapseFeedback&gt; and
/// the TS MeasureResult discriminated union (asymmetric-authorship: the value channel AND the
/// feedback channel are both first-class).
/// </summary>
public abstract record MeasureResult
{
    private MeasureResult() { }

    /// <summary>The cell was certain; it resolved to <paramref name="Value"/>.</summary>
    public sealed record Resolved(bool Value) : MeasureResult;

    /// <summary>The cell was living (Tri.N); collapsing it is surfaced as feedback.</summary>
    public sealed record Collapsed(CollapseFeedback Feedback) : MeasureResult;
}
