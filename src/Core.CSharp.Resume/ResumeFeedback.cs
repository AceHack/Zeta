namespace Zeta.Core.CSharp.Resume;

/// <summary>
/// The typed reasons the resume evaluator declines — the shared cross-oracle payload contract.
/// Sealed-record hierarchy mirrors the F# <c>ResumeFeedback</c> DU and the TS
/// <c>ResumeFeedback</c> union variant-for-variant, so every oracle declines the same bad input
/// with the same variant (the cross-language rejection-vector contract). The value channel AND
/// the feedback channel are both first-class (asymmetric authorship).
/// </summary>
public abstract record ResumeFeedback
{
    private ResumeFeedback() { }

    /// <summary>A parameter reference had no binding in the environment.</summary>
    public sealed record Unbound(string Name) : ResumeFeedback;

    /// <summary>A value was the wrong runtime type for the operation (<c>Where</c> names the
    /// site; <c>Expected</c> is the wanted type tag).</summary>
    public sealed record TypeMismatch(string Where, string Expected) : ResumeFeedback;

    /// <summary>A node kind outside the slice-1 evaluable subset (e.g. a <c>lambda</c> in
    /// evaluation position) was reached.</summary>
    public sealed record UnsupportedNode(string NodeKind) : ResumeFeedback;

    /// <summary>An int operation/value left the shared JS-safe-integer wire domain (the Bonsai
    /// safe-int contract) — never silently wrapped or rounded.</summary>
    public sealed record NonSafeInt(long Value) : ResumeFeedback;

    /// <summary>A persisted state was malformed (bad JSON, unsupported version, tampered op,
    /// unsafe int, or a structural shape violation).</summary>
    public sealed record MalformedState(string Message) : ResumeFeedback;
}
