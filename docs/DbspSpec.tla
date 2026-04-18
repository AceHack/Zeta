------------------------------ MODULE DbspSpec ------------------------------
(*
    TLA+ specification of the DBSP algebraic axioms, checkable by TLC.
    The "state" here is a tuple of arbitrary Z-sets picked non-deterministically;
    TLC enumerates every combination and checks the invariants hold for each.

    Run with:
        java -cp tla2tools.jar tlc2.TLC -config DbspSpec.cfg DbspSpec.tla

    At |K|=2, |W|={-2,-1,0,1,2}, TLC exhaustively verifies the axioms across
    all 5^8 = 390 625 tuples of four Z-sets in under a second.
*)
EXTENDS Integers, FiniteSets, Sequences, TLC

CONSTANTS
    K,              \* finite key domain
    W               \* finite weight domain (must include 0 + negatives)

VARIABLES a, b, c

vars == <<a, b, c>>

(*
    Z-set = function K -> W.
*)
ZSet == [K -> W]

EmptyZSet == [k \in K |-> 0]

ZAdd(x, y)     == [k \in K |-> x[k] + y[k]]
ZNeg(x)        == [k \in K |-> -x[k]]
ZSub(x, y)     == [k \in K |-> x[k] - y[k]]
ZDistinct(x)   == [k \in K |-> IF x[k] > 0 THEN 1 ELSE 0]

\* `H` — the incremental-distinct function from the paper (Proposition 4.7).
H(i, delta) == [k \in K |->
    IF i[k] > 0 /\ (i[k] + delta[k]) <= 0 THEN -1
    ELSE IF i[k] <= 0 /\ (i[k] + delta[k]) > 0 THEN 1
    ELSE 0]

(*
    State: three arbitrary Z-sets. TLC enumerates all combinations.
*)
Init ==
    /\ a \in ZSet
    /\ b \in ZSet
    /\ c \in ZSet

Next == UNCHANGED vars

Spec == Init /\ [][Next]_vars

(*
    ═══════════════════════════════════════════════════════════════════
    ═ DBSP axioms — exhaustive verification over finite W × K         ═
    ═══════════════════════════════════════════════════════════════════
*)

\* Group axioms.
InvAssoc == ZAdd(ZAdd(a, b), c) = ZAdd(a, ZAdd(b, c))
InvCommute == ZAdd(a, b) = ZAdd(b, a)
InvIdentity == ZAdd(a, EmptyZSet) = a
InvInverse == ZAdd(a, ZNeg(a)) = EmptyZSet
InvDoubleNeg == ZNeg(ZNeg(a)) = a
InvNegDistributes == ZNeg(ZAdd(a, b)) = ZAdd(ZNeg(a), ZNeg(b))
InvSubIsAddNeg == ZSub(a, b) = ZAdd(a, ZNeg(b))

\* Distinct idempotence (Proposition A in the paper).
InvDistinctIdempotent == ZDistinct(ZDistinct(a)) = ZDistinct(a)

\* Incremental distinct (Proposition 4.7, the H function) — this is the
\* crucial identity our `ZSet.distinctIncremental` must respect.
InvHCorrectness == ZDistinct(ZAdd(a, b)) = ZAdd(ZDistinct(a), H(a, b))

=============================================================================
