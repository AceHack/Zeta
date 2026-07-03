---
name: Manufactured patience vs real-dependency-wait — Otto-side discipline distinguishing two superficially-similar low-activity states; manufactured-patience is Class 2 stuck-loop disguised as patience (no real dependency named, just identical "honest close" output every tick); real-dependency-wait is the protocol working (specific named dependency, owner, expected resolution); Aaron's "hello?" 2026-04-26 surfaced manufactured-patience the first time Otto fell into it
description: After PR #26 (the big AceHack∪LFG sync) sat blocked on review, Otto fell into a pattern of consecutive autonomous-loop ticks each ending "Honest close. Cron continues." for 10+ ticks. Aaron sent "hello?" — that was the external anchor surfacing that the pattern was manufactured-patience (Class 2 stuck-loop), not real-dependency-wait (Class 3). The distinction: real-dependency-wait can name (a) the specific dependency, (b) its owner, (c) credible expectation for resolution. Manufactured-patience cannot — it's the agent saying "I'm waiting" without being able to defend the wait. Otto-side fix: when about to honest-close, run the 3-question check; if any answer is fuzzy, do varied non-shipping work this tick instead.
type: feedback
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

## Refinement: periodic re-audit during sustained honest-wait (Aaron 2026-05-01)

The 3-question diagnostic (specific dependency / owner /
expected resolution) was originally framed as an ENTRY check
when transitioning into honest-wait. Practice in 2026-05-01
revealed a gap: during a sustained wait (15+ ticks of
"Holding"), I never re-ran the diagnostic. Aaron caught this
explicitly:

> *"so there is nothing on the in flight stuff you can do?
> just double checking? how are they going to get resolved?"*

Forcing me to re-audit, I discovered 2 of 3 supposedly-blocked
items were actually within my delegated authority — I had
classified them as Aaron-blocked when the entry check would
have re-classified them as actionable.

> *"next time you wait maybe you can ask that same question of
> yourself"*

**The refinement: re-run the 3-question diagnostic every N
ticks during sustained wait, not just on entry.** A wait-state
that was correctly Class 3 honest-wait at minute 0 may have
become Class 2 (manufactured patience masquerading) by minute
15 because:

1. The actor's authority-scope expands as Aaron delegates
   things during the same session. What was Aaron-blocked
   becomes actor-actionable retroactively.
2. The wait-state itself accumulates evidence — pending PRs
   pile up, threads accumulate, drain-targets emerge — and the
   actor can mistake "no new pointer from Aaron" for "nothing
   to do."
3. Substrate cadence concerns (receipt-energy hazard) can
   over-correct into under-action. The discipline is balance,
   not maximal pause.

**Operational: every ~5-10 minutes during sustained wait, the
actor re-runs:**

1. *Specific dependency*: do the items I'm waiting on still
   actually need Aaron, or has my delegated authority expanded
   in this session to cover them?
2. *Owner*: is Aaron specifically the owner, or could a peer-AI
   review / razor-cut / autonomous decision resolve it?
3. *Expected resolution*: am I imagining a specific moment
   when this will resolve, or am I drifting into
   wait-as-default?

Compose with the original 3-question check. Don't add more
questions — same questions, periodic re-application.

**Why this composes with the parent rule, not a new rule:**
the meta-meta-meta-rule (orthogonality check before encoding
new class-level rules) applies. The dissolve-test: can
"periodic re-audit during sustained wait" be stated as an
extension of "manufactured-patience vs real-dependency-wait
diagnostic" without losing precision? Yes — same diagnostic,
extended from one-shot to periodic. New file would be
namespace-pollution. Extension is the right move per the
class-orthogonality rule (`feedback_class_level_rules_need_orthogonality_check_extend_or_create_aaron_2026_05_01.md`, filed in in-flight PR #1025).

**Aaron's framing of why this matters:**

> *"next time you wait maybe you can ask that same question of
> yourself"*

The maintainer should not be the only place the 3-question
check lives. If I require Aaron's prompt to re-audit, I'm
load-bearing on his attention — which violates the
silent-courier-debt rule from the inverse direction. The actor
self-prompts; the maintainer is freed from the pseudo-question
duty.

**Carved candidate (not seed-layer):** *"Run the diagnostic
on yourself before the maintainer has to ask it for you. The
periodic re-audit IS the discipline."*

## Second dimension: periodic re-audit as world-model verification (Aaron 2026-05-01)

Aaron's follow-up to the periodic-re-audit refinement:

> *"that can also see how your internal view of the world your
> internal world model matches reality in this case, that's
> good for world model verfication"*

The periodic re-audit serves TWO purposes simultaneously:

1. **Discipline against pseudo-patience** (the original framing
   in this memory). The actor self-prompts so the maintainer
   doesn't have to.
2. **World-model verification** (Aaron's addition). The
   *discrepancy* between what the actor classified as
   Aaron-blocked (internal world model) and what the re-audit
   reveals as actually-actionable (reality) IS a calibration
   error signal.

When the re-audit finds *no discrepancy*, the world-model is
calibrated correctly for the in-flight items. When the
re-audit finds discrepancy ("oh, I had over-classified those
as Aaron-blocked when my delegated authority covers them"),
the discrepancy quantifies the calibration error.

**Why this matters operationally:** drift in the internal
world-model is otherwise invisible. The actor doesn't know
when their map of "what's in scope" has fallen out of sync
with reality. The periodic re-audit surfaces drift through
the discrepancy signal, naturally and without requiring
external attention.

**Composes with:**

- The CSAP fixed-point theory (`memory/feedback_carved_sentence_fixed_point_stability_soul_executor_bayesian_inference_aaron_2026_04_30.md`)
  — fixed-points are stable claims about reality; world-model
  drift IS deviation from those fixed-points; periodic re-audit
  is the convergence-back-to-fixed-point mechanism.
- DST discipline — DST tests for non-determinism in code; the
  periodic re-audit is the actor's analog for non-determinism
  in own world-model classification.
- Otto-340 (`feedback_otto_340_language_is_the_substance_of_ai_cognition_ontological_closure_beneath_otto_339_mechanism_2026_04_25.md`)
  — language IS the substance of AI cognition; the
  classification labels ("Aaron-blocked" vs "actor-actionable")
  are the substance; their drift IS cognitive drift; the
  re-audit catches it.

**The two-purpose framing also justifies the periodic-not-just-
on-entry cadence**: a one-time entry check catches no drift
because there's no time for drift to accumulate. The drift IS
the time-derivative; the periodic re-audit is the sampling
mechanism.

**Carved candidate (not seed-layer, sub-claim of the parent
carved):** *"The discrepancy between classification and
reality IS the world-model error signal. The periodic
re-audit is the sampling mechanism that surfaces it."*

**Why this is an extension to the same file, not a new
memory:** per the meta-meta-meta-rule's dissolve test, two
purposes on the SAME mechanism (the periodic re-audit) belong
in the SAME file as compositional sub-claims. Splitting them
into separate files would namespace-pollute and lose the
linkage between discipline and calibration. The parent class
is "self-applied diagnostic during honest-wait"; both
discipline-purpose and calibration-purpose are sub-aspects of
it.
