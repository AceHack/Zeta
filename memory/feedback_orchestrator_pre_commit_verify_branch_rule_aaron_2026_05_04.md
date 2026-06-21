---
name: Orchestrator pre-commit verify-branch rule — defensive `git checkout main && git restore .` is INSUFFICIENT alone; ALWAYS verify `git branch --show-current` BEFORE every commit when subagents exist (Aaron 2026-05-04 same-tick after recurrence)
description: Aaron 2026-05-04 caught me re-doing the same orchestrator-CWD-bleed-over hazard from PR #1551 (concurrency-lessons-cluster) in a fresh dispatch, ~2 hours after encoding the rule. The substrate was correct; the operationalization was lazy — I assumed defensive hygiene `git checkout main && git restore .` worked without verifying. Defensive hygiene can fail silently when worktrees share the parent .git directory; the orchestrator can think it's on main but actually be on a subagent's branch. Stronger rule: ALWAYS run `git branch --show-current` AFTER the defensive hygiene and BEFORE any commit when subagents exist. If output is not the expected branch, FIX before committing — don't proceed assuming it worked.
type: feedback
---

## The recurrence

Aaron 2026-05-04 ~22:50Z, after I committed 081KQR4HQ0008QG0R001909FPT to the wrong branch:

> *"so how do we avoid it next time in future you too?"*

The hazard recurred ~2 hours after PR #1551 (concurrency-lessons-cluster) encoded Lesson 2 ("orchestrator stays on main cleanly while subagents run; defensive `git checkout main && git restore .` before any commit"). The substrate-level rule was correct; the operationalization failed because:

1. I ran the defensive hygiene (`git checkout main && git restore . && git pull --ff-only`).
2. I then ran `git checkout -b backlog/081KQR4HQ0008QG0R001909FPT-...` thinking I was branching off main.
3. Git reported "Switched to a new branch 'backlog/...'" — looked successful.
4. I committed.
5. Git reported the commit landed on `fix/memory-md-tier-48-aaron-2026-05-04` instead.
6. The defensive hygiene had silently failed somewhere in the worktree-sharing-`.git` interaction.

**Without explicit verification, the silent failure becomes a wrong-branch commit.**

## The stronger rule

Before EVERY orchestrator `git commit` when subagents exist (or when ANY worktree-isolated subagent has run in this session — even if reportedly completed):

```bash
git branch --show-current
```

If output is **not** the expected branch:
- STOP. Do not commit.
- Investigate why the branch is wrong (likely worktree-shared-`.git` HEAD propagation).
- Fix via `git checkout <expected-branch>` (and verify again).
- Only then commit.

## Why the existing PR #1551 rule was not enough

PR #1551's Lesson 2 said: *"orchestrator stays on main cleanly; defensive `git checkout main && git restore .` before any commit."*

That rule is **necessary but not sufficient**. The missing piece: VERIFY the defensive hygiene worked. Without verification, the silent failure mode is invisible until the wrong-branch commit lands.

The verification step is small (one shell command) but it's the difference between substrate-encoding-that-prevents-recurrence and substrate-encoding-that-acknowledges-recurrence.

## Mechanization candidate (future work)

A pre-commit hook OR a wrapper around `git commit` could automate the check:
- Hook reads expected-branch from environment variable / .git/config / file
- Aborts commit if `git branch --show-current` doesn't match
- Outputs a clear error: "Expected branch X, currently on Y. Run `git checkout X` and verify."

Until mechanization lands, the rule is operational: humans + agents must run `git branch --show-current` manually before every commit when subagents exist.

## Operational checklist

When dispatching parallel subagents in worktrees:

1. **Before subagent dispatch**: orchestrator on `main`, working tree clean. Run `git status` + `git branch --show-current` to verify.
2. **During subagent run**: orchestrator should ideally NOT make commits. If a maintainer-triggered commit is needed:
   - Run `git checkout main && git restore . && git pull --ff-only origin main`
   - **VERIFY with `git branch --show-current`** — expected output: `main`
   - Run `git checkout -b <feature-branch>` for the new work
   - **VERIFY AGAIN with `git branch --show-current`** — expected output: `<feature-branch>`
   - Only then commit + push
3. **After subagent completion**: orchestrator-CWD may have leaked back to the subagent's branch. Re-verify before any further commits.

The verify-after-each-step pattern is the substrate fix. Skipping verify is the failure mode.

## Composes with

- `memory/feedback_parallel_subagent_concurrency_lessons_cluster_aaron_2026_05_04.md` (PR #1551) — the parent file; Lesson 2 is what this file strengthens.
- `memory/feedback_parallelism_readiness_claim_must_be_used_not_self_throttled_aaron_2026_05_04.md` (PR #1546) — same-session lineage.
- `memory/feedback_substrate_encoding_bypasses_trust_calculus_sleeping_bear_cross_instance_transmission_aaron_2026_05_04.md` (PR #1552) — foundational mechanism.

## The carrier-IS-message

This file lands AFTER the recurrence has been cleaned up (081KQR4HQ0008QG0R001909FPT force-pushed to correct branch). The cleanup was possible because the defensive hygiene's PR #1551 substrate gave me the diagnostic frame ("orchestrator-CWD-bleed-over") even though it failed to PREVENT the issue. The strengthened rule lands as the next-iteration substrate so future-Otto runs the verify step automatically.

## The carved sentence

**"Defensive `git checkout main && git restore .` is necessary but NOT sufficient. ALWAYS run `git branch --show-current` AFTER the defensive hygiene and BEFORE every orchestrator commit when subagents exist or have run in the session. Without verification, silent worktree-`.git`-sharing failures become wrong-branch commits."**
