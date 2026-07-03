---
pr_number: 5135
title: "docs(shadow): re-land 3 unique substrate files from stale PR #4839"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T11:19:24Z"
merged_at: "2026-05-26T14:57:10Z"
closed_at: "2026-05-26T14:57:10Z"
head_ref: "otto-cli/reland-4839-riven-shadow-log-substrate-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:41:05Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5135: docs(shadow): re-land 3 unique substrate files from stale PR #4839

## PR description

## Summary

Tier-3 re-land per [`.claude/rules/pr-triage-tiers.md`](../../.claude/rules/pr-triage-tiers.md) of 3 unique substantive files from stale PR #4839.

## Why a fresh PR

PR #4839 (branch `lior-shadow-log-riven-dirty-worktree`) is **76,920 lines behind origin/main** (548 files changed in diff against main). Merging it as-is would regress runtime scripts including `.cursor/bin/riven-loop-tick.ts` — per the runtime-script special-case guard in [`.claude/rules/claim-acquire-before-worktree-work.md`](../../.claude/rules/claim-acquire-before-worktree-work.md), runtime scripts evolve continuously on main and re-applying a multi-day-old version regresses substantive newer tuning.

The 2 unresolved review threads on #4839 referenced `.cursor/bin/riven-loop-tick.ts` at the stale branch's view of that file (which IS broken: raw newline inside `"\n"` literal at line 124). Those threads don't apply to this PR because we're not touching that runtime script.

## Files re-landed (verbatim from #4839 branch)

- `docs/research/2026-05-24-shadow-lesson-log-riven-dirty-worktree.md`
- `memory/feedback_aaron_family_configuration_cooperative_substrate_2026_05_22.md`
- `memory/riven/ide/cursor/conversations/2026-05-22-aaron-riven-full-session-substrate-trajectory.md`

These 3 files exist ONLY on the #4839 branch (verified via `git ls-tree origin/main`). Pure docs/memory substrate; no runtime-script risk.

## Test plan

- [x] Branch off current `origin/main`
- [x] `git checkout origin/lior-shadow-log-riven-dirty-worktree -- <3 files>` (verbatim re-land)
- [x] No `.cursor/bin/riven-loop-tick.ts` modification
- [ ] PR opens cleanly, required checks pass
- [ ] #4839 closed with cross-reference to this PR

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-26T11:20:45Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `9db307ec06`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @AceHack (2026-05-26T11:47:42Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-26T11:47:43Z)

_(no body)_

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T12:04:42Z)

Copilot encountered an error and was unable to review this pull request. You can try again by re-requesting a review.

## Review threads

### Thread 1: memory/riven/ide/cursor/conversations/2026-05-22-aaron-riven-full-session-substrate-trajectory.md:4 (resolved)

**@chatgpt-codex-connector** (2026-05-26T11:20:45Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Classify external transcript as research-grade**

This file is an external-conversation absorb, but it is marked `Operational status: active anchor`; AGENTS.md requires absorbs to carry archive headers with `Operational status: research-grade` until a separate promotion lands. Keeping it operational here lets downstream agents treat unratified conversation content as current policy/substrate, which can silently steer later decisions from non-promoted material.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-26T11:47:42Z):

Verified the finding against the file content + AGENTS.md §287-293. Fixed in 3c85a2c5d: header now reads `Operational status: research-grade` and carries the GOVERNANCE.md §33 absorb tag. Promotion to operational status will require a separate landing step per AGENTS.md absorb-discipline. Resolving.

### Thread 2: memory/riven/ide/cursor/conversations/2026-05-22-aaron-riven-full-session-substrate-trajectory.md:57 (resolved)

**@chatgpt-codex-connector** (2026-05-26T11:20:45Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Remove family-identifying specifics from persona memory**

This section stores exact family counts and cross-household relationship logistics, which conflicts with the opaque-pointer consent policy added in the same commit (`preserve pattern, not counts/household specifics unless explicit consent is recorded`). No explicit consent record is included here, so this introduces policy-violating sensitive detail into durable memory and increases the chance future sessions propagate data that should remain abstracted.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-26T11:47:43Z):

Verified the finding: sections 7-9 carried specifics (counts, household layout, spouse details, child-specific details, dollar amounts, depression durations) that conflict with the opaque-pointer consent policy landed in the same commit's companion file `memory/feedback_aaron_family_configuration_cooperative_substrate_2026_05_22.md`. Fixed in 3c85a2c5d: sections 7-9 now carry the generalized pattern only + a forward-ref to the consent-policy memory file. Substrate-engineering content (sections 1-6, 10-13) preserved intact. Resolving.

## General comments

### @chatgpt-codex-connector (2026-05-26T11:47:34Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-26T14:35:02Z)

This is a well-decomposed PR that extracts valuable substrate from a stale branch. I approve of the changes. However, for safety, a basic CI check should be added to this PR, especially with auto-merge enabled. A simple check that validates markdown formatting or runs a linter on the changed files would be sufficient.

### @AceHack (2026-05-26T14:53:53Z)

Closing to refire CI — required-check identity not fulfilled due to GitHub Actions outage 10:57Z during initial PR open. Will reopen to trigger pull_request event workflow.

### @AceHack (2026-05-26T14:54:00Z)

Reopening to refire pull_request event workflows after GHA recovery.
