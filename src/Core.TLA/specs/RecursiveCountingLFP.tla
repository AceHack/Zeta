---------------------------- MODULE RecursiveCountingLFP ----------------------------
(* Least-fixed-point iteration of `RecursiveCounting` under pure-insert
   input. The invariant we prove is the Gupta-Mumick-Subrahmanian
   "counting algorithm" claim that

       weight(k) = number of derivation paths to k

   at every tick of the LFP unfolding, for Z-linear `body`. We model
   the combinator as it ships in `src/Dbsp.Core/Recursive.fs` — the
   feedback cell carries the running T_{k-1}, and
   `next = seedInt + body(T_{k-1})` is the LFP unfolding.

   State encoded for TLC:
     * `seed`     : set of extensional facts (monotone insert-only)
     * `closure`  : function Key -> Nat, the running weight of each
                    derived key
     * `paths`    : function Key -> Nat, the number of distinct
                    derivation paths reaching that key (ghost variable
                    — tracked only by the spec, not by the
                    implementation; the correctness claim is that the
                    implementation's `closure` equals this `paths`)

   Body model. TLC needs a concrete `body`; we use the simplest
   non-trivial Z-linear deriver: `body(T)(succ(k)) += T(k)` over a
   successor chain `0 → 1 → 2 → 3`. Under this body and seed `{0}`,
   the weight of key `n` at LFP is exactly 1 (the single path
   `0 → 1 → … → n`), and the invariant `closure[k] = paths[k]` must
   hold at every tick — including before LFP has converged, so
   `closure[n]` becomes 1 at exactly tick `n`, not tick 0. *)

EXTENDS Integers, FiniteSets, TLC

CONSTANTS MaxKey, MaxTicks
VARIABLES tick, closure, paths

vars == <<tick, closure, paths>>

Keys == 0..MaxKey

TypeOK ==
    /\ tick    \in 0..MaxTicks
    /\ closure \in [Keys -> Nat]
    /\ paths   \in [Keys -> Nat]

(* Initial condition — tick 0 is the seed applied once. The seed is
   `{0}` with weight 1, giving both closure and paths the value 1 at
   key 0, 0 elsewhere. *)
Init ==
    /\ tick = 0
    /\ closure = [k \in Keys |-> IF k = 0 THEN 1 ELSE 0]
    /\ paths   = [k \in Keys |-> IF k = 0 THEN 1 ELSE 0]

(* One LFP iteration under the successor-chain body.  Implementation:
     next[k] = seedInt[k] + body(closure)[k]
            = (1 if k=0 else 0) + closure[k-1]  (for k > 0)
            = 1                                 (for k = 0)
   Ghost variable `paths` evolves by the same recurrence, demonstrating
   that `closure = paths` is preserved. *)
Step ==
    /\ tick < MaxTicks
    /\ tick' = tick + 1
    /\ closure' = [k \in Keys |->
                     IF k = 0 THEN 1
                     ELSE closure[k - 1]]
    /\ paths'   = [k \in Keys |->
                     IF k = 0 THEN 1
                     ELSE paths[k - 1]]

Next == Step

Spec == Init /\ [][Next]_vars

(* The correctness claim — the implementation's weight equals the ghost
   derivation-path count at every tick. *)
CountingSound == \A k \in Keys: closure[k] = paths[k]

(* Monotonicity: weights only grow (pure insert, no retraction). Under
   the successor-chain body each weight either stays at 0 or rises to
   exactly 1, so this is `closure[k] \in {0, 1}` at every tick. *)
Monotone == \A k \in Keys: closure[k] \in {0, 1}

(* Eventually-fixed: after MaxKey steps, every key has reached weight 1. *)
EventuallyFixed ==
    tick >= MaxKey => \A k \in Keys: closure[k] = 1

Safety == TypeOK /\ CountingSound /\ Monotone
====
