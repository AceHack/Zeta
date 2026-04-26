---
name: Live-loop detector for speculative-work-on-open-PR-branch — aspirational per halting problem
description: Aaron 2026-04-22 — speculative tick work on the same branch as an open PR creates a CI-rebuild live-loop; a total detector is undecidable (halting problem), but cheap syntactic heuristics catch the common case.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-22 (three-message burst):
1. *"why are yo udoing speculative work?"*
2. *"oh was it just running, you might be stuck in a live loop
   if you keep doing speculative work when the build is running
   you are going to kick off the build again when you push if
   you are going speculative work while the PR is building that
   should probably be done on anohter branch. You could use
   worktrees if that helps IDK, I know there is a command line
   switch for it so maybe yo ushould resrch you might not be
   able to do it right with that switch. But whatever helps."*
3. *"we need a live loop detector, it's aspirational not
   guarneteed, if you can make it guarneteed you proved kurt
   godel wrong, and solved the halting problem lol"*

**The live-loop I was in (or one push away from):**

- PR #32's head branch is `round-42-speculative`.
- Post-goodnight `<<autonomous-loop>>` ticks defaulted me to
  "never-idle" speculative factory hygiene — cross-platform
  parity audit, mini-ADR pattern, Q3 exception refinement,
  crystallization turns, imperfect-enforcement hygiene, GHA
  Semgrep rule, residual-gap scan, ThoughtWorks harvest row,
  etc. 74 unpushed commits accumulated on `round-42-speculative`.
- Every one of those would have hit PR #32's CI on push. PR #32
  was already BEHIND main with a failing `lint (markdownlint)`
  check — each subsequent push would re-trigger ~10 CI jobs
  against an unrelated set of commits.
- The live-loop shape: tick fires → do speculative factory work
  → push → PR CI rebuilds → tick fires mid-build → do more
  speculative work → push → rebuild over the rebuild.

**Why this violates "never-idle":**

The never-idle rule ranks work as *known-gap → generative
factory → gap-of-gap*. **Open PRs with failing checks are
known-gap** — they outrank all speculative factory hygiene. I
missed that PR #32 existed and was failing when I defaulted to
generative work. First fix is priority-order discipline at
tick-wake: `gh pr list` before any speculative branch goes hot.

**Halting-problem acknowledgement:**

Aaron's gag lands because a *total* live-loop detector — one
that decides for any agent process whether it is in a live loop
— is equivalent to the halting problem, which Turing proved
undecidable (1936) using Gödel's incompleteness result (1931).
By Rice's theorem, no algorithm decides any non-trivial
semantic property of programs. So we can't guarantee detection;
we can only build heuristics that catch the *shapes* we
actually encounter.

**Heuristics worth building (aspirational detectors):**

Ordered by specificity / easiness-to-build:

1. **Speculative-on-PR-head** (trivial): before `git push`,
   check if the current branch is the head of an open PR
   (`gh pr list --head "$(git branch --show-current)"`). If yes,
   AND the commits to push look like factory hygiene (commit
   message pattern `Round NN:` + paths in `docs/hygiene-*/`,
   `tools/hygiene/`, `memory/`), warn. This catches the case I
   fell into in ~5 lines of bash.
2. **Branch-ownership registry**: declare which branches are
   "spec-safe" (open PRs, scope-locked) vs. "hygiene-safe"
   (speculative, meant to accumulate tick work). Push-time hook
   refuses to mix.
3. **Same-files-repeatedly-touched**: across the last N ticks,
   if >M commits all modify the same <K files, flag
   "generative local minimum — consider a different topic or
   escalate to Aaron."
4. **CI-cost tracker**: count push → PR-rebuild chains per
   session; flag when one PR has been re-pushed >3× without
   being marked ready.
5. **Worktree-default pattern**: structural prevention beats
   detection — do speculative work in `git worktree add
   ../Zeta-speculative round-NN-speculative` so the main repo
   stays on the PR branch and `git push` from the main repo
   can only target that branch.

All are false-negative by design (can't catch exotic live
loops), but catch 80%+ of what a disciplined factory would
otherwise drift into.

**Structural fix beats detector fix:**

The cleanest solution is to **never do speculative work on a
branch that is already an open PR's head**. If that rule is
followed, the live-loop precondition doesn't exist and no
detector is needed for this class. Action:
- Autonomous-loop speculative work goes on `round-NN-speculative`
  where `NN` is the *current round*, not whatever PR happens
  to be open.
- Per-tick wake checklist adds: *current branch is an open PR's
  head? → checkout a new branch before any commits.*

**Worktree path (Aaron's suggestion):**

`git worktree add <path> <branch>` creates a second working
directory backed by the same `.git/`. Each worktree can be on a
different branch; `git push` from a worktree only pushes that
worktree's branch. Claude Code's `Agent` tool accepts
`isolation: "worktree"` which creates a temp worktree for a
subagent run and cleans up on exit. Research queued in BACKLOG
— the main-agent-worktree pattern is not documented as a
first-class Claude Code feature; the Agent-tool isolation mode
is the documented surface.

**How to apply:**

- Before any tick does its first `git commit` on speculative
  work: check `gh pr list --head "$(git branch --show-current)"`.
  If the current branch has an open PR, checkout a fresh
  `round-NN-speculative` before committing.
- Before any `git push` on a branch with an open PR: verify the
  commits to push match the PR's scope. If commits are factory
  hygiene while PR is about something else, stop and either
  (a) move the commits to a different branch or (b) split the
  PR scope explicitly.
- **Structural ≥ behavioural:** the worktree-default pattern
  makes this invariant impossible to violate by construction.
  Prefer it once the worktree command-line switch is researched.

**BACKLOG queued:**
- Live-loop heuristic detector (heuristics #1-#4 above,
  aspirational, halting-problem-acknowledged).
- Worktree-default research + pilot (heuristic #5, structural).
- Branch-ownership registry (ADR candidate).

**Related memories:**
- `memory/feedback_never_idle_speculative_work_over_waiting.md`
  — the rule I applied too eagerly. Needs amendment:
  "known-gap includes open PRs with failing checks; verify
  `gh pr list` before defaulting to generative work."
- `memory/feedback_tick_must_never_ever_stop_schedule_before_finishing.md`
  — the cron discipline that drove the tick-cadence that
  accumulated the 74 commits. Not in conflict; this memory
  refines the *what-to-do-during-the-tick* side of that
  discipline.
- `memory/feedback_fix_factory_when_blocked_post_hoc_notify.md`
  — "additive not destructive" still applies; the fix here
  is to add a new branch, not reset the existing one without
  Aaron's explicit OK.

**Date:** 2026-04-22.
