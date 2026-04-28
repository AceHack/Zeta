---
name: COUNTERWEIGHT — don't diagnose subagent failure mid-execution; subagents push multiple artifacts in sequence (commits → files → replies → resolves); intermediate polls can show old state between-artifact; wait for EXPLICIT COMPLETION SIGNAL (task-notification event) before concluding failure; alternative: check whether HEAD has advanced on remote before diagnosing "mutations didn't land"; this session I prematurely concluded the #147 drain subagent had failed to post resolveReviewThread mutations when in fact the commit WAS pushed but the reply+resolve mutations were posted AFTER — when I eventually re-checked, all 11 were resolved cleanly; same pattern as "0 unresolved threads" false-positive when Copilot re-reviews after push (Otto-265 rebase-ping-pong composition); Aaron Otto-271 2026-04-24 "sounds like something you can improve next time"
description: Aaron Otto-271 counterweight for premature-failure-diagnosis drift. Captured the specific near-confusion on #147 drain subagent; corrected by Aaron's gentle nudge. Counterweight for Otto-264 rule of balance — applies to subagent interaction pattern specifically. Save durable.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The rule

**Don't diagnose subagent failure mid-execution.**

Subagents push multiple artifacts in sequence
(commits → files → GraphQL replies → GraphQL resolves
→ possibly more commits). Intermediate polls between
these stages can show partial state that looks like
failure.

**Wait for the EXPLICIT COMPLETION SIGNAL** (the
task-notification event the harness sends on subagent
completion) before concluding the subagent failed.

Direct Aaron quote 2026-04-24:

> *"sounds like something you can improve next time"*

