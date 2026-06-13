--------------------------- MODULE RecoveryHomeostat ---------------------------
(* Durability recovery invariant + the register-non-collapse (NoCommittedLoss)
   property, routed to TLA+/TLC by Soraya (workitem 081KTF9T0ER). The abstract twin
   of the executable DST crash harness (tests/Tests.FSharp/Storage/DurabilitySim.Tests.fs)
   and the FsCheck cross-check (DurabilityProperty.Tests.fs) — TLC enumerates EVERY
   interleaving of {Commit, Snapshot, GC, Crash, Recover}, including the corners the
   harness only samples (e.g. Crash between Snapshot and GC).

   Model: committed input deltas are identified by their sequence number. `live` is the
   set of seqs currently materialised (the fold). A Snapshot durably stores the
   consolidated fold up to committedSeq; GC truncates the log ONLY through a covered
   snapshot; Crash drops volatile `live`; Recover = snapshot-prefix ∪ surviving log tail.

   Two safety properties:
   - NoCommittedLoss — the committed register never COLLAPSES: the ordering
     truncated ≤ snapshot ≤ committed is preserved, so GC never strands a committed
     delta. This is the "register always expands / never collapses" property at the
     durability layer (committedSeq is monotone by construction — no action decrements
     it; NoCommittedLoss is what keeps the *content* from being lost to GC).
   - RecoveryCorrect — whenever not mid-crash, the materialised state is EXACTLY the
     full committed prefix `1..committedSeq` (recover∘crash = fold(committed)).

   The load-bearing mechanism is the GC guard `truncatedThroughSeq' = snapshotSeq`
   (truncate only through a durable snapshot). A GC that truncated past the snapshot
   (to committedSeq) would strand {snapshotSeq+1..truncated} and TLC would surface the
   RecoveryCorrect violation — the design-guarantee form (cf. NciSafety's guarded Coerce). *)

EXTENDS Naturals

CONSTANT MaxSeq

VARIABLES
    committedSeq,         \* highest durably-appended delta seq (monotone, never decremented)
    snapshotSeq,          \* seq the latest durable snapshot covers
    truncatedThroughSeq,  \* log GC'd through here
    live,                 \* SUBSET (1..MaxSeq): seqs currently materialised (the fold)
    crashed

vars == <<committedSeq, snapshotSeq, truncatedThroughSeq, live, crashed>>

SeqRange == 1..MaxSeq

TypeOK ==
    /\ committedSeq \in 0..MaxSeq
    /\ snapshotSeq \in 0..MaxSeq
    /\ truncatedThroughSeq \in 0..MaxSeq
    /\ live \subseteq SeqRange
    /\ crashed \in BOOLEAN

Init ==
    /\ committedSeq = 0
    /\ snapshotSeq = 0
    /\ truncatedThroughSeq = 0
    /\ live = {}
    /\ crashed = FALSE

\* Append + fold a new committed delta (only while up).
Commit ==
    /\ ~crashed
    /\ committedSeq < MaxSeq
    /\ committedSeq' = committedSeq + 1
    /\ live' = live \cup {committedSeq'}
    /\ UNCHANGED <<snapshotSeq, truncatedThroughSeq, crashed>>

\* Persist the consolidated fold at the current committed seq.
Snapshot ==
    /\ ~crashed
    /\ snapshotSeq' = committedSeq
    /\ UNCHANGED <<committedSeq, truncatedThroughSeq, live, crashed>>

\* GC the log — ONLY through a durable snapshot (the load-bearing guard); only while up.
GC ==
    /\ ~crashed
    /\ snapshotSeq > truncatedThroughSeq
    /\ truncatedThroughSeq' = snapshotSeq
    /\ UNCHANGED <<committedSeq, snapshotSeq, live, crashed>>

\* Crash: volatile `live` is lost; durable seqs survive.
Crash ==
    /\ ~crashed
    /\ crashed' = TRUE
    /\ live' = {}
    /\ UNCHANGED <<committedSeq, snapshotSeq, truncatedThroughSeq>>

\* Recover: restore snapshot prefix ∪ surviving log tail.
Recover ==
    /\ crashed
    /\ crashed' = FALSE
    /\ live' = (1..snapshotSeq) \cup ((truncatedThroughSeq + 1)..committedSeq)
    /\ UNCHANGED <<committedSeq, snapshotSeq, truncatedThroughSeq>>

Next ==
    \/ Commit
    \/ Snapshot
    \/ GC
    \/ Crash
    \/ Recover

\* Weak fairness on Recover: a crashed system does not stay down — the homeostat
\* always pulls it back to the live/committed-truth state. (While crashed, ONLY Recover
\* is enabled — Commit/Snapshot/GC/Crash all require ~crashed — so WF(Recover) suffices.)
Spec == Init /\ [][Next]_vars /\ WF_vars(Recover)

\* ── Safety: the committed register never collapses. ──
NoCommittedLoss ==
    /\ truncatedThroughSeq <= snapshotSeq
    /\ snapshotSeq <= committedSeq

\* ── Safety: recover∘crash = fold(committed). ──
RecoveryCorrect == (~crashed) => (live = 1..committedSeq)

\* ── Liveness (the homeostat): a crash is always eventually followed by recovery —
\*    the system never stays down; it returns to the live/committed-truth state. This is
\*    the recovery-side of the forward-momentum root (never permanently idle/dead). ──
Liveness == crashed ~> ~crashed

===============================================================================
