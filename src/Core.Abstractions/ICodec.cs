namespace Zeta.Core;

/// <summary>
/// Generic codec: encode/decode pair with variance annotations.
/// A is contravariant (domain input), B is covariant (wire output).
/// The serialization contract — DynamicValue ↔ domain types.
/// </summary>
/// <remarks>
/// Laws:
/// - Round-trip: Decode(Encode(a)) = a (for all valid a)
/// - Encode is total: never throws on valid domain values
/// - Decode may fail: invalid wire format → error (not silent corruption)
/// </remarks>
/// <typeparam name="TDomain">The domain type (contravariant — consumers can widen).</typeparam>
/// <typeparam name="TWire">The wire type (covariant — producers can narrow).</typeparam>
public interface ICodec<in TDomain, out TWire>
{
    /// <summary>Serialize domain value to wire format.</summary>
    public TWire Encode(TDomain a);
}
