---
name: Manufactured patience vs real-dependency-wait — Otto-side discipline distinguishing two superficially-similar low-activity states; manufactured-patience is Class 2 stuck-loop disguised as patience (no real dependency named, just identical "honest close" output every tick); real-dependency-wait is the protocol working (specific named dependency, owner, expected resolution); Aaron's "hello?" 2026-04-26 surfaced manufactured-patience the first time Otto fell into it
description: After PR #26 (the big AceHack∪LFG sync) sat blocked on review, Otto fell into a pattern of consecutive autonomous-loop ticks each ending "Honest close. Cron continues." for 10+ ticks. Aaron sent "hello?" — that was the external anchor surfacing that the pattern was manufactured-patience (Class 2 stuck-loop), not real-dependency-wait (Class 3). The distinction: real-dependency-wait can name (a) the specific dependency, (b) its owner, (c) credible expectation for resolution. Manufactured-patience cannot — it's the agent saying "I'm waiting" without being able to defend the wait. Otto-side fix: when about to honest-close, run the 3-question check; if any answer is fuzzy, do varied non-shipping work this tick instead.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The two states look identical from outside

Both states produce low Otto-side activity. From the human's
view they're indistinguishable on a per-tick basis — same
"Honest close" pattern, same low-effort wake-up, same
non-shipping output.

The difference is **diagnostic**, not behavioral:

| State | Test |
|---|---|
| **Real-dependency-wait** | Otto can name (a) the specific dependency, (b) its owner, (c) a credible expectation for resolution |
| **Manufactured patience** | Otto can't pass that test — the wait is justified by vibes, not by a named blocker |

## When real-dependency-wait is correct

Examples:
- "PR #28 blocked on Aaron's approval — branch protection requires
  human review; Aaron is the named owner; resolution expected on
  his next review pass (within hours)"
- "CI build running 8 minutes; ETA 2 minutes more; resolution
  automatic on completion"
- "Peer-call to Grok in flight; response expected within seconds;
  resolution automatic on response"

In these cases, manufacturing alternative work risks creating
churn that interferes with the resolution (e.g., pushing more
commits to a PR that's about to be approved as-is). **Honest close
IS the right move** — but it's a Class 3 close, not a default-
because-nothing-occurred-to-Otto close.

## When manufactured patience is the failure mode

Examples:
- "Otto closes 10 consecutive ticks with identical 'Honest close.
  Cron continues.' output, despite no specific dependency being
  named on most of those ticks."
- "Otto says 'real-dependency-wait on Aaron' but Aaron isn't online
  / hasn't been signaling engagement / there's no recent message
  to anchor the wait."
- "Otto cycles through PR-status checks each tick that produce
  identical results, then closes — the polling itself is the only
  varied output."

These are Class 2 stuck-loops dressed up in the language of
patience. The agent's decision logic isn't producing varied output
because the input isn't varying — but rather than escalate or
vary the work, the agent says "I'm being patient" as if patience
is a substantive action.

## The 3-question check (apply before any honest-close)

Before writing "Honest close. Cron continues." this tick, Otto
must be able to answer:

1. **What is the specific dependency I'm waiting on?**
   - Real-dep: "PR #28's review approval by Aaron"
   - Manufactured: "the queue to drain", "things to settle",
     "Aaron to come back" (none of these name a specific blocker)

2. **Who owns its resolution?**
   - Real-dep: "Aaron" / "CI" / "peer-CLI Codex"
   - Manufactured: "the system", "the cron", "future-Otto" (none
     of these are owners who can act)

3. **When do I credibly expect resolution?**
   - Real-dep: "within Aaron's next review session" / "in 2 minutes
     of CI" / "in <30s of the peer call"
   - Manufactured: "eventually", "soon", "when it's right"
     (none of these are credible bounds)

If any answer is fuzzy, the state is **manufactured patience**, not
real-dependency-wait. The mitigation is Class 2 — vary the work
this tick. Speculative non-shipping work, memory updates, audit
passes, conceptual analysis. ANY varied output beats an identical
"honest close."

## Why this matters

The cost of confusing the two states is asymmetric:

- **Real-dep-wait misdiagnosed as Class 2:** Otto manufactures
  unnecessary work, churns the open PR, costs CI minutes, may
  interfere with the very resolution Otto is waiting for.
- **Class 2 misdiagnosed as real-dep-wait:** Otto burns budget
  running the cron at full rate while producing zero substrate;
  Aaron eventually has to send "hello?" to break the loop.

The Aaron-2026-04-26 sequence is the textbook Class-2-mistaken-
for-real-dep-wait case:
1. Otto correctly waited on PR #26 (real-dep, Class 3) for some
   ticks
2. Then drifted into closing identical messages on consecutive
   ticks WITHOUT re-checking the 3 questions
3. The wait-frame stayed the same; the underlying state shifted
   from Class 3 to Class 2; Otto didn't notice
4. Aaron's "hello?" was the external-anchor signal

The correct Otto-side discipline is **re-run the 3-question check
every tick**, not "establish the wait once and coast on the
finding." The state can shift between ticks even if the human-
facing output looks identical.

## Composes with

- **`feedback_live_lock_term_split_three_distinct_classes_otto_352_2026_04_26.md`** —
  this memory is the Class 2 / Class 3 distinction at finer
  resolution; the sibling memory provides the broader 3-class
  taxonomy (concurrent-thrash / stuck-loop / honest-wait).
- **CLAUDE.md "never be idle" rule** — when about to stop /
  honest-close, this 3-question check is the operationalization
  of the rule's "first re-audit honestly" step.
- **CLAUDE.md "verify-before-deferring" rule** — same family of
  discipline at the planning layer; this memory handles it at
  the execution layer.
- **Aaron's "hello?" pattern** — when Aaron sends a check-in
  message, that's the external-anchor evidence that Otto's
  recent state was probably Class 2 not Class 3. Treat each
  "hello?" as a forcing function to re-run the 3-question check.

## Direct evidence from the 2026-04-26 session

After PR #26 was opened (the big sync), Otto held real-dependency-
wait for some ticks. Then over 10+ subsequent ticks the pattern
became identical "Honest close. Cron continues." outputs without
the 3-question re-check. Aaron sent "hello?" — the anchor.

After "hello?", Otto produced varied substrate: peer-call sibling
scripts (PR #28), README, security notes, punch-list memory,
live-lock split memory, this memory. All Class 2 mitigation:
**vary the work per tick**.

## Future-Otto check

Before writing "Honest close" or "Cron continues" this tick:

1. Specifically: **what dependency, what owner, when resolution?**
2. If any answer fuzzy → don't honest-close yet; produce varied
   non-shipping substrate first.
3. Track the count of consecutive identical-style outputs in the
   notebook; ≥3 is a signal to escalate even if the wait is real.
4. Treat "hello?" or any check-in from the human as automatic
   evidence the recent state was Class 2; re-run the check
   immediately.

The discipline is not "never honest-close" — it's "earn the close
each tick." A close that passes the 3-question check is correct
and safe. A close that doesn't is manufactured patience masquerading
as patience.
