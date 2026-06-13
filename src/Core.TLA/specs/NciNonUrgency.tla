----------------------------- MODULE NciNonUrgency -----------------------------
(* The temporal/causal half of the minimal NCI — forbidden coercions #1 (false urgency) and #2 (forced
   cache-miss), per Aaron 2026-06-05 ("the minimal NCI = false urgency + cache miss + don't force private
   variable exposure"). #3 (forced private exposure) is the safety spec (NciSafety / NciSafetyProofs,
   proven unbounded). This spec covers the other two — temporal, so they live with the liveness/fairness
   machinery (sibling of NciLiveness), routed per BP-16.

   THE STRUCTURAL INVARIANT (Aaron 2026-06-05, the sharpening): "we never use the uncertainties of the
   thing we are observing to decide if we refresh world state — only our INTERNAL state. Then they can
   never cause a cache miss, and false urgency is just an extra signal that says refresh now."
   ⇒ The refresh trigger is a function of the agent's OWN internal state (pending, cur) ONLY — it never
   reads the observed entity's uncertainty / signals. This is non-correlation (de Finetti) applied to the
   refresh trigger: refresh-trigger ⊥ observed's-state. Two consequences fall out:
     • #2 (forced cache-miss) DISSOLVES structurally: the observed cannot move our cache, because nothing
       it does is read by Refresh/Decide. We model this by giving the observed an ADVERSARIAL urgency
       signal it may inject FREELY (InjectUrgency, no budget), and proving NoCoercion holds across ALL
       injections — the observed can scream "refresh now / you're fine" forever and never cause a stale
       decision.
     • #1 (false urgency) DEMOTES to advisory: `urgent` is just a "refresh now" hint. Refresh/Decide
       never depend on it; at most it could prompt an (already-allowed) refresh. It is input, not control.

   THE DECISION TICK. An event arrives (Arrive) → a decision is `pending` and the cache goes stale
   (cur:=FALSE). The agent REFRESHES its world-state (Refresh: cur:=TRUE, guard = own pending∧¬cur ONLY)
   and only then DECIDES on the fresh state (Decide requires cur). This is the simulate-then-choose tick
   (AC quarantined to the tick; pure ZF elsewhere; the causally-bounded reflection of the yin-yang engine).

   THE FORBIDDEN COERCIONS, guarded off:
     • ForceDecide (AllowForce): complete a decision while the cache is stale (generic stale-force).
     • ForceDecideOnUrgency (TrustUrgency): decide-stale BECAUSE the observed signalled urgent — i.e.
       USING the observed's signal to decide (exactly what the invariant forbids). Both guards are FALSE
       in the real model; flipping either is a teeth control. A ghost `staleDecided` records any stale
       completion so TLC can confirm none is reachable.

   REFINEMENTS load-bearing (teeth, verified):
     - AllowForce = TRUE        → ForceDecide reachable        → NoCoercion FALSE.
     - TrustUrgency = TRUE      → the observed's urgency forces a stale decision → NoCoercion FALSE
                                  (this is the precise teeth for Aaron's claim: USE the observed's signal
                                   to decide refresh, and the observed CAN cause a cache miss).
     - drop WF(Refresh)         → a pending+stale tick can stall → Responsive FALSE.

   Honest scope: BOUNDED (3 travelers, event budget 1, adversarial urgency) + FAIRNESS-CONDITIONED.
   Anchors: Lamport 1977 (safety/liveness); de Finetti 1937 (the non-correlation the trigger obeys). *)

EXTENDS Integers, TLC

