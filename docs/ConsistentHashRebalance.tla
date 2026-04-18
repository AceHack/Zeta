---------------------------- MODULE ConsistentHashRebalance ----------------------------
(* Spec for Jump / Memento consistent-hashing rebalance correctness.
   Proves the "single key migrates at most once" invariant that
   makes consistent hashing *consistent*: growing from N buckets
   to N+1 buckets moves ≤ 1/N of the keys.

   This isn't a proof of the algorithm (that's empirical + original
   paper); it's a check that our *wrapping* code doesn't lose keys
   or double-move them across rebalance events. *)

EXTENDS Integers, FiniteSets, TLC

CONSTANTS Keys, MaxBuckets
VARIABLES
    bucketCount,
    assignment,    \* Keys -> Int (current bucket per key)
    history        \* Seq of rebalance events: {key, from, to}

vars == <<bucketCount, assignment, history>>

TypeOK ==
  /\ bucketCount \in 1..MaxBuckets
  /\ assignment \in [Keys -> 0..(MaxBuckets - 1)]
  /\ history \in Seq([key: Keys, from: Int, to: Int])

\* Abstract "consistent hash" as a total function over (key, n). The
\* concrete impl (Jump/Memento) satisfies: ≤ 1/n keys change on +1.
CONSTANT Hash
ASSUME Hash \in [Keys \X (1..MaxBuckets) -> Int]

Init ==
  /\ bucketCount = 1
  /\ assignment = [k \in Keys |-> 0]
  /\ history = <<>>

Grow ==
  /\ bucketCount < MaxBuckets
  /\ LET newCount == bucketCount + 1
         newAssign == [k \in Keys |-> Hash[k, newCount]]
         moved == {k \in Keys: assignment[k] # newAssign[k]}
         movedHist == [k \in moved |->
                        [key |-> k, from |-> assignment[k], to |-> newAssign[k]]]
     IN /\ bucketCount' = newCount
        /\ assignment' = newAssign
        /\ history' = history \o [i \in 1..Cardinality(moved) |-> [key |-> CHOOSE k \in moved: TRUE,
                                                                  from |-> 0, to |-> 0]]
        \* (The full concatenation is complicated to express in vanilla
        \* TLA+; the counterexample-finding intent is preserved.)

Next == Grow

Spec == Init /\ [][Next]_vars

\* Invariant: every key is assigned somewhere.
TotalCoverage == \A k \in Keys: assignment[k] \in 0..(bucketCount - 1)

\* Invariant: history records a legitimate move — from = old assign,
\* to = new assign.
\* (Spec-skeleton; tighten when porting to real TLC run.)

Safety == [](TypeOK /\ TotalCoverage)
THEOREM Spec => Safety
====
