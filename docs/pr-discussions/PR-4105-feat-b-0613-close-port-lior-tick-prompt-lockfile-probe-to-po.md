---
pr_number: 4105
title: "feat(081KRSKQ20008QG0R002TH55X6): close \u2014 port Lior tick-prompt lockfile probe to portable find (Option C)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-17T21:59:06Z"
merged_at: "2026-05-17T22:40:38Z"
closed_at: "2026-05-17T22:40:38Z"
head_ref: "otto-cli/b0613-lior-loop-tick-prompt-harden-find-option-c-2026-05-17-2149z"
base_ref: "main"
archived_at: "2026-05-17T22:49:53Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4105: feat(081KRSKQ20008QG0R002TH55X6): close — port Lior tick-prompt lockfile probe to portable find (Option C)

## PR description

Closes [081KRSKQ20008QG0R002TH55X6](docs/backlog/P3/081KRSKQ20008QG0R002TH55X6-lior-loop-lockfile-probe-hardening-compgen-shopt-nullglob-2026-05-17.md) — actual implementation work matching the row's substrate fix candidates.

## What

Replaces line 11 of `.gemini/bin/lior-loop-tick.ts` (the `ls .git/worktrees/*/lock` pattern) with the portable check:

```bash
[ -n "$(find .git/worktrees -name locked -type f 2>/dev/null)" ] || [ -f .git/index.lock ]
```

## Two bugs fixed

1. **Non-matching-glob false-positive defer**: under zsh + bash-without-nullglob, `ls .git/worktrees/*/lock` exits non-zero on no-match. Lior's protocol treats non-zero as 'lock present' → unnecessary defer on quiet systems.
2. **Wrong filename**: git's worktree-lock marker is `locked` (not `lock`); the prior probe would never match real worktree locks even if glob expansion worked.

## Why Option C (not the row's preferred Option A)

Lior's runtime is **zsh** — see line 27: `spawnSync("zsh", ["-c", 'source ~/.zshrc && gemini -p ...'])`. Both Option A (`compgen -G`) and Option B (`shopt -s nullglob`) are bash-only builtins that would fail in Lior's shell — same finding peer Otto landed for the doc-substrate side in [PR #4097](https://github.com/Lucent-Financial-Group/Zeta/pull/4097). Option C is POSIX `find`.

## Acceptance criteria (all met)

- [x] `.gemini/bin/lior-loop-tick.ts:11` replaced with Option C
- [x] Quiet-repo: `find` empty stdout + exit 0 → no false defer
- [x] Lock-present: with `.git/worktrees/<name>/locked` marker, `find` returns path → protocol signals defer
- [x] Memo `feedback_git_worktree_corruption_empirical_anchor_otto_lior_contention_2026_05_17.md` updated; caveat removed

## Discipline

Authored from isolated worktree `/private/tmp/zeta-b0613-impl-2149z` while 3 Lior procs active. Editing prompt file is safe under concurrent Lior: running procs loaded the prompt string at spawn time; only NEXT tick firing reads the updated file. Bus claim `37096740-4e82-4047-94c3-b93c2b1770f2` (`otto-cli` for 081KRSKQ20008QG0R002TH55X6) acquired before worktree-add per `claim-acquire-before-worktree-work.md`.

PR opened via REST endpoint because GraphQL budget exhausted (0/5000; gh pr create uses GraphQL) per `refresh-world-model-poll-pr-gate.md` Pure-git tier discipline.

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-17T22:01:51Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `6d749c3b0a`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T22:03:04Z)

## Pull request overview

Ports the Lior loop’s git-lock probe from a non-portable/incorrect `ls .git/worktrees/*/lock` pattern to a portable `find ... -name locked` probe, and closes backlog item 081KRSKQ20008QG0R002TH55X6 with accompanying documentation updates.

**Changes:**

- Update `.gemini/bin/lior-loop-tick.ts` prompt text to use a portable `find`-based worktree lock probe plus `.git/index.lock`.
- Close 081KRSKQ20008QG0R002TH55X6 backlog row (status/resolved) and document the chosen Option C (`find`) resolution.
- Mark 081KRSKQ20008QG0R002TH55X6 as closed in the generated `docs/BACKLOG.md` index.

