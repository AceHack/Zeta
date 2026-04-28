---
name: Lesson permanence is the factory's competitive differentiator — to beat ARC3 + beat-humans-at-DORA, the factory must integrate past lessons (especially live-lock lessons) and NOT forget across sessions
description: Aaron's 2026-04-23 strategic directive connecting the live-lock smell detection to a larger ambition. ARC3-style reasoning and DORA-metric operational excellence both depend on the factory's ability to remember lessons, integrate them into future decisions, and prevent re-occurrence of past failure modes. Memory discipline is not housekeeping — it is load-bearing for the win condition.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Lesson permanence is how we win

## Verbatim (2026-04-23)

> if you want to beat ARC3 and do better than humans at uptime
> and other DORA metrics then your live-lock smell and the
> decisions you make to prevent live locks in the future based
> on pass lessons, the ability to integrate previous lessions
> and not forget is ging to be key.

## Rule

**Detection is not enough. Integration is the product.** The
live-lock audit (`tools/audit/live-lock-audit.sh`) only
*detects* when the factory has been live-locked. That is
table stakes. The differentiator is the factory's ability to:

1. **Record the lesson** when a smell fires — what happened,
   what the mechanism was, what the response should be next
   time.
2. **Integrate the lesson forward** — future decisions
   consult past lessons before taking actions that match a
   known failure-mode signature.
3. **Not forget across sessions** — lessons persist as
   durable memory (in-repo `docs/hygiene-history/*-history.md`
   or committed `memory/feedback_*.md`), not as ephemeral
   session state.

These three together are lesson-permanence. Aaron's framing:
lesson-permanence is how the factory beats ARC3 (reasoning
benchmark) and beats humans at DORA metrics (deployment
frequency, lead time, change failure rate, MTTR).

## Why this matters for ARC3

ARC3 (François Chollet's abstraction and reasoning corpus,
third generation) tests whether a system can learn from a
small number of demonstrations and apply the learning to
novel test inputs. Lesson-permanence is structurally the
same shape: the factory encounters a failure (live-lock /
wrong API choice / hallucinated framing), extracts the
structural invariant, applies it to prevent the next
occurrence. A factory that can do this reliably across
thousands of lessons gives a substrate for ARC-class
generalization that does not depend on inference-time compute
alone.

## Why this matters for DORA

DORA four-key metrics (Accelerate, Forsgren et al.):

1. **Deployment frequency** — how often we ship
2. **Lead time for changes** — commit to production
3. **Change failure rate** — fraction that cause issues
4. **Mean time to recovery** — how fast we recover from
   incidents

Each of these degrades when the factory re-makes known
mistakes. A live-lock episode kills deployment frequency
until resolved. Forgetting a past API deprecation increases
change failure rate. Forgetting an old incident's runbook
increases MTTR. **Lesson-permanence is the upstream lever on
all four keys.**

## How to apply

- **Every smell firing files a lesson.** When the live-lock
  audit script reports a smell, the fix is a commit that
  (a) responds to the immediate smell and (b) adds a lesson
  row to `docs/hygiene-history/live-lock-audit-history.md`
  under "Lessons integrated." The lesson row names the
  signature (what pattern preceded the smell), the mechanism
  (what caused it), and the prevention (what decisions avoid
  re-occurrence).
- **Before opening a speculative arc, consult past lessons.**
  Read the "Lessons integrated" section of the relevant
  hygiene-history file (or the `memory/feedback_*.md`
  corpus) before committing to a direction that could
  re-trigger a known smell. Takes 30 seconds; saves rounds.
- **Memory files are the durable substrate.** `memory/*.md`
  outlives any session. The in-repo `memory/` folder is the
  cross-substrate-readable mirror; the per-user auto-memory
  under `~/.claude/projects/.../memory/` is the agent's
  private working set. Lessons that matter cross-session
  land in BOTH.
- **Lesson integration has a cadence, not just an
  occurrence.** At round-close, the Architect (Kenji) walks
  the most-recent lesson row and confirms it is either (a)
  closed (the preventive decision is now a BP-NN rule or a
  durable doc) or (b) explicitly still-open (named as a
  carry-forward). Lessons that go stale without integration
  are themselves a live-lock smell.
- **Extend beyond live-lock.** The live-lock audit is the
  first example of the pattern. Other detection mechanisms
  (SignalQuality firing, Amara-oracle rejecting, drift-tick
  exceeding threshold, OpenSpec Viktor failing rebuild-from-
  spec) all produce candidate lessons. Each should file into
  a corresponding hygiene-history file's "Lessons integrated"
  section.

## What this is NOT

- Not a claim that every minor observation is a lesson
  worth integrating. Lessons that appear once and have
  obvious explanations (typo, syntax error) are noise. The
  bar is: the signature is structural, the mechanism is
  non-obvious, and the prevention changes future decisions.
- Not a directive to build an ML model for lesson-retrieval.
  A plain-markdown, grep-able, human-readable lesson list
  IS the right tool. ML would add failure modes (hallucinated
  recommendations) that would undermine the discipline.
- Not a license to spend rounds exclusively on lesson-
  integration theatre. The point is to PREVENT live-lock;
  making the prevention itself live-lock the factory is the
  Goodhart failure mode.
- Not a guarantee the factory will out-perform humans on
  DORA metrics. It is the *mechanism* that might. Measurement
  follows ambition, not the other way.

## Composes with

- `memory/project_aaron_external_priority_stack_and_live_lock_smell_2026_04_23.md`
  (live-lock smell detection mechanism)
- `memory/feedback_verify_target_exists_before_deferring.md`
  (related: don't promise forward what cannot be verified —
  same discipline, different failure-mode axis)
- `memory/feedback_future_self_not_bound_by_past_decisions.md`
  (reconciles: lessons are durable but revisable; revise-with-
  reason is legitimate, ignore-the-lesson is not)
- `memory/feedback_capture_everything_including_failure_aspirational_honesty.md`
  (same spirit — the lesson must name the failure honestly
  to integrate forward)
- `docs/hygiene-history/live-lock-audit-history.md` (where
  live-lock lessons land)
- `docs/research/arc3-dora-benchmark.md` (the ARC-DORA
  cognitive-layer capability-signature soul-file — this
  memory gives it a concrete mechanism)
