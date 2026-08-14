------------------------ MODULE QuorumPhaseCancellation ------------------------
(* IS PHASE CANCELLATION REACHABLE UNDER A BYZANTINE MODEL, AND IS IT
   DISTINGUISHABLE FROM HONEST DISAGREEMENT - Soraya, 2026-08-13.

   == ROUTING NOTE, BECAUSE THIS HALF IS NOT TLA+ HOME GROUND ==
   The collateral half of this round (QuorumCollateral.tla) is a discrete state machine
   over finite identities, signatures and epochs - TLA+ exactly where it belongs. This
   half is NOT. An amplitude is a COMPLEX NUMBER and a phase is a REAL angle, and TLA+
   has no reals. Model-checking a discretisation of the phase circle and reporting green
   would be the identical failure that got TLA+ rejected categorically for the light-time
   envelope (docs/research/2026-08-13-soraya-light-time-asymmetry-envelope-routing-and-
   proof.md): TLC would be checking a claim about the discretisation, not about the thing.

   So the phase set here is NOT a discretisation. It is a RESTRICTION of the adversary to
   the 4th roots of unity, which makes every amplitude a Gaussian integer and every sum
   EXACT - no rounding exists to be wrong about. The price is paid in which direction
   results travel, and it is a one-way street:

     REACHABILITY transfers UP.  A restricted adversary is a special case of the general
       one. If a witness exists here, the same witness exists against arbitrary real
       phases. So every VIOLATION this module reports is SOUND for the real model.
     NON-REACHABILITY does NOT transfer.  A general adversary has strictly more phases
       available. So a green result here means "not reachable using axis-aligned phases"
       and NOTHING MORE. It must never be read as "the quorum is safe".

   Every claim below is therefore stated in the reachability direction, and where a
   general-phase argument is wanted it is flagged for Z3 or Lean instead - the magnitude
   bound is a real-arithmetic fact (triangle inequality), and real arithmetic is exactly
   what the sibling tools are for and this one is not.

   == WHY THE QUESTION IS ASKED THIS WAY ==
   Aaron, on the counter that an adversary could neutralise a quorum with an opposite
   phase: cancellation is the honest MEASUREMENT INSTRUMENT, not a vulnerability to
   design away. The requirement is to MEASURE it, never to forbid it. That is the
   dual-use rule applied to interference: report the neutral fact - destructive
   interference occurred at magnitude X - and let policy attach the reading.

   That is only legitimate under `dual-use-detection-is-neutral-oracle-decides` if the
   AMBIGUITY IS STATED rather than silently resolved. Hence the second property here.
   A quorum that reports cancellation without being able to say whether it came from
   honest disagreement or adversarial injection is reporting a fact with two readings,
   and the design owes that ambiguity out loud.

   == WHAT IS DELIBERATELY NOT MODELLED ==
   * NO Born rule, no normalisation to probabilities. The quorum layer sums amplitudes
     (AmplitudeEmu.merge); measurement is a separate one-way boundary and modelling it
     here would re-import the category error #10419 refused.
   * NO frames. AmplitudeEmu sums amplitudes of IDENTICAL frames; this module models one
     frame, which is where interference happens at all.
   * ONE ROUND. No time, no repetition, no accumulation of evidence. *)

EXTENDS Integers, FiniteSets

CONSTANTS
    Members,        \* the quorum
    Byzantine,      \* which members may inject an arbitrary phase
    HonestPhases,   \* phases an HONEST member may carry (see NOTE below)
    MaxHonestMag,   \* per-member amplitude cap for honest members
    MaxByzMag       \* per-member amplitude cap for Byzantine members

\* NOTE on HonestPhases, because it is the whole hinge of the distinguishability
\* question and it is a MODELLING CHOICE, not a fact about the world:
\*   HonestPhases = {0}       models the AmplitudeEmu header reading - "CHIP-8 opcodes
\*                        introduce no phase", so an honest contributor is real and
\*                        non-negative and only an adversary can produce a phase.
\*   HonestPhases = {0, 2}    models phase as CARRYING MEANING - an honest member
\*                        genuinely holding the opposite hypothesis contributes the
\*                        opposite phase, and honest quorums can cancel by themselves.
\* The two give opposite answers on attributability. That is the finding, not a bug.

ASSUME PhaseAssumptions ==
    /\ Byzantine \subseteq Members
    /\ HonestPhases \subseteq 0..3
    /\ MaxHonestMag \in Nat /\ MaxByzMag \in Nat

Honest == Members \ Byzantine
AllPhases == 0..3
Zero == <<0, 0>>

