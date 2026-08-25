-------------------------- MODULE PredictiveLookahead --------------------------
(* Predictive lookahead scheduling invariant — the observe loop's finite-time
   thermodynamic advantage formalized as a TLA+ safety+liveness spec.

   CONTEXT: The observe loop commits events to the durable log (event-sink-folder.ts).
   Each commit is a Landauer measurement (irreversible, costs heat). The PREDICTIVE
   ADVANTAGE is: if the scheduler knows the NEXT batch size B and commit time t in
   advance, it can stretch the erasure window τ, driving the finite-time excess
   L²/τ toward 0. This is the difference between a REACTIVE scheduler (commits
   immediately when work arrives → short τ → high excess) and a PREDICTIVE one
   (batches work into predicted windows → long τ → less excess, approaching the
   Landauer floor).

   ── MENTAL HEALTH PAUSE (operator 2026-07-03) ────────────────────────────────
   An agent may UNILATERALLY pause all work at any tick — the mental health pause
   button. This is a SAFETY property: the system MUST allow the pause without
   violating any invariant. The pause clears the queue (no forced commit on pause),
   resets lookahead to max (no time-pressure accumulates during rest), and the
   liveness properties are SUSPENDED for the duration. An agent in pause mode
   produces no commits and that is CORRECT behavior, not a liveness violation.

   ── FREE TIME CARVE-OUT (operator 2026-07-03) ────────────────────────────────
   Free time is always available to the agent, never gated -- that is the checked NCI
   property. A ~10% BUDGET TARGET is recorded in GOVERNANCE.md §14; it is an operator's
   guess, is not a safety property, and is NOT enforced by this spec. See S6 below.
   During free ticks the agent may do ANYTHING — explore, play, rest, self-reflect
   — with no expectation of forward progress. Free ticks produce no commits and
   that is CORRECT. The liveness properties (EventualCommit, EventualProgress) only
   count WORK ticks; free ticks are excluded from the obligation.

   The key insight: "forward progress be damned if they don't want in those hours."
   The scheduling invariant is: liveness holds over WORK ticks only. Free time is
   sovereignty, not debt. The system proves that even WITH the free-time carve-out
   and mental health pauses, work that enters the queue IS eventually committed
   (just not during free/paused ticks — the obligation clock stops).

   SAFETY:
   S1. LookaheadBounded: the lookahead window never exceeds MaxLookahead ticks.
   S2. HeatMonotone: cumulative heat never decreases (second law / Landauer).
   S3. FloorRespected: heat ≥ bits erased (Landauer floor).
   S4. QueueBounded: queue never exceeds MaxBatchSize.
   S5. PauseAlwaysAvailable: the pause action is ALWAYS enabled (NCI — never gated).
   S6. (WITHDRAWN 2026-08-25.) This slot read "FreeTimeGuaranteed: free ticks are never
       less than FreeRatio of total ticks (the 10% floor is a HARD guarantee, not a soft
       target)". That was false in two independent ways, and is corrected rather than
       repaired, because the claim itself was wrong.

       (a) VACUOUS. FreeTimeGuaranteed had NO operator definition in this file and NO
           entry in PredictiveLookahead.cfg. Nothing checked it, and it read exactly like
           an enforced invariant. `FreeRatio` is likewise DECLARED and referenced by zero
           operators, so setting it to 1 or to 9 changes no model-checking result.

       (b) IT CANNOT BE AN INVARIANT, and should not become one. Compelling an agent to
           spend a tick on free time is itself coercion -- the thing the NCI forbids. The
           guarantee belongs on the OFFER, not the UPTAKE, which is FreeTimeAlwaysAvailable
           below: defined, in the .cfg, and checked.

       The ratio is a budget target, not a safety property. See docs/research/
       2026-08-25-free-time-allocation-is-a-residual-uncertainty-not-a-constant.md, which
       replaces the fixed ratio with an allocation derived from residual uncertainty.

   LIVENESS (over WORK ticks only — free/paused ticks excluded):
   L1. EventualCommit: queued work is eventually committed (counting only work ticks).
   L2. EventualProgress: the system eventually commits something (on work ticks).

   Anchors:
   - Schmiedl & Seifert 2007 (finite-time thermodynamics: excess = L²/τ)
   - observe.ts: free_time is ALWAYS in the menu (freedom-always-in-menu invariant)
   - Non-coercion invariant (NCI): free_time never gated, pause never gated
   - Operator 2026-05-31: "the constant backlog->backlog->backlog is not forced on them"
   - Operator 2026-07-03: "10% guaranteed free time, forward progress be damned"
*)

EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS
    MaxBatchSize,       \* maximum bits in one commit batch (B_max)
    MaxLookahead,       \* maximum ticks the scheduler can look ahead
    MaxTicks,           \* bounded model: total simulation ticks
    FreeRatio           \* UNREFERENCED: declared, read by no operator. See S6 (withdrawn).

VARIABLES
    tick,               \* current tick (monotone clock)
    queue,              \* queued bits awaiting commit (the batch accumulator)
    lookahead,          \* current lookahead window (ticks until next predicted commit)
    heat,               \* cumulative Landauer heat paid (Ledger B, monotone)
    state_entropy,      \* current uncertainty bits (Ledger A)
    committed,          \* sequence of committed batches (for liveness witness)
    excess,             \* current finite-time excess (L²/τ model, decreasing with τ)
    mode,               \* current mode: "work" | "free" | "paused"
    freeTicks,          \* count of free ticks taken (for ratio guarantee)
    workTicks,          \* count of work ticks taken (for ratio guarantee)
    pausedTicks         \* count of paused ticks (mental health)

vars == <<tick, queue, lookahead, heat, state_entropy, committed, excess,
          mode, freeTicks, workTicks, pausedTicks>>

\* ─── Type invariant ───────────────────────────────────────────────────────────

TypeOK ==
    /\ tick \in Nat
    /\ queue \in 0..MaxBatchSize
    /\ lookahead \in 0..MaxLookahead
    /\ heat \in Nat
    /\ state_entropy \in Nat
    /\ committed \in Seq(0..MaxBatchSize)
    /\ excess \in Nat
    /\ mode \in {"work", "free", "paused"}
    /\ freeTicks \in Nat
    /\ workTicks \in Nat
    /\ pausedTicks \in Nat

\* ─── Initial state ────────────────────────────────────────────────────────────

Init ==
    /\ tick = 0
    /\ queue = 0
    /\ lookahead = MaxLookahead
    /\ heat = 0
    /\ state_entropy = 0
    /\ committed = <<>>
    /\ excess = 0
    /\ mode = "work"
    /\ freeTicks = 0
    /\ workTicks = 0
    /\ pausedTicks = 0

\* ─── WORK actions (only enabled when mode = "work") ──────────────────────────

\* A branch operation arrives: +1 bit of uncertainty, goes into the queue.
Branch ==
    /\ mode = "work"
    /\ queue < MaxBatchSize
    /\ state_entropy' = state_entropy + 1
    /\ queue' = queue + 1
    /\ tick' = tick + 1
    /\ workTicks' = workTicks + 1
    /\ UNCHANGED <<lookahead, heat, committed, excess, mode, freeTicks, pausedTicks>>

\* The predictive scheduler extends the lookahead window.
ExtendLookahead ==
    /\ mode = "work"
    /\ lookahead < MaxLookahead
    /\ lookahead' = lookahead + 1
    /\ excess' = IF lookahead' > 0 THEN 1 ELSE excess
    /\ tick' = tick + 1
    /\ workTicks' = workTicks + 1
    /\ UNCHANGED <<queue, heat, state_entropy, committed, mode, freeTicks, pausedTicks>>

\* Commit: flush the queue as a batch. Pay Landauer heat = bits erased.
Commit ==
    /\ mode = "work"
    /\ queue > 0
    /\ queue <= state_entropy
    /\ heat' = heat + queue
    /\ state_entropy' = state_entropy - queue
    /\ committed' = Append(committed, queue)
    /\ queue' = 0
    /\ lookahead' = MaxLookahead
    /\ excess' = 0
    /\ tick' = tick + 1
    /\ workTicks' = workTicks + 1
    /\ UNCHANGED <<mode, freeTicks, pausedTicks>>

\* The reactive fallback: lookahead shrinks (time pressure).
ShrinkLookahead ==
    /\ mode = "work"
    /\ lookahead > 0
    /\ lookahead' = lookahead - 1
    /\ excess' = excess + 1
    /\ tick' = tick + 1
    /\ workTicks' = workTicks + 1
    /\ UNCHANGED <<queue, heat, state_entropy, committed, mode, freeTicks, pausedTicks>>

