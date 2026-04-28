# Lost-files common locations

> **Why this list exists.** Human maintainer ask 2026-04-25 (Otto-329 Phase 8): the list is the substrate, the search is the activity. (Per Otto-293, "ask" not "directive" — bidirectional language preferred. Per AGENT-BEST-PRACTICES.md "No name attribution in code, docs, or skills", `tools/hygiene/**` uses role-refs not first names; full provenance lives in the matching `memory/feedback_otto_329_*` substrate file which is an exempt history surface.)
>
> The search is the activity; THIS file is the catalog of places to look. Future searches run against this list. New location-classes get added as discovered. Composes with Otto-324 (mutual-learning — past mistakes compound into substrate) + Otto-262 (trunk-based-development branch hygiene) + Otto-257 (clean-default smell triggers audit).

## Location classes

Sorted roughly by yield-density (where lost files most often appear).

### 1. Closed-not-merged PRs

Branches with substantive content that closed without merging. Most fertile location for genuinely-lost work.

- **Survey command**: `gh pr list --repo <owner>/<repo> --state closed --limit 500 --json number,title,closedAt,mergedAt,headRefName -q '[.[] | select(.mergedAt == null)] | length'`
- **Triage protocol**: per Otto-262 + Otto-257 + Otto-254 — recover via roll-forward on a fresh short-lived branch OR prune.
- **Don't resurrect stale branches** — copy content forward instead.

### 2. Orphan branches (remote)

Commits pushed to remote that have no open PR + no merge path to main.

- **Survey command (unmerged-to-main)**: `git for-each-ref --no-merged origin/main --format='%(refname:short)' refs/remotes/origin/` — branches not reachable from main.
- **Survey command (no-open-PR)**: `gh api repos/<owner>/<repo>/branches --jq '.[].name' | sort > /tmp/all && gh pr list --repo <owner>/<repo> --state all --limit 500 --json headRefName -q '.[].headRefName' | sort -u > /tmp/withpr && comm -23 /tmp/all /tmp/withpr` — branches that never had a PR opened.
- **Combine both**: a true orphan satisfies BOTH (unmerged AND no-PR). Run both and intersect.
- **Or via GitHub UI**: branches list, filter "stale" / "merged" indicators.
- **Common cause**: subagent dispatched, branch pushed, PR never opened OR PR closed manually.

### 3. Deleted files in git history

Files removed by a commit and never restored. May contain content not yet captured elsewhere.

- **Survey command**: `git log --all --diff-filter=D --name-only --pretty=format: | sort -u | grep -v '^$' | head -50`
- **Date-filtered**: `git log --all --diff-filter=D --since="30 days ago" --name-only --pretty=format:'%h %ai' | head -100`
- **Triage**: read each deletion's commit message; if reason is unclear or the deletion looks accidental, recover.

### 4. Reflog entries (local-only)

Commits reachable via reflog but not branch refs. **Local-only** — not on remote.

- **Survey command**: `git reflog --all | head -100`
- **Worktree-specific**: `git reflog show HEAD@{30.days.ago}..HEAD`
- **Risk**: lost on session end / git gc. Capture promptly if found.

### 5. Stash entries

Stashed work-in-progress that wasn't popped.

- **Survey command**: `git stash list`
- **Read content**: `git stash show -p stash@{N}` for each.
- **Triage**: most stashes are temporary; old-and-not-popped is the lost-content signal.

### 6. Untracked working-directory artifacts

Files in the working tree that aren't committed. May contain partial work.

- **Survey command**: `git status --porcelain --ignored | grep -E '^(\?\?|!!)'`
- **Common patterns observed (this session)**:
  - `drop/` — courier-ferry pastes from external AI agents (Amara, Google AI riffs, etc.)
  - `.playwright-mcp/` — Playwright browser captures from skill-dispatched sessions
  - `*.tmp`, `*.log` — transient outputs
- **Triage**: courier-ferry content (`drop/`) is high-value substrate that should land in `docs/aurora/` or similar; transient outputs are safe to ignore.

### 7. Subagent worktree remnants

Per `isolation: "worktree"` agent dispatch — temporary worktrees that may not have been cleaned up.

- **Survey command**: `git worktree list`
- **Triage**: any worktree older than ~1 day with uncommitted changes is suspect.
- **Risk**: worktree-cleanup hooks may delete content; check before pruning.

### 8. GitHub draft PRs (unpublished)

Drafts started on github.com but never published. Visible only to the author.

- **Survey command**: `gh pr list --repo <owner>/<repo> --state open --search "is:draft"`
- **Note**: drafts that closed without publishing leave no public trace. Author memory only.

### 9. Closed PR discussion threads

