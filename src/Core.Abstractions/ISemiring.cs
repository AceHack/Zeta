namespace Zeta.Core;

/// <summary>
/// Semiring (ring) interface for first-class uncertainty in DBSP weights.
/// </summary>
public interface ISemiring<TWeight>
{
    /// <summary>Additive identity.</summary>
    public TWeight Zero { get; }

    /// <summary>Multiplicative identity.</summary>
    public TWeight One { get; }

    /// <summary>Additive combination operation (⊕).</summary>
    public TWeight Add(TWeight a, TWeight b);

    /// <summary>Multiplicative scaling/product operation (⊗).</summary>
    public TWeight Mul(TWeight a, TWeight b);

    /// <summary>Additive inverse operation (Negate).</summary>
    public TWeight Negate(TWeight a);
}
