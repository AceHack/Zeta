namespace Zeta.Core;

/// <summary>
/// Ring interface — the EARNED quotient over <see cref="ISemiring{TWeight}"/>: declares the one
/// added relation, the additive inverse (<see cref="Negate"/>: <c>Add(a, Negate(a)) = Zero</c>).
/// This is what retraction requires — Z-set difference, undo, DBSP rollback all need a full ring
/// (which is why the Z-set multiplicity algebra is ℤ, per DBSP/Budiu). Mirrors the in-assembly
/// precedent <c>IGroup : IMonoid</c> (capability earned via subinterface, never a throwing member).
/// Semirings that provably cannot negate (tropical min-plus) stay at <see cref="ISemiring{TWeight}"/>
/// and misuse of retraction over them is a COMPILE error, not a runtime throw (081KWG9JQ9H).
/// </summary>
public interface IRing<TWeight> : ISemiring<TWeight>
{
    /// <summary>Additive inverse: <c>Add(a, Negate(a)) = Zero</c> (the ring axiom).</summary>
    public TWeight Negate(TWeight a);
}
