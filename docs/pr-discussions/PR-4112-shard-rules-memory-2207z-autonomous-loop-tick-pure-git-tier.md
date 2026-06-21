---
pr_number: 4112
title: "shard+rules+memory(2207Z): autonomous-loop tick \u2014 pure-git tier, cross-session sentinel non-persistence anchor, Riven .sh shadow-catch"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-17T22:22:43Z"
merged_at: "2026-05-17T22:33:46Z"
closed_at: "2026-05-17T22:33:46Z"
head_ref: "otto/shard-tick-2207z-cold-boot-cron-armed-2026-05-17"
base_ref: "main"
archived_at: "2026-05-17T22:49:51Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4112: shard+rules+memory(2207Z): autonomous-loop tick — pure-git tier, cross-session sentinel non-persistence anchor, Riven .sh shadow-catch

## PR description

## Summary

3-commit landing from the 2207Z autonomous-loop tick. Mixed but cohesive: one tick shard + one rule sharpening grounded in the shard's empirical anchor + one memory shadow-catch observed during the same tick chain.

## Commits

- `2cf6fac` **shard(2026-05-17/2207Z)**: autonomous-loop tick — pure-git tier, cron re-arm, Lior race respected, bg-worker 081KQNJ500008QG0R003SCWBDV unchallenged
- `e1b679a` **rules(tick-must-never-stop)**: distinguish session-exit non-persistence from within-session auto-expire (2207Z empirical anchor)
- `41ce70f` **memory(shadow-catch)**: riven-cursor-terminal-loop.sh untracked Rule 0 violation candidate (2218Z observation)

## Empirical anchor — cross-session sentinel non-persistence (~38 min)

Prior session at 2129Z armed sentinel `de1e7f5d`. This session at 2207Z found `CronList` empty — gone within ~38 min, far shorter than the documented 7-day or empirical 3-day auto-expire windows. Per `CronCreate` documentation, this is **session-exit non-persistence by design** (in-memory cron dies with the Claude Code process), distinct from within-session auto-expire timer. The rule sharpening adds a 2-row table distinguishing the two mechanisms and points at the 2207Z shard as the empirical anchor.

## Shadow-catch — Riven `.sh` Rule 0 violation candidate

Untracked peer-WIP `tools/riven/riven-cursor-terminal-loop.sh` (95-line bash launcher wrapping `bun tools/riven/riven-cursor-terminal-loop.ts`) would violate `.claude/rules/rule-0-no-sh-files.md` if committed (runtime launcher, NOT install-graph). Memo documents the choice-point (port to TS / gitignore / relocate to tools/setup/) without prescribing resolution or stealing peer's WIP. Pure-git tier blocked safe backlog-ID allocation; memory file is the substrate-honest alternative.

## REST PR-creation fallback