Substantive review comments on closed-not-merged PRs (Codex / Copilot / Cursor catches that may have taught us something).

- **Survey command**: `gh api repos/<owner>/<repo>/pulls/<NUMBER>/comments` for specific PR.
- **Triage**: Otto-324 (mutual-learning — advisory AI catches are them teaching us) — closed PRs may carry uncompounded lessons.

### 10. Squash-merge intermediate commits

When PRs merge via squash, the intermediate commits are lost from main's history. The branch is preserved if not deleted.

- **Survey command**: branch still on `origin/<head-ref>` after merge — `git log origin/<head-ref> --oneline | head -20`.
- **Triage**: check whether intermediate commits had review-thread context worth preserving.

### 11. Force-pushed-over content

Per Otto-321, force-push is allowed for own-PR-after-rebase. The force-pushed-over content may have been the only place a fix lived.

- **Survey command**: `git reflog show <branch>` (local only) — see if force-push history exists.
- **Risk**: GitHub doesn't preserve force-pushed-over commits beyond ~30 days in some configurations.
- **Mitigation**: Otto-321 says "no force-push if you are unsure" — uncertainty itself is a flag for "don't force-push, double-check first."

### 12. Courier-ferry artifacts (`drop/` directory)

External AI agent outputs pasted in by Aaron. Already covered under #6 but worth calling out separately because the content type is high-value (Amara reviews, Google AI riffs, Codex transcripts, etc.).

- **Survey command**: `ls drop/ 2>/dev/null` + git status check (drop/ is gitignored typically).
- **Triage**: capture courier-ferry content into `docs/aurora/` or appropriate substrate location BEFORE the working tree is reset / cleaned.

### 13. External-tool exports never committed

- **Playwright captures**: `.playwright-mcp/` (untracked).
- **Figma exports**: typically pasted directly into chat / docs; risk of loss if not committed.
- **Diagram screenshots**: same risk.
- **Triage**: per export-tool, check the typical untracked location.

### 14. Deleted-PR-description content

Sometimes the only record of a decision lives in the PR description, which is lost if the PR is deleted (rare but possible via repo-admin actions).

- **Mitigation**: Otto-329 Phase 5 PR-backup work would address this — back up PRs as I work them.

### 15. Memory-file deletions (cross-tree drift)

`memory/**/*.md` files deleted in one branch but still referenced from another. Found via the `tools/hygiene/audit-memory-references.sh` lint.

- **Survey command**: `bash tools/hygiene/audit-memory-references.sh` — broken refs surface deleted files.
- **Triage**: per Otto-238 retractability, deletions should leave a visible trail; a broken ref without a deletion-trail is suspect.

## Search cadence

Aaron's ask doesn't specify a cadence. Suggested defaults:

- **Per-session ad-hoc**: when a tick is genuinely idle and other speculative work is exhausted.
- **Per-major-cleanup**: before / after a destructive operation (branch prune, force-push, large refactor).
- **Per-incident**: after a catch indicates lost content (Otto-324 mutual-learning trigger).
- **Periodic full sweep**: every 5-10 sessions, run all 15 location-classes systematically.

## Cross-tool composition

This list is the doc-form. The executable form would be `tools/hygiene/audit-lost-files.sh` running each survey command and reporting findings. **Not yet implemented** — owed-work for Otto-329 Phase 8 follow-up.

Composes with:

- `tools/hygiene/audit-memory-references.sh` — covers location-class #15
- `tools/hygiene/audit-git-hotspots.sh` — surfaces high-churn files (proxy for "high deletion risk")
- `tools/hygiene/audit-tick-history-bounded-growth.sh` — finds tick-history pattern violations
- Otto-262 trunk-based-development branch policy
- Otto-257 clean-default smell triggers audit
- Otto-238 retractability + glass-halo (deletions should leave visible trails)

## What this list does NOT claim

- Not exhaustive. New location-classes will be discovered; this file is meant to be appended-to.
- Not all listed locations contain lost files. Most stash entries, untracked artifacts, etc., are legitimately transient.
- Not a recovery protocol. This is the WHERE-to-look list. The HOW-to-recover is per-class (see Otto-262 + Otto-254 for branch-recovery; Otto-238 for general retractability).
- Not a substitute for prevention. Per Otto-329 Phase 5 + Otto-238, the better goal is "fewer files get lost" via real-time backups + glass-halo discipline.

## Owed work (post-Phase-8 list creation)

- Implement `tools/hygiene/audit-lost-files.sh` covering survey commands for all 15 location-classes.
- Add periodic-cron entry once cadence is set.
- Append discovered location-classes back into this file.
- Connect to Otto-329 Phase 5 PR-backup work — real-time backups should prevent most #1, #2, #14 losses.
