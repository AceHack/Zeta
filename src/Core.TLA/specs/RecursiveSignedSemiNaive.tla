------------------------- MODULE RecursiveSignedSemiNaive -------------------------
(*
  Gap-monotone (signed-delta) semi-naive LFP for DBSP.

  Round-35 first-pass spec. Sibling to `RecursiveCountingLFP.tla`
  (Gupta-Mumick counting variant, TLC-model-checked round 19). This
  spec moves off the round-35 skeleton by giving `Step` a real
  recurrence against a concrete body that visibly satisfies
  preconditions P1-P3 below.

  Design doc: docs/research/retraction-safe-semi-naive.md
  §"Option 7 — gap-monotone signed-delta"

  Preconditions on `body` (stated for the F# caller; the spec picks
  ONE concrete body that satisfies them and model-checks the
  iteration shape):

    P1.  body is Z-linear:
         body(a + b) = body(a) + body(b)

    P2.  body distributes over signed weights:
         body(-a) = -body(a)

    P3.  body is support-monotone:
         support(a) ⊆ support(b)
         ⇒ support(body(a)) ⊆ support(body(b))

  Concrete body in this spec: the successor chain
  `body(T)[k] = T[k - 1]` for k > 0, 0 for k = 0. Under this body,
  P1 + P2 hold by the substitution rule on pointwise sums / negation;
  P3 holds because support(body(T)) = {k+1 : k ∈ support(T)} ∩ Keys,
  which is monotone in support(T). Choosing the same body as the
  counting sibling keeps the two models cross-comparable — the only
  difference is that `SeedWeight` here may be negative, exercising the
  signed-delta discipline that the counting variant refuses.

  Iteration shape (mirrors RecursiveSigned.fs planned signature):

    tick 0:  delta = seed,  total = seed
    tick n>0:
        newDelta = body(delta)      \* Z-linear; signed weights pass through
        total'   = total + newDelta \* gap-monotone accumulator
        delta'   = newDelta
    terminate when delta' = 0 everywhere

  Correctness claim the properties below encode:

    S1. Termination. Every run reaches `done` within MaxKey + 1 steps.
    S2. Fixpoint. At termination, total satisfies total = seed + body(total).
    S3. Gap-monotone bound. Under the successor body and seed
        {0 |-> SeedWeight, _ |-> 0}, every tick has
        total[k] ∈ {0, SeedWeight}. The "gap" in "gap-monotone" is
        this single-valued discipline: signed weights pass through
        without accumulating, the support grows monotonically, and
        no key ever flips sign.
    S4. Sign-distribution. Total under SeedWeight = -w equals the
        negation of total under SeedWeight = +w, point-wise. Stated
        here as a same-magnitude invariant per TLC scope (two-trace
        quantification is discharged by an F#-level FsCheck test).

  S2 is the spec's primary load-bearing claim — it shows that the
  signed iteration converges to the same fixpoint the unsigned
  reference LFP would reach, given a body satisfying P1-P3. S1
  and S3 are safety properties that bound the state space so TLC
  terminates; S4 is documented here but discharged by the F# test
  harness.
*)

EXTENDS Integers, FiniteSets, TLC

CONSTANT
    MaxKey,      \* chain length - 1 (Keys = 0..MaxKey)
    MaxIter,     \* hard bound on TLC step count
    SeedWeight   \* signed integer weight placed at key 0; may be negative

ASSUME
    /\ MaxKey \in Nat
    /\ MaxIter \in Nat
    /\ MaxIter >= MaxKey + 2   \* enough ticks to reach fixpoint + observe done
    /\ SeedWeight \in Int
    /\ SeedWeight # 0          \* zero seed trivially terminates; not interesting

\* Named seed values for TLC config overrides (`SeedWeight <- NegOne`).
\* TLC's .cfg parser does not accept bare negative integer literals, so we
\* define them here and refer to them via `<-` substitution.
PosOne     == 1
NegOne     == 0 - 1
PosTwo     == 2
NegTwo     == 0 - 2

VARIABLES
    total,      \* current Z-set accumulator, Keys -> Int
    delta,      \* most recent signed delta, Keys -> Int
    iter,       \* iteration counter, 0..MaxIter
    done        \* BOOLEAN, TRUE once delta = 0 everywhere

vars == << total, delta, iter, done >>

Keys == 0..MaxKey

\* Weight range TLC explores. Under the successor body and a single-key
\* seed, every tick has weights in {0, SeedWeight}; we widen by one to
\* catch bugs that would accumulate.
MaxAbs == IF SeedWeight > 0 THEN SeedWeight ELSE -SeedWeight
Weights == (-2 * MaxAbs) .. (2 * MaxAbs)

ZSet == [Keys -> Weights]

\* The concrete body: successor chain. body(T)[0] = 0; body(T)[k] = T[k-1].
Body(T) == [k \in Keys |-> IF k = 0 THEN 0 ELSE T[k - 1]]

\* The seed: SeedWeight at key 0, 0 elsewhere.
Seed == [k \in Keys |-> IF k = 0 THEN SeedWeight ELSE 0]

\* Pointwise sum of two Z-sets.
Plus(a, b) == [k \in Keys |-> a[k] + b[k]]

IsZero(zs) == \A k \in Keys : zs[k] = 0

(* ----- Type invariants ----- *)

TypeOK ==
    /\ total \in ZSet
    /\ delta \in ZSet
    /\ iter \in 0..MaxIter
    /\ done \in BOOLEAN

(* ----- Initial state ----- *)

Init ==
    /\ total = Seed     \* tick 0 absorbs the seed (matches counting sibling)
    /\ delta = Seed
    /\ iter = 0
    /\ done = FALSE

(* ----- Step relation ----- *)

\* Real step: fire body on delta, accumulate into total, advance delta.
\* Z-linearity P1 is visible in `Body` — each Body(T)[k] is a pure
\* function of T[k-1], so Body(a + b) = Body(a) + Body(b) by
\* substitution. P2 follows by Int being a ring. P3 holds because
\* support(Body(T)) = {k+1 : k ∈ support(T)} ∩ Keys, monotone in
\* support(T).
Step ==
    /\ ~done
    /\ iter < MaxIter
    /\ LET newDelta == Body(delta) IN
        /\ iter'  = iter + 1
        /\ delta' = newDelta
        /\ total' = Plus(total, newDelta)
        /\ done'  = IsZero(newDelta)

Terminate ==
    /\ done
    /\ UNCHANGED vars

Next == Step \/ Terminate

Spec == Init /\ [][Next]_vars /\ WF_vars(Step)

(* ----- Properties ----- *)

\* S1. Termination — every run reaches done within MaxKey + 1 steps.
\* Expressed as a step-counted safety bound so TLC can check it as an
\* invariant rather than as a liveness property (faster, and catches
\* off-by-one errors in the bound itself).
TerminatesInBound ==
    (iter > MaxKey + 1) => done

\* S2. Fixpoint — at termination, total satisfies
\* total = seed + body(total). This is the algebraic correctness
\* claim: the signed-delta iteration converges to the LFP of
\* T = seed + body(T), same as the unsigned reference would.
FixpointAtTerm ==
    done =>
        \A k \in Keys :
            total[k] = Seed[k] + Body(total)[k]

\* S3. Gap-monotone bound — under the successor body + single-key
\* seed, every tick has total[k] ∈ {0, SeedWeight}. If this ever
\* fails, the iteration is accumulating, not passing through — which
\* means P1-P3 are violated or the step is wrong.
GapMonotone ==
    \A k \in Keys : total[k] \in {0, SeedWeight}

\* S3'. Delta is single-signed — delta never holds both positive and
\* negative weights in the same tick under a single-key seed. This is
\* the gap-monotone safety property on delta; it parallels GapMonotone
\* on total.
DeltaSingleSigned ==
    \A k \in Keys : delta[k] \in {0, SeedWeight}

\* Support grows monotonically (P3 at the state level).
SupportMonotone ==
    \A k \in Keys : total[k] # 0 => (iter >= k \/ Seed[k] # 0)

Safety ==
    /\ TypeOK
    /\ TerminatesInBound
    /\ FixpointAtTerm
    /\ GapMonotone
    /\ DeltaSingleSigned
    /\ SupportMonotone

(* ----- Liveness ----- *)

\* S1 (liveness form) — every fair run eventually sets done.
EventuallyDone == <>done

=============================================================================
(* ----- Sibling cross-check ----- *)
(*
  RecursiveCountingLFP.tla ships the same body (successor chain) with
  SeedWeight implicitly = 1 (Nat-typed `closure` + `paths`). This
  signed spec generalises to SeedWeight ∈ Int \ {0}. The two specs
  agree under SeedWeight = 1 by construction:
    - Counting's `closure[k]` here is `total[k]`.
    - Counting's `paths[k]`   here is `total[k]` (no ghost split).
    - Counting's Monotone (closure[k] \in {0,1}) is exactly S3
      (GapMonotone) under SeedWeight = 1.
  A formal refinement mapping between the two specs is BACKLOG
  research (see docs/BACKLOG.md P2 "Retraction-safe semi-naïve"
  entry). This spec's job is to show the signed generalisation is
  sound on its own.
*)
(*
  Related files:
    tools/tla/specs/RecursiveCountingLFP.tla — sibling, shipped
    tools/tla/specs/RecursiveSignedSemiNaive.cfg — TLC config
    docs/research/retraction-safe-semi-naive.md — design doc
    src/Core/Recursive.fs — RecursiveSemiNaive / RecursiveCounting
    src/Core/RecursiveSigned.fs — SKELETON, planned F# home
*)
