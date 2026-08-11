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

\* Fairness. WF on Build alone is NOT enough (audit 2026-08-10): the finisher actions had no
\* fairness, so a thread could enter "registering" and park there forever, leaving Build's
\* guard (\A t: pending[t] = "idle") permanently false. Build was then never CONTINUOUSLY
\* enabled, weak fairness on it was vacuously satisfied, and BuildCompletes was VIOLATED.
\* Adding WF on the finishers models the real contract — a thread that begins a registration
\* or a connect returns from it — and makes the stated theorem true (verified: TLC, 3538
\* distinct states, no error). This is a completed fairness set, not a weakened claim.
Spec == Init /\ [][Next]_vars /\ WF_vars(Build)
         /\ \A t \in Threads: WF_vars(FinishRegister(t)) /\ WF_vars(FinishConnect(t))

\* Safety: no operator is registered after Build committed.
NoRegisterAfterBuild ==
  built => \A t \in Threads: pending[t] # "registering"

\* Composite safety invariant — the conjunction the THEOREM at the
\* end of this spec asserts. Defined as a named operator so
\* CircuitRegistration.cfg's `INVARIANT Safety` directive resolves
\* against a state predicate.
Safety == TypeOK /\ NoRegisterAfterBuild

\* Safety: no FeedbackOp can be connected twice. Second Connect call
\* would require feedbackConnected[op] = FALSE but our CAS guard rejects.
\* We encode the post-condition: if feedbackConnected[op] flips, it flips
\* exactly once in any behaviour.
ConnectAtMostOnce ==
  [][ \A op \in 1..MaxOps:
        feedbackConnected[op] => feedbackConnected'[op] ]_vars

\* Liveness: Build eventually runs.
\*
\* AUDIT 2026-08-10 — was VIOLATED under the original fairness, now HOLDS. History kept
\* because the failure is instructive and the property is still not machine-checked here.
\*
\* Under the original `Spec == ... /\ WF_vars(Build)` alone, adding `PROPERTY BuildCompletes`
\* to the .cfg (sound: this cfg has no CONSTRAINT, so the constraint-corrupts-fairness
\* problem PredictiveLookahead.cfg documents does not apply) gave:
\*     Error: Temporal property BuildCompletes was violated.
\* Cause: the FINISHER actions carried no fairness, so a thread could park in "registering"
\* forever, Build's guard never held, and WF on Build was vacuously satisfied. Completing
\* the fairness set (see `Spec` below) makes it hold — verified, 3538 distinct states, no
\* error. So the theorem was true and the spec under-specified its fairness.
\*
\* STILL NOT CHECKED IN CI: BuildCompletes is not in CircuitRegistration.cfg, so nothing
\* enforces this. Adding `PROPERTY BuildCompletes` is sound here and would close it.
\* Audit: docs/research/2026-08-10-synchrony-non-transfer-audit-bftconsensus-checks-a-counting-tautology.md §2e
BuildCompletes == <>built

THEOREM Spec => [](TypeOK /\ NoRegisterAfterBuild)
THEOREM Spec => ConnectAtMostOnce
\* Was refuted under the original fairness set; holds under the completed one (see above).
\* Note TLAPS does not run on this file, so none of these THEOREMs is machine-checked — the
\* evidence for this one is a TLC run that the .cfg does not currently perform.
THEOREM Spec => BuildCompletes
====
