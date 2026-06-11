namespace Zeta.Core;

/// <summary>
/// Monoid (T, Combine, Identity) — associative binary operation with a two-sided identity.
/// </summary>
public interface IMonoid<T>
{
    /// <summary>The identity element.</summary>
    public T Identity { get; }

    /// <summary>Associative combination operation.</summary>
    public T Combine(T a, T b);
}
