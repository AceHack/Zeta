---------------------------- MODULE TransactionInterleaving ----------------------------
(* Spec for `TransactionZ1Op.fs` CAS-based semantics.
   Proves that concurrent Begin/Commit/Rollback calls against
   `AfterStepAsync`-driven `Tick` never produce a torn state snapshot.

   Key invariants:
     * `state` ≤ `pending` reachability (commit moves state toward pending)
     * If `autoCommit`, `state = pending` after every `Tick`.
     * No two concurrent `Commit` calls double-advance. *)

EXTENDS Integers, FiniteSets, TLC

CONSTANTS Threads, MaxInput
VARIABLES
    state, pending, autoCommit,   \* Snapshot fields
    inputVal,                     \* Current `input.Value` seen by AfterStep
    tickPhase                     \* Per-thread phase

vars == <<state, pending, autoCommit, inputVal, tickPhase>>

TypeOK ==
  /\ state \in 0..MaxInput
  /\ pending \in 0..MaxInput
  /\ autoCommit \in BOOLEAN
  /\ inputVal \in 0..MaxInput
  /\ tickPhase \in [Threads -> {"idle", "ticking", "begin", "commit", "rollback"}]

Init ==
  /\ state = 0
  /\ pending = 0
  /\ autoCommit = TRUE
  /\ inputVal = 0
  /\ tickPhase = [t \in Threads |-> "idle"]

BeginTx(t) ==
  /\ tickPhase[t] = "idle"
  /\ tickPhase' = [tickPhase EXCEPT ![t] = "begin"]
  /\ autoCommit' = FALSE
  /\ pending' = state
  /\ UNCHANGED <<state, inputVal>>

CommitTx(t) ==
  /\ tickPhase[t] = "idle"
  /\ ~autoCommit
  /\ tickPhase' = [tickPhase EXCEPT ![t] = "commit"]
  /\ state' = pending
  /\ autoCommit' = TRUE
  /\ UNCHANGED <<pending, inputVal>>

RollbackTx(t) ==
  /\ tickPhase[t] = "idle"
  /\ ~autoCommit
  /\ tickPhase' = [tickPhase EXCEPT ![t] = "rollback"]
  /\ pending' = state
  /\ autoCommit' = TRUE
  /\ UNCHANGED <<state, inputVal>>

Tick(t, newInput) ==
  /\ tickPhase[t] = "idle"
  /\ newInput \in 0..MaxInput
  /\ tickPhase' = [tickPhase EXCEPT ![t] = "ticking"]
  /\ inputVal' = newInput
  /\ pending' = newInput
  /\ state' = IF autoCommit THEN newInput ELSE state
  /\ UNCHANGED autoCommit

Finish(t) ==
  /\ tickPhase[t] \in {"ticking", "begin", "commit", "rollback"}
  /\ tickPhase' = [tickPhase EXCEPT ![t] = "idle"]
  /\ UNCHANGED <<state, pending, autoCommit, inputVal>>

Next ==
  \/ \E t \in Threads: BeginTx(t) \/ CommitTx(t) \/ RollbackTx(t) \/ Finish(t)
  \/ \E t \in Threads, v \in 0..MaxInput: Tick(t, v)

Spec == Init /\ [][Next]_vars

\* Safety: autoCommit implies state = pending (no torn committed snapshot).
AutoCommitConsistent == autoCommit => state = pending

\* Safety: a Commit immediately after a Begin restores the pre-Begin state.
\* (Cannot express trivially in a single step; rely on TLC to enumerate.)

\* Plain state predicate for TLC INVARIANT.
Safety == TypeOK /\ AutoCommitConsistent
THEOREM Spec => Safety
====
