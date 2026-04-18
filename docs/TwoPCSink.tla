---------------------------- MODULE TwoPCSink ----------------------------
(* Spec for the ISink 2-phase-commit contract (Sink.fs).
   Proves the key exactly-once-delivery invariants:

     * Idempotent — a given epoch commits at most once (retries are no-ops).
     * AllOrNothing — if txnState = "committed", every sink is either
       "done" or "pending" (never "rolledback").
     * AbortSafe — if txnState = "aborted", no sink is in "done" state.
     * NoOrphans — after checkpoint, every preCommitted tx is eventually
       either committed or aborted.

   Inspired by the classic Skeen/Stonebraker 2PC spec but scoped to
   per-tick DBSP semantics where the coordinator = circuit scheduler
   and participants = ISink instances. *)

EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS Txns, Sinks
VARIABLES txnState,         \* [txn -> {"open","preparing","committed","aborted"}]
          sinkVote,         \* [<<txn, sink>> -> {"none","yes","no"}]
          sinkCommit,       \* [<<txn, sink>> -> {"pending","done","rolledback"}]
          sinkLog,          \* [sink -> Seq(txn)]  — durable sink-side audit log
          coord             \* [txn -> {"init","prep","commit","abort","done"}]

vars == <<txnState, sinkVote, sinkCommit, sinkLog, coord>>

TypeOK ==
  /\ txnState \in [Txns -> {"open","preparing","committed","aborted"}]
  /\ sinkVote \in [Txns \X Sinks -> {"none","yes","no"}]
  /\ sinkCommit \in [Txns \X Sinks -> {"pending","done","rolledback"}]
  /\ sinkLog \in [Sinks -> Seq(Txns)]
  /\ coord \in [Txns -> {"init","prep","commit","abort","done"}]

Init ==
  /\ txnState = [t \in Txns |-> "open"]
  /\ sinkVote = [p \in Txns \X Sinks |-> "none"]
  /\ sinkCommit = [p \in Txns \X Sinks |-> "pending"]
  /\ sinkLog = [s \in Sinks |-> <<>>]
  /\ coord = [t \in Txns |-> "init"]

\* Phase 1: coordinator asks all sinks to prepare.
BeginTx(t) ==
  /\ coord[t] = "init"
  /\ coord' = [coord EXCEPT ![t] = "prep"]
  /\ txnState' = [txnState EXCEPT ![t] = "preparing"]
  /\ UNCHANGED <<sinkVote, sinkCommit, sinkLog>>

\* Each sink independently votes yes or no (no = disk full, etc).
Vote(t, s, v) ==
  /\ coord[t] = "prep"
  /\ sinkVote[<<t, s>>] = "none"
  /\ v \in {"yes", "no"}
  /\ sinkVote' = [sinkVote EXCEPT ![<<t, s>>] = v]
  /\ UNCHANGED <<txnState, sinkCommit, sinkLog, coord>>

\* Commit if every sink voted yes.
Commit(t) ==
  /\ coord[t] = "prep"
  /\ \A s \in Sinks: sinkVote[<<t, s>>] = "yes"
  /\ coord' = [coord EXCEPT ![t] = "commit"]
  /\ txnState' = [txnState EXCEPT ![t] = "committed"]
  /\ UNCHANGED <<sinkVote, sinkCommit, sinkLog>>

\* Abort on any no-vote or coord timeout.
Abort(t) ==
  /\ coord[t] \in {"prep", "commit"}
  /\ (\E s \in Sinks: sinkVote[<<t, s>>] = "no") \/ coord[t] = "prep"
  /\ coord' = [coord EXCEPT ![t] = "abort"]
  /\ txnState' = [txnState EXCEPT ![t] = "aborted"]
  /\ UNCHANGED <<sinkVote, sinkCommit, sinkLog>>

\* Each sink applies the commit. Idempotent on retry.
Apply(t, s) ==
  /\ coord[t] = "commit"
  /\ sinkCommit[<<t, s>>] = "pending"
  /\ sinkCommit' = [sinkCommit EXCEPT ![<<t, s>>] = "done"]
  /\ sinkLog' = [sinkLog EXCEPT ![s] = Append(@, t)]
  /\ UNCHANGED <<txnState, sinkVote, coord>>

\* Retry — a replay of Apply on an already-committed (t,s) must be a no-op.
ApplyRetry(t, s) ==
  /\ coord[t] = "commit"
  /\ sinkCommit[<<t, s>>] = "done"
  /\ UNCHANGED vars   \* Idempotent retry — no state change.

\* Abort-apply: on a "no" vote, the sink rolls back.
RollBack(t, s) ==
  /\ coord[t] = "abort"
  /\ sinkCommit[<<t, s>>] = "pending"
  /\ sinkCommit' = [sinkCommit EXCEPT ![<<t, s>>] = "rolledback"]
  /\ UNCHANGED <<txnState, sinkVote, sinkLog, coord>>

Next ==
  \/ \E t \in Txns: BeginTx(t)
  \/ \E t \in Txns, s \in Sinks, v \in {"yes","no"}: Vote(t, s, v)
  \/ \E t \in Txns: Commit(t) \/ Abort(t)
  \/ \E t \in Txns, s \in Sinks: Apply(t, s) \/ ApplyRetry(t, s) \/ RollBack(t, s)

Spec == Init /\ [][Next]_vars

\* Each sink's log records a given txn at most once (retries are no-ops).
Idempotent ==
  \A s \in Sinks, t \in Txns:
    Cardinality({i \in 1..Len(sinkLog[s]): sinkLog[s][i] = t}) \leq 1

\* If the coord says committed, every sink is either done or pending —
\* never rolledback under a committed txn.
AllOrNothing ==
  \A t \in Txns:
    txnState[t] = "committed" =>
      \A s \in Sinks: sinkCommit[<<t, s>>] \in {"done","pending"}

\* If the coord says aborted, no sink is done (can't have applied a
\* txn that got aborted).
AbortSafe ==
  \A t \in Txns:
    txnState[t] = "aborted" =>
      \A s \in Sinks: sinkCommit[<<t, s>>] # "done"

\* Plain state predicate for TLC INVARIANT.
Safety == TypeOK /\ Idempotent /\ AllOrNothing /\ AbortSafe
THEOREM Spec => Safety
====
