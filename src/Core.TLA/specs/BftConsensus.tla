---------------------------- MODULE BftConsensus ----------------------------
(* BFT consensus spec for Zeta's 4-node array.
   Models: N nodes, up to F Byzantine, quorum = 2F+1, N >= 3F+1.

   ══ NETWORK ADDED 2026-08-11 (repair item 3) ══
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

   (d) NO NETWORK — the previously-recorded gap, and the reason nothing about delay could
       be stated. `HasQuorum` read the global vote function atomically, so a node could
       "observe" a quorum that had not reached it. That is a shared-memory model wearing a
       consensus header: in it, a partition is not merely unmodelled, it is UNSAYABLE.
       FIXED: `rcvd[n][s]` is what node n has actually received from node s. Quorum is
       computed per node over that, delivery is a separate action that may happen at any
       time or never, and `NoDecisionWithoutReceipt` pins the connection.

   WHAT THE NETWORK MODEL BUYS, precisely — it is asynchrony, not partial synchrony:
   * Delivery is nondeterministic and unbounded: `Deliver*` is always enabled for an
     undelivered pair and never forced. Arbitrary delay, reordering and permanent loss are
     all in the state space, so a partition IS now a reachable shape.
   * Equivocation is per-recipient. A Byzantine node may tell otto "merge" and vera
     "reject" — strictly stronger than a broadcast adversary, and the case that makes
     per-node views matter at all.
   * Quorum counts DISTINCT SENDERS, never messages. Counting messages would let one
     equivocating node fill a quorum by itself, which is the classic modelling error here.

   STILL NOT MODELLED, stated so this is not read as more than it is:
   * NO LIVENESS. Deliberately absent rather than claimed: the honest form needs a
     partial-synchrony assumption (FLP 1985 forbids the unconditional form) plus fairness
     on `Deliver*`. Item 3 was its blocker and is now done, so this is next rather than
     impossible. Scoped out in the `PredictiveLookahead.cfg` style, not advertised.
   * NO SIGNATURES / no message authentication beyond the sender label; a Byzantine node
     cannot forge a message *from an honest node* here, which is an assumption, not a
     result. Real deployments buy it with the PKI, not the protocol.

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
    votes,          \* node -> the value an HONEST node cast, or "none" (write-once)
    decided,        \* node -> the value THAT NODE committed, or "none"  (was a single global)
    rcvd            \* node -> sender -> the value RECEIVED from that sender, or "none"

vars == <<votes, decided, rcvd>>

TypeOK ==
    /\ votes \in [Nodes -> Values \cup {"none"}]
    /\ decided \in [Nodes -> Values \cup {"none"}]
    /\ rcvd \in [Nodes -> [Nodes -> Values \cup {"none"}]]

QuorumSize == (2 * MaxFaulty) + 1

Init ==
    /\ votes = [n \in Nodes |-> "none"]
    /\ decided = [n \in Nodes |-> "none"]
    /\ rcvd = [n \in Nodes |-> [s \in Nodes |-> "none"]]

(* An honest node votes once and never changes it. Write-once is what makes honesty mean
   something here; previously nothing distinguished an honest node from a faulty one.
   Casting is now LOCAL — it puts nothing in anyone else's view until delivery. *)
CastVote(n, v) ==
    /\ n \in Honest
    /\ votes[n] = "none"
    /\ v \in Values
    /\ votes' = [votes EXCEPT ![n] = v]
    /\ UNCHANGED <<decided, rcvd>>

(* Delivery of an honest node's vote to some node. Always enabled once cast and never
   forced: that unforced-ness IS the asynchrony. `r` may be `s` itself (self-delivery). *)
DeliverHonest(r, s) ==
    /\ s \in Honest
    /\ votes[s] # "none"
    /\ rcvd[r][s] = "none"
    /\ rcvd' = [rcvd EXCEPT ![r][s] = votes[s]]
    /\ UNCHANGED <<votes, decided>>

(* A Byzantine node's message, chosen per RECIPIENT — so it may tell otto one thing and
   vera another. This subsumes the old `ByzantineVote`: equivocation is not "changing your
   vote over time", it is telling two peers different things, and only a per-recipient view
   can express it. Byzantine nodes need no `votes` entry; they never commit to one. *)
DeliverByzantine(r, s, v) ==
    /\ s \in Byzantine
    /\ v \in Values
    /\ rcvd[r][s] = "none"
    /\ rcvd' = [rcvd EXCEPT ![r][s] = v]
    /\ UNCHANGED <<votes, decided>>

(* DISTINCT SENDERS, not messages. One equivocating node contributes at most one to any
   count, which is the whole reason quorum arithmetic survives a Byzantine minority. *)
SendersFor(n, v) == {s \in Nodes : rcvd[n][s] = v}

HasQuorumAt(n, v) == Cardinality(SendersFor(n, v)) >= QuorumSize

(* A node decides for itself, once, on the evidence IT HOLDS. Decisions are immutable:
   the `decided[n] = "none"` guard is what makes a commitment a commitment. *)
Decide(n, v) ==
    /\ decided[n] = "none"
    /\ HasQuorumAt(n, v)
    /\ decided' = [decided EXCEPT ![n] = v]
    /\ UNCHANGED <<votes, rcvd>>

Stutter == UNCHANGED vars

Next ==
    \/ \E n \in Nodes, v \in Values : CastVote(n, v)
    \/ \E r \in Nodes, s \in Nodes : DeliverHonest(r, s)
    \/ \E r \in Nodes, s \in Nodes, v \in Values : DeliverByzantine(r, s, v)
    \/ \E n \in Nodes, v \in Values : Decide(n, v)
    \/ Stutter

Spec == Init /\ [][Next]_vars

(* ══ SAFETY: the property the header always advertised, now actually expressible ══
   No two HONEST nodes commit different values. Byzantine nodes may "decide" anything —
   excluding them is not weakening the claim, it is what the claim has always meant.

   Why it holds, and why it is NOT pigeonhole: for a value to reach quorum 2F+1 in ANY
   node's view, at least F+1 of the senders it counted are honest, and honest votes are
   write-once — so an honest node contributes the same value to every view it reaches. A
   second value would need 2F+1 senders drawn from the at most N-(F+1) nodes not already
   permanently committed to the first — which, given N >= 3F+1, is fewer than 2F+1. The
   argument now has to survive per-node views and per-recipient equivocation, and it does,
   because the Byzantine set can contribute at most F to any single count. *)
Agreement ==
    \A n1, n2 \in Honest :
        (decided[n1] # "none" /\ decided[n2] # "none") => decided[n1] = decided[n2]

(* ══ WHAT THE NETWORK MODEL EXISTS TO MAKE SAYABLE ══
   A commitment is justified by the evidence THAT NODE holds — not by a global oracle.
   Unstatable before item 3: with a global `HasQuorum(v)` this is a tautology, since the
   guard and the invariant would read the same function.
   It is the mutation-resistant check the audit asked for: revert `Decide` to a global
   quorum and this invariant goes red, where `NoConflictingQuorum` stayed green through
   deleting the protocol entirely. *)
NoDecisionWithoutReceipt ==
    \A n \in Nodes : decided[n] # "none" => HasQuorumAt(n, decided[n])

(* DECISION FINALITY is enforced STRUCTURALLY by `Decide`'s `decided[n] = "none"` guard: no
   action can rewrite a commitment, so no reachable state has one changing.
   It is deliberately NOT restated as an invariant, because "never revised" is a claim about
   a TRANSITION, not about a state — a state predicate cannot express it, and a temporal
   property would be needed instead.
   Recorded because a first draft of this repair asserted it as
   `votes[decided[n]] = votes[decided[n]]`, which is both a tautology AND a type error
   (`decided[n]` is a Value, not a Node). Shipping that would have reintroduced the audited
   defect — an unfalsifiable assertion — in the very commit repairing it. *)

(* The original counting fact, now stated PER NODE because there is no longer a global vote
   function to count. KEPT — it is true and cheap — but demoted: it is a property of the
   state representation, not of the protocol, and it must never again be the only thing
   checked. *)
NoConflictingQuorum ==
    ~ \E n \in Nodes, v1, v2 \in Values :
        v1 # v2 /\ HasQuorumAt(n, v1) /\ HasQuorumAt(n, v2)

SafetyInvariant == TypeOK /\ Agreement /\ NoDecisionWithoutReceipt /\ NoConflictingQuorum

THEOREM Spec => []SafetyInvariant
====
