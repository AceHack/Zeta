---------------------------- MODULE InfoTheoreticSharder ----------------------------
(* Spec for `src/Dbsp.Core/NovelMathExt.fs` `InfoTheoreticSharder`.

   The F# impl has two observable pieces of state:

     * `shardLoads`: a per-shard int64 array accumulating each
       committed pick's predicted weight.
     * `cms`: a Count-Min sketch trained by `Observe`. The sketch
       itself is an implementation detail here — what the spec
       cares about is that `Observe` NEVER touches `shardLoads`.

   Two public methods:

     * `Observe(k)` — updates `cms` only. Must be side-effect-free
       on `shardLoads`.
     * `Pick(k)` — reads every slot of `shardLoads` via `Volatile.Read`,
       picks the argmin of `load + predicted(k)`, commits exactly one
       `Interlocked.Add` to the chosen slot. Tie-break on equal load
       prefers the hash-indexed slot `hashTieBreak(k)` — so cold-start
       (all zeros) distributes by hash rather than always landing on
       shard 0.

   Invariants TLC checks:

     * `ObserveNoLoadChange` — after any sequence of `Observe` calls
       with no intervening `Pick`, `shardLoads` is identical to the
       initial zero vector.
     * `PickCommitsOnce` — every completed `Pick` action increases
       exactly one slot of `shardLoads` by exactly `predicted(k)`,
       never two slots, never the same slot twice.
     * `ColdStartHashTieBreak` — the first `Pick(k)` from an all-zero
       `shardLoads` returns `hashTieBreak(k)` (not shard 0 unless
       `hashTieBreak(k) = 0`).
     * `NoTornReads` — under interleaved `Pick` actions by multiple
       threads, each thread's argmin scan reads a coherent (not torn)
       value for every shard slot it inspects.

   Model size: 3 shards, 2 threads, 4 keys, unit predicted weight.
   Bounded explicitly via `MaxPicks` + `MaxObserves` so TLC's
   reachable state-space stays finite. *)

EXTENDS Integers, FiniteSets, Sequences, TLC

CONSTANTS Threads, Keys, Shards, Predicted, MaxPicks, MaxObserves

ASSUME Predicted >= 1
ASSUME Shards >= 1
ASSUME MaxPicks >= 0
ASSUME MaxObserves >= 0

(* `HashTieBreak(k)` replays the F# impl's hash-to-shard mapping —
   `(hash32 * shardCount) >>> 32`. In the spec we model the hash via
   a fixed key-indexed table that's materialised once at spec
   evaluation time. TLC caches definitions, so the table is computed
   exactly once: per key `k`, CHOOSE picks some shard in `0..Shards-1`
   satisfying the per-key constraint `i = idx % Shards` where `idx`
   is the position of `k` in a canonical ordering of Keys. This
   distributes keys across shards non-trivially, exercising the
   "not always shard 0" branch of `ColdStartHashTieBreak`. *)
HashTable ==
    LET ordering ==
            CHOOSE f \in [1..Cardinality(Keys) -> Keys]:
                \A i, j \in 1..Cardinality(Keys):
                    i # j => f[i] # f[j]
    IN [k \in Keys |->
           (CHOOSE i \in 1..Cardinality(Keys): ordering[i] = k) - 1]

HashTieBreak(k) == HashTable[k] % Shards

Unread == -1

VARIABLES
    shardLoads,      \* [0..Shards-1 -> Nat] — committed loads
    cmsTrainCount,   \* [Keys -> 0..MaxObserves] — # of Observe calls per key
    pickHistory,     \* Seq of [thread, key, shard]; length bounded by MaxPicks
    threadPc,        \* [Threads -> {"idle", "picking", "done"}]
    \* Per-thread local scan state (models the argmin loop).
    scanSnapshot,    \* [Threads -> [0..Shards-1 -> Int]]; `Unread` if not seen yet.
    scanBestShard,   \* [Threads -> 0..Shards-1]
    scanBestLoad,    \* [Threads -> Nat]
    scanKey          \* [Threads -> Keys \cup {"none"}]

vars == <<shardLoads, cmsTrainCount, pickHistory, threadPc,
          scanSnapshot, scanBestShard, scanBestLoad, scanKey>>

\* Upper bound on any slot's committed load = MaxPicks * Predicted.
MaxLoad == MaxPicks * Predicted

