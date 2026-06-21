---
name: under-specified action preconditions are a recurring class in formal specs across tools
description: Two-tool failure mode where Cascade(i) / SizeDoubling actions miss downstream-room preconditions; same class shape, different tool surface
type: feedback
---

# The recurring class: under-specified action preconditions

Same author-time class manifested in two different formal-verification
tools during the 2026-05-03 verify-then-claim sweep:

- **081KQNJ500008QG0R001N1AAJ9 Alloy `Spine.als`**: `pred SizeDoubling [maxCap]` originally
  used `check` (∀-quantification — counterexample-by-construction with
  no batch-size constraints). The `check` semantics asks *"is this
  property true for ALL instances Alloy can construct?"* — and Alloy
  freely constructs instances with negative batch sizes or zero levels
  to refute. Fix: `fact NonNegativeBatchSizes` constraining the model
  + `run SizeDoublingAdmitsInstance` (existence proof, not
  ∀-quantification) + `7 Int` bitwidth to prevent cap-function overflow.

- **081KQNJ500008QG0R003DMVGZB TLA+ `SpineMergeInvariants.tla`**: `Cascade(i)` action only
  required `levels[i] >= Cap(i)` — no constraint on level i+1. TLC
  found a 16-step trace where `Cascade(0)` fires 5 times in a row
  without `Cascade(1)` ever firing, accumulating level 1 to 10 >
  2*Cap(1) = 8. Fix: `levels[i+1] + levels[i] <= 2 * Cap(i+1)`
  precondition mirroring real LSM synchronous-cascade behavior +
  `WF_vars(Cascade(i))` for liveness + state constraint
  (`totalInserted <= 30`) + bounded constants (MaxLevel=2,
  MaxBatchSize=1) for tractable BFS.

## Why: the spec models *the action* but not *the action's
constraints from neighboring state*

The author-time pattern: when writing a state-transition action in
TLA+ / `pred` or `run` in Alloy / lemma-statement in Lean, the natural
move is to enumerate the action's primary effect on its own variables.
What gets missed: the action's constraints from neighboring state
(downstream room, source mass-conservation, prior-state invariants).

Real LSM cascades chain synchronously: if level i+1 is at the
cap-overshoot boundary, level i must wait for i+1 to drain before
dumping. The spec's original `Cascade(i)` failed to model this; the
real implementation in `BalancedSpine.fs` does the right thing.

## How to apply: precondition audit on every state-transition action

Author-time discipline:

1. For every action / `pred` / `run` / lemma, ask: *what neighboring
   state must hold for this action to be safe?* If the action mutates
   variable X, what constraints on Y must hold so the post-state
   satisfies the global invariants?
2. For Alloy `pred`s: ensure constraints on quantified variables that
   would otherwise be free (negative integers, empty sets, etc.).
   Prefer `run <pred> { some <signature>; ... }` for existence proofs;
   reserve `check` for "no counterexample exists" properties where the
   model is constrained by `fact`s.
3. For TLA+ actions: list every variable the action reads. For each,
   ask whether the read-value being any-Nat / any-Seq / any-Function
   could lead to an unsafe post-state. If yes, that read-value needs
   a precondition.
4. For both: when the bounded model finds a counterexample, the
   default mental move is "increase bounds / fix cfg". The
   higher-leverage move is "what neighboring-state constraint did the
   action miss?" — that's almost always a real spec gap, not a model-
   size limit.

## Composes with

- 081KQNJ500008QG0R001N1AAJ9 Spine.als spec bug (PR #1415) — same class, Alloy surface
- 081KQNJ500008QG0R003DMVGZB SpineMergeInvariants.tla spec bug (this PR) — same class,
  TLA+ surface
- The `verify-then-claim` discipline (Otto-279 + the math-proofs
  honest assessment 2026-05-03): when a spec is claimed to validate
  property P, verify the spec actually validates P (not "spec runs
  without error" — spec runs but proves nothing useful)
- The 4-layer encoding template (substrate fix → audit tool → CI
  lint gate → durable memory): this memo is the durable layer; the
  CI lint gate would be a structural audit of `pred` / action shapes
  catching the under-specified-precondition pattern (future tooling)

## Discriminating signal

When a TLA+ TTrace or Alloy counterexample shows the action firing
in an "obviously-wrong" sequence (5 consecutive Cascade(0)s with
Cascade(1) enabled but not chosen, or Alloy producing a model with
negative/zero/unbounded values), the failure class is almost always
under-specified-action-preconditions, not real-bug-found.

Aaron 2026-05-03: *"all kind tla, z3, lean4 it was funny the simple
ones tended to have bugs the complicated ones didn't cause i had you
go through multi round ai convergence with different harnesses
models"* — the multi-round-cross-AI convergence on complicated specs
catches this class; simple specs don't get the same scrutiny so the
class persists. Author-time discipline (audit your action's
preconditions before declaring done) is the structural fix.
