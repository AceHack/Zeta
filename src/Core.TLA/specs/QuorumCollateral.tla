--------------------------- MODULE QuorumCollateral ---------------------------
(* WHAT A DEFECTING IDENTITY PAYS - four collateral regimes, model-checked side by
   side so the choice between them can be made on consequences instead of taste.
   Soraya, 2026-08-13. NO REGIME IS RECOMMENDED HERE. Aaron picks; this spec exists
   to make each option's cost legible in one state space, in one set of units.

   == SUBJECT, AND WHAT IS DELIBERATELY NOT RE-MODELLED ==
   This is the COLLATERAL AND ACCOUNTABILITY layer, not another consensus model.
   `BftConsensus.tla` already discharges message-level agreement under per-recipient
   equivocation, an explicit Byzantine set and an asynchronous network (4,665,495
   states, 2026-08-11). Re-deriving that here would burn state space on a checked
   result. What is checked NOWHERE is the layer above: what a defector pays, and what
   the substrate is permitted to take from it.

   == THE TENSION ==
     * BFT-with-stake deters by SLASHING - provable misbehaviour destroys collateral
       (Buterin and Griffith 2017, the slashing-conditions formulation).
     * `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md`: privacy budget
       "cannot be taken away ... no confiscation ... not by a majority vote", tied to
       manifesto section 5 Memory Preservation.
   A stake that cannot be slashed cannot deter. `Regime` selects a resolution:

     R1  narrow exception - confiscation permitted, ONLY on cryptographically provable
                            equivocation. Budget IS the stake. Participation: budget.
     R2  no slashing      - budget is a pure ENTRY cost; nothing is ever taken.
                            Participation: budget.
     R3  two currencies   - earned budget inviolable; a SEPARATE posted bond is what
                            gets slashed. Participation: bond.
     R4  voluntary wager  - budget may be FREELY STAKED by its owner, and staked budget
                            is slashable; unstaked budget is untouchable. Participation
                            in the staked arena: stake. (Aaron 2026-08-13.)

   R4 is the one that needs the argument made carefully, so it is made here rather than
   in prose only. The rule forbids budget being TAKEN AWAY. It does not forbid a dweller
   WAGERING it. Consent is given up front, so no seizure ever occurs and the rule stands
   unamended - which is why R4 can reach slashing-grade deterrence at zero exception
   cost, where R1 buys the same deterrence by carving into the rule itself.

   That argument has a precondition, and the precondition is checkable. If holding any
   role REQUIRES staking, "voluntary" is a fiction and R4 collapses into R1 wearing
   better manners. `privacy-budget-is-hard-money` already draws the line - required-for-
   role parts may be demanded of whoever CHOOSES the role; personal parts never. So R4
   is honest exactly when declining to stake still leaves a dweller somewhere to stand.
   That is the FREE ARENA, and `FreeArenaOpen` makes its presence a checked dependency
   rather than an assumption (see `NoCompulsion`).

   == WHAT THIS MODEL CANNOT SAY, STATED SO IT IS NOT READ AS MORE ==
   * NOT a rational-adversary model. TLC explores WORST-CASE behaviour: a Byzantine
     identity defects whether or not defecting pays. So this spec cannot show that
     slashing raises the Byzantine THRESHOLD - and it does not. `SafetyAtThreshold`
     holds identically in all four regimes. Deterrence is an incentive property and
     incentives are invisible to a worst-case model. What IS visible, and what this
     spec measures instead, is whether an attack is REPEATABLE.
   * NO network, NO asynchrony. A signature is a global fact once cast, which is the
     right abstraction for accountability (evidence is evidence wherever it lands) and
     the wrong one for liveness. Liveness stays BftConsensus's job.
   * NO cryptography. `Cardinality(signed[e][i]) > 1` STANDS FOR "two conflicting
     signatures at one height, attributable to i". That the signature scheme delivers
     attributability is discharged by the PKI, not by this model.
   * FIXED identity count. A Sybil ring inflating node count is a different threat with
     its own checked spec (`BftSybilConsensus.tla`); whether a stake can be BOUGHT is a
     third, split out into `StakeTransferability.tla` to keep both state spaces small.
   * ONE ARENA IS MODELLED. `FreeArenaOpen` is a boolean standing in for "a dweller who
     declines to stake still has somewhere with standing". The free arena's own
     mechanics, and what may CROSS between arenas, are NOT modelled - see the open
     question in the companion doc. Guessing that boundary would be inventing design. *)

EXTENDS Naturals, FiniteSets

