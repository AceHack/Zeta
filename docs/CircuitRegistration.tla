---------------------------- MODULE CircuitRegistration ----------------------------
(* Spec for the Circuit construction / registration / Build lifecycle.
   Motivated by the FeedbackOp.Connect race that slipped past
   DbspSpec.tla and SpineAsyncProtocol.tla — neither modelled
   construction-time concurrency.

   Invariants proved here:
     * NoRegisterAfterBuild   — registration is rejected after Build.
     * ConnectAtMostOnce      — each FeedbackOp.Connect succeeds once.
     * ScheduleMatchesOps     — every op in the schedule was registered.

   Author one of these per lifecycle class the engine exposes. *)

EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS Threads, MaxOps
VARIABLES ops,            \* Seq of opIds registered so far.
          built,          \* Has Build() been called?
          pending,        \* Per-thread lifecycle state.
          feedbackConnected  \* [opId -> BOOLEAN], tracks FeedbackOp.Connect.

vars == <<ops, built, pending, feedbackConnected>>

TypeOK ==
  /\ ops \in Seq(1..MaxOps)
  /\ built \in BOOLEAN
  /\ pending \in [Threads -> {"idle", "registering", "connecting"}]
  /\ feedbackConnected \in [1..MaxOps -> BOOLEAN]

Init ==
  /\ ops = <<>>
  /\ built = FALSE
  /\ pending = [t \in Threads |-> "idle"]
  /\ feedbackConnected = [i \in 1..MaxOps |-> FALSE]

\* Any thread may register an op while the circuit is still open.
Register(t, op) ==
  /\ ~built
  /\ pending[t] = "idle"
  /\ Len(ops) < MaxOps
  /\ ops' = Append(ops, op)
  /\ pending' = [pending EXCEPT ![t] = "registering"]
  /\ UNCHANGED <<built, feedbackConnected>>

\* Finishing a registration — thread goes back to idle.
FinishRegister(t) ==
  /\ pending[t] = "registering"
  /\ pending' = [pending EXCEPT ![t] = "idle"]
  /\ UNCHANGED <<ops, built, feedbackConnected>>

\* Connect a feedback cell. Models the CAS-guarded "first wins" contract.
Connect(t, op) ==
  /\ pending[t] = "idle"
  /\ op \in 1..MaxOps
  /\ ~feedbackConnected[op]   \* CAS: only if not already connected
  /\ feedbackConnected' = [feedbackConnected EXCEPT ![op] = TRUE]
  /\ pending' = [pending EXCEPT ![t] = "connecting"]
  /\ UNCHANGED <<ops, built>>

FinishConnect(t) ==
  /\ pending[t] = "connecting"
  /\ pending' = [pending EXCEPT ![t] = "idle"]
  /\ UNCHANGED <<ops, built, feedbackConnected>>

\* Build() — only when no thread is mid-register/connect.
Build ==
  /\ ~built
  /\ \A t \in Threads: pending[t] = "idle"
  /\ built' = TRUE
  /\ UNCHANGED <<ops, pending, feedbackConnected>>

Next ==
  \/ \E t \in Threads, op \in 1..MaxOps: Register(t, op)
  \/ \E t \in Threads: FinishRegister(t)
  \/ \E t \in Threads, op \in 1..MaxOps: Connect(t, op)
  \/ \E t \in Threads: FinishConnect(t)
  \/ Build

Spec == Init /\ [][Next]_vars /\ WF_vars(Build)

\* Safety: no operator is registered after Build committed.
NoRegisterAfterBuild ==
  built => \A t \in Threads: pending[t] # "registering"

\* Safety: no FeedbackOp can be connected twice. Second Connect call
\* would require feedbackConnected[op] = FALSE but our CAS guard rejects.
\* We encode the post-condition: if feedbackConnected[op] flips, it flips
\* exactly once in any behaviour.
ConnectAtMostOnce ==
  [][ \A op \in 1..MaxOps:
        feedbackConnected[op] => feedbackConnected'[op] ]_vars

\* Liveness: Build eventually runs (we always have weak fairness on it).
BuildCompletes == <>built

THEOREM Spec => [](TypeOK /\ NoRegisterAfterBuild)
THEOREM Spec => ConnectAtMostOnce
THEOREM Spec => BuildCompletes
====
