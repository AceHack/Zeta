---------------------------- MODULE OperatorLifecycleRace ----------------------------
(* Proves Circuit's Register/Build interleaving keeps `anyAsync`
   sound. The V2 formulation drops the broken `ScanAsync` action
   (which read without committing) and tightens `FlagSound` to
   its post-condition: `anyAsync` equals the disjunction of async
   flags across every registered op. *)
EXTENDS Integers, Sequences, TLC

CONSTANTS Threads, MaxOps
VARIABLES ops, built, anyAsync, pc

vars == <<ops, built, anyAsync, pc>>

TypeOK ==
    /\ ops \in Seq([id: Nat, async: BOOLEAN])
    /\ built \in BOOLEAN
    /\ anyAsync \in BOOLEAN
    /\ pc \in [Threads -> {"idle", "done"}]

Init ==
    /\ ops = <<>>
    /\ built = FALSE
    /\ anyAsync = FALSE
    /\ pc = [t \in Threads |-> "idle"]

(* Register is the ONLY mutator of ops + anyAsync. It sets both
   together under the (conceptual) registerLock so the invariant
   `anyAsync = OR(op.async)` holds at every step. *)
Register(t, isAsync) ==
    /\ pc[t] = "idle"
    /\ ~built
    /\ Len(ops) < MaxOps
    /\ ops' = Append(ops, [id |-> Len(ops), async |-> isAsync])
    /\ anyAsync' = (anyAsync \/ isAsync)
    /\ pc' = [pc EXCEPT ![t] = "done"]
    /\ UNCHANGED built

Build(t) ==
    /\ pc[t] = "idle"
    /\ ~built
    /\ built' = TRUE
    /\ pc' = [pc EXCEPT ![t] = "done"]
    /\ UNCHANGED <<ops, anyAsync>>

Next == \E t \in Threads: Register(t, TRUE) \/ Register(t, FALSE) \/ Build(t)

Spec == Init /\ [][Next]_vars

(* Core invariant — cached flag matches scan over ops. *)
FlagSound ==
    anyAsync = (\E i \in 1..Len(ops): ops[i].async)

Safety == TypeOK /\ FlagSound
====