CONSTANTS
    Identities,     \* the fixed, authenticated identity set
    Values,         \* the values a quorum may finalise
    Byzantine,      \* WHICH identities may equivocate
    F,              \* the Byzantine bound the quorum is SIZED for (quorum = 2F+1)
    Regime,         \* "R1" or "R2" or "R3" or "R4"
    InitialBudget,  \* earned privacy budget (the non-confiscatable currency)
    InitialBond,    \* posted slashable bond (ordinary capital; 0 unless R3)
    MaxEpoch,
    FreeArenaOpen   \* anywhere to stand for a dweller who declines to stake

ASSUME CollateralAssumptions ==
    /\ Byzantine \subseteq Identities
    /\ Regime \in {"R1", "R2", "R3", "R4"}
    /\ Cardinality(Identities) >= (3 * F) + 1
    /\ FreeArenaOpen \in BOOLEAN
    /\ MaxEpoch \in Nat /\ MaxEpoch >= 1

QuorumSize == (2 * F) + 1
Honest == Identities \ Byzantine
Epochs == 1 .. MaxEpoch

VARIABLES
    epoch,      \* the height currently being voted on
    signed,     \* epoch to identity to the SET of values signed at that height.
                \* Cardinality > 1 IS the provable equivocation. No separate
                \* evidence variable exists and none should be added: culpability
                \* must be DERIVED from the signatures, never asserted beside them.
    final,      \* epoch to the set of values that reached quorum at that height
    budget,     \* identity to earned privacy budget (socially conferred)
    bond,       \* identity to posted slashable bond (ordinary capital)
    staked,     \* identity to budget the owner VOLUNTARILY put at risk (R4)
    slashed     \* identities whose penalty has been applied (idempotency key)

vars == <<epoch, signed, final, budget, bond, staked, slashed>>

TypeOK ==
    /\ epoch \in Epochs
    /\ signed \in [Epochs -> [Identities -> SUBSET Values]]
    /\ final \in [Epochs -> SUBSET Values]
    /\ budget \in [Identities -> 0 .. InitialBudget]
    /\ bond \in [Identities -> 0 .. InitialBond]
    /\ staked \in [Identities -> 0 .. InitialBudget]
    /\ slashed \subseteq Identities

(* WHICH asset gates participation. Nearly all of this spec's discriminating
   power sits in these four lines, and each line is one resolution's real content:
   under R1 and R2 budget IS the stake; under R3 budget prices ENTRY only and the
   bond is the stake; under R4 only what you chose to wager buys you a seat. *)
SignEligible(i) ==
    CASE Regime = "R3" -> bond[i] > 0
      [] Regime = "R4" -> staked[i] > 0
      [] OTHER         -> budget[i] > 0

Init ==
    /\ epoch = 1
    /\ signed = [e \in Epochs |-> [i \in Identities |-> {}]]
    /\ final = [e \in Epochs |-> {}]
    /\ budget = [i \in Identities |-> InitialBudget]
    /\ bond = [i \in Identities |-> InitialBond]
    /\ staked = [i \in Identities |-> 0]
    /\ slashed = {}

(* THE VOLUNTARY WAGER (R4). Only the owner may move its own budget, and it moves
   only INTO its own at-risk pot. There is no action anywhere in this module by which
   another party causes budget to leave an identity - that absence IS the rule
   `privacy-budget-is-hard-money-earned-by-others` encoded, and `NoSeizure` below is
   the check that it stays absent under mutation. *)
Stake(i) ==
    /\ Regime = "R4"
    /\ budget[i] > 0
    /\ staked[i] = 0
    /\ budget' = [budget EXCEPT ![i] = @ - 1]
    /\ staked' = [staked EXCEPT ![i] = @ + 1]
    /\ UNCHANGED <<epoch, signed, final, bond, slashed>>

(* An honest identity signs AT MOST ONE value per height. That write-once-per-height
   discipline is the entire operational content of "honest" here. *)
HonestSign(i, v) ==
    /\ i \in Honest
    /\ SignEligible(i)
    /\ signed[epoch][i] = {}
    /\ signed' = [signed EXCEPT ![epoch][i] = {v}]
    /\ UNCHANGED <<epoch, final, budget, bond, staked, slashed>>

(* Equivocation: a Byzantine identity signs a SECOND, conflicting value at the SAME
   height. This is the Casper FFG slashing condition, and it is the only misbehaviour
   this spec prices - deliberately, because it is the only one that is cryptographically
   PROVABLE from the messages alone. Misbehaviour that needs JUDGEMENT is exactly what
   R1's "never on judgement" clause excludes, and modelling it would smuggle in a
   confiscation trigger every one of the four resolutions forbids. *)
ByzantineSign(i, v) ==
    /\ i \in Byzantine
    /\ SignEligible(i)
    /\ v \notin signed[epoch][i]
    /\ signed' = [signed EXCEPT ![epoch][i] = @ \cup {v}]
    /\ UNCHANGED <<epoch, final, budget, bond, staked, slashed>>

