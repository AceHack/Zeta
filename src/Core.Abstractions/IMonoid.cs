namespace Zeta.Core;

/// <summary>
/// Monoid (T, Combine, Identity) — associative binary operation with a two-sided identity.
/// </summary>
public interface IMonoid<T>
{
    /// <summary>The identity element.</summary>
    T Identity { get; }

    /// <summary>Associative combination operation.</summary>
    T Combine(T a, T b);
}
