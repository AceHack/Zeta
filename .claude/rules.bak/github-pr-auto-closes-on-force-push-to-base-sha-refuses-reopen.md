# GitHub auto-closes a PR when its head ref's SHA matches the base ref's SHA AND refuses to reopen — even after the head is restored

Carved sentence:

> Squashing a PR's branch via force-push must NEVER land the branch
> ON the base ref's SHA, even briefly. GitHub treats "head ref ==
> base ref" as "PR has no changes" and auto-closes the PR
> irreversibly — the `reopenPullRequest` GraphQL mutation refuses
> the reopen even after the head ref is force-pushed BACK to a
> diff-having SHA. Cherry-pick onto a fresh branch + open a new PR
> instead of squash-by-force-push when the squash would briefly
> equal the base.

## Operational content

The trap shape:

1. PR branch has N commits diverged from base (main)
2. You decide to squash them into 1 commit
3. You create a worktree on `origin/main`, apply the cumulative diff, commit
4. You force-push the new commit to the branch
5. **Mistake**: the rev-parse-HEAD captures `origin/main`'s SHA (not your new commit) — either because the commit step silently failed OR you sourced the wrong SHA OR the worktree state moved
6. You push that base-SHA to the branch
7. GitHub sees "branch head == base head" → "PR has no changes" → **auto-closes the PR**
8. You realize the mistake + restore the branch to its prior SHA (cumulative diff intact)
9. You try `gh pr reopen <N>` → GraphQL returns: `Could not open the pull request. (reopenPullRequest)`
10. The PR is irreversibly closed; only path forward is a new PR on a new branch

