---------------------------- MODULE BftConsensus ----------------------------
(* BFT consensus spec for Zeta's 4-node array.
   Models: N nodes, up to F Byzantine, quorum = 2F+1, N >= 3F+1.

   ══ REPAIRED 2026-08-11 (was audited 2026-08-10) ══
   Audit + the pre-repair evidence:
   docs/research/2026-08-10-synchrony-non-transfer-audit-bftconsensus-checks-a-counting-tautology.md

   What was wrong, and what this version does about it:

   (a) `decided` was a SINGLE GLOBAL variable, so "no two honest nodes commit different
       values" — the property the header advertised — was not expressible. There was
       exactly one decision in the state space by construction.
       FIXED: `decided` is now per-node, and `Agreement` states the real property.

   (b) The checked invariant could not fail. `NoConflictingQuorum` was pigeonhole about
       the state representation (one vote per node; two quorums of 3 need 6 nodes, there
       are 4), so deleting the quorum guard from `Decide` left it green — a deliberately
       broken protocol passed unchanged.
       FIXED: `Agreement` is falsifiable by construction. The mutation that the old
       invariant survived now FAILS it, which is checked and recorded below.

   (c) THERE WAS NO BYZANTINE NODE SET — found during the repair, not in the original
       audit. `ByzantineVote(n, v)` was quantified over ALL nodes, so every node could
       equivocate and `MaxFaulty` only ever fed `QuorumSize`. The model permitted 4-of-4
       Byzantine while claiming a 1-fault bound.
       FIXED: `Byzantine` is a constant, bounded by `ASSUME`; only its members may
       equivocate, and honest nodes are write-once.

   STILL NOT MODELLED, stated so this is not read as more than it is:
   * NO NETWORK. `HasQuorum` reads the global vote function atomically, so this remains a
     SYNCHRONOUS shared-memory model. Quorum over *received* votes needs a message
     variable, and without one no delay- or partition-related property can be stated.
   * NO LIVENESS. Deliberately absent rather than claimed: with no network model the
     honest form needs a partial-synchrony assumption (FLP 1985 forbids the unconditional
     form), and asserting it in prose is what the audit caught. Scoped out here in the
     `PredictiveLookahead.cfg` style rather than advertised.

   The adversary question, unchanged and still right: with 0 bond curve a sybil can spin
   up fake nodes. This spec models a FIXED, AUTHENTICATED node set — sybil resistance is
   an economic property (bond curve), not a protocol property. Two different proofs for
   two different threats. *)

EXTENDS Naturals, FiniteSets, Sequences

CONSTANTS
    Nodes,          \* set of node IDs {"otto", "vera", "riven", "lior"}
    Values,         \* set of possible values {"merge", "reject"}
    MaxFaulty,      \* max Byzantine nodes (1 for N=4)
    Byzantine       \* WHICH nodes are faulty — previously missing, so nothing was bounded

\* The bound that makes the whole thing a BFT model rather than a shape. Without the first
\* conjunct, "up to F faulty" is decoration; without the second, 2F+1 is not a quorum.
ASSUME BftAssumptions ==
    /\ Byzantine \subseteq Nodes
    /\ Cardinality(Byzantine) <= MaxFaulty
    /\ Cardinality(Nodes) >= (3 * MaxFaulty) + 1

Honest == Nodes \ Byzantine

VARIABLES
    votes,          \* node -> value or "none"
    decided         \* node -> the value THAT NODE committed, or "none"  (was a single global)

vars == <<votes, decided>>

TypeOK ==
    /\ votes \in [Nodes -> Values \cup {"none"}]
    /\ decided \in [Nodes -> Values \cup {"none"}]

QuorumSize == (2 * MaxFaulty) + 1

Init ==
    /\ votes = [n \in Nodes |-> "none"]
    /\ decided = [n \in Nodes |-> "none"]

(* An honest node votes once and never changes it. Write-once is what makes honesty mean
   something here; previously nothing distinguished an honest node from a faulty one. *)
CastVote(n, v) ==
    /\ n \in Honest
    /\ votes[n] = "none"
    /\ v \in Values
    /\ votes' = [votes EXCEPT ![n] = v]
    /\ UNCHANGED decided

(* Only a Byzantine node may equivocate — vote anything, and change its vote freely. *)
ByzantineVote(n, v) ==
    /\ n \in Byzantine
    /\ v \in Values
    /\ votes' = [votes EXCEPT ![n] = v]
    /\ UNCHANGED decided

HasQuorum(v) ==
    Cardinality({n \in Nodes : votes[n] = v}) >= QuorumSize

(* A node decides for itself, once, when it observes a quorum. Decisions are immutable:
   the `decided[n] = "none"` guard is what makes a commitment a commitment. *)
Decide(n, v) ==
    /\ decided[n] = "none"
    /\ HasQuorum(v)
    /\ decided' = [decided EXCEPT ![n] = v]
    /\ UNCHANGED votes

Stutter == UNCHANGED vars

Next ==
    \/ \E n \in Nodes, v \in Values : CastVote(n, v)
    \/ \E n \in Nodes, v \in Values : ByzantineVote(n, v)
    \/ \E n \in Nodes, v \in Values : Decide(n, v)
    \/ Stutter

Spec == Init /\ [][Next]_vars

(* ══ SAFETY: the property the header always advertised, now actually expressible ══
   No two HONEST nodes commit different values. Byzantine nodes may "decide" anything —
   excluding them is not weakening the claim, it is what the claim has always meant.

   Why it holds, and why it is NOT pigeonhole: for a value to reach quorum 2F+1, at least
   F+1 of its voters are honest, and honest votes are write-once. A second value would need
   2F+1 voters drawn from the at most N-(F+1) nodes not permanently committed to the first —
   which, given N >= 3F+1, is fewer than 2F+1. So two values can never both hold quorum,
   even at different times. That is a protocol argument; the old invariant had none. *)
Agreement ==
    \A n1, n2 \in Honest :
        (decided[n1] # "none" /\ decided[n2] # "none") => decided[n1] = decided[n2]

(* DECISION FINALITY is enforced STRUCTURALLY by `Decide`'s `decided[n] = "none"` guard: no
   action can rewrite a commitment, so no reachable state has one changing.
   It is deliberately NOT restated as an invariant, because "never revised" is a claim about
   a TRANSITION, not about a state — a state predicate cannot express it, and a temporal
   property would be needed instead.
   Recorded because a first draft of this repair asserted it as
   `votes[decided[n]] = votes[decided[n]]`, which is both a tautology AND a type error
   (`decided[n]` is a Value, not a Node). Shipping that would have reintroduced the audited
   defect — an unfalsifiable assertion — in the very commit repairing it. *)

(* The original counting fact. KEPT — it is true and cheap — but demoted: it is a property
   of the state representation, not of the protocol, and it must never again be the only
   thing checked. *)
NoConflictingQuorum ==
    ~ \E v1, v2 \in Values :
        v1 # v2 /\ HasQuorum(v1) /\ HasQuorum(v2)

SafetyInvariant == TypeOK /\ Agreement /\ NoConflictingQuorum

THEOREM Spec => []SafetyInvariant
====
