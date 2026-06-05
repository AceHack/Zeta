namespace Zeta.Mediator;

/// <summary>
/// The unit value — the one-valued type, returned by a request that produces no meaningful result.
/// In the algebra of types this is the multiplicative identity <c>1</c> (the empty product / terminal
/// object): exactly one inhabitant, carrying zero bits of information. It is the scalar seed — the
/// real-axis basis element the Cayley-Dickson ladder is built over, before any imaginary doubling —
/// not a magnitude (it has no arithmetic), but the <c>1</c> that composition multiplies by for free.
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
