----------------------------- MODULE WagerSolvency -----------------------------
(* THE SUBSISTENCE FLOOR, SOCIALISED LOSS, AND THE SOLVENCY-UNDER-PRIVACY
   CONTRADICTION - Soraya, 2026-08-13, from Aaron on strengthening the wager design.

     "i think we can have a split between necessary funds and fun money, fun money you
      can afford to loose and still survive without depending on others for subsdity"

   == WHY THIS IS A SEPARATE MODULE ==
   QuorumCollateral.tla prices DEFECTION. This module prices RUIN. They are different
   state machines over different variables, and fusing them would multiply two state
   spaces to re-derive results each already has. Same decomposition discipline that
   kept the consensus layer in BftConsensus.tla.

   == 1. THE SPLIT HAS AN EXACT ANCHOR, AND IT IS NOT A JUDGEMENT CALL ==
   Kelly 1956: wager a fraction of bankroll proportional to edge; wager the whole
   bankroll and ruin is certain. Under log utility, utility goes to minus infinity at
   zero wealth - so the subsistence floor is the point at which the objective becomes
   UNDEFINED, not a point where someone decided the risk felt uncomfortable. "Fun money
   you can afford to lose" is the Kelly fraction turned into a hard boundary rather
   than an optimum.

   `StructuralSplit` decides whether that boundary is RUNG 1 (a wager against necessary
   funds is unrepresentable - no action can express it) or merely discouraged. The
   difference is checkable and it is checked: see NoSocialisedLoss.

   == 2. THE RUIN CONDITION IS SOCIAL, AND THAT IS WHAT MAKES SLASHING BITE ==
   Aaron: "without depending on others for subsdity". If a dweller can wager into a
   position where the society must carry them, the stake was never at risk - it was
   SOCIALLY INSURED, and socially-insured stake does not deter. Upside kept, downside
   mutualised: the bailout problem, and ordinary moral hazard.

   So the necessary/fun split is not a comfort feature bolted onto the wager. It is the
   PRECONDITION that makes voluntary staking a real risk rather than a free option. The
   wagerable pool has to be, by construction, the pool whose total loss creates no claim
   on anybody else. NoSocialisedLoss is that requirement, checkable.

   == 3. THE TWO GOALS GENERATE A THIRD REQUIREMENT, AND IT IS A REAL CONTRADICTION ==
   Aaron also wants solvency and budgeting to stay BEHIND privacy budget, revealed only
   if the individual chooses. But a BFT counterparty must know a validator stake is
   real. "My balance is frosted" and "you can trust my stake" cannot both hold from
   plain balances - they need a PROOF OF SOLVENCY THAT REVEALS NO BALANCE.

   That is a derived requirement, not a preference: without it the two stated goals
   contradict. `SolvencyProofSound` is the abstraction of that construction, and
   NoPhantomStake is what it has to buy. Prior art: Maxwell proof-of-reserves;
   Bulletproofs (Bunz et al. 2018) for the range proofs. CITED FROM STANDING KNOWLEDGE,
   NOT PAGE-CHECKED - the construction is named as the route, not verified here.

   == 4. THE SELF-REFERENCE, AND IT IS NOT BENIGN ==
   Privacy budget is the currency, the thing wagered, AND the thing that buys the frost
   hiding the balance. So FROSTING SPENDS THE VERY BALANCE THE ATTESTATION CERTIFIED.
   Attest, then frost, and a solvency proof that was true when issued is false while
   still being believed. AttestationStaysTrue is that check, and it is expected to FAIL
   unless attested funds are LOCKED against the frosting spend. That lock is a design
   consequence this module exists to surface, not an assumption it makes. *)

EXTENDS Naturals, FiniteSets

CONSTANTS
    Dwellers,
    SubsistenceFloor,   \* the level below which a dweller needs others to carry them
    InitialNecessary,
    InitialFun,
    AttestThreshold,    \* the solvency level a validator claims
    FrostCost,
    StructuralSplit,    \* is a wager against necessary funds UNREPRESENTABLE
    SolvencyProofSound  \* does attestation actually require the funds to be there

ASSUME WagerAssumptions ==
    /\ StructuralSplit \in BOOLEAN
    /\ SolvencyProofSound \in BOOLEAN
    /\ InitialNecessary >= SubsistenceFloor

VARIABLES
    necessary,  \* the floor. Under StructuralSplit nothing may draw on it.
    fun,        \* the wagerable pool - loss here creates no claim on anyone
    wagered,    \* currently at risk
    attested,   \* dwellers who have published a solvency claim
    frosted     \* dwellers who have bought privacy over their balance

vars == <<necessary, fun, wagered, attested, frosted>>

Total(d) == necessary[d] + fun[d] + wagered[d]
NeedsSubsidy(d) == necessary[d] < SubsistenceFloor

TypeOK ==
    /\ necessary \in [Dwellers -> 0..InitialNecessary]
    /\ fun \in [Dwellers -> 0..InitialFun]
    /\ wagered \in [Dwellers -> 0..(InitialNecessary + InitialFun)]
    /\ attested \subseteq Dwellers
    /\ frosted \subseteq Dwellers