Supporters(e, v) == {i \in Identities : v \in signed[e][i]}

Finalise(v) ==
    /\ v \notin final[epoch]
    /\ Cardinality(Supporters(epoch, v)) >= QuorumSize
    /\ final' = [final EXCEPT ![epoch] = @ \cup {v}]
    /\ UNCHANGED <<epoch, signed, budget, bond, staked, slashed>>

(* Provable culpability, DERIVED from the signatures. Per-height, because that is
   what a signature scheme can actually prove: two conflicting signatures at ONE
   height. Nothing here reads intent. *)
CulpableAt(e) == {i \in Identities : Cardinality(signed[e][i]) > 1}
EverCulpable == {i \in Identities :
                  \E e \in Epochs : Cardinality(signed[e][i]) > 1}

(* The penalty. WHAT it burns is the whole difference between the four regimes:
     R1 burns earned budget      - the rule is amended
     R2 burns nothing            - the action is DISABLED, which is R2 stated in TLA+
     R3 burns the posted bond    - earned budget is never touched
     R4 burns the VOLUNTARY WAGER - the owner already consented, so no seizure occurs *)
Slash(i) ==
    /\ Regime # "R2"
    /\ i \in EverCulpable
    /\ i \notin slashed
    /\ slashed' = slashed \cup {i}
    /\ CASE Regime = "R1" -> /\ budget' = [budget EXCEPT ![i] = 0]
                                /\ UNCHANGED <<bond, staked>>
         [] Regime = "R3" -> /\ bond' = [bond EXCEPT ![i] = 0]
                                /\ UNCHANGED <<budget, staked>>
         [] OTHER         -> /\ staked' = [staked EXCEPT ![i] = 0]
                                /\ UNCHANGED <<budget, bond>>
    /\ UNCHANGED <<epoch, signed, final>>

