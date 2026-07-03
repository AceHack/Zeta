---
pr_number: 5627
title: "docs(archive): Batch archive of 20 PRs"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T19:52:23Z"
merged_at: "2026-05-27T19:56:16Z"
closed_at: "2026-05-27T19:56:16Z"
head_ref: "lior/batch-archive-2026-05-27-22"
base_ref: "main"
archived_at: "2026-05-27T20:03:55Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5627: docs(archive): Batch archive of 20 PRs

## PR description

Automated batch archival of 20 PRs to preserve discussion and context, and to reduce PR queue noise.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T19:55:20Z)

## Pull request overview

This PR adds generated GitHub PR discussion archives under `docs/pr-discussions/`, preserving PR bodies, reviews, and threads for historical traceability. The files match the repository’s PR-preservation archive shape and live in a markdownlint-ignored history surface intended for verbatim content.

**Changes:**

- Adds 20 generated archive files for merged PRs #4897–#4915 and #4930.
- Preserves PR metadata, descriptions, reviews, review threads, and comments.
- Uses `tools/pr-preservation/archive-pr.ts` as the recorded archive tool.

### Reviewed changes

Copilot reviewed 20 out of 20 changed files in this pull request and generated no comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| `docs/pr-discussions/PR-4897-feat-infra-single-file-installer-packages-for-usb-stick-addi.md` | Archives PR #4897 discussion. |
| `docs/pr-discussions/PR-4898-feat-infra-flake-nix-shared-nixos-modules-pr-2-of-addison-s.md` | Archives PR #4898 discussion. |
| `docs/pr-discussions/PR-4899-feat-infra-per-host-configs-control-plane-worker-gpu-01-02-p.md` | Archives PR #4899 discussion. |
| `docs/pr-discussions/PR-4900-feat-infra-k8s-bootstrap-argocd-app-of-apps-pr-4-of-addison.md` | Archives PR #4900 discussion. |
| `docs/pr-discussions/PR-4901-docs-infra-infra-readme-md-bootstrap-runbook-pr-5-of-addison.md` | Archives PR #4901 discussion. |
| `docs/pr-discussions/PR-4902-shard-2026-05-25-0243z-18th-dotgit-anchor-5th-consecutive-0.md` | Archives PR #4902 discussion. |
| `docs/pr-discussions/PR-4903-fix-installer-refresh-embedded-runbook-addison.md` | Archives PR #4903 discussion. |
| `docs/pr-discussions/PR-4904-chore-perms-allow-brew-install-nix-cli-darwin-rebuild.md` | Archives PR #4904 discussion. |
| `docs/pr-discussions/PR-4905-ci-infra-build-installer-iso-on-prs-main-release-publish.md` | Archives PR #4905 discussion. |
| `docs/pr-discussions/PR-4906-feat-infra-nix-darwin-linux-builder-for-local-x86-64-linux-i.md` | Archives PR #4906 discussion. |
| `docs/pr-discussions/PR-4907-fix-infra-pin-nix-darwin-to-nix-darwin-24-11-release-branch.md` | Archives PR #4907 discussion. |
| `docs/pr-discussions/PR-4908-shard-2026-05-25-0407z-19th-dotgit-anchor-6th-0-stuck-proc-r.md` | Archives PR #4908 discussion. |
| `docs/pr-discussions/PR-4909-shard-2026-05-25-0443z-20th-dotgit-anchor-7th-consecutive-0.md` | Archives PR #4909 discussion. |
| `docs/pr-discussions/PR-4910-feat-ai-cluster-bootstrap-two-directory-declarative-ai-clust.md` | Archives PR #4910 discussion. |
| `docs/pr-discussions/PR-4911-shard-2026-05-25-0613z-otto-cli-cold-boot-composite-branch-c.md` | Archives PR #4911 discussion. |
| `docs/pr-discussions/PR-4912-feat-ai-cluster-istio-out-cert-manager-spire-trust-manager-e.md` | Archives PR #4912 discussion. |
| `docs/pr-discussions/PR-4913-feat-hindsight-wire-real-vectorize-io-oci-helm-chart.md` | Archives PR #4913 discussion. |
| `docs/pr-discussions/PR-4914-shard-2026-05-25-1009z-cold-boot-sentinel-fired-again-lior-s.md` | Archives PR #4914 discussion. |
| `docs/pr-discussions/PR-4915-shard-2026-05-25-1131z-3rd-otto-cli-cold-boot-today-recursio.md` | Archives PR #4915 discussion. |
| `docs/pr-discussions/PR-4930-feat-hat-system-scaffold-society-safety-layer-operator-for-a.md` | Archives PR #4930 discussion. |
</details>

## General comments

### @chatgpt-codex-connector (2026-05-27T19:52:28Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
