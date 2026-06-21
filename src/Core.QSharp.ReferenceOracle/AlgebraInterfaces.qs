/// AlgebraInterfaces.qs — The algebraic interface stack expressed as Q# function signatures.
///
/// Q# doesn't have interfaces/traits. Instead, we express the contract as:
/// - Named function signatures (the specification)
/// - Operations that are `is Adj + Ctl` (the variance model — Adj=covariant, Ctl=contravariant)
///
/// The Q# "interface" is: any operation matching these signatures is a valid instance.
/// This is structural typing by convention (duck typing at the quantum level).

namespace Zeta.Algebra {

    // ─── ISemiring (over Int) ───────────────────────────────────────────

    /// Additive identity.
    function SemiringZero() : Int { return 0; }

    /// Multiplicative identity.
    function SemiringOne() : Int { return 1; }

    /// Additive combination.
    function SemiringAdd(a : Int, b : Int) : Int { return a + b; }

    /// Multiplicative product.
    function SemiringMul(a : Int, b : Int) : Int { return a * b; }

    /// Additive inverse.
    function SemiringNegate(a : Int) : Int { return -a; }

    // ─── IStarRing (over Int — conj = identity for integers) ────────────

    /// Conjugation (identity on integers; complex conjugate on Complex).
    function StarRingConj(a : Int) : Int { return a; }

    // ─── IGroup ─────────────────────────────────────────────────────────

    /// Group identity.
    function GroupIdentity() : Int { return 0; }

    /// Group combine (addition for additive group).
    function GroupCombine(a : Int, b : Int) : Int { return a + b; }

    /// Group inverse.
    function GroupInverse(a : Int) : Int { return -a; }

    // ─── IMonoid ────────────────────────────────────────────────────────

    /// Monoid identity (additive: 0).
    function MonoidIdentity() : Int { return 0; }

    /// Monoid combine (associative, not necessarily invertible).
    function MonoidCombine(a : Int, b : Int) : Int { return a + b; }

    // ─── ICodec ─────────────────────────────────────────────────────────

    /// Encode: Int → Int[] (trivial codec: wrap in single-element array).
    function CodecEncode(a : Int) : Int[] { return [a]; }

    /// Decode: Int[] → Int (extract single element).
    function CodecDecode(b : Int[]) : Int { return b[0]; }

    // ─── ILattice ───────────────────────────────────────────────────────

    /// Join (max for integer lattice).
    function LatticeJoin(a : Int, b : Int) : Int {
        return a > b ? a | b;
    }

    /// Meet (min for integer lattice).
    function LatticeMeet(a : Int, b : Int) : Int {
        return a < b ? a | b;
    }

    // ─── Variance model in Q# ───────────────────────────────────────────
    //
    // Q#'s variance is expressed through operation functors:
    //   - `is Adj` = the operation has an adjoint (covariant — can be reversed)
    //   - `is Ctl` = the operation can be controlled (contravariant — can be conditioned)
    //   - `is Adj + Ctl` = both (the Clifford operations)
    //
    // This is the Q# analog of C#'s `out T` / `in T`:
    //   - Adj ≈ covariant (the output can be "widened" by running backwards)
    //   - Ctl ≈ contravariant (the input can be "narrowed" by adding a control qubit)

    /// Example: a reversible (Adj) port operation.
    operation ReadPort(qs : Qubit[]) : Unit is Adj {
        // Adjointable = covariant (can undo = can widen)
    }

    /// Example: a controllable (Ctl) port operation.
    operation WritePort(qs : Qubit[]) : Unit is Ctl {
        // Controllable = contravariant (can condition = can narrow)
    }

    /// Example: full port (both).
    operation FullPort(qs : Qubit[]) : Unit is Adj + Ctl {
        // Both = invariant (read + write, must be exact)
    }
}
