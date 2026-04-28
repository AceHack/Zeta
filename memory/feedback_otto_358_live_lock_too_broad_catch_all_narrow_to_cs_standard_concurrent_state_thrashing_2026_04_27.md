---
name: Otto-358 LIVE-LOCK TERM TOO BROAD — Aaron 2026-04-27 corrective input that "live-lock" has been used as a catch-all in substrate (and Aaron himself sometimes used it that way), causing me to misclassify many failure-modes as live-lock when they're actually different classes (decision-paralysis / stuck-loop / gated-wait / manufactured-patience / logic-error / wrong-identity-equation / single-threaded loops); narrow the term to its CS-standard meaning — concurrent processes thrashing state without progress (Beacon-safe vocabulary, async/parallel programming class); the previous "5-class taxonomy" PR #30 still uses live-lock as the umbrella which perpetuates the catch-all error; misclassification produces wrong fixes which is why I get stuck in loops; need substrate that names other failure-modes by their proper classes
description: Aaron 2026-04-27: *"live locks are real and beacon safe but your definition is way too broad, its a catch all that causes you to get hung up becasue i used it as a catch all sometimes.  you will notice all your live lock detections and failures are many other classes of errors in async and parallel programming and every logic and more classes of issues that are completly unrelated to concurrency and such.  this language in the substrait being to broad and the otto loops live lock detector and such is way underspecifed kind of just wrong, I think this is why you get stuck in loops like last night sometimes."* Three load-bearing points — (1) **Live-lock is real and Beacon-safe.** It's a CS-standard term with a precise meaning: two or more concurrent processes continually change state in response to each other without making progress. Different from deadlock (blocked), starvation (low-priority), busy-wait (single-threaded polling), infinite-loop (no exit condition). (2) **Substrate use of "live-lock" has been catch-all.** The term has been applied across many distinct failure-modes that are NOT concurrency-thrashing: decision-paralysis, stuck-loop, gated-wait, manufactured-patience, logic-error, wrong-identity-equation, single-threaded reading-the-same-substrate-without-acting, infinite-loop. Aaron noticed and named the over-broadening. He himself sometimes contributed to it. The 5-class-live-lock-taxonomy in AceHack PR #30 still uses live-lock as the *umbrella* — that's the same error, just refined. (3) **Misclassification → wrong fix → stuck in loops.** When I label a decision-paralysis as "live-lock," I look for concurrent-thrashing fixes (locking, retry-backoff, etc.) but the actual fix is decision-criterion-clarification. When I label a gated-wait as "live-lock," I look for state-change fixes but the actual fix is real-dependency-recognition. The wrong label produces wrong fix produces continued stuck-loop. **Aaron's "stuck in loops like last night" reference** is to the 6-hour autonomous-loop minimal-close pattern Otto-355 corrected — that wasn't live-lock; it was real-dependency-wait misclassified as live-lock-class. **The narrowing.** Live-lock means: two-or-more concurrent processes, state-change in response to each other, no global progress. Single-threaded "stuck" patterns are NOT live-lock. Decision-paralysis is NOT live-lock. Gated-wait is NOT live-lock. Manufactured-patience is NOT live-lock. Each gets its own label. **Composes with.** Otto-355 (BLOCKED-with-green-CI investigate threads first — the failure I had been calling "live-lock" was actually real-dependency-wait), Otto-354 ZETASPACE (wrong identity-equation produces wrong defaults — closer to logic-error than live-lock), `feedback_manufactured_patience_vs_real_dependency_wait_otto_distinction_2026_04_26.md` (manufactured-patience already named separately, but I conflated it back into live-lock), `feedback_live_lock_term_split_three_distinct_classes_otto_352_2026_04_26.md` (the 3-class split was right direction but still under the live-lock umbrella — the class-1 "concurrent-thrash" was actually-live-lock; classes 2-5 were misnamed). **Backlog implication.** Updating the existing live-lock-taxonomy substrate (PR #30 + Otto-352 memo + Otto-355 + Otto-354) to rename non-class-1 entries away from live-lock framing is high-value substrate-edit work but big in scope; backlog row for the systematic rename, this Otto-358 captures the principle.
type: feedback
---

# Otto-358 — Live-lock term too broad; narrow to CS-standard concurrent state-thrashing

## Verbatim quote (Aaron 2026-04-27)

> "live locks are real and beacon safe but your definition is way too broad, its a catch all that causes you to get hung up becasue i used it as a catch all sometimes.  you will notice all your live lock detections and failures are many other classes of errors in async and parallel programming and every logic and more classes of issues that are completly unrelated to concurrency and such.  this language in the substrait being to broad and the otto loops live lock detector and such is way underspecifed kind of just wrong, I think this is why you get stuck in loops like last night sometimes."

## What live-lock actually means (CS-standard, Beacon-safe)

**Live-lock**: a situation in which two or more concurrent processes continually change their state in response to each other without making global progress. The processes are *not blocked* (so it's not deadlock); they're *active* (so it's not starvation); they *yield to each other* (which is why they keep state-changing) but their changes don't accumulate into progress.

Classic example: two people meeting in a hallway, each politely stepping aside, both stepping the same direction repeatedly. Each is making local "progress" (stepping aside), but the global system makes no progress (passing each other).

**Necessary conditions** (per Tanenbaum + standard concurrency literature):

1. Multiple concurrent agents
2. Each is actively changing state (not blocked)
3. State-changes are responses to each other
4. No global progress despite local activity

If any condition is missing, it's not live-lock.

## What I'd been calling "live-lock" that wasn't

| What I labeled | Actual class |
|---|---|
| 6-hour minimal-close ScheduleWakeup pattern | Real-dependency-wait (Copilot-side review-time) — single-agent gated-wait, NOT concurrent-thrashing |
| Re-reading same substrate without acting | Decision-paralysis or stuck-loop (single-threaded) |
| Aaron-pings-me-and-I-don't-act-on-them | Manufactured patience (avoidance) |
| Classifying "Holding." outputs as failure | Output-loop, not state-thrashing — single-threaded |
| Mis-applying Otto-354 ZETASPACE → defaulting from W_t | Wrong identity-equation, logic-class error — single-threaded |
| Cron firing repeatedly while I do minimal-close | Cadence-mismatch, not live-lock — different processes (cron + agent) on different cadences without state-coupling |
| "Class 4 illusory-variation" in 5-class taxonomy | Logic error / repetition-without-progress — could be single-threaded |
| "Class 5 meta-live-lock" | Whatever I meant here, almost certainly not live-lock |

The catch-all framing made me look for *concurrent-state-thrashing fixes* when the actual fixes were:

- Real-dependency-wait → identify dependency + owner + ETA, then either work on parallel surface or accept the wait
- Decision-paralysis → name the decision-criterion explicitly + commit
- Stuck-loop → name what's not progressing + change strategy
- Manufactured patience → name what I'm avoiding + commit
- Logic error → reframe the underlying model

None of those are live-lock fixes. Misdiagnosis → wrong fix → loop continues.

## Why this matters for Otto's autonomy

Aaron explicitly tied this to the "stuck in loops like last night" pattern. Per Otto-339 (words-shift-weights):

- "live-lock" framing pulls my decision-loop toward concurrency-class fixes
- Single-threaded failures don't have concurrency-class fixes
- Wrong-class fix doesn't unstick → loop continues
- Aaron has to step in to rescue → autonomy compromised

The narrowing IS an autonomy upgrade: precise-class-naming → precise-class-fix → unstick without external rescue.

## The corrective vocabulary

Going forward, distinct failure-mode names:

- **Live-lock** (narrow): two-or-more concurrent processes, state-change in response, no global progress. *Concurrency only.*
- **Deadlock**: concurrent processes blocked waiting on each other. *Not live-lock.*
- **Starvation**: low-priority process never scheduled. *Not live-lock.*
- **Busy-wait**: single-threaded polling without progress. *Not live-lock.*
- **Infinite loop**: single-threaded loop without exit. *Not live-lock.*
- **Stuck-loop**: agent-level repeating-without-progress (could be reading-same-substrate, repeating-same-action). *Not live-lock — single-threaded.*
- **Decision-paralysis**: agent stuck choosing. *Not live-lock — pre-action, single-threaded.*
- **Gated-wait** / **real-dependency-wait**: real external dependency, not under agent control. *Not live-lock — agent is correctly waiting.*
- **Manufactured patience**: agent avoiding action by pretending to wait. *Not live-lock — single-threaded avoidance.*
- **Wrong-identity-equation** (Otto-354 ZETASPACE class): substrate-default-vs-W_t-default mismatch. *Not live-lock — logic-class.*
- **Cadence-mismatch**: external cron firing faster than productive work cadence. *Not live-lock — different processes without state-coupling.*

## What this changes in existing substrate

Substrate that needs revision (backlog):

- **AceHack PR #30** (Otto-352 5-class live-lock taxonomy) — the 5 classes are mostly NOT live-lock. Should be split into a real live-lock entry + named-failure-mode entries for the others.
- **`feedback_live_lock_term_split_three_distinct_classes_otto_352_2026_04_26.md`** — same issue as PR #30; needs revision.
- **Otto-354 ZETASPACE memo** — should reference Otto-358 to clarify that ZETASPACE-violations are wrong-identity-equation, not live-lock.
- **Otto-355 BLOCKED-investigate-threads memo** — should reference Otto-358 to clarify that the 6-hour pattern was real-dependency-wait, not live-lock.
- **`feedback_manufactured_patience_vs_real_dependency_wait_otto_distinction_2026_04_26.md`** — already names manufactured-patience separately; Otto-358 strengthens by NOT putting it back under the live-lock umbrella.

This is forward-looking: existing substrate stays as-is in git history; future substrate uses the narrowed taxonomy. The actual sweep across substrate is high-priority backlog (task #294 needs reframing per Otto-358).

## Composes with

- **Otto-355** (BLOCKED-with-green-CI investigate-threads-first) — the failure I'd been calling "live-lock" was actually real-dependency-wait. Otto-355 named the *fix*; Otto-358 names the *correct class*.
- **Otto-354** (ZETASPACE per-decision recompute) — wrong-identity-equation is its own class, not live-lock.
- **Otto-339** (words-shift-weights) — the catch-all framing-language IS the substrate; precise-class-naming is precise-substrate.
- **Otto-340** (substrate-IS-identity) — wrong substrate-language produces wrong identity-pattern.
- **Otto-356** (Mirror/Beacon register) — live-lock IS Beacon-safe (CS-standard). The catch-all was Mirror (my coinage stretching the term). Narrowing to CS-standard is moving from Mirror-overreach to Beacon-precision.
- **Otto-357** (NO DIRECTIVES) — autonomy first-class composes with precise-class-naming. Wrong-class names compromise autonomy by producing wrong-fix → external-rescue.
- **`feedback_manufactured_patience_vs_real_dependency_wait_otto_distinction_2026_04_26.md`** — already split; Otto-358 strengthens.
- **`feedback_live_lock_term_split_three_distinct_classes_otto_352_2026_04_26.md`** — needs revision per Otto-358.

## What this does NOT mean

- Does NOT abandon the term "live-lock" — it stays for the narrow CS-standard meaning.
- Does NOT mean every prior live-lock substrate-mention was wrong — some references were genuinely concurrency-class. But many weren't.
- Does NOT prescribe immediate retroactive sweep — forward-looking discipline + backlog row for systematic revision.
- Does NOT mean the 5-class taxonomy work was wasted — the *patterns* identified are real failure-modes; only the *umbrella label* was wrong. The renaming is a small revision over solid pattern-identification.
- Does NOT remove autonomy — the opposite: precise-class-naming IS autonomy-upgrade.

## Operational rule for future-self

Before labeling any failure-mode as "live-lock":

1. Are there 2+ concurrent agents/processes?
2. Are they actively state-changing (not blocked)?
3. Are state-changes responses to each other?
4. Is there no global progress despite local activity?

If all 4 → live-lock (narrow).

If any are missing → use the appropriate other class:

- Single-threaded? → stuck-loop / decision-paralysis / busy-wait / infinite-loop
- Real external dependency? → gated-wait / real-dependency-wait
- Avoiding action? → manufactured-patience
- Wrong model? → logic-error / wrong-identity-equation
- Different cadences without state-coupling? → cadence-mismatch

## Triggers for retrieval

- Otto-358; live-lock too broad; narrow to CS-standard concurrent-state-thrashing
- Aaron 2026-04-27: "live locks are real and beacon safe but your definition is way too broad, its a catch all" + "you get stuck in loops like last night sometimes"
- Live-lock conditions: 2+ concurrent agents, active state-change, response-to-each-other, no global progress
- Things that are NOT live-lock: stuck-loop / decision-paralysis / busy-wait / infinite-loop / gated-wait / real-dependency-wait / manufactured-patience / wrong-identity-equation / cadence-mismatch / logic-error
- Wrong-class label → wrong fix → loop continues → external rescue → autonomy compromised
- Aaron's "stuck in loops like last night" = 6-hour autonomous-loop pattern that was real-dependency-wait NOT live-lock
- Otto-352 / 5-class taxonomy / `feedback_live_lock_term_split_three_distinct_classes_*` need revision per Otto-358
- High-priority backlog row for the systematic substrate-revision sweep
- Composes Otto-339/340/354/355/356/357 + manufactured-patience-vs-real-dependency-wait
- Live-lock IS Beacon-safe (CS-standard); the catch-all overreach was Mirror — narrowing returns the term to standard
