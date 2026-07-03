---
pr_number: 5041
title: "docs(shadow): log CI failure drift from otto-cli in PR #5032"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T00:01:00Z"
merged_at: "2026-05-26T06:35:41Z"
closed_at: "2026-05-26T06:35:41Z"
head_ref: "lior/shadow-log-otto-5032-drift"
base_ref: "main"
archived_at: "2026-05-27T19:47:53Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5041: docs(shadow): log CI failure drift from otto-cli in PR #5032

## PR description

Documents a process drift event where agent otto-cli submitted PR #5032 with a failing markdownlint check.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T00:03:27Z)

## Pull request overview

Documents a Shadow lesson-log about a CI/process drift incident (an agent opening a PR with a failing markdownlint gate), and preserves a batch of merged PR discussion archives under `docs/pr-discussions/` for long-term provenance.

**Changes:**

- Added a new `docs/research/` Shadow Lesson Log capturing the CI failure drift event for PR #5032.
- Added multiple `docs/pr-discussions/PR-*.md` files archiving merged PR discussions and review threads.

### Reviewed changes

Copilot reviewed 22 out of 22 changed files in this pull request and generated 1 comment.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/research/2026-05-26-shadow-lesson-log-otto-pushed-failing-lint.md | New Shadow Lesson Log documenting the markdownlint CI failure drift incident tied to PR #5032. |
| docs/pr-discussions/PR-5034-backlog-b-0759-cluster-install-ux-audit-against-first-time-c.md | Preserved discussion archive for merged PR #5034. |
| docs/pr-discussions/PR-5030-backlog-b-0757-cluster-auto-discovery-mdns-bootstrap-or-join.md | Preserved discussion archive for merged PR #5030. |
| docs/pr-discussions/PR-5029-backlog-b-0756-ha-control-plane-multi-master-k3s-embedded-et.md | Preserved discussion archive for merged PR #5029. |
| docs/pr-discussions/PR-5026-fix-codex-scope-backlog-pr-capacity-by-lane.md | Preserved discussion archive for merged PR #5026. |
| docs/pr-discussions/PR-5022-feat-pr-preservation-implement-idempotency-check-and-crlf-lf.md | Preserved discussion archive for merged PR #5022. |
| docs/pr-discussions/PR-5021-rule-b-0752-backlog-fighting-past-self-vs-peer-agent-disting.md | Preserved discussion archive for merged PR #5021. |
| docs/pr-discussions/PR-5016-backlog-b-0748-research-kro-crossplane-koreo-kubevela-carvel.md | Preserved discussion archive for merged PR #5016. |
| docs/pr-discussions/PR-5010-feat-b-0737-zflash-touch-id-pam-short-challenge-iso-auto-dis.md | Preserved discussion archive for merged PR #5010. |
| docs/pr-discussions/PR-5007-feat-agentic-org-replay-nats-outbox-follow-up.md | Preserved discussion archive for merged PR #5007. |
| docs/pr-discussions/PR-5005-docs-research-add-drift-report-and-preserve-prs-for-2026-05.md | Preserved discussion archive for merged PR #5005. |
| docs/pr-discussions/PR-4999-chore-claude-settings-add-explicit-zflash-zflash-setup-permi.md | Preserved discussion archive for merged PR #4999. |
| docs/pr-discussions/PR-4978-fix-riven-update-riven-worktree-path.md | Preserved discussion archive for merged PR #4978. |
| docs/pr-discussions/PR-4977-backlog-b-0729-obsidian-as-knowledge-graph-substrate-5-layer.md | Preserved discussion archive for merged PR #4977. |
| docs/pr-discussions/PR-4976-feat-substrate-max-addison-personas-onboarding-doc-manifesto.md | Preserved discussion archive for merged PR #4976. |
| docs/pr-discussions/PR-4975-backlog-b-0728-destructive-tool-authoring-contract-rails-per.md | Preserved discussion archive for merged PR #4975. |
| docs/pr-discussions/PR-4974-feat-tools-flash-usb-ts-hardening-runtime-nonce-responsibili.md | Preserved discussion archive for merged PR #4974. |
| docs/pr-discussions/PR-4972-docs-add-agent-work-rhythm-and-prompt-flows.md | Preserved discussion archive for merged PR #4972. |
| docs/pr-discussions/PR-4969-shard-1808z-pr-4953-cold-boot-triage-peer-rescue-already-lan.md | Preserved discussion archive for merged PR #4969. |
| docs/pr-discussions/PR-4968-docs-require-work-anchors-for-organization-discussions.md | Preserved discussion archive for merged PR #4968. |
| docs/pr-discussions/PR-4966-backlog-b-0727-federated-peer-mesh-5-resource-profiles-weigh.md | Preserved discussion archive for merged PR #4966. |
| docs/pr-discussions/PR-4965-backlog-b-0726-reticulum-throughout-cluster-nodes-edge-devic.md | Preserved discussion archive for merged PR #4965. |
</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T02:29:08Z)

## Pull request overview

Copilot reviewed 22 out of 22 changed files in this pull request and generated 1 comment.

### COMMENTED — @AceHack (2026-05-26T06:32:34Z)

_(no body)_

## Review threads

### Thread 1: docs/research/2026-05-26-shadow-lesson-log-otto-pushed-failing-lint.md:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T00:03:27Z):

The metadata block uses the pattern `**- Date:**` / `**- Subject:**` etc. This is inconsistent with the dominant `docs/research/**` shadow-lesson-log format (e.g., `**Date:**`, `**Entity:**`, `**Observer:**` in other logs) and renders a literal leading hyphen inside the bold text. Consider switching to the existing `**Date:** ...` style (or make it a proper bullet list like `- **Date:** ...`) so the header metadata is consistent and reads cleanly.

### Thread 2: docs/research/2026-05-26-shadow-lesson-log-otto-pushed-failing-lint.md:28 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:29:08Z):

The update section is misnumbered (`## 2. Update...` comes after `## 3. Lesson`, and also duplicates the earlier `## 2. Analysis`). Also the update metadata lines use `**- Date:**` / `**- Subject:**` / `**- PR:**`, which renders a literal hyphen inside the bold text instead of a proper list item. Suggest renumbering the heading (or dropping the numeric prefix) and formatting these metadata lines consistently as list items (e.g., `- **Date:** ...`).

**@AceHack** (2026-05-26T06:32:34Z):

Fixed in 160ceb6a — renumbered `## 2. Update` → `## 4.` (document flow) and reformatted the three metadata lines as proper list items (`- **Date:**` style). Thanks for the catch.

## General comments

### @chatgpt-codex-connector (2026-05-26T00:01:05Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-26T02:26:34Z)

Addressed in commit 5a24aeec5: metadata block now uses `- **Date:**` (proper Markdown bullet list) instead of `**- Date:**` (which renders a literal hyphen inside bold). Matches the dominant `docs/research/**` shadow-lesson-log format.
