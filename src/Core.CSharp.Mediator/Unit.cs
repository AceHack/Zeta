namespace Zeta.Mediator;

/// <summary>
/// The unit value — the one-valued type, returned by a request that produces no meaningful result.
/// In the algebra of types this is the multiplicative identity <c>1</c> (the empty product / terminal
/// object) of the type semiring (sum = <c>Either</c>, product = tuple, empty type = the additive
/// <c>0</c>): exactly one inhabitant, carrying zero bits of information, and the <c>1</c> that
/// composition multiplies by for free. That is the whole closed fact.
///
/// Note (do not chain the symbol): this type-semiring <c>1</c> is NOT the field-unit of ℝ / the
/// Cayley-Dickson real-axis seed — that is a different <c>1</c> in a different category (full field
/// arithmetic, the seed of a normed division algebra), with no clean structure-preserving map to this
/// one. Any tie between this <c>1</c> and the hex-core / Cayley dimensional ladder is an unproven
/// resemblance (FROZEN-CORE register §B), not an isomorphism — same symbol, different structures.
///
/// C# lacks a built-in <c>unit</c> (it has the non-composable <c>void</c> hole instead), so we own
/// one here and use it across the system. F# uses its native <c>unit</c> and bridges to this at the
/// port boundary. A void request is <see cref="IRequest"/> = <c>IRequest&lt;Unit&gt;</c>; its handler
/// returns <c>ValueTask&lt;Unit&gt;</c> carrying <see cref="Value"/>.
/// </summary>
public readonly record struct Unit
{
    /// <summary>The single inhabitant of <see cref="Unit"/> — the value <c>()</c>.</summary>
    public static readonly Unit Value;

    /// <summary>A completed task yielding the unit value — for handlers with nothing to return.</summary>
    public static ValueTask<Unit> ValueTask => new(Value);
}