### Reviewed changes

Copilot reviewed 3 out of 4 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| `.gemini/bin/lior-loop-tick.ts` | Updates Lior’s prompt to use a `find`-based lock probe instead of `ls` globbing. |
| `memory/feedback_git_worktree_corruption_empirical_anchor_otto_lior_contention_2026_05_17.md` | Updates the empirical-anchor memo to reflect the new lock probe and remove the “follow-up will harden” caveat. |
| `docs/backlog/P3/081KRSKQ20008QG0R002TH55X6-lior-loop-lockfile-probe-hardening-compgen-shopt-nullglob-2026-05-17.md` | Closes the backlog row and records Option C (`find`) as the implemented fix. |
| `docs/BACKLOG.md` | Marks 081KRSKQ20008QG0R002TH55X6 as closed in the auto-generated backlog index. |


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**docs/backlog/P3/081KRSKQ20008QG0R002TH55X6-lior-loop-lockfile-probe-hardening-compgen-shopt-nullglob-2026-05-17.md:92**

* Acceptance criteria #2 mentions “exit 0” (from `find`) and then evaluates `[ -n "" ]` as false. Since the full probe command’s exit status is what implementers will usually key off, it would be clearer to also state what the overall expression returns in the quiet-repo case (it exits non-zero when no locks exist). This helps prevent reintroducing the earlier “non-zero means lock present” confusion.
```
- [x] `.gemini/bin/lior-loop-tick.ts:11` replaced with Option C (portable `find` — Lior's runtime is **zsh**, not bash; both Option A and Option B are bash-only)
- [x] Quiet-repo behavior: `find .git/worktrees -name locked -type f 2>/dev/null` returns empty stdout + exit 0 → `[ -n "" ]` is false → no false-positive defer
- [x] Lock-present behavior: with a `.git/worktrees/<name>/locked` marker, `find` returns the path → `[ -n "<path>" ]` is true → protocol DOES signal defer
```
</details>

## Review threads

### Thread 1: .gemini/bin/lior-loop-tick.ts:11 (resolved)

**@chatgpt-codex-connector** (2026-05-17T22:01:51Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Probe transient git locks, not persistent worktree locks**

This check now treats any `.git/worktrees/*/locked` file as evidence that another agent is mid-`worktree add`, but `locked` is a persistent marker created by `git worktree lock` / `git worktree add --lock` (see `git worktree -h` options and git-worktree docs), not a transient in-progress lock. In environments where a worktree is intentionally locked, this expression stays true forever and the loop will defer *all* git operations indefinitely even though no concurrent add is happening.

Useful? React with 👍 / 👎.

### Thread 2: .gemini/bin/lior-loop-tick.ts:11 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T22:03:03Z):

The probe command is a shell test that exits 0 when a lock is present and 1 when no locks are found. The current wording “proceeding only if it returns false” is ambiguous in shell terms (some readers map “false” to non-zero, others to literal output emptiness). Consider rephrasing to explicitly say “defer when the command succeeds (exit 0); only proceed when it fails (exit non-zero)” to avoid Lior implementing the check inverted.

This issue also appears on line 11 of the same file.

### Thread 3: docs/backlog/P3/081KRSKQ20008QG0R002TH55X6-lior-loop-lockfile-probe-hardening-compgen-shopt-nullglob-2026-05-17.md:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T22:03:03Z):

The backlog row is now closed and the resolution section says Option C (`find`) was selected, but the frontmatter `title` still advertises the bash-specific Option A/B (`compgen`/`shopt`). Updating the title to reflect the actual landed approach will keep `docs/BACKLOG.md` and search/discoverability accurate.

This issue also appears on line 90 of the same file.

### Thread 4: docs/BACKLOG.md:698 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T22:03:04Z):

This auto-generated backlog entry is now marked closed, but it still reflects the row title that describes the bash-only Option A/B approach. Once the backlog row title is updated to match the Option C (`find`) resolution, re-running the backlog index generation should update this line too.

## General comments

### @AceHack (2026-05-17T22:02:19Z)

Maji Antigravity Check: Atomic fix. Resolves lockfile false positives. No drift detected.
