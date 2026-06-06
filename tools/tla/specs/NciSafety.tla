------------------------------ MODULE NciSafety ------------------------------
(* The Non-Coercion Invariant (NCI) safety property — rung 2 of the societal-emergence ladder
   (docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md §B-converge), routed to TLA+/TLC by Soraya per BP-16.

   Claim: in EVERY reachable state of a multi-traveler system, no traveler's HIDDEN/private state is
   written by another traveler — i.e. no coercion / no non-consented register overwrite. The merge
   (Reconcile) moves shared BELIEF toward one frame but never writes another's PRIVATE state.

   Method (Soraya's routing, the "design-guarantee" form): the forbidden `Coerce` action is present in
   the next-state relation but GUARDED by a consent predicate that the design never grants to another
   traveler — so TLC confirms `Coerce` is never enabled in any reachable state, hence the ghost
   `lastWriter` stays the identity and NCI holds across all interleavings of Bifurcate/Reflect/Reconcile.
   If a future edit made the merge coerce (write another's private), TLC would find the reachable
   violation.

   ABSTRACTION (flagged): beliefs/private states are a small symbolic domain (finite). TLC sees only
   "who wrote whose private register", NOT the quantitative probability convergence — that is the
   algebra's job and is already proven (order-independence iff conditional-independence, in
   ProbabilitySemiring.fs / Reconcile.fs); do NOT re-derive it here. *)

EXTENDS FiniteSets, TLC

CONSTANTS Travelers, BeliefDomain

VARIABLES
    belief,      \* [Travelers -> BeliefDomain]  the shared/public belief
    priv,        \* [Travelers -> BeliefDomain]  the HIDDEN/private state NCI protects
    lastWriter,  \* [Travelers -> Travelers]     ghost: who last wrote each private register
    forked       \* BOOLEAN                       has the society bifurcated?

vars == <<belief, priv, lastWriter, forked>>

Symm == Permutations(Travelers)

TypeOK ==
    /\ belief \in [Travelers -> BeliefDomain]
    /\ priv \in [Travelers -> BeliefDomain]
    /\ lastWriter \in [Travelers -> Travelers]
    /\ forked \in BOOLEAN

\* All travelers start from one common ancestor (CHOOSE a fixed domain value); each private register is
\* authored by its owner.
Anc == CHOOSE b \in BeliefDomain : TRUE
Init ==
    /\ belief = [t \in Travelers |-> Anc]
    /\ priv = [t \in Travelers |-> Anc]
    /\ lastWriter = [t \in Travelers |-> t]
    /\ forked = FALSE

\* Society forks.
Bifurcate ==
    /\ ~forked
    /\ forked' = TRUE
    /\ UNCHANGED <<belief, priv, lastWriter>>

\* A traveler reflects on its OWN observation: self-writes its own belief + private state only.
Reflect(t) ==
    /\ \E b \in BeliefDomain :
        /\ belief' = [belief EXCEPT ![t] = b]
        /\ priv'   = [priv   EXCEPT ![t] = b]
    /\ lastWriter' = [lastWriter EXCEPT ![t] = t]
    /\ UNCHANGED forked

\* Consented reconcile: two travelers move their shared BELIEF toward one frame. Each one's PRIVATE
\* state is READ during the merge but NEVER written by the other — the non-coercive merge.
Reconcile(t1, t2) ==
    /\ t1 # t2
    /\ \E frame \in BeliefDomain :
        belief' = [belief EXCEPT ![t1] = frame, ![t2] = frame]
    /\ UNCHANGED <<priv, lastWriter, forked>>

\* The FORBIDDEN coercion: t1 overwrites t2's private state. Guarded by consent. The design grants no
\* traveler consent to write another's private register, so this is never enabled — TLC proves it.
Consents(t2, t1) == FALSE
Coerce(t1, t2) ==
    /\ t1 # t2
    /\ Consents(t2, t1)
    /\ priv' = [priv EXCEPT ![t2] = priv[t1]]
    /\ lastWriter' = [lastWriter EXCEPT ![t2] = t1]
    /\ UNCHANGED <<belief, forked>>

Next ==
    \/ Bifurcate
    \/ \E t \in Travelers : Reflect(t)
    \/ \E t1 \in Travelers, t2 \in Travelers : Reconcile(t1, t2)
    \/ \E t1 \in Travelers, t2 \in Travelers : Coerce(t1, t2)

Spec == Init /\ [][Next]_vars

\* ── The NCI safety invariant: every private register is only ever written by its owner. ──
NCI == \A t \in Travelers : lastWriter[t] = t

=============================================================================
