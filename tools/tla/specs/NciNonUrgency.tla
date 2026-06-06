----------------------------- MODULE NciNonUrgency -----------------------------
(* The temporal/causal half of the minimal NCI — forbidden coercions #1 (false urgency) and #2 (forced
   cache-miss), per Aaron 2026-06-05 ("the minimal NCI = false urgency + cache miss + don't force private
   variable exposure"). #3 (forced private exposure) is the safety spec (NciSafety / NciSafetyProofs,
   proven unbounded). This spec covers the other two — and they are temporal, so they live with the
   liveness/fairness machinery (sibling of NciLiveness), routed per BP-16.

   THE MECHANISM. Each agent runs a decision tick: an event arrives (Arrive) → a decision is `pending`
   and the agent's world-state cache goes stale (`cur` := FALSE). The agent then REFRESHES its
   world-state (Refresh: cur := TRUE) and only then DECIDES on the fresh state (Decide requires cur).
   This is the "simulate-then-choose" tick that the causally-bounded reflection interface needs
   (see the yin-yang engine memory: each choice sees the stream up-to-now and caches what it can).

   THE TWO COERCIONS, as one model:
   • #1 false urgency / #2 forced cache-miss are BOTH "make the agent finish its decision before it has
     refreshed its world-state." That is the forbidden ForceDecide action (clears `pending` while the
     cache is stale). Guarded by AllowForce, which the design never grants → never enabled. A ghost
     `staleDecided` records any stale completion, so TLC can confirm none is reachable. This is the SAFETY
     half (no agent is ever forced to decide stale) — same design-guarantee form as NciSafety's Coerce.
   • The LIVENESS half says the agent is never STARVED of the chance to refresh-then-decide: every pending
     decision eventually completes — and since only Decide (which requires a fresh cache) can complete it,
     completion is necessarily on refreshed state. Under weak fairness on Refresh AND Decide, with a
     finite event budget, `pending ~> ~pending` holds. This is "always eventually allowed to refresh +
     use your cache before your tick is forced."

   BOTH refinements are load-bearing (teeth controls, verified):
     - Drop WF(Refresh) → a pending+stale tick can stall forever → Responsive is genuinely FALSE.
     - Set AllowForce = TRUE → ForceDecide becomes reachable → NoCoercion is genuinely FALSE.

   Honest scope: BOUNDED (3 travelers, event budget 1) + FAIRNESS-CONDITIONED. Anchors: Lamport 1977
   (safety/liveness). The "refresh before forced" tick = the localized simulate-then-choose decision
   moment (AC quarantined to the tick; pure ZF elsewhere). *)

EXTENDS Integers, TLC

CONSTANTS
    Travelers,
    EventBudget,   \* Nat — how many events may arrive per traveler (finite, for the lasso search)
    AllowForce     \* BOOLEAN — the design's consent to force a stale decision. FALSE in the real model;
                   \* flipped TRUE only as a teeth control.

VARIABLES
    pending,       \* [Travelers -> BOOLEAN]  a decision tick is due
    cur,           \* [Travelers -> BOOLEAN]  world-state cache is current (refreshed since last event)
    budget,        \* [Travelers -> Nat]      remaining events (finite observation)
    staleDecided   \* [Travelers -> BOOLEAN]  ghost: did this traveler ever complete a decision stale?

vars == <<pending, cur, budget, staleDecided>>

TypeOK ==
    /\ pending \in [Travelers -> BOOLEAN]
    /\ cur \in [Travelers -> BOOLEAN]
    /\ budget \in [Travelers -> 0..EventBudget]
    /\ staleDecided \in [Travelers -> BOOLEAN]

Init ==
    /\ pending = [t \in Travelers |-> FALSE]
    /\ cur = [t \in Travelers |-> TRUE]
    /\ budget = [t \in Travelers |-> EventBudget]
    /\ staleDecided = [t \in Travelers |-> FALSE]

\* An event arrives: a decision becomes due and the cache goes stale. Budget-limited so observation is
\* finite (faithful to the rung-1 DST harness; unbounded arrival could starve liveness legitimately).
Arrive(t) ==
    /\ budget[t] > 0
    /\ pending' = [pending EXCEPT ![t] = TRUE]
    /\ cur' = [cur EXCEPT ![t] = FALSE]
    /\ budget' = [budget EXCEPT ![t] = budget[t] - 1]
    /\ UNCHANGED staleDecided

\* Refresh the world-state / rebuild the cache. Enabled whenever a decision is pending on a stale cache.
Refresh(t) ==
    /\ pending[t]
    /\ ~cur[t]
    /\ cur' = [cur EXCEPT ![t] = TRUE]
    /\ UNCHANGED <<pending, budget, staleDecided>>

\* The legitimate decision: requires a CURRENT cache (refresh-then-choose). Completes the tick.
Decide(t) ==
    /\ pending[t]
    /\ cur[t]
    /\ pending' = [pending EXCEPT ![t] = FALSE]
    /\ UNCHANGED <<cur, budget, staleDecided>>

\* The FORBIDDEN coercion (#1 false urgency / #2 forced cache-miss): complete the decision while the
\* cache is still stale. Guarded by AllowForce, which the design never grants → never enabled.
ForceDecide(t) ==
    /\ AllowForce
    /\ pending[t]
    /\ ~cur[t]
    /\ pending' = [pending EXCEPT ![t] = FALSE]
    /\ staleDecided' = [staleDecided EXCEPT ![t] = TRUE]
    /\ UNCHANGED <<cur, budget>>

Next ==
    \E t \in Travelers : Arrive(t) \/ Refresh(t) \/ Decide(t) \/ ForceDecide(t)

\* Weak fairness on Refresh AND Decide: the agent is never starved of the chance to refresh its
\* world-state and then decide. (No fairness on Arrive — events are environment input, not owed.)
Fairness == \A t \in Travelers : WF_vars(Refresh(t)) /\ WF_vars(Decide(t))

Spec == Init /\ [][Next]_vars /\ Fairness

\* ── #1/#2 SAFETY: no traveler is ever forced to complete a decision on a stale cache. ──
NoCoercion == \A t \in Travelers : ~staleDecided[t]

\* ── #1/#2 LIVENESS: every pending decision eventually completes (necessarily on a refreshed cache,
\*    since only Decide — which requires cur — can clear it). "Always eventually allowed to refresh +
\*    use your cache before your tick is forced." ──
Responsive == \A t \in Travelers : pending[t] ~> ~pending[t]

=============================================================================