TypeOK ==
    /\ shardLoads    \in [0..Shards-1 -> 0..MaxLoad]
    /\ cmsTrainCount \in [Keys -> 0..MaxObserves]
    /\ threadPc      \in [Threads -> {"idle", "picking", "done"}]
    /\ scanKey       \in [Threads -> Keys \cup {"none"}]
    /\ scanBestShard \in [Threads -> 0..Shards-1]
    /\ scanBestLoad  \in [Threads -> 0..(MaxLoad + Predicted)]
    /\ pickHistory   \in Seq([thread: Threads, key: Keys,
                              shard: 0..Shards-1])
    /\ Len(pickHistory) <= MaxPicks

Init ==
    /\ shardLoads    = [s \in 0..Shards-1 |-> 0]
    /\ cmsTrainCount = [k \in Keys       |-> 0]
    /\ pickHistory   = <<>>
    /\ threadPc      = [t \in Threads |-> "idle"]
    /\ scanSnapshot  = [t \in Threads |-> [s \in 0..Shards-1 |-> Unread]]
    /\ scanBestShard = [t \in Threads |-> 0]
    /\ scanBestLoad  = [t \in Threads |-> 0]
    /\ scanKey       = [t \in Threads |-> "none"]

(* Observe(k) — trains the CMS ONLY. Critically: it does not touch
   shardLoads in any way. Bounded by `MaxObserves` per key. *)
Observe(t, k) ==
    /\ threadPc[t] = "idle"
    /\ cmsTrainCount[k] < MaxObserves
    /\ cmsTrainCount' = [cmsTrainCount EXCEPT ![k] = @ + 1]
    /\ UNCHANGED <<shardLoads, pickHistory, threadPc,
                   scanSnapshot, scanBestShard, scanBestLoad, scanKey>>

(* Number of threads currently in the middle of a Pick. Each will
   eventually CommitPick, appending a new entry to pickHistory. We
   use this to bound BeginPick so the eventual pickHistory size
   cannot exceed MaxPicks — which is what TypeOK asserts. Guarding
   on `Len(pickHistory)` alone lets N threads all simultaneously
   enter BeginPick while the history is small, and then each of
   their commits pushes pickHistory past MaxPicks. *)
InFlightPickers ==
    Cardinality({tt \in Threads: threadPc[tt] = "picking"})

(* BeginPick(t, k) — thread `t` enters the Pick method for key `k`.
   It seeds the argmin with `hashTieBreak(k)` (matching the F# impl
   where `bestShard` starts at the hash slot and every other slot is
   compared strictly, preserving the hash index on tied loads). *)
BeginPick(t, k) ==
    /\ threadPc[t] = "idle"
    /\ Len(pickHistory) + InFlightPickers < MaxPicks
    /\ LET hashIdx == HashTieBreak(k)
           seed    == shardLoads[hashIdx]
       IN /\ threadPc'      = [threadPc EXCEPT ![t] = "picking"]
          /\ scanKey'       = [scanKey  EXCEPT ![t] = k]
          /\ scanSnapshot'  =
               [scanSnapshot EXCEPT ![t] =
                  [s \in 0..Shards-1 |-> IF s = hashIdx THEN seed ELSE Unread]]
          /\ scanBestShard' = [scanBestShard EXCEPT ![t] = hashIdx]
          /\ scanBestLoad'  = [scanBestLoad  EXCEPT ![t] = seed + Predicted]
    /\ UNCHANGED <<shardLoads, cmsTrainCount, pickHistory>>

(* ScanSlot(t, s) — thread `t` inspects slot `s` inside its argmin
   loop. Skips `hashTieBreak(scanKey[t])` because BeginPick already
   seeded that slot. Strict `<` tie-break preserves the hash slot on
   equal loads. *)
ScanSlot(t, s) ==
    /\ threadPc[t] = "picking"
    /\ scanKey[t] \in Keys
    /\ s \in 0..Shards-1
    /\ s # HashTieBreak(scanKey[t])
    /\ scanSnapshot[t][s] = Unread
    /\ LET observed  == shardLoads[s]
           candidate == observed + Predicted
       IN /\ scanSnapshot' = [scanSnapshot EXCEPT ![t][s] = observed]
          /\ IF candidate < scanBestLoad[t]
             THEN /\ scanBestLoad'  = [scanBestLoad  EXCEPT ![t] = candidate]
                  /\ scanBestShard' = [scanBestShard EXCEPT ![t] = s]
             ELSE UNCHANGED <<scanBestLoad, scanBestShard>>
    /\ UNCHANGED <<shardLoads, cmsTrainCount, pickHistory,
                   threadPc, scanKey>>

(* AllSlotsScanned(t) — true when thread `t` has inspected every slot
   (including the hash-seed slot, which was filled by BeginPick). *)
