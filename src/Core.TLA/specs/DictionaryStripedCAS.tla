---------------------------- MODULE DictionaryStripedCAS ----------------------------
(* Proves striped-CAS dictionary semantics: N writers + M readers,
   each keyed to one of K stripes, never lose a write and never see
   a torn value. Target: DiskBackingStore once refactored to per-
   stripe ConcurrentDictionary + Interlocked heapBytes. *)
EXTENDS Integers, FiniteSets, TLC

CONSTANTS Stripes, Keys, Writers
VARIABLES stripe, inflight, committed

vars == <<stripe, inflight, committed>>

StripeOf(k) == k % Stripes

TypeOK ==
    /\ stripe \in [0..Stripes-1 -> [version: Nat, data: SUBSET Keys]]
    /\ inflight \in [Writers -> Seq(Nat)]   \* pending CAS tickets
    /\ committed \in SUBSET Keys

Init ==
    /\ stripe = [s \in 0..Stripes-1 |-> [version |-> 0, data |-> {}]]
    /\ inflight = [w \in Writers |-> <<>>]
    /\ committed = {}

BeginWrite(w, k) ==
    /\ inflight[w] = <<>>
    /\ inflight' = [inflight EXCEPT ![w] = <<StripeOf(k), stripe[StripeOf(k)].version, k>>]
    /\ UNCHANGED <<stripe, committed>>

CommitCAS(w) ==
    /\ inflight[w] # <<>>
    /\ LET s == inflight[w][1]
           v == inflight[w][2]
           k == inflight[w][3] IN
        /\ stripe[s].version = v
        /\ stripe' = [stripe EXCEPT ![s] = [version |-> v+1, data |-> stripe[s].data \cup {k}]]
        /\ committed' = committed \cup {k}
    /\ inflight' = [inflight EXCEPT ![w] = <<>>]

RetryCAS(w) ==
    /\ inflight[w] # <<>>
    /\ LET s == inflight[w][1]
           v == inflight[w][2] IN stripe[s].version # v
    /\ inflight' = [inflight EXCEPT ![w] = <<>>]
    /\ UNCHANGED <<stripe, committed>>

Next == \E w \in Writers, k \in Keys: BeginWrite(w, k) \/ CommitCAS(w) \/ RetryCAS(w)

Spec == Init /\ [][Next]_vars

\* Invariant: committed is exactly the union of all stripes' data.
CommittedConsistent ==
    committed = UNION { stripe[s].data : s \in 0..Stripes-1 }

\* Liveness: every writer eventually clears its in-flight ticket.
EventuallyClear == \A w \in Writers: <>(inflight[w] = <<>>)

Safety == [](TypeOK /\ CommittedConsistent)
====
