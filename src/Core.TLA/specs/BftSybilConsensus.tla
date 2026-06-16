--------------------------- MODULE BftSybilConsensus ---------------------------
(* BFT-threshold soundness UNDER SYBIL — round (b) of the Aurora immune
   re-grounding (Soraya-routed, Kenji-sized; Viktor-reviewed 2026-06-16).

   The Sybil threat Aurora's BFT thresholds must survive: a Sybil ring spins up
   MANY nodes under FEW proven identities. The property proven here: quorum counted
   over PROVEN-DISTINCT IDENTITIES cannot be manufactured by a Sybil ring, EVEN WHEN
   that ring is a RAW-NODE MAJORITY.

   Viktor's P0 on v1 (fixed here): v1's model was too small for the fold to be
   pivotal — sybils couldn't even raw-quorum, so distinct-counting never refused
   anything. v2 sizes the ring as a RAW-NODE MAJORITY (3 of 5) but ONE identity: it
   reaches RAW quorum yet is REFUSED by distinct-quorum. `RawQuorum` is now
   load-bearing (witness `NoSybilRawMajorityRefusal`), not decoration.

   Dependency boundary (scoping §7): identity-distinctness is a GIVEN equivalence
   relation `SameId` (SybilRing nodes share one identity), justified by the
   DISCHARGED NonRegisterCollapse / IdentityForcesPrivacy (src/Core.Lean4/...), NOT
   re-proven. Real-world soundness also needs the §B anti-Sybil-entropy leg; this
   round proves only: GIVEN a sound distinctness oracle, a Sybil ring — even a
   raw-node majority — cannot manufacture quorum.

   DRAFT v2 — addresses Viktor's P0/P1. *)

EXTENDS Naturals, FiniteSets

CONSTANTS
    Nodes,      \* {h1, h2, s1, s2, s3} : 2 honest + a 3-node Sybil ring
    Values,     \* {"merge", "reject"}
    SybilRing,  \* SUBSET Nodes : colluding ring; its nodes share ONE proven identity
    Honest      \* SUBSET Nodes : the honest nodes

\* Identity-distinctness as a GIVEN equivalence relation (constant; justified by the
\* discharged distinctness, not re-proven). SybilRing folds to one class.
SameId == { mn \in Nodes \X Nodes :
              (mn[1] = mn[2]) \/ (mn[1] \in SybilRing /\ mn[2] \in SybilRing) }

VARIABLES votes, decided, phase
vars == <<votes, decided, phase>>

TypeOK ==
    /\ votes \in [Nodes -> Values \cup {"none"}]
    /\ decided \in Values \cup {"none"}
    /\ phase \in {"voting", "decided"}

ClassOf(n) == { m \in Nodes : <<n, m>> \in SameId }
DistinctIds == { ClassOf(n) : n \in Nodes }
VotersOf(v) == { n \in Nodes : votes[n] = v }

\* An identity (class) SUPPORTS v iff it votes v WITHOUT EQUIVOCATION: at least one
\* of its nodes voted v, and NONE of its nodes voted a different value. An
\* equivocating identity (a Sybil ring splitting its nodes across values to count
\* twice) supports NOTHING — self-exclusion, the BFT treatment of double-voting.
\* (TLC surfaced the v2a bug: without this, one ring votes both sides → conflicting
\* quorums. This is the stronger anti-Sybil result: equivocation forfeits the vote.)
SupportsValue(c, v) ==
    /\ \E n \in c : votes[n] = v
    /\ \A n \in c : votes[n] \in {v, "none"}

\* Distinct-identity support: distinct identities that consistently support v.
DistinctSupport(v) == Cardinality({ c \in DistinctIds : SupportsValue(c, v) })
HonestDistinctSupport(v) ==
    Cardinality({ c \in DistinctIds : SupportsValue(c, v) /\ (\E n \in c : n \in Honest) })
RawSupport(v) == Cardinality(VotersOf(v))

\* FIXED quorum: strict majority of DISTINCT IDENTITIES.
DistinctQuorum(v) == DistinctSupport(v) * 2 > Cardinality(DistinctIds)
\* Naive Sybil-VULNERABLE quorum: strict majority of NODES (what the fold defeats).
RawQuorum(v) == RawSupport(v) * 2 > Cardinality(Nodes)

Init ==
    /\ votes = [n \in Nodes |-> "none"]
    /\ decided = "none"
    /\ phase = "voting"

CastVote(n, v) ==
    /\ phase = "voting"
    /\ votes[n] = "none"
    /\ v \in Values
    /\ votes' = [votes EXCEPT ![n] = v]
    /\ UNCHANGED <<decided, phase>>

\* Byzantine / Sybil node votes anything (the ring votes together to inflate RAW).
ByzantineVote(n, v) ==
    /\ phase = "voting"
    /\ v \in Values
    /\ votes' = [votes EXCEPT ![n] = v]
    /\ UNCHANGED <<decided, phase>>

\* Decide on the FIXED (distinct-identity) quorum.
Decide(v) ==
    /\ phase = "voting"
    /\ DistinctQuorum(v)
    /\ decided' = v
    /\ phase' = "decided"
    /\ UNCHANGED votes

Stutter == UNCHANGED vars

Next ==
    \/ \E n \in Nodes, v \in Values : CastVote(n, v)
    \/ \E n \in Nodes, v \in Values : ByzantineVote(n, v)
    \/ \E v \in Values : Decide(v)
    \/ Stutter

Spec == Init /\ [][Next]_vars

\* ── SYBIL CANNOT FORGE (anti-Sybil core): no value reaches distinct-quorum on
\*    Sybil/dishonest identities alone — every distinct-quorum carries an honest
\*    identity. The ring folds to ONE class, so it cannot reach the identity-majority
\*    however many NODES it runs. ──
SybilCannotForge ==
    \A v \in Values : DistinctQuorum(v) => HonestDistinctSupport(v) >= 1

\* ── BFT agreement under identity-counting: no two values both reach distinct-quorum. ──
NoConflictingDistinctQuorum ==
    ~ \E v1, v2 \in Values :
        v1 # v2 /\ DistinctQuorum(v1) /\ DistinctQuorum(v2)

\* ── The protocol only ever COMMITS a distinct-quorum value (never a raw-only one). ──
DecidedHasDistinctQuorum ==
    decided # "none" => DistinctQuorum(decided)

SafetyInvariant ==
    /\ TypeOK
    /\ SybilCannotForge
    /\ NoConflictingDistinctQuorum
    /\ DecidedHasDistinctQuorum

THEOREM Spec => []SafetyInvariant

\* ── LOAD-BEARING WITNESS (Viktor's P0): the fold actually BLOCKS something raw-
\*    counting would pass. NOT an invariant — a reachability claim verified by probe:
\*    run with INVARIANT NoSybilRawMajorityRefusal and EXPECT a VIOLATION (a reachable
\*    state where some value has RAW majority but NO distinct-quorum). If it holds,
\*    the fold is decoration and the spec is false-green. ──
NoSybilRawMajorityRefusal ==
    ~ \E v \in Values : RawQuorum(v) /\ ~DistinctQuorum(v)
=============================================================================