The PR record stays + carries its thread history + comments, but it cannot be the active PR for the substrate anymore. The new PR must be opened on a new branch (GitHub also refuses to reuse the original branch name for a new PR if the old PR's branch name is still "associated" with the closed PR).

## Why GitHub does this

GitHub's PR model treats "no diff" as a terminal state — a PR exists to track a diff; no diff = no PR to track. This is correct in the common case (squash-merge from main; branch deleted afterward). It's the EDGE case that bites: a force-push that BRIEFLY produces no-diff is treated as terminal even though the force-push was a mistake + the diff is restorable.

The `reopenPullRequest` mutation has the same restriction: GitHub doesn't re-evaluate "is this still a valid PR" on reopen attempt; it just refuses if the PR was closed-via-no-diff transition.

## What to do INSTEAD

### Pattern A — Cherry-pick onto fresh branch (recommended)

When you need to squash a PR's branch:

```bash
# 1. Create fresh worktree on main (NOT on the PR branch)
git worktree add /tmp/squash-prep origin/main

# 2. Copy cumulative-diff files in (or use git cherry-pick + reset)
# ... apply your changes ...
# ... regen any auto-generated files like BACKLOG.md, MEMORY.md ...

# 3. Commit + VERIFY HEAD moved
cd /tmp/squash-prep
git -c user.email=... -c user.name=... commit -m "..."
git rev-parse HEAD              # NEW SHA, NOT main's SHA
git log --oneline -2            # Verify your commit is on top

# 4. Push to a NEW branch + open NEW PR
git push origin HEAD:refs/heads/<new-branch-name>
gh pr create --base main --head <new-branch-name> --title "..." --body "..."

# 5. Close the OLD PR with a substrate-honest comment cross-linking the new PR
gh pr close <old-PR> --comment "Closing — squashed to clean history; carried over to #<new-PR>."
```

This pattern avoids the trap entirely because the old PR's branch is never modified.

### Pattern B — Verify HEAD moved BEFORE pushing (if you must use the existing branch)

If you have to keep the existing branch (e.g., to preserve in-PR review-thread history):

```bash
# After the commit:
HEAD_BEFORE=$(git rev-parse origin/main)
HEAD_AFTER=$(git rev-parse HEAD)
if [ "$HEAD_BEFORE" = "$HEAD_AFTER" ]; then
  echo "FATAL: commit didn't move HEAD; would push base SHA to PR branch + auto-close it"
  exit 1
fi

# Only NOW push:
git push origin HEAD:refs/heads/<pr-branch> --force-with-lease
```

The pre-push check catches the silent-commit-failure case. Without it, the push lands the base SHA + GitHub auto-closes.

## Pattern C — `--force-with-lease` is Aaron-authorized + safe in itself

Per Aaron 2026-05-25: *"force least is always fine i never look at it is destructive"* — `--force-with-lease` is the safe form of force-push (refuses if the remote SHA isn't what you expected, which catches concurrent pushes from peer agents). Aaron explicitly authorized it.

The classifier wrongly blocked `--force-with-lease` as destructive in one session; clarification: Aaron's standing authorization covers `--force-with-lease`. Plain `--force` (without `-with-lease`) remains discretionary + needs explicit per-use authorization.

The pattern A + B traps above are NOT about force-push being destructive; they're about the SPECIFIC failure mode of pushing a base SHA to a PR branch.

## Composes with other rules

- `.claude/rules/zeta-expected-branch.md` — branch-state verification before destructive git operations
- `.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md` — sibling failure mode (commit-tree corruption; this rule is the PR-state corruption shape)
- `.claude/rules/refresh-before-decide.md` — verify-state-before-action discipline; HEAD verification before force-push
- `.claude/rules/blocked-green-ci-investigate-threads.md` — failure-mode investigation discipline
- `.claude/rules/claim-acquire-before-worktree-work.md` — worktree creation + management hygiene
- `.claude/rules/honor-those-that-came-before.md` — old PR's thread history matters; pattern A's cross-link preserves it

## Composes with substrate

- B-0746 (the backlog row that ships this rule + lessons-learned)
- PR #4997 (the original PR that hit this trap on 2026-05-25; force-pushed to no-diff state + auto-closed + refused reopen; substrate carried over to PR #5010)
- Empirical anchor 2026-05-25 session: ServiceTitan has also hit this trap per Aaron (*"it's bit us too at ServiceTitan"*)

## Empirical anchor

2026-05-25 Otto-VSCode + Aaron session, after B-0737 zflash code shipped on PR #4997:

- 7 Copilot+Codex review threads needed addressing
- Decision: squash the 4-commit branch into 1 fix-and-feature commit
- Created worktree on `origin/main` at `/private/tmp/zeta-4997-clean-rebase/`
- Applied cumulative diff (copied 3 TS files + B-0737 row from the previous fix-worktree)
- Ran `git commit` — the tail-3 output captured the HEREDOC closing but not the actual commit confirmation
- `git rev-parse HEAD` returned `origin/main`'s SHA — the commit had failed silently OR the rev-parse was reading wrong state
- Pushed that SHA via `--force-with-lease` — succeeded; remote branch went from prior tip to origin/main's SHA
- GitHub auto-closed PR #4997 (head == base)
- Attempted `gh pr reopen 4997` → GraphQL refused
- Restored branch via `git push origin <prior-SHA>:refs/heads/<branch> --force-with-lease` — branch state restored
- `gh pr reopen 4997` STILL refused — the close was irreversible at GitHub's state machine
- Substrate carried over to fresh branch + fresh PR (#5010); old PR commented with cross-link

Aaron 2026-05-25 substrate-honest naming: *"save that lesson it's not obvious even to human devs it's bit us too at ServiceTitan"* — the lesson is industry-wide, not Zeta-specific. Worth landing as load-bearing rule so future-Otto + future-AI + (transitively) future-human-collaborators inherit the discipline at cold-boot.

## What this rule is NOT

- NOT a ban on force-push (per Aaron's authorization; `--force-with-lease` is fine)
- NOT a ban on squash workflows (squash is fine; just use pattern A)
- NOT specific to Zeta (GitHub's behavior; affects any repo on GitHub)
- NOT a critique of GitHub's design choice (the no-diff = no-PR semantic is reasonable in the common case; the trap is in the edge case)

## Full reasoning

PR #4997 → squash attempt → no-diff push → GitHub auto-close → reopen refused → recovery via PR #5010 (fresh branch + fresh PR). Empirical anchor preserved in this rule's body + PR #5010 commit message + the original B-0737 substrate trajectory.
