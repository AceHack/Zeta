---
name: Stale-branch cleanup is git-surface factory responsibility — auto-delete (preventive) + cadenced audit (compensating), permanent pair
description: Aaron 2026-04-22 — branch cleanup is in the factory's git-surface duty; enable auto-delete-on-PR-merge/close AND keep a cadenced detector audit, because the preventive can regress (setting toggled, paths bypassing PR flow, speculative branches).
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-22:
*"oh part of the git surface for you is cleaning up stale
branches on our repo on a cadence, you could also add preventive
measures to stop them from showiing up i the first please, i
can you can make the PR close them automaticlly for instance but
still need he compesating action in case it regreses."*

**The directive breaks into three facts:**

1. **Git-surface ownership.** Stale-branch cleanup is part of
   the factory's git surface — not a one-off manual task, not
   someone-else's-problem, not optional ceremony.
2. **Preventive fix.** Stop stale branches from appearing in
   the first place. Easy preventive: GitHub's *Automatically
   delete head branches* setting (Settings → General → Pull
   Requests). When a PR merges or closes, its head branch is
   auto-deleted.
3. **Compensating action (permanent).** Even with the preventive
   in place, *"still need the compesating action in case it
   regreses"* — the preventive can decay:
   - Setting toggled off (by a new maintainer, by accident,
     during a settings audit).
   - Branches created via paths that bypass PR flow
     (e.g. `git push origin feature-x` without opening a PR).
   - The `round-NN-speculative` branches from
     `feedback_live_loop_detector_speculative_on_pr_branch.md`
     are intentionally kept, so the preventive must not blindly
     delete everything — the compensating detector knows which
     classes stay vs which go.

   Compensating detector shape:
   - Cadenced `git branch --merged main` audit (every-N-rounds
     or weekly). Remote branches merged into main whose PR is
     closed/merged → candidate for deletion.
   - Stale-age-days audit. Remote branches whose last commit is
     older than N days (start N=30) AND have no open PR → stale.
   - Local-worktree stale audit. Worktrees under
     `.claude/worktrees/` whose branch is merged or abandoned →
     candidate for `ExitWorktree action: "remove"` prompt.

   Whitelist preserved: `main`, release branches, opt-in
   preserved speculation branches. Auto-action only for
   whitelisted-out branches; report to Aaron for edge cases.

**This is a textbook instance of the discovered-class-outlives-
fix principle** (`memory/feedback_discovered_class_outlives_fix_anti_regression_detector_pair.md`).
Aaron explicitly paired preventive + compensating in the
directive — the pairing is now load-bearing in the factory's
git-surface hygiene, not just the live-loop class.

**How to apply:**

- Round 45 land:
  1. Toggle GitHub auto-delete-head-branches setting (one-time).
  2. Add new `docs/FACTORY-HYGIENE.md` row for cadenced stale-
     branch audit with schema
     `(date, actor, branches-audited, stale-found, action-
     taken, whitelist-exceptions)`.
  3. Create `tools/hygiene/prune-stale-branches.sh` — read-only
     by default; `--apply` flag deletes merged branches matching
     the criteria above.
- When a new branch creation pattern is added (e.g. the
  `round-NN-speculative` family), add the whitelist entry to
  `prune-stale-branches.sh` AND update the hygiene-row schema.
- The detector retires only when the branch-creation environment
  itself retires — not when the current stale count is zero.

**Why this matters (Aaron's "why"):**

The repo's branch list is an information surface. A cluttered
branch list hides real branches (open PRs, active work) behind
merged-and-forgotten debris. Over time this degrades
discoverability for every future contributor (human or agent).
The preventive keeps it clean; the detector keeps the preventive
honest.

**First application (this tick):**

- Hazard class captured in `docs/research/parallel-worktree-
  safety-2026-04-22.md` §2.4.
- BACKLOG P1 row added.
- Actual landing deferred to Round 45 per the cartographer
  staging plan (so the landing can be researched properly and
  paired with the auto-delete GitHub setting in a single
  coordinated change).

**Relation to worktrees:**

Worktrees create local branches (`pr32-markdownlint-fix`,
`round-44-speculative`, etc). Stale-worktree-branch is a
sub-class of stale-branch — same preventive+compensating
shape applies, just at the local/worktree scope instead of
remote-PR scope. Covered in research §2.4.

**Date:** 2026-04-22.
