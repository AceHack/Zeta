namespace Zeta.Core.CSharp.Bonsai;

/// <summary>
/// Minimal <c>Result</c> port — C# has no BCL <c>Result</c>, so the Bonsai oracle owns
/// this one (per the BCL-interface-boundary rule: depend only on BCL interfaces, else
/// own your own). <c>Serialize</c>/<c>Parse</c> return this; no exception crosses the
/// boundary (result over throw). A consumer wanting the ecosystem shape (FluentResults,
/// LanguageExt) adapts it at the seam — own-our-interface, tie in at the boundary.
/// Sealed-record hierarchy mirrors the F# <c>Result&lt;_, BonsaiFeedback&gt;</c> and the
/// TS <c>Result&lt;T, TError&gt;</c> discriminated union (the value channel AND the feedback
/// channel are both first-class — asymmetric authorship).
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