\* The 4th roots of unity times an integer magnitude. Exact Gaussian integers:
\*   phase 0 = +1,  phase 1 = +i,  phase 2 = -1,  phase 3 = -i
Vec(p, k) ==
    CASE p = 0 -> <<k, 0>>
      [] p = 1 -> <<0, k>>
      [] p = 2 -> <<-k, 0>>
      [] OTHER -> <<0, -k>>

HonestOptions == {Vec(p, k) : p \in HonestPhases, k \in 1..MaxHonestMag}
ByzOptions == {Vec(p, k) : p \in AllPhases, k \in 0..MaxByzMag}
OptionsFor(m) == IF m \in Byzantine THEN ByzOptions ELSE HonestOptions

VARIABLES
    contrib,    \* member to its Gaussian-integer amplitude (Zero until it acts)
    given       \* which members have actually contributed. A separate set rather
                \* than a sentinel inside contrib, so that "has not spoken" and
                \* "contributed nothing" stay DIFFERENT states - the instrument has
                \* to tell silence apart from a zero contribution or it will report
                \* an empty room as a disagreement.

vars == <<contrib, given>>

AllOptions == HonestOptions \cup ByzOptions \cup {Zero}

TypeOK ==
    /\ contrib \in [Members -> AllOptions]
    /\ given \subseteq Members

Init ==
    /\ contrib = [m \in Members |-> Zero]
    /\ given = {}

Contribute(m, v) ==
    /\ m \notin given
    /\ v \in OptionsFor(m)
    /\ contrib' = [contrib EXCEPT ![m] = v]
    /\ given' = given \cup {m}

Next == \E m \in Members : \E v \in OptionsFor(m) : Contribute(m, v)

Spec == Init /\ [][Next]_vars

RECURSIVE SumComponent(_, _)
SumComponent(S, ix) ==
    IF S = {} THEN 0
    ELSE LET x == CHOOSE y \in S : TRUE
         IN contrib[x][ix] + SumComponent(S \ {x}, ix)

Complete == given = Members
ResultantRe == SumComponent(Members, 1)
ResultantIm == SumComponent(Members, 2)

\* Someone actually showed up. Without this conjunct an all-zero quorum would count
\* as "cancellation", which is silence, not interference.
SomeNonZero == \E m \in Members : contrib[m] # Zero

FullCancellation ==
    /\ Complete
    /\ SomeNonZero
    /\ ResultantRe = 0
    /\ ResultantIm = 0

(* == Q1. IS FULL CANCELLATION REACHABLE, AND AT WHAT f ==
   A reachability probe, run with EXPECT VIOLATION. Because violations transfer up to
   the real-phase model (see header), a red result here is a SOUND statement about the
   general adversary. A green result is only ever a statement about this restriction.

   Across the configs the answer has no 1/3 threshold in it at all:
     - honest phases fixed at 0, per-member magnitude capped equally: an adversary needs
       as much amplitude as the whole honest quorum, so f has to reach a MAJORITY of
       amplitude - strictly harder for the adversary than the 1/3 consensus threshold.
     - per-member magnitude UNCAPPED: f = 1 suffices. One member with a large enough
       opposite-phase contribution annihilates any quorum, whatever its size.
   The tolerance is therefore set by AMPLITUDE NORMALISATION, not by member count, and
   that is the design consequence: normalise per-member contribution before the
   amplitude layer is given any authority, or quorum tolerance collapses from f < n/3
   to f = 1.

   ROUTING, stated because it is the honest limit of this module: the general-phase
   version of the capped claim is the triangle inequality over the reals, which is NOT
   what TLA+ is for. It belongs in Z3 or Lean, and it is filed as such rather than
   quietly inferred from a green TLC run over axis-aligned phases. *)
NoFullCancellation == \lnot FullCancellation

(* == Q2. IS IT DISTINGUISHABLE FROM HONEST DISAGREEMENT ==
   Expect VIOLATION exactly when honest members are permitted opposite phases. The
   counterexample is a completed quorum summing to zero with EVERY Byzantine member
   contributing nothing - observationally identical to adversarial annihilation.

   When it fails, the instrument reports a fact with two readings and no way to separate
   them from the resultant alone. Under dual-use-detection-is-neutral-oracle-decides
   that is ALLOWED - report the neutral fact, let policy attach the reading - but only
   on condition the ambiguity is stated. This property is that statement in checkable
   form, so the ambiguity cannot quietly go missing later.

   Note what is NOT recoverable by watching harder: the counterexample survives FULL
   per-member visibility, because the honest and the adversarial contributions are the
   same values. No amount of observation separates them. Only a CONSTRAINT on honest
   phase does, which is the real content of the choice recorded at HonestPhases. *)
CancellationImpliesByzantineContributor ==
    FullCancellation =>
        \E m \in Byzantine : contrib[m] # Zero
================================================================================
