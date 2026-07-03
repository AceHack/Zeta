---
pr_number: 3894
title: "backlog(081KRQ1AB0008QG0R001KQ9S4B): worktree-pool primitive \u2014 re-land of #3817 (BACKLOG.md conflict bypassed)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T14:31:54Z"
merged_at: "2026-05-16T15:14:51Z"
closed_at: "2026-05-16T15:14:51Z"
head_ref: "otto-cli-b0558-reland-2026-05-16-1422z"
base_ref: "main"
archived_at: "2026-05-16T16:20:01Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3894: backlog(081KRQ1AB0008QG0R001KQ9S4B): worktree-pool primitive — re-land of #3817 (BACKLOG.md conflict bypassed)

## PR description

Re-lands the substantive content from [PR #3817](https://github.com/Lucent-Financial-Group/Zeta/pull/3817) (DIRTY/CONFLICTING on \`docs/BACKLOG.md\` since 07:57Z; armed-but-unmergeable for hours). Server-side \`gh pr update-branch --rebase\` failed repeatedly; this PR cherry-picks the substrate onto a fresh branch off current main and re-applies the BACKLOG.md insertion manually.

## Substrate

### \`docs/backlog/P3/081KRQ1AB0008QG0R001KQ9S4B-worktree-pool-primitive-per-otto-identity-2026-05-16.md\` (new, 102 lines)

Worktree-pool primitive — addresses **sub-case 4 (pruned-sidetick race)** of [\`.claude/rules/claim-acquire-before-worktree-work.md\`](.claude/rules/claim-acquire-before-worktree-work.md)'s borrow-on-existing pattern. Composes with 081KRHWGX0008QG0R002DPG02X, 081KRHWGX0008QG0R001HMWM1W, 081KRMEXM0008QG0R000X1PPGC.

Empirical anchors (from row body):

- Shard PR #3808 (\`docs/hygiene-history/ticks/2026/05/16/0715Z.md\`) — 4-tick-arc evidence
- Rule PR #3812 — operationalizes sub-cases 1+2; flags 3+4 as substrate-engineer work

### \`docs/BACKLOG.md\` (+1 line)

Adds the 081KRQ1AB0008QG0R001KQ9S4B entry after 081KRQ1AB0008QG0R003DYANMC (which is now \`[x]\` on main — that's the change that drifted from #3817's tree).

## Why not just rebase #3817

Tried at 13:31Z (\`gh pr update-branch --rebase 3817\` → \`X Cannot update PR branch due to conflicts\`) and again at 14:21Z (same result). Local rebase + force-push would work but is risky under multi-Otto contention (3-4 Lior procs + parallel Otto-CLI sessions doing \`git switch\` on the shared worktree). Re-land on fresh branch is the lower-risk path; content is identical.

## Cleanup

#3817 will be closed with a cross-link to this PR once this lands.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T14:35:23Z)

## Pull request overview

Re-lands backlog item **081KRQ1AB0008QG0R001KQ9S4B** documenting a proposed “worktree-pool” primitive (pre-allocated sideticks per Otto identity) and adds it to the generated backlog index, to address the pruned-sidetick race (sub-case 4) described in prior operational substrate.

**Changes:**

- Added new backlog row file **081KRQ1AB0008QG0R001KQ9S4B** under `docs/backlog/P3/` describing the problem, proposed design, and acceptance criteria.
- Updated `docs/BACKLOG.md` to include the new 081KRQ1AB0008QG0R001KQ9S4B index entry.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 6 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P3/081KRQ1AB0008QG0R001KQ9S4B-worktree-pool-primitive-per-otto-identity-2026-05-16.md | New P3 backlog row specifying the worktree-pool primitive design + acceptance criteria. |
| docs/BACKLOG.md | Adds the 081KRQ1AB0008QG0R001KQ9S4B row to the backlog index list. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T15:15:36Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.

## Review threads

### Thread 1: docs/backlog/P3/081KRQ1AB0008QG0R001KQ9S4B-worktree-pool-primitive-per-otto-identity-2026-05-16.md:12 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T14:35:22Z):

Frontmatter is missing required `last_updated` (tools/backlog/README.md marks it required and updated on every content edit). Add `last_updated: 2026-05-16` (and keep it updated on future edits) to match the backlog row schema.

### Thread 2: docs/backlog/P3/081KRQ1AB0008QG0R001KQ9S4B-worktree-pool-primitive-per-otto-identity-2026-05-16.md:12 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T14:35:22Z):

`type: feat` is inconsistent with the existing backlog-row convention (`type: feature` across other rows). Align this field to the established value to avoid schema drift.

### Thread 3: docs/backlog/P3/081KRQ1AB0008QG0R001KQ9S4B-worktree-pool-primitive-per-otto-identity-2026-05-16.md:29 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T14:35:22Z):

The cited tick-shard path `docs/hygiene-history/ticks/2026/05/16/0715Z.md` does not exist in-tree (there is no 0715Z.md under that date). Update the reference to the correct shard filename/path for PR #3808 (or link directly to the shard file that exists).

### Thread 4: docs/backlog/P3/081KRQ1AB0008QG0R001KQ9S4B-worktree-pool-primitive-per-otto-identity-2026-05-16.md:55 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T14:35:23Z):

`git -C <path> fetch + reset --hard origin/main` is not a valid git invocation as written. Consider documenting this as two explicit commands (fetch, then reset --hard) or a correct single-command equivalent so readers can copy/paste safely.

### Thread 5: docs/backlog/P3/081KRQ1AB0008QG0R001KQ9S4B-worktree-pool-primitive-per-otto-identity-2026-05-16.md:68 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T14:35:23Z):

In the 'Composes with' list, `081KRHWGX0008QG0R002DPG02X` is the only referenced row not linked, while the surrounding entries are links. Link it to the existing row file (`081KRHWGX0008QG0R002DPG02X-stale-worktree-prune-cadence-mechanization-2026-05-14.md`) for consistent navigation.

### Thread 6: docs/BACKLOG.md:685 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T14:35:23Z):

`docs/BACKLOG.md` is documented as a generated file (“DO NOT EDIT” per tools/backlog/README.md). To avoid drift, regenerate the index via `tools/backlog/generate-index.sh` and commit the resulting output (ensuring this new entry is produced by the generator).

### Thread 7: docs/backlog/P3/081KRQ1AB0008QG0R001KQ9S4B-worktree-pool-primitive-per-otto-identity-2026-05-16.md:32 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T15:15:35Z):

The Origin paragraph says the session "took 4 commit attempts to ship a tick shard", but later the Empirical anchors note says the shard "never landed on `origin/main`". This reads as internally contradictory (shipped vs never landed). Consider rewording the Origin sentence to avoid implying the shard merged (e.g., "to produce/attempt to land a tick-shard PR" or similar).
