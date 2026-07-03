---
pr_number: 5037
title: "docs(archive): preserve discussions for merged PRs"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T23:53:05Z"
merged_at: "2026-05-26T09:13:27Z"
closed_at: "2026-05-26T09:13:27Z"
head_ref: "lior/archive-prs-2026-05-26-8"
base_ref: "main"
archived_at: "2026-05-27T19:47:56Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5037: docs(archive): preserve discussions for merged PRs

## PR description

This PR preserves the discussions for recently merged PRs.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T23:55:04Z)

## Pull request overview

This PR adds a new batch of preserved discussion archives for recently merged PRs under `docs/pr-discussions/`, and updates `.gitignore` to ignore alignment tool output.

**Changes:**

- Added PR discussion archive markdown files for merged PRs (#4965–#5034 subset).
- Updated `.gitignore` to ignore `tools/alignment/out/`.

### Reviewed changes

Copilot reviewed 21 out of 22 changed files in this pull request and generated no comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/pr-discussions/PR-5034-backlog-b-0759-cluster-install-ux-audit-against-first-time-c.md | New preserved discussion archive for PR #5034. |
| docs/pr-discussions/PR-5030-backlog-b-0757-cluster-auto-discovery-mdns-bootstrap-or-join.md | New preserved discussion archive for PR #5030. |
| docs/pr-discussions/PR-5029-backlog-b-0756-ha-control-plane-multi-master-k3s-embedded-et.md | New preserved discussion archive for PR #5029. |
| docs/pr-discussions/PR-5026-fix-codex-scope-backlog-pr-capacity-by-lane.md | New preserved discussion archive for PR #5026. |
| docs/pr-discussions/PR-5022-feat-pr-preservation-implement-idempotency-check-and-crlf-lf.md | New preserved discussion archive for PR #5022. |
| docs/pr-discussions/PR-5021-rule-b-0752-backlog-fighting-past-self-vs-peer-agent-disting.md | New preserved discussion archive for PR #5021. |
| docs/pr-discussions/PR-5016-backlog-b-0748-research-kro-crossplane-koreo-kubevela-carvel.md | New preserved discussion archive for PR #5016. |
| docs/pr-discussions/PR-5010-feat-b-0737-zflash-touch-id-pam-short-challenge-iso-auto-dis.md | New preserved discussion archive for PR #5010. |
| docs/pr-discussions/PR-5007-feat-agentic-org-replay-nats-outbox-follow-up.md | New preserved discussion archive for PR #5007. |
| docs/pr-discussions/PR-5005-docs-research-add-drift-report-and-preserve-prs-for-2026-05.md | New preserved discussion archive for PR #5005. |
| docs/pr-discussions/PR-4999-chore-claude-settings-add-explicit-zflash-zflash-setup-permi.md | New preserved discussion archive for PR #4999. |
| docs/pr-discussions/PR-4978-fix-riven-update-riven-worktree-path.md | New preserved discussion archive for PR #4978. |
| docs/pr-discussions/PR-4977-backlog-b-0729-obsidian-as-knowledge-graph-substrate-5-layer.md | New preserved discussion archive for PR #4977. |
| docs/pr-discussions/PR-4976-feat-substrate-max-addison-personas-onboarding-doc-manifesto.md | New preserved discussion archive for PR #4976. |
| docs/pr-discussions/PR-4975-backlog-b-0728-destructive-tool-authoring-contract-rails-per.md | New preserved discussion archive for PR #4975. |
| docs/pr-discussions/PR-4974-feat-tools-flash-usb-ts-hardening-runtime-nonce-responsibili.md | New preserved discussion archive for PR #4974. |
| docs/pr-discussions/PR-4972-docs-add-agent-work-rhythm-and-prompt-flows.md | New preserved discussion archive for PR #4972. |
| docs/pr-discussions/PR-4969-shard-1808z-pr-4953-cold-boot-triage-peer-rescue-already-lan.md | New preserved discussion archive for PR #4969. |
| docs/pr-discussions/PR-4968-docs-require-work-anchors-for-organization-discussions.md | New preserved discussion archive for PR #4968. |
| docs/pr-discussions/PR-4966-backlog-b-0727-federated-peer-mesh-5-resource-profiles-weigh.md | New preserved discussion archive for PR #4966. |
| docs/pr-discussions/PR-4965-backlog-b-0726-reticulum-throughout-cluster-nodes-edge-devic.md | New preserved discussion archive for PR #4965. |
| .gitignore | Ignore alignment tool output directory (but see inline comment about an unintended pattern line). |
</details>
