namespace Zeta.Core;

/// <summary>
/// Kleene algebra — a star-<b>semiring</b>: <see cref="ISemiring{TWeight}"/> plus the
/// iteration operator <see cref="Star"/> (Kleene closure), satisfying
/// <c>Star(a) = One ⊕ (a ⊗ Star(a)) = One ⊕ (Star(a) ⊗ a)</c>.
///
/// <para>
/// The star here is the <b>KLEENE star (iteration / reflexive-transitive closure)</b>,
/// NOT the involution star (<c>Conj</c>) of <see cref="IStarRing{TWeight}"/> — the two
/// are unrelated operations on deliberately separate branches. Kleene algebras have NO
/// additive inverse (their addition is typically idempotent — e.g. tropical min-plus,
/// booleans, regular-language union), so this extends <see cref="ISemiring{TWeight}"/>,
/// never <see cref="IRing{TWeight}"/> (081KWG9JQ9H: retraction is an <c>IRing</c> thing;
/// closure is a <c>IKleeneAlgebra</c> thing — orthogonal).
/// </para>
///
/// <para>
/// The point (Lehmann 1977; Kozen 1994): a Kleene algebra is exactly the structure over
/// which the <b>matrix star computes the all-pairs closure</b> — all-pairs shortest paths
/// over the tropical (min,+) Kleene algebra, transitive closure over the boolean one,
/// regular expressions over languages. One algorithm, chosen by instance.
/// </para>
/// </summary>
/// <typeparam name="TWeight">The element type (a tropical weight, boolean, language, …).</typeparam>
public interface IKleeneAlgebra<TWeight> : ISemiring<TWeight>
{
    /// <summary>
    /// Kleene closure (iteration): <c>Star(a) = One ⊕ a ⊕ (a⊗a) ⊕ … </c>, the least
    /// fixpoint of <c>x = One ⊕ (a ⊗ x)</c>. For tropical (min,+) with non-negative
    /// weights this is <c>One</c> (= 0): a self-loop can never improve a shortest path.
    /// </summary>
    public TWeight Star(TWeight a);
}
