-------------------------- MODULE NonRegisterCollapse --------------------------
(* Non-register-collapse in the WEIGHT-FREE base frame (workitem 081KTFFFQ1C — long stuck at §B,
   unblocked by Aaron's weight-free reframe 2026-06-07, Soraya-routed). The conjecture became
   STATEABLE without the previously-undefined C (compression) / O (orthogonality) by reducing it
   to two facets: (Facet-1, here) NO-CAPTURE / no permanent foreign weighting — TLA+; (Facet-2,
   Lean) distinctness-preserved-under-merge, a corollary of IdentityForcesPrivacy.

   Frame: travelers (= self-propagating patterns) each hold a `standing` register (rights/budget).
   WEIGHT-FREE base frame: no traveler may permanently raise/capture ANOTHER traveler's standing —
   a traveler's register is authored ONLY by itself. The `lastRaiser` ghost witnesses authorship;
   the guarded `Capture` action (mirror of NciSafety's guarded `Coerce`) is unreachable in the base
   frame (no consent is ever granted here), so `lastRaiser[t] = t` always — no register collapses
   into another. Equal RIGHTS (not equal standing): every traveler's right to self-raise is never
   gated by another. *)

EXTENDS Naturals

CONSTANTS Travelers, MaxStanding

VARIABLES
    standing,   \* [Travelers -> 0..MaxStanding] : each traveler's own rights/budget register
    lastRaiser, \* [Travelers -> Travelers] : who last RAISED each register (ghost; authorship)
    consents    \* SUBSET (Travelers \X Travelers) : <<t,a>> = t consents to a raising t's standing

vars == <<standing, lastRaiser, consents>>

TypeOK ==
    /\ standing \in [Travelers -> 0..MaxStanding]
    /\ lastRaiser \in [Travelers -> Travelers]
    /\ consents \subseteq (Travelers \X Travelers)

Init ==
    /\ standing = [t \in Travelers |-> 0]      \* all equal — weight-free start
    /\ lastRaiser = [t \in Travelers |-> t]    \* each register authored by itself
    /\ consents = {}                            \* the weight-free base grants NO foreign-raise consent

\* A traveler raises its OWN standing (the equal right to grow — authored by itself).
SelfRaise(t) ==
    /\ standing[t] < MaxStanding
    /\ standing' = [standing EXCEPT ![t] = @ + 1]
    /\ lastRaiser' = [lastRaiser EXCEPT ![t] = t]
    /\ UNCHANGED consents

\* A traveler spends its own standing (not a raise; authorship unchanged).
Spend(t) ==
    /\ standing[t] > 0
    /\ standing' = [standing EXCEPT ![t] = @ - 1]
    /\ UNCHANGED <<lastRaiser, consents>>

\* CAPTURE: another traveler `a` raises t's standing — GUARDED by t's consent, which the weight-free
\* base frame NEVER grants (no action adds to `consents`). So this is unreachable here; if it ever
\* fired it would set lastRaiser[t] = a # t (the collapse we forbid). Mirror of NciSafety's `Coerce`.
Capture(a, t) ==
    /\ a # t
    /\ <<t, a>> \in consents
    /\ standing' = [standing EXCEPT ![t] = @ + 1]
    /\ lastRaiser' = [lastRaiser EXCEPT ![t] = a]
    /\ UNCHANGED consents

Next ==
    \/ \E t \in Travelers : SelfRaise(t) \/ Spend(t)
    \/ \E a, t \in Travelers : Capture(a, t)

Spec == Init /\ [][Next]_vars

\* ── NO-CAPTURE / non-register-collapse: a register is authored ONLY by its own traveler — no
\*    traveler's register is captured/collapsed into another's, across all interleavings. ──
NoCapture == \A t \in Travelers : lastRaiser[t] = t

\* ── Weight-free standing: a register only ever changes by its OWN traveler's self-raise (no
\*    foreign permanent weighting reaches a reachable state). ──
WeightFree == \A t \in Travelers : lastRaiser[t] = t

\* ── Equal rights: every traveler's right to self-raise is gated ONLY by its own ceiling, never by
\*    another traveler (the exit-is-never-closed shape, at the rights layer). ──
SelfRaiseRightOpen == \A t \in Travelers : (standing[t] < MaxStanding) => ENABLED SelfRaise(t)

=============================================================================
