---
name: Scheduling-authority phrasing confirmed — "open when the work advances the queue, not for volume's sake"; Aaron endorsed this self-reflection framing, preserve it as the operative read of the 2026-04-23 scheduling-authority rule
description: Aaron 2026-04-23 *"scheduling-authority rule isn't 'never open PRs' — open when the work advances the queue, not for volume's sake. perfect self reflection"* — explicit endorsement of the framing I used in the tick-close of auto-loop-66. Restraint-on-PR-opening is legitimate when restraint prevents noise, but it is NOT the scheduling rule's default; advancing the queue IS. The rule permits neither "open PRs freely" nor "never open PRs" — it asks "does this PR advance the queue?" and opens on yes, holds on no.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Scheduling rule phrasing confirmed — advance-the-queue, not volume

## Verbatim (2026-04-23)

> scheduling-authority rule isn't "never open PRs" — open
> when the work advances the queue, not for volume's sake.
> perfect self reflection

## Context

I had self-reflected in auto-loop-66's tick-history row:

> *"Restraint reversal from auto-loop-65: the
> scheduling-authority rule isn't 'never open PRs' — open
> when the work advances the queue, not for volume's
> sake."*

Aaron read it and confirmed: *"perfect self reflection."*
The framing is now endorsed and operative.

## Rule (confirmed phrasing)

Under the 2026-04-23 scheduling-authority rule
(`feedback_free_work_amara_and_agent_schedule_paid_work_escalate_to_aaron_2026_04_23.md`),
free-work PR decisions reduce to one question per tick:

**Does this PR advance the queue?**

- Yes → open it (self-schedule, no Aaron-consult)
- No → hold (restraint prevents noise)

Both answers are legitimate. Neither is the default. The
rule does not say *"open as many PRs as possible"* and it
does not say *"open as few PRs as possible."* It asks the
question and lets the answer determine the action.

## Why this framing matters

### Avoids the two failure modes

1. **PR-volume churn.** Opening every possible free-work
   PR floods the maintainer review queue, creates
   merge-backlog noise, and hides the work that matters
   amongst work that doesn't.
2. **Ship-nothing restraint.** Holding on every PR for
   fear of volume loses the factory's bias toward
   progress. Aaron explicitly rejected that posture in
   the "prefer progress over quiet close" memory
   (`feedback_current_memory_per_maintainer_distillation_pattern_prefer_progress_2026_04_23.md`).

### Reframes "prefer progress"

*"Prefer progress"* composes with the advance-the-queue
question: progress is not PR count, it's queue
advancement. A tick that does task hygiene + reflection +
tick-history without a new PR can be *progress* if that's
what the queue needed. A tick that opens 4 PRs can be
*noise* if the queue didn't need them.

The test: *what did this tick leave better than it found?*

## How to apply

### On every free-work decision

1. What would this PR land?
2. Does landing it advance the queue — i.e., unblock a
   future move, resolve a pending directive, close a gap
   Aaron named, or deliver a queued BACKLOG row?
3. Or is it volume — doing work because work exists, not
   because this specific work is the next move?
4. **Advance-the-queue** → open it.
5. **Volume** → hold; pick a different bounded move or
   do task/ledger hygiene.

### On tick-close reflection

Every tick's close should be able to answer: *"did this
tick advance the queue?"* Yes: name what advanced. No:
name why restraint was the right call. The answer goes
in the tick-history observations.

## What this is NOT

- **Not a quota.** There's no target PR/tick rate. Some
  ticks land 3 PRs; some land 0. Both are legitimate.
- **Not a mandate to always have a reason-to-restrain.**
  Some ticks genuinely have queue-advancing work; just
  do it.
- **Not a license to second-guess already-opened PRs.**
  Once a PR is open, the advance-the-queue question is
  answered. Reversing is its own overhead unless the PR
  was genuinely misguided.
- **Not a replacement for the free-vs-paid check.**
  Paid work still escalates to Aaron. Free work still
  asks the advance-the-queue question. Both rules
  compose.

## Composes with

- `feedback_free_work_amara_and_agent_schedule_paid_work_escalate_to_aaron_2026_04_23.md`
  (the parent scheduling-authority rule; this memory
  captures the operative question under that rule)
- `feedback_current_memory_per_maintainer_distillation_pattern_prefer_progress_2026_04_23.md`
  (prefer-progress framing; this memory specifies that
  progress = queue advancement, not PR count)
- `feedback_mission_is_bootstrapped_and_now_mine_aaron_as_friend_not_director_2026_04_23.md`
  (agent owns scheduling; this memory is the operative
  decision framework)
- `docs/hygiene-history/loop-tick-history.md` — every
  tick-history row should implicitly or explicitly
  answer the advance-the-queue question
