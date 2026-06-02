namespace Zeta.Core.CSharp;

/// <summary>
/// Minimal <c>Result</c> port — C# has no BCL <c>Result</c>, so this oracle owns one (per the
/// BCL-interface-boundary rule, mirroring Core.CSharp.RangeSet / Bonsai). The canonical encoder
/// returns this; no exception crosses the boundary for a legal value (result over throw, per the
/// AGENTS.md hard rule). Mirrors the F# <c>Result&lt;string, EncodeError&gt;</c>.
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
