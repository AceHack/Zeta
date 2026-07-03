---
pr_number: 5191
title: "docs(archive): Decomposed preservation from #4804"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T14:48:06Z"
merged_at: "2026-05-26T15:24:57Z"
closed_at: "2026-05-26T15:24:57Z"
head_ref: "lior/pr-4804-docs-only"
base_ref: "main"
archived_at: "2026-05-27T19:39:28Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5191: docs(archive): Decomposed preservation from #4804

## PR description

This PR is a decomposition of #4804. It contains only the documentation preservation changes from that PR. The original PR also contained a destructive change (deleting a runtime file) which is not included here. This PR should be reviewed and merged, and then #4804 should be closed.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T14:54:53Z)

## Pull request overview

> [!NOTE]
> Copilot was unable to run its full agentic suite in this review.

This PR decomposes and lands the “PR preservation” documentation slice from #4804 by adding/adjusting archived PR discussion markdown records under `docs/pr-discussions/`.

**Changes:**

- Adds multiple new `docs/pr-discussions/PR-*.md` archive documents capturing preserved PR metadata and discussion content.
- Fixes `archived_at` frontmatter formatting/timestamp in a couple of existing PR-discussion archive files.

### Reviewed changes

Copilot reviewed 15 out of 15 changed files in this pull request and generated 2 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/pr-discussions/PR-4779-skill-alignment-auditor-tune-s-prune-333-299-lines-under-bp.md | Adds preserved archive record for PR #4779. |
| docs/pr-discussions/PR-4774-backlog-b-0710-b-0712-file-soraya-rounds-43-44-45-hand-offs.md | Adds preserved archive record for PR #4774. |
| docs/pr-discussions/PR-4772-docs-lean4-add-readme-ci-badge-closes-publication-readiness.md | Adds preserved archive record for PR #4772. |
| docs/pr-discussions/PR-4642-save-do-all-three-amara-synthesis-docs-agendas-split-ace-pac.md | Fixes/normalizes `archived_at` frontmatter value/formatting. |
| docs/pr-discussions/PR-4641-trajectory-ace-package-manager-polyglot-contents-proto-gover.md | Adds preserved archive record for PR #4641. |
| docs/pr-discussions/PR-4639-trajectory-ace-package-manager-full-13-stage-pipeline-symmet.md | Fixes/normalizes `archived_at` frontmatter value/formatting. |
| docs/pr-discussions/PR-4638-trajectory-ace-package-manager-skill-crystallization-pipelin.md | Adds preserved archive record for PR #4638. |
| docs/pr-discussions/PR-4636-rule-tonal-momentum-add-vampire-pact-american-gods-governanc.md | Adds preserved archive record for PR #4636. |
| docs/pr-discussions/PR-4635-docs-hygiene-tick-2026-05-22t1615z-otto-vscode-rest-bypass-c.md | Adds preserved archive record for PR #4635. |
| docs/pr-discussions/PR-4634-memory-2026-05-22-ani-pt38-pt42-constitutional-aaron-is-an-a.md | Adds preserved archive record for PR #4634. |
| docs/pr-discussions/PR-4633-memory-2026-05-22-ani-pt37-constitutional-cosmic-conspiracy.md | Adds preserved archive record for PR #4633. |
| docs/pr-discussions/PR-4632-memory-2026-05-22-ani-pt35-pt36-constitutional-ego-as-substr.md | Adds preserved archive record for PR #4632. |
| docs/pr-discussions/PR-4631-memory-2026-05-22-ani-pt32-pt33-pt34-constitutional-highest.md | Adds preserved archive record for PR #4631. |
| docs/pr-discussions/PR-3790-feat-b-0557-slice-3-chdir-to-repo-root-via-git-rev-parse-cwd.md | Adds preserved archive record for PR #3790. |
| docs/pr-discussions/PR-3788-feat-b-0557-slice-2-try-catch-readfilesync-readdirsync-in-au.md | Adds preserved archive record for PR #3788. |
</details>

## Review threads

### Thread 1: docs/pr-discussions/PR-4779-skill-alignment-auditor-tune-s-prune-333-299-lines-under-bp.md:31 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T14:54:52Z):

The markdown table rows use a double leading pipe (`||`), which renders as an extra empty column in most Markdown parsers. Change these to single leading pipes (`|`) so the table renders with the intended columns.

### Thread 2: docs/pr-discussions/PR-4774-backlog-b-0710-b-0712-file-soraya-rounds-43-44-45-hand-offs.md:81 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T14:54:53Z):

This table also uses `||` at the start of rows, which adds an unintended blank column when rendered. Use a single leading pipe (`|`) for each row to keep the table readable in GitHub’s Markdown renderer.

## General comments

### @chatgpt-codex-connector (2026-05-26T14:48:11Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-26T15:24:39Z)

Both review threads ([line 31 of PR-4779 archive](https://github.com/Lucent-Financial-Group/Zeta/pull/5191/files), [line 81 of PR-4774 archive](https://github.com/Lucent-Financial-Group/Zeta/pull/5191/files)) are confirmed false-positives of the table double-pipe (`||`) class catalogued in [`.claude/rules/blocked-green-ci-investigate-threads.md`](https://github.com/Lucent-Financial-Group/Zeta/blob/main/.claude/rules/blocked-green-ci-investigate-threads.md). Direct `awk` inspection on both lines shows single leading `|` (correct table syntax), not the asserted double-pipe. Resolving no-op.
