---------------------------- MODULE ChaosEnvDeterminism ----------------------------
(* Spec for `ChaosEnvironment.fs`. Verifies that even under concurrent
   access, the seed determines the entire (RNG, clock) trace — the
   foundational contract of the deterministic-simulation story.

   Key: splitMix + AdvanceTime must be atomic under the same lock.
   Without that, concurrent Delay calls interleave splitMix and
   AdvanceTime differently across runs, breaking replay. *)

EXTENDS Integers, Sequences, TLC

CONSTANTS Threads, Seed
VARIABLES
    rngState, clockState, lockHolder, action, history

vars == <<rngState, clockState, lockHolder, action, history>>

TypeOK ==
  /\ rngState \in Int
  /\ clockState \in Int
  /\ lockHolder \in Threads \cup {"none"}
  /\ action \in [Threads -> {"idle", "delay-rng", "delay-clock", "done"}]
  /\ history \in Seq([thread: Threads, op: {"rng", "clock"}, value: Int])

Init ==
  /\ rngState = Seed
  /\ clockState = 0
  /\ lockHolder = "none"
  /\ action = [t \in Threads |-> "idle"]
  /\ history = <<>>

AcquireLock(t) ==
  /\ lockHolder = "none"
  /\ action[t] = "idle"
  /\ lockHolder' = t
  /\ action' = [action EXCEPT ![t] = "delay-rng"]
  /\ UNCHANGED <<rngState, clockState, history>>

\* The critical path: splitMix + AdvanceTime while the lock is held.
DelayRng(t) ==
  /\ lockHolder = t
  /\ action[t] = "delay-rng"
  /\ rngState' = rngState + 1   \* model splitMix as monotone advance
  /\ action' = [action EXCEPT ![t] = "delay-clock"]
  /\ history' = Append(history, [thread |-> t, op |-> "rng", value |-> rngState + 1])
  /\ UNCHANGED <<clockState, lockHolder>>

DelayClock(t) ==
  /\ lockHolder = t
  /\ action[t] = "delay-clock"
  /\ clockState' = clockState + 1
  /\ action' = [action EXCEPT ![t] = "done"]
  /\ history' = Append(history, [thread |-> t, op |-> "clock", value |-> clockState + 1])
  /\ UNCHANGED <<rngState, lockHolder>>

ReleaseLock(t) ==
  /\ lockHolder = t
  /\ action[t] = "done"
  /\ lockHolder' = "none"
  /\ action' = [action EXCEPT ![t] = "idle"]
  /\ UNCHANGED <<rngState, clockState, history>>

Next ==
  \/ \E t \in Threads: AcquireLock(t) \/ DelayRng(t) \/ DelayClock(t) \/ ReleaseLock(t)

Spec == Init /\ [][Next]_vars

\* Invariant: no two threads can interleave rng/clock — each "rng"
\* entry is immediately followed by a "clock" entry from the same
\* thread. This is the seeded-determinism guarantee.
Atomic == \A i \in 1..Len(history):
  history[i].op = "rng" =>
    (i < Len(history) /\ history[i+1].op = "clock" /\ history[i+1].thread = history[i].thread)

Safety == [](TypeOK /\ Atomic)
THEOREM Spec => Safety
====
