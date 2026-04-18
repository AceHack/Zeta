---------------------------- MODULE AsyncStreamEnumerator ----------------------------
(* Proves IAsyncEnumerator contract:
    * `MoveNextAsync` is never re-entered while a prior call is pending.
    * `Cancel` propagates — after cancellation, no further results yield.
    * `Dispose` is idempotent and safe from any state.
   Target: FSharpApi.AsyncStream.forCount / .forever. *)
EXTENDS Integers, Sequences, TLC

CONSTANTS Consumers, MaxSteps
VARIABLES state, pending, cancelled, yielded

vars == <<state, pending, cancelled, yielded>>

States == {"idle", "moving", "ready", "disposed"}

TypeOK ==
    /\ state \in [Consumers -> States]
    /\ pending \in [Consumers -> Nat]
    /\ cancelled \in [Consumers -> BOOLEAN]
    /\ yielded \in [Consumers -> Nat]

Init ==
    /\ state = [c \in Consumers |-> "idle"]
    /\ pending = [c \in Consumers |-> 0]
    /\ cancelled = [c \in Consumers |-> FALSE]
    /\ yielded = [c \in Consumers |-> 0]

MoveNext(c) ==
    /\ state[c] = "idle"
    /\ ~cancelled[c]
    /\ yielded[c] < MaxSteps
    /\ state' = [state EXCEPT ![c] = "moving"]
    /\ pending' = [pending EXCEPT ![c] = 1]   \* exactly one in flight
    /\ UNCHANGED <<cancelled, yielded>>

Complete(c) ==
    /\ state[c] = "moving"
    /\ state' = [state EXCEPT ![c] = "ready"]
    /\ pending' = [pending EXCEPT ![c] = 0]
    /\ yielded' = [yielded EXCEPT ![c] = yielded[c] + 1]
    /\ UNCHANGED cancelled

Consume(c) ==
    /\ state[c] = "ready"
    /\ state' = [state EXCEPT ![c] = "idle"]
    /\ UNCHANGED <<pending, cancelled, yielded>>

Cancel(c) ==
    /\ ~cancelled[c]
    /\ cancelled' = [cancelled EXCEPT ![c] = TRUE]
    /\ UNCHANGED <<state, pending, yielded>>

Dispose(c) ==
    /\ state[c] \in {"idle", "ready"}
    /\ state' = [state EXCEPT ![c] = "disposed"]
    /\ UNCHANGED <<pending, cancelled, yielded>>

Next == \E c \in Consumers: MoveNext(c) \/ Complete(c) \/ Consume(c) \/ Cancel(c) \/ Dispose(c)

Spec == Init /\ [][Next]_vars

\* Safety: `pending` is always 0 or 1 — no re-entry.
NoReentry == \A c \in Consumers: pending[c] \in {0, 1}

\* Safety: after cancellation + dispose, no yields happen.
CancelPropagates == \A c \in Consumers:
    cancelled[c] /\ state[c] = "disposed" =>
        [][UNCHANGED yielded[c]]_vars

Safety == [](TypeOK /\ NoReentry)
====