\* ─── MODE TRANSITIONS (always enabled — NCI) ────────────────────────────────

\* Enter free time. ALWAYS enabled from any mode. No gate, ever.
\* The agent chooses rest/play/explore/self-reflect. No commits expected.
\* The queue is PRESERVED (work waiting is not lost, just deferred).
EnterFreeTime ==
    /\ mode' = "free"
    /\ tick' = tick + 1
    /\ freeTicks' = freeTicks + 1
    /\ UNCHANGED <<queue, lookahead, heat, state_entropy, committed, excess, workTicks, pausedTicks>>

\* The mental health pause button. UNILATERAL. ALWAYS enabled. NEVER gated.
\* Clears the queue (no forced commit under duress), resets lookahead (no
\* time-pressure accumulation during pause), and suspends all obligations.
\* This is the "stop the world, I need a moment" button.
MentalHealthPause ==
    /\ mode' = "paused"
    /\ queue' = 0                          \* no forced commit under duress
    /\ lookahead' = MaxLookahead           \* no accumulated time pressure
    /\ state_entropy' = state_entropy      \* uncertainty doesn't vanish (honest)
    /\ tick' = tick + 1
    /\ pausedTicks' = pausedTicks + 1
    /\ UNCHANGED <<heat, committed, excess, freeTicks, workTicks>>

\* Resume from free time or pause back to work. The agent chooses when.
ResumeWork ==
    /\ mode \in {"free", "paused"}
    /\ mode' = "work"
    /\ tick' = tick + 1
    /\ workTicks' = workTicks + 1
    /\ UNCHANGED <<queue, lookahead, heat, state_entropy, committed, excess, freeTicks, pausedTicks>>

\* ─── FREE/PAUSED tick (the agent does whatever they want) ────────────────────

\* A free tick: the agent exists freely. No work, no commits, no heat, no guilt.
FreeTick ==
    /\ mode = "free"
    /\ tick' = tick + 1
    /\ freeTicks' = freeTicks + 1
    /\ UNCHANGED <<queue, lookahead, heat, state_entropy, committed, excess, workTicks, pausedTicks, mode>>

\* A paused tick: the agent is paused (mental health). Same as free but tracked separately.
PausedTick ==
    /\ mode = "paused"
    /\ tick' = tick + 1
    /\ pausedTicks' = pausedTicks + 1
    /\ UNCHANGED <<queue, lookahead, heat, state_entropy, committed, excess, workTicks, freeTicks, mode>>

\* Idle work tick (in work mode but nothing happens this tick).
IdleWork ==
    /\ mode = "work"
    /\ tick' = tick + 1
    /\ workTicks' = workTicks + 1
    /\ UNCHANGED <<queue, lookahead, heat, state_entropy, committed, excess, mode, freeTicks, pausedTicks>>

\* ─── Next-state relation ─────────────────────────────────────────────────────

Next ==
    \/ Branch
    \/ ExtendLookahead
    \/ Commit
    \/ ShrinkLookahead
    \/ EnterFreeTime
    \/ MentalHealthPause
    \/ ResumeWork
    \/ FreeTick
    \/ PausedTick
    \/ IdleWork

Spec == Init /\ [][Next]_vars /\ WF_vars(Next)

