-------------------------- MODULE Bifurcation --------------------------
(* Bifurcation / split-brain CONSERVATION invariant — Face-2 (Soraya-routed to TLA+/TLC: a
   transition-system safety+liveness property over an interleaved divvy, not algebra → not Lean).
   Face-1 (reconciliation CONVERGENCE) is a Lean corollary of the proven CRDT floor, separate file.

   When identity I bifurcates into halves I1, I2 (the degenerate split-brain case), its consented
   bindings / consensus-bus contracts are PARTITIONED over a gradual "I-take-this / you-take-that"
   divvy. Safety: nothing lost (conservation), nothing double-owned, no binding executes twice
   across the halves (no double-spend — the P0). Liveness: the divvy eventually completes. Models
   the deployed Binding layer's `Consented`/`Executed` at the split. Precedents: RefuseBinding.tla,
   NciSafety.tla (race-to-claim), NciLiveness.tla / RecoveryHomeostat.tla (WF liveness). *)

EXTENDS Naturals, FiniteSets

CONSTANTS Bindings   \* the consented bindings of identity I at the moment of the split

VARIABLES
    owner,    \* [Bindings -> {"none", "i1", "i2"}] : current owner (monotone once tagged)
    execBy    \* [Bindings -> SUBSET {"i1", "i2"}]  : which halves have executed the binding

vars == <<owner, execBy>>

Halves == {"i1", "i2"}

TypeOK ==
    /\ owner \in [Bindings -> {"none", "i1", "i2"}]
    /\ execBy \in [Bindings -> SUBSET Halves]

Init ==
    /\ owner = [b \in Bindings |-> "none"]   \* at the split, all bindings unassigned
    /\ execBy = [b \in Bindings |-> {}]

\* Tag a still-unassigned binding to a half (monotone: never un-tagged once owned).
Tag(h, b) ==
    /\ h \in Halves
    /\ owner[b] = "none"
    /\ owner' = [owner EXCEPT ![b] = h]
    /\ UNCHANGED execBy

\* Execute a binding — only by its OWNER, and only ONCE (already-executed is a sink → no re-spend).
Exec(h, b) ==
    /\ h \in Halves
    /\ owner[b] = h
    /\ execBy[b] = {}
    /\ execBy' = [execBy EXCEPT ![b] = {h}]
    /\ UNCHANGED owner

\* Stutter at the fully-terminal state (all tagged, all owned bindings executed) so legitimate
\* completion is not mis-reported as deadlock.
Terminating ==
    /\ \A b \in Bindings : owner[b] # "none"
    /\ \A b \in Bindings : execBy[b] # {}
    /\ UNCHANGED vars

Next ==
    \/ \E h \in Halves, b \in Bindings : Tag(h, b) \/ Exec(h, b)
    \/ Terminating

\* Weak fairness on tagging so the divvy makes progress (the eventual-completion liveness).
Spec == Init /\ [][Next]_vars /\ WF_vars(\E h \in Halves, b \in Bindings : Tag(h, b))

owned(h) == { b \in Bindings : owner[b] = h }
unassigned == { b \in Bindings : owner[b] = "none" }

\* ── Conservation: every binding is accounted for (unassigned ∪ I1 ∪ I2 = all). ──
Conservation == (unassigned \cup owned("i1") \cup owned("i2")) = Bindings

\* ── No double-ownership: the two halves' bindings are disjoint. ──
NoDoubleOwnership == owned("i1") \cap owned("i2") = {}

\* ── No double-spend (the P0): no binding is executed more than once, across both halves. ──
NoDoubleSpend == \A b \in Bindings : Cardinality(execBy[b]) <= 1

\* ── Execute only by owner: a half never executes a binding it does not own. ──
ExecOnlyByOwner == \A b \in Bindings : \A h \in execBy[b] : owner[b] = h

\* ── Liveness: the divvy eventually completes — every binding ends up owned by a half. ──
DivvyCompletes == <>[] (unassigned = {})

=============================================================================
