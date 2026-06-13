-------------------------- MODULE NciNonUrgencyProofs --------------------------
(* RUNG 3 (unbounded TLAPS) for the temporal/causal half of the minimal NCI — forbidden coercions
   #1 (false urgency) and #2 (forced cache-miss). Where TLC (run-tlc.ts on NciNonUrgency) CHECKS the
   bounded model (3 travelers, budget 1, adversarial urgency) and verifies BOTH the NoCoercion safety
   invariant and the Responsive liveness property + three teeth, this module PROVES the SAFETY half
   UNBOUNDED — for ANY Travelers and ANY EventBudget — machine-checked by tlapm (Zenon/Isabelle/Z3),
   driven by run-tlaps.ts.

   SCOPE (deliberate): the prover discharges SAFETY only — `NoCoercion` (no agent is ever forced to
   complete a decision on a stale cache, across all adversarial urgency injections). The LIVENESS half
   (`Responsive`: every pending decision eventually completes) stays in TLC + weak fairness, per the
   ladder's routing (liveness is OUT of the prover — same as NciSafety/NciLiveness).

   WHY IT IS INDUCTIVE. `staleDecided` (the ghost recording any stale completion) is set TRUE by ONLY
   two actions — ForceDecide (guard `AllowForce`) and ForceDecideOnUrgency (guard `TrustUrgency`). The
   design grants NEITHER guard (the structural invariant: the refresh/decide trigger never reads the
   observed's signal). So both actions are permanently disabled, `staleDecided` stays FALSE, and
   `NoCoercion` is its own inductive invariant — no auxiliary needed, no `TypeOK` needed. This is the
   same design-guarantee form as NciSafety's Coerce/Consents==FALSE.

   The two guards are CONSTANTS here (so the bounded teeth can flip them in NciNonUrgency.cfg); the
   design constraint is stated as an ASSUMPTION below — exactly the constants the real model fixes.

   AC-free / pure ZF. Anchors: Lamport 1977 (safety/liveness); de Finetti 1937 (the non-correlation the
   refresh-trigger obeys — refresh ⊥ observed). *)

EXTENDS NciNonUrgency, TLAPS

\* The design constraint: neither coercion is ever granted. These are the constant values the real model
\* fixes (NciNonUrgency.cfg sets both FALSE; the teeth flip them only to demonstrate they are load-bearing).
ASSUME NoForceGranted == (AllowForce = FALSE) /\ (TrustUrgency = FALSE)

THEOREM NonUrgencySafety == Spec => []NoCoercion
<1>1. Init => NoCoercion
  BY DEF Init, NoCoercion
<1>2. NoCoercion /\ [Next]_vars => NoCoercion'
  <2> SUFFICES ASSUME NoCoercion, [Next]_vars PROVE NoCoercion'
    OBVIOUS
  <2> USE DEF NoCoercion
  <2>1. CASE Next
    <3>0. PICK t \in Travelers :
            \/ Arrive(t) \/ InjectUrgency(t) \/ Refresh(t)
            \/ Decide(t) \/ ForceDecide(t) \/ ForceDecideOnUrgency(t)
          BY <2>1 DEF Next
    <3>1. CASE Arrive(t)              BY <3>1 DEF Arrive
    <3>2. CASE InjectUrgency(t)       BY <3>2 DEF InjectUrgency
    <3>3. CASE Refresh(t)             BY <3>3 DEF Refresh
    <3>4. CASE Decide(t)              BY <3>4 DEF Decide
    <3>5. CASE ForceDecide(t)         BY <3>5, NoForceGranted DEF ForceDecide
    <3>6. CASE ForceDecideOnUrgency(t) BY <3>6, NoForceGranted DEF ForceDecideOnUrgency
    <3>7. QED  BY <3>0, <3>1, <3>2, <3>3, <3>4, <3>5, <3>6
  <2>2. CASE UNCHANGED vars
    BY <2>2 DEF vars
  <2>3. QED  BY <2>1, <2>2
<1>3. QED
  BY <1>1, <1>2, PTL DEF Spec

=============================================================================