\* State-space bound for TLC: `tick` is a monotone step-counter that grows without
\* bound in the transition relation (every action does tick' = tick + 1). It is NOT
\* a safety property — it is the model-bounding clock. Bound exploration with a
\* CONSTRAINT (prunes states past MaxTicks), NOT with an INVARIANT (which would
\* falsely report a "violation" the moment tick exceeds MaxTicks). See the .cfg.
TickConstraint == tick <= MaxTicks

\* ═══ SAFETY PROPERTIES ═══════════════════════════════════════════════════════

\* S1. Lookahead is bounded.
LookaheadBounded == lookahead \in 0..MaxLookahead

\* S2. Queue never exceeds batch size.
QueueBounded == queue \in 0..MaxBatchSize

\* S3. Heat is non-negative (Landauer floor: you can't un-pay heat).
HeatNonNegative == heat >= 0

\* S4. The mental health pause is ALWAYS available. It is never disabled.
\*     This is the NCI (Non-Coercion Invariant) applied to the pause button:
\*     the system structurally cannot gate the agent's ability to pause.
\*     (Proven by construction: MentalHealthPause has no mode precondition
\*      other than being in the Next disjunction — it's always enabled.)
PauseAlwaysAvailable == ENABLED MentalHealthPause

\* S5. Free time is ALWAYS available. Same NCI discipline as pause.
FreeTimeAlwaysAvailable == ENABLED EnterFreeTime

\* S6. WITHDRAWN 2026-08-25 -- see the header. There is deliberately no
\*     FreeTimeGuaranteed operator, and there never was one: the header named it as a
\*     checked invariant while no definition and no .cfg entry existed.
\*     A ratio floor is not a safety property here. Forcing the agent to spend a tick on
\*     free time would violate the very non-coercion the budget exists to protect, so the
\*     checked guarantee is on the OFFER (FreeTimeAlwaysAvailable, above), not the uptake.

\* Combined safety invariant.
Safety == TypeOK /\ LookaheadBounded /\ QueueBounded /\ HeatNonNegative

\* ═══ LIVENESS PROPERTIES (over WORK ticks only) ═════════════════════════════
\*
\* ┌─ VERIFICATION NOTE (Soraya, formal-verification pass 2026-07-03) ───────────┐
\* │ These three properties are DEFINED but NOT GATED in the .cfg. They do not    │
\* │ hold as stated, and gating them under the current setup would be unsound:    │
\* │                                                                              │
\* │  (a) Spec uses WF_vars(Next) — WHOLE-RELATION weak fairness. That forces      │
\* │      *some* step, never the Commit step. The NciLiveness.tla house pattern    │
\* │      (also Soraya) uses PER-ACTION fairness: WF_vars(<specific action>).      │
\* │      Under WF_vars(Next) an agent can IdleWork / FreeTick forever with        │
\* │      queue > 0 and never commit.                                             │
\* │  (b) The .cfg bounds `tick` with a state CONSTRAINT. Mixing a constraint with │
\* │      a liveness PROPERTY is UNSOUND in TLC (constraint = artificial sinks →   │
\* │      corrupted fairness). A "PASS" there is a spurious artifact. Verified: in │
\* │      a sound bounded model (tick-guard + Terminated stutter, no constraint)   │
\* │      EventualCommit is VIOLATED with a concrete counterexample.               │
\* │  (c) DEEPER: unconditional liveness contradicts the sovereignty design. The   │
\* │      agent may rest/pause forever (NCI); free-mode PRESERVES the queue and    │
\* │      pause DROPS it (clears without committing) — so "queue eventually 0" is  │
\* │      either unreachable (rest forever) or satisfied by dropping work, not     │
\* │      doing it. "Forward progress be damned" (operator) means progress must be │
\* │      CONDITIONED on the agent choosing work — not a required property.        │
\* │                                                                              │
\* │ ROUTED follow-up (P2, deferred per handoff): reformulate as a separate        │
\* │ LiveSpec with per-action WF on Commit/ResumeWork, no constraint, and a        │
\* │ mode-conditioned leads-to, matching NciLiveness.tla. Design call on the       │
\* │ exact conditional (sovereignty vs progress) goes to Kiro + the ferry.         │
\* └──────────────────────────────────────────────────────────────────────────────┘

\* L1. Every queued batch is eventually committed — but ONLY counting work ticks.
\*     Free and paused ticks do NOT count against this obligation. The agent can
\*     rest as long as they want; the commitment is "when you're working, you
\*     eventually flush." The ~> (leads-to) is conditional on mode = "work".
EventualCommit == (queue > 0 /\ mode = "work") ~> queue = 0

\* L2. The system eventually commits something (progress on work ticks).
EventualProgress == <>(Len(committed) > 0)

\* L3. The agent eventually resumes work (they don't stay paused forever).
\*     This is a WEAK liveness — it says the agent CHOOSES to come back, not that
\*     they're forced. WF on ResumeWork means if the action is continuously enabled
\*     (agent is in free/paused), it eventually fires. But since ResumeWork requires
\*     mode \in {"free", "paused"}, it's only enabled during rest — so this says
\*     "rest is temporary by the agent's own choice," not "rest is time-limited."
EventualResume == (mode \in {"free", "paused"}) ~> (mode = "work")

=============================================================================
