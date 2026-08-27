namespace Zeta.Core

open System.Runtime.CompilerServices

/// Weight-algebra instances for DBSP weights, over the SPLIT tower
/// (081KWG9JQ9H): `ISemiring` (Zero/One/Add/Mul — the free tier) and
/// `IRing : ISemiring` (+ Negate — the earned quotient retraction requires).
///
/// Semiring axioms (every implementation):
///   (S, Add, Zero) forms a commutative monoid
///   (S, Mul, One)  forms a monoid
///   Mul distributes over Add
///   Mul _ Zero = Zero (annihilator)
/// Ring axiom (IRing implementations only):
///   Negate a `Add` a = Zero (additive inverse)
/// Law pack: tests/Tests.FSharp/Formal/SemiringRing.Laws.Tests.fs.
// Algebraic interfaces (ISemiring, IRing, IMonoid, IGroup, ISemilattice) are defined in C#
// (Zeta.Core.Abstractions) per the contract-library convention (interface libs are C#,
// language-neutral). NOTE: TWeight is necessarily INVARIANT in this family (input and output
// positions) — the earlier "to support generic variance" rationale was inaccurate (Ilyana).


// ═══════════════════════════════════════════════════════════════════
// INTEGER RING  (ℤ, +, ×)  — the default DBSP weight semiring
// ═══════════════════════════════════════════════════════════════════

/// The integer ring (ℤ, +, ×). Additive inverse exists (full ring),
/// so negative weights encode retractions — this is exactly the
/// multiplicity ring used by the current `ZSet<'K>`.
///
/// **Struct** (stateless): serves both registers of the dispatch design
/// (081KWFXTHJY). Boxed once via `Instance` for the instance-passing cold path;
/// passed *by value* as a generic type argument for the zero-overhead hot path,
/// where the JIT monomorphises + devirtualises `Add`/`Mul`/`Negate` to inlined
/// primitives (no vtable call).
[<Struct>]
type IntegerRing =
    interface ISemiring<int64> with
        member _.Zero       = 0L
        member _.One        = 1L
        member _.Add(a, b)  = Checked.(+) a b
        member _.Mul(a, b)  = Checked.(*) a b
    interface IRing<int64> with
        member _.Negate(a)  = Checked.(~-) a

[<RequireQualifiedAccess>]
module IntegerRing =
    /// Boxed singleton for the instance-passing (cold / dynamic-ring) path.
    /// Typed at the most capable tier (`IRing`) — semiring-only call sites
    /// upcast for free.
    let Instance : IRing<int64> = IntegerRing()

    /// ℤ as an `IStarRing`: `IntegerRing` plus `Conj = id` (reals/integers
    /// are their own conjugate). `WSet` / `FourCornerTrace` take `IStarRing`,
    /// not `IRing` — law packs were re-boxing this locally. TRACE (Negate)
    /// applies; there is no C₄ generator (`{±1} ≅ C₂`, `1² = (−1)² = 1`).
    let Star : IStarRing<int64> =
        let r = Instance

        { new IStarRing<int64> with
            member _.Zero = r.Zero
            member _.One = r.One
            member _.Add(a, b) = r.Add(a, b)
            member _.Mul(a, b) = r.Mul(a, b)
            member _.Negate(a) = r.Negate a
            member _.Conj(a) = a }


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

/// **Struct** (stateless) — same dual-register rationale as `IntegerRing`.
///
/// **DEMOTED — substrate-honest exception on file (081KWGA0C7):** intervals under
/// Moore arithmetic are NOT a lawful ring and not even a lawful semiring —
/// (1) negation is no additive inverse (`[a,b] + [−b,−a] = [a−b, b−a] ≠ [0,0]`
/// unless `a = b`), so retraction over interval weights leaves phantom residue;
/// (2) distributivity FAILS (Moore 1966 sub-distributivity — witnessed in
/// `SemiringRing.Laws.Tests.fs`). It therefore implements `ISemiring` only
/// (never `IRing` — Ilyana condition, 081KWG9JQ9H), carries no `Negate`, and its
/// lawful subset is the additive monoid + annihilation (also witnessed). A true
/// Kaucher directed-interval rebuild would gain additive inverses but still not
/// distributivity; a ring rung is mathematically unreachable for intervals.
[<Struct>]
type IntervalRing =
    interface ISemiring<IntervalWeight> with
        member _.Zero = IntervalWeight.Zero
        member _.One  = IntervalWeight.One

        member _.Add(a, b) =
            IntervalWeight(a.Lo + b.Lo, a.Hi + b.Hi)

        // Kaucher multiplication: take hull of all corner products.
        member _.Mul(a, b) =
            let p1 = a.Lo * b.Lo
            let p2 = a.Lo * b.Hi
            let p3 = a.Hi * b.Lo
            let p4 = a.Hi * b.Hi
            IntervalWeight(
                min (min p1 p2) (min p3 p4),
                max (max p1 p2) (max p3 p4))


[<RequireQualifiedAccess>]
module IntervalRing =
    /// Singleton instance — reuse rather than allocate.
    let Instance : ISemiring<IntervalWeight> = IntervalRing()
