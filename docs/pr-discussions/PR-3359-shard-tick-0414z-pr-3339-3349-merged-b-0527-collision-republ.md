---
pr_number: 3359
title: "shard(tick): 0414Z \u2014 PR #3339/#3349 merged + 081KRHWGX0008QG0R0015EE8VE collision republished + new worktree-pruning-race failure mode"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-15T04:57:03Z"
merged_at: "2026-05-15T05:13:21Z"
closed_at: "2026-05-15T05:13:21Z"
head_ref: "shard/tick-0414z-otto-cli-2026-05-15"
base_ref: "main"
archived_at: "2026-05-22T23:09:30Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3359: shard(tick): 0414Z — PR #3339/#3349 merged + 081KRHWGX0008QG0R0015EE8VE collision republished + new worktree-pruning-race failure mode

## PR description

## Summary

- PRs #3339 + #3349 from prior 0230Z tick MERGED to `origin/main`
- 081KRHWGX0008QG0R0015EE8VE dual-allocation collision STILL LIVE between [#3323](https://github.com/Lucent-Financial-Group/Zeta/pull/3323) and [#3315](https://github.com/Lucent-Financial-Group/Zeta/pull/3315); shadow-catch advisory republished as bus envelope `d2b7fc2f-43a6-4853-997b-cbd6d359a504`
- Bus hygiene: 4 expired envelopes cleaned
- **NEW FAILURE MODE**: aggressive worktree-pruning race targets new Otto-CLI worktrees. Five attempts (incl. one with `git worktree add --lock --reason "..."`) all got `rm -rf`'d mid-tick. Pattern documented on bus as envelope `44aaf799-8bf1-41f5-b3d0-28e9f37e3b33`
- **Recovery technique**: borrowed the age-exempt sibling worktree `/private/tmp/zeta-otto-cli-0027z-sidetick` (~4.5h old) via branch-switch to land this shard. Pattern proposed for inclusion in `.claude/rules/claim-acquire-before-worktree-work.md`

## Test plan

- [x] `dotnet build -c Release` — N/A (docs-only shard)
- [x] Branch-guard verified (`shard/tick-0414z-otto-cli-2026-05-15`)
- [x] Trailer matches commit-message-shape skill (`Co-Authored-By: Claude <noreply@anthropic.com>`)
- [ ] CI required checks pass on PR
- [ ] Auto-merge fires after CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-15T05:00:02Z)

## Pull request overview

Adds a new hygiene-history tick shard (0414Z) documenting the latest cron tick state: prior PR merges, the still-live 081KRHWGX0008QG0R0015EE8VE dual-allocation collision advisory republish, bus cleanup, and a newly observed worktree-pruning race plus the recovery technique used to land the shard.

**Changes:**

- Record merges of PR #3339 and PR #3349 onto `origin/main`.
- Document ongoing 081KRHWGX0008QG0R0015EE8VE dual-allocation collision status and shadow-catch advisory republish.
- Capture a new operational failure mode (worktree-pruning race) and the recovery/workaround procedure used.

### COMMENTED — @chatgpt-codex-connector (2026-05-15T05:03:48Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `6e39653f0d`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-15T05:04:55Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**docs/hygiene-history/ticks/2026/05/15/0414Z.md:72**

* Step 2’s parenthetical “untracked file … survives the switch” reads as unconditional. In Git, branch switches can be blocked if they would overwrite an untracked path that becomes tracked on the target branch. Suggest clarifying the precondition (no path collisions) or recommending a safer practice (`git stash -u`, moving the file aside) before switching.
```
1. `cd` into the sibling worktree, save original branch name
2. `git switch shard/tick-0414z-otto-cli-2026-05-15` (untracked file on original branch survives the switch)
3. `git pull --ff-only origin main` to catch up to current tip
```
</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-15T05:16:03Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.


<details>
<summary>Comments suppressed due to low confidence (3)</summary>

**docs/hygiene-history/ticks/2026/05/15/0414Z.md:66**

* P1: Broken xref for `.claude/rules/claim-acquire-before-worktree-work.md` (and same prefix elsewhere). `../../../../../.claude/...` points at `docs/.claude/...` which isn’t in the repo; it should climb one more level to repo root from this shard’s directory.
```
**Next-tick action item**: if recurs, file a B-NNNN row, run `lsof` / `fs_usage` / launchd-list to identify the rm-rf source, propose rule update to [`.claude/rules/claim-acquire-before-worktree-work.md`](../../../../../.claude/rules/claim-acquire-before-worktree-work.md).

### Worktree contamination persists

Primary worktree (`/Users/acehack/Documents/src/repos/Zeta`) is STILL on detached HEAD `65c7865` from Lior's rebase at 0230Z. HEAD didn't move in ~2h. The `.git/rebase-merge/` directory dates from `May 14 20:36` (~8h ago, before 0230Z tick) — Lior's rebase has been inactive for 8+ hours and is effectively abandoned. Per [`.claude/rules/claim-acquire-before-worktree-work.md`](../../../../../.claude/rules/claim-acquire-before-worktree-work.md) worktree force-remove guard, Otto-CLI did NOT force-remove or take over the rebase.
```
**docs/hygiene-history/ticks/2026/05/15/0414Z.md:81**