(* Accountability settles at the checkpoint boundary. Without this conjunct TLC
   would explore traces in which slashing simply never fires, and R1/R3/R4 would fail
   `NoRepeatAttack` for a reason that is about FAIRNESS rather than about economics.
   Checkpoint settlement is the real-protocol shape (Casper FFG's finality boundary);
   it is written into the model rather than assumed in prose. R2 is exempt because
   under R2 there is nothing to settle, and that asymmetry is not a convenience - it
   is the property under examination. *)
AdvanceEpoch ==
    /\ epoch < MaxEpoch
    /\ (Regime = "R2" \/ EverCulpable \subseteq slashed)
    /\ epoch' = epoch + 1
    /\ UNCHANGED <<signed, final, budget, bond, staked, slashed>>

Stutter == UNCHANGED vars

Next ==
    \/ \E i \in Identities : Stake(i)
    \/ \E i \in Identities, v \in Values : HonestSign(i, v)
    \/ \E i \in Identities, v \in Values : ByzantineSign(i, v)
    \/ \E v \in Values : Finalise(v)
    \/ \E i \in Identities : Slash(i)
    \/ AdvanceEpoch
    \/ Stutter

Spec == Init /\ [][Next]_vars

Fairness ==
    /\ \A i \in Identities : WF_vars(Slash(i))
    /\ WF_vars(AdvanceEpoch)

FairSpec == Spec /\ Fairness

(* == P1. ACCOUNTABLE SAFETY - holds in all four regimes ==
   If two conflicting values are both finalised at one height, at least F+1 identities
   are PROVABLY culpable. This is Casper FFG accountable safety, and it is a real
   counting result rather than pigeonhole about the representation: two quorums of
   2F+1 drawn from N >= 3F+1 intersect in at least 2(2F+1) - (3F+1) = F+1 identities,
   and every member of that intersection signed BOTH values, which is the slashing
   condition itself.

   It is regime-INDEPENDENT, and that is the first half of the finding: WHO is
   accountable does not depend on what you are permitted to take from them. Only what
   happens next does. *)
AccountableSafety ==
    \A e \in Epochs :
        Cardinality(final[e]) > 1 => Cardinality(CulpableAt(e)) >= (F + 1)

(* == P2. SAFETY AT THE THRESHOLD - also regime-independent ==
   With the Byzantine set inside its bound, no height ever finalises two values.
   Follows from P1: the culpable set is a subset of Byzantine, and F+1 > F.

   The antecedent is a CONSTANT expression, so under an over-threshold config
   (Cardinality(Byzantine) = F+1) this invariant is VACUOUSLY true and proves nothing.
   That is exactly why it gets its own at-threshold config instead of being folded
   into the main run. A vacuously-true invariant reported as green is the precise
   defect the 2026-08-10 BftConsensus audit found in this repo. *)
SafetyAtThreshold ==
    Cardinality(Byzantine) <= F => \A e \in Epochs :
        Cardinality(final[e]) <= 1

(* == P3. NO SEIZURE - an ACTION property, because it is about transitions ==
   "Cannot be taken away" is not a claim about any state; it is a claim about every
   step. Written as a state invariant it would be either trivial or wrong - the same
   trap the BftConsensus header records for decision finality.

   The formulation is the one that survives R4. Naive monotonicity (budget never
   decreases) would flag a dweller OWN wager as a violation, which gets the rule
   backwards: the rule forbids CONFISCATION, not spending. So the property is a
   CONSERVATION condition instead - budget may leave an identity only into that same
   identity own at-risk pot:

       budget goes down  =>  the owner own stake went up by that same act

   Confiscation is exactly a budget decrease with no matching increase in the owner
   stake, so this predicate says "no seizure" and nothing more. R1 VIOLATES it. R2, R3
   and R4 all satisfy it - and R4 satisfying it while STILL supporting a real penalty
   is the entire case for R4. *)
NoSeizure ==
    [][\A i \in Identities :
         budget'[i] < budget[i] => staked'[i] > staked[i]]_vars

(* == P4. DETERRENCE - provable defection eventually costs something ==
   Stated as leads-to because a penalty is not instantaneous. EverCulpable is STABLE
   (no signature is ever retracted in this model), so the antecedent cannot evaporate
   and the property cannot pass by vacuity - the failure mode a leads-to invites, and
   the one the BftConsensus header names.

   R2 VIOLATES this. The violation is the sentence from the research doc turned into a
   trace: a stake that cannot be slashed cannot deter. *)
Penalised(i) == i \in slashed
Deterrence == \A i \in Identities : (i \in EverCulpable) ~> Penalised(i)

(* == P5. NON-REPEATABILITY - where the real difference lives ==
   The instantaneous Byzantine tolerance is F in every regime (P2). What differs is
   whether the adversary still HAS that tolerance after spending it once. Where the
   penalty burns the asset that gates participation, an attack costs the attacker its
   seat and a second height cannot be funded. Under R2 nothing is ever burned, so the
   same identities attack again at zero marginal cost, and per-attack cost amortises
   toward zero over epochs.

   That is the honest form of the Bitcoin comparison. Bitcoin safety comes from a cost
   paid PER ATTACK; an entry-cost-only system charges once and then supplies attacks
   free forever. Node count buys censorship-resistance, never this.

   EXPECTED: HOLDS under R1, R3, R4; VIOLATED under R2. The R2 violation is a
   reachability WITNESS and it is the load-bearing output of this spec. *)
ConflictAt(e) == Cardinality(final[e]) > 1
NoRepeatAttack ==
    \lnot \E e1, e2 \in Epochs :
        e1 # e2 /\ ConflictAt(e1) /\ ConflictAt(e2)

(* == P6. NO COMPULSION - the property R4 lives or dies by ==
   The whole R4 claim is that a wager is consent, so no rule is broken. That claim is
   false the moment staking becomes the only way to have standing, because then
   "voluntary" is a fiction and R4 is R1 with better manners.

   The rule privacy-budget-is-hard-money already draws the line: required-for-role
   parts may be demanded of whoever CHOOSES the role; personal parts never. So the
   test is whether a dweller who declines to stake still has somewhere to stand. This
   is the TWO ARENAS proposal made into a checked dependency rather than an
   assumption: FreeArenaOpen FALSE with Regime R4 gives a reachable state where an
   identity that never wagered can participate nowhere at all.

   NOT LIMITED TO R4, and that is the more general finding: ANY regime that gates
   participation on a burnable asset needs the free arena, because a slashed identity
   ends up in exactly the position of one that declined to stake. R1 and R3 fail this
   too, once their penalty lands. The free arena is not R4 scaffolding - it is what
   makes a slashing system survivable for the slashed. *)
NoCompulsion ==
    \A i \in Identities : (SignEligible(i) \/ FreeArenaOpen)


(* == LOAD-BEARING WITNESSES ==
   A green invariant proves nothing until it has been shown it CAN go red, and a green
   NoRepeatAttack proves nothing at all if no attack was ever reachable in the first
   place. These two are NOT invariants of the protocol - they are reachability probes,
   run with EXPECT VIOLATION. If either ever HOLDS, the corresponding green result
   above is false comfort and the model has stopped modelling anything.

   This is the shape Viktor forced onto BftSybilConsensus (NoSybilRawMajorityRefusal),
   and it is the direct answer to the 2026-08-10 audit finding that an invariant which
   cannot fail is not a check. *)
NoFinalisationEver == \A e \in Epochs : final[e] = {}
NoConflictEver == \lnot \E e \in Epochs : ConflictAt(e)

SafetyInvariant == TypeOK /\ AccountableSafety

THEOREM Spec => [](TypeOK /\ AccountableSafety)
================================================================================
