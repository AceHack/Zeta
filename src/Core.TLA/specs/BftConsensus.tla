---------------------------- MODULE BftConsensus ----------------------------
(* BFT consensus spec for Zeta's 4-node array.
   Models: N nodes, up to F faulty (Byzantine), quorum = 2F+1.

   ══ AUDIT 2026-08-10 — READ BEFORE RELYING ON THIS SPEC ══
   The two properties this header used to advertise are NOT what the spec checks.
   Full audit + reproduction:
   docs/research/2026-08-10-synchrony-non-transfer-audit-bftconsensus-checks-a-counting-tautology.md

   (a) "Safety: no two honest nodes commit different values" — NOT EXPRESSIBLE here.
       `decided` is a SINGLE GLOBAL variable, not a per-node function, so there is exactly
       one decision in the whole state space by construction. The property has no
       representation: it is not proven, not disproven, absent.

   (b) The invariant that IS checked, NoConflictingQuorum, CANNOT FAIL. `votes` is a
       function, so one vote per node; two disjoint quorums of 3 need 6 nodes and Nodes
       has 4. It is pigeonhole about the STATE REPRESENTATION, not about the protocol.
       DEMONSTRATED, not argued: deleting the quorum guard from `Decide` — so any node may
       decide any value at any time with no quorum at all — still yields
       "Model checking completed. No error has been found" (1270 states, 243 distinct,
       vs 982/99 unmutated; the count change confirms the mutation took effect).
       A deliberately broken consensus protocol passes this check unchanged.

   (c) "Liveness: if enough honest nodes propose, consensus is reached" — NOT PRESENT.
       Zero temporal operators in this file, no PROPERTY in BftConsensus.cfg. And with no
       message/network model at all, HasQuorum reads the global vote function atomically:
       this is a SYNCHRONOUS shared-memory model, in which the honest form of a liveness
       claim needs a partial-synchrony assumption the spec never states (FLP 1985).

   (d) DecisionStable is defined below and never checked; the THEOREM carries no proof and
       TLAPS does not run on this file.

   TLC does run this spec (tests/Tests.FSharp/Formal/Tlc.Runner.Tests.fs) and the green is
   real and exhaustive — 982 states, 99 distinct, depth 6 — and vacuous, per (b).

   NOT REPAIRED HERE: making `decided` per-node, adding a network model, and stating
   partial synchrony are semantic changes belonging to this spec's owner. Repair priority
   is listed in the audit §3.
   ══════════════════════════════════════════════════════════

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
