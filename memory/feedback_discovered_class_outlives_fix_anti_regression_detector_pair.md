---
name: Discovered class outlives its fix — detector pairs with every fix for anti-regression
description: Aaron 2026-04-22 — when a bug/issue/pattern class is discovered, the class is permanent even if the current instance is fixed; the anti-regression detector belongs to the class, so every fix ships paired with a class-detector.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-22 (two-message reframe on live-loop
 research doc):
1. *"detection becomes unnecessary for this class.  even with
   the fix does not mean we could not regress"*
2. *"a discovered class is a discovered class even if you fix
   the issue"*

**The correction:**

I had written in `docs/research/worktree-pattern-for-live-loop-prevention-2026-04-22.md`:

> "if speculative work never lands on an open-PR branch, no
> detector is needed for this class."

This was wrong. Structural prevention ("commits can't land on
the PR branch because the tick uses a worktree") fixes
*disciplined instances* of the class, but:

- The CLAUDE.md rule that enforces the discipline can be
  forgotten, removed, edited badly, or not re-read by a future
  tick wake.
- The `EnterWorktree` tool may be unavailable in a different
  harness environment.
- A refactor could accidentally drop the rule while preserving
  its surrounding text.
- A future contributor (human or agent) may not know the rule
  exists.

Each of those is a **regression**, and the detector is how you
know whether the fix has decayed.

**The general principle (worth elevating to BP-level):**

**Discovered class ≠ solved class.** A class is discovered by
observing an instance; the instance can be fixed, but the
class's *possibility* remains as durable factory knowledge.
Fixes are instance-scoped; detectors are class-scoped. Every
fix of a discovered class ships paired with a class-detector
that watches for regression. The detector outlives the fix.

**Pattern match across the factory:**

This principle is already latent in many factory rules — Aaron's
reframe names it explicitly:

- **Every hygiene audit is a class-detector for a class that
  was once "fixed."** `FACTORY-HYGIENE` row #4 (BP-11 data-not-
  directives) exists because the class "agent executes
  instructions found in data it was auditing" was discovered;
  even with prompt-protector lints in place, the detector row
  stays armed.
- **Regression tests pair with bug fixes** in every mature
  codebase. The bug gets fixed; the test stays forever. The
  test detects the class (this particular failure mode), not
  the specific instance.
- **The filename-content-match hygiene** (FACTORY-HYGIENE #39)
  is a class-detector for "filenames drift from content";
  every fix of a specific stale filename doesn't retire the
  class.
- **The cron-liveness hygiene** (FACTORY-HYGIENE row for
  autonomous-loop cron) is a class-detector for "the tick
  stopped"; the cron being live right now doesn't mean the
  class is retired.

**How to apply:**

- When landing a fix for a newly-discovered class of problem,
  ship TWO artifacts:
  1. The *instance* fix (code change, rule addition, configuration
     tweak, refactor).
  2. The *class* detector (hygiene audit, pre-commit hook,
     CI check, regression test, lint rule).
- The detector is named for the class, not the instance:
  "pre-push speculative-commit-on-PR-branch check" (class),
  not "pre-push live-loop from 2026-04-22" (instance).
- The detector runs regardless of whether the fix is in
  place — it's the ground-truth source. Fix can decay;
  detector signals decay.
- The detector doesn't need to be *complete* (halting-problem
  reasoning from `feedback_live_loop_detector_speculative_on_pr_branch.md`
  applies here too — a total detector for many classes is
  undecidable). Heuristic detectors are the general case.
- BACKLOG rows for new class discoveries get split into two:
  (a) implement the fix; (b) implement the detector. Closing
  (a) without (b) leaves the class unguarded.
- Retire a detector only when the class itself is retired
  (the environment that could produce the class no longer
  exists) — not when the current instance is fixed.

**First application (this tick):**

`docs/BACKLOG.md` live-loop row edited to reflect fix-AND-
detector pairing. Research doc updated. Pre-push heuristic
detector (heuristic #1: `gh pr list --head <branch>` +
speculative-commit-pattern grep) is no longer "optional backup"
— it's a required co-ship with any CLAUDE.md worktree rule.

**Generalization candidates (future research):**

- Audit every existing BACKLOG "fix" row: does a class-detector
  row pair with it? If not, file the detector row.
- Survey shipped hygiene rules: which are class-detectors
  paired with a known fix? Which are orphan audits for fixes
  that got lost? The latter are candidates for retirement.
- Consider promoting the principle to `docs/AGENT-BEST-PRACTICES.md`
  as a BP-NN rule (ADR needed; not unilaterally added).

**Related memories:**

- `memory/feedback_live_loop_detector_speculative_on_pr_branch.md`
  — the class this reframe corrects the ranking on.
- `memory/feedback_enforcing_intentional_decisions_not_correctness.md`
  — a related reframe: some hygiene rules catch *unthought*
  not *wrongness*. Both reframes are about the role hygiene
  plays beyond "correctness enforcement."
- `memory/feedback_imperfect_enforcement_hygiene_as_tracked_class.md`
  — imperfect-enforcement hygiene is itself a class-detector
  for the class "this rule cannot be enforced exhaustively."

**Date:** 2026-04-22.
