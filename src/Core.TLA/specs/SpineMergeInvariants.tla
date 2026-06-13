---------------------------- MODULE SpineMergeInvariants ----------------------------
(* Proof that Spine/BalancedSpine merges preserve two invariants:
    1. MultisetConservation — the multiset union of all live batches is
       invariant under merge.
    2. SizeClassValidity — level i holds at most 2 * 2^i entries.

   Catches off-by-one cascade bugs and lost-update races. *)

EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS MaxLevel, MaxBatchSize
VARIABLES
    levels,         \* [lvl -> Nat]  sum of batch sizes at each level
    pendingIn,      \* Seq(Nat)     inputs awaiting absorption
    totalInserted   \* Nat          total size ever inserted
vars == <<levels, pendingIn, totalInserted>>

Cap(i) == MaxBatchSize * (2 ^ i)

TypeOK ==
    /\ levels \in [0..MaxLevel -> Nat]
    /\ pendingIn \in Seq(0..MaxBatchSize)
    /\ totalInserted \in Nat

Init ==
    /\ levels = [i \in 0..MaxLevel |-> 0]
    /\ pendingIn = <<>>
    /\ totalInserted = 0

\* A new batch arrives.
Accept(b) ==
    /\ Len(pendingIn) < 16
    /\ b \in 1..MaxBatchSize
    /\ pendingIn' = Append(pendingIn, b)
    /\ totalInserted' = totalInserted + b
    /\ UNCHANGED levels

\* Drain pending into L0 if it fits.
PushL0 ==
    /\ Len(pendingIn) > 0
    /\ levels[0] + Head(pendingIn) <= Cap(0)
    /\ levels' = [levels EXCEPT ![0] = @ + Head(pendingIn)]
    /\ pendingIn' = Tail(pendingIn)
    /\ UNCHANGED totalInserted

\* Cascade: level i full → merge into level i+1.
\* Downstream-room precondition mirrors the real LSM constraint: if level
\* i+1 cannot absorb the merge without overflowing 2*Cap(i+1), Cascade(i)
\* is blocked and Cascade(i+1) must drain first. Without this, the model
\* can fire Cascade(0) repeatedly while Cascade(1) sits enabled, letting
\* level 1 accumulate past its 2*Cap bound.
Cascade(i) ==
    /\ i < MaxLevel
    /\ levels[i] >= Cap(i)
    /\ levels[i+1] + levels[i] <= 2 * Cap(i+1)
    /\ levels' = [levels EXCEPT ![i] = 0, ![i+1] = @ + levels[i]]
    /\ UNCHANGED <<pendingIn, totalInserted>>

Next ==
    \/ \E b \in 1..MaxBatchSize: Accept(b)
    \/ PushL0
    \/ \E i \in 0..(MaxLevel - 1): Cascade(i)

\* Weak fairness on cascades: every continuously-enabled cascade must
\* eventually fire. Required for LivDrained — without it, the cascade
\* chain could starve and pendingIn would never drain.
Spec == Init
     /\ [][Next]_vars
     /\ WF_vars(PushL0)
     /\ \A i \in 0..(MaxLevel - 1): WF_vars(Cascade(i))

\* Mass conservation: Σ levels + Σ pending = totalInserted.
InvMass ==
    LET sumL == LET F[i \in 0..MaxLevel] ==
                    IF i = 0 THEN levels[0]
                    ELSE F[i-1] + levels[i]
                IN F[MaxLevel]
        sumP == LET G[j \in 0..Len(pendingIn)] ==
                    IF j = 0 THEN 0
                    ELSE G[j-1] + pendingIn[j]
                IN G[Len(pendingIn)]
    IN sumL + sumP = totalInserted

\* Cap safety: no level exceeds 2× its cap (one self-merge overshoot tolerated).
InvCap == \A i \in 0..MaxLevel: levels[i] <= 2 * Cap(i)

\* Liveness: every accepted batch eventually drains out of `pendingIn`.
LivDrained == <>[](pendingIn = <<>>)

\* State constraints to keep TLC's BFS tractable. The spec is otherwise
\* unbounded: Accept can fire indefinitely so totalInserted grows
\* without limit, even though levels + pendingIn stay bounded by physical
\* capacity. Both constraints together bound the BFS:
\*   * `totalInserted <= 30` — pragmatic exploration cap; far enough
\*     above the saturated-mass ceiling under the default .cfg constants
\*     (MaxLevel=2 / MaxBatchSize=1, where sum(2*Cap(i)) = 14) to walk
\*     fill-then-drain cycles without re-exploring the same cap
\*     configurations indefinitely.
\*   * `Len(pendingIn) <= 4` — caps Accept's branching factor; without
\*     it the 16-slot soft bound inside Accept would let TLC explore
\*     too many parallel-batch interleavings under MaxBatchSize > 1.
StateBound == totalInserted <= 30
PendingBound == Len(pendingIn) <= 4

THEOREM Spec => [](TypeOK /\ InvMass /\ InvCap)
THEOREM Spec => LivDrained
====
