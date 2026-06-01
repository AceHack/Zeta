namespace Zeta.Core.CSharp.RangeSet;

/// <summary>
/// Minimal <c>Result</c> port — C# has no BCL <c>Result</c>, so this oracle owns one (per the
/// BCL-interface-boundary rule). <c>Parse</c> returns this; no exception crosses the boundary
/// (result over throw). Mirrors the F# <c>Result&lt;_, RangeSetFeedback&gt;</c> and the TS
/// <c>Result&lt;T, E&gt;</c> union — value channel AND feedback channel both first-class.
/// </summary>
/// <typeparam name="T">The success value type.</typeparam>
/// <typeparam name="TError">The feedback (failure) payload type.</typeparam>
public abstract record Result<T, TError>
{
    private Result() { }

    /// <summary>The success case carrying <paramref name="Value"/>.</summary>
    public sealed record Ok(T Value) : Result<T, TError>;

    /// <summary>The failure case carrying the typed <paramref name="Error"/> feedback.</summary>
    public sealed record Err(TError Error) : Result<T, TError>;
}
