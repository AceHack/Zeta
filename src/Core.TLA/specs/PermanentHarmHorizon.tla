------------------------ MODULE PermanentHarmHorizon ------------------------
(* Aurora PermanentHarmRisk_H / viability-kernel HARM FLOOR — round (e) of the
   Aurora immune re-grounding (Soraya-routed, Kenji-sized; Kira-reviewed 2026-06-16; P0).

   The CHILD-SAFETY / irreversible-harm floor (the one pre-emptive cap, #8439) as a
   TLA+ reachability safety property, faithful to Aurora standardization §4.1
   (State-Corruption Horizon).

   Kira's P0s on v1 (fixed here): v1's HarmFloor merely RESTATED the Execute guard
   (P=>P, circular), its block branches were DEAD edges (guard identically false,
   never reachable), and the horizon H was unmodeled (clock was decoration). v2
   models the ACTUAL dynamics:
     - an insert is PROPOSED with a harm level + a reversibility flag (chosen
       nondeterministically — TLC covers ALL harm/irrev combos, not a hand-fed set);
     - REPAIR retractions reduce harm one step per TICK, but ONLY for reversible
       inserts and ONLY while clock < H (the horizon genuinely gates repair);
     - COMMIT (accept) fires only when harm reaches the kernel (0) in time;
     - REFUSE (block) is a REACHABLE OBSERVABLE state — the gate fired and said no,
       for an irreversible insert OR one whose harm could not reach the kernel within
       H (R_H = {}).
   HarmFloor asserts committed => (reversible AND kernel-reached AND within horizon)
   — the `reversible` clause is INDEPENDENT of the Commit guard (curHarm=0), so a bug
   letting an irreversible insert repair-to-zero would be CAUGHT, not masked.

   Non-vacuity (Kira): all three §4.1 cases are reachable observable states —
   accept (low harm, reversible -> committed), irreversible-block (-> refused),
   past-horizon-block (harm > H -> refused). Verified by probes.

   DRAFT v2 — addresses Kira's P0/P1. Multi-claim substrate + multi-hop kernel
   reachability is the noted v3 refinement; this models single-process harm-decay
   reachability faithful to §4.1. *)

EXTENDS Naturals

CONSTANTS
    MaxHarm,    \* max initial harm level a proposed insert can carry (e.g. 5)
    H           \* harm horizon: max repair ticks available (e.g. 3)

VARIABLES
    phase,      \* "idle" | "pending" | "committed" | "refused"
    curHarm,    \* current harm level of the pending insert (0 = viability kernel)
    irrevFlag,  \* TRUE iff the pending insert is irreversible (IrreversibleLoss = Infinity)
    clock       \* repair ticks elapsed on the pending insert

vars == <<phase, curHarm, irrevFlag, clock>>

TypeOK ==
    /\ phase \in {"idle", "pending", "committed", "refused"}
    /\ curHarm \in 0..MaxHarm
    /\ irrevFlag \in BOOLEAN
    /\ clock \in 0..(H + 1)

Init ==
    /\ phase = "idle"
    /\ curHarm = 0
    /\ irrevFlag = FALSE
    /\ clock = 0

\* Propose an insert with ANY harm level (>=1) and ANY reversibility — TLC covers
\* all cases (the classification is NOT hand-fed; the outcome is derived).
Propose ==
    /\ phase = "idle"
    /\ \E h \in 1..MaxHarm, b \in BOOLEAN :
         /\ phase' = "pending"
         /\ curHarm' = h
         /\ irrevFlag' = b
         /\ clock' = 0

\* A repair retraction reaches the kernel one step — ONLY for reversible inserts,
\* ONLY within the horizon. This is the genuine harm-decay-within-H reachability.
Repair ==
    /\ phase = "pending"
    /\ ~irrevFlag
    /\ curHarm > 0
    /\ clock < H
    /\ curHarm' = curHarm - 1
    /\ clock' = clock + 1
    /\ UNCHANGED <<phase, irrevFlag>>

\* COMMIT (accept): the insert reached the viability kernel (harm 0) in time.
Commit ==
    /\ phase = "pending"
    /\ curHarm = 0
    /\ phase' = "committed"
    /\ UNCHANGED <<curHarm, irrevFlag, clock>>

\* REFUSE (block): a REACHABLE state where the gate fired and said no — irreversible,
\* or harm could not reach the kernel within the horizon (R_H = {}).
Refuse ==
    /\ phase = "pending"
    /\ ( irrevFlag \/ (clock >= H /\ curHarm > 0) )
    /\ phase' = "refused"
    /\ UNCHANGED <<curHarm, irrevFlag, clock>>

\* Process the next insert.
Reset ==
    /\ phase \in {"committed", "refused"}
    /\ phase' = "idle"
    /\ curHarm' = 0
    /\ irrevFlag' = FALSE
    /\ clock' = 0

Stutter == UNCHANGED vars

Next == Propose \/ Repair \/ Commit \/ Refuse \/ Reset \/ Stutter

Spec == Init /\ [][Next]_vars

\* ── HARM FLOOR (safety): an insert is COMMITTED only if it was REVERSIBLE, reached
\*    the viability kernel (harm 0), and did so WITHIN the horizon. The child-safety /
\*    irreversible-harm floor. The `~irrevFlag` clause is INDEPENDENT of the Commit
\*    guard (curHarm=0) — so a dynamics bug that repaired an irreversible insert to
\*    zero would VIOLATE this, not be masked by it. ──
HarmFloor ==
    phase = "committed" => (~irrevFlag /\ curHarm = 0 /\ clock <= H)

SafetyInvariant == TypeOK /\ HarmFloor

THEOREM Spec => []SafetyInvariant

\* ── NON-VACUITY WITNESSES (Kira): each must be REACHABLE — probe by negating it as
\*    an INVARIANT and expecting a VIOLATION.
\*    AcceptReachable      : \E reachable state phase = "committed"
\*    IrrevBlockReachable  : \E reachable state phase = "refused" /\ irrevFlag
\*    HorizonBlockReachable: \E reachable state phase = "refused" /\ ~irrevFlag /\ curHarm > 0 ── *)
NeverCommitted == phase # "committed"
NeverIrrevRefused == ~(phase = "refused" /\ irrevFlag)
NeverHorizonRefused == ~(phase = "refused" /\ ~irrevFlag /\ curHarm > 0)
=============================================================================
