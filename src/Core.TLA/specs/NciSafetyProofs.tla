--------------------------- MODULE NciSafetyProofs ---------------------------
(* RUNG 3 of the societal-emergence ladder — the UNBOUNDED TLAPS proof of the Non-Coercion Invariant
   safety property (docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md §B-converge).

   TLC (run-tlc.ts on NciSafety) CHECKS []NCI on the bounded model {ta,tb,tc} × {b0,b1,b2}. This
   module PROVES it for ANY finite Travelers / BeliefDomain: an inductive-invariant proof, machine-
   checked obligation by obligation by the TLAPS backends (Zenon / Isabelle / SMT=Z3), driven by
   run-tlaps.ts.

   Kept SEPARATE from NciSafety.tla on purpose: this module `EXTENDS TLAPS` (for the PTL temporal
   rule), which lives in tlapm's standard library and is NOT on TLC's module path — so the model-
   checked spec stays toolchain-clean and TLC never has to resolve TLAPS.tla.

   The keystone (A): unbounded NCI safety — `\A t : lastWriter[t] = t` in every reachable state.
   `TypeOK /\ NCI` is itself inductive (no auxiliary invariant needed):
     • Init sets lastWriter = [t |-> t]  ⇒ NCI;
     • Reflect(t) self-writes only lastWriter[t] := t   (owner writes its own register);
     • Bifurcate / Reconcile leave lastWriter UNCHANGED;
     • Coerce — the ONLY action writing another's register — is guarded by Consents == FALSE, so it
       is never enabled and its step obligation discharges by contradiction.
   (A′) non-collapse-as-preservation is the same fact read contrapositively: lastWriter never leaves
   the identity ⇒ no traveler's private frame is ever absorbed by another (no non-consented identity
   fusion). Liveness (B) is deliberately OUT of the prover — TLC + weak fairness (NciLiveness) owns it.

   AC-free / pure ZF: the induction uses no choice principle. (`Anc == CHOOSE b \in BeliefDomain : TRUE`
   in NciSafety!Init is a definite description over a nonempty set, not an appeal to the axiom of
   choice in the proof.) *)

EXTENDS NciSafety, TLAPS

\* The belief domain is nonempty (there is at least one belief). Benign domain side-condition: it makes
\* the common ancestor `Anc == CHOOSE b \in BeliefDomain : TRUE` a genuine element of BeliefDomain. Not
\* a use of the axiom of choice — CHOOSE over a nonempty set is a definite description.
ASSUME BeliefNonempty == BeliefDomain # {}

LEMMA AncInDomain == Anc \in BeliefDomain
  BY BeliefNonempty DEF Anc

Inv == TypeOK /\ NCI

THEOREM Safety == Spec => []NCI
<1>1. Init => Inv
  BY AncInDomain DEF Init, Inv, TypeOK, NCI
<1>2. Inv /\ [Next]_vars => Inv'
  <2> SUFFICES ASSUME Inv, [Next]_vars PROVE Inv'
    OBVIOUS
  <2> USE DEF Inv, TypeOK, NCI
  <2>1. CASE Bifurcate
    BY <2>1 DEF Bifurcate
  <2>2. CASE \E t \in Travelers : Reflect(t)
    <3>0. PICK t \in Travelers : Reflect(t)  BY <2>2
    <3>1. PICK b \in BeliefDomain :
            /\ belief' = [belief EXCEPT ![t] = b]
            /\ priv'   = [priv   EXCEPT ![t] = b]
          BY <3>0 DEF Reflect
    <3>2. lastWriter' = [lastWriter EXCEPT ![t] = t] /\ UNCHANGED forked
          BY <3>0 DEF Reflect
    <3> QED  BY <3>1, <3>2
  <2>3. CASE \E t1 \in Travelers, t2 \in Travelers : Reconcile(t1, t2)
    <3>0. PICK t1 \in Travelers, t2 \in Travelers : Reconcile(t1, t2)  BY <2>3
    <3>1. PICK frame \in BeliefDomain :
            belief' = [belief EXCEPT ![t1] = frame, ![t2] = frame]
          BY <3>0 DEF Reconcile
    <3>2. UNCHANGED <<priv, lastWriter, forked>>  BY <3>0 DEF Reconcile
    <3> QED  BY <3>1, <3>2
  <2>4. CASE \E t1 \in Travelers, t2 \in Travelers : Coerce(t1, t2)
    \* Coerce requires Consents(t2,t1), but Consents == FALSE — never enabled.
    BY <2>4 DEF Coerce, Consents
  <2>5. CASE UNCHANGED vars
    BY <2>5 DEF vars
  <2>6. QED
    BY <2>1, <2>2, <2>3, <2>4, <2>5 DEF Next
<1>3. QED
  BY <1>1, <1>2, PTL DEF Spec, Inv

=============================================================================