Init ==
    /\ necessary = [d \in Dwellers |-> InitialNecessary]
    /\ fun = [d \in Dwellers |-> InitialFun]
    /\ wagered = [d \in Dwellers |-> 0]
    /\ attested = {}
    /\ frosted = {}

(* THE WAGER. Under StructuralSplit the guard reads ONLY `fun`, so a wager against
   necessary funds is not discouraged - it is UNSAYABLE. With the flag off, the same
   action may draw on necessary funds once fun is exhausted, which is the design most
   systems arrive at by not thinking about it. Both are in the state space so the
   difference can be measured instead of argued. *)
Wager(d) ==
    /\ IF StructuralSplit
       THEN /\ fun[d] > 0
            /\ fun' = [fun EXCEPT ![d] = @ - 1]
            /\ UNCHANGED necessary
       ELSE /\ fun[d] + necessary[d] > 0
            /\ IF fun[d] > 0
               THEN /\ fun' = [fun EXCEPT ![d] = @ - 1]
                    /\ UNCHANGED necessary
               ELSE /\ necessary' = [necessary EXCEPT ![d] = @ - 1]
                    /\ UNCHANGED fun
    /\ wagered' = [wagered EXCEPT ![d] = @ + 1]
    /\ UNCHANGED <<attested, frosted>>

(* The wager is lost. This is the slashing event seen from the dweller side, and it
   is total: everything at risk is gone. If the split is real, this state is survivable
   with no claim on anyone; if it is not, this is where the society acquires a liability
   it never agreed to. *)
LoseWager(d) ==
    /\ wagered[d] > 0
    /\ wagered' = [wagered EXCEPT ![d] = 0]
    /\ UNCHANGED <<necessary, fun, attested, frosted>>

(* Publishing a solvency claim. When the proof construction is SOUND the funds must
   actually be there; when it is not, the claim is free and the stake is a phantom. *)
Attest(d) ==
    /\ d \notin attested
    /\ (SolvencyProofSound => Total(d) >= AttestThreshold)
    /\ attested' = attested \cup {d}
    /\ UNCHANGED <<necessary, fun, wagered, frosted>>

(* Buying privacy over the balance. This SPENDS the same budget the attestation
   certified - the self-reference at the centre of the design. *)
Frost(d) ==
    /\ d \notin frosted
    /\ fun[d] >= FrostCost
    /\ fun' = [fun EXCEPT ![d] = @ - FrostCost]
    /\ frosted' = frosted \cup {d}
    /\ UNCHANGED <<necessary, wagered, attested>>

Next ==
    \/ \E d \in Dwellers : Wager(d)
    \/ \E d \in Dwellers : LoseWager(d)
    \/ \E d \in Dwellers : Attest(d)
    \/ \E d \in Dwellers : Frost(d)
    \/ UNCHANGED vars

Spec == Init /\ [][Next]_vars

(* == W1. THE FLOOR IS UNWAGERABLE - an action property ==
   Necessary funds never decrease, by any action, ever. HOLDS under StructuralSplit,
   VIOLATED without it. Rung 1 versus a policy note, measured. *)
FloorUnwagerable ==
    [][\A d \in Dwellers : necessary'[d] >= necessary[d]]_vars

(* == W2. NO SOCIALISED LOSS - the moral-hazard check ==
   No dweller ever reaches a state where it needs others to carry it. This is the
   property that makes a voluntary wager a REAL risk: if it fails, the downside was
   mutualised all along, the stake was socially insured, and the deterrence argument
   for R4 collapses regardless of any Byzantine arithmetic. *)
NoSocialisedLoss == \A d \in Dwellers : \lnot NeedsSubsidy(d)

(* == W3. NO PHANTOM STAKE - what the ZK construction has to buy ==
   Every dweller with a published solvency claim actually holds the funds. VIOLATED
   when SolvencyProofSound is FALSE, which is the whole point: this is the property
   that a proof-of-reserves plus range proof exists to purchase, and naming it is what
   turns "keep balances private" from a wish into a requirement with a known cost. *)
NoPhantomStake ==
    \A d \in attested : Total(d) >= AttestThreshold

(* == W4. THE ATTESTATION GOES STALE - EXPECTED TO FAIL ==
   Same predicate as W3, run in a config where frosting is affordable AFTER attesting.
   The counterexample is the self-reference biting: a dweller attests truthfully, then
   spends the certified budget to buy the frost that hides the balance, and the
   attestation is now false while still believed.

   The fix is not a bigger proof. It is a LOCK: funds covered by a live attestation
   must be unspendable, including by the privacy purchase itself. That is a design
   consequence this module surfaces rather than assumes, and it is why W3 and W4 are
   the same predicate under two configs - the difference is entirely whether the frost
   is reachable while the claim is live. *)

(* == WITNESS. Losses must actually be reachable ==
   Run with EXPECT VIOLATION. If losing a wager were unreachable, NoSocialisedLoss
   would be green for the most boring reason available and would mean nothing. *)
NoLossEver == \A d \in Dwellers : wagered[d] = 0

SafetyInvariant == TypeOK /\ NoSocialisedLoss
================================================================================