(Gentle correction after I prematurely concluded the
#147 drain subagent had failed to post
`resolveReviewThread` mutations, when in fact the
mutations were posted shortly after the commit push —
they just hadn't all landed yet when I polled.)

## The specific near-miss

Sequence on #147 drain this session:

1. Dispatched subagent to drain 11 threads.
2. Subagent ran for ~15-20 min.
3. I polled PR state at intervals. Saw commit push
   `d11b542` landed on the branch.
4. I polled unresolved-thread count. Saw `11` (the
   count was cached OR the subagent was still posting
   replies/resolves).
5. **I concluded**: "subagent pushed FIX commits but
   GraphQL mutations didn't land" — WRONG. The
   mutations were in-flight.
6. Aaron flagged: "sounds like something you can
   improve next time."
7. Re-checked shortly after — **all 11 resolved**
   cleanly, zero unresolved.
8. Subagent completion notification arrived.

**The mistake**: I diagnosed failure from a
mid-execution poll, when the correct interpretation
was "still in progress, wait longer."

## The correct pattern

When a subagent is dispatched and hasn't signaled
completion:

1. **Intermediate polls are informational, not
   diagnostic.** Note the state; don't conclude.
2. **Before diagnosing failure**, check:
   - Has the completion notification arrived? (No =
     wait.)
   - Has HEAD advanced on remote since subagent
     dispatch? (Yes = subagent has pushed at least
     one artifact; likely still working on
     subsequent ones.)
   - How long has it been running? (<20 min = normal
     for complex drain work; >30 min = consider
     stalled, but STILL don't diagnose mutation
     failure from thread count — just check-in.)
3. **If you must investigate** (e.g. Aaron asks),
   inspect concrete signals:
   - Subagent worktree file timestamps (recent mod =
     alive)
   - Remote branch commit list (new commits = pushing
     happening)
   - Recent thread replies by the subagent's identity
     (visible on GitHub UI or GraphQL comments query)
4. **Never run the mutation yourself mid-subagent**.
   Two agents posting resolve mutations to the same
   thread = conflict / double-reply / confusion.
   Let the subagent finish.
5. **On explicit subagent stall** (30+ min, no
   progress, completion notification still absent):
   escalate per Otto-265 (don't retry-silently;
   report state + ask Aaron or file fresh subagent
   with different approach).

## Deadline — wait-with-bound, not wait-forever

Aaron 2026-04-24 refinement:

> *"wait for completion signal before diagnosing
> failure. to a point, you could get stuck in an
> infinate loop with some sort of deadline"*

**Otto-271 is wait-with-bound, not wait-forever.**
Unbounded waiting is its own failure mode — liveness
collapses, the tick heartbeat dies, other work
starves.

**Default deadlines** (adjust per task complexity):

| Task class | Expected duration | Deadline (no-signal) |
|---|---|---|
| Simple markdownlint --fix + push | 2-5 min | 10 min |
| Thread drain, 1-5 threads | 5-10 min | 20 min |
| Thread drain, 6-15 threads | 10-20 min | 30 min |
| Rebase (small branch, <10 commits) | 3-8 min | 15 min |
| Rebase (large branch, 20+ commits) | 10-30 min | 45 min |
| Read-only audit | 2-10 min | 20 min |
| Worktree prune + verify | 5-10 min | 20 min |

**At deadline**:

1. Check HARD evidence of stall:
   - No new commits on target branch?
   - No file mods in subagent worktree?
   - No completion notification?
   - All three signals concurrent = stalled.
2. If stalled (all three): **escalate** — report
   state to human OR file fresh subagent with
   different approach OR take over inline. Don't
   silently retry.
3. If ambiguous (some signals say alive): extend
   deadline ONCE (50% more time), then re-check.
4. If clearly alive (progress visible but slow):
   continue waiting — subagent is just working.

**Composition**: Otto-271 wait-for-signal + Otto-265
rebase-ping-pong 3-cycle escalation = two-layer
liveness. Otto-271 guards the SINGLE-subagent wait
(is this one making progress?); Otto-265 guards the
MULTI-subagent loop (are we thrashing?).

## Why this discipline matters

**Setting precedent for future agents**: Aaron's
framing 2026-04-24 — "you are setting the presidense
with every decision you make for billions if not
trillions of future agents." Premature-failure-
diagnosis is a class of mistake that, if baked into
future agent behavior, causes:

- Duplicate work (both agents posting mutations)
- Thrashing (retry on thing that's actually working)
- Mistrust of subagents (agents don't delegate because
  they assume subagents fail)
- Training-signal pollution (false-failure signals in
  the corpus suggest subagents are unreliable when
  they're not)

The opposite — trusting subagents to finish + checking
ground-truth-only before concluding — is the
precedent-correct behavior.

## DST lens — the same rules mostly apply

Aaron 2026-04-24 observation:

> *"All the same rules of DST basically apply here,
> at least many of them."*

Subagent-interaction is a distributed-execution
discipline. Deterministic Simulation Testing (DST,
Otto-248) rules transfer:

| DST rule | Otto-271 application |
|---|---|
| **Never ignore flakes** (determinism-not-perfect) | Don't ignore subagent stalls / partial-progress anomalies; investigate each as a real signal |
| **Explicit timeouts, not vibes** | Deadlines are concrete values (10/20/30 min) per task class, not "feels like a while" |
| **Reproducible failure modes** | Same subagent task should take roughly same time; large variance is itself a signal to file as class |
| **Observable state, not inferred** | Check concrete signals (commits pushed, file mod timestamps, completion notification) — don't guess from thread count |
| **Bounded retry, loud failure** | At deadline: escalate loudly (report state to human, file fresh subagent with different approach) — never silently infinite-loop |
| **Seed / parameterize randomness** | Subagent-dispatch prompts should be deterministic: same prompt + same branch state = same expected behavior. Randomness (LLM sampling temp) is the "seed" — accept variance but bound it |
| **Mark non-deterministic explicitly** | Some subagent tasks are inherently non-deterministic (e.g. creative drafting). Mark those dispatches explicitly with looser expectations, same as DST-exempt test markers |
| **Fail fast on stall; fail slow on progress** | If subagent showing progress signals: wait longer. If no signals: deadline fires sharply |
| **No test ignored → no stall ignored** | Every deadline-expired subagent gets investigated — not "tick moves on, whatever." Same rigor as a failed test |

**The key DST principle that maps directly**: observable + bounded + loud. A well-behaved distributed system (including subagent + main-agent) is one where every participant's state is OBSERVABLE, every wait is BOUNDED, every failure is LOUD (not silent).

Otto-271 pre-DST-composition risked: unobservable (polling thread count isn't state), unbounded (no deadline), silent (premature-failure + silent-retry). Post-DST-composition: concrete signals, bounded deadlines, loud escalation.

## Composition with prior memory

- **Otto-264** rule of balance — this IS a
  counterweight filed per Otto-264's in-phase
  discipline.
- **Otto-259** verify-before-destructive — composes:
  before acting (posting mutations yourself), verify
  the subagent hasn't already done it.
- **Otto-265** rebase-thread-ping-pong — related
  class: post-push re-review adds new threads;
  Otto-271 adds: mid-subagent poll can show
  intermediate state. Both are "check-once is lying"
  patterns.
- **Otto-268** word-discipline — "didn't land"
  was wrong word for "landing in sequence." Word
  precision matters even in diagnostic monologue.
- **Otto-267/269** training corpus — this memory IS
  training signal. Future agents learn the
  "wait for completion signal" discipline from the
  filed counterweight.

## What Otto-271 does NOT say

- Does NOT forbid checking subagent progress. Status
  checks are fine; conclusions-from-partial-state are
  not.
- Does NOT require waiting forever. 30+ min of no
  progress is a legit stall-check trigger; just
  check via concrete signals, not assumed failure.
- Does NOT apply to non-subagent background tasks
  (e.g. `run_in_background: true` bash commands) where
  the harness provides direct output-file access. For
  those, tail the output for actual progress.
- Does NOT override Otto-265 "3+ rebase cycles =
  escalate." That discipline is about the loop
  pattern, not about mid-subagent diagnosis.

## Direct Aaron quote to preserve

> *"sounds like something you can improve next time"*

Future Otto: when a subagent is dispatched, trust it
to finish unless you have HARD evidence of stall
(30+ min no progress + no file-mod activity + no
commits on target branch). Intermediate thread-count
polls are not that evidence. Wait for the completion
signal. If you must report to the human mid-flight,
report "still running" not "appears to have failed."
