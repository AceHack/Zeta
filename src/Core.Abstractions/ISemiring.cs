namespace Zeta.Core;

/// <summary>
/// Semiring (ring) interface for first-class uncertainty in DBSP weights.
/// </summary>
public interface ISemiring<TWeight>
{
    /// <summary>Additive identity.</summary>
    TWeight Zero { get; }

    /// <summary>Multiplicative identity.</summary>
    TWeight One { get; }

    /// <summary>Additive combination operation (⊕).</summary>
    TWeight Add(TWeight a, TWeight b);

    /// <summary>Multiplicative scaling/product operation (⊗).</summary>
    TWeight Mul(TWeight a, TWeight b);

    /// <summary>Additive inverse operation (Negate).</summary>
    TWeight Negate(TWeight a);
}
