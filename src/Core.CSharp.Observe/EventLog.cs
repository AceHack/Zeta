using System.Numerics;

namespace Zeta.Core.CSharp.Observe;

/// <summary>
/// The observe event log as a <em>monoid</em>, made machine-recognized via
/// <c>System.Numerics</c> generic-math additive interfaces (B-0867.28 — the
/// interface-gate before building on top of the algebra). It wraps the
/// append-only list of <see cref="NextAction"/> events.
///
/// <para><b>Why additive-monoid (not <c>INumber&lt;T&gt;</c>)</b>: the event log is
/// the <em>free monoid</em> — identity = the empty log, operation = associative
/// append — and nothing more. It is not a field-like number (no multiplication,
/// no ordering, no negatives), so it implements only
/// <see cref="IAdditiveIdentity{TSelf, TResult}"/> +
/// <see cref="IAdditionOperators{TSelf, TOther, TResult}"/>, the exact algebraic
/// structure it has. (Decision: additive-monoidal only — operator 2026-05-31.)</para>
///
/// <para><b>The load-bearing law</b> is the homomorphism
/// <see cref="FoldOnto"/>: folding a concatenated log equals folding the second
/// onto the result of folding the first —
/// <c>(a + b).FoldOnto(w0) == b.FoldOnto(a.FoldOnto(w0))</c>. That is exactly the
/// append-only-replay-soundness / DST-replay property: re-folding a joined log
/// reproduces the same state as incremental folding. <c>Fold</c> is the monoid
/// action of (<see cref="EventLog"/>, +, empty) on <see cref="World"/>.</para>
///
/// <para>NOTE (consistent with <see cref="World"/>): the record's generated
/// equality compares <see cref="Events"/> by reference, not element-wise — value
/// comparison of two logs must compare <see cref="Events"/> with
/// <c>SequenceEqual</c>. UoM (<c>[&lt;Measure&gt;]</c>) is intentionally absent:
/// the observe <see cref="World"/> carries no measurable numeric quantity to
/// protect (only ids, flags, and a mode), so units here would be ceremony, not
/// safety; UoM lives where measurable quantities do (TriFloat values, the
/// attention/tick/dora domain).</para>
/// </summary>
public sealed record EventLog
    : IAdditiveIdentity<EventLog, EventLog>,
      IAdditionOperators<EventLog, EventLog, EventLog>
{
    /// <summary>The append-only event log (MSB-of-history first). Defensively
    /// COPIED on construction (see the constructor) so a caller's later mutation of
    /// a passed-in mutable list cannot change what <see cref="FoldOnto"/> replays
    /// or what <c>+</c> appends — the free-monoid stability this type exists to
    /// guarantee. Compared STRUCTURALLY (element-wise — see <see cref="Equals(EventLog?)"/>
    /// + <see cref="GetHashCode"/>), so the advertised monoid laws hold through
    /// <c>==</c> and hash-based collections.</summary>
    public IReadOnlyList<NextAction> Events { get; }

    /// <summary>Construct a log, defensively copying <paramref name="events"/> into a
    /// <see cref="System.Collections.ObjectModel.ReadOnlyCollection{T}"/> wrapper over a
    /// private array — so the log is genuinely append-only and immutable regardless of
    /// what the caller does with its argument afterward, AND the exposed
    /// <see cref="Events"/> cannot be downcast to a mutable array and rewritten
    /// (assigning a bare <c>T[]</c> to the <see cref="IReadOnlyList{T}"/> property would
    /// leave that hole; the read-only wrapper closes it).</summary>
    /// <param name="events">The events to copy into this log.</param>
    public EventLog(IReadOnlyList<NextAction> events) => Events = Array.AsReadOnly(events.ToArray());

    /// <summary>The empty log — the monoid identity. <c>empty + x == x == x + empty</c>.</summary>
    public static EventLog AdditiveIdentity { get; } = new(Array.Empty<NextAction>());

    /// <summary>Associative append — the free-monoid operation.</summary>
    public static EventLog operator +(EventLog left, EventLog right) =>
        new(left.Events.Concat(right.Events).ToList());

    /// <summary>Project this log onto an initial world: the monoid action /
    /// homomorphism to <see cref="World"/>. Equivalent to
    /// <c>Algebra.Fold(initial, Events)</c>; satisfies
    /// <c>(a + b).FoldOnto(w0) == b.FoldOnto(a.FoldOnto(w0))</c>.</summary>
    public World FoldOnto(World initial) => Algebra.Fold(initial, Events);

    /// <summary>Structural equality — element-wise over <see cref="Events"/> — so the
    /// advertised monoid laws actually hold through <c>==</c>, <see cref="object.Equals(object)"/>,
    /// and hash-based collections (<c>AdditiveIdentity + x == x</c>; associativity).
    /// The compiler-generated record equality would compare <see cref="Events"/> by
    /// REFERENCE (C# records do reference equality on list-typed properties), which
    /// breaks those laws — so it is overridden here. (The F# observe-fold EventLog is
    /// structural by construction; this brings C# to parity.)</summary>
    public bool Equals(EventLog? other) =>
        other is not null && Events.SequenceEqual(other.Events);

    /// <summary>Hash consistent with the structural <see cref="Equals(EventLog?)"/>:
    /// combined over the event sequence (order-sensitive — the log is ordered).</summary>
    public override int GetHashCode()
    {
        var hash = new HashCode();
        foreach (var ev in Events)
        {
            hash.Add(ev);
        }

        return hash.ToHashCode();
    }
}
