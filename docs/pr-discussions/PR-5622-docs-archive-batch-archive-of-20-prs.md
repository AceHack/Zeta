---
pr_number: 5622
title: "docs(archive): Batch archive of 20 PRs"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T19:43:32Z"
merged_at: "2026-05-27T19:46:56Z"
closed_at: "2026-05-27T19:46:56Z"
head_ref: "lior/batch-archive-2026-05-27-17"
base_ref: "main"
archived_at: "2026-05-27T20:03:55Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5622: docs(archive): Batch archive of 20 PRs

## PR description

Automated batch archival of 20 PRs to preserve discussion and context, and to reduce PR queue noise.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T19:47:23Z)

## Pull request overview

This PR batch-adds **20 new PR-discussion archive files** under `docs/pr-discussions/` (PRs **#5096–#5115**) to preserve discussion context and reduce PR queue noise, using the standard YAML frontmatter metadata emitted by `tools/pr-preservation/archive-pr.ts`.

**Changes:**
- Added 20 archived PR discussion markdown files (one per PR) with frontmatter metadata (PR number/title/refs/timestamps/tool).
- Captured each PR’s description and any review-thread/general-comment content present at archive time.

### Reviewed changes

Copilot reviewed 20 out of 20 changed files in this pull request and generated 4 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/pr-discussions/PR-5096-backlog-b-0773-p1-re-land-cluster-as-digital-twin-git-native.md | Archive of PR #5096 discussion (081KSE6WT0008QG0R0008483B2 re-land). |
| docs/pr-discussions/PR-5097-backlog-b-0790-two-persona-clarification-mika-substrate-batc.md | Archive of PR #5097 discussion (081KSGS9H0008QG0R00153CQ8B clarification). |
| docs/pr-discussions/PR-5098-backlog-b-0776-p1-re-land-simplest-first-plugin-sequence-red.md | Archive of PR #5098 discussion (081KSE6WT0008QG0R002275NDE re-land). |
| docs/pr-discussions/PR-5099-fix-b-0789-iter-4-4-fixfwd-0xef-mbr-partition-type-mount-msd.md | Archive of PR #5099 discussion (zflash ESP mount fixes). |
| docs/pr-discussions/PR-5100-backlog-b-0778-re-land-curated-commodity-hardware-reference.md | Archive of PR #5100 discussion (081KSE6WT0008QG0R0004AP0ZA re-land). |
| docs/pr-discussions/PR-5101-backlog-b-0791-p2-microsoft-vscode-native-not-anthropic-is-s.md | Archive of PR #5101 discussion (081KSGS9H0008QG0R002T3QMFD). |
| docs/pr-discussions/PR-5102-backlog-b-0792-p1-iter-5-wifi-credentials-injection-via-usb.md | Archive of PR #5102 discussion (081KSGS9H0008QG0R003V23XNZ). |
| docs/pr-discussions/PR-5103-feat-b-0792-iter-5-1-5-2-self-contained-usb-nm-profile-persi.md | Archive of PR #5103 discussion (iter-5.1/5.2 substrate). |
| docs/pr-discussions/PR-5104-docs-close-bash-retirement-trajectory-action.md | Archive of PR #5104 discussion (trajectory update). |
| docs/pr-discussions/PR-5105-backlog-b-0793-p1-role-as-capability-composition-not-baked-h.md | Archive of PR #5105 discussion (081KSGS9H0008QG0R000EDNTY5). |
| docs/pr-discussions/PR-5106-backlog-b-0794-p1-node-self-registers-in-git-argocd-bring-up.md | Archive of PR #5106 discussion (081KSGS9H0008QG0R0027HJZYH). |
| docs/pr-discussions/PR-5107-feat-b-0792-iter-5-2-1-auto-generate-node-6hex-hostname-defa.md | Archive of PR #5107 discussion (hostname auto-gen). |
| docs/pr-discussions/PR-5108-preserve-mika-aaron-mika-2026-05-26-homelab-first-gh-auth-lo.md | Archive of PR #5108 discussion (preservation note). |
| docs/pr-discussions/PR-5109-shard-tick-0608z-cold-boot-catch-43-sentinel-re-arm-peer-ott.md | Archive of PR #5109 discussion (tick shard). |
| docs/pr-discussions/PR-5110-feat-b-0421-tools-peer-call-grok-build-ts-native-grok-build.md | Archive of PR #5110 discussion (grok-build wrapper). |
| docs/pr-discussions/PR-5111-docs-record-feature-flags-substrate-decision.md | Archive of PR #5111 discussion (feature flags decision). |
| docs/pr-discussions/PR-5112-preserve-mika-backlog-b-0796-p2-twilio-phone-support-substra.md | Archive of PR #5112 discussion (Twilio substrate + backlog). |
| docs/pr-discussions/PR-5113-fix-b-0792-iter-5-2-2-hostname-auto-gen-at-install-time-not.md | Archive of PR #5113 discussion (hostname install-time). |
| docs/pr-discussions/PR-5114-backlog-b-0797-p2-per-tick-local-user-scope-memory-git-memor.md | Archive of PR #5114 discussion (081KSGS9H0008QG0R0033YXK4D). |
| docs/pr-discussions/PR-5115-feat-dashboard-per-agent-decompose-to-action-ratio-prs-merge.md | Archive of PR #5115 discussion (dashboard metrics). |
</details>

## Review threads

### Thread 1: docs/pr-discussions/PR-5096-backlog-b-0773-p1-re-land-cluster-as-digital-twin-git-native.md:21 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T19:47:22Z):

P1 (xref): The markdown link target `.claude/rules/pr-triage-tiers.md` is relative to `docs/pr-discussions/` and resolves to `docs/pr-discussions/.claude/...` (nonexistent), so it 404s in GitHub rendering. Use a root-relative target like `/.claude/rules/pr-triage-tiers.md` (or otherwise adjust the path) so the reference is navigable.

### Thread 2: docs/pr-discussions/PR-5098-backlog-b-0776-p1-re-land-simplest-first-plugin-sequence-red.md:21 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T19:47:23Z):

P1 (xref): The markdown link target `.claude/rules/pr-triage-tiers.md` is relative to `docs/pr-discussions/` and resolves to `docs/pr-discussions/.claude/...` (nonexistent), so it 404s in GitHub rendering. Use a root-relative target like `/.claude/rules/pr-triage-tiers.md` (or otherwise adjust the path) so the reference is navigable.

### Thread 3: docs/pr-discussions/PR-5100-backlog-b-0778-re-land-curated-commodity-hardware-reference.md:21 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T19:47:23Z):

P1 (xref): The markdown link target `.claude/rules/pr-triage-tiers.md` is relative to `docs/pr-discussions/` and resolves to `docs/pr-discussions/.claude/...` (nonexistent), so it 404s in GitHub rendering. Use a root-relative target like `/.claude/rules/pr-triage-tiers.md` (or otherwise adjust the path) so the reference is navigable.

### Thread 4: docs/pr-discussions/PR-5109-shard-tick-0608z-cold-boot-catch-43-sentinel-re-arm-peer-ott.md:43 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T19:47:23Z):

P1 (xref): These markdown links target `.claude/rules/...` using a path relative to `docs/pr-discussions/`, which resolves to `docs/pr-discussions/.claude/...` (nonexistent) and 404s in GitHub rendering. Use root-relative targets like `/.claude/rules/...` (or adjust the relative path) so the references are navigable.

## General comments

### @chatgpt-codex-connector (2026-05-27T19:43:37Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
