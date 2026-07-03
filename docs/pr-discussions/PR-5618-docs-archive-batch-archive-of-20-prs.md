---
pr_number: 5618
title: "docs(archive): Batch archive of 20 PRs"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T19:40:19Z"
merged_at: "2026-05-27T19:43:35Z"
closed_at: "2026-05-27T19:43:35Z"
head_ref: "lior/batch-archive-2026-05-27-15"
base_ref: "main"
archived_at: "2026-05-27T20:03:55Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5618: docs(archive): Batch archive of 20 PRs

## PR description

Automated batch archival of 20 PRs to preserve discussion and context, and to reduce PR queue noise.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T19:44:06Z)

## Pull request overview

This PR mechanically adds 20 preserved PR-discussion archives under `docs/pr-discussions/`, extending the repository’s historical PR context record.

**Changes:**

- Adds archived markdown records for merged PRs #5137–#5218.
- Preserves PR metadata, descriptions, review summaries, review threads, and general comments.
- Uses the existing `tools/pr-preservation/archive-pr.ts` frontmatter schema across all new files.

### Reviewed changes

Copilot reviewed 20 out of 20 changed files in this pull request and generated 5 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/pr-discussions/PR-5137-tick-1202z-cold-boot-empirical-anchor-github-actions-outage.md | Adds archive for PR #5137. |
| docs/pr-discussions/PR-5138-docs-archive-preserve-prs-5130-5134.md | Adds archive for PR #5138. |
| docs/pr-discussions/PR-5171-docs-shadow-add-lesson-on-preservation-blob-drift.md | Adds archive for PR #5171. |
| docs/pr-discussions/PR-5174-docs-archive-preserve-pr-discussions-batch-1.md | Adds archive for PR #5174. |
| docs/pr-discussions/PR-5177-docs-shadow-add-lesson-on-agent-paralysis-and-state-inconsis.md | Adds archive for PR #5177. |
| docs/pr-discussions/PR-5178-feat-ai-cluster-add-local-dev-cluster-bootstrap-from-4979.md | Adds archive for PR #5178. |
| docs/pr-discussions/PR-5182-tick-0526-1408z-otto-cli-cold-boot-visibility-shard-6h-gap-d.md | Adds archive for PR #5182. |
| docs/pr-discussions/PR-5191-docs-archive-decomposed-preservation-from-4804.md | Adds archive for PR #5191. |
| docs/pr-discussions/PR-5192-revert-restore-cursor-bin-riven-loop-tick-ts.md | Adds archive for PR #5192. |
| docs/pr-discussions/PR-5193-fix-docs-correct-relative-links-in-1202z-tick-shard.md | Adds archive for PR #5193. |
| docs/pr-discussions/PR-5199-docs-shadow-add-lesson-log-for-lior-metadata-churn.md | Adds archive for PR #5199. |
| docs/pr-discussions/PR-5206-docs-archive-preserve-discussion-for-pr-5134.md | Adds archive for PR #5206. |
| docs/pr-discussions/PR-5210-feat-iter-5-4-0-b-0794-homelab-gh-auth-login-operator-pubkey.md | Adds archive for PR #5210. |
| docs/pr-discussions/PR-5211-backlog-b-0812-p1-iter-5-4-1-self-registration-commit-push-t.md | Adds archive for PR #5211. |
| docs/pr-discussions/PR-5212-backlog-b-0813-p1-iter-5-4-2-argocd-app-watches-maintainers.md | Adds archive for PR #5212. |
| docs/pr-discussions/PR-5213-docs-shadow-add-lesson-log-for-human-decomposition-and-criti.md | Adds archive for PR #5213. |
| docs/pr-discussions/PR-5214-fix-postmerge-5210-5-copilot-findings-prompt-copy-comment-ac.md | Adds archive for PR #5214. |
| docs/pr-discussions/PR-5216-feat-b-0814-backlog-b-0815-ts-deregister-node-tool-heartbeat.md | Adds archive for PR #5216. |
| docs/pr-discussions/PR-5217-feat-b-0805-sub-target-1-audit-dep-currency-ts-dep-pin-inven.md | Adds archive for PR #5217. |
| docs/pr-discussions/PR-5218-feat-b-0800-iter-6-0-bump-nixpkgs-nix-darwin-24-11-25-11-xan.md | Adds archive for PR #5218. |
</details>

## Review threads

### Thread 1: docs/pr-discussions/PR-5137-tick-1202z-cold-boot-empirical-anchor-github-actions-outage.md:44 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T19:44:05Z):

P1/xref: These archived GitHub PR-page links still use `../blob/main/...`; from `docs/pr-discussions/` they resolve under `docs/blob/main/...` instead of the repository root and will 404. Rewrite them to archive-relative repo paths such as `../../.claude/rules/...` (or full GitHub blob URLs), matching the preservation fixes recorded in prior archives.

### Thread 2: docs/pr-discussions/PR-5137-tick-1202z-cold-boot-empirical-anchor-github-actions-outage.md:44 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T19:44:06Z):

P1/xref: This `../blob/main/...` link has the same archive-depth problem: when rendered from `docs/pr-discussions/`, it points at `docs/blob/main/...` and is not navigable. Convert it to `../../.claude/rules/...` or a full GitHub URL so the preserved citation works from the archive.

### Thread 3: docs/pr-discussions/PR-5137-tick-1202z-cold-boot-empirical-anchor-github-actions-outage.md:55 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T19:44:06Z):

P1/xref: This preserved rule link still targets `../blob/main/...`, which is only valid from a GitHub PR page. In this archive file it resolves to a nonexistent `docs/blob/main/...` path; use `../../.claude/rules/...` or a full GitHub URL instead.

### Thread 4: docs/pr-discussions/PR-5137-tick-1202z-cold-boot-empirical-anchor-github-actions-outage.md:60 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T19:44:06Z):

P1/xref: This archived link uses the GitHub PR-page-relative `../blob/main/...` form, so it will 404 when clicked from `docs/pr-discussions/`. Please rewrite it to the correct archive-relative path (`../../.claude/rules/...`) or an absolute GitHub URL.

### Thread 5: docs/pr-discussions/PR-5137-tick-1202z-cold-boot-empirical-anchor-github-actions-outage.md:118 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T19:44:06Z):

P1/xref: The closing citation also uses `../blob/main/...`, which is broken from the archive location because it resolves under `docs/blob/main`. Convert it to `../../.claude/rules/...` (or a full GitHub URL) to keep the preserved discussion self-auditable.

## General comments

### @chatgpt-codex-connector (2026-05-27T19:40:24Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