This PR was opened via REST `POST /repos/Lucent-Financial-Group/Zeta/pulls` per the rule [#4107](https://github.com/Lucent-Financial-Group/Zeta/pull/4107) just merged. GraphQL was 0/5000 at PR-create time; REST `core` was 4686. Auto-merge arming deferred to post-reset (`gh pr merge --auto` uses GraphQL).

## Test plan

- [ ] CodeQL passes (docs-only PR; canary check during commit confirmed ls-tree 53 root entries — no corruption from Lior race-window)
- [ ] Reviewer threads (if any) addressed before auto-merge arming
- [ ] Post-rate-reset tick arms `gh pr merge <N> --auto --squash`

## Composes with

- [PR #4107](https://github.com/Lucent-Financial-Group/Zeta/pull/4107) — REST PR-creation fallback rule (the rule this PR uses)
- [PR #4097](https://github.com/Lucent-Financial-Group/Zeta/pull/4097) + [#4100](https://github.com/Lucent-Financial-Group/Zeta/pull/4100) + [#4104](https://github.com/Lucent-Financial-Group/Zeta/pull/4104) — peer Otto's 2129Z cascade
- `.claude/rules/tick-must-never-stop.md` (sharpened by this PR)
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` (counter-with-escalation framework followed: brief-acks 1→2→pre-empt-#3→1→2→pre-empt-#4 → this PR creation closes the chain)
- `.claude/rules/refresh-world-model-poll-pr-gate.md` (pure-git tier + REST fallback applied)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T22:26:04Z)

## Pull request overview

Documents the 2026-05-17/2207Z autonomous-loop tick and uses that observation to sharpen the “tick must never stop” rule by distinguishing cross-session cron non-persistence from within-session auto-expire; also records a “shadow-catch” about an untracked `.sh` launcher that would violate Rule 0 if committed.

**Changes:**
- Adds a new tick shard documenting pure-git tier behavior and the cross-session cron sentinel disappearance.
- Updates `.claude/rules/tick-must-never-stop.md` with a clear two-mechanism table (session-exit vs within-session auto-expire) anchored to the 2207Z shard.
- Adds a memory “shadow-catch” entry about an untracked `tools/riven/*.sh` launcher and decision options if it ever needs to ship.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| memory/feedback_otto_cli_shadow_catch_riven_cursor_terminal_loop_sh_untracked_rule_0_violation_candidate_2026_05_17.md | Records an early-warning “shadow-catch” about an untracked `.sh` launcher that would violate Rule 0 if committed. |
| docs/hygiene-history/ticks/2026/05/17/2207Z.md | Adds the 2207Z tick shard documenting pure-git tier constraints and the cron sentinel non-persistence observation. |
| .claude/rules/tick-must-never-stop.md | Clarifies cron expiration/non-persistence modes with an anchored table and updated diagnostic framing. |


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**memory/feedback_otto_cli_shadow_catch_riven_cursor_terminal_loop_sh_untracked_rule_0_violation_candidate_2026_05_17.md:58**
* P0: This note lists what appear to be personal/local data extract filenames (e.g., `amazon-orders-2025-full.json`). Even without contents, committing these identifiers can be sensitive and isn’t needed to make the “untracked substantive WIP exists” point. Remove the specific filenames or replace with a redacted/generic description (e.g., “private data extracts (do not commit)”).
```
Observed at 2026-05-17T22:18Z during autonomous-loop tick (pre-empt-at-#4 in the brief-ack chain that started at 2207Z). Pure-git tier blocked safe backlog-ID allocation (no `gh pr list --search "B-NNNN"` for in-flight check); memory file is the substrate-honest alternative until a backlog row can be filed post-rate-reset.

The file's untracked-but-substantive shape is the same class as the other untracked WIP observed at cold-boot (`memory/feedback_otto_cwd_parameter_fix_2026_05_16.md`, `memory/kestrel/conversations/2026-05-17-kestrel-aaron-claudeai-financial-substrate-critique-*.md`, `amazon-hardware-titles-page1.txt`, `amazon-orders-2025-full.json`, `zeta-hardware-extract-page1.txt`). Cold-boot-into-contested-root-worktree consistently surfaces this lost-files-adjacent class; the substrate-honest pattern is observe + document + don't-steal.
```
</details>

## Review threads

### Thread 1: memory/feedback_otto_cli_shadow_catch_riven_cursor_terminal_loop_sh_untracked_rule_0_violation_candidate_2026_05_17.md:12 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T22:26:04Z):

P1: The memory entry embeds an absolute local path containing the workstation username (`/Users/acehack/...`). Since memory files are committed to the repo, this leaks environment-specific and potentially sensitive info; rewrite to a generic description (e.g., “in the primary worktree”) or use `$REPO_ROOT` without the user/home path.

This issue also appears on line 56 of the same file.

### Thread 2: docs/hygiene-history/ticks/2026/05/17/2207Z.md:54 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T22:26:04Z):

P1: This section frames the 38-minute disappearance as confirming both (a) cross-session non-persistence and (b) a shorter-than-documented auto-expire window, but the observation itself is ambiguous and could be entirely explained by session-exit non-persistence (as the updated rule text notes). Rewrite to explicitly distinguish “session exit” vs “within-session auto-expire”, and avoid attributing the 38-minute case to auto-expire unless there’s a within-session reproduction.

### Thread 3: docs/hygiene-history/ticks/2026/05/17/2207Z.md:75 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T22:26:04Z):

P2: The CodeQL canary rule’s stronger check compares `git ls-tree` counts against `origin/main` (and flags when the delta is large), while here the shard claims “52 root entries confirms no canary corruption” without recording the expected count or comparison. Soften to “passes the <50 heuristic” or include expected vs actual per the rule’s snippet so future readers can audit the claim.

## General comments

### @AceHack (2026-05-17T22:24:56Z)

Maji antigravity check: This PR is a blob mixing shard, rules, and memory changes. I have peeled off the shard commit into a separate atomic PR.
