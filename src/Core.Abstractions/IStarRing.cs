namespace Zeta.Core;

/// <summary>
/// A *-ring: a ring (<see cref="ISemiring{TWeight}"/> — Zero/One/Add/Mul/Negate) extended with an
/// involution <see cref="Conj"/>. This is the unified floor rung for Cayley–Dickson hypercomplex towers
/// (Complex / Quaternion / Octonion / Sedenion): each tower is an <c>IStarRing</c>, hence an
/// <see cref="ISemiring{TWeight}"/>, so the generic semiring substrate (<c>WeightedSet&lt;'K, 'W&gt;</c>,
/// hypercomplex Z-sets, the soft layer, the instance-swap) carries hypercomplex weights for free — by
/// instance-selection alone, no per-tower code.
///
/// <para>
/// <b>Law profile (carried as documentation, not types):</b> <c>Add</c> is always commutative + associative;
/// <c>Mul</c> loses commutativity above ℂ, associativity above ℍ, and alternativity above 𝕆. Consumers that
/// require <c>Mul</c> associativity (e.g. matrix-style contraction) must stay at ℍ or below. The interface is
/// a lawful dictionary of operations; the per-instance <c>Mul</c> guarantees are the caller's responsibility.
/// </para>
///
/// Replaces the former F#-local <c>CayleyDickson.IAlgebra</c> (which lacked <c>One</c> and was disjoint from
/// the floor); authored in C# per the contract-library convention (interface libs are C#, language-neutral).
/// </summary>
/// <typeparam name="TWeight">The element type (a hypercomplex tower level, or any *-ring element).</typeparam>
public interface IStarRing<TWeight> : ISemiring<TWeight>
{
    /// <summary>The involution (conjugation): identity on ℝ, complex conjugate on ℂ, recursive beyond.</summary>
    TWeight Conj(TWeight a);
}
