------------------------------ MODULE NciLiveness ------------------------------
(* Bifurcation liveness — rung-2 liveness of the societal-emergence ladder (§B-converge), sibling of
   NciSafety, routed by Soraya per BP-16.

   Property: once society forks, its beliefs EVENTUALLY converge to one common frame.

   A focused model of belief convergence (it abstracts away priv/lastWriter/Coerce, which are the
   safety spec's concern and irrelevant to belief convergence — Soraya: trim the ghosts for the liveness
   lasso search). Two refinements are REQUIRED to even state convergence, and both are principled, not
   conclusion-assuming:

   1. Reconcile is a deterministic MONOTONE CRDT JOIN (max over the belief order). Shapiro et al. 2011:
      a join-semilattice merge is commutative/idempotent/inflationary ⇒ the global max is non-decreasing
      and bounded ⇒ no ping-pong; convergence is a CONSEQUENCE of the merge law. (An arbitrary-frame
      merge makes the property genuinely FALSE — verified as a teeth control.)
   2. Observation is FINITE: each traveler reflects on a finite evidence stream (a reflection budget
      `fuel`), faithful to the rung-1 DST harness where evidence lists are finite. Unbounded reflection
      can re-diverge forever and convergence is then genuinely FALSE (verified as a teeth control).

   Fairness: weak fairness on Reconcile only (Soraya). Once observation is exhausted, the
   divergence-guarded monotone join stays continuously enabled until agreement, so WF suffices.

   Honest scope: BOUNDED (3 travelers, 3 beliefs, fuel 1) + FAIRNESS-CONDITIONED + merge-contingent.
   NOT the unbounded rung-3 claim. Anchors: Lamport 1977 (safety/liveness); Shapiro et al. 2011 (CRDT). *)

EXTENDS Integers, TLC

CONSTANTS Travelers, BeliefDomain

VARIABLES
    belief,  \* [Travelers -> BeliefDomain]
    fuel,    \* [Travelers -> Nat]  remaining reflection budget (finite observation)
    forked   \* BOOLEAN

vars == <<belief, fuel, forked>>

Anc == CHOOSE b \in BeliefDomain : \A c \in BeliefDomain : b <= c
MaxReflect == 1

Init ==
    /\ belief = [t \in Travelers |-> Anc]
    /\ fuel = [t \in Travelers |-> MaxReflect]
    /\ forked = FALSE

Bifurcate ==
    /\ ~forked
    /\ forked' = TRUE
    /\ UNCHANGED <<belief, fuel>>

\* Finite observation: a traveler reflects (self-writes any belief) while it has budget.
Reflect(t) ==
    /\ fuel[t] > 0
    /\ \E b \in BeliefDomain : belief' = [belief EXCEPT ![t] = b]
    /\ fuel' = [fuel EXCEPT ![t] = fuel[t] - 1]
    /\ UNCHANGED forked

\* Monotone CRDT join: both travelers adopt the max of their beliefs. Guarded by divergence so it only
\* fires when it makes progress (so weak fairness drives convergence to the global max).
Reconcile(t1, t2) ==
    /\ t1 # t2
    /\ belief[t1] # belief[t2]
    /\ LET frame == IF belief[t1] >= belief[t2] THEN belief[t1] ELSE belief[t2]
       IN belief' = [belief EXCEPT ![t1] = frame, ![t2] = frame]
    /\ UNCHANGED <<fuel, forked>>

Next ==
    \/ Bifurcate
    \/ \E t \in Travelers : Reflect(t)
    \/ \E t1 \in Travelers, t2 \in Travelers : Reconcile(t1, t2)

ReconcileFair == \A t1 \in Travelers, t2 \in Travelers : WF_vars(Reconcile(t1, t2))

LiveSpec == Init /\ [][Next]_vars /\ ReconcileFair

\* Once forked, all travelers' belief eventually equals one shared frame.
Bifurcation ==
    forked ~> (\E frame \in BeliefDomain : \A t \in Travelers : belief[t] = frame)

=============================================================================
