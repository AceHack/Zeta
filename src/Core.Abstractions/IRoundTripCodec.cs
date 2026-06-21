namespace Zeta.Core;

/// <summary>
/// Full round-trip codec (invariant — both encode and decode on same types).
/// </summary>
public interface IRoundTripCodec<TDomain, TWire>
{
    /// <summary>Serialize domain value to wire format.</summary>
    public TWire Encode(TDomain a);

    /// <summary>Deserialize wire format to domain value.</summary>
    public TDomain Decode(TWire b);
}