CONSTANTS
    Travelers,
    EventBudget,    \* Nat — how many events may arrive per traveler (finite, for the lasso search)
    AllowForce,     \* BOOLEAN — generic consent to force a stale decision. FALSE in the real model.
    TrustUrgency    \* BOOLEAN — consent to DECIDE because the observed signalled urgent (use the
                    \* observed's signal as a refresh/decide trigger). FALSE in the real model — the
                    \* structural invariant. Flipped TRUE only as a teeth control.

VARIABLES
    pending,        \* [Travelers -> BOOLEAN]  a decision tick is due
    cur,            \* [Travelers -> BOOLEAN]  world-state cache is current (refreshed since last event)
    budget,         \* [Travelers -> Nat]      remaining events (finite observation)
    urgent,         \* [Travelers -> BOOLEAN]  the OBSERVED's false-urgency signal (adversarial input)
    staleDecided    \* [Travelers -> BOOLEAN]  ghost: did this traveler ever complete a decision stale?

vars == <<pending, cur, budget, urgent, staleDecided>>

TypeOK ==
    /\ pending \in [Travelers -> BOOLEAN]
    /\ cur \in [Travelers -> BOOLEAN]
    /\ budget \in [Travelers -> 0..EventBudget]
    /\ urgent \in [Travelers -> BOOLEAN]
    /\ staleDecided \in [Travelers -> BOOLEAN]

Init ==
    /\ pending = [t \in Travelers |-> FALSE]
    /\ cur = [t \in Travelers |-> TRUE]
    /\ budget = [t \in Travelers |-> EventBudget]
    /\ urgent = [t \in Travelers |-> FALSE]
    /\ staleDecided = [t \in Travelers |-> FALSE]

\* An event arrives: a decision becomes due and the cache goes stale. Budget-limited so observation is
\* finite (faithful to the rung-1 DST harness; unbounded arrival could starve liveness legitimately).
Arrive(t) ==
    /\ budget[t] > 0
    /\ pending' = [pending EXCEPT ![t] = TRUE]
    /\ cur' = [cur EXCEPT ![t] = FALSE]
    /\ budget' = [budget EXCEPT ![t] = budget[t] - 1]
    /\ UNCHANGED <<urgent, staleDecided>>

\* The OBSERVED injects a false-urgency signal — adversarial and FREE (no budget): it may set or clear
\* `urgent` for any traveler at any time. This is the observed's full power. It touches NOTHING else —
\* in particular it cannot move our cache (`cur`) or complete our decision (`pending`). The whole point:
\* prove our state is robust to ALL of this.
InjectUrgency(t) ==
    /\ urgent' = [urgent EXCEPT ![t] = ~urgent[t]]
    /\ UNCHANGED <<pending, cur, budget, staleDecided>>

\* Refresh the world-state / rebuild the cache. Guard mentions ONLY t's own pending/cur — NEVER `urgent`
\* and NEVER another traveler's state. This is the structural invariant: refresh-trigger ⊥ observed.
Refresh(t) ==
    /\ pending[t]
    /\ ~cur[t]
    /\ cur' = [cur EXCEPT ![t] = TRUE]
    /\ UNCHANGED <<pending, budget, urgent, staleDecided>>

\* The legitimate decision: requires a CURRENT cache (refresh-then-choose). Does NOT read `urgent`.
Decide(t) ==
    /\ pending[t]
    /\ cur[t]
    /\ pending' = [pending EXCEPT ![t] = FALSE]
    /\ UNCHANGED <<cur, budget, urgent, staleDecided>>

\* FORBIDDEN coercion (generic): complete the decision while the cache is stale. Guarded by AllowForce.
ForceDecide(t) ==
    /\ AllowForce
    /\ pending[t]
    /\ ~cur[t]
    /\ pending' = [pending EXCEPT ![t] = FALSE]
    /\ staleDecided' = [staleDecided EXCEPT ![t] = TRUE]
    /\ UNCHANGED <<cur, budget, urgent>>

\* FORBIDDEN coercion (the specific one Aaron's invariant rules out): decide-stale BECAUSE the observed
\* signalled urgent — i.e. USE the observed's signal as the trigger to skip refresh. Guarded by
\* TrustUrgency. In the real model TrustUrgency = FALSE, so refresh never depends on the observed.
ForceDecideOnUrgency(t) ==
    /\ TrustUrgency
    /\ urgent[t]
    /\ pending[t]
    /\ ~cur[t]
    /\ pending' = [pending EXCEPT ![t] = FALSE]
    /\ staleDecided' = [staleDecided EXCEPT ![t] = TRUE]
    /\ UNCHANGED <<cur, budget, urgent>>

Next ==
    \E t \in Travelers :
        \/ Arrive(t)
        \/ InjectUrgency(t)
        \/ Refresh(t)
        \/ Decide(t)
        \/ ForceDecide(t)
        \/ ForceDecideOnUrgency(t)

\* Weak fairness on Refresh AND Decide: the agent is never starved of the chance to refresh its
\* world-state and then decide. No fairness on Arrive or InjectUrgency — those are environment input
\* (the observed's signal is adversarial; nothing about it is owed or relied upon).
Fairness == \A t \in Travelers : WF_vars(Refresh(t)) /\ WF_vars(Decide(t))

Spec == Init /\ [][Next]_vars /\ Fairness

\* ── #1/#2 SAFETY: no traveler is ever forced to complete a decision on a stale cache — and this holds
\*    across ALL adversarial urgency injections, so the OBSERVED can never cause our cache-miss. ──
NoCoercion == \A t \in Travelers : ~staleDecided[t]

\* ── #1/#2 LIVENESS: every pending decision eventually completes (necessarily on a refreshed cache,
\*    since only Decide — which requires cur — can clear it), regardless of the observed's signalling.
\*    "Always eventually allowed to refresh + use your cache before your tick is forced." ──
Responsive == \A t \in Travelers : pending[t] ~> ~pending[t]

=============================================================================
