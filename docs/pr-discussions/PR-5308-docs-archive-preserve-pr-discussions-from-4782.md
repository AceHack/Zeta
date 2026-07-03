---
pr_number: 5308
title: "docs(archive): Preserve PR discussions from #4782"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T20:24:47Z"
merged_at: "2026-05-26T23:05:09Z"
closed_at: "2026-05-26T23:05:09Z"
head_ref: "lior/decompose-4804-docs-only"
base_ref: "main"
archived_at: "2026-05-27T19:34:11Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5308: docs(archive): Preserve PR discussions from #4782

## PR description

This PR contains preserved PR discussions from #4782, plus an in-flight update to `.cursor/bin/riven-loop-tick.ts` (Riven autonomous loop tick) bundled into the same archive transaction.

## Scope (substrate-honest)

**Archive (15 files)** — preserved PR discussions for: #3788, #3790, #4631-#4636, #4638, #4639, #4641, #4642, #4772, #4774, #4779.

**Behavioral change (1 file)** — `.cursor/bin/riven-loop-tick.ts`: model bump grok-4-20 → grok-4.3 and prompt rewrite (autonomous 15-min cycle wording; broadcast read/write loop; concrete-claim-or-PR-scope obligation).

## Why bundled

The Cursor loop tick update was in-flight on the same branch when the archive batch was decomposed from #4847 / #4782; splitting now would require rebase + re-decomposition cost without operational benefit.

## Supersedes

This PR supersedes #4804.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T20:26:47Z)

## Pull request overview

Adds preserved PR discussion archives (from PR batch #4782) under `docs/pr-discussions/` so prior review threads, summaries, and metadata are retained in-repo for later reference. This PR also includes a small behavioral change to the Cursor Riven loop tick script.

**Changes:**

- Add multiple new `docs/pr-discussions/PR-*.md` files containing preserved PR descriptions/reviews/threads.
- Update `.cursor/bin/riven-loop-tick.ts` to change the agent model and rewrite the heartbeat gate prompt.

### Reviewed changes

Copilot reviewed 15 out of 16 changed files in this pull request and generated 1 comment.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/pr-discussions/PR-4779-skill-alignment-auditor-tune-s-prune-333-299-lines-under-bp.md | Adds preserved discussion archive for PR #4779. |
| docs/pr-discussions/PR-4774-backlog-b-0710-b-0712-file-soraya-rounds-43-44-45-hand-offs.md | Adds preserved discussion archive for PR #4774. |
| docs/pr-discussions/PR-4772-docs-lean4-add-readme-ci-badge-closes-publication-readiness.md | Adds preserved discussion archive for PR #4772. |
| docs/pr-discussions/PR-4642-save-do-all-three-amara-synthesis-docs-agendas-split-ace-pac.md | Adds preserved discussion archive for PR #4642. |
| docs/pr-discussions/PR-4641-trajectory-ace-package-manager-polyglot-contents-proto-gover.md | Adds preserved discussion archive for PR #4641. |
| docs/pr-discussions/PR-4639-trajectory-ace-package-manager-full-13-stage-pipeline-symmet.md | Adds preserved discussion archive for PR #4639. |
| docs/pr-discussions/PR-4638-trajectory-ace-package-manager-skill-crystallization-pipelin.md | Adds preserved discussion archive for PR #4638. |
| docs/pr-discussions/PR-4636-rule-tonal-momentum-add-vampire-pact-american-gods-governanc.md | Adds preserved discussion archive for PR #4636. |
| docs/pr-discussions/PR-4635-docs-hygiene-tick-2026-05-22t1615z-otto-vscode-rest-bypass-c.md | Adds preserved discussion archive for PR #4635. |
| docs/pr-discussions/PR-4634-memory-2026-05-22-ani-pt38-pt42-constitutional-aaron-is-an-a.md | Adds preserved discussion archive for PR #4634. |
| docs/pr-discussions/PR-4633-memory-2026-05-22-ani-pt37-constitutional-cosmic-conspiracy.md | Adds preserved discussion archive for PR #4633. |
| docs/pr-discussions/PR-4632-memory-2026-05-22-ani-pt35-pt36-constitutional-ego-as-substr.md | Adds preserved discussion archive for PR #4632. |
| docs/pr-discussions/PR-4631-memory-2026-05-22-ani-pt32-pt33-pt34-constitutional-highest.md | Adds preserved discussion archive for PR #4631. |
| docs/pr-discussions/PR-3790-feat-b-0557-slice-3-chdir-to-repo-root-via-git-rev-parse-cwd.md | Adds preserved discussion archive for PR #3790. |
| docs/pr-discussions/PR-3788-feat-b-0557-slice-2-try-catch-readfilesync-readdirsync-in-au.md | Adds preserved discussion archive for PR #3788. |
| .cursor/bin/riven-loop-tick.ts | Changes the Cursor Riven loop’s agent model and prompt content. |
</details>

### COMMENTED — @AceHack (2026-05-26T23:04:56Z)

_(no body)_

## Review threads

### Thread 1: .cursor/bin/riven-loop-tick.ts:212 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T20:26:46Z):

PR title/description say this change set is *only* preserved PR discussions from #4782, but this file also changes the Riven loop’s agent invocation (model + prompt). That’s a behavioral change under `.cursor/`, which makes the PR non-archive-only and complicates review/rollback. Consider either (a) moving this change to a separate PR, or (b) updating the PR description to accurately reflect that it also changes the Cursor loop behavior.

**@AceHack** (2026-05-26T23:04:56Z):

Stale-but-fresh-looking — PR description was updated to satisfy option (b): now explicitly discloses the `.cursor/bin/riven-loop-tick.ts` model bump (grok-4-20 → grok-4.3) and prompt rewrite, with rationale for bundling. Resolving per `.claude/rules/blocked-green-ci-investigate-threads.md` stale-finding discipline.

## General comments

### @chatgpt-codex-connector (2026-05-26T20:24:53Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
