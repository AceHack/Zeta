namespace Zeta.Core.Abstractions;

/// <summary>
/// Read/enumeration contract over a tensor — sparse or dense — viewed as a map from coordinate
/// (<typeparamref name="TCoord"/>) to weight/value (<typeparamref name="TWeight"/>).
///
/// <para>
/// The contract is deliberately <b>semiring-free</b>: it exposes only what every backing can answer without
/// an algebra — the explicitly-stored entries, their count, and whether storage is sparse. The algebraic
/// operations (⊕ add, ⊗ scale, contraction/inner, and "value-at-coordinate with the semiring Zero for absent
/// sparse coordinates") require an <c>ISemiring</c> and therefore live with each implementation
/// (F# <c>WeightedSet</c> for sparse; a <c>System.Numerics.Tensors.Tensor&lt;T&gt;</c> wrapper for dense).
/// </para>
///
/// <para>
/// Implementors: <c>Zeta.Core.WeightedSet&lt;'K,'W&gt;</c> (sparse, the Z-set generalization over a semiring)
/// and a future dense wrapper. This is a language-neutral contract authored in C# per the 2026-06-07 naming
/// convention; it is <b>API-review pending (Ilyana)</b> before any public/NuGet exposure.
/// </para>
/// </summary>
/// <typeparam name="TCoord">The coordinate type (sparse key, or an index vector for dense).</typeparam>
/// <typeparam name="TWeight">The weight/value type (an element of the chosen semiring).</typeparam>
public interface ITensor<TCoord, TWeight>
{
    /// <summary>
    /// Number of explicitly-stored entries: the support size for sparse tensors, the full cell count for
    /// dense tensors.
    /// </summary>
    public long StoredCount { get; }

    /// <summary>True when storage is sparse (only nonzero / present coordinates are materialized).</summary>
    public bool IsSparse { get; }

    /// <summary>
    /// The explicitly-stored (coordinate, value) entries: the support for sparse tensors, every cell for
    /// dense. Order is implementation-defined but stable (sparse: ordinal by coordinate).
    /// </summary>
    public IEnumerable<KeyValuePair<TCoord, TWeight>> StoredEntries { get; }
}
