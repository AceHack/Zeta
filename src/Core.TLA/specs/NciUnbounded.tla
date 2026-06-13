------------------------------ MODULE NciUnbounded ------------------------------
(* B-1019 RUNG-2 (TLC) — the interleaving-robust lift of the rung-1 DST contrast (Soraya-routed
   2026-06-06; `memory/feedback_soraya_b1019_dst_vacuity_review_*` + the rung-2 routing memo).

   Rung-1 (F# DST, `src/Core/SocietyUnbounded.fs`) showed, on replayable trajectories: internal
   difference drives growth in distinct beliefs; collapsing the difference halts at uniformity. This
   spec lifts the *contrast* to a property checked over ALL interleavings by TLC.

   WHAT TLC CHECKS — a distinctness-MONOTONICITY invariant, NOT "no-limit-cycle". (Soraya's anti-
   TLA+-hammer call: "no-limit-cycle" is FALSE on any finite model by pigeonhole — TLC would hand back a
   lasso and prove nothing about unboundedness; it is not a finite-state property. So we check the
   property TLC *can* certify and that the three existing NCI specs do NOT cover:)
     • `Monotone` — in the difference regime (~collapsed) the distinct-belief count NEVER DECREASES.
     • `Teeth`    — in the collapse regime it is PINNED at 1 (register-collapse / heat-death).

   Non-redundant with the other specs: NciSafety = who-writes-whom (no distinctness); NciLiveness =
   convergence-to-ONE (the opposite quantity); NciNonUrgency = stale/urgency triggers (temporal). This
   one tracks distinctness as a QUANTITY and certifies its monotone shape under all interleavings.

   HONEST CEILING (the pigeonhole, made explicit): the distinct count rises only up to N = |Travelers|
   (a finite model has no more values to take), after which the regime must cycle. That finite ceiling is
   exactly why rung-3 is a Lean theorem: TLC's K-bounded monotone PASS is the finite witness; Lean removes
   the ceiling (`∀ N, ∃ reachable state with distinct > N`). This rung certifies the bounded shape Lean
   generalises. *)

EXTENDS Naturals, FiniteSets, TLC

CONSTANTS Travelers

VARIABLES
    belief,       \* [Travelers -> Travelers]  each traveler's current belief value
    reflected,    \* [Travelers -> BOOLEAN]    has this traveler reflected (finite observation)
    collapsed,    \* BOOLEAN                    has private difference been collapsed (the teeth)
    prevDistinct  \* Nat                        distinct-count of the PREVIOUS state (monotonicity ghost)

vars == <<belief, reflected, collapsed, prevDistinct>>

Symm == Permutations(Travelers)
N == Cardinality(Travelers)

distinctOf(b) == Cardinality({ b[t] : t \in Travelers })

\* The shared initial value (a fixed domain element). Definite description, not a use of choice in a proof.
anchor == CHOOSE t \in Travelers : TRUE

TypeOK ==
    /\ belief \in [Travelers -> Travelers]
    /\ reflected \in [Travelers -> BOOLEAN]
    /\ collapsed \in BOOLEAN
    /\ prevDistinct \in 0..N

Init ==
    /\ belief = [t \in Travelers |-> anchor]   \* all share one value ⇒ distinct = 1
    /\ reflected = [t \in Travelers |-> FALSE]
    /\ collapsed = FALSE
    /\ prevDistinct = 1

\* Difference regime: a traveler reflects on its OWN private evidence and adopts its unique self-value
\* (internally-derived, distinct). Gated on ~collapsed and not-yet-reflected (finite observation). Moving
\* to a value only this traveler targets cannot lower the distinct count — non-contracting by the dynamics.
Reflect(t) ==
    /\ ~collapsed
    /\ ~reflected[t]
    /\ belief' = [belief EXCEPT ![t] = t]
    /\ reflected' = [reflected EXCEPT ![t] = TRUE]
    /\ prevDistinct' = distinctOf(belief)
    /\ UNCHANGED collapsed

\* The teeth: collapse the private difference — force every belief equal (register-collapse). This gates
\* Reflect off, so the population is pinned at one distinct belief (heat-death). The teeth-CONTROL that
\* proves the gate is load-bearing: remove the `~collapsed` guard on Reflect and `Teeth` becomes violated
\* (a post-collapse Reflect re-diverges) — run as a separate control model, not the real spec.
Collapse ==
    /\ ~collapsed
    /\ collapsed' = TRUE
    /\ belief' = [t \in Travelers |-> anchor]
    /\ prevDistinct' = distinctOf(belief)
    /\ UNCHANGED reflected

Next ==
    \/ \E t \in Travelers : Reflect(t)
    \/ Collapse

Spec == Init /\ [][Next]_vars

\* ── The rung-2 invariants ──
\* Difference regime: distinct-belief count is NON-CONTRACTING (post-state ≥ recorded previous).
Monotone == ~collapsed => distinctOf(belief) >= prevDistinct
\* Collapse regime: pinned at uniformity (heat-death).
Teeth == collapsed => distinctOf(belief) = 1

=============================================================================
