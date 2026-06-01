namespace Zeta.Core.CSharp.Bonsai;

/// <summary>
/// The bonsai-domain feedback channel — the typed reasons <c>Serialize</c>/<c>Parse</c>
/// decline, the shared cross-oracle payload contract. Sealed-record hierarchy mirrors the
/// F# <c>BonsaiFeedback</c> DU and the TS <c>BonsaiFeedback</c> union variant-for-variant,
/// so every oracle declines the same bad input with the same variant (the cross-language
/// rejection-vector contract). The <c>Where</c> fields are JSON-path keys so a
/// <c>BonsaiFeedback</c> list maps onto an RFC-9457 ProblemDetails <c>errors</c> map in the
/// accumulate mode.
/// </summary>
public abstract record BonsaiFeedback
{
    private BonsaiFeedback() { }

    /// <summary>The document <c>v</c> field was a version this oracle does not support.</summary>
    public sealed record UnsupportedVersion(int Found, int Expected) : BonsaiFeedback;

    /// <summary>The input was not well-formed JSON (or violated a structural shape).</summary>
    public sealed record MalformedJson(string Message) : BonsaiFeedback;

    /// <summary>A node carried a <c>kind</c> outside the subset.</summary>
    public sealed record UnknownKind(string NodeKind) : BonsaiFeedback;

    /// <summary>A constant carried a <c>t</c> tag outside <c>int/str/bool/null</c>.</summary>
    public sealed record UnknownConstTag(string Tag) : BonsaiFeedback;

    /// <summary>A binary node carried an operator outside the subset.</summary>
    public sealed record UnknownOp(string Op) : BonsaiFeedback;

    /// <summary>A field expected to be a string was not (<c>Where</c> names the field).</summary>
    public sealed record ExpectedString(string Where) : BonsaiFeedback;

    /// <summary>A field expected to be a boolean was not (<c>Where</c> names the field).</summary>
    public sealed record ExpectedBool(string Where) : BonsaiFeedback;

    /// <summary>A field expected to be an integer was not (<c>Where</c> names the field).</summary>
    public sealed record ExpectedInt(string Where) : BonsaiFeedback;

    /// <summary>An integer literal was outside the shared JS-safe-integer range (a peer oracle
    /// could not preserve it) — never silently rounded.</summary>
    public sealed record NonSafeInt(long Value) : BonsaiFeedback;

    /// <summary>Expression nesting exceeded the shared <see cref="BonsaiCodec.MaxDepth"/>.</summary>
    public sealed record TooDeep(int Limit) : BonsaiFeedback;

    /// <summary>The input was structurally valid but not in canonical byte form
    /// (extra fields, whitespace, reordered keys) — the canonical-only contract.</summary>
    public sealed record NonCanonical : BonsaiFeedback;
}
