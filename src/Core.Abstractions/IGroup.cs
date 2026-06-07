namespace Zeta.Core;

/// <summary>
/// Group — a monoid where every element has an inverse.
/// </summary>
public interface IGroup<T> : IMonoid<T>
{
    /// <summary>Additive inverse.</summary>
    T Inverse(T a);
}
