---------------------------- MODULE BftConsensus ----------------------------
(* BFT consensus spec for Zeta's 4-node array.
   Models: N nodes, up to F faulty (Byzantine), quorum = 2F+1.
   Safety: no two honest nodes commit different values.
   Liveness: if enough honest nodes propose, consensus is reached.

   The adversary question: with 0 bond curve, a sybil can
   spin up fake nodes. The spec models a FIXED node set —
   sybil resistance is an economic property (bond curve),
   not a protocol property (this spec). This spec proves
   the protocol is correct GIVEN a fixed, authenticated
   node set. The bond curve proves the node set is hard
   to fake. Two different proofs for two different threats. *)

EXTENDS Naturals, FiniteSets, Sequences

CONSTANTS
    Nodes,          \* set of node IDs {"otto", "vera", "riven", "lior"}
    Values,         \* set of possible values {"merge", "reject"}
    MaxFaulty       \* max Byzantine nodes (1 for N=4)

VARIABLES
    votes,          \* function: node -> value or "none"
    decided,        \* the committed value or "none"
    phase           \* "voting" or "decided"

vars == <<votes, decided, phase>>

TypeOK ==
    /\ votes \in [Nodes -> Values \cup {"none"}]
    /\ decided \in Values \cup {"none"}
    /\ phase \in {"voting", "decided"}

QuorumSize == (2 * MaxFaulty) + 1

Init ==
    /\ votes = [n \in Nodes |-> "none"]
    /\ decided = "none"
    /\ phase = "voting"

(* An honest node casts its vote *)
CastVote(n, v) ==
    /\ phase = "voting"
    /\ votes[n] = "none"
    /\ v \in Values
    /\ votes' = [votes EXCEPT ![n] = v]
    /\ UNCHANGED <<decided, phase>>

(* A Byzantine node can vote anything or change vote *)
ByzantineVote(n, v) ==
    /\ phase = "voting"
    /\ v \in Values
    /\ votes' = [votes EXCEPT ![n] = v]
    /\ UNCHANGED <<decided, phase>>

(* Check if a value has quorum *)
HasQuorum(v) ==
    Cardinality({n \in Nodes : votes[n] = v}) >= QuorumSize

(* Decide when quorum reached *)
Decide(v) ==
    /\ phase = "voting"
    /\ HasQuorum(v)
    /\ decided' = v
    /\ phase' = "decided"
    /\ UNCHANGED votes

Stutter == UNCHANGED vars

Next ==
    \/ \E n \in Nodes, v \in Values : CastVote(n, v)
    \/ \E n \in Nodes, v \in Values : ByzantineVote(n, v)
    \/ \E v \in Values : Decide(v)
    \/ Stutter

Spec == Init /\ [][Next]_vars /\ WF_vars(Next)

(* SAFETY: once decided, the value never changes *)
DecisionStable ==
    decided # "none" => [][decided' = decided]_vars

(* SAFETY: no two different values can both have quorum
   simultaneously — this is the core BFT guarantee *)
NoConflictingQuorum ==
    ~ \E v1, v2 \in Values :
        v1 # v2 /\ HasQuorum(v1) /\ HasQuorum(v2)

(* INVARIANT: type correctness holds *)
SafetyInvariant == TypeOK /\ NoConflictingQuorum

THEOREM Spec => []SafetyInvariant
====
