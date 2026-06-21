namespace Zeta.Core;

/// <summary>
/// Full lattice: join (LUB) + meet (GLB). Symmetric with Rust/Go/TS/Python/F#.
/// ISemilattice (join-only) remains for CRDT-merge-only use cases.
/// </summary>
/// <remarks>
/// Laws:
/// - Join is idempotent: Join(a, a) = a
/// - Join is commutative: Join(a, b) = Join(b, a)
/// - Join is associative: Join(Join(a,b),c) = Join(a,Join(b,c))
/// - Meet is idempotent: Meet(a, a) = a
/// - Meet is commutative: Meet(a, b) = Meet(b, a)
/// - Meet is associative: Meet(Meet(a,b),c) = Meet(a,Meet(b,c))
/// - Absorption: Join(a, Meet(a,b)) = a; Meet(a, Join(a,b)) = a
/// </remarks>
public interface ILattice<T>
{
    /// <summary>Least upper bound (⊔). Idempotent, commutative, associative.</summary>
    public T Join(T a, T b);

    /// <summary>Greatest lower bound (⊓). Idempotent, commutative, associative.</summary>
    public T Meet(T a, T b);
}