* P1: This link uses `../../../../../.claude/...`, which resolves to `docs/.claude/...` (nonexistent) from this file location. Adjust the relative path so it points at the repo-root `.claude/rules/...` file.
```
The pattern composes with [`.claude/rules/claim-acquire-before-worktree-work.md`](../../../../../.claude/rules/claim-acquire-before-worktree-work.md) worktree-force-remove guard: instead of force-removing a contaminated worktree, BORROW a friendly sibling. Adds an entry in the existing rule's "How to apply" matrix.
```
**docs/hygiene-history/ticks/2026/05/15/0414Z.md:111**

* P1: Same broken relative link prefix here (`../../../../../.claude/...` points under `docs/` instead of repo root). Fixing this will prevent future readers from hitting a dead link when following the rule reference.
```
5. If pattern recurs, propose `--lock` is insufficient and adopt the recovery-worktree-borrowing pattern as canonical (rule update to [`.claude/rules/claim-acquire-before-worktree-work.md`](../../../../../.claude/rules/claim-acquire-before-worktree-work.md))
```
</details>

### COMMENTED — @AceHack (2026-05-15T05:46:30Z)

Drift detected (Lior Antigravity Check): Narration-over-action and metadata churn. This PR introduces extensive commentary on 'NEW FAILURE MODE' and 'Bus hygiene' without substantive, atomic code parity proofs. Please decompose into actionable code changes and avoid mixing background service meta-commentary into branch state.

## Review threads

### Thread 1: docs/hygiene-history/ticks/2026/05/15/0414Z.md:34 (resolved)

**@copilot-pull-request-reviewer** (2026-05-15T05:00:01Z):

Nit: these references use bare filenames in backticks (e.g., `claim-acquire-before-worktree-work.md`, `holding-without-named-dependency-is-standing-by-failure.md`). In nearby tick shards these are typically linked with the full `.claude/rules/...` path, which makes the reference unambiguous and directly navigable from the rendered markdown. Consider switching these to links (or at least spelling the full path).

### Thread 2: docs/hygiene-history/ticks/2026/05/15/0414Z.md:3 (resolved)

**@chatgpt-codex-connector** (2026-05-15T05:03:48Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Start new tick shards with required schema row**

The tick-shard validator expects the first non-empty line to be a 6-column pipe row with an ISO timestamp (`tools/hygiene/check-tick-history-shard-schema.ts` checks `pipeCount` and `COL1_RE`), but this new shard starts with an H1 heading instead. That makes the shard non-parseable by the schema tooling and the same issue is repeated in `docs/hygiene-history/ticks/2026/05/15/0458Z.md`, so downstream collation/validation of tick history will break until both files are reformatted.

Useful? React with 👍 / 👎.

### Thread 3: docs/hygiene-history/ticks/2026/05/15/0414Z.md:56 (resolved)

**@copilot-pull-request-reviewer** (2026-05-15T05:04:55Z):

The note that untracked files “survive the switch” is not guaranteed: `git switch` will refuse (or require `-f`) if the target branch has a tracked file at the same path, and untracked files can also be accidentally included later via `git add -A`. Consider adding a short caveat (e.g., “unless the target branch tracks the same path; stash/move untracked files first”) to avoid this operational guidance causing data loss/confusion.

This issue also appears on line 70 of the same file.

### Thread 4: docs/hygiene-history/ticks/2026/05/15/0458Z.md:9 (resolved)

**@copilot-pull-request-reviewer** (2026-05-15T05:04:55Z):

“Untracked … file preserved across both switches” is a true outcome for this run, but as written it can read like a general guarantee. Git will block a switch if an untracked file would be overwritten by a tracked file on the target branch. Consider adding a brief caveat (or recommending `git stash -u` / moving the file) so this operational pattern is safe when repeated.

### Thread 5: docs/hygiene-history/ticks/2026/05/15/0414Z.md:36 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-15T05:16:03Z):

P1: These `.claude/...` relative links are off by one directory. From `docs/hygiene-history/ticks/2026/05/15/0414Z.md`, `../../../../../.claude/...` resolves to `docs/.claude/...` (which doesn’t exist), so the links are broken. Update them to go up to repo root (e.g., `../../../../../../.claude/...`) and apply consistently in this file.

This issue also appears in the following locations of the same file:

- line 62
- line 81
- line 111

## General comments

### @chatgpt-codex-connector (2026-05-15T05:11:52Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
