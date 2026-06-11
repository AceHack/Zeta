namespace Zeta.Core;

/// <summary>
/// Group — a monoid where every element has an inverse.
/// </summary>
public interface IGroup<T> : IMonoid<T>
{
    /// <summary>Additive inverse.</summary>
    public T Inverse(T a);
}
