namespace Zeta.Core;

/// <summary>
/// Semiring (rig) interface — the FREE tier of the weight-algebra tower for DBSP weights:
/// additive commutative monoid (<see cref="Zero"/>, <see cref="Add"/>) + multiplicative monoid
/// (<see cref="One"/>, <see cref="Mul"/>) + distributivity + Zero annihilation. Deliberately
/// carries NO additive inverse: lawful semirings provably cannot always supply one (an idempotent
/// semiring — e.g. tropical min-plus — with an invertible element is trivial; Vandiver 1934,
/// Golan 1999, Baccelli–Cohen–Olsder–Quadrat 1992 §3.2). Retraction-capable algebras implement
/// <see cref="IRing{TWeight}"/>, the earned quotient that adds <c>Negate</c>.
/// Law pack: <c>tests/Tests.FSharp/Formal/SemiringRing.Laws.Tests.fs</c>; work-item 081KWG9JQ9H.
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
}
