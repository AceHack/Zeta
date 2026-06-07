namespace Zeta.Core

open System.Runtime.CompilerServices

/// Semiring (ring) interface for first-class uncertainty in DBSP weights.
/// Enables ZSet<'K,'W> parameterization over integer, probabilistic,
/// Gaussian, provenance, etc. semirings; Negate makes it a full ring,
/// which retraction (negative weights) requires.
///
/// Axioms (all implementations must satisfy):
///   (S, Add, Zero) forms a commutative monoid
///   (S, Mul, One)  forms a monoid
///   Mul distributes over Add
///   Mul _ Zero = Zero (annihilator)
///   Negate a `Add` a = Zero (additive inverse, ring axiom)
type ISemiring<'W> =
    abstract member Zero   : 'W                   // additive identity
    abstract member One    : 'W                   // multiplicative identity
    abstract member Add    : 'W -> 'W -> 'W       // ⊕
    abstract member Mul    : 'W -> 'W -> 'W       // ⊗
    abstract member Negate : 'W -> 'W             // additive inverse (ring)


// ═══════════════════════════════════════════════════════════════════
// THE ALGEBRA LADDER below a ring: monoid → group → semilattice
// (instance-passing, like ISemiring — a value may carry several algebras;
//  cf. .NET generic-math static-abstract style, the type-IS-its-algebra
//  alternative used at concrete numeric leaves. We mirror .NET's *names*:
//  Identity ≈ IAdditiveIdentity.AdditiveIdentity, Combine ≈ IAdditionOperators (+),
//  Inverse ≈ IUnaryNegationOperators (-).)
// ═══════════════════════════════════════════════════════════════════

/// **Monoid** `(T, Combine, Identity)` — an associative binary op with a two-sided identity; the minimal
/// algebra for `fold`/aggregation. `Combine` ≈ .NET `IAdditionOperators` (`+`); `Identity` ≈ .NET
/// `IAdditiveIdentity.AdditiveIdentity`.
///   Laws: Combine (Combine a b) c = Combine a (Combine b c);  Combine Identity a = a = Combine a Identity.
type IMonoid<'T> =
    abstract member Identity : 'T
    abstract member Combine  : 'T -> 'T -> 'T

/// **Group** — a monoid in which every element has an inverse. `Inverse` ≈ .NET `IUnaryNegationOperators`
/// (`-`).  Law (additional): Combine a (Inverse a) = Identity = Combine (Inverse a) a.
type IGroup<'T> =
    inherit IMonoid<'T>
    abstract member Inverse : 'T -> 'T

/// **Bounded join-semilattice** — a *commutative* and *idempotent* monoid; `Combine` is the join (`⊔`),
/// `Identity` is bottom (`⊥`). Precisely a CRDT merge / the confluence resolver: out-of-order `Combine`
/// converges to the same result *iff* it is a join-semilattice (see the confluence proof).
///   Laws (additional to monoid): Combine a b = Combine b a;  Combine a a = a.
type ISemilattice<'T> =
    inherit IMonoid<'T>


// ═══════════════════════════════════════════════════════════════════
// INTEGER RING  (ℤ, +, ×)  — the default DBSP weight semiring
// ═══════════════════════════════════════════════════════════════════

/// The integer ring (ℤ, +, ×). Additive inverse exists (full ring),
/// so negative weights encode retractions — this is exactly the
/// multiplicity ring used by the current `ZSet<'K>`.
[<Sealed>]
type IntegerRing() =
    interface ISemiring<int64> with
        member _.Zero     = 0L
        member _.One      = 1L
        member _.Add  a b = Checked.(+) a b
        member _.Mul  a b = Checked.(*) a b
        member _.Negate a = Checked.(~-) a

[<RequireQualifiedAccess>]
module IntegerRing =
    /// Singleton instance — reuse rather than allocate.
    let Instance : ISemiring<int64> = IntegerRing()


// ═══════════════════════════════════════════════════════════════════
// INTERVAL WEIGHT  [lo, hi] ⊂ ℝ  — bounded-uncertainty ring
// ═══════════════════════════════════════════════════════════════════

/// Closed real interval `[Lo, Hi]` forming a ring under interval
/// arithmetic. Represents "the true value lies in this range."
///
/// Arithmetic rules follow Kaucher interval arithmetic:
///   Add:    [a,b] + [c,d] = [a+c, b+d]
///   Mul:    [a,b] * [c,d] = [min(products), max(products)]
///   Negate: -[a,b]        = [-b, -a]
///
/// Uncertainty interpretation: the width (Hi - Lo) is the epistemic
/// uncertainty. A point interval [v, v] is certain. This generalises
/// Spanner's TrueTime [earliest, latest] commit-wait interval to an
/// algebraic ring, making interval uncertainty a first-class DBSP
/// weight — same circuit topology, different semiring.
[<Struct; IsReadOnly; CustomEquality; NoComparison>]
type IntervalWeight =
    val Lo : float
    val Hi : float
    new(lo: float, hi: float) = { Lo = lo; Hi = hi }

    /// Point interval — certain value.
    static member Point(v: float) = IntervalWeight(v, v)
    /// Additive identity: [0, 0].
    static member Zero = IntervalWeight(0.0, 0.0)
    /// Multiplicative identity: [1, 1].
    static member One  = IntervalWeight(1.0, 1.0)
    /// Width = epistemic uncertainty.
    member this.Width  = this.Hi - this.Lo
    member this.IsCertain = this.Lo = this.Hi

    override this.Equals(other) =
        match other with
        | :? IntervalWeight as w -> this.Lo = w.Lo && this.Hi = w.Hi
        | _ -> false
    override this.GetHashCode() =
        let h = System.HashCode()
        h.Add this.Lo; h.Add this.Hi; h.ToHashCode()
    override this.ToString() = sprintf "[%g, %g]" this.Lo this.Hi

[<Sealed>]
type IntervalRing() =
    interface ISemiring<IntervalWeight> with
        member _.Zero = IntervalWeight.Zero
        member _.One  = IntervalWeight.One

        member _.Add a b =
            IntervalWeight(a.Lo + b.Lo, a.Hi + b.Hi)

        // Kaucher multiplication: take hull of all corner products.
        member _.Mul a b =
            let p1 = a.Lo * b.Lo
            let p2 = a.Lo * b.Hi
            let p3 = a.Hi * b.Lo
            let p4 = a.Hi * b.Hi
            IntervalWeight(
                min (min p1 p2) (min p3 p4),
                max (max p1 p2) (max p3 p4))

        member _.Negate a = IntervalWeight(-a.Hi, -a.Lo)

[<RequireQualifiedAccess>]
module IntervalRing =
    /// Singleton instance — reuse rather than allocate.
    let Instance : ISemiring<IntervalWeight> = IntervalRing()