AllSlotsScanned(t) ==
    \A s \in 0..Shards-1: scanSnapshot[t][s] # Unread

(* CommitPick(t) — the single `Interlocked.Add(&shardLoads[bestShard],
   predicted)`. The invariant here is that this is the ONLY mutation
   to shardLoads in the Pick code path. *)
CommitPick(t) ==
    /\ threadPc[t] = "picking"
    /\ scanKey[t] \in Keys
    /\ AllSlotsScanned(t)
    /\ LET bs == scanBestShard[t]
           k  == scanKey[t]
       IN /\ shardLoads' = [shardLoads EXCEPT ![bs] = @ + Predicted]
          /\ pickHistory' =
                Append(pickHistory,
                       [thread |-> t, key |-> k, shard |-> bs])
    /\ threadPc' = [threadPc EXCEPT ![t] = "done"]
    /\ UNCHANGED <<cmsTrainCount, scanSnapshot,
                   scanBestShard, scanBestLoad, scanKey>>

(* Reset(t) — thread `t` becomes idle again and can issue a new Pick
   or Observe. Models the F# caller looping back into the sharder. *)
Reset(t) ==
    /\ threadPc[t] = "done"
    /\ threadPc' = [threadPc EXCEPT ![t] = "idle"]
    /\ scanKey'  = [scanKey  EXCEPT ![t] = "none"]
    /\ scanSnapshot' =
         [scanSnapshot EXCEPT ![t] =
             [s \in 0..Shards-1 |-> Unread]]
    /\ UNCHANGED <<shardLoads, cmsTrainCount, pickHistory,
                   scanBestShard, scanBestLoad>>

Next ==
    \/ \E t \in Threads, k \in Keys:
         \/ Observe(t, k)
         \/ BeginPick(t, k)
    \/ \E t \in Threads, s \in 0..Shards-1: ScanSlot(t, s)
    \/ \E t \in Threads: CommitPick(t) \/ Reset(t)

Spec == Init /\ [][Next]_vars

(* ─── Invariants ───────────────────────────────────────────────── *)

(* Aggregate helpers used by the invariants. Recursive sum over a
   bounded-cardinality set; TLC evaluates these in bounded time
   because the domains are finite. *)
RECURSIVE SumLoadsAux(_, _)
SumLoadsAux(arr, S) ==
    IF S = {} THEN 0
    ELSE LET x == CHOOSE y \in S: TRUE
         IN  arr[x] + SumLoadsAux(arr, S \ {x})

SumAllLoads == SumLoadsAux(shardLoads, 0..Shards-1)

(* (a) `Observe` never mutates `shardLoads`. We encode this as:
   whenever no `CommitPick` has occurred (`pickHistory` still empty),
   every slot is still zero. Holds by construction because `Observe`
   leaves `shardLoads` in its UNCHANGED list. *)
ObserveNoLoadChange ==
    (pickHistory = <<>>) =>
        (\A s \in 0..Shards-1: shardLoads[s] = 0)

(* (b) `Pick` commits exactly once. Each committed pick adds exactly
   `Predicted` to one slot, so the total load equals
   `Len(pickHistory) * Predicted`. A double-commit would inflate this;
   a zero-commit (side-effect-free Pick) would deflate it. *)
PickCommitsOnce ==
    SumAllLoads = Len(pickHistory) * Predicted

(* (c) Cold-start hash tie-break. Until the first CommitPick, every
   slot is zero. The F# impl initialises `bestShard` to
   `hashTieBreak(k)` and only replaces it when a STRICTLY smaller
   candidate appears. With all zeros no candidate is strictly smaller
   → the hash slot wins. So the first entry in `pickHistory` must
   record `shard = HashTieBreak(key)`. *)
ColdStartHashTieBreak ==
    (Len(pickHistory) >= 1) =>
        (LET first == pickHistory[1]
         IN  first.shard = HashTieBreak(first.key))

(* (d) No torn reads — a snapshotted `Volatile.Read` from a slot is
   always bounded by the current committed load (monotone). This
   prevents the model from producing half-written/torn values that
   could trip the argmin into bogus negative comparisons. *)
NoTornReads ==
    \A t \in Threads, s \in 0..Shards-1:
        scanSnapshot[t][s] # Unread =>
            scanSnapshot[t][s] <= shardLoads[s]

(* Top-level safety predicate TLC checks against every reachable state. *)
Safety ==
    /\ TypeOK
    /\ ObserveNoLoadChange
    /\ PickCommitsOnce
    /\ ColdStartHashTieBreak
    /\ NoTornReads

====
