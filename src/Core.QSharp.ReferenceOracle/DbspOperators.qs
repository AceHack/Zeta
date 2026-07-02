/// DbspOperators.qs — the DBSP incremental-dataflow operator set, mirrored into
/// the Q# reference oracle (the source-owned reference for the treaty).
///
/// Following AlgebraInterfaces.qs's convention (Q# has no interfaces — a matching
/// function signature IS the instance), each operator is expressed at the WEIGHT
/// level over Int, and GROUNDED in the algebra tier (Zeta.Algebra): the DBSP
/// operators are not new algebra — they ride the semiring/ring the oracle already
/// defines. This makes the grounding checkable from source: Integrate = SemiringAdd
/// (the `I` operator), Join weights = SemiringMul (bilinear), Retract = RingNegate
/// (the additive inverse that makes insert⊕retract cancel).
///
/// Mirrors src/Core/DbspCellGraph.fs and tests/cross-verification/zeta-ir-v2/
/// interfaces/dbsp-operators.ir.json. Anchor: Budiu et al. DBSP (VLDB 2023).

namespace Zeta.Dbsp {

    open Zeta.Algebra;

    /// LINEAR — identity relay (a source/fan-out node): Relay(w) = w.
    function DbspRelay(w : Int) : Int { return w; }

    /// LINEAR — selection: keep the entry's weight, or drop it to Zero.
    /// Weight-independent (the predicate is on the key), hence linear.
    function DbspFilterKeep(keep : Bool, w : Int) : Int {
        return keep ? w | SemiringZero();
    }

    /// LINEAR — key rewrite (projection): weight-preserving (the rewrite acts on
    /// the key, never the weight), so it distributes over Z-set addition.
    function DbspRekeyWeight(w : Int) : Int { return w; }

    /// The sink's running integral `I`: acc' = acc ⊕ delta. Grounded in SemiringAdd.
    function DbspIntegrate(acc : Int, delta : Int) : Int {
        return SemiringAdd(acc, delta);
    }

    /// BILINEAR — equi-join weight combination: matched keys' weights multiply.
    /// Grounded in SemiringMul; bilinearity ⇒ it distributes over SemiringAdd.
    function DbspJoinWeights(a : Int, b : Int) : Int {
        return SemiringMul(a, b);
    }

    /// Retraction — the additive inverse (RING tier): a ⊕ negate(a) = Zero, which
    /// is why an insert followed by its retraction cancels as it propagates.
    function DbspRetract(w : Int) : Int {
        return RingNegate(w);
    }

    /// NON-LINEAR — set-semantics distinct (the DBSP `H`): given the integrated
    /// input weight `prevW` and an incoming `deltaW`, emit only the boundary
    /// crossing — +1 when the weight rises to positive, -1 when it falls to
    /// non-positive, 0 otherwise. Bounded by the delta, independent of history.
    function DbspDistinctCross(prevW : Int, deltaW : Int) : Int {
        let wasPositive = prevW > 0;
        let nowPositive = (prevW + deltaW) > 0;
        return wasPositive == nowPositive ? 0 | (nowPositive ? 1 | -1);
    }
}
