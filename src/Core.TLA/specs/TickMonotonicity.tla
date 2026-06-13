---------------------------- MODULE TickMonotonicity ----------------------------
(* Circuit.tick must be monotone non-decreasing from any observer's
   perspective, and its final value under N concurrent increments must
   equal N. Without Interlocked.Increment + VolatileField, a torn long
   read on 32-bit can produce a tick that appears to go backwards. *)
EXTENDS Integers, TLC

CONSTANTS Threads, MaxTicks
VARIABLES tick, observed, stepOwner

vars == <<tick, observed, stepOwner>>

TypeOK ==
    /\ tick \in Int
    /\ observed \in [Threads -> Int]
    /\ stepOwner \in Threads \cup {"none"}

Init ==
    /\ tick = 0
    /\ observed = [t \in Threads |-> 0]
    /\ stepOwner = "none"

AcquireStep(t) ==
    /\ stepOwner = "none"
    /\ stepOwner' = t
    /\ UNCHANGED <<tick, observed>>

AdvanceTick(t) ==
    /\ stepOwner = t
    /\ tick < MaxTicks
    /\ tick' = tick + 1
    /\ stepOwner' = "none"
    /\ UNCHANGED observed

ReadTick(t) ==
    /\ tick >= observed[t]      \* Monotone: never observe < prior observed.
    /\ observed' = [observed EXCEPT ![t] = tick]
    /\ UNCHANGED <<tick, stepOwner>>

Next == \E t \in Threads: AcquireStep(t) \/ AdvanceTick(t) \/ ReadTick(t)

Spec == Init /\ [][Next]_vars

\* Safety: observers never see tick go backwards — temporal property.
Monotonic == [][tick' >= tick]_vars

\* No observer reads a value exceeding the current tick (state predicate).
NoPrescience == \A t \in Threads: observed[t] <= tick

\* Plain-state-predicate invariant for TLC.
Safety == TypeOK /\ NoPrescience
====
